// K-905「チケットの詳細の右のパネルに「ゲストに見せる」の区画を足す」のうち、詳細の答え（getTicket・GET /api/v1/tickets/:id）に
//   見せる相手の要約 guest_share を足す分の単体の試験（口と DB・本物の Postgres・本物の行の守り・偽の画面のログイン）。行 ID（K905-API-…）は 11_tickets/K-905.md の表の行と 1 対 1。
//   PM の決め 2026-11-27 案 (a)：画面は初めの読み込みで見せる相手の口（listTicketGuestShares）を呼ばず、この欄で区画とやり取りの頭の印を出す（台帳 /tickets/:id の上限 8 を超えない）。
// 試験が決める答えの形：data.guest_share = { shared: [{ guest_group_id, name }], can_change: boolean }
//   shared＝今見せているゲストのグループ（消していない見せる行・消していないグループ・名前の順）。summary・choices は載せない（小窓を開いたときに listTicketGuestShares で読む）
//   can_change＝見ている人がそのチケットに書けるか（listTicketGuestShares の can_change と同じ値・app.ticket_writable）
//   欄は詳細に足す欄の 1 文（apps/api/src/features/F4/create-ticket/hooks.ts の DETAIL_EXTRAS_SQL）の列として読み、文の数・取引の数は増やさない（台帳の /api/v1/tickets/:id：文 15・begin 1）
// 見せる相手の表 ticket_guest_shares は K-881、ゲストのグループ guest_groups は K-876（依存の葉）。準備は DB に直に置く。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { SCHEMAS } from "@kaname/contracts/schemas";
import { delegateHooks } from "../../../src/hooks/delegate.js";
import { ticketHooks } from "../../../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

let f: Fixture;
let T: { tenantId: string; rootScope: string };
let writer: Person;
let viewer: Person;

// ---------------------------------------------------------------- 数える（k234_one_transaction.test.ts と同じ包み方）
const hits: string[] = [];
function tap(pool: pg.Pool): void {
  const orig = pool.connect.bind(pool) as unknown as (cb?: unknown) => unknown;
  const wrap = (cl: pg.PoolClient): pg.PoolClient => {
    const c = cl as pg.PoolClient & { __k905?: boolean };
    if (!c.__k905) {
      const q = c.query.bind(c) as (...a: unknown[]) => unknown;
      (c as unknown as { query: (...a: unknown[]) => unknown }).query = (...a: unknown[]) => {
        const t = a[0];
        hits.push(typeof t === "string" ? t : String((t as { text?: string } | null)?.text ?? ""));
        return q(...a);
      };
      c.__k905 = true;
    }
    return cl;
  };
  (
    pool as unknown as { connect: (cb?: (e: Error | undefined, c?: pg.PoolClient, d?: unknown) => void) => unknown }
  ).connect = (cb) =>
    cb
      ? orig((e: Error | undefined, c?: pg.PoolClient) =>
          cb(e, c ? wrap(c) : c, (r?: unknown) => c?.release(r as Error | undefined)),
        )
      : (orig() as Promise<pg.PoolClient>).then(wrap);
}

beforeAll(async () => {
  f = await makeFixture([ticketHooks, delegateHooks]);
  tap(f.pool as unknown as pg.Pool);
  T = await f.company("K905 の会社", "GV");
  writer = await f.person(T.tenantId, T.rootScope, { name: "書く人", ticketAbility: "edit" });
  viewer = await f.person(T.tenantId, T.rootScope, { name: "読むだけの人", ticketAbility: "view" });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const ticket = async (): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title)
       select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'),
              (select id from ticket_stages where tenant_id = $1 and key = 'todo'), '見せるチケット'
       returning id`,
      [T.tenantId, T.rootScope],
    )
  ).rows[0]!.id;
const gg = async (name: string, deleted = false): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      "insert into guest_groups (tenant_id, name, request_scope_id, deleted_at) values ($1, $2, $3, $4) returning id",
      [T.tenantId, name, T.rootScope, deleted ? new Date() : null],
    )
  ).rows[0]!.id;
const share = async (tid: string, g: string, deleted = false): Promise<void> => {
  await f.admin.query(
    "insert into ticket_guest_shares (tenant_id, ticket_id, guest_group_id, shared_by, deleted_at) values ($1, $2, $3, $4, $5)",
    [T.tenantId, tid, g, writer.id, deleted ? new Date() : null],
  );
};
type Detail = { guest_share?: { shared: { guest_group_id: string; name: string }[]; can_change: boolean } } & Record<
  string,
  unknown
>;
const detail = async (tid: string, p: Person): Promise<Detail> => {
  const r = await f.req("GET", `/tickets/${tid}`, { headers: p.auth });
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await r.json()) as { data: Detail }).data;
};

describe("K-905 詳細の答えの guest_share", () => {
  it("K905-API-001 見せていないチケット：書ける人の詳細の答えに guest_share { shared: [], can_change: true } が出る", async () => {
    const tid = await ticket();
    const d = await detail(tid, writer);
    expect(d.guest_share).toEqual({ shared: [], can_change: true });
  });

  it("K905-API-002 2 つに見せている：shared は名前の順で guest_group_id と name だけ（summary・choices は載せない）・外した見せる行と消したグループは出ない", async () => {
    const tid = await ticket();
    const b = await gg("Bの会社（ゲスト）");
    const a = await gg("Aの会社（ゲスト）");
    const gone = await gg("消したグループ", true);
    const off = await gg("外した相手");
    await share(tid, b);
    await share(tid, a);
    await share(tid, gone);
    await share(tid, off, true);
    const d = await detail(tid, writer);
    expect(d.guest_share).toEqual({
      shared: [
        { guest_group_id: a, name: "Aの会社（ゲスト）" },
        { guest_group_id: b, name: "Bの会社（ゲスト）" },
      ],
      can_change: true,
    });
    expect(JSON.stringify(d.guest_share)).not.toContain("summary");
    expect(d.guest_share).not.toHaveProperty("choices");
  });

  it("K905-API-003 読むだけの人：shared は書ける人と同じ・can_change は false", async () => {
    const tid = await ticket();
    const g = await gg("Cの会社（ゲスト）");
    await share(tid, g);
    const d = await detail(tid, viewer);
    expect(d.guest_share).toEqual({ shared: [{ guest_group_id: g, name: "Cの会社（ゲスト）" }], can_change: false });
  });

  it("K905-API-004 答えは契約の形 TicketDetail（strict）に合い、GET /tickets/:id は begin 1・文 15 以下（台帳 perf_budget.json の /api/v1/tickets/:id）のまま", async () => {
    const tid = await ticket();
    await share(tid, await gg("Dの会社（ゲスト）"));
    hits.length = 0;
    const r = await f.req("GET", `/tickets/${tid}`, { headers: writer.auth });
    expect(r.status, await r.clone().text()).toBe(200);
    const sql = [...hits];
    const data = ((await r.json()) as { data: unknown }).data;
    const p = SCHEMAS["TicketDetail"]!.safeParse(data);
    expect(p.success, JSON.stringify(p.error?.issues)).toBe(true);
    expect(sql.filter((x) => /^\s*begin\b/i.test(x)).length, "取引は 1 つ").toBe(1);
    expect(sql.length, sql.join("\n")).toBeLessThanOrEqual(15);
  });
});
