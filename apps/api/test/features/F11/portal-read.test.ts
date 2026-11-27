// K-906「先方の画面を読む口（getPortalHome・getPortalTicket・listPortalNotices）」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン）。行 ID（K906-API-…）は 11_tickets/K-906.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/portal-read.ts の register（K-326）。
// 試験が決める口の形（契約は 05_flow/screen_api.py の前からある 3 行を直す）:
//   getPortalHome        GET /api/v1/portal            200 { data: { group_name, tenant_name, request_scope_name?, me: { name, initial }, first_visit, requests: [{ id, title, from_name, created_at, badge }], tickets: [{ id, title, stage, from_request? }] } }
//     badge＝"返事あり"（チケットになる前で、いちばん新しいやり取りが会社の側）／"受付済み"（チケットになる前で、いちばん新しいやり取りがゲストの側）／"済み"（チケットになった・断った）
//     stage＝"作っている"／"確認中"／"完了"（社内の段を 3 つにまとめる：done→完了・checking と awaiting_approval→確認中・ほかは作っている）
//     first_visit＝この人が先方の場所を初めて開いたか。初めて読んだとき true を返し、同じ取引で「開いた」記録（audit_events・portal.first_visit）を 1 行書く。次の読みからは false
//     to_review（確認してほしいもの）の欄は無い（検収を作らない・D-155.44）。期限・担当は返さない（D-155.41）
//   getPortalTicket      GET /api/v1/portal/tickets/:id   200 { data: { ticket: { id, title, stage, body, detail, from_request }, messages: [{ id, side: "they"|"we", name, at, text }] } }
//     body＝鍵 body の区画の text。detail＝鍵 detail の区画の text（無ければ ""）。見えるのは「見せる相手に自分のゲストのグループが選ばれた」チケットだけ（K-881）。
//     見えない・無い・消した・別のグループ・別の会社は 404（NOT_FOUND・欄なし）。messages は K-882 の関数 app.portal_ticket_messages の答え（guest_visible が true の post だけ・古い順・side は書いた人が役割 requester なら they）
//   listPortalNotices    GET /api/v1/portal/notices    200 { data: [{ id, title, body }] }（公開済み・全部向け・placements に banner を含む・期限の過ぎた保守は除く・新しい順・3 件まで）
//   ゲストでない（役割 requester でない・グループが無い・止めた・抜けた・グループが消えた）人は 403（FORBIDDEN）。社内の人（role member）は入口の 403・ログインしていなければ 401
// DB（migration 20261127100600_portal_read.sql）: app.portal_home()・app.portal_ticket(tid)・app.portal_notices()（security definer。ゲストの文脈の人にだけ答え、ほかは 42501）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { makeFixture, type Fixture } from "../fixture.js";
import {
  asG,
  asJson,
  asM,
  chat,
  count,
  failOn,
  group,
  guest,
  hasNoDetail,
  request,
  requestMsg,
  share,
  ticket,
  useHooks,
  world,
  type Json,
  type World,
} from "./portal-world.js";

let f: Fixture;
beforeAll(async () => {
  f = await makeFixture([]);
  await useHooks(f, "portal-read");
}, 60_000);
afterAll(async () => {
  await f?.close();
});

interface Home {
  group_name: string;
  tenant_name: string;
  request_scope_name?: string;
  me: { name: string; initial: string };
  first_visit: boolean;
  requests: { id: string; title: string; from_name: string; created_at: string; badge: string }[];
  tickets: { id: string; title: string; stage: string; from_request?: boolean }[];
}
const home = (p: Awaited<ReturnType<typeof guest>> | null, role: "client" | "member" = "client") =>
  f.req("GET", "/portal", p ? { headers: role === "client" ? asG(f, p) : asM(f, p) } : {});
const homeOf = async (r: Response): Promise<Home> => (await asJson(r)).data as unknown as Home;
const tget = (id: string, p: Awaited<ReturnType<typeof guest>> | null, role: "client" | "member" = "client") =>
  f.req("GET", `/portal/tickets/${id}`, p ? { headers: role === "client" ? asG(f, p) : asM(f, p) } : {});
const notices = (p: Awaited<ReturnType<typeof guest>> | null) =>
  f.req("GET", "/portal/notices", p ? { headers: asG(f, p) } : {});
