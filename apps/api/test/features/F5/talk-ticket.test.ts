// K-763「チケットの中で話す口（getTicketAgentSession・sendTicketAgentMessage）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K763-API-…）は 11_tickets/K-763.md の行の表と 1 対 1。土台は K-757 が持ち込む F5/talk.harness.ts（本物の Postgres・本物の口の入口・偽の画面のログイン・本物の PC の印）。
//   必要な土台の手助けは K-763.md「前提と制約」の表のとおり（world・ticket・pc・spec・run・approval・conversation・count・captureLogs・call・f）。
//   口：GET /api/v1/tickets/:id/agent-session → 200 { data: { conversation, messages[], has_more, running_job_id, work, stopped } }（会話が無ければ conversation が null・messages が空）
//       POST /api/v1/tickets/:id/agent-session/messages ← { text } → 201 { data: { id, conversation_id, job_id } }
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupTalk, type Person, type World } from "./talk.harness.js";

const h = setupTalk(
  ["ticket-talk", "talk-say"],
  ["getTicketAgentSession", "sendTicketAgentMessage", "stopConversation"],
);

type Row = Record<string, unknown>;
interface Tk {
  id: string;
  number: string;
  title: string;
}
const VIEW_KEYS = ["conversation", "has_more", "messages", "running_job_id", "stopped", "work"];
const MSG_KEYS = ["at", "id", "job_id", "passed", "proposal", "text", "took", "who"];
const PC_NONE = "E-TALK-050";
const TOO_MANY = "E-TALK-012";

const q = async <T extends Row>(sql: string, p: unknown[] = []): Promise<T[]> =>
  (await h.f.admin.query<T>(sql, p)).rows;
const code = async (r: Response) => (await h.json(r))["code"];
const get = (who: Person | null, t: Tk) => h.call(who, "GET", `/tickets/${t.id}/agent-session`);
const say = (who: Person | null, t: Tk, text: unknown, extra: Row = {}) =>
  h.call(who, "POST", `/tickets/${t.id}/agent-session/messages`, { body: { text, ...extra } });
const view = async (who: Person, t: Tk): Promise<Row> => {
  const r = await get(who, t);
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await h.json(r)).data ?? {}) as Row;
};
const sent = async (who: Person, t: Tk, text: string) => {
  const r = await say(who, t, text);
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await h.json(r)).data ?? {}) as { id: string; conversation_id: string; job_id: string };
};
const convsOf = (who: Person, t: Tk) =>
  q<{ id: string; title: string | null; talk_kind: string; ticket_id: string | null }>(
    "select id, title, talk_kind, ticket_id from conversations where owner_member_id = $1 and ticket_id = $2 and deleted_at is null",
    [who.id, t.id],
  );
const jobsOf = (conv: string) =>
  q<{ id: string; prompt: string; tools: string[] | null; state_id: string; kind: string; member_id: string }>(
    "select id, prompt, tools, state_id, kind, member_id from bridge_jobs where conversation_id = $1 and deleted_at is null order by created_at, id",
    [conv],
  );
const msgsOf = (conv: string) =>
  q<{ id: string; body: string; kind: string; job_id: string | null }>(
    "select id, body, kind, job_id from messages where conversation_id = $1 and deleted_at is null order by created_at, id",
    [conv],
  );
/** 話すが触る表の行の数（何も変わらないことの確かめ） */
const shot = async (w: World) => ({
  convs: await h.count("select count(*) as n from conversations where tenant_id = $1", [w.tenantId]),
  msgs: await h.count("select count(*) as n from messages where tenant_id = $1", [w.tenantId]),
  jobs: await h.count("select count(*) as n from bridge_jobs where tenant_id = $1", [w.tenantId]),
  audits: await h.count("select count(*) as n from audit_events where tenant_id = $1 and action like 'ticket_talk.%'", [
    w.tenantId,
  ]),
  notices: await h.count("select count(*) as n from notifications where tenant_id = $1", [w.tenantId]),
});
const body = (w: World, t: Tk, text: string) =>
  h.f.admin.query(
    "insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version) values ($1, $2, 'body', 0, $3, 1)",
    [w.tenantId, t.id, JSON.stringify({ text })],
  );
const post = (w: World, t: Tk, by: Person, text: string, minAgo: number, kind = "post") =>
  h.f.admin.query(
    `insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, created_at, created_by)
     values ($1, $2, $3, $4, $5, now() - make_interval(mins => $6), $3)`,
    [w.tenantId, t.id, kind === "system" ? null : by.id, kind, text, minAgo],
  );
const addMsg = (
  w: World,
  conv: string,
  who: "me" | "ai",
  owner: Person,
  text: string,
  minAgo: number,
  jobId: string | null = null,
) =>
  h.f.admin.query(
    `insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, job_id, created_at)
     values ($1, $2, $3, $4, $5, $6, now() - make_interval(mins => $7))`,
    [w.tenantId, conv, who === "me" ? owner.id : null, text, who === "me" ? "human" : "ai", jobId, minAgo],
  );
