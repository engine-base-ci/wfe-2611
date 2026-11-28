// K-907「依頼を出す・グループの依頼を読む口（createPortalRequest・getPortalRequest）」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン）。行 ID（K907-API-…）は 11_tickets/K-907.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/portal-request.ts の register（K-326）。
// 試験が決める口の形（契約は 05_flow/screen_api.py の前からある 2 行を直す）:
//   createPortalRequest POST /api/v1/portal/requests  body { body: string（1〜10000 字・空白だけは 422）, due_on: "YYYY-MM-DD" | null（今日より前は 422）, attachment_ids: uuid[]（0〜5）}（知らない欄は 422）
//     201 { data: { id } }。題 title は body の最初の空でない行（60 字まで）。DB：client_requests（guest_group_id＝自分のグループ・client_id は空・state new・created_by＝本人・最初の本文は依頼の行の body に置く＝やり取りの表 client_request_messages には 2 つ目以降が入る・K-892）
//     ＋ 添付（owner_type portal_draft → client_request・owner_id＝依頼）＋ 証跡 portal.request_created
//     ＋ 届け先の社内のグループの人（消していない・止めていない・ゲストでない）の受け箱 1 件（inapp・client_request.created・payload は request_id・url だけ＝ゲストの書いた字を載せない）
//       届け先に人がいなければ会社の管理者へ。メールは「リンクだけ」（ゲストの字を載せない）。メールが送れなくても依頼は残る
//     同じ人が同じ本文・同じ期限をすぐ（60 秒以内に）もう一度出したら、新しい依頼を作らず前の id を 201 で返す
//     添付が自分の下書きでない・無い・もう使われている・消した物なら 404・E-GST-160（何も作らない）
//   getPortalRequest    GET  /api/v1/portal/requests/:id   200 { data: { request: { id, title, from_name, group_name, created_at, state: "open"|"accepted"|"declined", declined_reason? }, messages: [{ id, side, name, at, text }], can_write } }
//     state＝new・asking→open／ticketed→accepted／declined→declined。declined_reason は断った依頼だけ。can_write＝open のときだけ true。messages の 1 件目は依頼の本文（出した人・依頼の時刻・id は依頼の id）で、続くのは client_request_messages の種類 message だけ・古い順。side は guest→they・company→we
//     自分のグループの依頼だけ（グループの別のゲストが出した物も）。別のグループ・別の会社・消した・無い id は 404（NOT_FOUND・欄なし）
//   ゲストでない人（役割 requester でない・グループが無い・止めた・抜けた・グループが消えた）は 403。社内の人は入口の 403・ログインなしは 401
// DB（migration 20261127100700_portal_request.sql）: app.portal_request_create(body, due, attachments)・app.portal_request_get(id)（security definer）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
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
  await useHooks(f, "portal-request");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const NO_SUCH = "00000000-0000-4000-8000-0000000000cc";
const SECRET = "ゲストのひみつの字";
const post = (p: P | null, body: unknown, role: "client" | "member" = "client") =>
  f.req("POST", "/portal/requests", { body, ...(p ? { headers: role === "client" ? asG(f, p) : asM(f, p) } : {}) });
const get = (p: P | null, id: string, role: "client" | "member" = "client") =>
  f.req("GET", `/portal/requests/${id}`, p ? { headers: role === "client" ? asG(f, p) : asM(f, p) } : {});
const idOf = async (r: Response): Promise<string> => ((await asJson(r)).data as { id: string }).id;
const draft = async (
  w: World,
  by: P,
  o: { owner?: string; type?: string; scanned?: boolean; deleted?: boolean } = {},
): Promise<string> =>
  (
    await f.admin.query<{ id: string }>(
      `insert into attachments (tenant_id, scope_id, owner_type, owner_id, storage_ref, mime, size, scanned_at, created_by, deleted_at)
       values ($1, $2, $3, $4, $5, 'application/pdf', 1000, $6, $7, $8) returning id`,
      [
        w.tenantId,
        w.reqScope,
        o.type ?? "portal_draft",
        o.owner ?? by.id,
        `tenants/${w.tenantId}/${randomUUID()}`,
        o.scanned === false ? null : new Date(),
        by.id,
        o.deleted ? new Date() : null,
      ],
    )
  ).rows[0]!.id;
