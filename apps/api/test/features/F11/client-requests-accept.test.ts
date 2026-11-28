// K-894「依頼を受けて普通のチケットを作る（acceptClientRequest）」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン）。行 ID（K894-API-…）は 11_tickets/K-894.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/client-requests-accept.ts の register（K-326）。道具は requests-world.ts（K-892）。
// 試験が決める口の形（契約は 05_flow/screen_api.d/K-894.py で作る）:
//   acceptClientRequest  POST /api/v1/client_requests/:id/accept
//     body { title?, body?, assignee_member_id, due_on, scope_id, kind_id?, guest_group_ids?: uuid[]（1〜20・依頼を出したグループは常に入る） }（知らない欄は 422）→ 201 { data: { ticket_id, number } }
//     断り：見えない・無い・消した・別の会社・前の形は 404・E-GST-100／読むだけは 403／もう決まっている 409・E-GST-120／見せる相手が無い 404・E-GST-040・20 超え 409・E-GST-041／
//          担当・種別・本文の誤りは 422（欄つき）・グループに書けないは 403（欄 scope_id）／ゲストの文脈 403／ログインなし 401／503 E-PAGE-003
//     1 つの取引：普通のチケット（app.ticket_create）・チャットの頭（依頼の本文とやり取りを元の時刻のまま post・guest_visible true）・見せる相手（依頼のグループ＋足したグループ）・依頼を ticketed に
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { makeFixture, quietWrite, type Fixture, type Person } from "../fixture.js";
import {
  asJson,
  failOn,
  guest,
  hasNoDetail,
  inbox,
  mails,
  n,
  NO_SUCH,
  perm,
  request,
  requestMsg,
  useHooks,
  world,
  type Json,
  type RW,
} from "./requests-world.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (code: string): string => ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${code} が無い）`;