const addJob = async (
  w: World,
  conv: string,
  owner: Person,
  state: string,
  o: { partial?: string; reason?: string; minAgo?: number } = {},
) =>
  (
    await q<{ id: string }>(
      `insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, partial, stopped_reason, started_at, created_by, created_at)
       values ($1, $2, $3, $4, $5, '（試験）', $6, $7, case when $5 in ('running', 'asking', 'stopped') then now() end, $3, now() - make_interval(mins => $8))
       returning id`,
      [w.tenantId, w.scopeA, owner.id, conv, state, o.partial ?? null, o.reason ?? null, o.minAgo ?? 1],
    )
  )[0]!.id;
/** 世界・PC をつないだ自分・チケット 1 件（自分が担当者） */
const ready = async (label: string, o: { pc?: boolean } = {}) => {
  const w = await h.world(label);
  if (o.pc !== false) await h.pc(w.me);
  const t = await h.ticket(w, { title: `${label} の請求書を送る` });
  return { w, t };
};

describe("K-763 チケットの中で話す：読む", () => {
  it("K763-API-001 会話がまだ無いチケットを開く：200・会話なしの空の形（conversation が null・messages が空・has_more false・running_job_id・work・stopped が null）。何も作らない。Cache-Control に private と no-store", async () => {
    const { w, t } = await ready("k763-001");
    const before = await shot(w);
    const r = await get(w.me, t);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = (await h.json(r)).data as Row;
    expect(Object.keys(v).sort()).toEqual(VIEW_KEYS);
    expect(v).toMatchObject({
      conversation: null,
      messages: [],
      has_more: false,
      running_job_id: null,
      work: null,
      stopped: null,
    });
    expect(await shot(w)).toEqual(before);
  });

  it("K763-API-002 会話が在る：200・conversation は 5 つの鍵（id・title・talk_kind が ticket・ticket_id・updated_at）・messages は古い順で鍵はちょうど 8 つ（人の言葉は who が me・AI の返事は ai）・passed は空・proposal と took は null", async () => {
    const { w, t } = await ready("k763-002");
    const cid = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id, title: "請求書の相談" });
    await addMsg(w, cid, "me", w.me, "金額を確かめたい", 3);
    await addMsg(w, cid, "ai", w.me, "確認項目の 1 つ目を見ましょう", 2);
    const v = await view(w.me, t);
    expect(Object.keys(v).sort()).toEqual(VIEW_KEYS);
    const c = v["conversation"] as Row;
    expect(Object.keys(c).sort()).toEqual(["id", "talk_kind", "ticket_id", "title", "updated_at"]);
    expect(c).toMatchObject({ id: cid, talk_kind: "ticket", ticket_id: t.id, title: "請求書の相談" });
    const ms = v["messages"] as Row[];
    expect(ms.map((m) => [m["who"], m["text"]])).toEqual([
      ["me", "金額を確かめたい"],
      ["ai", "確認項目の 1 つ目を見ましょう"],
    ]);
    for (const m of ms) {
      expect(Object.keys(m).sort()).toEqual(MSG_KEYS);
      expect(m).toMatchObject({ passed: [], proposal: null, took: null });
    }
  });

  it("K763-API-003 行が 51 件：新しい 50 件だけを古い順に返し has_more が true（これより前は会話の行の読む口で読む）。50 件ちょうどなら has_more は false", async () => {
    const { w, t } = await ready("k763-003");
    const cid = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    for (let i = 1; i <= 51; i++) await addMsg(w, cid, i % 2 ? "me" : "ai", w.me, `話 ${i}`, 100 - i);
    const v = await view(w.me, t);
    const ms = v["messages"] as Row[];
    expect(ms).toHaveLength(50);
    expect(ms[0]!["text"]).toBe("話 2");
    expect(ms.at(-1)!["text"]).toBe("話 51");
    expect(v["has_more"]).toBe(true);
    await h.f.admin.query("update messages set deleted_at = now() where conversation_id = $1 and body = '話 1'", [cid]);
    const v2 = await view(w.me, t);
    expect((v2["messages"] as Row[]).length).toBe(50);
    expect(v2["has_more"]).toBe(false);
  });

  it("K763-API-004 自分の会話だけ見える：同じチケットのほかの人の会話・自分の AI との会話（clone）・作る画面の会話（draft）・ほかのチケットの会話は出ない（会話が無いのと同じ空の形）", async () => {
    const { w, t } = await ready("k763-004");
    const t2 = await h.ticket(w, { title: "別のチケット" });
    const theirs = await h.conversation(w, w.other, { kind: "ticket", ticket: t.id });
    await addMsg(w, theirs, "me", w.other, "佐藤の話", 5);
    const clone = await h.conversation(w, w.me, { kind: "clone" });
    await addMsg(w, clone, "me", w.me, "自分の AI との話", 4);
    const draft = await h.conversation(w, w.me, { kind: "draft" });
    await addMsg(w, draft, "me", w.me, "作る画面の話", 3);
    const other = await h.conversation(w, w.me, { kind: "ticket", ticket: t2.id });
    await addMsg(w, other, "me", w.me, "別のチケットの話", 2);
    expect(await view(w.me, t)).toMatchObject({ conversation: null, messages: [] });
    const mine = await view(w.other, t);
    expect((mine["messages"] as Row[]).map((m) => m["text"])).toEqual(["佐藤の話"]);
    expect((await view(w.me, t2))["messages"] as Row[]).toHaveLength(1);
  });

  it("K763-API-005 仕事が動いている・止まった（開き直す・再読み込み）：動いている間は running_job_id と work（state・partial・stopping）が出て、止めると stopping が true。止まった後は stopped に仕事の id と理由が出て、running_job_id と work は null", async () => {
    const { w, t } = await ready("k763-005");
    const cid = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    await addMsg(w, cid, "me", w.me, "続きをお願い", 2);
    const job = await addJob(w, cid, w.me, "running", { partial: "書きかけの返事" });
    const v = await view(w.me, t);
    expect(v["running_job_id"]).toBe(job);
    expect(v["work"]).toMatchObject({ job_id: job, state: "running", partial: "書きかけの返事", stopping: false });
    expect(v["stopped"]).toBeNull();
    await h.f.admin.query("update bridge_jobs set stop_requested_at = now() where id = $1", [job]);
    expect(((await view(w.me, t))["work"] as Row)["stopping"]).toBe(true);
    await h.f.admin.query(
      "update bridge_jobs set state_id = 'stopped', stopped_reason = '自分の PC が閉じました' where id = $1",
      [job],
    );
    const s = await view(w.me, t);
    expect(s["stopped"]).toEqual({ job_id: job, reason: "自分の PC が閉じました" });
    expect(s["running_job_id"]).toBeNull();
    expect(s["work"]).toBeNull();
  });

  it("K763-API-006 見られないチケット（見えない人・別の会社の人・無い id・消したチケット）：404・答えは { error, code } だけ（欄・details を付けない）。会話の行は何も変わらない", async () => {
    const { w, t } = await ready("k763-006");
    const cid = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    await addMsg(w, cid, "me", w.me, "話した", 1);
    const foreign = await h.world("k763-006-別の会社");
    const before = await shot(w);
    for (const who of [w.outsider, foreign.me]) {
      const r = await get(who, t);
      expect(r.status).toBe(404);
      const b = await h.json(r);
      expect(b).toMatchObject({ error: "not_found", code: "NOT_FOUND" });
      expect(b["details"]).toBeUndefined();
      expect(b["field"]).toBeUndefined();
    }
    expect((await get(w.me, { id: randomUUID(), number: "", title: "" })).status).toBe(404);
    await h.f.admin.query("update tickets set deleted_at = now() where id = $1", [t.id]);
    expect((await get(w.me, t)).status).toBe(404);
    expect(await shot(w)).toEqual(before);
  });

  it("K763-API-007 見られなくなった直後（担当だけで見えていた人の担当が替わった）：404。会話の行は残り、見られる状態に戻すと同じ会話がそのまま読める", async () => {
    const w = await h.world("k763-007");
    await h.pc(w.outsider);
    const t = await h.ticket(w, { title: "担当だけで見える", assignee: w.outsider });
    const first = await sent(w.outsider, t, "最初の相談");
    await h.f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t.id, w.me.id]);
    const r = await get(w.outsider, t);
    expect(r.status).toBe(404);
    expect(await convsOf(w.outsider, t)).toHaveLength(1);
    expect(await msgsOf(first.conversation_id)).toHaveLength(1);
    await h.f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t.id, w.outsider.id]);
    const back = await view(w.outsider, t);
    expect((back["conversation"] as Row)["id"]).toBe(first.conversation_id);
    expect((back["messages"] as Row[]).map((m) => m["text"])).toEqual(["最初の相談"]);
  });
});