const ok = { body: "12 月分の作業報告書をください\n宛先は山田様です", due_on: null, attachment_ids: [] as string[] };

describe("K-907 依頼を出す（createPortalRequest）", () => {
  it("K907-API-001 出す：201・鍵は id だけ。DB は依頼 1 行（guest_group_id が自分のグループ・client_id は空・state new・created_by は本人・body と due_on）・証跡 portal.request_created 1 行。やり取りの表には行を足さない（最初の本文は依頼の body）", async () => {
    const w = await world(f, "001");
    const a = await guest(f, w, "山田", w.gA);
    const r = await post(a, { ...ok, due_on: "2099-12-26" });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(Object.keys((await asJson(r)).data as Json)).toEqual(["id"]);
    const id = await idOf(r);
    const row = (
      await f.admin.query(
        "select guest_group_id, client_id, state, created_by, body, to_char(due_on, 'YYYY-MM-DD') as due from client_requests where id = $1",
        [id],
      )
    ).rows[0];
    expect(row).toMatchObject({
      guest_group_id: w.gA,
      client_id: null,
      state: "new",
      created_by: a.id,
      body: ok.body,
      due: "2099-12-26",
    });
    expect(await count(f, "client_request_messages", "client_request_id = $1", [id])).toBe(0);
    expect(await count(f, "audit_events", "tenant_id = $1 and action = 'portal.request_created'", [w.tenantId])).toBe(
      1,
    );
  });

  it("K907-API-002 題：本文の最初の空でない行（前後の空白を取る）。60 字を超えたら 60 字で切る。1 行だけの本文はその行", async () => {
    const w = await world(f, "002");
    const a = await guest(f, w, "山田", w.gA);
    const titleOf = async (body: string) =>
      (
        await f.admin.query<{ title: string }>("select title from client_requests where id = $1", [
          await idOf(await post(a, { ...ok, body })),
        ])
      ).rows[0]!.title;
    expect(await titleOf("\n\n  報告書をください  \n二行目")).toBe("報告書をください");
    expect(await titleOf("一行だけ")).toBe("一行だけ");
    expect(await titleOf("あ".repeat(100))).toBe("あ".repeat(60));
  });

  it("K907-API-003 入力の形（422）：本文が空・空白だけ・10001 字・文字でない・NUL を含む／期限の形が違う／添付が 6 つ・uuid でない／知らない欄。何も作らない。10000 字ちょうどは通る", async () => {
    const w = await world(f, "003");
    const a = await guest(f, w, "山田", w.gA);
    const before = await count(f, "client_requests", "tenant_id = $1", [w.tenantId]);
    const bad: unknown[] = [
      { ...ok, body: "" },
      { ...ok, body: " \n　 " },
      { ...ok, body: "あ".repeat(10_001) },
      { ...ok, body: 5 },
      { ...ok, body: "a\u0000b" },
      { ...ok, due_on: "12/26" },
      { ...ok, due_on: "2099-13-40" },
      { ...ok, attachment_ids: Array.from({ length: 6 }, () => randomUUID()) },
      { ...ok, attachment_ids: ["x"] },
      { ...ok, group_id: randomUUID() },
      { ...ok, state: "ticketed" },
      {},
      "text",
    ];
    for (const b of bad) {
      const r = await post(a, b);
      expect(r.status, JSON.stringify(b).slice(0, 80)).toBe(422);
    }
    expect(await count(f, "client_requests", "tenant_id = $1", [w.tenantId])).toBe(before);
    expect((await post(a, { ...ok, body: "あ".repeat(10_000) })).status).toBe(201);
  });

  it("K907-API-004 いつまでに：null と今日は通る・今日より前の日は 422（欄 due_on）で何も作らない", async () => {
    const w = await world(f, "004");
    const a = await guest(f, w, "山田", w.gA);
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() + 9 * 3600_000 - 86_400_000).toISOString().slice(0, 10);
    expect((await post(a, { ...ok, due_on: null })).status).toBe(201);
    expect((await post(a, { ...ok, body: "今日までに", due_on: today })).status).toBe(201);
    const r = await post(a, { ...ok, body: "きのう", due_on: yesterday });
    expect(r.status).toBe(422);
    expect(JSON.stringify(await asJson(r))).toContain("due_on");
  });

  it("K907-API-005 添付：自分が足した下書き（検査済み）を 5 つまで付けられ、持ち主が依頼に移る（portal_draft → client_request・owner_id は依頼の id）", async () => {
    const w = await world(f, "005");
    const a = await guest(f, w, "山田", w.gA);
    const ds = [await draft(w, a), await draft(w, a), await draft(w, a), await draft(w, a), await draft(w, a)];
    const id = await idOf(await post(a, { ...ok, attachment_ids: ds }));
    const rows = (
      await f.admin.query<{ owner_type: string; owner_id: string }>(
        "select owner_type, owner_id from attachments where id = any($1::uuid[])",
        [ds],
      )
    ).rows;
    expect(rows).toHaveLength(5);
    for (const x of rows) expect(x).toEqual({ owner_type: "client_request", owner_id: id });
  });

  it("K907-API-006 添付が付けられない（404・E-GST-160・欄なし）：別の人の下書き・無い id・もう依頼に付いた物・消した物・検査が済んでいない物が 1 つでもあれば、何も作らず、良い添付も付けない（全部か無しか）", async () => {
    const w = await world(f, "006");
    const [a, b] = [await guest(f, w, "甲", w.gA), await guest(f, w, "乙", w.gA)];
    const good = await draft(w, a);
    const bads = [
      await draft(w, b),
      randomUUID(),
      await draft(w, a, { type: "client_request", owner: randomUUID() }),
      await draft(w, a, { deleted: true }),
      await draft(w, a, { scanned: false }),
    ];
    const before = await count(f, "client_requests", "tenant_id = $1", [w.tenantId]);
    for (const bad of bads) {
      const r = await post(a, { ...ok, attachment_ids: [good, bad] });
      expect(r.status, bad).toBe(404);
      const j = await asJson(r);
      expect(j["code"]).toBe("E-GST-160");
      expect(hasNoDetail(j)).toBe(true);
    }
    expect(await count(f, "client_requests", "tenant_id = $1", [w.tenantId])).toBe(before);
    expect((await f.admin.query("select owner_type from attachments where id = $1", [good])).rows[0]).toEqual({
      owner_type: "portal_draft",
    });
  });

  it("K907-API-007 二重に出す：同じ人が同じ本文・同じ期限を 60 秒以内にもう一度出すと、新しい依頼を作らず前の id を 201 で返す（依頼 1 行・受け箱も増えない）。本文が違えば別の依頼", async () => {
    const w = await world(f, "007");
    const a = await guest(f, w, "山田", w.gA);
    const first = await idOf(await post(a, ok));
    const again = await idOf(await post(a, ok));
    expect(again).toBe(first);
    expect(await count(f, "client_requests", "tenant_id = $1", [w.tenantId])).toBe(1);
    expect(await inbox(f, w.staff.id, "client_request.created")).toBe(1);
    expect(await idOf(await post(a, { ...ok, body: "別の依頼です" }))).not.toBe(first);
    expect(await count(f, "client_requests", "tenant_id = $1", [w.tenantId])).toBe(2);
  });

  it("K907-API-008 知らせ（受け箱）：届け先の社内のグループの人（消していない・止めていない・ゲストでない）に 1 件ずつ。別のグループの人・止めた人・ゲストには入らない。届け先に人がいなければ会社の管理者へ。payload は request_id と url だけ（ゲストの字を載せない）", async () => {
    const w = await world(f, "008");
    const a = await guest(f, w, "山田", w.gA);
    const other = await make(f, w.tenantId, w.root, "届け先でない人", { ability: "edit" });
    const stopped = await make(f, w.tenantId, w.reqScope, "止めた人", { status: "suspended" });
    await f.admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, true, 'member')",
      [w.tenantId, stopped.id, w.reqScope],
    );
    const second = await make(f, w.tenantId, w.reqScope, "営業の 2 人目", { ability: "edit" });
    await f.admin.query(
      "insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role) values ($1, $2, $3, true, 'member')",
      [w.tenantId, second.id, w.reqScope],
    );
    const id = await idOf(await post(a, { ...ok, body: `${SECRET}をお願いします` }));
    for (const p of [w.staff, second]) expect(await inbox(f, p.id, "client_request.created"), p.id).toBe(1);
    for (const p of [other, stopped, a, w.boss]) expect(await inbox(f, p.id, "client_request.created"), p.id).toBe(0);
    const payload = (
      await f.admin.query<{ payload: Json }>(
        "select payload from notifications where member_id = $1 and event_kind_id = 'client_request.created'",
        [w.staff.id],
      )
    ).rows[0]!.payload;
    expect(Object.keys(payload).sort()).toEqual(["request_id", "url"]);
    expect(payload["request_id"]).toBe(id);
    expect(JSON.stringify(payload)).not.toContain(SECRET);
    // 届け先に人がいない会社：管理者へ
    const w2 = await world(f, "008b");
    await f.admin.query("delete from scope_memberships where scope_id = $1", [w2.reqScope]);
    const a2 = await guest(f, w2, "乙", w2.gA);
    expect((await post(a2, ok)).status).toBe(201);
    expect(await inbox(f, w2.boss.id, "client_request.created")).toBe(1);
  });

  it("K907-API-009 メール：届け先の人にリンクだけを送る（ゲストの書いた字・添付の名前を載せない）。メールが送れなくても依頼は残り 201・受け箱の行も残る", async () => {
    const w = await world(f, "009");
    const a = await guest(f, w, "山田", w.gA);
    const from = mails.length;
    const id = await idOf(await post(a, { ...ok, body: `${SECRET}です` }));
    const sent = mails.slice(from).filter((m) => m.to === w.staff.email);
    expect(sent.length).toBeGreaterThanOrEqual(1);
    for (const m of sent) {
      expect(m.text + m.subject).not.toContain(SECRET);
      expect(m.text).toContain(`/requests/${id}`);
    }
    expect(mails.slice(from).filter((m) => m.to === a.email)).toEqual([]);
    // 送れないとき
    await useHooks(f, "portal-request", {
      mailer: async () => {
        throw new Error("送れない");
      },
    });
    const r = await post(a, { ...ok, body: "送れないときの依頼" });
    expect(r.status).toBe(201);
    const rid = await idOf(r);
    expect(await count(f, "client_requests", "id = $1", [rid])).toBe(1);
    expect(await inbox(f, w.staff.id, "client_request.created")).toBe(2);
    await useHooks(f, "portal-request");
  });

  it("K907-API-010 入口：社内の人は 403・ログインなしは 401・グループに入っていないゲストは 403。何も作らない", async () => {
    const w = await world(f, "010");
    const free = await guest(f, w, "どこにも入っていない", null);
    const before = await count(f, "client_requests", "tenant_id = $1", [w.tenantId]);
    expect((await post(w.boss, ok, "member")).status).toBe(403);
    expect((await post(null, ok)).status).toBe(401);
    expect((await post(free, ok)).status).toBe(403);
    expect(await count(f, "client_requests", "tenant_id = $1", [w.tenantId])).toBe(before);
  });

  it("K907-API-011 外した直後（G-14）：抜けた・止めた・グループから外された・グループが消えたゲストは、次に出す・読むが 403（FORBIDDEN）で何も作らない", async () => {
    const w = await world(f, "011");
    const mine = await guest(f, w, "山田", w.gA);
    const rid = await idOf(await post(mine, ok));
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
      await cut(p.id);
      expect((await post(p, { ...ok, body: label })).status, `${label} 出す`).toBe(403);
      expect((await get(p, rid)).status, `${label} 読む`).toBe(403);
    }
    const g = await guest(f, w, "消える社", w.gB);
    await f.admin.query("update guest_groups set deleted_at = now() where id = $1", [w.gB]);
    expect((await post(g, { ...ok, body: "消えた" })).status).toBe(403);
  });

  it("K907-API-012 上限：同じ人が上限を超えたら 429・retry_after_sec は 1〜60 の整数・no-store・超えた分は何も作らない", async () => {
    const w = await world(f, "012");
    const a = await guest(f, w, "山田", w.gA);
    f.limits["createPortalRequest"] = 2;
    try {
      expect((await post(a, { ...ok, body: "一つ目" })).status).toBe(201);
      expect((await post(a, { ...ok, body: "二つ目" })).status).toBe(201);
      const r = await post(a, { ...ok, body: "三つ目" });
      expect(r.status).toBe(429);
      const s = (await asJson(r))["retry_after_sec"] as number;
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
      expect(r.headers.get("cache-control") ?? "").toContain("no-store");
      expect(await count(f, "client_requests", "tenant_id = $1", [w.tenantId])).toBe(2);
    } finally {
      delete f.limits["createPortalRequest"];
    }
  });

  it("K907-API-013 途中の失敗：証跡が書けなければ 503・E-PAGE-003・依頼も添付の持ち主替えも受け箱の行も残らない（1 つの取引）", async () => {
    const w = await world(f, "013");
    const a = await guest(f, w, "山田", w.gA);
    const d = await draft(w, a);
    await failOn(f, "audit_events", "new.action = 'portal.request_created'", async () => {
      const r = await post(a, { ...ok, attachment_ids: [d] });
      expect(r.status).toBe(503);
      expect((await asJson(r))["code"]).toBe("E-PAGE-003");
    });
    expect(await count(f, "client_requests", "tenant_id = $1", [w.tenantId])).toBe(0);
    expect((await f.admin.query("select owner_type from attachments where id = $1", [d])).rows[0]).toEqual({
      owner_type: "portal_draft",
    });
    expect(await inbox(f, w.staff.id, "client_request.created")).toBe(0);
  });

  it("K907-API-014 分身の仕事は積まない：出しても bridge_jobs の行は増えない（案を作る仕事は K-896 の口）", async () => {
    const w = await world(f, "014");
    const a = await guest(f, w, "山田", w.gA);
    const before = await n(f, "select count(*) as n from bridge_jobs where tenant_id = $1", [w.tenantId]);
    expect((await post(a, ok)).status).toBe(201);
    expect(await n(f, "select count(*) as n from bridge_jobs where tenant_id = $1", [w.tenantId])).toBe(before);
  });
});

