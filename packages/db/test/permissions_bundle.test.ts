// KN-53 権限の確かめの穴と役割の束（0080・D-125.117・D-128.97）。
//   会社全体の確かめ（グループ＝なし）は、会社全体に付けた権限だけで通る（グループだけの権限では通らない）
//   役割を付けると束の権限の行ができ、外すと消える。個別に足した行は残る。マネージャーの束はそのグループの中だけ
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
let boss: TenantContext, staff: TenantContext;

const can = async (ctx: TenantContext, kind: string, scope: string | null, ability = "edit") =>
  withTenant(
    app,
    ctx,
    async (c) =>
      (
        await c.query<{ ok: boolean }>("select has_permission($1, $2, $3, $4) as ok", [
          ctx.userId,
          kind,
          scope,
          ability,
        ])
      ).rows[0]!.ok,
  );
const bundleRows = async (mid: string) =>
  (await admin.query("select 1 from permissions where grantee_member_id = $1 and bundle_role is not null", [mid]))
    .rowCount ?? 0;

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
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe("★会社全体の確かめは、会社全体の権限だけ（KN-38 の申し送り）", () => {
  it("グループだけに付けた権限では、会社全体の決まり（種別）を直せない", async () => {
    await admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id, scope_id) values ($1, $2, 'ticket_kinds', 'edit', $3)",
      [S.tenantA, S.staffA, S.scopeDeptA],
    );
    expect(await can(staff, "ticket_kinds", S.scopeDeptA)).toBe(true);
    expect(await can(staff, "ticket_kinds", null)).toBe(false);
    const fails = await withTenant(app, staff, (c) =>
      c.query("insert into ticket_kinds (tenant_id, name) values ($1, '勝手な種別')", [S.tenantA]),
    ).then(
      () => null,
      (e: Error) => e.message,
    );
    expect(fails).toMatch(/row-level security/);
  });
  it("会社全体に付けた権限なら、会社全体の確かめも、どのグループの確かめも通る", async () => {
    expect(await can(boss, "ticket_kinds", null)).toBe(true);
    expect(await can(boss, "ticket_kinds", S.scopeDeptA)).toBe(true);
  });
});

describe("役割の束（D-125.117・D-128.97）", () => {
  it("メンバーの役割を付けると、自分のグループでチケットを書ける。外すと書けない", async () => {
    expect(await can(staff, "tickets", S.scopeDeptA)).toBe(false);
    await admin.query(
      "insert into tenant_memberships (tenant_id, member_id, role) values ($1, $2, 'member') on conflict (tenant_id, member_id) do update set role = 'member', status = 'active', deleted_at = null",
      [S.tenantA, S.staffA],
    );
    expect(await can(staff, "tickets", S.scopeDeptA)).toBe(true);
    expect(await can(staff, "tickets", S.scopeRootA)).toBe(false); // 自分のグループの外は書けない
    await admin.query("update tenant_memberships set role = 'viewer' where tenant_id = $1 and member_id = $2", [
      S.tenantA,
      S.staffA,
    ]);
    expect(await can(staff, "tickets", S.scopeDeptA)).toBe(false);
    expect(await can(staff, "tickets", S.scopeDeptA, "view")).toBe(true);
  });
  it("マネージャーの束（配る・承認する・記憶を確かめる）は、そのグループの中だけ。招く・役割を変えるは入らない", async () => {
    await admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, role, is_primary) values ($1, $2, $3, 'manager', true) on conflict (member_id, scope_id) do update set role = 'manager'",
      [S.tenantA, S.staffA, S.scopeDeptA],
    );
    expect(await can(staff, "approvals", S.scopeDeptA)).toBe(true);
    expect(await can(staff, "approvals", S.scopeRootA)).toBe(false);
    expect(await can(staff, "approvals", null)).toBe(false);
    expect(await can(staff, "members", null, "invite")).toBe(false);
    expect(await can(staff, "members", S.scopeDeptA)).toBe(false);
  });
  it("管理者の束は会社全体。招く・書き出す・プランと支払い・ワークスペースを消す を持つ", async () => {
    const mid = (
      await admin.query<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '管理者 2') returning id",
        [S.tenantA, S.scopeRootA],
      )
    ).rows[0]!.id;
    await admin.query("insert into tenant_memberships (tenant_id, member_id, role) values ($1, $2, 'admin')", [
      S.tenantA,
      mid,
    ]);
    const ctx: TenantContext = { tenantId: S.tenantA, userId: mid, role: "member" };
    expect(await can(ctx, "ticket_kinds", null)).toBe(true);
    for (const [k, a] of [
      ["members", "invite"],
      ["tenants", "export"],
      ["tenants", "billing"],
      ["tenants", "delete_workspace"],
    ] as const)
      expect(await can(ctx, k, null, a), `${k}.${a}`).toBe(true);
    await admin.query("update tenant_memberships set status = 'left' where member_id = $1", [mid]);
    expect(await bundleRows(mid)).toBe(0);
  });
  it("個別に足した行は、役割を変えても残る。束の行は会社の人が手で直せない", async () => {
    await admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id, scope_id) values ($1, $2, 'clients', 'edit', null)",
      [S.tenantA, S.staffA],
    );
    await admin.query("update tenant_memberships set role = 'member' where tenant_id = $1 and member_id = $2", [
      S.tenantA,
      S.staffA,
    ]);
    expect(await can(staff, "clients", null)).toBe(true);
    const bid = (
      await admin.query<{ id: string }>(
        "select id from permissions where grantee_member_id = $1 and bundle_role is not null limit 1",
        [S.staffA],
      )
    ).rows[0]!.id;
    const msg = await withTenant(app, boss, (c) => c.query("delete from permissions where id = $1", [bid])).then(
      () => null,
      (e: Error) => e.message,
    );
    expect(msg).toMatch(/役割の束の権限は、役割を変えて変える/);
  });
});