let f: Fixture;
beforeAll(async () => {
  f = await makeFixture([]);
  await useHooks(f, "client-requests-accept");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const accept = (
  id: string,
  body: unknown,
  p: Person | null,
  role: "member" | "client" = "member",
  headers: Record<string, string> = {},
) => f.req("POST", `/client_requests/${id}/accept`, { body, headers: { ...(p ? f.as(p, role) : {}), ...headers } });
const D = "2026-12-31";
const okBody = (w: RW, o: Json = {}): Json => ({
  assignee_member_id: w.staff.id,
  due_on: D,
  scope_id: w.reqScope,
  ...o,
});
const refused = async (r: Response, status: number, code: string): Promise<void> => {
  expect(r.status, await r.clone().text()).toBe(status);
  const j = await asJson(r);
  expect(j["code"]).toBe(code);
  expect(j["message"]).toBe(msg(code));
  expect(hasNoDetail(j)).toBe(true);
};
const stateOf = async (rid: string) =>
  (
    await f.admin.query<{ s: string; t: string | null }>(
      "select state as s, ticket_id as t from client_requests where id = $1",
      [rid],
    )
  ).rows[0]!;
const tickets = (w: RW) => n(f, "select count(*) as n from tickets where tenant_id = $1", [w.tenantId]);
const chatOf = async (t: string) =>
  (
    await f.admin.query<{
      kind: string;
      author_member_id: string;
      body: string;
      guest_visible: boolean;
      from_request: boolean;
      created_at: Date;
    }>(
      "select kind, author_member_id, body, guest_visible, from_request, created_at from ticket_messages where ticket_id = $1 order by created_at, id",
      [t],
    )
  ).rows;
const audit = async (w: RW, action: string) =>
  (
    await f.admin.query<{ payload: Json }>("select payload from audit_events where tenant_id = $1 and action = $2", [
      w.tenantId,
      action,
    ])
  ).rows.map((r) => r.payload);
const asGuest = (w: RW, p: Person): TenantContext => ({
  tenantId: w.tenantId,
  userId: p.id,
  role: "client",
  stepUpAt: null,
});
const guestSees = (w: RW, p: Person, t: string) =>
  withTenant(
    f.pool,
    asGuest(w, p),
    async (cl) => (await cl.query("select id from tickets where id = $1", [t])).rowCount ?? 0,
  );
const guestChat = (w: RW, p: Person, t: string) =>
  withTenant(
    f.pool,
    asGuest(w, p),
    async (cl) =>
      (
        await cl.query<{ v: { side: string; text: string }[] | null }>("select app.portal_ticket_messages($1) as v", [
          t,
        ])
      ).rows[0]!.v,
  );
/** 依頼を作る（最初の本文と 2 つのやり取り・古い順）。actor に client_requests の edit と tickets の edit を持つ boss を使う */
async function setup(tag: string, o: { state?: "new" | "asking" | "ticketed" | "declined" } = {}) {
  const w = await world(f, tag);
  const a = await guest(f, w, "山田", w.gA);
  const rid = await request(f, w, w.gA, a, {
    title: "見積もりの依頼",
    body: "見積もりをください",
    state: o.state ?? "new",
    ago: "3 hours",
  });
  await requestMsg(f, w, rid, "company", w.staff, "いつまでですか", { ago: "2 hours" });
  await requestMsg(f, w, rid, "guest", a, "来週までに", { ago: "1 hour" });
  return { w, a, rid };
}
/** client_requests の edit だけを持ち、tickets の edit を持たない人（グループに書けない 403 の確かめ用） */
async function limited(w: RW): Promise<Person> {
  const p = await f.person(w.tenantId, w.reqScope, { name: "チケットを作れない人", ticketAbility: null });
  // 会社と届け先のグループに入れるが、役割の束の引き金（0080・member は自分のグループで tickets を edit）は通さない（quietWrite）。
  //   通すと束で tickets の edit が付き、「チケットを作れない人」にならない。持つ権限は届け先の client_requests の edit だけ
  await quietWrite(
    f,
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, null, 'member', 'active')",
    [w.tenantId, p.id],
  );
  await quietWrite(
    f,
    "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) select $1, $2, $3, true, 'member' where not exists (select 1 from scope_memberships where member_id = $2 and scope_id = $3)",
    [w.tenantId, p.id, w.reqScope],
  );
  await perm(f, w, p, w.reqScope);
  return p;
}

describe("K-894 依頼を受けて普通のチケットにする（acceptClientRequest）", () => {
  it("K894-API-001 受ける：201・答えの鍵は ticket_id・number だけ・チケットの題・担当・期限・グループ・種別（タスク）・段（todo）が入る・依頼は ticketed で ticket_id が付く。new でも asking でも通る", async () => {
    for (const state of ["new", "asking"] as const) {
      const { w, rid } = await setup(`001 ${state}`, { state });
      const r = await accept(rid, okBody(w), w.boss);
      expect(r.status, await r.clone().text()).toBe(201);
      expect(r.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
      const d = (await asJson(r)).data as Json;
      expect(Object.keys(d).sort()).toEqual(["number", "ticket_id"]);
      const t = (
        await f.admin.query<{
          title: string;
          assignee_member_id: string;
          due: string;
          scope_id: string;
          kind: string;
          stage: string;
          number: string;
        }>(
          `select t.title, t.assignee_member_id, to_char(t.due_on, 'YYYY-MM-DD') as due, t.scope_id, k.name as kind, s.key as stage, t.number
             from tickets t join ticket_kinds k on k.id = t.kind_id join ticket_stages s on s.id = t.stage_id where t.id = $1`,
          [d["ticket_id"]],
        )
      ).rows[0]!;
      expect(t).toEqual({
        title: "見積もりの依頼",
        assignee_member_id: w.staff.id,
        due: D,
        scope_id: w.reqScope,
        kind: "タスク",
        stage: "todo",
        number: d["number"],
      });
      expect(await stateOf(rid)).toEqual({ s: "ticketed", t: d["ticket_id"] });
    }
  });

  it("K894-API-002 題・本文を直して受ける：直した題・本文が入る。無ければ依頼の題・本文（本文の区画 body に依頼の本文が入る）。種別を選べばその種別", async () => {
    const { w, rid } = await setup("002");
    const r1 = await accept(rid, okBody(w), w.boss);
    const t1 = ((await asJson(r1)).data as { ticket_id: string }).ticket_id;
    expect(
      (
        await f.admin.query<{ b: string }>(
          "select body->>'text' as b from ticket_sections where ticket_id = $1 and section_key = 'body'",
          [t1],
        )
      ).rows[0]!.b,
    ).toBe("見積もりをください");
    const { w: w2, rid: rid2 } = await setup("002 直す");
    const kind = (
      await f.admin.query<{ id: string }>(
        "select id from ticket_kinds where tenant_id = $1 and name <> 'タスク' and deleted_at is null limit 1",
        [w2.tenantId],
      )
    ).rows[0]?.id;
    const r2 = await accept(
      rid2,
      okBody(w2, { title: "  直した題  ", body: "直した本文", ...(kind ? { kind_id: kind } : {}) }),
      w2.boss,
    );
    const t2 = ((await asJson(r2)).data as { ticket_id: string }).ticket_id;
    expect(
      (await f.admin.query<{ title: string }>("select title from tickets where id = $1", [t2])).rows[0]!.title,
    ).toBe("直した題");
    expect(
      (
        await f.admin.query<{ b: string }>(
          "select body->>'text' as b from ticket_sections where ticket_id = $1 and section_key = 'body'",
          [t2],
        )
      ).rows[0]!.b,
    ).toBe("直した本文");
    if (kind)
      expect(
        (await f.admin.query<{ k: string }>("select kind_id as k from tickets where id = $1", [t2])).rows[0]!.k,
      ).toBe(kind);
  });

  it("K894-API-003 チャットの頭：依頼の最初の本文＋やり取りの message（消した物・添付の行は入れない）が古い順・どれも post・guest_visible true・書いた人と時刻は元のまま・チケットの作った時刻より前", async () => {
    const { w, a, rid } = await setup("003");
    await requestMsg(f, w, rid, "guest", a, "消した物", { ago: "30 minutes", deleted: true });
    await f.admin.query(
      "insert into client_request_messages (tenant_id, client_request_id, side, kind, body, author_member_id) values ($1, $2, 'guest', 'attachment', null, $3)",
      [w.tenantId, rid, a.id],
    );
    const r = await accept(rid, okBody(w), w.boss);
    const t = ((await asJson(r)).data as { ticket_id: string }).ticket_id;
    const chat = await chatOf(t);
    expect(chat.map((m) => [m.kind, m.author_member_id, m.body, m.guest_visible, m.from_request])).toEqual([
      ["post", a.id, "見積もりをください", true, true],
      ["post", w.staff.id, "いつまでですか", true, true],
      ["post", a.id, "来週までに", true, true],
    ]);
    const made = (await f.admin.query<{ c: Date }>("select created_at as c from tickets where id = $1", [t])).rows[0]!
      .c;
    for (const m of chat) expect(m.created_at.getTime()).toBeLessThan(made.getTime());
    const first = (await f.admin.query<{ c: Date }>("select created_at as c from client_requests where id = $1", [rid]))
      .rows[0]!.c;
    expect(chat[0]!.created_at.getTime()).toBe(first.getTime());
  });

  it("K894-API-004 守り（見せる相手）：依頼を出したグループの行が入りそのグループのゲスト全員が読める・別のグループのゲストは 0 行。guest_group_ids を足すとそのグループにも入る。無い・消した・別の会社は 404・E-GST-040・21 になる数は 409・E-GST-041・どちらも何も残らない", async () => {
    const { w, a, rid } = await setup("004");
    const a2 = await guest(f, w, "同じグループの鈴木", w.gA);
    const b = await guest(f, w, "別のグループの佐藤", w.gB);
    const o = await world(f, "004 別の会社");
    const before = await tickets(w);
    await refused(await accept(rid, okBody(w, { guest_group_ids: [o.gA] }), w.boss), 404, "E-GST-040");
    expect(await tickets(w)).toBe(before);
    expect((await stateOf(rid)).s).toBe("new");
    const extra = await Promise.all(
      Array.from(
        { length: 20 },
        async (_, i) =>
          (
            await f.admin.query<{ id: string }>(
              "insert into guest_groups (tenant_id, name, request_scope_id) values ($1, $2, $3) returning id",
              [w.tenantId, `足す社 ${i}`, w.reqScope],
            )
          ).rows[0]!.id,
      ),
    );
    await refused(await accept(rid, okBody(w, { guest_group_ids: extra }), w.boss), 409, "E-GST-041");
    expect(await tickets(w)).toBe(before);
    const t = ((await asJson(await accept(rid, okBody(w), w.boss))).data as { ticket_id: string }).ticket_id;
    expect(await guestSees(w, a, t)).toBe(1);
    expect(await guestSees(w, a2, t)).toBe(1);
    expect(await guestSees(w, b, t)).toBe(0);
    const { w: w2, a: a3, rid: rid2 } = await setup("004 足す");
    const gb = await guest(f, w2, "足したグループの人", w2.gB);
    const t2 = (
      (await asJson(await accept(rid2, okBody(w2, { guest_group_ids: [w2.gB] }), w2.boss))).data as {
        ticket_id: string;
      }
    ).ticket_id;
    expect(await guestSees(w2, a3, t2)).toBe(1);
    expect(await guestSees(w2, gb, t2)).toBe(1);
    expect(
      await n(f, "select count(*) as n from ticket_guest_shares where ticket_id = $1 and deleted_at is null", [t2]),
    ).toBe(2);
  });

  it("K894-API-005 外に出す物（知らせ）：ゲストの受け箱に ticket.guest_shared が 1 件ずつ（グループの今いるゲスト）・担当者に ticket.assigned が 1 件（担当が自分のときは入らない）・メールは 1 通も送らない", async () => {
    const { w, a, rid } = await setup("005");
    const a2 = await guest(f, w, "同じグループの鈴木", w.gA);
    const before = mails.length;
    const t = ((await asJson(await accept(rid, okBody(w), w.boss))).data as { ticket_id: string }).ticket_id;
    expect(await inbox(f, a.id, "ticket.guest_shared")).toBe(1);
    expect(await inbox(f, a2.id, "ticket.guest_shared")).toBe(1);
    expect(await inbox(f, w.staff.id, "ticket.assigned")).toBe(1);
    expect(mails.length).toBe(before);
    expect(t).toBeTruthy();
    const { w: w2, rid: rid2 } = await setup("005 自分");
    await accept(rid2, okBody(w2, { assignee_member_id: w2.boss.id }), w2.boss);
    expect(await inbox(f, w2.boss.id, "ticket.assigned")).toBe(0);
  });

  it("K894-API-006 普通のチケット：作ったチケットの client_id は空・client_share は既定・ゲストだけの列は無い（tickets の列は前のまま）", async () => {
    const { w, rid } = await setup("006");
    const t = ((await asJson(await accept(rid, okBody(w), w.boss))).data as { ticket_id: string }).ticket_id;
    const row = (
      await f.admin.query<{ client_id: string | null; client_share: unknown }>(
        "select client_id, client_share from tickets where id = $1",
        [t],
      )
    ).rows[0]!;
    expect(row.client_id).toBeNull();
    expect(row.client_share).toEqual({});
    const cols = (
      await f.admin.query<{ c: string }>(
        "select column_name as c from information_schema.columns where table_schema = 'public' and table_name = 'tickets'",
      )
    ).rows.map((r) => r.c);
    expect(cols.filter((c) => /guest|request/.test(c))).toEqual([]);
  });

  it("K894-API-007 守り（ゲストの読み・K-882）：作った後、依頼を出したグループのゲストの app.portal_ticket_messages に、チャットの頭の書き込みが古い順・社内は we・ゲストは they で出る", async () => {
    const { w, a, rid } = await setup("007");
    const t = ((await asJson(await accept(rid, okBody(w), w.boss))).data as { ticket_id: string }).ticket_id;
    const read = (await guestChat(w, a, t))!;
    expect(read.map((m) => [m.side, m.text])).toEqual([
      ["they", "見積もりをください"],
      ["we", "いつまでですか"],
      ["they", "来週までに"],
    ]);
    expect(
      read.map((m) => (m as { from_request?: boolean }).from_request),
      "依頼から来た書き込みの印",
    ).toEqual([true, true, true]);
  });

  it("K894-API-008 入力：担当・期限・グループが無い・題が空・日付でない・uuid でない・guest_group_ids が空か 20 個・知らない欄（state・ticket_id・client_id・priority）はどれも 422・何も作らない。uuid でない道の :id も 422", async () => {
    const { w, rid } = await setup("008");
    const before = await tickets(w);
    const bad: Json[] = [
      { due_on: D, scope_id: w.reqScope },
      { assignee_member_id: w.staff.id, scope_id: w.reqScope },
      { assignee_member_id: w.staff.id, due_on: D },
      okBody(w, { title: "" }),
      okBody(w, { due_on: "来週" }),
      okBody(w, { assignee_member_id: "x" }),
      okBody(w, { guest_group_ids: [] }),
      okBody(w, { guest_group_ids: Array.from({ length: 21 }, () => randomUUID()) }),
      okBody(w, { state: "ticketed" }),
      okBody(w, { ticket_id: randomUUID() }),
      okBody(w, { client_id: randomUUID() }),
      okBody(w, { priority: "high" }),
    ];
    for (const b of bad) expect((await accept(rid, b, w.boss)).status, JSON.stringify(b)).toBe(422);
    expect((await accept("not-a-uuid", okBody(w), w.boss)).status).toBe(422);
    expect(await tickets(w)).toBe(before);
    expect((await stateOf(rid)).s).toBe("new");
  });

  it("K894-API-009 失敗：作れない（担当が会社の人でない・止めた・抜けた／種別が無い／グループに書けない）。担当・種別は 422（欄つき）・グループに書けないは 403（欄 scope_id）。チケットも書き込みも見せる相手も増えず、依頼は new のまま", async () => {
    const { w, rid } = await setup("009");
    const o = await world(f, "009 別の会社");
    const susp = await f.person(w.tenantId, w.root, { name: "止めた担当" });
    await f.admin.query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, null, 'member', 'suspended')",
      [w.tenantId, susp.id],
    );
    const left = await f.person(w.tenantId, w.root, { name: "抜けた担当" });
    await f.admin.query("update members set deleted_at = now() where id = $1", [left.id]);
    const cases: [Json, number, string][] = [
      [okBody(w, { assignee_member_id: o.staff.id }), 422, "assignee_member_id"],
      [okBody(w, { assignee_member_id: susp.id }), 422, "assignee_member_id"],
      [okBody(w, { assignee_member_id: left.id }), 422, "assignee_member_id"],
      [okBody(w, { kind_id: randomUUID() }), 422, "kind_id"],
    ];
    const before = [
      await tickets(w),
      await n(f, "select count(*) as n from ticket_messages where tenant_id = $1", [w.tenantId]),
      await n(f, "select count(*) as n from ticket_guest_shares where tenant_id = $1", [w.tenantId]),
    ];
    for (const [b, status, field] of cases) {
      const r = await accept(rid, b, w.boss);
      expect(r.status, JSON.stringify(b)).toBe(status);
      expect((await asJson(r))["field"]).toBe(field);
    }
    const lim = await limited(w);
    const noScope = await accept(rid, okBody(w), lim);
    expect(noScope.status).toBe(403);
    expect((await asJson(noScope))["field"]).toBe("scope_id");
    const after = [
      await tickets(w),
      await n(f, "select count(*) as n from ticket_messages where tenant_id = $1", [w.tenantId]),
      await n(f, "select count(*) as n from ticket_guest_shares where tenant_id = $1", [w.tenantId]),
    ];
    expect(after).toEqual(before);
    expect((await stateOf(rid)).s).toBe("new");
  });

  it("K894-API-010 失敗：もう決まっている依頼（チケットにした・断った）は 409・E-GST-120・欄・details なし・何も作らない", async () => {
    const { w, a } = await setup("010");
    const before = await tickets(w);
    for (const state of ["ticketed", "declined"] as const) {
      const rid = await request(f, w, w.gA, a, { state });
      await refused(await accept(rid, okBody(w), w.boss), 409, "E-GST-120");
    }
    expect(await tickets(w)).toBe(before + 1);
  });

  it("K894-API-011 守り（権限・見えない依頼）：届け先で edit できる人（グループにも書ける）・管理者は 201。読むだけの人は 403・別のグループの人・消した・別の会社・前の取引先の形・知らない id は 404・E-GST-100・ゲストの文脈は 403・ログインなしは 401", async () => {
    const { w, a, rid } = await setup("011");
    const dead = await request(f, w, w.gA, a, { deleted: true });
    const client = (
      await f.admin.query<{ id: string }>(
        "insert into clients (tenant_id, name) values ($1, '前の取引先') returning id",
        [w.tenantId],
      )
    ).rows[0]!.id;
    const legacy = (
      await f.admin.query<{ id: string }>(
        "insert into client_requests (tenant_id, client_id, title) values ($1, $2, '前の形') returning id",
        [w.tenantId, client],
      )
    ).rows[0]!.id;
    expect((await accept(rid, okBody(w), w.viewer)).status).toBe(403);
    await refused(await accept(rid, okBody(w), w.outsider), 404, "E-GST-100");
    for (const id of [dead, legacy, NO_SUCH]) await refused(await accept(id, okBody(w), w.boss), 404, "E-GST-100");
    expect((await accept(rid, okBody(w), a, "client")).status).toBe(403);
    expect((await accept(rid, okBody(w), null)).status).toBe(401);
    expect((await stateOf(rid)).s).toBe("new");
    expect((await accept(rid, okBody(w), w.staff)).status).toBe(201);
  });

  it("K894-API-012 操作の揺れ：同時に 2 本は片方が 201・もう片方が 409・E-GST-120・チケットは 1 つ・チャットの頭は 1 回分", async () => {
    const { w, rid } = await setup("012");
    const before = await tickets(w);
    const rs = await Promise.all([
      accept(rid, okBody(w), w.boss, "member", { "idempotency-key": randomUUID() }),
      accept(rid, okBody(w), w.staff, "member", { "idempotency-key": randomUUID() }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await tickets(w)).toBe(before + 1);
    const t = (await stateOf(rid)).t!;
    expect((await chatOf(t)).length).toBe(3);
  });

  it("K894-API-013 操作の揺れ：同じ冪等キーで 2 回は 201・同じ答え・チケット 1 つ。キーが違えば 2 回目は 409・E-GST-120", async () => {
    const { w, rid } = await setup("013");
    const before = await tickets(w);
    const key = { "idempotency-key": randomUUID() };
    const [r1, r2] = [
      await accept(rid, okBody(w), w.boss, "member", key),
      await accept(rid, okBody(w), w.boss, "member", key),
    ];
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(((await asJson(r1)).data as Json)["ticket_id"]).toBe(((await asJson(r2)).data as Json)["ticket_id"]);
    expect(await tickets(w)).toBe(before + 1);
    await refused(
      await accept(rid, okBody(w), w.boss, "member", { "idempotency-key": randomUUID() }),
      409,
      "E-GST-120",
    );
  });

  it("K894-API-014 守り（証跡）：client_request.accepted が 1 行・payload は request_id と ticket_id だけ。断られた物は書かない", async () => {
    const { w, rid } = await setup("014");
    await accept(rid, {}, w.boss);
    await accept(rid, okBody(w), w.viewer);
    const t = ((await asJson(await accept(rid, okBody(w), w.boss))).data as { ticket_id: string }).ticket_id;
    expect(await audit(w, "client_request.accepted")).toEqual([{ request_id: rid, ticket_id: t }]);
  });

  it("K894-API-015 失敗（手順 1 の途中）：見せる相手の行を書けなければ 503・E-PAGE-003・チケットも書き込みも依頼の更新も見せる相手も担当者の受け箱も残らない（1 つの取引）・押し直せる", async () => {
    const { w, rid } = await setup("015");
    const before = [
      await tickets(w),
      await n(f, "select count(*) as n from ticket_messages where tenant_id = $1", [w.tenantId]),
      await n(f, "select count(*) as n from notifications where member_id = $1", [w.staff.id]),
    ];
    await failOn(f, "ticket_guest_shares", "true", async () => {
      const r = await accept(rid, okBody(w), w.boss);
      expect(r.status).toBe(503);
      expect((await asJson(r))["code"]).toBe("E-PAGE-003");
    });
    expect([
      await tickets(w),
      await n(f, "select count(*) as n from ticket_messages where tenant_id = $1", [w.tenantId]),
      await n(f, "select count(*) as n from notifications where member_id = $1", [w.staff.id]),
    ]).toEqual(before);
    expect((await stateOf(rid)).s).toBe("new");
    expect((await audit(w, "client_request.accepted")).length).toBe(0);
    expect((await accept(rid, okBody(w), w.boss)).status).toBe(201);
  });

  it("K894-API-016 受けた後の依頼の読み（K-892）：一覧で state done・tag チケットにした・1 件の request に ticket_id が付く。返事・届け先の変更は 409・E-GST-110", async () => {
    const { w, rid } = await setup("016");
    await useHooks(f, "client-requests-read");
    await useHooks(f, "client-requests-route-reply");
    await useHooks(f, "client-requests-accept");
    const t = ((await asJson(await accept(rid, okBody(w), w.boss))).data as { ticket_id: string }).ticket_id;
    const list = (
      (await asJson(await f.req("GET", "/client_requests", { headers: f.as(w.staff, "member") }))).data as {
        items: { id: string; state: string; tag?: string }[];
      }
    ).items;
    expect(list.find((x) => x.id === rid)).toMatchObject({ state: "done", tag: "チケットにした" });
    const one = (
      (await asJson(await f.req("GET", `/client_requests/${rid}`, { headers: f.as(w.staff, "member") }))).data as {
        request: Json;
      }
    ).request;
    expect(one["ticket_id"]).toBe(t);
    await refused(
      await f.req("POST", `/client_requests/${rid}/reply`, {
        body: { body: "あとから" },
        headers: f.as(w.staff, "member"),
      }),
      409,
      "E-GST-110",
    );
    await refused(
      await f.req("PATCH", `/client_requests/${rid}`, {
        body: { route_id: w.reqScope },
        headers: f.as(w.staff, "member"),
      }),
      409,
      "E-GST-110",
    );
  });

  it("K894-API-017 対象の状態：依頼の出し手が会社から抜けていても、チャットの頭に入る（書いた人の行は残る）", async () => {
    const { w, a, rid } = await setup("017");
    await f.admin.query("update members set deleted_at = now() where id = $1", [a.id]);
    const r = await accept(rid, okBody(w), w.boss);
    expect(r.status, await r.clone().text()).toBe(201);
    const t = ((await asJson(r)).data as { ticket_id: string }).ticket_id;
    expect((await chatOf(t)).filter((m) => m.author_member_id === a.id).length).toBe(2);
  });

  it("K894-API-018 対象の状態：やり取りが無い依頼は、最初の本文だけがチャットの頭に 1 件入る", async () => {
    const w = await world(f, "018");
    const a = await guest(f, w, "山田", w.gA);
    const rid = await request(f, w, w.gA, a, { body: "ひとことだけ" });
    const t = ((await asJson(await accept(rid, okBody(w), w.boss))).data as { ticket_id: string }).ticket_id;
    expect((await chatOf(t)).map((m) => [m.author_member_id, m.body, m.guest_visible])).toEqual([
      [a.id, "ひとことだけ", true],
    ]);
  });

  it("K894-API-019 守り（上限）：同じ人が上限を超えたら 429・retry_after_sec は 1〜60 の整数・no-store", async () => {
    const { w, rid } = await setup("019");
    f.limits["acceptClientRequest"] = 2;
    try {
      const rs = [];
      for (let i = 0; i < 3; i++) rs.push(await accept(rid, {}, w.boss));
      expect(rs[2]!.status).toBe(429);
      const j = await asJson(rs[2]!);
      expect(Number.isInteger(j["retry_after_sec"])).toBe(true);
      expect(j["retry_after_sec"] as number).toBeGreaterThanOrEqual(1);
      expect(j["retry_after_sec"] as number).toBeLessThanOrEqual(60);
      expect(rs[2]!.headers.get("cache-control") ?? "").toContain("no-store");
    } finally {
      delete f.limits["acceptClientRequest"];
    }
  });

  it("K894-API-020 守り（no-store）：201・404・409 の答えに Cache-Control の private か no-store が付く", async () => {
    const { w, rid } = await setup("020");
    const ok = await accept(rid, okBody(w), w.boss);
    const gone = await accept(NO_SUCH, okBody(w), w.boss);
    const done = await accept(rid, okBody(w), w.boss);
    for (const r of [ok, gone, done]) expect(r.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
    expect([ok.status, gone.status, done.status]).toEqual([201, 404, 409]);
  });
});