const ctxOf = (w: World, p: { id: string }, role: TenantContext["role"] = "client"): TenantContext => ({
  tenantId: w.tenantId,
  userId: p.id,
  role,
  stepUpAt: null,
});

describe("K-906 ホーム（getPortalHome）", () => {
  it("K906-API-001 形：200・no-store・鍵は group_name・tenant_name・request_scope_name・me・first_visit・requests・tickets（to_review・期限・担当の欄は無い）。me は表示名とその頭の 1 字", async () => {
    const w = await world(f, "001");
    const a = await guest(f, w, "山田 花子", w.gA);
    const r = await home(a);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await asJson(r)).data as Json;
    expect(Object.keys(d).sort()).toEqual([
      "first_visit",
      "group_name",
      "me",
      "request_scope_name",
      "requests",
      "tenant_name",
      "tickets",
    ]);
    expect(d["me"]).toEqual({ name: "山田 花子", initial: "山" });
    expect(String(d["tenant_name"])).toMatch(/^ポータル試験 001 /);
    expect(d["request_scope_name"]).toBe("営業");
    expect(String(d["group_name"])).toMatch(/^Ａ社/);
    const raw = await r.clone().text();
    for (const k of ["to_review", "due_on", "assignee"]) expect(raw, k).not.toContain(k);
  });

  it("K906-API-002 first_visit：初めて読んだときだけ true・同じ取引で記録を 1 行書く・2 回目からは false で行は増えない・同じグループの別のゲストは別に数える", async () => {
    const w = await world(f, "002");
    const [a1, a2] = [await guest(f, w, "甲", w.gA), await guest(f, w, "乙", w.gA)];
    expect((await homeOf(await home(a1))).first_visit).toBe(true);
    expect((await homeOf(await home(a1))).first_visit).toBe(false);
    expect((await homeOf(await home(a1))).first_visit).toBe(false);
    expect(
      await count(f, "audit_events", "tenant_id = $1 and action = 'portal.first_visit' and actor_member_id = $2", [
        w.tenantId,
        a1.id,
      ]),
    ).toBe(1);
    expect((await homeOf(await home(a2))).first_visit).toBe(true);
    expect(await count(f, "audit_events", "tenant_id = $1 and action = 'portal.first_visit'", [w.tenantId])).toBe(2);
  });

  it("K906-API-003 依頼：自分のグループの依頼だけ（グループの別のゲストが出した物も）を新しい順。別のグループ・別の会社・前の取引先の形の依頼は出ない。from_name は出した人の表示名", async () => {
    const w = await world(f, "003");
    const [a1, a2, b1] = [await guest(f, w, "甲", w.gA), await guest(f, w, "乙", w.gA), await guest(f, w, "丙", w.gB)];
    const r1 = await request(f, w, w.gA, a1, { title: "古い依頼" });
    await f.admin.query("update client_requests set created_at = now() - interval '2 days' where id = $1", [r1]);
    const r2 = await request(f, w, w.gA, a2, { title: "新しい依頼" });
    await request(f, w, w.gB, b1, { title: "別のグループの依頼" });
    const other = await world(f, "003x");
    const og = await guest(f, other, "他社", other.gA);
    await request(f, other, other.gA, og, { title: "別の会社の依頼" });
    const d = await homeOf(await home(a1));
    expect(d.requests.map((x) => x.id)).toEqual([r2, r1]);
    expect(d.requests[0]).toMatchObject({ title: "新しい依頼", from_name: "乙" });
    expect(Object.keys(d.requests[0]!).sort()).toEqual(["badge", "created_at", "from_name", "id", "title"]);
    expect((await homeOf(await home(a2))).requests.map((x) => x.id)).toEqual([r2, r1]);
  });

  it("K906-API-004 札（badge）：チケットになる前は、いちばん新しいやり取りが会社の側なら「返事あり」・ゲストの側（やり取りが 1 件だけも）なら「受付済み」。チケットになった・断った依頼は「済み」", async () => {
    const w = await world(f, "004");
    const a = await guest(f, w, "甲", w.gA);
    const t = await ticket(f, w, {});
    const [rReply, rWait, rTicketed, rDeclined] = [
      await request(f, w, w.gA, a, { title: "返事が来た" }),
      await request(f, w, w.gA, a, { title: "返事待ち" }),
      await request(f, w, w.gA, a, { title: "チケットになった", ticketId: t }),
      await request(f, w, w.gA, a, { title: "断られた", state: "declined" }),
    ];
    await requestMsg(f, w, rReply, "guest", a, "お願いします", { ago: "2 hours" });
    await requestMsg(f, w, rReply, "company", w.staff, "詳しく教えてください", { ago: "1 hour" });
    await requestMsg(f, w, rWait, "guest", a, "お願いします", { ago: "1 hour" });
    await requestMsg(f, w, rTicketed, "company", w.staff, "受けました");
    const by = Object.fromEntries((await homeOf(await home(a))).requests.map((x) => [x.id, x.badge]));
    expect(by).toEqual({ [rReply]: "返事あり", [rWait]: "受付済み", [rTicketed]: "済み", [rDeclined]: "済み" });
  });

  it("K906-API-005 チケット：見せる相手に自分のグループが選ばれた物だけ。見せていない・外した・別のグループ・消した・下書きは出ない。鍵はちょうど id・title・stage（依頼から作った物は from_request が付く）", async () => {
    const w = await world(f, "005");
    const [a, b] = [await guest(f, w, "甲", w.gA), await guest(f, w, "乙", w.gB)];
    const [shown, plain, removed, other, gone, viaReq] = [
      await ticket(f, w, { title: "見せた" }),
      await ticket(f, w, { title: "社内だけ" }),
      await ticket(f, w, { title: "外した" }),
      await ticket(f, w, { title: "Ｂ社に" }),
      await ticket(f, w, { title: "消した", deleted: true }),
      await ticket(f, w, { title: "依頼から" }),
    ];
    await share(f, w, shown, w.gA);
    await share(f, w, removed, w.gA, { removed: true });
    await share(f, w, other, w.gB);
    await share(f, w, gone, w.gA);
    await share(f, w, viaReq, w.gA);
    await request(f, w, w.gA, a, { title: "依頼", ticketId: viaReq });
    const d = await homeOf(await home(a));
    expect(d.tickets.map((x) => x.id).sort()).toEqual([shown, viaReq].sort());
    expect(plain).not.toBeUndefined();
    expect(Object.keys(d.tickets.find((x) => x.id === shown)!).sort()).toEqual(["id", "stage", "title"]);
    expect(d.tickets.find((x) => x.id === viaReq)!.from_request).toBe(true);
    expect((await homeOf(await home(b))).tickets.map((x) => x.id)).toEqual([other]);
  });

  it("K906-API-006 段の札：done は「完了」・checking と awaiting_approval は「確認中」・todo・doing・hold・running と鍵の無い段は「作っている」", async () => {
    const w = await world(f, "006");
    const a = await guest(f, w, "甲", w.gA);
    const want: [string | null, string][] = [
      ["done", "完了"],
      ["checking", "確認中"],
      ["awaiting_approval", "確認中"],
      ["todo", "作っている"],
      ["doing", "作っている"],
      ["hold", "作っている"],
      ["running", "作っている"],
    ];
    const ids: [string, string][] = [];
    for (const [key, label] of want) {
      const t = await ticket(f, w, { title: `段 ${key}`, stageKey: key });
      await share(f, w, t, w.gA);
      ids.push([t, label]);
    }
    await f.admin.query(
      "insert into ticket_stages (tenant_id, key, name, position) values ($1, null, '自分の段', 15) on conflict do nothing",
      [w.tenantId],
    );
    const custom = await ticket(f, w, { title: "自分の段", stageKey: null });
    await share(f, w, custom, w.gA);
    ids.push([custom, "作っている"]);
    const d = await homeOf(await home(a));
    for (const [id, label] of ids) expect(d.tickets.find((x) => x.id === id)!.stage, id).toBe(label);
  });

  it("K906-API-007 社内の欄を返さない：見せたチケットの期限・担当者・優先度が入っていても、答えの字のどこにも出ない（期限の日付の字も無い）", async () => {
    const w = await world(f, "007");
    const a = await guest(f, w, "甲", w.gA);
    const t = await ticket(f, w, { due: "2031-03-14" });
    await f.admin.query(
      "update tickets set assignee_member_id = $2, priority = 'high', priority_reason = '社内の理由ひみつ' where id = $1",
      [t, w.staff.id],
    );
    await share(f, w, t, w.gA);
    const raw = await (await home(a)).text();
    for (const s of ["2031-03-14", "社内の理由ひみつ", w.staff.id, "priority", "assignee", "due"])
      expect(raw, s).not.toContain(s);
  });

  it("K906-API-008 0 件：依頼もチケットも無いグループは requests・tickets が空の配列で 200（first_visit は true）", async () => {
    const w = await world(f, "008");
    const a = await guest(f, w, "甲", w.gA);
    const d = await homeOf(await home(a));
    expect(d.requests).toEqual([]);
    expect(d.tickets).toEqual([]);
    expect(d.first_visit).toBe(true);
  });

  it("K906-API-009 外した直後から読めない（G-14）：抜けた・止めた・グループから外された・グループが消えた・役割が変わった人は、次の読みで 403（FORBIDDEN）。ほかのゲストは読める", async () => {
    const w = await world(f, "009");
    const keep = await guest(f, w, "残る", w.gA);
    const cases: [string, (id: string) => Promise<unknown>][] = [
      ["抜けた", (id) => f.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [id])],
      [
        "止めた",
        (id) => f.admin.query("update tenant_memberships set status = 'suspended' where member_id = $1", [id]),
      ],
      [
        "グループから外された",
        (id) => f.admin.query("update guest_group_members set deleted_at = now() where member_id = $1", [id]),
      ],
      [
        "役割が変わった",
        (id) => f.admin.query("update tenant_memberships set role = 'member' where member_id = $1", [id]),
      ],
    ];
    for (const [label, cut] of cases) {
      const p = await guest(f, w, label, w.gA);
      expect((await home(p)).status, `${label}の前`).toBe(200);
      await cut(p.id);
      const r = await home(p);
      expect(r.status, label).toBe(403);
      expect((await asJson(r))["code"]).toBe("FORBIDDEN");
    }
    const lonely = await guest(f, w, "消える社の人", await group(f, w, "消える社"));
    await f.admin.query(
      "update guest_groups set deleted_at = now() where id = (select guest_group_id from guest_group_members where member_id = $1)",
      [lonely.id],
    );
    expect((await home(lonely)).status).toBe(403);
    expect((await home(keep)).status).toBe(200);
  });

  it("K906-API-010 入口：社内の人（role member）は 403・ログインしていなければ 401・グループに入っていないゲストは 403。3 つの口とも同じ", async () => {
    const w = await world(f, "010");
    const free = await guest(f, w, "どこにも入っていない", null);
    const t = await ticket(f, w, {});
    for (const [method, path] of [
      ["GET", "/portal"],
      ["GET", `/portal/tickets/${t}`],
      ["GET", "/portal/notices"],
    ] as const) {
      expect((await f.req(method, path, { headers: asM(f, w.boss) })).status, `${path} 社内の人`).toBe(403);
      expect((await f.req(method, path)).status, `${path} ログインなし`).toBe(401);
      expect((await f.req(method, path, { headers: asG(f, free) })).status, `${path} グループなし`).toBe(403);
    }
  });

  it("K906-API-011 上限：同じ人が上限を超えたら 429・retry_after_sec は 1〜60 の整数・no-store", async () => {
    const w = await world(f, "011");
    const a = await guest(f, w, "甲", w.gA);
    f.limits["getPortalHome"] = 2;
    try {
      expect((await home(a)).status).toBe(200);
      expect((await home(a)).status).toBe(200);
      const r = await home(a);
      expect(r.status).toBe(429);
      const j = await asJson(r);
      expect(
        Number.isInteger(j["retry_after_sec"]) &&
          (j["retry_after_sec"] as number) >= 1 &&
          (j["retry_after_sec"] as number) <= 60,
      ).toBe(true);
      expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    } finally {
      delete f.limits["getPortalHome"];
    }
  });

  it("K906-API-012 開いた記録が書けなかったら 503（E-PAGE-003）・first_visit は消費されない（次の読みでまた true）", async () => {
    const w = await world(f, "012");
    const a = await guest(f, w, "甲", w.gA);
    await failOn(f, "audit_events", "new.action = 'portal.first_visit'", async () => {
      const r = await home(a);
      expect(r.status).toBe(503);
      expect((await asJson(r))["code"]).toBe("E-PAGE-003");
    });
    expect((await homeOf(await home(a))).first_visit).toBe(true);
  });
});