describe("K-907 グループの依頼を読む（getPortalRequest）", () => {
  it("K907-API-015 形：200・no-store・鍵はちょうど request・messages・can_write。request は id・title・from_name・group_name・created_at・state（断っていなければ declined_reason は無い）。やり取りの鍵は id・side・name・at・text", async () => {
    const w = await world(f, "015");
    const a = await guest(f, w, "山田", w.gA);
    const id = await request(f, w, w.gA, a, { title: "報告書" });
    await requestMsg(f, w, id, "guest", a, "お願いします", { ago: "2 hours" });
    await requestMsg(f, w, id, "company", w.staff, "詳しく教えてください", { ago: "1 hour" });
    const r = await get(a, id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await asJson(r)).data as { request: Json; messages: Json[]; can_write: boolean };
    expect(Object.keys(d).sort()).toEqual(["can_write", "messages", "request"]);
    expect(Object.keys(d.request).sort()).toEqual(["created_at", "from_name", "group_name", "id", "state", "title"]);
    expect(d.request).toMatchObject({ id, title: "報告書", from_name: "山田", state: "open" });
    expect(String(d.request["group_name"]), "依頼を置いたゲストのグループの名前").toMatch(/^Ａ社/);
    expect(d.can_write).toBe(true);
    expect(d.messages.map((m) => [m["side"], m["name"], m["text"]])).toEqual([
      ["they", "山田", "報告書"],
      ["they", "山田", "お願いします"],
      ["we", "営業の人", "詳しく教えてください"],
    ]);
    expect(d.messages[0]!.id).toBe(id);
    expect(Object.keys(d.messages[0]!).sort()).toEqual(["at", "id", "name", "side", "text"]);
  });

  it("K907-API-016 状態：new・asking は open（書ける）・ticketed は accepted・declined は declined（declined_reason が付く）。accepted・declined は can_write が false", async () => {
    const w = await world(f, "016");
    const a = await guest(f, w, "山田", w.gA);
    const t = (
      await f.admin.query<{ id: string }>(
        `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title) select $1, $2, 'pending', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク'), (select id from ticket_stages where tenant_id = $1 and key = 'todo'), 't' returning id`,
        [w.tenantId, w.root],
      )
    ).rows[0]!.id;
    const cases: [string, Record<string, unknown>, string, boolean][] = [
      ["new", {}, "open", true],
      ["asking", { state: "asking" }, "open", true],
      ["ticketed", { ticketId: t }, "accepted", false],
      ["declined", { state: "declined" }, "declined", false],
    ];
    for (const [label, o, state, can] of cases) {
      const id = await request(f, w, w.gA, a, o as never);
      const d = (await asJson(await get(a, id))).data as { request: Json; can_write: boolean };
      expect(d.request["state"], label).toBe(state);
      expect(d.can_write, label).toBe(can);
      expect("declined_reason" in d.request, label).toBe(state === "declined");
    }
  });

  it("K907-API-017 やり取りに出す物：依頼の本文のあと、種類が message の行だけを古い順に。ファイルを付けた記録（種類 attachment）など別の種類の行は出ない", async () => {
    const w = await world(f, "017");
    const a = await guest(f, w, "山田", w.gA);
    const id = await request(f, w, w.gA, a, {});
    await requestMsg(f, w, id, "guest", a, "一つ目", { ago: "3 hours" });
    await f.admin.query(
      "insert into client_request_messages (tenant_id, client_request_id, side, kind, body, author_member_id) values ($1, $2, 'company', 'attachment', '分身の下書きひみつ.pdf', $3)",
      [w.tenantId, id, w.staff.id],
    );
    await requestMsg(f, w, id, "company", w.staff, "二つ目", { ago: "1 hour" });
    const raw = await (await get(a, id)).text();
    expect(raw).not.toContain("分身の下書きひみつ");
    expect((JSON.parse(raw) as { data: { messages: { text: string }[] } }).data.messages.map((m) => m.text)).toEqual([
      "依頼のたいとる",
      "一つ目",
      "二つ目",
    ]);
  });

  it("K907-API-018 グループの全員が読める：同じグループの別のゲストが出した依頼も 200。別のグループのゲスト・別の会社のゲストは 404（NOT_FOUND・欄なし・題は答えに出ない）。消した依頼・無い id も 404", async () => {
    const w = await world(f, "018");
    const [a1, a2, b1] = [await guest(f, w, "甲", w.gA), await guest(f, w, "乙", w.gA), await guest(f, w, "丙", w.gB)];
    const id = await request(f, w, w.gA, a1, { title: "ひみつの題" });
    expect((await get(a1, id)).status).toBe(200);
    expect((await get(a2, id)).status).toBe(200);
    const o = await world(f, "018x");
    const og = await guest(f, o, "他社", o.gA);
    const gone = await request(f, w, w.gA, a1, { title: "ひみつの題" });
    await f.admin.query("update client_requests set deleted_at = now() where id = $1", [gone]);
    for (const [who, rid] of [
      [b1, id],
      [og, id],
      [a1, gone],
      [a1, NO_SUCH],
    ] as [P, string][]) {
      const r = await get(who, rid);
      expect(r.status, rid).toBe(404);
      const j = await asJson(r);
      expect(j["code"]).toBe("NOT_FOUND");
      expect(hasNoDetail(j)).toBe(true);
      expect(await r.clone().text()).not.toContain("ひみつの題");
    }
  });

  it("K907-API-019 入口：社内の人は 403・ログインなしは 401・グループに入っていないゲストは 403。道の値が uuid でなければ 422", async () => {
    const w = await world(f, "019");
    const a = await guest(f, w, "山田", w.gA);
    const id = await request(f, w, w.gA, a, {});
    const free = await guest(f, w, "どこにも入っていない", null);
    expect((await get(w.boss, id, "member")).status).toBe(403);
    expect((await get(null, id)).status).toBe(401);
    expect((await get(free, id)).status).toBe(403);
    expect((await get(a, "not-a-uuid")).status).toBe(422);
  });

  it("K907-API-020 書いた字をそのまま返す：HTML・スクリプトの字・改行・絵文字を含む本文は、置き換えも省略もせず文字のまま答えに入る（描き方は画面が文字として出す・K-912）", async () => {
    const w = await world(f, "020");
    const a = await guest(f, w, "山田", w.gA);
    const text = '<img src=x onerror="alert(1)">\n<script>x</script> 🙂 & "引用"';
    const id = await idOf(await post(a, { ...ok, body: text }));
    const d = (await asJson(await get(a, id))).data as { messages: { text: string }[] };
    expect(d.messages[0]!.text).toBe(text);
  });
});

