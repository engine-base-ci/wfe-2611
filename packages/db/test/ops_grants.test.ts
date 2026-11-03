// KN-45 中を見るの許可（0078・D-125.128・D-128.68・D-128.70・D-128.108）と、人・会社・運営に足した列の決まり。
//   許可は開いた運営の人だけに効く（別の運営の人は読めない）・閉じた／取り消した／期限切れは効かない・理由が要る・1 時間まで
//   会社は誰が中を見たかを見られる・「中を見る」ができない運営の人は許可を開けない
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { seedAccessMatrix } from "../src/seeds.js";
import { withTenant, type TenantContext } from "../src/context.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const here = dirname(fileURLToPath(import.meta.url));
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
let ops: TenantContext, ops2: TenantContext, boss: TenantContext, staff: TenantContext;
let opener: string, other2: string;

const q = async <T = Record<string, unknown>>(ctx: TenantContext, sql: string, p: unknown[] = []) =>
  withTenant(app, ctx, async (c) => (await c.query(sql, p)).rows as T[]);
const fails = async (ctx: TenantContext, sql: string, p: unknown[] = []) => {
  try {
    await q(ctx, sql, p);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
};
const one = async (sql: string, p: unknown[] = []) => (await admin.query<{ id: string }>(sql, p)).rows[0]!.id;

beforeAll(async () => {
  await migrate(DB_URL, join(here, ".."));
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
  app = new pg.Pool({ connectionString: APP_URL, max: 3 });
  ops = { tenantId: S.tenantA, userId: S.opsId, role: "ops" };
  boss = { tenantId: S.tenantA, userId: S.bossA, role: "member" };
  staff = { tenantId: S.tenantA, userId: S.staffA, role: "member" };
  opener = await one("select id from ops_members where member_id = $1", [S.opsId]);
  // 2 人目の運営の人（「中を見る」ができない）
  const scope = await one("select scope_id as id from members where id = $1", [S.opsId]);
  const m2 = await one(
    "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '運営 2') returning id",
    [S.opsTenant, scope],
  );
  other2 = await one("insert into ops_members (tenant_id, member_id, caps) values ($1, $2, '{inquiry}') returning id", [
    S.opsTenant,
    m2,
  ]);
  ops2 = { tenantId: S.tenantA, userId: m2, role: "ops" };
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe("中を見るの許可は開いた運営の人だけ（D-128.68）", () => {
  it("開いた人は会社 a の中を見られる。別の運営の人は同じ許可では見られない", async () => {
    expect((await q(ops, "select id from tickets")).length).toBeGreaterThanOrEqual(0);
    expect((await q(ops, "select id from members where tenant_id = $1", [S.tenantA])).length).toBeGreaterThan(0);
    expect((await q(ops2, "select id from members where tenant_id = $1", [S.tenantA])).length).toBe(0);
  });
  it("閉じたら効かない", async () => {
    const g = await one(
      "insert into support_access_grants (tenant_id, scope, expires_at, reason, ops_member_id) values ($1, 'all', now() + interval '30 minutes', '障害の調べ', $2) returning id",
      [S.tenantB, opener],
    );
    const opsB: TenantContext = { tenantId: S.tenantB, userId: S.opsId, role: "ops" };
    expect((await q(opsB, "select id from members where tenant_id = $1", [S.tenantB])).length).toBeGreaterThan(0);
    await admin.query("update support_access_grants set closed_at = now() where id = $1", [g]);
    expect((await q(opsB, "select id from members where tenant_id = $1", [S.tenantB])).length).toBe(0);
  });
  it("理由が要る・1 時間まで・開いた人が要る", async () => {
    await expect(
      admin.query(
        "insert into support_access_grants (tenant_id, scope, expires_at, ops_member_id) values ($1, 'all', now() + interval '30 minutes', $2)",
        [S.tenantA, opener],
      ),
    ).rejects.toThrow(/check/);
    await expect(
      admin.query(
        "insert into support_access_grants (tenant_id, scope, expires_at, reason, ops_member_id) values ($1, 'all', now() + interval '2 hours', 'x', $2)",
        [S.tenantA, opener],
      ),
    ).rejects.toThrow(/check/);
    await expect(
      admin.query(
        "insert into support_access_grants (tenant_id, scope, expires_at, reason) values ($1, 'all', now() + interval '30 minutes', 'x')",
        [S.tenantA],
      ),
    ).rejects.toThrow(/check/);
  });
  it("「中を見る」ができない運営の人は許可を開けない。人の名前でも開けない", async () => {
    expect(
      await fails(
        ops2,
        "insert into support_access_grants (tenant_id, scope, expires_at, reason, ops_member_id) values ($1, 'all', now() + interval '30 minutes', 'x', $2)",
        [S.tenantA, other2],
      ),
    ).toMatch(/row-level security/);
    expect(
      await fails(
        ops2,
        "insert into support_access_grants (tenant_id, scope, expires_at, reason, ops_member_id) values ($1, 'all', now() + interval '30 minutes', 'x', $2)",
        [S.tenantA, opener],
      ),
    ).toMatch(/row-level security/);
  });
  it("会社は誰が中を見たかを見られる（見る権限のある人）。会社の人は許可を作れない", async () => {
    expect((await q(boss, "select id from support_access_grants")).length).toBeGreaterThan(0);
    expect(
      await fails(
        boss,
        "insert into support_access_grants (tenant_id, scope, expires_at, reason, ops_member_id) values ($1, 'all', now() + interval '30 minutes', 'x', $2)",
        [S.tenantA, opener],
      ),
    ).toMatch(/row-level security/);
    expect((await q(staff, "select id from support_access_grants")).length).toBe(0);
  });
});

describe("人・会社・運営に足した列の決まり（KN-45）", () => {
  it("呼ばれ方は 20 文字まで・運営の人ができることは決まった言葉だけ・取引先の見え方の既定は 全員／担当グループだけ", async () => {
    await expect(
      admin.query("update members set call_name = $2 where id = $1", [S.staffA, "あ".repeat(21)]),
    ).rejects.toThrow(/check/);
    await expect(admin.query("update ops_members set caps = '{everything}' where id = $1", [opener])).rejects.toThrow(
      /check/,
    );
    await expect(
      admin.query("update tenants set client_visibility_default = 'nobody' where id = $1", [S.tenantA]),
    ).rejects.toThrow(/check/);
  });
  it("「誰ができるか」にプランと支払い・書き出す・ワークスペースを消す がある", async () => {
    const r = await admin.query<{ key: string }>(
      "select key from abilities where key in ('billing', 'export', 'delete_workspace') order by key",
    );
    expect(r.rows.map((x) => x.key)).toEqual(["billing", "delete_workspace", "export"]);
  });
});
