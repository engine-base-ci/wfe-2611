import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { createPool } from "../src/pool.js";
import { createRepository, type Repository } from "../src/repository.js";
import { seedAccessMatrix } from "../src/seeds.js";
import { withTenant } from "../src/context.js";

const URL = process.env["DATABASE_URL"]!;
const APP_URL = URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const admin = new pg.Pool({ connectionString: URL, max: 2 });
let app: pg.Pool;
let repo: Repository;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;

beforeAll(async () => {
  await migrate(URL, pkg);
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
  app = createPool({ databaseUrl: APP_URL, max: 3 });
  repo = await createRepository(app);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});
const boss = () => ({ tenantId: S.tenantA, userId: S.bossA, role: "member" as const });
const staff = () => ({ tenantId: S.tenantA, userId: S.staffA, role: "member" as const });
const ops = () => ({ tenantId: S.tenantA, userId: S.opsId, role: "ops" as const });

describe("証跡（追記専用・関門で 1 回）", () => {
  it("repository の create／update／softDelete は同じトランザクションで audit_events に残る", async () => {
    const t = repo.table("layers");
    const row = await t.create(boss(), { key: "au", label: "証跡", order_no: 7 });
    const id = String(row["id"]);
    await t.update(boss(), id, { label: "証跡 2" });
    await t.softDelete(boss(), id);
    const ev = await repo.table("audit_events").list(boss(), { where: { target_id: id }, orderBy: "occurred_at" });
    expect(ev.map((e) => e["action"])).toEqual(["layers.create", "layers.update", "layers.delete"]);
    expect(ev[0]!["actor_member_id"]).toBe(S.bossA);
    expect(ev[0]!["choke_point_id"]).toBe("C2");
  });
  it("書き込みが RLS で失敗したら証跡も残らない（同じトランザクション）", async () => {
    await expect(repo.table("layers").create(staff(), { key: "no", label: "x", order_no: 8 })).rejects.toThrow();
    const ev = await repo.table("audit_events").list(boss(), { where: { action: "layers.create" } });
    expect(ev.some((e) => e["actor_member_id"] === S.staffA)).toBe(false);
  });
  it("証跡は直接 INSERT できない・UPDATE／DELETE は所有者でも弾く・repository からも書けない", async () => {
    await expect(
      withTenant(app, boss(), (c) =>
        c.query(
          "insert into audit_events (tenant_id, actor_role, action, target_type) values ($1, 'member', 'x', 'x')",
          [S.tenantA],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const anyId = (await admin.query<{ id: string }>("select id from audit_events limit 1")).rows[0]!.id;
    await expect(admin.query("update audit_events set action = 'x' where id = $1", [anyId])).rejects.toThrow(
      /追記専用/,
    );
    await expect(admin.query("delete from audit_events where id = $1", [anyId])).rejects.toThrow(/追記専用/);
    await expect(repo.table("audit_events").create(boss(), { action: "x" })).rejects.toThrow(/追記専用/);
  });
  it("会社の人は自社の証跡だけ読める。運営は grant があるときだけ", async () => {
    expect((await repo.table("audit_events").list(staff())).every((e) => e["tenant_id"] === S.tenantA)).toBe(true);
    const n = await withTenant(app, ops(), (c) =>
      c.query("select id from audit_events where tenant_id = $1", [S.tenantB]).then((r) => r.rowCount),
    );
    expect(n).toBe(0); // 会社 b の grant は期限切れ
  });
  it("セキュリティの出来事は文脈が無くても書ける（ログイン失敗）", async () => {
    const id = await repo.securityEvent(S.tenantA, "login_failed", S.staffA, "JP", { attempts: 3 });
    const row = await repo.table("security_events").get(staff(), id);
    expect(row?.["kind_id"]).toBe("login_failed");
  });
  it("運営の証跡は運営テナントに書き、対象の会社の audit_events にも写る（会社が自分の証跡で見られる）", async () => {
    const id = await repo.opsAudit(ops(), S.tenantA, "support.view", "members", null, null, {
      reason: "問い合わせ対応",
    });
    const own = await withTenant(app, ops(), (c) =>
      c.query("select tenant_id from ops_audit_events where id = $1", [id]),
    );
    expect(own.rows[0]!["tenant_id"]).toBe("00000000-0000-4000-8000-000000000001");
    const mirrored = await repo.table("audit_events").list(boss(), { where: { action: "support.view" } });
    expect(mirrored).toHaveLength(1);
    expect(mirrored[0]!["actor_role"]).toBe("ops");
    expect((mirrored[0]!["payload"] as { ops_audit_id: string }).ops_audit_id).toBe(id);
    await expect(repo.opsAudit(boss(), S.tenantA, "x", "x", null, null)).rejects.toThrow(/運営の文脈/);
  });
  it("会社の人は運営テナントの行を読めない", async () => {
    const n = await withTenant(app, boss(), (c) => c.query("select id from ops_audit_events").then((r) => r.rowCount));
    expect(n).toBe(0);
  });
});
