// K-757「会話の置き場と読む口（getConversation・listConversations・listConversationMessages）」の単体の試験（口・本物の DB）。
//   名前の頭の行 ID（K757-API-…）は 11_tickets/K-757.md の行の表と 1 対 1。土台は同じ葉が持ち込む F5/talk.harness.ts。
// 口：GET /api/v1/conversations?limit&cursor → 200 { data: ConversationRow[], meta: { limit, cursor } }
//     GET /api/v1/conversations/:id → 200 { data: ConversationView }
//     GET /api/v1/conversations/:id/messages?limit&cursor → 200 { data: MessageView[], meta: { limit, cursor } }
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupTalk, type Person, type World } from "./talk.harness.js";

const h = setupTalk(["talk-read"], ["getConversation", "listConversations", "listConversationMessages"]);

type Row = Record<string, unknown>;
const q = async <T extends Row>(sql: string, p: unknown[] = []): Promise<T[]> =>
  (await h.f.admin.query<T>(sql, p)).rows;
const code = async (r: Response) => (await h.json(r))["code"];
const list = (who: Person | null, qs = "") => h.call(who, "GET", `/conversations${qs}`);
const view = (who: Person | null, id: string) => h.call(who, "GET", `/conversations/${id}`);
const msgs = (who: Person | null, id: string, qs = "") => h.call(who, "GET", `/conversations/${id}/messages${qs}`);
const data = async <T>(r: Response): Promise<T> => {
  expect(r.status, await r.clone().text()).toBe(200);
  return (await h.json(r)).data as T;
};
const world = (label: string) => h.world(label);
const decode = (c: string) => Buffer.from(c, "base64url").toString("utf8");
interface View {
  conversation: Row;
  messages: Row[];
  has_more: boolean;
  running_job_id: string | null;
  work: Row | null;
  stopped: Row | null;
}
const NOT_FOUND_KEYS = ["code", "error"];
const shot = async (w: World) => ({
  convs: await h.count("select count(*) as n from conversations where tenant_id = $1", [w.tenantId]),
  msgs: await h.count("select count(*) as n from messages where tenant_id = $1", [w.tenantId]),
  jobs: await h.count("select count(*) as n from bridge_jobs where tenant_id = $1", [w.tenantId]),
});

