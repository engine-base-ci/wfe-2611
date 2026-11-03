// KN-42 ワークスペースと人（0075）と KN-43 分身と運営（0076）の行の守り。
//   兼務は見える範囲に入る・所属は本人と管理者だけ・規約の同意は本人の追記だけ・接続コードは本人だけで平文を入れない
//   覚えたいことは本人だけ（会社の OK 待ちは管理者にも）・値段の案は自分で決められない（決められる人が 1 人のときだけ例外）
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

describe("ワークスペースと人（D-125.115・D-125.150・D-125.162・D-128.92・D-128.93・D-128.97）", () => {
  it("兼務すると、兼ねたグループのチケットが見える。外すと見えない", async () => {
    // 根のグループの下に、staff の主の所属とは別のグループを作る
    const g = await one(
      "insert into scopes (tenant_id, parent_id, layer_id, name, ticket_prefix) select $1, $2, layer_id, '経理', 'KE' from scopes where id = $2 returning id",
      [S.tenantA, S.scopeRootA],
    );
    const t = (
      await q<{ id: string }>(
        boss,
        "insert into tickets (tenant_id, scope_id, kind_id, stage_id, title, number) values ($1, $2, $3, $4, '経費の締め', '') returning id",
        [S.tenantA, g, kindA, todoA],
      )
    )[0]!.id;
    expect(await rows(staff, "tickets", t)).toBe(0);
    const sm = (
      await q<{ id: string }>(
        boss,
        "insert into scope_memberships (tenant_id, member_id, scope_id, role) values ($1, $2, $3, 'member') returning id",
        [S.tenantA, S.staffA, g],
      )
    )[0]!.id;
    expect(await rows(staff, "tickets", t)).toBe(1);
    await q(boss, "delete from scope_memberships where id = $1", [sm]);
    expect(await rows(staff, "tickets", t)).toBe(0);
  });
  it("所属を変えられるのは管理者（メンバーを直せる人）だけ", async () => {
    expect(
      await fails(staff, "insert into scope_memberships (tenant_id, member_id, scope_id) values ($1, $2, $3)", [
        S.tenantA,
        S.staffA,
        S.scopeRootA,
      ]),
    ).toMatch(/row-level security/);
  });
  it("ワークスペースへの所属は本人と管理者だけが読める", async () => {
    await admin.query("delete from tenant_memberships where tenant_id = $1", [S.tenantA]); // 種の行を外して、この試験の行だけにする
    const mine = (
      await q<{ id: string }>(
        boss,
        "insert into tenant_memberships (tenant_id, member_id, role) values ($1, $2, 'member') returning id",
        [S.tenantA, S.staffA],
      )
    )[0]!.id;
    const bosses = (
      await q<{ id: string }>(
        boss,
        "insert into tenant_memberships (tenant_id, member_id, role) values ($1, $2, 'admin') returning id",
        [S.tenantA, S.bossA],
      )
    )[0]!.id;
    expect(await rows(staff, "tenant_memberships", mine)).toBe(1);
    expect(await rows(staff, "tenant_memberships", bosses)).toBe(0);
    expect(await rows(other, "tenant_memberships", mine)).toBe(0);
    expect(await fails(staff, "update tenant_memberships set role = 'admin' where id = $1", [mine])).toBeNull();
    expect((await admin.query("select role from tenant_memberships where id = $1", [mine])).rows[0]!.role).toBe(
      "member",
    ); // 自分を管理者にできない
  });
  it("規約の同意は本人が追記するだけ（直せない・消せない・人の名前でできない）。規約の版はログイン済みなら読める", async () => {
    const tv = await one(
      "insert into terms_versions (tenant_id, kind, version, url) values ($1, 'terms', '2026-11', 'https://kaname.example/terms') returning id",
      [S.opsTenant],
    );
    expect(await rows(staff, "terms_versions", tv)).toBe(1);
    const c = (
      await q<{ id: string }>(
        staff,
        "insert into terms_consents (tenant_id, member_id, terms_version_id) values ($1, $2, $3) returning id",
        [S.tenantA, S.staffA, tv],
      )
    )[0]!.id;
    expect(await rows(boss, "terms_consents", c)).toBe(0);
    expect(await fails(staff, "update terms_consents set agreed_at = now() where id = $1", [c])).toMatch(
      /permission denied/,
    );
    expect(
      await fails(staff, "insert into terms_consents (tenant_id, member_id, terms_version_id) values ($1, $2, $3)", [
        S.tenantA,
        S.bossA,
        tv,
      ]),
    ).toMatch(/row-level security/);
    expect(
      await fails(staff, "insert into terms_versions (tenant_id, kind, version, url) values ($1, 'terms', 'x', 'x')", [
        S.opsTenant,
      ]),
    ).toMatch(/row-level security/);
  });
  it("知らせの設定は本人だけ", async () => {
    const n = (
      await q<{ id: string }>(
        staff,
        "insert into notification_settings (tenant_id, member_id) values ($1, $2) returning id",
        [S.tenantA, S.staffA],
      )
    )[0]!.id;
    expect(await rows(boss, "notification_settings", n)).toBe(0);
    expect(
      (await q(boss, "update notification_settings set email_digest = false where id = $1 returning id", [n])).length,
    ).toBe(0);
  });
  it("PC の接続コードは本人だけ。平文のコードは入らず、使った印は関門の関数だけが付ける", async () => {
    const h = "a".repeat(64);
    const pc = (
      await q<{ id: string }>(
        staff,
        "insert into bridge_pairing_codes (tenant_id, member_id, code_hash) values ($1, $2, $3) returning id",
        [S.tenantA, S.staffA, h],
      )
    )[0]!.id;
    expect(await rows(boss, "bridge_pairing_codes", pc)).toBe(0);
    expect(
      await fails(
        staff,
        "insert into bridge_pairing_codes (tenant_id, member_id, code_hash) values ($1, $2, '123456')",
        [S.tenantA, S.staffA],
      ),
    ).toMatch(/check/);
    expect(await fails(staff, "update bridge_pairing_codes set used_at = now() where id = $1", [pc])).toMatch(
      /permission denied/,
    );
    expect(
      await fails(
        staff,
        "insert into bridge_pairing_codes (tenant_id, member_id, code_hash, expires_at) values ($1, $2, $3, now() + interval '1 day')",
        [S.tenantA, S.staffA, h],
      ),
    ).toMatch(/check/);
  });
});