describe("K-763 チケットの中で話す：言う", () => {
  it("K763-API-008 初めて言う：201・答えの鍵はちょうど 3 つ。会話が 1 つできる（種類 ticket・チケットと人に結ぶ・題は最初の言葉の頭）・人の言葉の行 1・仕事 1（積んだ状態・道具は足さない）・仕事の頭に文脈・お知らせは 0・証跡 1（字は入れない）", async () => {
    const { w, t } = await ready("k763-008");
    const before = await shot(w);
    const text = "この請求書、金額の確認から始めたいです";
    const r = await say(w.me, t, text);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = (await h.json(r)).data as { id: string; conversation_id: string; job_id: string };
    expect(Object.keys(v).sort()).toEqual(["conversation_id", "id", "job_id"]);
    const convs = await convsOf(w.me, t);
    expect(convs).toHaveLength(1);
    expect(convs[0]).toMatchObject({ id: v.conversation_id, talk_kind: "ticket", ticket_id: t.id, title: text });
    const ms = await msgsOf(v.conversation_id);
    expect(ms).toEqual([{ id: v.id, body: text, kind: "human", job_id: v.job_id }]);
    const jobs = await jobsOf(v.conversation_id);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: v.job_id, state_id: "queued", kind: "chat", member_id: w.me.id, tools: null });
    expect(jobs[0]!.prompt).toContain(`${t.number} ${t.title}`);
    expect(jobs[0]!.prompt.endsWith(text)).toBe(true);
    const after = await shot(w);
    expect(after).toEqual({
      ...before,
      convs: before.convs + 1,
      msgs: before.msgs + 1,
      jobs: before.jobs + 1,
      audits: before.audits + 1,
    });
    const aud = await q<{ payload: unknown; target_id: string }>(
      "select payload, target_id from audit_events where tenant_id = $1 and action = 'ticket_talk.say'",
      [w.tenantId],
    );
    expect(aud).toHaveLength(1);
    expect(aud[0]!.target_id).toBe(v.conversation_id);
    expect(JSON.stringify(aud[0]!.payload)).not.toContain("金額");
    const read = await view(w.me, t);
    expect((read["messages"] as Row[]).map((m) => m["text"])).toEqual([text]);
    expect(read["running_job_id"]).toBe(v.job_id);
  });

  it("K763-API-009 続けて言う・同時に 2 つの最初の一言：続けて言うと同じ会話に積む（会話 1・行 2・仕事 2 が積んだ状態）。同じチケットで同時に最初の一言が 2 つ来ても会話は 1 つだけで、どちらも 201", async () => {
    const { w, t } = await ready("k763-009");
    const a = await sent(w.me, t, "1 つ目");
    const b = await sent(w.me, t, "2 つ目");
    expect(b.conversation_id).toBe(a.conversation_id);
    expect(await msgsOf(a.conversation_id)).toHaveLength(2);
    expect((await jobsOf(a.conversation_id)).map((j) => j.state_id)).toEqual(["queued", "queued"]);
    const t2 = await h.ticket(w, { title: "同時の最初の一言" });
    const rs = await Promise.all([say(w.me, t2, "同時 A"), say(w.me, t2, "同時 B")]);
    expect(rs.map((x) => x.status)).toEqual([201, 201]);
    const cs = await convsOf(w.me, t2);
    expect(cs).toHaveLength(1);
    expect(await msgsOf(cs[0]!.id)).toHaveLength(2);
    expect(await jobsOf(cs[0]!.id)).toHaveLength(2);
  });

  it("K763-API-010 AI に渡す文脈：題・番号・本文の全文・確認項目（文とチェックの有無・消した物は除く）・やり取りの書き込み（新しい 10 件・1 件 400 字・古い順・仕組みの行は除く）。ほかのチケットの中身は入らず、言った字は最後に付く。見えない文脈では何も出ない（DB の関数）", async () => {
    const { w, t } = await ready("k763-010");
    const t2 = await h.ticket(w, { title: "ほかのチケット" });
    await body(w, t, `本文の 1 段落目\n本文の 2 段落目 ${"あ".repeat(30_000)}`);
    await body(w, t2, "ほかのチケットの本文 SECRET-OTHER");
    await h.spec(t.id, { title: "金額が見積と同じ", checked: "member" });
    await h.spec(t.id, { title: "宛名が正しい" });
    await h.spec(t.id, { title: "外した確認項目", deleted: true });
    await h.spec(t2.id, { title: "ほかの確認 SECRET-OTHER" });
    for (let i = 1; i <= 12; i++) await post(w, t, i % 2 ? w.me : w.other, `書き込み ${i}`, 60 - i);
    await post(w, t, w.me, "長い書き込み " + "い".repeat(500), 1);
    await post(w, t, w.me, "仕組みの行 SYSTEM-LINE", 0, "system");
    await post(w, t2, w.me, "ほかのチケットの書き込み SECRET-OTHER", 1);
    const text = "次に何をすればいい？";
    const v = await sent(w.me, t, text);
    const p = (await jobsOf(v.conversation_id))[0]!.prompt;
    expect(p).toContain(`${t.number} ${t.title}`);
    expect(p).toContain("本文の 1 段落目\n本文の 2 段落目 " + "あ".repeat(30_000));
    expect(p).toContain("- [x] 金額が見積と同じ");
    expect(p).toContain("- [ ] 宛名が正しい");
    expect(p).not.toContain("外した確認項目");
    expect(p).not.toContain("SYSTEM-LINE");
    expect(p).not.toContain("SECRET-OTHER");
    expect(p).not.toMatch(/書き込み (1|2|3)(?!\d)/);
    expect(p.indexOf("書き込み 4")).toBeGreaterThan(-1);
    expect(p.indexOf("書き込み 4")).toBeLessThan(p.indexOf("書き込み 12"));
    expect(p).toContain("い".repeat(400));
    expect(p).not.toContain("い".repeat(401));
    expect(p).toContain("佐藤");
    expect(p.endsWith(text)).toBe(true);
    // 数字の出どころ（新しい 10 件・1 件 400 字）は K-565 の app.ticket_job_context と同じ：同じ書き込みが入り、同じ書き込みが落ちる
    const job = (await q<{ v: { prompt: string } }>("select app.ticket_job_context($1) as v", [t.id]))[0]!.v.prompt;
    for (let i = 4; i <= 12; i++) {
      expect(job, `書き込み ${i}`).toContain(`書き込み ${i}`);
      expect(p, `書き込み ${i}`).toContain(`書き込み ${i}`);
    }
    expect(job).not.toMatch(/書き込み (1|2|3)(?!\d)/);
    expect(job).toContain("い".repeat(400));
    expect(job).not.toContain("い".repeat(401));
    // 本文の行が無い前の形のチケット：本文の見出しは出ず、題・確認項目は出る（K-578 が区画を消すまで）
    const old = await h.ticket(w, { title: "前の形のチケット" });
    await h.spec(old.id, { title: "前の形の確認" });
    const ov = await sent(w.me, old, "前の形で聞く");
    const op = (await jobsOf(ov.conversation_id))[0]!.prompt;
    expect(op).toContain(`${old.number} ${old.title}`);
    expect(op).toContain("- [ ] 前の形の確認");
    expect(op).not.toContain("## 本文");
    const c = await h.f.admin.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
        [w.tenantId, w.outsider.id],
      );
      const none = (await c.query<{ v: string | null }>("select app.ticket_talk_context($1) as v", [t.id])).rows[0]!.v;
      expect(none).toBeNull();
      await c.query("rollback");
    } finally {
      c.release();
    }
  });

  it("K763-API-011 言った字は書いたとおりに残る：前後の空白・全角・改行・HTML・絵文字・25 万字もそのまま（切らず、正規化しない）。NUL を含む字は 422 で何も変わらない", async () => {
    const { w, t } = await ready("k763-011");
    const odd = "　全角の空白 ＡＢＣ\n<script>alert(1)</script> 😀 \n 末尾の空白 ";
    const a = await sent(w.me, t, odd);
    expect((await msgsOf(a.conversation_id))[0]!.body).toBe(odd);
    const long = "字".repeat(250_000);
    const b = await sent(w.me, t, long);
    expect((await msgsOf(b.conversation_id)).at(-1)!.body).toBe(long);
    const before = await shot(w);
    const nul = await say(w.me, t, "ここに\u0000がある");
    expect(nul.status).toBe(422);
    expect(await shot(w)).toEqual(before);
  });

  it("K763-API-012 入力の形：text が無い・空・空白だけ（全角の空白・改行も）・文字でない・知らない項目：422（欄 text）。会話も行も仕事も作らない", async () => {
    const { w, t } = await ready("k763-012");
    const before = await shot(w);
    for (const text of [undefined, "", "   ", "\n\t　 ", 123, null, ["a"], { a: 1 }]) {
      const r = await h.call(w.me, "POST", `/tickets/${t.id}/agent-session/messages`, {
        body: text === undefined ? {} : { text },
      });
      expect(r.status, JSON.stringify(text)).toBe(422);
      const d = (await h.json(r))["details"] as { field: string }[] | undefined;
      expect(
        d?.some((x) => x.field === "text"),
        JSON.stringify(text),
      ).toBe(true);
    }
    const extra = await say(w.me, t, "余計な欄", {
      conversation_id: randomUUID(),
      quote: { text: "x" },
      permission_mode: "auto",
    });
    expect(extra.status).toBe(422);
    expect(await shot(w)).toEqual(before);
  });

  it("K763-API-013 PC がまだつながっていない・外した直後：409・E-TALK-050（文は PC をつなぐ案内・欄なし）。会話も行も仕事も証跡も残らない（初めての一言で作りかけた会話も戻る）", async () => {
    const { w, t } = await ready("k763-013", { pc: false });
    const before = await shot(w);
    const r = await say(w.me, t, "PC が無いまま話す");
    expect(r.status).toBe(409);
    expect(await code(r)).toBe(PC_NONE);
    const b = await h.json(r);
    expect(String(b["message"] ?? "")).toContain("PC をつなぐ");
    expect(b["details"]).toBeUndefined();
    expect(await shot(w)).toEqual(before);
    expect(await convsOf(w.me, t)).toHaveLength(0);
    const sid = await h.pc(w.me);
    await sent(w.me, t, "つないだので話す");
    await h.f.admin.query("update sessions set revoked_at = now() where id = $1", [sid]);
    const r2 = await say(w.me, t, "外した直後に話す");
    expect(r2.status).toBe(409);
    expect(await code(r2)).toBe(PC_NONE);
    expect(await msgsOf((await convsOf(w.me, t))[0]!.id)).toHaveLength(1);
  });

  it("K763-API-014 守り：チケットが見えるのに書けない人（見るだけ）は 403。見えない人・別の会社の人・無い id・消したチケットは 404。どれも会話・行・仕事を作らない", async () => {
    const { w, t } = await ready("k763-014");
    const viewer = await h.f.person(w.tenantId, w.scopeA, { name: "見るだけの人", ticketAbility: "view" });
    await h.pc(viewer);
    const foreign = await h.world("k763-014-別の会社");
    await h.pc(foreign.me);
    const before = await shot(w);
    expect((await say(viewer, t, "見るだけの人の話")).status).toBe(403);
    expect((await say(w.outsider, t, "見えない人の話")).status).toBe(404);
    expect((await say(foreign.me, t, "別の会社の話")).status).toBe(404);
    expect((await say(w.me, { id: randomUUID(), number: "", title: "" }, "無い id")).status).toBe(404);
    await h.f.admin.query("update tickets set deleted_at = now() where id = $1", [t.id]);
    const gone = await say(w.me, t, "消したチケットの話");
    expect(gone.status).toBe(404);
    expect(await h.json(gone)).toMatchObject({ error: "not_found", code: "NOT_FOUND" });
    expect((await h.json(gone))["details"]).toBeUndefined();
    expect(await shot(w)).toEqual(before);
  });

  it("K763-API-015 担当者が替わった直後：担当だけで書けていた前の担当者は 403（何も積まない）。新しい担当者は入り直さなくてもすぐ言える（会話はその人の分が新しくできる）", async () => {
    const w = await h.world("k763-015");
    const viewer = await h.f.person(w.tenantId, w.scopeA, { name: "前の担当者", ticketAbility: "view" });
    await h.pc(viewer);
    await h.pc(w.me);
    const t = await h.ticket(w, { title: "担当が替わる", assignee: viewer });
    await sent(viewer, t, "担当の間の話");
    await h.f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t.id, w.me.id]);
    const before = await shot(w);
    expect((await say(viewer, t, "替わった後の話")).status).toBe(403);
    expect(await shot(w)).toEqual(before);
    const now = await sent(w.me, t, "新しい担当者の話");
    expect((await convsOf(w.me, t))[0]!.id).toBe(now.conversation_id);
    expect((await convsOf(viewer, t))[0]!.id).not.toBe(now.conversation_id);
  });

  it("K763-API-016 書く権限を外された人の既存の会話：読むのはそのまま 200（前の話が残っている）・言うのは 403 で仕事は増えない。権限を付け直すとすぐまた言える", async () => {
    const { w, t } = await ready("k763-016");
    await h.pc(w.other);
    const first = await sent(w.other, t, "権限がある間の話");
    await h.f.admin.query(
      "update permissions set revoked_at = now() where grantee_member_id = $1 and target_kind_id = 'tickets'",
      [w.other.id],
    );
    expect(((await view(w.other, t))["messages"] as Row[]).map((m) => m["text"])).toEqual(["権限がある間の話"]);
    const jobs = (await jobsOf(first.conversation_id)).length;
    expect((await say(w.other, t, "外された後の話")).status).toBe(403);
    expect((await jobsOf(first.conversation_id)).length).toBe(jobs);
    await h.f.admin.query(
      "update permissions set revoked_at = null where grantee_member_id = $1 and target_kind_id = 'tickets'",
      [w.other.id],
    );
    expect((await say(w.other, t, "付け直した後の話")).status).toBe(201);
  });

  it("K763-API-017 完了したチケットでも話せる：読む 200・言う 201（話すことはチケットを変えない。完了の印・段・やり取りは変わらない）", async () => {
    const w = await h.world("k763-017");
    await h.pc(w.me);
    const t = await h.ticket(w, { title: "完了したチケット", completed: true, stage: "done" });
    const stage = await q<{ stage_id: string; completed_at: string | null }>(
      "select stage_id, completed_at from tickets where id = $1",
      [t.id],
    );
    const msgs = await h.count("select count(*) as n from ticket_messages where ticket_id = $1", [t.id]);
    await sent(w.me, t, "完了した後の相談");
    expect((await view(w.me, t))["messages"] as Row[]).toHaveLength(1);
    expect(await q("select stage_id, completed_at from tickets where id = $1", [t.id])).toEqual(stage);
    expect(await h.count("select count(*) as n from ticket_messages where ticket_id = $1", [t.id])).toBe(msgs);
  });

  it("K763-API-018 ログインしていない：401。上限（1 分に 61 回）：429 と待つ秒数（1〜60 の整数）", async () => {
    const { w, t } = await ready("k763-018");
    expect((await say(null, t, "x")).status).toBe(401);
    expect((await get(null, t)).status).toBe(401);
    const saved = h.f.limits["sendTicketAgentMessage"];
    delete h.f.limits["sendTicketAgentMessage"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await say(w.me, t, `上限の確かめ ${i}`);
      expect(last!.status).toBe(429);
      const sec = Number((await h.json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) h.f.limits["sendTicketAgentMessage"] = saved;
    }
  });
});

