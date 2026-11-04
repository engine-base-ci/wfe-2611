// KN-44 前からある表に足す列：承認と分身（0077）。
//   承認する人はグループの外でも、承認するまでチケットと承認を読める・決めたら読めない
//   取り返しのつかない承認は直前の本人確認が要る・まとめて承認は人が見る項目なし／取り消せる操作だけ・差し戻しは理由が要る
//   上に回す決まりは「何のとき」と「誰へ」が要る・業務の型は全社向けをどの会社の人も読める
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { seedAccessMatrix } from "../src/seeds.js";
import { withTenant, type TenantContext } from "../src/context.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const here = dirname(fileURLToPath(import.meta.url));
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
let boss: TenantContext, staff: TenantContext, other: TenantContext;
let kindA: string, todoA: string;

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
const rows = async (ctx: TenantContext, t: string, id: string) =>
  (await q(ctx, `select id from "${t}" where id = $1`, [id])).length;

beforeAll(async () => {
  await migrate(DB_URL, join(here, ".."));
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
  app = new pg.Pool({ connectionString: APP_URL, max: 3 });
  boss = { tenantId: S.tenantA, userId: S.bossA, role: "member" };
  staff = { tenantId: S.tenantA, userId: S.staffA, role: "member" };
  const bossB = await one("select id from members where tenant_id = $1 and display_name = '別会社'", [S.tenantB]);
  other = { tenantId: S.tenantB, userId: bossB, role: "member" };
  kindA = await one("select id from ticket_kinds where tenant_id = $1 and name = 'タスク'", [S.tenantA]);
  todoA = await one("select id from ticket_stages where tenant_id = $1 and key = 'todo'", [S.tenantA]);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

const ticket = async () =>
  (
    await q<{ id: string }>(
      boss,
      "insert into tickets (tenant_id, scope_id, kind_id, stage_id, title, number) values ($1, $2, $3, $4, '請求書を送る', '') returning id",
      [S.tenantA, S.scopeRootA, kindA, todoA],
    )
  )[0]!.id;
const ask = async (t: string, extra = "", vals: unknown[] = []) =>
  (
    await q<{ id: string }>(
      boss,
      `insert into approvals (tenant_id, scope_id, requested_by, approver_member_id, ticket_id${extra ? ", " + extra : ""}) values ($1, $2, $3, $4, $5${vals.map((_, i) => `, $${i + 6}`).join("")}) returning id`,
      [S.tenantA, S.scopeRootA, S.bossA, S.staffA, t, ...vals],
    )
  )[0]!.id;

describe("承認（D-128.86・D-128.87・D-128.115）", () => {
  it("承認する人はグループの外でも、承認するまでチケットと承認を読める。決めたら読めない", async () => {
    const t = await ticket();
    expect(await rows(staff, "tickets", t)).toBe(0);
    const a = await ask(t);
    expect(await rows(staff, "tickets", t)).toBe(1);
    expect(await rows(staff, "approvals", a)).toBe(1);
    expect(await rows(other, "approvals", a)).toBe(0);
    await q(staff, "update approvals set decision = 'self_edit', decided_at = now() where id = $1", [a]);
    expect(await rows(staff, "tickets", t)).toBe(0);
  });
  it("取り返しのつかない承認は、直前の本人確認が要る", async () => {
    const a = await ask(await ticket(), "irreversible", [true]);
    expect(
      await fails(staff, "update approvals set decision = 'approve', decided_at = now() where id = $1", [a]),
    ).toMatch(/check/);
    expect(
      (
        await q(
          staff,
          "update approvals set decision = 'approve', decided_at = now(), step_up_at = now() where id = $1 returning id",
          [a],
        )
      ).length,
    ).toBe(1);
  });
  it("まとめて承認は、人が見る項目なし・取り消せる操作だけ", async () => {
    const t = await ticket();
    expect(
      await fails(
        boss,
        "insert into approvals (tenant_id, scope_id, requested_by, approver_member_id, ticket_id, irreversible, bulk_batch_id) values ($1, $2, $3, $4, $5, true, gen_random_uuid())",
        [S.tenantA, S.scopeRootA, S.bossA, S.staffA, t],
      ),
    ).toMatch(/check/);
    expect(
      await fails(
        boss,
        `insert into approvals (tenant_id, scope_id, requested_by, approver_member_id, ticket_id, human_checks, bulk_batch_id) values ($1, $2, $3, $4, $5, '["宛名"]'::jsonb, gen_random_uuid())`,
        [S.tenantA, S.scopeRootA, S.bossA, S.staffA, t],
      ),
    ).toMatch(/check/);
  });
  it("差し戻しは理由が要る。人の名前で頼めない・書けないチケットの承認は頼めない", async () => {
    const t = await ticket();
    const a = await ask(t);
    expect(
      await fails(staff, "update approvals set decision = 'return', decided_at = now() where id = $1", [a]),
    ).toMatch(/check/);
    expect(
      await fails(
        boss,
        "insert into approvals (tenant_id, scope_id, requested_by, approver_member_id, ticket_id) values ($1, $2, $3, $3, $4)",
        [S.tenantA, S.scopeRootA, S.staffA, t],
      ),
    ).toMatch(/row-level security/);
    expect(
      await fails(
        staff,
        "insert into approvals (tenant_id, scope_id, requested_by, approver_member_id, ticket_id) values ($1, $2, $3, $3, $4)",
        [S.tenantA, S.scopeRootA, S.staffA, t],
      ),
    ).toMatch(/row-level security/);
  });
});

describe("守ること・上に回す（D-128.87）と業務の型（D-126.2・D-126.13）", () => {
  it("上に回す決まりは「何のとき」と「誰へ」が要る。取引先に効かせるなら取引先が要る", async () => {
    await expect(
      admin.query(
        "insert into policies (tenant_id, scope_id, subject_kind_id, action_kind_id, mode_id, kind) select $1, $2, subject_kind_id, action_kind_id, mode_id, 'escalate' from policies where tenant_id = $1 limit 1",
        [S.tenantA, S.scopeRootA],
      ),
    ).rejects.toThrow(/check/);
    await expect(
      admin.query(
        "insert into policies (tenant_id, scope_id, subject_kind_id, action_kind_id, mode_id, applies_to) select $1, $2, subject_kind_id, action_kind_id, mode_id, 'client' from policies where tenant_id = $1 limit 1",
        [S.tenantA, S.scopeRootA],
      ),
    ).rejects.toThrow(/check/);
  });
  it("全社向けの業務の型はどの会社の人も読める。会社の人は作れない", async () => {
    const sk = (
      await admin.query<{ id: string }>("select id from skills where tenant_id = $1 and scope_id is null limit 1", [
        S.opsTenant,
      ])
    ).rows[0]!.id;
    expect(await rows(staff, "skills", sk)).toBe(1);
    expect(await rows(other, "skills", sk)).toBe(1);
    expect(
      await fails(
        staff,
        "insert into skills (tenant_id, kind_id, key, name) select tenant_id, kind_id, 'x', 'x' from skills where id = $1",
        [sk],
      ),
    ).toMatch(/row-level security/);
  });
  it("分身は自分だけのことを自動で覚えるのが既定（D-128.90）", async () => {
    const c = (await admin.query<{ auto_memory: boolean }>("select auto_memory from clones limit 1")).rows[0];
    if (c) expect(c.auto_memory).toBe(true);
  });
});