describe("K-757 会話の一覧（自分の AI との会話だけ）", () => {
  it("K757-API-001 一覧：自分の clone の会話が新しい順に並び、1 行の鍵はちょうど 4 つ（id・title・updated_at・last_text）。題の無い会話は「新しい会話」。Cache-Control は private と no-store", async () => {
    const w = await world("k757-001");
    const older = await h.conversation(w, w.me, { title: "請求書の相談", updatedMinAgo: 30 });
    const newer = await h.conversation(w, w.me, { title: null, updatedMinAgo: 1 });
    await h.message(older, { who: "me", text: "見積を確かめて", minAgo: 31 });
    await h.message(older, { who: "ai", text: "合計は 1,716,000 円です", minAgo: 30 });
    const r = await list(w.me);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const rows = await data<Row[]>(r);
    expect(rows.map((x) => x["id"])).toEqual([newer, older]);
    for (const x of rows) expect(Object.keys(x).sort()).toEqual(["id", "last_text", "title", "updated_at"]);
    expect(rows[0]).toMatchObject({ title: "新しい会話", last_text: null });
    expect(rows[1]).toMatchObject({ title: "請求書の相談", last_text: "合計は 1,716,000 円です" });
  });

  it("K757-API-002 一覧に出ない物：チケットの会話・作る画面の会話・消した会話・同じグループの別の人の会話・別の会社の会話。1 つも無ければ空の並び", async () => {
    const w = await world("k757-002");
    const t = await h.ticket(w);
    const mine = await h.conversation(w, w.me, { title: "出る" });
    await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    await h.conversation(w, w.me, { kind: "draft" });
    await h.conversation(w, w.me, { title: "消した", deleted: true });
    await h.conversation(w, w.other, { title: "同じグループの別の人" });
    const foreign = await world("k757-002-別の会社");
    await h.conversation(foreign, foreign.me, { title: "別の会社" });
    expect((await data<Row[]>(await list(w.me))).map((x) => x["id"])).toEqual([mine]);
    expect(await data<Row[]>(await list(w.outsider))).toEqual([]);
  });

  it("K757-API-003 一覧の続き：limit 2 で 5 つ読むと 2・2・1 の 3 回で全部（重ならず抜けない）。続きの鍵 cursor は文字で、最後の回は null", async () => {
    const w = await world("k757-003");
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await h.conversation(w, w.me, { title: `会話 ${i}`, updatedMinAgo: i + 1 }));
    const seen: string[] = [];
    let cursor: string | null = null;
    const sizes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await list(w.me, `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      const body = await h.json(r);
      expect(r.status).toBe(200);
      const rows = body.data as Row[];
      sizes.push(rows.length);
      seen.push(...rows.map((x) => String(x["id"])));
      cursor = (body.meta?.["cursor"] as string | null) ?? null;
      if (i < 2) expect(typeof cursor).toBe("string");
    }
    expect(sizes).toEqual([2, 2, 1]);
    expect(cursor).toBeNull();
    expect(seen).toEqual(ids);
  });

  it("K757-API-004 一覧の問い合わせの形：limit が 0・101・文字・小数、cursor が壊れた鍵、知らない項目（q・starred）は 422（欄名つき）。何も変わらない", async () => {
    const w = await world("k757-004");
    await h.conversation(w, w.me);
    for (const [qs, field] of [
      ["?limit=0", "limit"],
      ["?limit=101", "limit"],
      ["?limit=abc", "limit"],
      ["?limit=1.5", "limit"],
      ["?cursor=%%%", "cursor"],
      ["?q=請求書", "q"],
      ["?starred=true", "starred"],
    ] as const) {
      const r = await list(w.me, qs);
      expect(r.status, qs).toBe(422);
      const details = ((await h.json(r))["details"] ?? []) as { field?: string }[];
      expect(
        details.map((d) => d.field),
        qs,
      ).toContain(field);
    }
  });

  it("K757-API-005 最後の言葉：人か AI の最新の行の先頭 60 字（止まった印・知らせ・AI の案の行・記憶の行・消した行は選ばない）。行が無ければ null。未読の数は答えに出ない", async () => {
    const w = await world("k757-005");
    const c = await h.conversation(w, w.me, { title: "最後の言葉" });
    await h.message(c, { who: "ai", text: "古い返事", minAgo: 20 });
    const long = "あ".repeat(90);
    await h.message(c, { who: "me", text: long, minAgo: 6 });
    await h.message(c, { who: "stopped", text: "止めました", minAgo: 5 });
    await h.message(c, { who: "note", text: "知らせの 1 行", minAgo: 4 });
    await h.message(c, { who: "proposal", options: { proposal: { title: "題" } }, minAgo: 3 });
    await h.message(c, { who: "memo", text: "覚えた事実", minAgo: 2 });
    await h.message(c, { who: "ai", text: "消した返事", minAgo: 1, deleted: true });
    const row = (await data<Row[]>(await list(w.me))).find((x) => x["id"] === c)!;
    expect(row["last_text"]).toBe("あ".repeat(60));
    expect(row).not.toHaveProperty("unread");
  });
});

describe("K-757 1 つの会話（getConversation）", () => {
  it("K757-API-006 自分の clone の会話：200。答えの鍵はちょうど 6 つ（conversation・messages・has_more・running_job_id・work・stopped）。行の鍵はちょうど 8 つ（id・who・text・at・job_id・passed・proposal・took）。何も動いていなければ work・stopped・running_job_id は null。行が 0 件の会話（作った直後）は messages が空で has_more が false", async () => {
    const w = await world("k757-006");
    const c = await h.conversation(w, w.me, { title: "相談" });
    await h.message(c, { who: "me", text: "こんにちは", minAgo: 2 });
    await h.message(c, { who: "ai", text: "はい", minAgo: 1 });
    const r = await view(w.me, c);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const v = await data<View>(r);
    expect(Object.keys(v).sort()).toEqual([
      "conversation",
      "has_more",
      "messages",
      "running_job_id",
      "stopped",
      "work",
    ]);
    expect(v.conversation).toMatchObject({ id: c, title: "相談", talk_kind: "clone", ticket_id: null });
    expect(typeof v.conversation["updated_at"]).toBe("string");
    expect(v.messages.map((m) => [m["who"], m["text"]])).toEqual([
      ["me", "こんにちは"],
      ["ai", "はい"],
    ]);
    for (const m of v.messages)
      expect(Object.keys(m).sort()).toEqual(["at", "id", "job_id", "passed", "proposal", "took", "text", "who"]);
    expect(v.messages[0]).toMatchObject({ passed: [], proposal: null, took: null, job_id: null });
    expect([v.has_more, v.running_job_id, v.work, v.stopped]).toEqual([false, null, null, null]);
    const empty = await h.conversation(w, w.me);
    const e = await data<View>(await view(w.me, empty));
    expect([e.messages, e.has_more]).toEqual([[], false]);
  });

  it("K757-API-007 チケットの会話・作る画面の会話も自分の物なら読める：200 で conversation の talk_kind と ticket_id が出る（読む側の画面は種類ごとに口を分けない）", async () => {
    const w = await world("k757-007");
    const t = await h.ticket(w);
    const tc = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    const dc = await h.conversation(w, w.me, { kind: "draft" });
    expect((await data<View>(await view(w.me, tc))).conversation).toMatchObject({
      talk_kind: "ticket",
      ticket_id: t.id,
    });
    expect((await data<View>(await view(w.me, dc))).conversation).toMatchObject({
      talk_kind: "draft",
      ticket_id: null,
    });
  });

  it("K757-API-008 自分の会話でない・無い・消した・別の会社：どれも 404 で同じ体（code と error だけ・欄も details も無い）。同じグループの別の人の会話も 403 でなく 404（在るかを漏らさない）", async () => {
    const w = await world("k757-008");
    const theirs = await h.conversation(w, w.other);
    const gone = await h.conversation(w, w.me, { deleted: true });
    const foreign = await world("k757-008-別の会社");
    const fc = await h.conversation(foreign, foreign.me);
    const bodies: Row[] = [];
    for (const id of [theirs, gone, fc, randomUUID()]) {
      const r = await view(w.me, id);
      expect(r.status, id).toBe(404);
      const b = await h.json(r);
      expect(Object.keys(b).sort(), id).toEqual(NOT_FOUND_KEYS);
      expect(b["code"], id).toBe("NOT_FOUND");
      bodies.push(b);
    }
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
    expect((await view(w.other, theirs)).status).toBe(200);
    expect((await msgs(w.me, theirs)).status).toBe(404);
  });

  it("K757-API-009 動いている・待っている・止まった：work は state・status（作業中の 1 行）・partial（書きながらの返事）・elapsed_ms・stopping・last_at・job_id を持ち、running_job_id が出る。止まった後に何か言うと stopped は消える", async () => {
    const w = await world("k757-009");
    const c = await h.conversation(w, w.me);
    const j = await h.job(w, w.me, c, {
      state: "running",
      partial: "11 月分を見ています",
      status: "考えています…",
      ageMin: 2,
    });
    const run = await data<View>(await view(w.me, c));
    expect(run.running_job_id).toBe(j);
    expect(Object.keys(run.work!).sort()).toEqual([
      "elapsed_ms",
      "job_id",
      "last_at",
      "partial",
      "state",
      "status",
      "stopping",
    ]);
    expect(run.work).toMatchObject({
      job_id: j,
      state: "running",
      status: "考えています…",
      partial: "11 月分を見ています",
      stopping: false,
    });
    expect(Number(run.work!["elapsed_ms"])).toBeGreaterThan(0);
    await h.f.admin.query("update bridge_jobs set stop_requested_at = now() where id = $1", [j]);
    expect(((await data<View>(await view(w.me, c))).work as Row)["stopping"]).toBe(true);
    await h.f.admin.query(
      "update bridge_jobs set state_id = 'stopped', stopped_reason = 'あなたが止めました' where id = $1",
      [j],
    );
    const stopped = await data<View>(await view(w.me, c));
    expect([stopped.work, stopped.running_job_id]).toEqual([null, null]);
    expect(stopped.stopped).toEqual({ job_id: j, reason: "あなたが止めました" });
    const q2 = await h.job(w, w.me, c, { state: "queued" });
    const next = await data<View>(await view(w.me, c));
    expect(next.stopped).toBeNull();
    expect(next.running_job_id).toBe(q2);
    expect(next.work).toBeNull();
  });

  it("K757-API-010 行の種類：人は me・AI は ai・止まった印は stopped・1 行の知らせは note。AI の案の行は who が ai・text が空・proposal に案（passed は空の並び）。人の言葉の passed は直した欄の名前の並び。took は常に null。記憶（memo）・引用・添付は出ない", async () => {
    const w = await world("k757-010");
    const c = await h.conversation(w, w.me, { kind: "draft" });
    await h.message(c, { who: "me", text: "鈴木さんにも送る", options: { passed: ["title", "body"] }, minAgo: 6 });
    await h.message(c, { who: "ai", text: "踏まえました", minAgo: 5 });
    await h.message(c, {
      who: "proposal",
      options: { proposal: { title: "題の案", checks: ["宛名が正しい"] } },
      minAgo: 4,
    });
    await h.message(c, { who: "note", text: "高本が AI を止めました", minAgo: 3 });
    await h.message(c, { who: "stopped", text: "止まりました", minAgo: 2 });
    await h.message(c, { who: "memo", text: "覚えた事実 MEMO-757", minAgo: 1 });
    const v = await data<View>(await view(w.me, c));
    expect(JSON.stringify(v)).not.toContain("MEMO-757");
    expect(v.messages.map((m) => m["who"])).toEqual(["me", "ai", "ai", "note", "stopped"]);
    expect(v.messages[0]).toMatchObject({ passed: ["title", "body"], proposal: null });
    expect(v.messages[2]).toMatchObject({
      text: "",
      passed: [],
      proposal: { title: "題の案", checks: ["宛名が正しい"] },
    });
    for (const m of v.messages) {
      expect(m["took"]).toBeNull();
      for (const k of ["memory_id", "quote", "attachments", "send_state", "work"]) expect(m).not.toHaveProperty(k);
    }
  });

  it("K757-API-011 長い会話：新しい 50 件だけが古い順に出て has_more が true。ちょうど 50 件なら false。消した行は数えない", async () => {
    const w = await world("k757-011");
    const c = await h.conversation(w, w.me);
    for (let i = 0; i < 60; i++) await h.message(c, { who: i % 2 ? "ai" : "me", text: `行 ${i}`, minAgo: 100 - i });
    await h.message(c, { who: "me", text: "消した行", minAgo: 1, deleted: true });
    const v = await data<View>(await view(w.me, c));
    expect(v.messages).toHaveLength(50);
    expect(v.messages[0]!["text"]).toBe("行 10");
    expect(v.messages.at(-1)!["text"]).toBe("行 59");
    expect(v.has_more).toBe(true);
    const c2 = await h.conversation(w, w.me);
    for (let i = 0; i < 50; i++) await h.message(c2, { text: `行 ${i}`, minAgo: 100 - i });
    expect((await data<View>(await view(w.me, c2))).has_more).toBe(false);
  });

  it("K757-API-012 答えに内部の物が出ない：仕事の指示文（prompt）・agent_session_id・鍵・他人の id が JSON のどこにも入らない", async () => {
    const w = await world("k757-012");
    const c = await h.conversation(w, w.me);
    await h.f.admin.query("update conversations set agent_session_id = 'SESSION-SECRET-XYZ' where id = $1", [c]);
    const j = await h.job(w, w.me, c, { state: "running" });
    await h.f.admin.query("update bridge_jobs set prompt = 'PROMPT-SECRET-XYZ' where id = $1", [j]);
    await h.message(c, { who: "me", text: "言う", jobId: j });
    const text = await (await view(w.me, c)).text();
    expect(text).not.toContain("SESSION-SECRET-XYZ");
    expect(text).not.toContain("PROMPT-SECRET-XYZ");
    expect(text).not.toContain(w.other.id);
  });
});

describe("K-757 会話の行の続き（listConversationMessages）", () => {
  it("K757-API-013 続きを読む：limit 3 で 8 行を新しい側から 3・3・2。各回は古い順に並べて返し、cursor は「これより古い」の鍵（文字・最後は null）。重ならず抜けない", async () => {
    const w = await world("k757-013");
    const c = await h.conversation(w, w.me);
    for (let i = 0; i < 8; i++) await h.message(c, { text: `行 ${i}`, minAgo: 20 - i });
    const pages: string[][] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 3; i++) {
      const r = await msgs(w.me, c, `?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      const body = await h.json(r);
      expect(r.status).toBe(200);
      pages.push((body.data as Row[]).map((m) => String(m["text"])));
      cursor = (body.meta?.["cursor"] as string | null) ?? null;
      expect(body.meta?.["limit"]).toBe(3);
    }
    expect(pages).toEqual([
      ["行 5", "行 6", "行 7"],
      ["行 2", "行 3", "行 4"],
      ["行 0", "行 1"],
    ]);
    expect(cursor).toBeNull();
    const first = await h.json(await msgs(w.me, c, "?limit=3"));
    expect(decode(String(first.meta?.["cursor"]))).toMatch(/^\d{4}-\d{2}-\d{2}T.*\|[0-9a-f-]{36}$/);
  });

  it("K757-API-014 続きの形：limit が 0・201・文字、cursor が壊れた鍵、知らない項目は 422（欄名つき）。既定は 50 件。同じ時刻の行が並んでも鍵で抜けない・重ならない", async () => {
    const w = await world("k757-014");
    const c = await h.conversation(w, w.me);
    for (const [qs, field] of [
      ["?limit=0", "limit"],
      ["?limit=201", "limit"],
      ["?limit=x", "limit"],
      ["?cursor=%%%", "cursor"],
      ["?before=2026-01-01", "before"],
    ] as const) {
      const r = await msgs(w.me, c, qs);
      expect(r.status, qs).toBe(422);
      expect(
        ((await h.json(r))["details"] as { field?: string }[]).map((d) => d.field),
        qs,
      ).toContain(field);
    }
    for (let i = 0; i < 5; i++) await h.message(c, { text: `同じ時刻 ${i}`, minAgo: 5 });
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const body = await h.json(
        await msgs(w.me, c, `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
      );
      seen.push(...(body.data as Row[]).map((m) => String(m["id"])));
      cursor = (body.meta?.["cursor"] as string | null) ?? null;
    } while (cursor);
    expect(new Set(seen).size).toBe(5);
    expect((await data<Row[]>(await msgs(w.me, c))).length).toBe(5);
  });
});

describe("K-757 置き場（列・索引・前の道すじの関数）", () => {
  it("K757-API-015 列と決まり：前から在る会話は clone（既定値）・clone は ticket_id を持てず ticket は持つ・同じ人と同じチケットの会話は 1 つだけ（消した物は数えない・別の人は別）", async () => {
    const w = await world("k757-015");
    await h.call(w.me, "GET", "/conversations");
    const t = await h.ticket(w);
    const legacy = await h.f.admin.query<{ talk_kind: string; ticket_id: string | null }>(
      `insert into conversations (tenant_id, scope_id, owner_member_id, created_by) values ($1, $2, $3, $3) returning talk_kind, ticket_id`,
      [w.tenantId, w.scopeA, w.me.id],
    );
    expect(legacy.rows[0]).toEqual({ talk_kind: "clone", ticket_id: null });
    const ins = (kind: string, ticket: string | null, owner: Person) =>
      h.f.admin.query(
        "insert into conversations (tenant_id, scope_id, owner_member_id, talk_kind, ticket_id, created_by) values ($1, $2, $3, $4, $5, $3)",
        [w.tenantId, w.scopeA, owner.id, kind, ticket],
      );
    await expect(ins("clone", t.id, w.me)).rejects.toThrow();
    await expect(ins("ticket", null, w.me)).rejects.toThrow();
    await expect(ins("group", null, w.me)).rejects.toThrow();
    await ins("ticket", t.id, w.me);
    await expect(ins("ticket", t.id, w.me)).rejects.toThrow(/conversations_ticket_member_idx|unique|重複/);
    await ins("ticket", t.id, w.other);
    await h.f.admin.query("update conversations set deleted_at = now() where owner_member_id = $1 and ticket_id = $2", [
      w.me.id,
      t.id,
    ]);
    await ins("ticket", t.id, w.me);
  });

  it("K757-API-016 前の道すじが「開いている会話」を選ぶとき ticket・draft を拾わない（app.agent_open_conversation・app.agent_state を会話の指定なしで呼ぶ）：clone の会話が無ければ新しく作り、clone が在ればそれを選ぶ", async () => {
    const w = await world("k757-016");
    const t = await h.ticket(w);
    const tc = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id, updatedMinAgo: 0 });
    const dc = await h.conversation(w, w.me, { kind: "draft", updatedMinAgo: 0 });
    await h.message(tc, { who: "me", text: "チケットの言葉" });
    const st = await q<{ s: { conversation_id: string | null } }>("select app.agent_state($1, null) as s", [w.me.id]);
    expect(st[0]!.s.conversation_id).toBeNull();
    const opened = await q<{ conv_id: string }>(
      "select * from app.agent_open_conversation($1, null, null, '前の道すじ')",
      [w.me.id],
    );
    expect([tc, dc]).not.toContain(opened[0]!.conv_id);
    const kinds = await q<{ talk_kind: string }>("select talk_kind from conversations where id = $1", [
      opened[0]!.conv_id,
    ]);
    expect(kinds[0]!.talk_kind).toBe("clone");
    const again = await q<{ conv_id: string }>("select * from app.agent_open_conversation($1, null, null, 'x')", [
      w.me.id,
    ]);
    expect(again[0]!.conv_id).toBe(opened[0]!.conv_id);
  });

  it("K757-API-017 前の道すじの一覧・閉じる：app.agent_conversations は clone だけ。app.agent_close_conversation（会話の指定なし）は clone だけ閉じ、ticket・draft の会話は閉じない", async () => {
    const w = await world("k757-017");
    const t = await h.ticket(w);
    const cc = await h.conversation(w, w.me, { title: "clone の会話" });
    const tc = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    const dc = await h.conversation(w, w.me, { kind: "draft" });
    const l = await q<{ v: { id: string }[] }>("select app.agent_conversations($1, null) as v", [w.me.id]);
    expect(l[0]!.v.map((x) => x.id)).toEqual([cc]);
    const ok = await q<{ ok: boolean }>("select app.agent_close_conversation($1, null) as ok", [w.me.id]);
    expect(ok[0]!.ok).toBe(true);
    const closed = await q<{ id: string; closed: boolean }>(
      "select id, closed_at is not null as closed from conversations where id = any($1)",
      [[cc, tc, dc]],
    );
    expect(Object.fromEntries(closed.map((x) => [x.id, x.closed]))).toEqual({ [cc]: true, [tc]: false, [dc]: false });
  });
});

describe("K-757 失敗・守り", () => {
  it("K757-API-018 読む関数が使えない（DB の失敗）：3 つの口とも 503・E-PAGE-003。何も変わらない", async () => {
    const w = await world("k757-018");
    const c = await h.conversation(w, w.me);
    const before = await shot(w);
    const cases: [string, string][] = [
      ["app.conversation_list(uuid, integer, timestamptz, uuid)", "list"],
      ["app.conversation_view(uuid, uuid)", "view"],
      ["app.conversation_messages(uuid, uuid, timestamptz, uuid, integer)", "msgs"],
    ];
    for (const [fn, which] of cases) {
      await h.f.admin.query(`revoke execute on function ${fn} from kaname_app`);
      try {
        const r = which === "list" ? await list(w.me) : which === "view" ? await view(w.me, c) : await msgs(w.me, c);
        expect(r.status, fn).toBe(503);
        expect(await code(r), fn).toBe("E-PAGE-003");
      } finally {
        await h.f.admin.query(`grant execute on function ${fn} to kaname_app`);
      }
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K757-API-019 DB の関数の守り（2 層目）：他人の会話を直に呼ぶと null（見えない）・security definer・public から外し kaname_app だけが呼べる", async () => {
    const w = await world("k757-019");
    const c = await h.conversation(w, w.me);
    const other = await q<{ v: unknown }>("select app.conversation_view($1, $2) as v", [w.other.id, c]);
    expect(other[0]!.v).toBeNull();
    const m = await q<{ v: unknown }>("select app.conversation_messages($1, $2, null, null, 10) as v", [w.other.id, c]);
    expect(m[0]!.v).toBeNull();
    const meta = await q<{ secdef: boolean; pub: boolean }>(
      `select p.prosecdef as secdef, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('conversation_view', 'conversation_list', 'conversation_messages')`,
    );
    expect(meta).toHaveLength(3);
    for (const x of meta) expect(x).toEqual({ secdef: true, pub: false });
  });

  it("K757-API-020 ログインしていない：3 つの口とも 401。上限（1 分に 121 回）：429 と待つ秒数", async () => {
    const w = await world("k757-020");
    const c = await h.conversation(w, w.me);
    for (const r of [await list(null), await view(null, c), await msgs(null, c)]) expect(r.status).toBe(401);
    const saved = h.f.limits["getConversation"];
    delete h.f.limits["getConversation"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 121; i++) last = await view(w.me, c);
      expect(last!.status).toBe(429);
      const sec = Number((await h.json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) h.f.limits["getConversation"] = saved;
    }
  });
});
