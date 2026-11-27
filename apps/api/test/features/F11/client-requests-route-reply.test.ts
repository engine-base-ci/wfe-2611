// K-893「届け先のグループを変える・返事を送って詳しく聞く（updateClientRequest・replyToClientRequest）」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン・メールは試験の偽）。行 ID（K893-API-…）は 11_tickets/K-893.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/client-requests-route-reply.ts の register（K-326）。道具は requests-world.ts（K-892）。
// 試験が決める口の形（契約は 05_flow/screen_api.d/K-893.py で作る）:
//   updateClientRequest   PATCH /api/v1/client_requests/:id        body { route_id: uuid } → 200 { data: { route_name } }
//   replyToClientRequest  POST  /api/v1/client_requests/:id/reply  body { body: string }    → 201 { data: { state: "asking" } }
//     断り：見えない・無い・消した・別の会社・前の形は 404・E-GST-100／読むだけは 403／もう決まっている 409・E-GST-110／選べない届け先 404・E-GST-111／ゲストの文脈 403／ログインなし 401／503 E-PAGE-003
//     返事：出し手の受け箱（inapp・client_request.replied）に 1 件＋メール 1 通（リンクだけ）。メールが送れなくても 201（email の行に failed_at が残る）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeFixture, type Fixture, type Person } from "../fixture.js";
import {
  asJson,
  failOn,
  guest,
  hasNoDetail,
  inbox,
  mailer,
  mails,
  n,
  NO_SUCH,
  perm,
  request,
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
  await useHooks(f, "client-requests-route-reply");
  await useHooks(f, "client-requests-read"); // K893-API-008 が GET /client_requests/:id（K-892 の口）で変えた後の読みを見る
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const patch = (id: string, body: unknown, p: Person | null, role: "member" | "client" = "member") =>
  f.req("PATCH", `/client_requests/${id}`, { body, ...(p ? { headers: f.as(p, role) } : {}) });
const reply = (
  id: string,
  body: unknown,
  p: Person | null,
  role: "member" | "client" = "member",
  headers: Record<string, string> = {},
) => f.req("POST", `/client_requests/${id}/reply`, { body, headers: { ...(p ? f.as(p, role) : {}), ...headers } });
const data = async (r: Response): Promise<Json> => (await asJson(r)).data as Json;
const refused = async (r: Response, status: number, code: string): Promise<void> => {
  expect(r.status, await r.clone().text()).toBe(status);
  const j = await asJson(r);
  expect(j["code"]).toBe(code);
  if (code.startsWith("E-GST")) expect(j["message"]).toBe(msg(code));
  expect(hasNoDetail(j)).toBe(true);
};
const routeOf = async (rid: string) =>
  (await f.admin.query<{ r: string | null }>("select routed_scope_id as r from client_requests where id = $1", [rid]))
    .rows[0]!.r;
const stateOf = async (rid: string) =>
  (await f.admin.query<{ s: string }>("select state as s from client_requests where id = $1", [rid])).rows[0]!.s;
const msgs = (rid: string) =>
  n(f, "select count(*) as n from client_request_messages where client_request_id = $1", [rid]);
const audit = async (w: RW, action: string) =>
  (
    await f.admin.query<{ payload: Json }>(
      "select payload from audit_events where tenant_id = $1 and action = $2 order by created_at",
      [w.tenantId, action],
    )
  ).rows.map((r) => r.payload);
const emailRows = (rid: string) =>
  f.admin.query<{ sent_at: Date | null; failed_at: Date | null; payload: Json }>(
    "select sent_at, failed_at, payload from notifications where channel_id = 'email' and event_kind_id = 'client_request.replied' and payload->>'request_id' = $1",
    [rid],
  );
/** ゲストに、認証のアカウントとメールアドレスを付ける（メールの宛先が分かる人にする） */
async function giveEmail(p: Person, email: string): Promise<void> {
  const uid = randomUUID();
  await f.admin.query(
    'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
    [uid, "ゲスト", email],
  );
  await f.admin.query("update members set auth_user_id = $2 where id = $1", [p.id, uid]);
}
async function setup(tag: string, o: { email?: string; state?: "new" | "asking" | "ticketed" | "declined" } = {}) {
  const w = await world(f, tag);
  const a = await guest(f, w, "山田", w.gA);
  if (o.email) await giveEmail(a, o.email);
  const rid = await request(f, w, w.gA, a, {
    title: "見積もりの依頼",
    body: "秘密の依頼本文",
    state: o.state ?? "new",
  });
  return { w, a, rid };
}

describe("K-893 届け先を変える（updateClientRequest）", () => {
  it("K893-API-001 変える：200・答えの鍵は route_name だけで新しい届け先の名前・DB の routed_scope_id が替わる・証跡 client_request.route_changed が 1 行で payload は request_id・from・to だけ。メールも受け箱も 0", async () => {
    const { w, a, rid } = await setup("001");
    await perm(f, w, w.staff, w.otherScope);
    const r = await patch(rid, { route_id: w.otherScope }, w.staff);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
    const d = await data(r);
    expect(Object.keys(d)).toEqual(["route_name"]);
    expect(d["route_name"]).toBe("経理");
    expect(await routeOf(rid)).toBe(w.otherScope);
    expect(await audit(w, "client_request.route_changed")).toEqual([
      { request_id: rid, from: w.reqScope, to: w.otherScope },
    ]);
    expect(mails.length).toBe(0);
    expect(await inbox(f, a.id, "client_request.replied")).toBe(0);
  });

  it("K893-API-002 冪等：同じ届け先を送ると 200・何も変わらず証跡も増えない。ゲストのグループの届け先（既定）に戻すのも通る", async () => {
    const { w, rid } = await setup("002");
    expect((await patch(rid, { route_id: w.reqScope }, w.staff)).status).toBe(200);
    expect((await audit(w, "client_request.route_changed")).length).toBe(0);
    await perm(f, w, w.staff, w.otherScope);
    await patch(rid, { route_id: w.otherScope }, w.staff);
    await perm(f, w, w.boss, null);
    expect((await patch(rid, { route_id: w.otherScope }, w.boss)).status).toBe(200);
    expect((await audit(w, "client_request.route_changed")).length).toBe(1);
    expect((await patch(rid, { route_id: w.reqScope }, w.boss)).status).toBe(200);
  });

  it("K893-API-003 入力：届け先 id が無い・空・uuid でない・知らない欄・uuid でない道の :id はどれも 422・何も変えない", async () => {
    const { w, rid } = await setup("003");
    for (const b of [
      {},
      { route_id: "" },
      { route_id: "x" },
      { route_id: 5 },
      { route_id: w.reqScope, state: "done" },
    ]) {
      expect((await patch(rid, b, w.staff)).status, JSON.stringify(b)).toBe(422);
    }
    expect((await patch("not-a-uuid", { route_id: w.reqScope }, w.staff)).status).toBe(422);
    expect(await routeOf(rid)).toBeNull();
  });

  it("K893-API-004 失敗：選べない届け先（消した・別の会社・知らない id・見ている人が edit できないグループ）は 404・E-GST-111・正本の文・欄・details なし・何も変えない", async () => {
    const { w, rid } = await setup("004");
    const o = await world(f, "004 別の会社");
    const gone = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id, deleted_at) values ($1, '消した部', 'XD', $2, now()) returning id",
        [w.tenantId, w.root],
      )
    ).rows[0]!.id;
    for (const id of [gone, o.reqScope, NO_SUCH, w.otherScope])
      await refused(await patch(rid, { route_id: id }, w.staff), 404, "E-GST-111");
    expect(await routeOf(rid)).toBeNull();
    expect((await audit(w, "client_request.route_changed")).length).toBe(0);
  });

  it("K893-API-005 失敗：もう決まっている（チケットにした・断った）依頼の届け先を変えるは 409・E-GST-110・欄・details なし・何も変えない", async () => {
    const { w, a } = await setup("005");
    await perm(f, w, w.staff, w.otherScope);
    for (const state of ["ticketed", "declined"] as const) {
      const rid = await request(f, w, w.gA, a, { state });
      await refused(await patch(rid, { route_id: w.otherScope }, w.staff), 409, "E-GST-110");
      expect(await routeOf(rid)).toBeNull();
    }
  });

  it("K893-API-006 失敗：見えない依頼（別のグループの人・消した・別の会社・前の取引先の形・知らない id）は 404・E-GST-100・欄・details なし・何も変えない", async () => {
    const { w, a, rid } = await setup("006");
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
    await refused(await patch(rid, { route_id: w.otherScope }, w.outsider), 404, "E-GST-100");
    for (const id of [dead, legacy, NO_SUCH])
      await refused(await patch(id, { route_id: w.reqScope }, w.boss), 404, "E-GST-100");
    expect(await routeOf(rid)).toBeNull();
  });

  it("K893-API-007 守り（変える権限）：届け先で edit できる人・管理者は 200。読むだけの人は 403・FORBIDDEN。ゲストの文脈は 403・ログインしていない人は 401", async () => {
    const { w, a, rid } = await setup("007");
    await perm(f, w, w.staff, w.otherScope);
    expect((await patch(rid, { route_id: w.otherScope }, w.viewer)).status).toBe(403);
    expect((await patch(rid, { route_id: w.otherScope }, a, "client")).status).toBe(403);
    expect((await patch(rid, { route_id: w.otherScope }, null)).status).toBe(401);
    expect(await routeOf(rid)).toBeNull();
    expect((await patch(rid, { route_id: w.otherScope }, w.staff)).status).toBe(200);
  });

  it("K893-API-008 変えた後の読み：元の届け先の人の読みから消え（404）、新しい届け先の人に出る。変えた本人が新しい届け先を見られなければ 200 のあと 404", async () => {
    const { w, rid } = await setup("008");
    await perm(f, w, w.staff, w.otherScope);
    const view = (p: Person) => f.req("GET", `/client_requests/${rid}`, { headers: f.as(p, "member") });
    expect((await view(w.staff)).status).toBe(200);
    expect((await view(w.outsider)).status).toBe(404);
    expect((await patch(rid, { route_id: w.otherScope }, w.staff)).status).toBe(200);
    expect((await view(w.outsider)).status).toBe(200);
    expect((await view(w.staff)).status, "営業の人は経理の届け先を見られない").toBe(404);
  });

  it("K893-API-009 守り（G-14）：変えた直後、元の届け先の人は返事も届け先の変更もできない（404）", async () => {
    const { w, rid } = await setup("009");
    await perm(f, w, w.staff, w.otherScope);
    await patch(rid, { route_id: w.otherScope }, w.staff);
    await refused(await reply(rid, { body: "元の届け先から" }, w.staff), 404, "E-GST-100");
    await refused(await patch(rid, { route_id: w.reqScope }, w.staff), 404, "E-GST-100");
    expect(await msgs(rid)).toBe(0);
  });
});