describe("K-906 見せてもらったチケット（getPortalTicket）", () => {
  it("K906-API-013 形：見せたチケットは 200・no-store・鍵はちょうど ticket・messages。ticket は id・title・stage・body・detail・from_request。本文と詳細は区画の字。詳細の区画が無ければ空の字", async () => {
    const w = await world(f, "013");
    const a = await guest(f, w, "甲", w.gA);
    const [t, bare] = [
      await ticket(f, w, {
        title: "請求書を送る",
        body: "保守費を請求する",
        detail: "1,500,000 円",
        stageKey: "checking",
      }),
      await ticket(f, w, { title: "詳細なし", body: "本文だけ" }),
    ];
    await share(f, w, t, w.gA);
    await share(f, w, bare, w.gA);
    const r = await tget(t, a);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await asJson(r)).data as { ticket: Json; messages: unknown[] };
    expect(Object.keys(d).sort()).toEqual(["messages", "ticket"]);
    expect(d.ticket).toEqual({
      id: t,
      title: "請求書を送る",
      stage: "確認中",
      body: "保守費を請求する",
      detail: "1,500,000 円",
      from_request: false,
    });
    expect(((await asJson(await tget(bare, a))).data as { ticket: Json }).ticket["detail"]).toBe("");
  });

  it("K906-API-014 見えない：見せていない・外した・別のグループにだけ見せた・消した・下書き・別の会社・無い id は 404（NOT_FOUND）・欄なし。題や本文は答えのどこにも出ない", async () => {
    const w = await world(f, "014");
    const a = await guest(f, w, "甲", w.gA);
    const [plain, removed, other, gone] = [
      await ticket(f, w, { title: "ひみつの題" }),
      await ticket(f, w, { title: "ひみつの題" }),
      await ticket(f, w, { title: "ひみつの題" }),
      await ticket(f, w, { title: "ひみつの題", deleted: true }),
    ];
    await share(f, w, removed, w.gA, { removed: true });
    await share(f, w, other, w.gB);
    await share(f, w, gone, w.gA);
    const draft = await ticket(f, w, { title: "ひみつの題" });
    await f.admin.query("update tickets set draft_import_id = $2 where id = $1", [
      draft,
      (
        await f.admin.query<{ id: string }>(
          "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'generic') returning id",
          [w.tenantId, w.boss.id, w.root],
        )
      ).rows[0]!.id,
    ]);
    await share(f, w, draft, w.gA);
    const o = await world(f, "014x");
    const foreign = await ticket(f, o, { title: "ひみつの題" });
    await share(f, o, foreign, o.gA);
    for (const id of [plain, removed, other, gone, draft, foreign, randomUUID()]) {
      const r = await tget(id, a);
      expect(r.status, id).toBe(404);
      const j = await asJson(r);
      expect(j["code"]).toBe("NOT_FOUND");
      expect(hasNoDetail(j)).toBe(true);
      expect(await r.clone().text()).not.toContain("ひみつの題");
    }
  });

  it("K906-API-015 社内の欄を返さない：答えに担当・期限・優先度・確認項目・決定・成果物・分身の記録が出ない（鍵も字も）。社内の人・ゲストでない人は入口の 403", async () => {
    const w = await world(f, "015");
    const a = await guest(f, w, "甲", w.gA);
    const t = await ticket(f, w, { due: "2031-03-14" });
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t, w.staff.id]);
    await f.admin.query(
      "insert into test_specs (tenant_id, ticket_id, check_kind, title) values ($1, $2, 'human', '確認項目ひみつ')",
      [w.tenantId, t],
    );
    await f.admin.query(
      "insert into ticket_decisions (tenant_id, ticket_id, text, decided_by) values ($1, $2, '決定ひみつ', $3)",
      [w.tenantId, t, w.boss.id],
    );
    await share(f, w, t, w.gA);
    const raw = await (await tget(t, a)).text();
    for (const s of [
      "2031-03-14",
      "確認項目ひみつ",
      "決定ひみつ",
      w.staff.id,
      "assignee",
      "due_on",
      "priority",
      "checks",
      "decisions",
      "artifacts",
    ])
      expect(raw, s).not.toContain(s);
    expect((await tget(t, w.boss, "member")).status).toBe(403);
  });

  it("K906-API-016 依頼から作ったチケット：依頼がそのチケットにつながり自分のグループの物なら from_request が true・ふつうのチケットは false", async () => {
    const w = await world(f, "016");
    const a = await guest(f, w, "甲", w.gA);
    const [viaReq, plain] = [await ticket(f, w, {}), await ticket(f, w, {})];
    await share(f, w, viaReq, w.gA);
    await share(f, w, plain, w.gA);
    await request(f, w, w.gA, a, { ticketId: viaReq });
    expect(((await asJson(await tget(viaReq, a))).data as { ticket: Json }).ticket["from_request"]).toBe(true);
    expect(((await asJson(await tget(plain, a))).data as { ticket: Json }).ticket["from_request"]).toBe(false);
  });

  it("K906-API-017 チャット：ゲストに見える書き込み（guest_visible）の post だけを古い順に返す。変更・仕組みの書き込みと見せない書き込みは出ない。書いた人が役割 requester なら side は they・社内の人は we。鍵は id・side・name・at・text。依頼から来た書き込みにだけ from_request: true", async () => {
    const w = await world(f, "017");
    const [a, a2] = [await guest(f, w, "山田", w.gA), await guest(f, w, "鈴木", w.gA)];
    const t = await ticket(f, w, {});
    await share(f, w, t, w.gA);
    await chat(f, w, t, w.staff, "始めました", { ago: "3 hours" });
    await chat(f, w, t, w.staff, "社内だけの話", { ago: "2 hours", visible: false });
    await chat(f, w, t, a, "お願いします", { ago: "1 hour" });
    await chat(f, w, t, w.staff, "期限を変えました", { ago: "30 minutes", kind: "change", visible: true });
    await chat(f, w, t, a2, "こちらも確認します");
    await chat(f, w, t, a, "依頼の本文です", { ago: "4 hours", fromRequest: true });
    const m = (
      (await asJson(await tget(t, a))).data as {
        messages: { id: string; side: string; name: string; at: string; text: string; from_request?: true }[];
      }
    ).messages;
    expect(m.map((x) => [x.side, x.name, x.text])).toEqual([
      ["they", "山田", "依頼の本文です"],
      ["we", "営業の人", "始めました"],
      ["they", "山田", "お願いします"],
      ["they", "鈴木", "こちらも確認します"],
    ]);
    expect(Object.keys(m[1]!).sort()).toEqual(["at", "id", "name", "side", "text"]);
    expect(
      m.map((x) => x.from_request ?? null),
      "依頼から来た 1 件にだけ from_request: true",
    ).toEqual([true, null, null, null]);
  });

  it("K906-API-018 グループの全員が同じ物を読む：同じグループの別のゲストも同じ答え・別のグループのゲストは 404。外すとすぐ 404（G-14）・足し直すとまた 200", async () => {
    const w = await world(f, "018");
    const [a1, a2, b1] = [await guest(f, w, "甲", w.gA), await guest(f, w, "乙", w.gA), await guest(f, w, "丙", w.gB)];
    const t = await ticket(f, w, {});
    await share(f, w, t, w.gA);
    expect((await tget(t, a1)).status).toBe(200);
    expect((await tget(t, a2)).status).toBe(200);
    expect((await tget(t, b1)).status).toBe(404);
    await f.admin.query("update ticket_guest_shares set deleted_at = now() where ticket_id = $1", [t]);
    expect((await tget(t, a1)).status).toBe(404);
    await share(f, w, t, w.gA);
    expect((await tget(t, a1)).status).toBe(200);
  });

  it("K906-API-019 道の値：uuid でない :id は 422（入口）・上限を超えたら 429", async () => {
    const w = await world(f, "019");
    const a = await guest(f, w, "甲", w.gA);
    expect((await tget("not-a-uuid", a)).status).toBe(422);
    f.limits["getPortalTicket"] = 1;
    try {
      const t = await ticket(f, w, {});
      await share(f, w, t, w.gA);
      expect((await tget(t, a)).status).toBe(200);
      expect((await tget(t, a)).status).toBe(429);
    } finally {
      delete f.limits["getPortalTicket"];
    }
  });
});

