// KN-39 チケットのまわりの表（0072）：元のチケットに従う・渡された相手は答えるまで読める・取り込みの下書きは取り込んだ人だけ・
//   保存した検索条件はグループの人は使うだけ・つながりは両方読める人だけ・追記だけの表・スレッドは本人として書く
//   場合表（access-matrix）は「層を持たない表は会社全体が見える」として扱うので、子の表が親のチケットに従うことはここで確かめる（D-128.115・D-128.119）
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
let kindA: string, todoA: string, bossB: string;

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
const newTicket = async (scope: string, extra: Record<string, unknown> = {}) => {
  const cols = {
    tenant_id: S.tenantA,
    scope_id: scope,
    kind_id: kindA,
    stage_id: todoA,
    title: "見積を出す",
    number: "",
    ...extra,
  };
  const keys = Object.keys(cols);
  return (
    await q<{ id: string }>(
      boss,
      `insert into tickets (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
      Object.values(cols),
    )
  )[0]!.id;
};

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
  bossB = await one("select id from members where tenant_id = $1 and display_name = '別会社'", [S.tenantB]);
  other = { tenantId: S.tenantB, userId: bossB, role: "member" };
  kindA = await one("select id from ticket_kinds where tenant_id = $1 and name = 'タスク'", [S.tenantA]);
  todoA = await one("select id from ticket_stages where tenant_id = $1 and key = 'todo'", [S.tenantA]);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe("子の表は元のチケットに従う（テスト仕様・検査・決定・スレッド・参照の記録）", () => {
  let t: string, spec: string, chk: string, dec: string, msg: string, ref: string;
  beforeAll(async () => {
    t = await newTicket(S.scopeRootA);
    spec = (
      await q<{ id: string }>(
        boss,
        "insert into test_specs (tenant_id, ticket_id, check_kind, title) values ($1, $2, 'machine', '金額が見積と同じ') returning id",
        [S.tenantA, t],
      )
    )[0]!.id;
    chk = (
      await q<{ id: string }>(
        boss,
        "insert into checks (tenant_id, ticket_id, test_spec_id, result, runner) values ($1, $2, $3, 'pass', 'server') returning id",
        [S.tenantA, t, spec],
      )
    )[0]!.id;
    dec = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_decisions (tenant_id, ticket_id, text) values ($1, $2, '月末締め') returning id",
        [S.tenantA, t],
      )
    )[0]!.id;
    msg = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_messages (tenant_id, ticket_id, author_member_id, body) values ($1, $2, $3, '確認お願いします') returning id",
        [S.tenantA, t, S.bossA],
      )
    )[0]!.id;
    ref = (
      await q<{ id: string }>(
        boss,
        "insert into reference_logs (tenant_id, ticket_id, ref_type, url, title) values ($1, $2, 'url', 'https://example.com', '見積') returning id",
        [S.tenantA, t],
      )
    )[0]!.id;
  });
  const all = () =>
    [
      ["tickets", t],
      ["test_specs", spec],
      ["checks", chk],
      ["ticket_decisions", dec],
      ["ticket_messages", msg],
      ["reference_logs", ref],
    ] as const;
  it("グループの人は読める", async () => {
    for (const [tb, id] of all()) expect(await rows(boss, tb, id), tb).toBe(1);
  });
  it("グループの外の人・別の会社の人は読めない", async () => {
    for (const [tb, id] of all()) {
      expect(await rows(staff, tb, id), tb).toBe(0);
      expect(await rows(other, tb, id), tb).toBe(0);
    }
  });
  it("検査の結果と参照の記録は直せない・消せない。決定は消せない", async () => {
    expect(await fails(boss, "update checks set result = 'fail' where id = $1", [chk])).toMatch(/permission denied/);
    expect(await fails(boss, "delete from checks where id = $1", [chk])).toMatch(/permission denied/);
    expect(await fails(boss, "update reference_logs set title = 'x' where id = $1", [ref])).toMatch(
      /permission denied/,
    );
    expect(await fails(boss, "delete from ticket_decisions where id = $1", [dec])).toMatch(/permission denied/);
  });
  it("決定は新しい行で改める（前の行に改めた行をつなぐ）", async () => {
    const d2 = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_decisions (tenant_id, ticket_id, text) values ($1, $2, '月末締め翌月末払い') returning id",
        [S.tenantA, t],
      )
    )[0]!.id;
    expect(
      (await q(boss, "update ticket_decisions set superseded_by_id = $2 where id = $1 returning id", [dec, d2])).length,
    ).toBe(1);
  });
  it("検査は元のチケットのテスト仕様の結果だけ（別のチケットの仕様を指せない）", async () => {
    const t2 = await newTicket(S.scopeRootA);
    expect(
      await fails(
        boss,
        "insert into checks (tenant_id, ticket_id, test_spec_id, result, runner) values ($1, $2, $3, 'pass', 'server')",
        [S.tenantA, t2, spec],
      ),
    ).toMatch(/テスト仕様の結果/);
  });
  it("人の確認は誰が見たかが要る", async () => {
    expect(
      await fails(
        boss,
        "insert into checks (tenant_id, ticket_id, test_spec_id, result, runner) values ($1, $2, $3, 'pass', 'human')",
        [S.tenantA, t, spec],
      ),
    ).toMatch(/check/);
  });
  it("スレッドは本人として書く。人の名前で書けない・人の書き込みは直せない", async () => {
    expect(
      await fails(
        boss,
        "insert into ticket_messages (tenant_id, ticket_id, author_member_id, body) values ($1, $2, $3, 'なりすまし')",
        [S.tenantA, t, S.staffA],
      ),
    ).toMatch(/row-level security/);
    await q(boss, "update tickets set assignee_member_id = $2 where id = $1", [t, S.staffA]);
    expect((await q(staff, "update ticket_messages set body = 'x' where id = $1 returning id", [msg])).length).toBe(0);
    await q(boss, "update tickets set assignee_member_id = null where id = $1", [t]);
  });
});

describe("渡された相手は、答えるまでグループの外でも読める（D-128.115）", () => {
  it("渡す → 読める・答える → 読めない", async () => {
    const t = await newTicket(S.scopeRootA);
    expect(await rows(staff, "tickets", t)).toBe(0);
    const h = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id) values ($1, $2, 'pass', $3, $4) returning id",
        [S.tenantA, t, S.bossA, S.staffA],
      )
    )[0]!.id;
    expect(await rows(staff, "tickets", t)).toBe(1);
    expect(await rows(staff, "ticket_handovers", h)).toBe(1);
    expect(
      await fails(staff, "update ticket_handovers set state = 'declined', decided_at = now() where id = $1", [h]),
    ).toMatch(/check/); // 断るには理由
    await q(
      staff,
      "update ticket_handovers set state = 'declined', decline_reason = '手が回らない', decided_at = now() where id = $1",
      [h],
    );
    expect(await rows(staff, "tickets", t)).toBe(0);
  });
  it("人の名前で渡せない・書けないチケットは渡せない", async () => {
    const t = await newTicket(S.scopeRootA);
    expect(
      await fails(
        boss,
        "insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id) values ($1, $2, 'pass', $3, $3)",
        [S.tenantA, t, S.staffA],
      ),
    ).toMatch(/row-level security/);
    expect(
      await fails(
        staff,
        "insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id) values ($1, $2, 'pass', $3, $3)",
        [S.tenantA, t, S.staffA],
      ),
    ).toMatch(/row-level security/);
  });
});

describe("CSV の取り込みの下書きは、確定するまで取り込んだ人だけ（D-128.119）", () => {
  it("下書きは取り込んだ人だけ読めて、確定したらグループの見え方になる", async () => {
    // 会社 a のグループの人を 2 人目として用意する：担当者として見える人（staff）にも、下書きのあいだは見えない
    const imp = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'backlog') returning id",
        [S.tenantA, S.bossA, S.scopeRootA],
      )
    )[0]!.id;
    const t = await newTicket(S.scopeRootA, { draft_import_id: imp, assignee_member_id: S.staffA });
    expect(await rows(boss, "tickets", t)).toBe(1);
    expect(await rows(staff, "tickets", t)).toBe(0);
    expect(await rows(staff, "ticket_imports", imp)).toBe(0);
    await q(boss, "update ticket_imports set state = 'committed', committed_at = now() where id = $1", [imp]);
    await q(boss, "update tickets set draft_import_id = null where id = $1", [t]);
    expect(await rows(staff, "tickets", t)).toBe(1);
  });
  it("人の取り込みに下書きを入れられない", async () => {
    const imp = (
      await admin.query<{ id: string }>(
        "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'generic') returning id",
        [S.tenantA, S.staffA, S.scopeRootA],
      )
    ).rows[0]!.id;
    expect(
      await fails(
        boss,
        "insert into tickets (tenant_id, scope_id, kind_id, stage_id, title, number, draft_import_id) values ($1, $2, $3, $4, 'x', '', $5)",
        [S.tenantA, S.scopeRootA, kindA, todoA, imp],
      ),
    ).toMatch(/row-level security/);
  });
});

describe("保存した検索条件：グループの人は使うだけ（D-128.119）", () => {
  it("自分だけのものは本人だけ・グループに見せたものはグループの人が読める", async () => {
    const mine = (
      await q<{ id: string }>(
        staff,
        "insert into saved_views (tenant_id, member_id, name) values ($1, $2, '自分の期限切れ') returning id",
        [S.tenantA, S.staffA],
      )
    )[0]!.id;
    expect(await rows(boss, "saved_views", mine)).toBe(0);
    const g = (
      await q<{ id: string }>(
        boss,
        "insert into saved_views (tenant_id, member_id, name, share, scope_id) values ($1, $2, '営業の今週', 'group', $3) returning id",
        [S.tenantA, S.bossA, S.scopeDeptA],
      )
    )[0]!.id;
    expect(await rows(staff, "saved_views", g)).toBe(1);
    expect((await q(staff, "update saved_views set name = 'x' where id = $1 returning id", [g])).length).toBe(0);
    expect((await q(staff, "delete from saved_views where id = $1 returning id", [g])).length).toBe(0);
  });
  it("見えないグループには見せられない・人の名前で作れない", async () => {
    expect(
      await fails(
        staff,
        "insert into saved_views (tenant_id, member_id, name, share, scope_id) values ($1, $2, 'x', 'group', $3)",
        [S.tenantA, S.staffA, S.scopeRootA],
      ),
    ).toMatch(/row-level security/);
    expect(
      await fails(staff, "insert into saved_views (tenant_id, member_id, name) values ($1, $2, 'x')", [
        S.tenantA,
        S.bossA,
      ]),
    ).toMatch(/row-level security/);
  });
});

describe("つながり：両方のチケットを読める人だけ（関連・派生元の 2 つだけ）", () => {
  it("片方が見えない人には、つながりも見えない", async () => {
    const a = await newTicket(S.scopeRootA, { assignee_member_id: S.staffA });
    const b = await newTicket(S.scopeRootA);
    const l = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_links (tenant_id, from_ticket_id, to_ticket_id, kind) values ($1, $2, $3, 'related') returning id",
        [S.tenantA, a, b],
      )
    )[0]!.id;
    expect(await rows(boss, "ticket_links", l)).toBe(1);
    expect(await rows(staff, "ticket_links", l)).toBe(0);
  });
  it("前後・重複のつながりは持たない・自分につなげない", async () => {
    const a = await newTicket(S.scopeRootA);
    expect(
      await fails(
        boss,
        "insert into ticket_links (tenant_id, from_ticket_id, to_ticket_id, kind) values ($1, $2, $2, 'related')",
        [S.tenantA, a],
      ),
    ).toMatch(/check|同じ会社/);
    const b = await newTicket(S.scopeRootA);
    expect(
      await fails(
        boss,
        "insert into ticket_links (tenant_id, from_ticket_id, to_ticket_id, kind) values ($1, $2, $3, 'blocks')",
        [S.tenantA, a, b],
      ),
    ).toMatch(/check/);
  });
});
