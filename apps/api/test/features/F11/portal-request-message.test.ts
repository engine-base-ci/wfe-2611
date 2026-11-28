// K-908「依頼のやり取りに書く口（postPortalRequestMessage）」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン）。行 ID（K908-API-…）は 11_tickets/K-908.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/portal-request-message.ts の register（K-326）。
// 試験が決める口の形（契約は 05_flow/screen_api.py の前からある 1 行を直す）:
//   postPortalRequestMessage POST /api/v1/portal/requests/:id/messages  body { body: string（1〜10000 字・空白だけは 422・NUL は 422）}（知らない欄は 422。返事に添付は付けない）
//     201 { data: { id } }。DB：client_request_messages に 1 行（side guest・kind message・body・author_member_id＝本人）＋ 証跡 portal.request_message
//     自分のゲストのグループの依頼で、state が new・asking（open）のときだけ書ける。ticketed・declined は 409・E-GST-170（何も書かない）
//     state が asking（会社が聞いている）なら、書いたら new に戻す（聞かれたことに答えた）
//     届け先（依頼の routed_scope_id が在ればそのグループ・無ければゲストのグループの request_scope_id）の人（消していない・止めていない・ゲストでない）の受け箱 1 件（inapp・client_request.replied・payload は request_id・url だけ）
//       届け先に人がいなければ会社の管理者へ。メールはリンクだけ（ゲストの字を載せない・出した本人に送らない）。メールが送れなくても書き込みは残る
//     同じ人が同じ依頼に同じ本文を 30 秒以内にもう一度書いたら、新しい行を作らず前の id を 201 で返す
//     自分のグループでない・別の会社・消した・無い依頼は 404（NOT_FOUND・欄なし）。ゲストでない人は 403・社内の人は入口の 403・ログインなしは 401
// DB（migration 20261127100800_portal_request_message.sql）: app.portal_request_post(id, body)（security definer）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeFixture, type Fixture } from "../fixture.js";
import {
  asG,
  asJson,
  asM,
  count,
  failOn,
  guest,
  hasNoDetail,
  inbox,
  mails,
  make,
  n,
  request,
  requestMsg,
  useHooks,
  world,
  type Json,
  type P,
  type World,
} from "./portal-world.js";

