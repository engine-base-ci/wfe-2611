// KN-38 チケットの本体の表（0071）：番号・読める範囲（他の会社／グループの外／関わる人）・版は追記だけ・親子 3 段・上限・仕組みの段・決まりを直せる人・優先度の理由・運営
//   場合表（access-matrix）は「層を持たない表は会社全体が見える」として扱うので、子の表が親のチケットに従うことはここで確かめる（D-128.115）
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
let boss: TenantContext, staff: TenantContext, other: TenantContext, ops: TenantContext, opsB: TenantContext;
let kindA: string, todoA: string, kindB: string, todoB: string, bossB: string, scopeB: string;

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
/** 会社 b のチケット（種の別会社の代表には作る権限が無いので、管理者の接続で置く） */
const ticketB = async () =>
  (
    await admin.query<{ id: string }>(
      "insert into tickets (tenant_id, scope_id, kind_id, stage_id, title, number) values ($1, $2, $3, $4, '別会社の見積', '') returning id",
      [S.tenantB, scopeB, kindB, todoB],
    )
  ).rows[0]!;
const newTicket = async (ctx: TenantContext, scope: string, extra: Record<string, unknown> = {}) => {
  const tenant = ctx.tenantId!;
  const kind = tenant === S.tenantA ? kindA : kindB;
  const stage = tenant === S.tenantA ? todoA : todoB;
  const cols = {
    tenant_id: tenant,
    scope_id: scope,
    kind_id: kind,
    stage_id: stage,
    title: "見積を出す",
    number: "",
    ...extra,
  };
  const keys = Object.keys(cols);
  const rows = await q<{ id: string; number: string }>(
    ctx,
    `insert into tickets (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id, number`,
    Object.values(cols),
  );
  return rows[0]!;
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
  scopeB = await one("select scope_id as id from members where id = $1", [bossB]);
  other = { tenantId: S.tenantB, userId: bossB, role: "member" };
  ops = { tenantId: S.tenantA, userId: S.opsId, role: "ops" };
  opsB = { tenantId: S.tenantB, userId: S.opsId, role: "ops" };
  await admin.query("update scopes set ticket_prefix = 'EG', next_ticket_no = 1 where id = $1", [S.scopeRootA]);
  kindA = await one("select id from ticket_kinds where tenant_id = $1 and name = 'タスク'", [S.tenantA]);
  todoA = await one("select id from ticket_stages where tenant_id = $1 and key = 'todo'", [S.tenantA]);
  kindB = await one("select id from ticket_kinds where tenant_id = $1 and name = 'タスク'", [S.tenantB]);
  todoB = await one("select id from ticket_stages where tenant_id = $1 and key = 'todo'", [S.tenantB]);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

describe("ワークスペースの初めの行", () => {
  it("会社を作ると、仕組みの段 3・初めの作業の段 4・優先度の軸・渡すときの決まり 3・種別 4 つ（タスク・課題・QA・会議）と区画が入る", async () => {
    // 場合表の種が足す行と混ざらないように、新しい会社を作って見る（会社を作ると初めの行が入る）
    const t = await one(
      "insert into tenants (id, tenant_id, name) select u, u, '会社 c' from gen_random_uuid() u returning id",
    );
    const read = async <T>(sql: string, p: unknown[] = []) => (await admin.query(sql, [t, ...p])).rows as T[];
    const st = await read<{ key: string; is_fixed: boolean }>(
      "select key, is_fixed from ticket_stages where tenant_id = $1 order by position",
    );
    expect(st.map((x) => x.key)).toEqual(["todo", "doing", "hold", "checking", "awaiting_approval", "running", "done"]);
    expect(st.filter((x) => x.is_fixed).map((x) => x.key)).toEqual(["checking", "awaiting_approval", "running"]);
    expect(
      (await read("select 1 from class_axes where tenant_id = $1 and key = 'priority' and is_builtin")).length,
    ).toBe(1);
    expect(
      (
        await read<{ target: string; mode: string }>(
          "select target, mode from handover_rules where tenant_id = $1 order by target",
        )
      ).map((x) => `${x.target}:${x.mode}`),
    ).toEqual(["children:ask", "group:ask", "links:ask"]);
    const kind = (
      await read<{ id: string }>("select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and is_builtin")
    )[0]!.id;
    const secs = await read<{ section_key: string; mode: string }>(
      "select section_key, mode from kind_sections where tenant_id = $1 and kind_id = $2 order by position",
      [kind],
    );
    expect(secs.length).toBe(10);
    expect(secs.filter((x) => x.mode === "required").map((x) => x.section_key)).toEqual(["purpose", "done", "todo"]);
    // 初めの種別は 4 つ（D-128.117）。区画の数・必須の数はキャンバス（ワークスペースの管理 › チケットの形）と同じ
    const kinds = await read<{ name: string; n: string; req: string; acc: string }>(
      "select k.name, count(s.id) n, count(s.id) filter (where s.mode = 'required') req, count(s.id) filter (where s.used_for_acceptance) acc from ticket_kinds k join kind_sections s on s.kind_id = k.id where k.tenant_id = $1 and k.is_builtin group by k.name, k.position order by k.position",
    );
    expect(kinds.map((x) => `${x.name}:${x.n}/${x.req}/${x.acc}`)).toEqual([
      "タスク:10/3/1",
      "課題:9/3/1",
      "QA:8/4/1",
      "会議:6/2/0",
    ]);
  });
});

describe("番号（グループの頭＋連番・横渡しで変えない・D-128.115）", () => {
  it("作るたびにサーバーが付ける。入れた値は使わない", async () => {
    const a = await newTicket(boss, S.scopeRootA);
    const b = await newTicket(boss, S.scopeRootA, { number: "XX-999" });
    expect(a.number).toMatch(/^EG-\d+$/);
    expect(Number(b.number.split("-")[1])).toBe(Number(a.number.split("-")[1]) + 1);
  });
  it("番号は直せない。別のグループへ移しても番号は変わらない", async () => {
    const t = await newTicket(boss, S.scopeRootA);
    expect(await fails(boss, "update tickets set number = 'EG-1' where id = $1", [t.id])).toMatch(/番号は変えない/);
    await q(boss, "update tickets set scope_id = $2 where id = $1", [t.id, S.scopeDeptA]);
    expect((await q<{ number: string }>(boss, "select number from tickets where id = $1", [t.id]))[0]!.number).toBe(
      t.number,
    );
  });
  it("頭を変えても、作ったチケットの番号は変わらない", async () => {
    const t = await newTicket(boss, S.scopeRootA);
    await admin.query("update scopes set ticket_prefix = 'SA' where id = $1", [S.scopeRootA]);
    try {
      expect((await q<{ number: string }>(boss, "select number from tickets where id = $1", [t.id]))[0]!.number).toBe(
        t.number,
      );
      expect((await newTicket(boss, S.scopeRootA)).number).toMatch(/^SA-/);
    } finally {
      await admin.query("update scopes set ticket_prefix = 'EG' where id = $1", [S.scopeRootA]);
    }
  });
});

describe("読める範囲（他の会社・グループの外・関わる人・D-128.115）", () => {
  let t: { id: string }, sec: string, ver: string, cv: string;
  beforeAll(async () => {
    t = await newTicket(boss, S.scopeRootA);
    sec = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_sections (tenant_id, ticket_id, section_key, body) values ($1, $2, 'purpose', '{\"t\":\"見積\"}') returning id",
        [S.tenantA, t.id],
      )
    )[0]!.id;
    ver = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body) values ($1, $2, $3, 1, '{}') returning id",
        [S.tenantA, t.id, sec],
      )
    )[0]!.id;
    const axis = await one("select id from class_axes where tenant_id = $1 and key = 'priority'", [S.tenantA]);
    const val = (
      await q<{ id: string }>(
        boss,
        "insert into class_values (tenant_id, axis_id, label) values ($1, $2, '高') returning id",
        [S.tenantA, axis],
      )
    )[0]!.id;
    cv = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_class_values (tenant_id, ticket_id, value_id) values ($1, $2, $3) returning id",
        [S.tenantA, t.id, val],
      )
    )[0]!.id;
  });
  const rows = async (ctx: TenantContext, table: string, id: string) =>
    (await q(ctx, `select id from ${table} where id = $1`, [id])).length;

  it("同じグループを見られる人は、チケット・本文・版・分類を全部読める", async () => {
    for (const [tb, id] of [
      ["tickets", t.id],
      ["ticket_sections", sec],
      ["ticket_section_versions", ver],
      ["ticket_class_values", cv],
    ] as const)
      expect(await rows(boss, tb, id), tb).toBe(1);
  });
  it("別の会社の人は、どれも読めない（版・分類も）", async () => {
    for (const [tb, id] of [
      ["tickets", t.id],
      ["ticket_sections", sec],
      ["ticket_section_versions", ver],
      ["ticket_class_values", cv],
    ] as const)
      expect(await rows(other, tb, id), tb).toBe(0);
  });
  it("グループの外の人は、本文・版・分類も読めない（同じ会社でも）", async () => {
    for (const [tb, id] of [
      ["tickets", t.id],
      ["ticket_sections", sec],
      ["ticket_section_versions", ver],
      ["ticket_class_values", cv],
    ] as const)
      expect(await rows(staff, tb, id), tb).toBe(0);
  });
  it("グループの外でも担当者になれば読めて書ける。担当でなくなれば読めない", async () => {
    await q(boss, "update tickets set assignee_member_id = $2 where id = $1", [t.id, S.staffA]);
    expect(await rows(staff, "tickets", t.id)).toBe(1);
    expect(await rows(staff, "ticket_sections", sec)).toBe(1);
    expect((await q(staff, "update tickets set title = '見積を直す' where id = $1 returning id", [t.id])).length).toBe(
      1,
    );
    await q(boss, "update tickets set assignee_member_id = null where id = $1", [t.id]);
    expect(await rows(staff, "tickets", t.id)).toBe(0);
  });
  it("書けないグループには、自分を担当者にしても作れない", async () => {
    expect(
      await fails(
        staff,
        "insert into tickets (tenant_id, scope_id, kind_id, stage_id, title, number, assignee_member_id) values ($1, $2, $3, $4, 'x', '', $5)",
        [S.tenantA, S.scopeRootA, kindA, todoA, S.staffA],
      ),
    ).toMatch(/row-level security/);
  });
  it("運営は許可がある会社だけ読める（許可が切れた会社は読めない）", async () => {
    expect(await rows(ops, "tickets", t.id)).toBe(1);
    const tb = await ticketB();
    expect(await rows(opsB, "tickets", tb.id)).toBe(0);
  });
  it("チケットの行は消せない（論理削除だけ）", async () => {
    expect((await q(boss, "delete from tickets where id = $1 returning id", [t.id])).length).toBe(0);
    expect(await rows(boss, "tickets", t.id)).toBe(1);
  });
});