describe("K-893 返事を送る（replyToClientRequest）", () => {
  it("K893-API-010 返事：201・答えの鍵は state だけで asking・DB は company・message・書いた人は自分・本文は前後の空白が取れている・依頼は new から asking。asking の依頼に返してもそのまま asking・返事が増える", async () => {
    const { w, rid } = await setup("010");
    const r = await reply(rid, { body: "  いつまでですか  " }, w.staff);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(Object.keys(await data(r))).toEqual(["state"]);
    expect((await data(r))["state"]).toBe("asking");
    const row = (
      await f.admin.query<{ side: string; kind: string; author_member_id: string; body: string }>(
        "select side, kind, author_member_id, body from client_request_messages where client_request_id = $1",
        [rid],
      )
    ).rows[0]!;
    expect(row).toEqual({ side: "company", kind: "message", author_member_id: w.staff.id, body: "いつまでですか" });
    expect(await stateOf(rid)).toBe("asking");
    expect((await reply(rid, { body: "もう 1 つ" }, w.staff)).status).toBe(201);
    expect(await stateOf(rid)).toBe("asking");
    expect(await msgs(rid)).toBe(2);
  });

  it("K893-API-011 入力：返事が空・空白だけ・全角空白だけ・数字・欄が無い・知らない欄・uuid でない道の :id はどれも 422・何も書かない。全角英数は NFKC の字で入る", async () => {
    const { w, rid } = await setup("011");
    for (const b of [
      { body: "" },
      { body: "   " },
      { body: "　" },
      { body: 9 },
      {},
      { body: "x", side: "guest" },
      { body: "x", author_member_id: w.boss.id },
    ]) {
      expect((await reply(rid, b, w.staff)).status, JSON.stringify(b)).toBe(422);
    }
    expect((await reply("not-a-uuid", { body: "x" }, w.staff)).status).toBe(422);
    expect(await msgs(rid)).toBe(0);
    expect((await reply(rid, { body: "ＡＢＣ　１２３" }, w.staff)).status).toBe(201);
    expect(
      (
        await f.admin.query<{ body: string }>("select body from client_request_messages where client_request_id = $1", [
          rid,
        ])
      ).rows[0]!.body,
    ).toBe("ABC 123");
  });

  it("K893-API-012 失敗：もう決まっている依頼に返事は 409・E-GST-110・何も書かない・受け箱もメールも 0", async () => {
    const { w, a } = await setup("012", { email: `done-${randomUUID().slice(0, 6)}@guest.example` });
    for (const state of ["ticketed", "declined"] as const) {
      const rid = await request(f, w, w.gA, a, { state });
      await refused(await reply(rid, { body: "遅れた返事" }, w.staff), 409, "E-GST-110");
      expect(await msgs(rid)).toBe(0);
    }
    expect(await inbox(f, a.id, "client_request.replied")).toBe(0);
    expect(mails.filter((m) => m.subject.includes("返事")).length).toBe(0);
  });

  it("K893-API-013 守り（返事の権限・見えない依頼）：読むだけの人は 403・見えない依頼は 404・E-GST-100・ゲストの文脈は 403・ログインなしは 401・何も書かない", async () => {
    const { w, a, rid } = await setup("013");
    expect((await reply(rid, { body: "読むだけ" }, w.viewer)).status).toBe(403);
    await refused(await reply(rid, { body: "別のグループ" }, w.outsider), 404, "E-GST-100");
    await refused(await reply(NO_SUCH, { body: "無い" }, w.boss), 404, "E-GST-100");
    expect((await reply(rid, { body: "ゲスト" }, a, "client")).status).toBe(403);
    expect((await reply(rid, { body: "誰か" }, null)).status).toBe(401);
    expect(await msgs(rid)).toBe(0);
  });

  it("K893-API-014 受け箱：出し手の受け箱に 1 件（inapp・client_request.replied・payload は request_id と ref だけ・dedupe_key は種類と書き込みと出し手）。同じグループの別のゲスト・社内の人には入らない。出し手が抜けた人なら入らず返事は書く", async () => {
    const { w, a, rid } = await setup("014");
    const other = await guest(f, w, "同じグループの鈴木", w.gA);
    const r = await reply(rid, { body: "秘密の返事本文" }, w.staff);
    expect(r.status).toBe(201);
    const mid = (
      await f.admin.query<{ id: string }>("select id from client_request_messages where client_request_id = $1", [rid])
    ).rows[0]!.id;
    expect(await inbox(f, a.id, "client_request.replied")).toBe(1);
    expect(await inbox(f, other.id, "client_request.replied")).toBe(0);
    expect(await inbox(f, w.staff.id, "client_request.replied")).toBe(0);
    const row = (
      await f.admin.query<{ payload: Json; dedupe_key: string }>(
        "select payload, dedupe_key from notifications where member_id = $1 and event_kind_id = 'client_request.replied'",
        [a.id],
      )
    ).rows[0]!;
    expect(row.payload).toEqual({ request_id: rid, ref: mid });
    expect(JSON.stringify(row.payload)).not.toContain("秘密の返事本文");
    expect(row.dedupe_key).toBe(`client_request.replied:${mid}:${a.id}`);
    await f.admin.query("update members set deleted_at = now() where id = $1", [a.id]);
    expect((await reply(rid, { body: "抜けたあと" }, w.staff)).status).toBe(201);
    expect(await inbox(f, a.id, "client_request.replied")).toBe(1);
    expect(await msgs(rid)).toBe(2);
  });

  it("K893-API-015 メール（D-128.103）：宛先が分かれば 1 通・件名は「Kaname：依頼に返事が届きました」・本文は依頼の画面へのリンクだけ（返事の本文・依頼の題・依頼の本文・社内の人の名前を載せない）。受け箱に email の行が sent_at 付き。宛先が分からなければ送らず記録もしない", async () => {
    const addr = `a-${randomUUID().slice(0, 6)}@guest.example`;
    const { w, rid } = await setup("015", { email: addr });
    const before = mails.length;
    expect((await reply(rid, { body: "返事の本文は載せない" }, w.staff)).status).toBe(201);
    const sent = mails.slice(before);
    expect(sent.length).toBe(1);
    expect(sent[0]!.to).toBe(addr);
    expect(sent[0]!.subject).toBe("Kaname：依頼に返事が届きました");
    expect(sent[0]!.text).toContain(`/portal/requests/${rid}`);
    for (const secret of ["返事の本文は載せない", "見積もりの依頼", "秘密の依頼本文", "営業の人"])
      expect(sent[0]!.text + sent[0]!.subject, secret).not.toContain(secret);
    const rows = (await emailRows(rid)).rows;
    expect(rows.length).toBe(1);
    expect(rows[0]!.sent_at).not.toBeNull();
    expect(rows[0]!.failed_at).toBeNull();
    const none = await setup("015 宛先なし");
    const b2 = mails.length;
    expect((await reply(none.rid, { body: "宛先が無い" }, none.w.staff)).status).toBe(201);
    expect(mails.length).toBe(b2);
    expect((await emailRows(none.rid)).rows.length).toBe(0);
  });

  it("K893-API-016 失敗（手順 2 のメール）[残る]：201・返事の行と inapp の受け箱は残り、email の行に failed_at が付く。送り直しは自動ではしない", async () => {
    const { w, a, rid } = await setup("016", { email: `f-${randomUUID().slice(0, 6)}@guest.example` });
    mailer.fail = true;
    try {
      expect((await reply(rid, { body: "メールが落ちる" }, w.staff)).status).toBe(201);
    } finally {
      mailer.fail = false;
    }
    expect(await msgs(rid)).toBe(1);
    expect(await inbox(f, a.id, "client_request.replied")).toBe(1);
    const rows = (await emailRows(rid)).rows;
    expect(rows.length).toBe(1);
    expect(rows[0]!.failed_at).not.toBeNull();
    expect(rows[0]!.sent_at).toBeNull();
  });

  it("K893-API-017 失敗（手順 3 の記録）：メールの結果を書けなくても 201・返事は残る・答えに宛ては出ない", async () => {
    const addr = `r-${randomUUID().slice(0, 6)}@guest.example`;
    const { w, rid } = await setup("017", { email: addr });
    await failOn(f, "notifications", "new.channel_id = 'email'", async () => {
      const r = await reply(rid, { body: "記録が落ちる" }, w.staff);
      expect(r.status).toBe(201);
      expect(JSON.stringify(await asJson(r))).not.toContain(addr);
    });
    expect(await msgs(rid)).toBe(1);
    expect((await emailRows(rid)).rows.length).toBe(0);
  });

  it("K893-API-018 守り（証跡）：返事で client_request.replied が 1 行・payload は request_id と message_id だけ（本文は無い）。断られた返事は書かない", async () => {
    const { w, rid } = await setup("018");
    await reply(rid, { body: "" }, w.staff);
    await reply(rid, { body: "読むだけ" }, w.viewer);
    expect((await reply(rid, { body: "証跡の本文" }, w.staff)).status).toBe(201);
    const mid = (
      await f.admin.query<{ id: string }>("select id from client_request_messages where client_request_id = $1", [rid])
    ).rows[0]!.id;
    expect(await audit(w, "client_request.replied")).toEqual([{ request_id: rid, message_id: mid }]);
  });

  it("K893-API-019 失敗（手順 1 の途中）：受け箱の行を書けなければ 503・E-PAGE-003・返事の行も状態の変更も証跡も残らない（1 つの取引）・本文は答えに出ない", async () => {
    const { w, rid } = await setup("019");
    await failOn(f, "notifications", "new.event_kind_id = 'client_request.replied'", async () => {
      const r = await reply(rid, { body: "落ちる本文" }, w.staff);
      expect(r.status).toBe(503);
      const j = await asJson(r);
      expect(j["code"]).toBe("E-PAGE-003");
      expect(JSON.stringify(j)).not.toContain("落ちる本文");
    });
    expect(await msgs(rid)).toBe(0);
    expect(await stateOf(rid)).toBe("new");
    expect((await audit(w, "client_request.replied")).length).toBe(0);
    expect((await reply(rid, { body: "直った" }, w.staff)).status).toBe(201);
  });

  it("K893-API-020 操作の揺れ：同じ冪等キーで 2 回は返事 1 つ・メール 1 通・同じ答え。キーが違う 2 本は 2 つ", async () => {
    const addr = `i-${randomUUID().slice(0, 6)}@guest.example`;
    const { w, rid } = await setup("020", { email: addr });
    const before = mails.length;
    const key = { "idempotency-key": randomUUID() };
    const [r1, r2] = [
      await reply(rid, { body: "二度押し" }, w.staff, "member", key),
      await reply(rid, { body: "二度押し" }, w.staff, "member", key),
    ];
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(await msgs(rid)).toBe(1);
    expect(mails.length - before).toBe(1);
    const [r3, r4] = await Promise.all([
      reply(rid, { body: "同時" }, w.staff, "member", { "idempotency-key": randomUUID() }),
      reply(rid, { body: "同時" }, w.staff, "member", { "idempotency-key": randomUUID() }),
    ]);
    expect([r3.status, r4.status]).toEqual([201, 201]);
    expect(await msgs(rid)).toBe(3);
  });

  it("K893-API-021 操作の揺れ：返事と同時に依頼が決まると、決まった後の返事は 409・E-GST-110（依頼の行を for update で取って順に処理する）。決まった依頼に返事は入らない", async () => {
    const { w, a } = await setup("021");
    const rid = await request(f, w, w.gA, a, {});
    await f.admin.query("update client_requests set state = 'declined', decline_reason = '先に断った' where id = $1", [
      rid,
    ]);
    await refused(await reply(rid, { body: "あとから" }, w.staff), 409, "E-GST-110");
    expect(await msgs(rid)).toBe(0);
    const rid2 = await request(f, w, w.gA, a, {});
    const results = await Promise.all([
      reply(rid2, { body: "同時の返事" }, w.staff),
      f.admin.query("update client_requests set state = 'declined', decline_reason = '同時に断った' where id = $1", [
        rid2,
      ]),
    ]);
    const status = (results[0] as Response).status;
    expect([201, 409]).toContain(status);
    expect(await msgs(rid2)).toBe(status === 201 ? 1 : 0);
  });

  it("K893-API-022 守り（上限）：同じ人が上限を超えたら 429・retry_after_sec は 1〜60 の整数・no-store", async () => {
    const { w, rid } = await setup("022");
    for (const [op, call] of [
      ["updateClientRequest", () => patch(rid, { route_id: w.reqScope }, w.staff)],
      ["replyToClientRequest", () => reply(rid, { body: "上限" }, w.staff)],
    ] as const) {
      f.limits[op] = 2;
      try {
        const rs = [];
        for (let i = 0; i < 3; i++) rs.push(await call());
        expect(rs[2]!.status, op).toBe(429);
        const j = await asJson(rs[2]!);
        expect(Number.isInteger(j["retry_after_sec"])).toBe(true);
        expect(j["retry_after_sec"] as number).toBeGreaterThanOrEqual(1);
        expect(j["retry_after_sec"] as number).toBeLessThanOrEqual(60);
        expect(rs[2]!.headers.get("cache-control") ?? "").toContain("no-store");
      } finally {
        delete f.limits[op];
      }
    }
  });

  it("K893-API-023 守り（no-store）：200・201・404・409 の答えに Cache-Control の private か no-store が付く", async () => {
    const { w, a, rid } = await setup("023");
    const done = await request(f, w, w.gA, a, { state: "declined" });
    for (const r of [
      await patch(rid, { route_id: w.reqScope }, w.staff),
      await reply(rid, { body: "答え" }, w.staff),
      await reply(NO_SUCH, { body: "x" }, w.boss),
      await reply(done, { body: "x" }, w.staff),
    ]) {
      expect(r.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
    }
  });

  it("K893-API-024 守り：返事の行は side company で、ゲストの文脈の直の select は 0 行（読む守りはゲスト側の葉 K-907・K-908 が足すまで足さない）", async () => {
    const { w, a, rid } = await setup("024");
    await reply(rid, { body: "返事" }, w.staff);
    const seen = await (
      await import("@kaname/db/context")
    ).withTenant(
      f.pool,
      { tenantId: w.tenantId, userId: a.id, role: "client", stepUpAt: null },
      async (cl) =>
        (await cl.query("select id from client_request_messages where client_request_id = $1", [rid])).rowCount ?? 0,
    );
    expect(seen).toBe(0);
    expect(
      (
        await f.admin.query<{ side: string }>("select side from client_request_messages where client_request_id = $1", [
          rid,
        ])
      ).rows[0]!.side,
    ).toBe("company");
  });
});