let f: Fixture;
beforeAll(async () => {
  f = await makeFixture([]);
  await useHooks(f, "portal-request-message");
  await useHooks(f, "portal-request"); // 読み直しは K-907 の口（getPortalRequest）で見る
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const NO_SUCH = "00000000-0000-4000-8000-0000000000dd";
const SECRET = "ゲストのひみつの返事";
const send = (p: P | null, id: string, body: unknown, role: "client" | "member" = "client") =>
  f.req("POST", `/portal/requests/${id}/messages`, {
    body,
    ...(p ? { headers: role === "client" ? asG(f, p) : asM(f, p) } : {}),
  });
const read = (p: P, id: string) => f.req("GET", `/portal/requests/${id}`, { headers: asG(f, p) });
const idOf = async (r: Response): Promise<string> => ((await asJson(r)).data as { id: string }).id;
const rows = (id: string) => count(f, "client_request_messages", "client_request_id = $1", [id]);
const stateOf = async (id: string) =>
  (await f.admin.query<{ state: string }>("select state from client_requests where id = $1", [id])).rows[0]!.state;
async function open(
  tag: string,
  o: { state?: string; withFirst?: boolean } = {},
): Promise<{ w: World; a: P; rid: string }> {
  const w = await world(f, tag);
  const a = await guest(f, w, "山田", w.gA);
  const rid = await request(f, w, w.gA, a, { state: o.state });
  if (o.withFirst !== false) await requestMsg(f, w, rid, "guest", a, "最初の依頼です", { ago: "1 hour" });
  return { w, a, rid };
}

describe("K-908 返事を書く（postPortalRequestMessage）", () => {
  it("K908-API-001 書く：201・鍵は id だけ。DB はやり取りに 1 行（side guest・kind message・本文・author は本人）・証跡 portal.request_message 1 行。読み直すと最後に自分の返事が並ぶ", async () => {
    const { w, a, rid } = await open("001");
    const r = await send(a, rid, { body: "宛先は山田様です" });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(Object.keys((await asJson(r)).data as Json)).toEqual(["id"]);
    const id = await idOf(r);
    const row = (
      await f.admin.query("select side, kind, body, author_member_id from client_request_messages where id = $1", [id])
    ).rows[0];
    expect(row).toEqual({ side: "guest", kind: "message", body: "宛先は山田様です", author_member_id: a.id });
    expect(await count(f, "audit_events", "tenant_id = $1 and action = 'portal.request_message'", [w.tenantId])).toBe(
      1,
    );
    const d = (await asJson(await read(a, rid))).data as { messages: { id: string; side: string; text: string }[] };
    expect(d.messages.at(-1)).toMatchObject({ id, side: "they", text: "宛先は山田様です" });
  });

  it("K908-API-002 入力の形（422）：本文が空・空白だけ・10001 字・文字でない・NUL を含む・知らない欄（attachment_ids・side）・体が空。何も書かない。10000 字ちょうどは通る", async () => {
    const { a, rid } = await open("002");
    const before = await rows(rid);
    for (const b of [
      { body: "" },
      { body: " \n　" },
      { body: "あ".repeat(10_001) },
      { body: 3 },
      { body: "a\u0000b" },
      { body: "ok", attachment_ids: [] },
      { body: "ok", side: "company" },
      {},
      "text",
    ])
      expect((await send(a, rid, b)).status, JSON.stringify(b).slice(0, 60)).toBe(422);
    expect(await rows(rid)).toBe(before);
    expect((await send(a, rid, { body: "あ".repeat(10_000) })).status).toBe(201);
  });

  it("K908-API-003 状態：new と asking の依頼には書ける。チケットになった（ticketed）・断った（declined）依頼は 409・E-GST-170（欄なし）で何も書かない・知らせも出さない", async () => {
    const w = await world(f, "003");
    const a = await guest(f, w, "山田", w.gA);
    const t = (
      await f.admin.query<{ id: string }>(
        `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title) select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'), (select id from ticket_stages where tenant_id = $1 and key = 'todo'), 't' returning id`,
        [w.tenantId, w.root],
      )
    ).rows[0]!.id;
    for (const [state, o] of [
      ["new", {}],
      ["asking", { state: "asking" }],
    ] as const) {
      const rid = await request(f, w, w.gA, a, o as never);
      expect((await send(a, rid, { body: `${state} に書く` })).status, state).toBe(201);
    }
    const before = await inbox(f, w.staff.id, "client_request.replied");
    for (const o of [{ ticketId: t }, { state: "declined" }]) {
      const rid = await request(f, w, w.gA, a, o as never);
      const r = await send(a, rid, { body: "もう書けない" });
      expect(r.status, JSON.stringify(o)).toBe(409);
      const j = await asJson(r);
      expect(j["code"]).toBe("E-GST-170");
      expect(hasNoDetail(j)).toBe(true);
      expect(await rows(rid)).toBe(0);
    }
    expect(await inbox(f, w.staff.id, "client_request.replied")).toBe(before);
  });

  it("K908-API-004 聞かれたことに答える：state が asking の依頼に書くと new に戻る。new の依頼は new のまま。ticket_id・ほかの欄は変わらない", async () => {
    const w = await world(f, "004");
    const a = await guest(f, w, "山田", w.gA);
    const asking = await request(f, w, w.gA, a, { state: "asking" });
    const fresh = await request(f, w, w.gA, a, {});
    expect((await send(a, asking, { body: "お答えします" })).status).toBe(201);
    expect((await send(a, fresh, { body: "補足です" })).status).toBe(201);
    expect(await stateOf(asking)).toBe("new");
    expect(await stateOf(fresh)).toBe("new");
    expect(
      (await f.admin.query("select ticket_id, decline_reason from client_requests where id = $1", [asking])).rows[0],
    ).toEqual({ ticket_id: null, decline_reason: null });
  });

  it("K908-API-005 書ける範囲：同じグループの別のゲストが出した依頼にも書ける。別のグループのゲスト・別の会社のゲストは 404（NOT_FOUND・欄なし）・消した依頼・無い id も 404。404 では何も書かない", async () => {
    const { w, rid, a } = await open("005");
    const [a2, b1] = [await guest(f, w, "乙", w.gA), await guest(f, w, "丙", w.gB)];
    const o = await world(f, "005x");
    const og = await guest(f, o, "他社", o.gA);
    const gone = await request(f, w, w.gA, a, {});
    await f.admin.query("update client_requests set deleted_at = now() where id = $1", [gone]);
    expect((await send(a2, rid, { body: "同じグループの別の人です" })).status).toBe(201);
    const before = await rows(rid);
    for (const [who, id] of [
      [b1, rid],
      [og, rid],
      [a, gone],
      [a, NO_SUCH],
    ] as [P, string][]) {
      const r = await send(who, id, { body: "書く" });
      expect(r.status, id).toBe(404);
      const j = await asJson(r);
      expect(j["code"]).toBe("NOT_FOUND");
      expect(hasNoDetail(j)).toBe(true);
    }
    expect(await rows(rid)).toBe(before);
    expect(await rows(gone)).toBe(0);
  });

  it("K908-API-006 知らせ（受け箱）：届け先の人に 1 件ずつ（client_request.replied・payload は request_id と url だけ）。依頼に届け先の変更（routed_scope_id）があればそちらのグループの人へ（元の届け先には入らない）。届け先に人がいなければ管理者へ。止めた人・ゲスト・出した本人には入らない", async () => {
    const { w, a, rid } = await open("006");
    expect((await send(a, rid, { body: `${SECRET}です` })).status).toBe(201);
    expect(await inbox(f, w.staff.id, "client_request.replied")).toBe(1);
    for (const p of [a, w.boss]) expect(await inbox(f, p.id, "client_request.replied"), p.id).toBe(0);
    const payload = (
      await f.admin.query<{ payload: Json }>(
        "select payload from notifications where member_id = $1 and event_kind_id = 'client_request.replied'",
        [w.staff.id],
      )
    ).rows[0]!.payload;
    expect(Object.keys(payload).sort()).toEqual(["request_id", "url"]);
    expect(JSON.stringify(payload)).not.toContain(SECRET);
    // 届け先を変えた依頼
    const keiri = (
      await f.admin.query<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, '経理', 'PK', $2) returning id",
        [w.tenantId, w.root],
      )
    ).rows[0]!.id;
    const keiriMan = await make(f, w.tenantId, keiri, "経理の人", { ability: "edit" });
    await f.admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, true, 'manager')",
      [w.tenantId, keiriMan.id, keiri],
    );
    const moved = await request(f, w, w.gA, a, { routed: keiri });
    expect((await send(a, moved, { body: "経理さんへ" })).status).toBe(201);
    expect(await inbox(f, keiriMan.id, "client_request.replied")).toBe(1);
    expect(await inbox(f, w.staff.id, "client_request.replied")).toBe(1);
    // 届け先に人がいない・止めた人だけ
    await f.admin.query("update tenant_memberships set status = 'suspended' where member_id = $1", [keiriMan.id]);
    expect((await send(a, moved, { body: "もう一度" })).status).toBe(201);
    expect(await inbox(f, w.boss.id, "client_request.replied")).toBe(1);
    expect(await inbox(f, keiriMan.id, "client_request.replied")).toBe(1);
  });

  it("K908-API-007 メール：届け先の人にリンクだけ（ゲストの書いた字を載せない）・出した本人に送らない。送れなくても 201・書き込みも受け箱の行も残る", async () => {
    const { w, a, rid } = await open("007");
    const from = mails.length;
    expect((await send(a, rid, { body: `${SECRET}1` })).status).toBe(201);
    const sent = mails.slice(from).filter((m) => m.to === w.staff.email);
    expect(sent.length).toBeGreaterThanOrEqual(1);
    for (const m of sent) {
      expect(m.subject + m.text).not.toContain(SECRET);
      expect(m.text).toContain(`/requests/${rid}`);
    }
    expect(mails.slice(from).filter((m) => m.to === a.email)).toEqual([]);
    await useHooks(f, "portal-request-message", {
      mailer: async () => {
        throw new Error("送れない");
      },
    });
    const r = await send(a, rid, { body: "送れないときの返事" });
    expect(r.status).toBe(201);
    expect(await count(f, "client_request_messages", "id = $1", [await idOf(r)])).toBe(1);
    expect(await inbox(f, w.staff.id, "client_request.replied")).toBe(2);
    await useHooks(f, "portal-request-message");
  });

  it("K908-API-008 二重に書く：同じ人が同じ依頼に同じ本文を 30 秒以内にもう一度書くと、新しい行を作らず前の id を 201 で返す（行も受け箱も増えない）。本文が違えば別の行", async () => {
    const { w, a, rid } = await open("008");
    const first = await idOf(await send(a, rid, { body: "お願いします" }));
    expect(await idOf(await send(a, rid, { body: "お願いします" }))).toBe(first);
    expect(await rows(rid)).toBe(2); // 最初の依頼 + この 1 行
    expect(await inbox(f, w.staff.id, "client_request.replied")).toBe(1);
    expect(await idOf(await send(a, rid, { body: "追伸です" }))).not.toBe(first);
    expect(await rows(rid)).toBe(3);
  });

  it("K908-API-009 入口：社内の人は 403・ログインなしは 401・グループに入っていないゲストは 403。外した直後（G-14）：抜けた・止めた・外された・グループが消えたゲストは 403（FORBIDDEN）で何も書かない", async () => {
    const { w, rid } = await open("009");
    const free = await guest(f, w, "どこにも入っていない", null);
    expect((await send(w.boss, rid, { body: "x" }, "member")).status).toBe(403);
    expect((await send(null, rid, { body: "x" })).status).toBe(401);
    expect((await send(free, rid, { body: "x" })).status).toBe(403);
    const cuts: [string, (id: string) => Promise<unknown>][] = [
      ["抜けた", (id) => f.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [id])],
      [
        "止めた",
        (id) => f.admin.query("update tenant_memberships set status = 'suspended' where member_id = $1", [id]),
      ],
      [
        "外された",
        (id) => f.admin.query("update guest_group_members set deleted_at = now() where member_id = $1", [id]),
      ],
    ];
    for (const [label, cut] of cuts) {
      const p = await guest(f, w, label, w.gA);
      expect((await send(p, rid, { body: label })).status, `${label}の前`).toBe(201);
      await cut(p.id);
      expect((await send(p, rid, { body: `${label}の後` })).status, label).toBe(403);
    }
    const lone = await guest(f, w, "消える社", w.gB);
    await f.admin.query("update guest_groups set deleted_at = now() where id = $1", [w.gB]);
    expect((await send(lone, rid, { body: "x" })).status).toBe(403);
    expect(await count(f, "client_request_messages", "client_request_id = $1 and body like '%の後'", [rid])).toBe(0);
  });

  it("K908-API-010 上限：同じ人が上限を超えたら 429・retry_after_sec は 1〜60 の整数・no-store・超えた分は何も書かない", async () => {
    const { a, rid } = await open("010");
    f.limits["postPortalRequestMessage"] = 2;
    try {
      expect((await send(a, rid, { body: "一" })).status).toBe(201);
      expect((await send(a, rid, { body: "二" })).status).toBe(201);
      const r = await send(a, rid, { body: "三" });
      expect(r.status).toBe(429);
      const s = (await asJson(r))["retry_after_sec"] as number;
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
      expect(r.headers.get("cache-control") ?? "").toContain("no-store");
      expect(await rows(rid)).toBe(3);
    } finally {
      delete f.limits["postPortalRequestMessage"];
    }
  });

  it("K908-API-011 途中の失敗：証跡が書けなければ 503・E-PAGE-003・書き込みも state の戻しも受け箱の行も残らない（1 つの取引）", async () => {
    const { w, a, rid } = await open("011", { state: "asking" });
    const before = await rows(rid);
    await failOn(f, "audit_events", "new.action = 'portal.request_message'", async () => {
      const r = await send(a, rid, { body: "失敗する返事" });
      expect(r.status).toBe(503);
      expect((await asJson(r))["code"]).toBe("E-PAGE-003");
    });
    expect(await rows(rid)).toBe(before);
    expect(await stateOf(rid)).toBe("asking");
    expect(await inbox(f, w.staff.id, "client_request.replied")).toBe(0);
  });

  it("K908-API-012 同時に書く：同じグループの 2 人が同時に別の本文を書くと、2 本とも 201 で 2 行できる（時刻の古い順に並ぶ・取り合いで落ちない）", async () => {
    const { w, a, rid } = await open("012");
    const b = await guest(f, w, "乙", w.gA);
    const [r1, r2] = await Promise.all([send(a, rid, { body: "同時の一" }), send(b, rid, { body: "同時の二" })]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(await rows(rid)).toBe(3);
  });

  it("K908-API-013 書いた字をそのまま入れる・返す：HTML・スクリプト・改行・絵文字を含む返事は、置き換えも省略もせず保存し、読み直しでも同じ字で返る", async () => {
    const { a, rid } = await open("013");
    const text = '<img src=x onerror="alert(1)">\n<script>x</script> 🙂 & "引用"';
    expect((await send(a, rid, { body: text })).status).toBe(201);
    const d = (await asJson(await read(a, rid))).data as { messages: { text: string }[] };
    expect(d.messages.at(-1)!.text).toBe(text);
  });

  it("K908-API-014 してはいけないことをしない：返事を書いても依頼の state（asking の戻し以外）・ticket_id・分身の仕事（bridge_jobs）・チケットは増えも変わりもしない。道の値が uuid でなければ 422", async () => {
    const { w, a, rid } = await open("014");
    const jobs = await n(f, "select count(*) as n from bridge_jobs where tenant_id = $1", [w.tenantId]);
    const tickets = await n(f, "select count(*) as n from tickets where tenant_id = $1", [w.tenantId]);
    expect((await send(a, rid, { body: "ただの返事" })).status).toBe(201);
    expect(await n(f, "select count(*) as n from bridge_jobs where tenant_id = $1", [w.tenantId])).toBe(jobs);
    expect(await n(f, "select count(*) as n from tickets where tenant_id = $1", [w.tenantId])).toBe(tickets);
    expect(await stateOf(rid)).toBe("new");
    expect((await send(a, "not-a-uuid", { body: "x" })).status).toBe(422);
  });
});
