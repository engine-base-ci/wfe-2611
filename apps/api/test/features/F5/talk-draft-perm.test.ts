// K-782「作る画面の AI と話せるのは、チケットを作る権限がある人だけ（D-153.35）」の単体の試験（口・本物の DB）。
//   名前の頭の行 ID（K782-API-…）は 11_tickets/K-782.md の行の表と 1 対 1。土台は K-757 の F5/talk.harness.ts（変えない）。
//   作る権限＝その会社の消していないグループのどれか 1 つに tickets の edit（has_permission・作る口 createTicket と同じ判定）。
//   口：POST /api/v1/ticket_draft_conversations（体なし）・POST /api/v1/ticket_draft_conversations/:id/messages（K-774 の口・形は変えない）
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { describe, expect, it } from "vitest";
import { setupTalk, type Person, type World } from "./talk.harness.js";

const h = setupTalk(["draft-talk", "talk-read"], ["startDraftConversation", "sendDraftMessage"]);

const NO_CREATE = "E-TALK-062";
const NO_CREATE_TEXT = "チケットを作る権限が無いので、作る画面の AI と話せません";
const DRAFT = { title: "請求書を送る", body: "11 月分を送る。", checks: ["金額が見積と同じ"] };

const start = (who: Person) => h.call(who, "POST", "/ticket_draft_conversations", { body: {} });
const say = (who: Person, conv: string) =>
  h.call(who, "POST", `/ticket_draft_conversations/${conv}/messages`, { body: { text: "相談です", draft: DRAFT } });
/** その人の tickets の権限を全部 view に下げる（作る権限を外す・見る権限は残す） */
const viewOnly = (p: Person) =>
  h.f.admin.query(
    "update permissions set ability_id = 'view' where grantee_member_id = $1 and target_kind_id = 'tickets'",
    [p.id],
  );
const shot = async (w: World) => ({
  convs: await h.count("select count(*) as n from conversations where tenant_id = $1", [w.tenantId]),
  msgs: await h.count("select count(*) as n from messages where tenant_id = $1", [w.tenantId]),
  jobs: await h.count("select count(*) as n from bridge_jobs where tenant_id = $1", [w.tenantId]),
  audits: await h.count("select count(*) as n from audit_events where tenant_id = $1 and action like 'draft_talk.%'", [
    w.tenantId,
  ]),
});
const refused = async (r: Response) => {
  expect(r.status, await r.clone().text()).toBe(403);
  const b = await h.json(r);
  expect(b.code).toBe(NO_CREATE);
  expect(JSON.stringify(b)).toContain(NO_CREATE_TEXT);
};

describe("K-782 作る画面の AI と話せる人", () => {
  it("K782-API-001 作る権限が無い人（tickets は view だけ）が始める：403・E-TALK-062（文は「チケットを作る権限が無いので、作る画面の AI と話せません」）。会話・行・仕事・証跡のどれも増えない", async () => {
    const w = await h.world("k782-001");
    await h.pc(w.me);
    await viewOnly(w.me);
    const before = await shot(w);
    await refused(await start(w.me));
    expect(await shot(w)).toEqual(before);
  });

  it("K782-API-002 作る権限が無い人が、前に作った自分の作る画面の会話に言う：403・E-TALK-062。行・仕事・証跡は増えず、会話は消えない", async () => {
    const w = await h.world("k782-002");
    await h.pc(w.me);
    const conv = await h.conversation(w, w.me, { kind: "draft" });
    await viewOnly(w.me);
    const before = await shot(w);
    await refused(await say(w.me, conv));
    expect(await shot(w)).toEqual(before);
    expect(await h.count("select count(*) as n from conversations where id = $1 and deleted_at is null", [conv])).toBe(
      1,
    );
  });

  it("K782-API-003 作る権限がグループ 1 つにだけある人：始めるも言うも 201（どのグループでもよい・作る口と同じ判定）", async () => {
    const w = await h.world("k782-003");
    await h.pc(w.outsider);
    const r = await start(w.outsider);
    expect(r.status, await r.clone().text()).toBe(201);
    const conv = ((await h.json(r)).data as { id: string }).id;
    const s = await say(w.outsider, conv);
    expect(s.status, await s.clone().text()).toBe(201);
  });

  it("K782-API-004 作る権限を外された直後（話している途中・G-14）：同じ会話に次に言うと 403・E-TALK-062。外す前に積んだ仕事はそのまま残る", async () => {
    const w = await h.world("k782-004");
    await h.pc(w.me);
    const r = await start(w.me);
    const conv = ((await h.json(r)).data as { id: string }).id;
    const first = await say(w.me, conv);
    expect(first.status, await first.clone().text()).toBe(201);
    const jobs = await h.count("select count(*) as n from bridge_jobs where conversation_id = $1", [conv]);
    await viewOnly(w.me);
    await refused(await say(w.me, conv));
    expect(await h.count("select count(*) as n from bridge_jobs where conversation_id = $1", [conv])).toBe(jobs);
  });

  it("K782-API-005 edit が消したグループの物だけ・取り消した権限だけ：どちらも作る権限が無い扱いで 403・E-TALK-062", async () => {
    const w = await h.world("k782-005");
    await h.pc(w.me);
    await h.f.admin.query("update scopes set deleted_at = now() where id = $1", [w.scopeA]);
    await refused(await start(w.me));
    const w2 = await h.world("k782-005b");
    await h.pc(w2.me);
    await h.f.admin.query(
      "update permissions set revoked_at = now() where grantee_member_id = $1 and target_kind_id = 'tickets'",
      [w2.me.id],
    );
    await refused(await start(w2.me));
  });

  it("K782-API-006 守りの順：停止された人は前のとおり 403 FORBIDDEN（E-TALK-062 ではない）・作る権限の無い人がほかの人の会話に言うと 404（E-TALK-062 でない・入口の守りが先・在るかを漏らさない）", async () => {
    const w = await h.world("k782-006");
    await h.pc(w.me);
    const others = await h.conversation(w, w.other, { kind: "draft" });
    await h.f.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1" /* 止めた人の列も入れる（members_suspended_ck：suspended_at と suspended_by は対） */, [w.outsider.id]);
    const s = await start(w.outsider);
    expect(s.status).toBe(403);
    expect((await h.json(s)).code).not.toBe(NO_CREATE);
    await viewOnly(w.me);
    const r = await say(w.me, others);
    expect(r.status).toBe(404);
    expect(await h.json(r)).toMatchObject({ error: "not_found", code: "NOT_FOUND" });
  });
});

describe("K-782 作る権限の判定が落ちたとき", () => {
  it("K782-API-007 手順 1（DB に書く）の失敗：作る権限の判定（has_permission）が例外：始める口は 503・E-PAGE-003・会話・証跡が増えない（作る権限があると見なさない）", async () => {
    const w = await h.world("k782-007");
    await h.pc(w.me);
    const def = (
      await h.f.admin.query<{ d: string }>(
        "select pg_get_functiondef('public.has_permission(uuid, text, uuid, text)'::regprocedure) as d",
      )
    ).rows[0]!.d;
    const before = await shot(w);
    await h.f.admin
      .query(`create or replace function public.has_permission(uid uuid, target_kind text, scope uuid, ability text)
      returns boolean language plpgsql stable security definer set search_path = public, app as $$
      begin raise exception 'k782 の試験の失敗'; end $$`);
    try {
      const r = await start(w.me);
      expect(r.status, await r.clone().text()).toBe(503);
      expect((await h.json(r)).code).toBe("E-PAGE-003");
    } finally {
      await h.f.admin.query(def);
    }
    expect(await shot(w)).toEqual(before);
  });
});