describe("K-906 お知らせ（listPortalNotices）と表の守り", () => {
  it("K906-API-020 お知らせ：公開済み・全部向け・placements に banner を含む物だけ（下書き・予約・消した・特定の会社向け・プラン向け・banner の無い物・期限の過ぎた保守は出ない）。新しい順・3 件まで・鍵は id・title・body", async () => {
    const w = await world(f, "020");
    const a = await guest(f, w, "甲", w.gA);
    const mk = async (
      title: string,
      o: {
        state?: string;
        tenant?: string | null;
        plans?: boolean;
        place?: string;
        deleted?: boolean;
        mto?: string;
        ago?: string;
      } = {},
    ) =>
      (
        await f.admin.query<{ id: string }>(
          `insert into notices (kind_id, title, body, state, target_tenant_id, target_plan_ids, placements, maintenance_to, deleted_at, created_at)
         values ('incident', $1, $2, $3, $4, ${o.plans ? "array[gen_random_uuid()]" : "null"}, $5::text[], ${o.mto ? `now() + interval '${o.mto}'` : "null"}, ${o.deleted ? "now()" : "null"}, now() - $6::interval) returning id`,
          [
            `K906-${title}`,
            `本文 ${title}`,
            o.state ?? "published",
            o.tenant ?? null,
            o.place ?? "{banner,list}",
            o.ago ?? "0 seconds",
          ],
        )
      ).rows[0]!.id;
    await f.admin.query("update notices set deleted_at = now() where title like 'K906-%'");
    const [n1, n2, n3, n4] = [
      await mk("一番新しい", { ago: "1 minute" }),
      await mk("二番目", { ago: "1 hour" }),
      await mk("三番目", { ago: "2 hours" }),
      await mk("四番目", { ago: "3 hours" }),
    ];
    await mk("下書き", { state: "draft" });
    await mk("予約", { state: "scheduled" });
    await mk("消した", { deleted: true });
    await mk("この会社向け", { tenant: w.tenantId });
    await mk("プラン向け", { plans: true });
    await mk("bannerなし", { place: "{list}" });
    await f.admin.query(
      "update notices set maintenance_to = now() - interval '1 day' where id = (select id from notices where title = 'K906-四番目')",
    );
    const r = await notices(a);
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await asJson(r)).data as { id: string; title: string; body: string }[];
    expect(d.map((x) => x.id)).toEqual([n1, n2, n3]);
    expect(Object.keys(d[0]!).sort()).toEqual(["body", "id", "title"]);
    expect(n4).toBeTruthy();
    expect(d[0]).toMatchObject({ title: "K906-一番新しい", body: "本文 一番新しい" });
  });

  it("K906-API-021 お知らせが 1 件も無いときは 200・空の配列", async () => {
    const w = await world(f, "021");
    const a = await guest(f, w, "甲", w.gA);
    await f.admin.query("update notices set deleted_at = now() where deleted_at is null");
    expect((await asJson(await notices(a)))["data"]).toEqual([]);
  });

  it("K906-API-022 表の守り：ゲストの文脈でも、チケット・区画・お知らせ・チャット・依頼のやり取りの表を直に読むと 0 行（読めるのは関数の口だけ）。関数は社内の文脈の人が呼ぶと 42501", async () => {
    const w = await world(f, "022");
    const a = await guest(f, w, "甲", w.gA);
    const t = await ticket(f, w, {});
    await share(f, w, t, w.gA);
    await chat(f, w, t, a, "書き込み");
    const inGuest = (table: string) =>
      withTenant(f.pool, ctxOf(w, a), async (cl) => (await cl.query(`select 1 from ${table}`)).rowCount ?? 0);
    for (const table of ["ticket_sections", "notices", "ticket_messages", "client_request_messages"])
      expect(await inGuest(table), table).toBe(0);
    for (const fn of ["app.portal_home()", `app.portal_ticket('${t}')`, "app.portal_notices()"]) {
      await expect(
        withTenant(f.pool, ctxOf(w, w.boss, "member"), (cl) => cl.query(`select ${fn}`)),
        fn,
      ).rejects.toMatchObject({ code: "42501" });
    }
    expect(
      await withTenant(f.pool, ctxOf(w, a), async (cl) => (await cl.query("select app.portal_home() as v")).rowCount),
    ).toBe(1);
  });
});