describe("分身の覚えたいこと（D-128.41・D-128.43）", () => {
  it("本人だけ。会社のルールとぶつかって OK を待つものは管理者にも見え、管理者が決める", async () => {
    const lc = (
      await q<{ id: string }>(
        staff,
        "insert into learning_candidates (tenant_id, owner_member_id, trigger, proposed_as, text) values ($1, $2, 'remember', 'memory', '請求書は PDF で送る') returning id",
        [S.tenantA, S.staffA],
      )
    )[0]!.id;
    expect(await rows(boss, "learning_candidates", lc)).toBe(0);
    await q(staff, "update learning_candidates set state = 'needs_ok' where id = $1", [lc]);
    expect(await rows(boss, "learning_candidates", lc)).toBe(1);
    expect(
      (
        await q(
          boss,
          "update learning_candidates set state = 'learned', decided_at = now(), decided_by = $2 where id = $1 returning id",
          [lc, S.bossA],
        )
      ).length,
    ).toBe(1);
  });
  it("人の分身の候補は作れない", async () => {
    expect(
      await fails(
        staff,
        "insert into learning_candidates (tenant_id, owner_member_id, trigger, proposed_as, text) values ($1, $2, 'remember', 'memory', 'x')",
        [S.tenantA, S.bossA],
      ),
    ).toMatch(/row-level security/);
  });
});

describe("値段の案（D-128.72）", () => {
  it("自分の案は自分で決められない。決められる人が 1 人のときだけ例外。理由と差し戻しの理由は必須。消せない", async () => {
    const plan = await one("select id from plans limit 1").catch(async () =>
      one("insert into plans (tenant_id, key, name) values ($1, 'seed-plan', 'お試し') returning id", [S.opsTenant]),
    );
    const m1 = await one("insert into ops_members (tenant_id) values ($1) returning id", [S.opsTenant]).catch(
      () => S.opsId,
    );
    const p1 = await one(
      "insert into ops_plan_proposals (tenant_id, plan_id, reason, proposed_by) values ($1, $2, '原価が上がった', $3) returning id",
      [S.opsTenant, plan, m1],
    );
    // 決められる人の数で変わる：caps の列（KN-45）が無い間は 0 人 → 例外にならない
    await expect(
      admin.query(
        "update ops_plan_proposals set state = 'decided', decided_at = now(), decided_by = proposed_by where id = $1",
        [p1],
      ),
    ).rejects.toThrow(/自分の案は自分で決められない/);
    await expect(
      admin.query(
        "insert into ops_plan_proposals (tenant_id, plan_id, reason, proposed_by) values ($1, $2, '  ', $3)",
        [S.opsTenant, plan, m1],
      ),
    ).rejects.toThrow(/check/);
    await expect(
      admin.query(
        "update ops_plan_proposals set state = 'returned', decided_at = now(), decided_by = $2 where id = $1",
        [p1, S.opsId],
      ),
    ).rejects.toThrow(/check|自分の案/);
    const ops: TenantContext = { tenantId: S.opsTenant, userId: S.opsId, role: "ops" };
    expect(await fails(ops, "delete from ops_plan_proposals where id = $1", [p1])).toMatch(/permission denied/);
  });
});