describe("K-763 チケットの中で話す：失敗・守り・組み合わせ", () => {
  it("K763-API-019 手順 S1「DB に書く」が失敗（関数が使えない）：503・E-PAGE-003。会話・行・仕事・証跡のどれも変わらない（字をログに出さない）", async () => {
    const { w, t } = await ready("k763-019");
    const before = await shot(w);
    await h.f.admin.query("revoke execute on function app.ticket_talk_say(uuid, text) from kaname_app");
    try {
      const logs = await h.captureLogs(async () => {
        const r = await say(w.me, t, "秘密の相談 K763-LOG");
        expect(r.status).toBe(503);
        expect(await code(r)).toBe("E-PAGE-003");
      });
      expect(logs).not.toContain("K763-LOG");
    } finally {
      await h.f.admin.query("grant execute on function app.ticket_talk_say(uuid, text) to kaname_app");
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K763-API-020 手順 S2「証跡」が失敗（証跡の書き込みが例外）：503・E-PAGE-003。同じ取引なので会話・人の言葉の行・仕事も残らない", async () => {
    const { w, t } = await ready("k763-020");
    const before = await shot(w);
    await h.f.admin.query(
      `create or replace function public.k763_fail_audit() returns trigger language plpgsql as $$
       begin if new.action = 'ticket_talk.say' then raise exception 'K-763 試験：証跡が書けない'; end if; return new; end $$`,
    );
    await h.f.admin.query(
      "create trigger k763_fail_audit before insert on audit_events for each row execute function public.k763_fail_audit()",
    );
    try {
      const r = await say(w.me, t, "証跡が書けない話");
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await h.f.admin.query("drop trigger if exists k763_fail_audit on audit_events");
      await h.f.admin.query("drop function if exists public.k763_fail_audit()");
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K763-API-021 手順 S3「文脈を組む」が失敗（組む関数が例外）：503・E-PAGE-003・何も積まない", async () => {
    const { w, t } = await ready("k763-021");
    const before = await shot(w);
    const def = (
      await q<{ def: string }>("select pg_get_functiondef('app.ticket_talk_context(uuid)'::regprocedure) as def")
    )[0]!.def;
    await h.f.admin.query(
      `create or replace function app.ticket_talk_context(p_ticket uuid) returns text language plpgsql as $$
       begin raise exception 'K-763 試験：文脈が組めない'; end $$`,
    );
    try {
      const r = await say(w.me, t, "文脈が組めない話");
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
    } finally {
      await h.f.admin.query(def);
    }
    expect(await shot(w)).toEqual(before);
    expect((await say(w.me, t, "戻した後の話")).status).toBe(201);
  });

  it("K763-API-022 DB の関数の守り（2 層目）：3 つの関数は security definer・search_path に pg_temp・public から外し、文脈を組む関数は kaname_app にも渡さない。文脈の外・書けない人・見えない人が直に呼ぶと { error } を返して何も書かない", async () => {
    const { w, t } = await ready("k763-022");
    const fn = async (name: string) =>
      (
        await q<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
          `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
                  has_function_privilege('kaname_app', p.oid, 'execute') as app
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = $1`,
          [name],
        )
      )[0]!;
    for (const name of ["ticket_talk_say", "ticket_talk_conversation", "ticket_talk_context"]) {
      const f = await fn(name);
      expect(f.definer, name).toBe(true);
      expect(f.cfg?.join(",") ?? "", name).toMatch(/search_path=.*pg_temp/);
      expect(f.pub, name).toBe(false);
      expect(f.app, name).toBe(name !== "ticket_talk_context");
    }
    const viewer = await h.f.person(w.tenantId, w.scopeA, { name: "見るだけの人", ticketAbility: "view" });
    const callAs = async (who: Person | null, sql: string, p: unknown[]) => {
      const c = await h.f.pool.connect();
      try {
        await c.query("begin");
        if (who)
          await c.query(
            "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', 'member', true)",
            [who.tenantId, who.id],
          );
        const v = (await c.query<{ v: Row }>(sql, p)).rows[0]!.v;
        await c.query("rollback");
        return v;
      } finally {
        c.release();
      }
    };
    const before = await shot(w);
    expect(await callAs(null, "select app.ticket_talk_say($1, $2) as v", [t.id, "文脈なし"])).toMatchObject({
      error: "not_member",
    });
    expect(await callAs(viewer, "select app.ticket_talk_say($1, $2) as v", [t.id, "見るだけ"])).toMatchObject({
      error: "not_writable",
    });
    expect(await callAs(w.outsider, "select app.ticket_talk_say($1, $2) as v", [t.id, "見えない"])).toMatchObject({
      error: "not_found",
    });
    expect(await callAs(w.outsider, "select app.ticket_talk_conversation($1) as v", [t.id])).toMatchObject({
      error: "not_found",
    });
    expect(await shot(w)).toEqual(before);
  });

  it("K763-API-023 任せている最中でも話せる（AI に任せる × 話す）：実行・承認待ちがあっても 201。話すは実行の記録も承認もやり取りの行も作らず、段も変えない。仕事の種類は chat", async () => {
    const { w, t } = await ready("k763-023");
    const run = await h.run(w, t.id, { status: "running", phase: "make" });
    const ap = await h.approval(w, t.id);
    const count = (sql: string) => h.count(sql, [t.id]);
    const snap = async () => ({
      runs: await count("select count(*) as n from action_runs where ticket_id = $1"),
      approvals: await count("select count(*) as n from approvals where ticket_id = $1 and decision is null"),
      msgs: await count("select count(*) as n from ticket_messages where ticket_id = $1"),
      stage: (await q<{ stage_id: string }>("select stage_id from tickets where id = $1", [t.id]))[0]!.stage_id,
    });
    const before = await snap();
    const v = await sent(w.me, t, "AI が作っている間に聞く");
    expect(await snap()).toEqual(before);
    const job = (await jobsOf(v.conversation_id))[0]!;
    expect(job.kind).toBe("chat");
    expect(job.id).not.toBe(run.jobId);
    expect(ap).toBeTruthy();
  });

  it("K763-API-024 言った後に止める（話す × 止める）：チケットの会話の仕事も会話の止める口（K-758）で止まり、仕事は取り消され、読むと running_job_id が空。止めた後はまた言える", async () => {
    const { w, t } = await ready("k763-024");
    const v = await sent(w.me, t, "止める話");
    const r = await h.call(w.me, "POST", `/conversations/${v.conversation_id}/stop`, { body: {} });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(((await h.json(r)).data as Row)["state"]).toBe("cancelled");
    expect((await jobsOf(v.conversation_id))[0]!.state_id).toBe("cancelled");
    expect((await view(w.me, t))["running_job_id"]).toBeNull();
    const again = await sent(w.me, t, "止めた後の話");
    expect(again.conversation_id).toBe(v.conversation_id);
  });

  it("K763-API-025 自分の AI との会話の選び方・一覧に混ざらない（話す × 前の会話の仕事）：チケットの会話があっても、開いている会話を選ぶ関数と会話の一覧は自分の AI との会話（clone）だけを返す", async () => {
    const { w, t } = await ready("k763-025");
    const v = await sent(w.me, t, "チケットの話");
    const opened = (
      await q<{ conv_id: string }>("select conv_id from app.agent_open_conversation($1, null, null, 'こんにちは')", [
        w.me.id,
      ])
    )[0]!;
    expect(opened.conv_id).not.toBe(v.conversation_id);
    const kind = (
      await q<{ talk_kind: string }>("select talk_kind from conversations where id = $1", [opened.conv_id])
    )[0]!;
    expect(kind.talk_kind).toBe("clone");
    const list = (
      await q<{ v: { items: { id: string }[] } }>("select app.conversation_list($1, 30, null, null) as v", [w.me.id])
    )[0]!.v;
    expect(list.items.map((x) => x.id)).toEqual([opened.conv_id]);
    const st = (await q<{ s: { conversation_id: string } }>("select app.agent_state($1, null) as s", [w.me.id]))[0]!.s;
    expect(st.conversation_id).toBe(opened.conv_id);
  });

  it("K763-API-026 会話を消した後に言う：消した会話は読めず（空の形）、言うと新しい会話ができる（消した行は残る・一意の索引に当たらない）", async () => {
    const { w, t } = await ready("k763-026");
    const first = await sent(w.me, t, "消す前の話");
    await h.f.admin.query("update conversations set deleted_at = now() where id = $1", [first.conversation_id]);
    expect(await view(w.me, t)).toMatchObject({ conversation: null, messages: [] });
    const second = await sent(w.me, t, "消した後の話");
    expect(second.conversation_id).not.toBe(first.conversation_id);
    expect(await convsOf(w.me, t)).toHaveLength(1);
    expect(
      await h.count("select count(*) as n from conversations where id = $1 and deleted_at is not null", [
        first.conversation_id,
      ]),
    ).toBe(1);
  });

  it("K763-API-027 待っている仕事が 1 つの会話に 20 を超えた：21 個目の言うは 409・E-TALK-012（K-758 と同じ番号・欄なし）。20 個目までは通り、何も増えない。終わった仕事は数えない", async () => {
    const { w, t } = await ready("k763-027");
    const first = await sent(w.me, t, "1 つ目");
    for (let i = 0; i < 19; i++) await addJob(w, first.conversation_id, w.me, "queued", { minAgo: 0 });
    const before = await shot(w);
    const r = await say(w.me, t, "21 個目");
    expect(r.status).toBe(409);
    expect(await code(r)).toBe(TOO_MANY);
    expect((await h.json(r))["details"]).toBeUndefined();
    expect(await shot(w)).toEqual(before);
    await h.f.admin.query(
      "update bridge_jobs set state_id = 'done' where id = (select id from bridge_jobs where conversation_id = $1 and state_id = 'queued' limit 1)",
      [first.conversation_id],
    );
    expect((await say(w.me, t, "1 つ空いた後")).status).toBe(201);
  });
});