describe("版は追記だけ・子の行は元のチケットと同じ会社", () => {
  it("版は直せない・消せない", async () => {
    const t = await newTicket(boss, S.scopeRootA);
    const sec = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_sections (tenant_id, ticket_id, section_key) values ($1, $2, 'done') returning id",
        [S.tenantA, t.id],
      )
    )[0]!.id;
    const v = (
      await q<{ id: string }>(
        boss,
        "insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body) values ($1, $2, $3, 1, '{}') returning id",
        [S.tenantA, t.id, sec],
      )
    )[0]!.id;
    expect(await fails(boss, "update ticket_section_versions set body = '{\"x\":1}' where id = $1", [v])).toMatch(
      /permission denied/,
    );
    expect(await fails(boss, "delete from ticket_section_versions where id = $1", [v])).toMatch(/permission denied/);
  });
  it("別の会社のチケットに本文をつなげない", async () => {
    const tb = await ticketB();
    expect(
      await fails(boss, "insert into ticket_sections (tenant_id, ticket_id, section_key) values ($1, $2, 'x')", [
        S.tenantA,
        tb.id,
      ]),
    ).toBeTruthy();
  });
});

describe("親子は 3 段まで・輪にしない（D-125.51）", () => {
  it("3 段までは作れ、4 段目は作れない。子を持つチケットを深い所へ移せない。輪にできない", async () => {
    const a = await newTicket(boss, S.scopeRootA);
    const b = await newTicket(boss, S.scopeRootA, { parent_ticket_id: a.id });
    const c = await newTicket(boss, S.scopeRootA, { parent_ticket_id: b.id });
    expect(
      await fails(
        boss,
        "insert into tickets (tenant_id, scope_id, kind_id, stage_id, title, number, parent_ticket_id) values ($1, $2, $3, $4, 'x', '', $5)",
        [S.tenantA, S.scopeRootA, kindA, todoA, c.id],
      ),
    ).toMatch(/3 段まで/);
    const x = await newTicket(boss, S.scopeRootA);
    await newTicket(boss, S.scopeRootA, { parent_ticket_id: x.id });
    expect(await fails(boss, "update tickets set parent_ticket_id = $2 where id = $1", [x.id, b.id])).toMatch(
      /3 段まで/,
    );
    expect(await fails(boss, "update tickets set parent_ticket_id = $2 where id = $1", [a.id, c.id])).toMatch(
      /輪|3 段/,
    );
  });
});