describe("K-907 行の守り（ゲストが依頼の表に書ける形）", () => {
  it("K907-API-021 守り：ゲストの文脈で client_requests に足せるのは「自分のグループ・client_id 空・state new・出した人は本人」の行だけ。別のグループ・他人を出した人にした行・state が new でない行・出した人の印が無い行は断られ、直す・消すは 0 行（自分の依頼も）", async () => {
    const w = await world(f, "021");
    const a = await guest(f, w, "山田", w.gA);
    const mine = await request(f, w, w.gA, a, {});
    const c: TenantContext = { tenantId: w.tenantId, userId: a.id, role: "client", stepUpAt: null };
    const attempt = async (sql: string, p: unknown[]): Promise<number | "denied"> => {
      try {
        return await withTenant(f.pool, c, async (cl) => (await cl.query(sql, p)).rowCount ?? 0);
      } catch (e) {
        if (/row-level security|permission denied/.test(String(e))) return "denied";
        throw e;
      }
    };
    const ins =
      "insert into client_requests (tenant_id, guest_group_id, client_id, title, state, created_by) values ($1, $2, null, 'x', $3, $4)";
    expect(await attempt(ins, [w.tenantId, w.gA, "new", a.id]), "自分のグループ・new・本人").toBe(1);
    expect(await attempt(ins, [w.tenantId, w.gB, "new", a.id]), "別のグループ").toBe("denied");
    expect(await attempt(ins, [w.tenantId, w.gA, "new", w.boss.id]), "他人を出した人にする").toBe("denied");
    expect(await attempt(ins, [w.tenantId, w.gA, "ticketed", a.id]), "new でない").toBe("denied");
    expect(await attempt(ins, [w.tenantId, w.gA, "new", null]), "出した人の印なし").toBe("denied");
    expect(await attempt("update client_requests set title = 'y' where id = $1", [mine]), "直す").toBe(0);
    expect(await attempt("delete from client_requests where id = $1", [mine]), "消す").toBe(0);
  });
});