describe("上限（種別 10・作業の段 8・足す軸 5・区画 20）", () => {
  it("種別は 10 まで", async () => {
    const have = (await q(boss, "select 1 from ticket_kinds where deleted_at is null")).length;
    for (let i = have; i < 10; i++)
      await q(boss, "insert into ticket_kinds (tenant_id, name) values ($1, $2)", [S.tenantA, `種別${i}`]);
    expect(await fails(boss, "insert into ticket_kinds (tenant_id, name) values ($1, '11 個目')", [S.tenantA])).toMatch(
      /10 まで/,
    );
  });
  it("会社が直せる作業の段は 8 まで（仕組みの段は数えない）", async () => {
    const have = (await q(boss, "select 1 from ticket_stages where deleted_at is null and not is_fixed")).length;
    for (let i = have; i < 8; i++)
      await q(boss, "insert into ticket_stages (tenant_id, name, position) values ($1, $2, 100)", [
        S.tenantA,
        `段${i}`,
      ]);
    expect(await fails(boss, "insert into ticket_stages (tenant_id, name) values ($1, '9 個目')", [S.tenantA])).toMatch(
      /8 まで/,
    );
  });
  it("会社が足す軸は 5 まで（優先度は数えない）", async () => {
    const have = (await q(boss, "select 1 from class_axes where deleted_at is null and not is_builtin")).length;
    for (let i = have; i < 5; i++)
      await q(boss, "insert into class_axes (tenant_id, key, name) values ($1, $2, $3)", [
        S.tenantA,
        `ax${i}`,
        `軸${i}`,
      ]);
    expect(
      await fails(boss, "insert into class_axes (tenant_id, key, name) values ($1, 'ax9', '6 個目')", [S.tenantA]),
    ).toMatch(/5 まで/);
  });
  it("区画は種別ごとに 20 まで", async () => {
    const have = (await q(boss, "select 1 from kind_sections where kind_id = $1 and deleted_at is null", [kindA]))
      .length;
    for (let i = have; i < 20; i++)
      await q(boss, "insert into kind_sections (tenant_id, kind_id, section_key, label) values ($1, $2, $3, $4)", [
        S.tenantA,
        kindA,
        `s${i}`,
        `区画${i}`,
      ]);
    expect(
      await fails(
        boss,
        "insert into kind_sections (tenant_id, kind_id, section_key, label) values ($1, $2, 's99', '21 個目')",
        [S.tenantA, kindA],
      ),
    ).toMatch(/20 まで/);
  });
});

describe("仕組みの段・決まりを直せる人・優先度", () => {
  it("仕組みの段は名前を変えられず、消せず、増やせない", async () => {
    const fixed = await one("select id from ticket_stages where tenant_id = $1 and key = 'checking'", [S.tenantA]);
    expect(await fails(boss, "update ticket_stages set name = 'レビュー' where id = $1", [fixed])).toMatch(
      /変えられない/,
    );
    expect(await fails(boss, "delete from ticket_stages where id = $1", [fixed])).toMatch(/消せない/);
    expect(
      await fails(boss, "insert into ticket_stages (tenant_id, name, is_fixed) values ($1, '確認2', true)", [
        S.tenantA,
      ]),
    ).toMatch(/増やせない/);
  });
  it("決まり（種別・段・軸・渡すとき）を直すのはワークスペース全体の edit を持つ人だけ", async () => {
    const axis = await one("select id from class_axes where tenant_id = $1 and key = 'priority'", [S.tenantA]);
    expect(
      await fails(staff, "insert into class_values (tenant_id, axis_id, label) values ($1, $2, '低')", [
        S.tenantA,
        axis,
      ]),
    ).toMatch(/row-level security/);
    expect(
      (await q(staff, "update handover_rules set mode = 'always' where tenant_id = $1 returning id", [S.tenantA]))
        .length,
    ).toBe(0);
    expect((await q(staff, "select id from ticket_kinds")).length).toBeGreaterThan(0); // 読むのは誰でも（チケットを作るときに使う）
  });
  it("優先度「高」は理由が要る", async () => {
    expect(
      await fails(
        boss,
        "insert into tickets (tenant_id, scope_id, kind_id, stage_id, title, number, priority) values ($1, $2, $3, $4, 'x', '', 'high')",
        [S.tenantA, S.scopeRootA, kindA, todoA],
      ),
    ).toMatch(/check/);
    expect(
      (await newTicket(boss, S.scopeRootA, { priority: "high", priority_reason: "先方の締め" })).number,
    ).toBeTruthy();
  });
});
