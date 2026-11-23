// K-774「作る画面の会話の口（startDraftConversation・sendDraftMessage）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K774-API-…）は 11_tickets/K-774.md の行の表と 1 対 1。土台は K-757 が持ち込む F5/talk.harness.ts（必要な手助けは K-774.md「前提と制約」の表）。
//   口：POST /api/v1/ticket_draft_conversations（体なし）→ 201 { data: { id } }
//       POST /api/v1/ticket_draft_conversations/:id/messages ← { text, draft: { title, body, checks[] }, edited?: ("title"|"body"|"checks")[] } → 201 { data: { id, conversation_id, job_id } }
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupTalk, type Person, type World } from "./talk.harness.js";

const h = setupTalk(
  ["draft-talk", "talk-say", "talk-read"],
  ["startDraftConversation", "sendDraftMessage", "stopConversation", "getConversation"],
);

type Row = Record<string, unknown>;
const PC_NONE = "E-TALK-060";
const NOT_DRAFT = "E-TALK-061";
const TOO_MANY = "E-TALK-012";
const FILLED = {
  title: "請求書を送る",
  body: "11 月分を送る。\n金額は見積どおり。",
  checks: ["金額が見積と同じ", "宛名が正しい"],
};

const q = async <T extends Row>(sql: string, p: unknown[] = []): Promise<T[]> =>
  (await h.f.admin.query<T>(sql, p)).rows;
const code = async (r: Response) => (await h.json(r))["code"];
const start = (who: Person | null, body: unknown = {}) => h.call(who, "POST", "/ticket_draft_conversations", { body });
const say = (who: Person | null, conv: string, body: unknown) =>
  h.call(who, "POST", `/ticket_draft_conversations/${conv}/messages`, { body });
const started = async (who: Person): Promise<string> => {
  const r = await start(who);
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await h.json(r)).data as { id: string }).id;
};
const sent = async (who: Person, conv: string, text: string, draft: Row = FILLED, edited?: string[]) => {
  const r = await say(who, conv, { text, draft, ...(edited ? { edited } : {}) });
  expect(r.status, await r.clone().text()).toBe(201);
  return ((await h.json(r)).data ?? {}) as { id: string; conversation_id: string; job_id: string };
};
const jobsOf = (conv: string) =>
  q<{ id: string; prompt: string; tools: string[] | null; state_id: string; kind: string }>(
    "select id, prompt, tools, state_id, kind from bridge_jobs where conversation_id = $1 and deleted_at is null order by created_at, id",
    [conv],
  );
const msgsOf = (conv: string) =>
  q<{ id: string; body: string; kind: string; options: Row | null }>(
    "select id, body, kind, options from messages where conversation_id = $1 and deleted_at is null order by created_at, id",
    [conv],
  );
const shot = async (w: World) => ({
  convs: await h.count("select count(*) as n from conversations where tenant_id = $1", [w.tenantId]),
  msgs: await h.count("select count(*) as n from messages where tenant_id = $1", [w.tenantId]),
  jobs: await h.count("select count(*) as n from bridge_jobs where tenant_id = $1", [w.tenantId]),
  audits: await h.count("select count(*) as n from audit_events where tenant_id = $1 and action like 'draft_talk.%'", [
    w.tenantId,
  ]),
  notices: await h.count("select count(*) as n from notifications where tenant_id = $1", [w.tenantId]),
});
const ready = async (label: string, o: { pc?: boolean } = {}) => {
  const w = await h.world(label);
  if (o.pc !== false) await h.pc(w.me);
  return w;
};
/** 自分の作る画面の会話を n 個、DB に直に入れる */
const fill = async (w: World, owner: Person, n: number) => {
  for (let i = 0; i < n; i++) await h.conversation(w, owner, { kind: "draft" });
};

describe("K-774 作る画面の会話を始める", () => {
  it("K774-API-001 初めて始める：201・答えの鍵は id だけ。会話が 1 つできる（種類 draft・持ち主は自分・チケットには結ばない）・行も仕事もお知らせも 0・証跡 1（字は入れない）。PC がまだでも始められる（PC は言うときに見る）", async () => {
    const w = await ready("k774-001", { pc: false });
    const before = await shot(w);
    const r = await start(w.me);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const d = (await h.json(r)).data as Row;
    expect(Object.keys(d)).toEqual(["id"]);
    const rows = await q<{ talk_kind: string; ticket_id: string | null; owner_member_id: string }>(
      "select talk_kind, ticket_id, owner_member_id from conversations where id = $1",
      [d["id"]],
    );
    expect(rows).toEqual([{ talk_kind: "draft", ticket_id: null, owner_member_id: w.me.id }]);
    expect(await shot(w)).toEqual({ ...before, convs: before.convs + 1, audits: before.audits + 1 });
  });

  it("K774-API-002 人ごとに 50 まで・断らない：51 個目を始めると、チケットに移していない一番古い作る画面の会話が消した印になってから始まる（201・生きている会話は 50 のまま）。消した会話・チケットに移った会話・ほかの人の会話は数えず、手も付けない", async () => {
    const w = await ready("k774-002");
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) ids.push(await h.conversation(w, w.me, { kind: "draft" }));
    for (let i = 0; i < ids.length; i++)
      await h.f.admin.query("update conversations set updated_at = now() - make_interval(mins => $2) where id = $1", [
        ids[i],
        100 - i,
      ]);
    await fill(w, w.other, 60);
    const t = await h.ticket(w, { title: "移った後の会話" });
    const moved = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    await h.f.admin.query("update conversations set updated_at = now() - make_interval(mins => 500) where id = $1", [
      moved,
    ]);
    const live = () =>
      h.count(
        "select count(*) as n from conversations where owner_member_id = $1 and talk_kind = 'draft' and deleted_at is null",
        [w.me.id],
      );
    expect(await live()).toBe(50);
    const otherBefore = await h.count(
      "select count(*) as n from conversations where owner_member_id = $1 and deleted_at is null",
      [w.other.id],
    );
    const r = await start(w.me);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await live()).toBe(50);
    const gone = await q<{ id: string }>(
      "select id from conversations where owner_member_id = $1 and talk_kind = 'draft' and deleted_at is not null",
      [w.me.id],
    );
    expect(gone.map((x) => x.id)).toEqual([ids[0]]);
    expect(await h.count("select count(*) as n from conversations where id = $1 and deleted_at is null", [moved])).toBe(
      1,
    );
    expect(
      await h.count("select count(*) as n from conversations where owner_member_id = $1 and deleted_at is null", [
        w.other.id,
      ]),
    ).toBe(otherBefore);
    expect(
      await h.count("select count(*) as n from audit_events where tenant_id = $1 and action = 'draft_talk.start'", [
        w.tenantId,
      ]),
    ).toBe(1);
  });

  it("K774-API-003 50 個ある人が同時に 2 つ始める：[201, 201]・生きている会話は 50 のまま（古い 2 つが消した印になる）。消した印の会話に言うと 404", async () => {
    const w = await ready("k774-003");
    const ids: string[] = [];
    for (let i = 0; i < 50; i++) ids.push(await h.conversation(w, w.me, { kind: "draft" }));
    for (let i = 0; i < ids.length; i++)
      await h.f.admin.query("update conversations set updated_at = now() - make_interval(mins => $2) where id = $1", [
        ids[i],
        100 - i,
      ]);
    await h.pc(w.me);
    const rs = await Promise.all([start(w.me), start(w.me)]);
    expect(rs.map((x) => x.status)).toEqual([201, 201]);
    expect(
      await h.count(
        "select count(*) as n from conversations where owner_member_id = $1 and talk_kind = 'draft' and deleted_at is null",
        [w.me.id],
      ),
    ).toBe(50);
    const gone = await q<{ id: string }>(
      "select id from conversations where owner_member_id = $1 and deleted_at is not null order by updated_at",
      [w.me.id],
    );
    expect(gone.map((x) => x.id).sort()).toEqual([ids[0]!, ids[1]!].sort());
    const r = await say(w.me, ids[0]!, { text: "片付けられた会話", draft: FILLED });
    expect(r.status).toBe(404);
    expect(await h.json(r)).toMatchObject({ error: "not_found", code: "NOT_FOUND" });
  });

  it("K774-API-004 体の形：体なし・空の体は 201。知らない項目を付けると 422（何も作らない）", async () => {
    const w = await ready("k774-004");
    expect((await h.call(w.me, "POST", "/ticket_draft_conversations", {})).status).toBe(201);
    const before = await shot(w);
    for (const body of [{ title: "x" }, { talk_kind: "ticket" }, { ticket_id: randomUUID() }]) {
      expect((await start(w.me, body)).status, JSON.stringify(body)).toBe(422);
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K774-API-005 ログインしていない：401。上限（1 分に 61 回）：429 と待つ秒数（1〜60 の整数）。同意し直しの止めは入口の共通（K-53）", async () => {
    const w = await ready("k774-005");
    expect((await start(null)).status).toBe(401);
    const saved = h.f.limits["startDraftConversation"];
    delete h.f.limits["startDraftConversation"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) {
        await h.f.admin.query(
          "update conversations set deleted_at = now() where owner_member_id = $1 and talk_kind = 'draft'",
          [w.me.id],
        );
        last = await start(w.me);
      }
      expect(last!.status).toBe(429);
      const sec = Number((await h.json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) h.f.limits["startDraftConversation"] = saved;
    }
  });
});

describe("K-774 作る画面の会話に言う", () => {
  it("K774-API-006 初めて言う：201・鍵はちょうど 3 つ。人の言葉の行 1（言った字のまま・passed は空）・仕事 1（積んだ状態・種類 chat・道具は足さない）・仕事の頭に欄の中身・字が最後・お知らせ 0・証跡 1（字は入れない）", async () => {
    const w = await ready("k774-006");
    const conv = await started(w.me);
    const before = await shot(w);
    const text = "もう少し丁寧な題にしたい";
    const r = await say(w.me, conv, { text, draft: FILLED });
    expect(r.status, await r.clone().text()).toBe(201);
    const v = (await h.json(r)).data as { id: string; conversation_id: string; job_id: string };
    expect(Object.keys(v).sort()).toEqual(["conversation_id", "id", "job_id"]);
    expect(v.conversation_id).toBe(conv);
    const ms = await msgsOf(conv);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ id: v.id, body: text, kind: "human" });
    expect((ms[0]!.options?.["passed"] ?? []) as string[]).toEqual([]);
    const jobs = await jobsOf(conv);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: v.job_id, state_id: "queued", kind: "chat", tools: null });
    const p = jobs[0]!.prompt;
    expect(p).toContain("## 題名\n請求書を送る");
    expect(p).toContain("## 本文\n11 月分を送る。\n金額は見積どおり。");
    expect(p).toContain("- 金額が見積と同じ\n- 宛名が正しい");
    expect(p.endsWith(text)).toBe(true);
    expect(await shot(w)).toEqual({
      ...before,
      msgs: before.msgs + 1,
      jobs: before.jobs + 1,
      audits: before.audits + 1,
    });
    const aud = await q<{ payload: unknown; target_id: string }>(
      "select payload, target_id from audit_events where tenant_id = $1 and action = 'draft_talk.say'",
      [w.tenantId],
    );
    expect(aud).toHaveLength(1);
    expect(aud[0]!.target_id).toBe(conv);
    expect(JSON.stringify(aud[0]!.payload)).not.toContain("請求書");
  });

  it("K774-API-007 言うたびに、その時の欄の中身を渡す：1 回目と 2 回目で欄が違えば、2 つの仕事の頭がそれぞれの欄の中身。空の欄は「（まだ空です）」・空の確認項目の行は捨てる・確認項目は並びのまま・題の前後の空白は落とす", async () => {
    const w = await ready("k774-007");
    const conv = await started(w.me);
    await sent(w.me, conv, "最初の相談", { title: "", body: "", checks: [] });
    await sent(w.me, conv, "欄を書いた後の相談", {
      title: "  新しい題  ",
      body: "新しい本文",
      checks: ["二つ目", "", "   ", "一つ目"],
    });
    const [a, b] = await jobsOf(conv);
    expect(a!.prompt).toContain("## 題名\n（まだ空です）");
    expect(a!.prompt).toContain("## 本文\n（まだ空です）");
    expect(a!.prompt).toContain("## 確認項目\n（まだありません）");
    expect(b!.prompt).toContain("## 題名\n新しい題\n");
    expect(b!.prompt).toContain("## 本文\n新しい本文");
    expect(b!.prompt).toContain("- 二つ目\n- 一つ目");
    expect(b!.prompt).not.toContain("- \n");
    expect(b!.prompt).not.toContain("（まだ空です）");
  });

  it("K774-API-008 人が直した欄：edited に title と body を付けると、人の言葉の行の passed に残り（会話を読む口の passed にも出る）、仕事の頭に「人が直した欄：題名・本文」と上書きしない・案は draft_propose の道具で出す指示が入る。edited が無ければ passed は空で「人が直した欄：なし」", async () => {
    const w = await ready("k774-008");
    const conv = await started(w.me);
    const a = await sent(w.me, conv, "直した後で聞く", FILLED, ["title", "body"]);
    const b = await sent(w.me, conv, "直していない", FILLED);
    const ms = await msgsOf(conv);
    expect(ms.find((m) => m.id === a.id)!.options?.["passed"]).toEqual(["title", "body"]);
    expect((ms.find((m) => m.id === b.id)!.options?.["passed"] ?? []) as string[]).toEqual([]);
    const [pa, pb] = (await jobsOf(conv)).map((j) => j.prompt);
    expect(pa).toContain("## 人が直した欄\n題名・本文");
    expect(pa).toContain("上書きしない");
    expect(pa).toContain("draft_propose");
    expect(pb).toContain("## 人が直した欄\nなし");
    const r = await h.call(w.me, "GET", `/conversations/${conv}`);
    expect(r.status, await r.clone().text()).toBe(200);
    const view = (await h.json(r)).data as { conversation: Row; messages: { id: string; passed: string[] }[] };
    expect(view.conversation).toMatchObject({ talk_kind: "draft", ticket_id: null });
    expect(view.messages.find((m) => m.id === a.id)!.passed).toEqual(["title", "body"]);
    expect(view.messages.find((m) => m.id === b.id)!.passed).toEqual([]);
  });

  it("K774-API-009 字は書いたとおりに残る：言った字（前後の空白・全角・改行・HTML・絵文字）も本文の字（25 万字）もそのまま（切らず、正規化しない）。NUL を含む字は 422 で何も変わらない", async () => {
    const w = await ready("k774-009");
    const conv = await started(w.me);
    const odd = "　全角の空白 ＡＢＣ\n<script>alert(1)</script> 😀 \n 末尾の空白 ";
    const long = "本".repeat(250_000);
    await sent(w.me, conv, odd, { title: "題", body: long, checks: [] });
    expect((await msgsOf(conv))[0]!.body).toBe(odd);
    expect((await jobsOf(conv))[0]!.prompt).toContain(long);
    const before = await shot(w);
    expect((await say(w.me, conv, { text: "NUL\u0000あり", draft: FILLED })).status).toBe(422);
    expect((await say(w.me, conv, { text: "ふつう", draft: { ...FILLED, body: "本文\u0000あり" } })).status).toBe(422);
    expect(await shot(w)).toEqual(before);
  });

  it("K774-API-010 入力の形：text が無い・空・空白だけ・文字でない／draft が無い・title・body が文字でない・checks が文字の並びでない／edited に知らない値・重なり・4 つ以上／知らない項目（外も draft の中も）：どれも 422（欄名つき）で何も増えない", async () => {
    const w = await ready("k774-010");
    const conv = await started(w.me);
    const before = await shot(w);
    const bad: [string, Row][] = [
      ["text", { draft: FILLED }],
      ["text", { text: "", draft: FILLED }],
      ["text", { text: "\n\t　 ", draft: FILLED }],
      ["text", { text: 5, draft: FILLED }],
      ["draft", { text: "a" }],
      ["draft", { text: "a", draft: "題" }],
      ["draft", { text: "a", draft: { ...FILLED, title: 1 } }],
      ["draft", { text: "a", draft: { ...FILLED, body: null } }],
      ["draft", { text: "a", draft: { ...FILLED, checks: "文" } }],
      ["draft", { text: "a", draft: { ...FILLED, checks: [1] } }],
      ["draft", { text: "a", draft: { title: "題" } }],
      ["draft", { text: "a", draft: { ...FILLED, memo: "x" } }],
      ["edited", { text: "a", draft: FILLED, edited: ["done"] }],
      ["edited", { text: "a", draft: FILLED, edited: ["title", "title"] }],
      ["edited", { text: "a", draft: FILLED, edited: ["title", "body", "checks", "title"] }],
      ["edited", { text: "a", draft: FILLED, edited: "title" }],
      ["quote", { text: "a", draft: FILLED, quote: { text: "x" } }],
    ];
    for (const [field, body] of bad) {
      const r = await say(w.me, conv, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      const d = (await h.json(r))["details"] as { field: string }[] | undefined;
      expect(
        d?.some((x) => x.field.startsWith(field)),
        JSON.stringify(body),
      ).toBe(true);
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K774-API-011 制限の境目：題が 200 字ちょうど・確認項目が 50 件ちょうど・1 件が 200 字ちょうどは 201。題が 201 字・確認項目が 51 件・1 件が 201 字は 422（欄 draft）。空だけの確認項目の行は数えて 422 にならない範囲なら捨てられる", async () => {
    const w = await ready("k774-011");
    const conv = await started(w.me);
    const ok = await sent(w.me, conv, "境目", {
      title: "題".repeat(200),
      body: "",
      checks: ["確".repeat(200), ...Array.from({ length: 48 }, (_, i) => `項目 ${i}`), "  "],
    });
    expect(ok.job_id).toBeTruthy();
    const before = await shot(w);
    for (const draft of [
      { title: "題".repeat(201), body: "", checks: [] },
      { title: "題", body: "", checks: Array.from({ length: 51 }, (_, i) => `項目 ${i}`) },
      { title: "題", body: "", checks: ["確".repeat(201)] },
    ]) {
      const r = await say(w.me, conv, { text: "超える", draft });
      expect(r.status).toBe(422);
      expect(((await h.json(r))["details"] as { field: string }[]).some((x) => x.field.startsWith("draft"))).toBe(true);
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K774-API-012 PC がまだつながっていない・外した直後：409・E-TALK-060（文は PC をつなぐ案内・欄なし）。行も仕事も証跡も残らない（会話は残り、PC をつなげばそのまま言える）", async () => {
    const w = await ready("k774-012", { pc: false });
    const conv = await started(w.me);
    const before = await shot(w);
    const r = await say(w.me, conv, { text: "PC が無いまま話す", draft: FILLED });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe(PC_NONE);
    expect(String((await h.json(r))["message"] ?? "")).toContain("PC をつなぐ");
    expect((await h.json(r))["details"]).toBeUndefined();
    expect(await shot(w)).toEqual(before);
    const sid = await h.pc(w.me);
    await sent(w.me, conv, "つないだので話す");
    await h.f.admin.query("update sessions set revoked_at = now() where id = $1", [sid]);
    const r2 = await say(w.me, conv, { text: "外した直後", draft: FILLED });
    expect(r2.status).toBe(409);
    expect(await code(r2)).toBe(PC_NONE);
    expect(await msgsOf(conv)).toHaveLength(1);
  });

  it("K774-API-013 指した会話が無い・見えない：無い id・消した会話・別の会社の人・同じグループのほかの人の会話は 404（在るかを漏らさない・403 にしない・欄なし）。何も増えない", async () => {
    const w = await ready("k774-013");
    const conv = await started(w.me);
    const gone = await started(w.me);
    await h.f.admin.query("update conversations set deleted_at = now() where id = $1", [gone]);
    const foreign = await h.world("k774-013-別の会社");
    await h.pc(foreign.me);
    await h.pc(w.other);
    const before = await shot(w);
    for (const [who, id] of [
      [w.me, randomUUID()],
      [w.me, gone],
      [foreign.me, conv],
      [w.other, conv],
      [w.outsider, conv],
    ] as [Person, string][]) {
      const r = await say(who, id, { text: "他人の会話", draft: FILLED });
      expect(r.status).toBe(404);
      const b = await h.json(r);
      expect(b).toMatchObject({ error: "not_found", code: "NOT_FOUND" });
      expect(b["details"]).toBeUndefined();
      expect(b["field"]).toBeUndefined();
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K774-API-014 作る画面の会話でない会話に言う（自分の AI との会話・チケットに移った後の会話）：409・E-TALK-061・何も積まない", async () => {
    const w = await ready("k774-014");
    const clone = await h.conversation(w, w.me, { kind: "clone" });
    const t = await h.ticket(w, { title: "作った後のチケット" });
    const moved = await h.conversation(w, w.me, { kind: "ticket", ticket: t.id });
    const before = await shot(w);
    for (const id of [clone, moved]) {
      const r = await say(w.me, id, { text: "作る画面の言葉", draft: FILLED });
      expect(r.status).toBe(409);
      expect(await code(r)).toBe(NOT_DRAFT);
      expect((await h.json(r))["details"]).toBeUndefined();
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K774-API-015 続けて言う・同時に 2 つ：同じ会話に行と仕事が積まれる（行 2・仕事 2 が積んだ状態・順番待ち）。[201, 201]", async () => {
    const w = await ready("k774-015");
    const conv = await started(w.me);
    await sent(w.me, conv, "1 つ目");
    const rs = await Promise.all([
      say(w.me, conv, { text: "同時 A", draft: FILLED }),
      say(w.me, conv, { text: "同時 B", draft: FILLED }),
    ]);
    expect(rs.map((x) => x.status)).toEqual([201, 201]);
    expect(await msgsOf(conv)).toHaveLength(3);
    expect((await jobsOf(conv)).map((j) => j.state_id)).toEqual(["queued", "queued", "queued"]);
  });

  it("K774-API-016 言った直後に止める（言う × 止める）：作る画面の会話の仕事も会話の止める口（K-758）で止まる（state が cancelled・仕事は取り消し）。止めた後はまた言える", async () => {
    const w = await ready("k774-016");
    const conv = await started(w.me);
    await sent(w.me, conv, "止める話");
    const r = await h.call(w.me, "POST", `/conversations/${conv}/stop`, { body: {} });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(((await h.json(r)).data as Row)["state"]).toBe("cancelled");
    expect((await jobsOf(conv))[0]!.state_id).toBe("cancelled");
    await sent(w.me, conv, "止めた後の話");
    expect(await msgsOf(conv)).toHaveLength(2);
  });

  it("K774-API-017 S3 の失敗：手順 S1「DB に書く」が失敗（関数が使えない）：503・E-PAGE-003。行・仕事・証跡のどれも増えない（言った字・欄の中身をログに出さない）", async () => {
    const w = await ready("k774-017");
    const conv = await started(w.me);
    const before = await shot(w);
    await h.f.admin.query("revoke execute on function app.draft_talk_say(uuid, text, jsonb, jsonb) from kaname_app");
    try {
      const logs = await h.captureLogs(async () => {
        const r = await say(w.me, conv, {
          text: "秘密の相談 K774-LOG",
          draft: { ...FILLED, body: "秘密の本文 K774-BODY" },
        });
        expect(r.status).toBe(503);
        expect(await code(r)).toBe("E-PAGE-003");
      });
      expect(logs).not.toContain("K774-LOG");
      expect(logs).not.toContain("K774-BODY");
    } finally {
      await h.f.admin.query("grant execute on function app.draft_talk_say(uuid, text, jsonb, jsonb) to kaname_app");
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K774-API-018 手順 S2「証跡」が失敗（証跡の書き込みが例外）：503・E-PAGE-003。同じ取引なので人の言葉の行も仕事も残らない。始める口の証跡が失敗しても会話は残らない", async () => {
    const w = await ready("k774-018");
    const conv = await started(w.me);
    const before = await shot(w);
    await h.f.admin.query(
      `create or replace function public.k774_fail_audit() returns trigger language plpgsql as $$
       begin if new.action like 'draft_talk.%' then raise exception 'K-774 試験：証跡が書けない'; end if; return new; end $$`,
    );
    await h.f.admin.query(
      "create trigger k774_fail_audit before insert on audit_events for each row execute function public.k774_fail_audit()",
    );
    try {
      const r = await say(w.me, conv, { text: "証跡が書けない話", draft: FILLED });
      expect(r.status).toBe(503);
      expect(await code(r)).toBe("E-PAGE-003");
      const s = await start(w.me);
      expect(s.status).toBe(503);
      expect(await code(s)).toBe("E-PAGE-003");
    } finally {
      await h.f.admin.query("drop trigger if exists k774_fail_audit on audit_events");
      await h.f.admin.query("drop function if exists public.k774_fail_audit()");
    }
    expect(await shot(w)).toEqual(before);
  });

  it("K774-API-019 DB の関数の守り（2 層目）：始める・言う関数は security definer・search_path に pg_temp・public から外し kaname_app だけ。文脈を組む関数は kaname_app にも渡さない。文脈の外は not_member・ほかの人の会話は not_found・欄の誤りは draft_invalid を返し何も書かない", async () => {
    const w = await ready("k774-019");
    const conv = await started(w.me);
    const fn = async (name: string) =>
      (
        await q<{ definer: boolean; cfg: string[] | null; pub: boolean; app: boolean }>(
          `select p.prosecdef as definer, p.proconfig as cfg, has_function_privilege('public', p.oid, 'execute') as pub,
                  has_function_privilege('kaname_app', p.oid, 'execute') as app
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = $1`,
          [name],
        )
      )[0]!;
    for (const name of ["draft_talk_start", "draft_talk_say", "draft_talk_context"]) {
      const f = await fn(name);
      expect(f.definer, name).toBe(true);
      expect(f.cfg?.join(",") ?? "", name).toMatch(/search_path=.*pg_temp/);
      expect(f.pub, name).toBe(false);
      expect(f.app, name).toBe(name !== "draft_talk_context");
    }
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
    const sql = "select app.draft_talk_say($1, $2, $3::jsonb, $4::jsonb) as v";
    const before = await shot(w);
    expect(await callAs(null, "select app.draft_talk_start() as v", [])).toMatchObject({ error: "not_member" });
    expect(await callAs(null, sql, [conv, "文脈なし", JSON.stringify(FILLED), "[]"])).toMatchObject({
      error: "not_member",
    });
    expect(await callAs(w.other, sql, [conv, "他人", JSON.stringify(FILLED), "[]"])).toMatchObject({
      error: "not_found",
    });
    expect(
      await callAs(w.me, sql, [conv, "形の誤り", JSON.stringify({ ...FILLED, title: "題".repeat(201) }), "[]"]),
    ).toMatchObject({ error: "draft_invalid" });
    expect(await callAs(w.me, sql, [conv, "  ", JSON.stringify(FILLED), "[]"])).toMatchObject({ error: "text_empty" });
    expect(await shot(w)).toEqual(before);
  });

  it("K774-API-020 ログインしていない：401。上限（1 分に 61 回）：429 と待つ秒数。入口の uuid・同意し直しの止めは共通（K144-API-929・K-53）", async () => {
    const w = await ready("k774-020");
    const conv = await started(w.me);
    expect((await say(null, conv, { text: "x", draft: FILLED })).status).toBe(401);
    const saved = h.f.limits["sendDraftMessage"];
    delete h.f.limits["sendDraftMessage"];
    try {
      let last: Response | null = null;
      for (let i = 0; i < 61; i++) last = await say(w.me, conv, { text: `上限 ${i}`, draft: FILLED });
      expect(last!.status).toBe(429);
      const sec = Number((await h.json(last!))["retry_after_sec"]);
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      if (saved !== undefined) h.f.limits["sendDraftMessage"] = saved;
    }
  });

  it("K774-API-021 停止・グループから外された人（利用者の状態）：停止された人は始めるも言うも 403、何も増えない。会話の行は残る", async () => {
    const w = await ready("k774-021");
    const conv = await started(w.me);
    await h.f.admin.query("update members set suspended_at = now() where id = $1", [w.me.id]);
    const before = await shot(w);
    const a = await say(w.me, conv, { text: "停止した後の話", draft: FILLED });
    const b = await start(w.me);
    expect(a.status).toBe(403);
    expect(b.status).toBe(403);
    expect(await shot(w)).toEqual(before);
  });

  it("K774-API-022 自分の AI との会話の選び方・一覧に混ざらない（作る画面の会話 × 前の会話の仕事）：作る画面の会話が最新でも、開いている会話を選ぶ関数と会話の一覧は自分の AI との会話（clone）だけを返す", async () => {
    const w = await ready("k774-022");
    const conv = await started(w.me);
    await sent(w.me, conv, "作る画面の話");
    const opened = (
      await q<{ conv_id: string }>("select conv_id from app.agent_open_conversation($1, null, null, 'こんにちは')", [
        w.me.id,
      ])
    )[0]!;
    expect(opened.conv_id).not.toBe(conv);
    expect(
      (await q<{ talk_kind: string }>("select talk_kind from conversations where id = $1", [opened.conv_id]))[0]!
        .talk_kind,
    ).toBe("clone");
    const list = (
      await q<{ v: { items: { id: string }[] } }>("select app.conversation_list($1, 30, null, null) as v", [w.me.id])
    )[0]!.v;
    expect(list.items.map((x) => x.id)).toEqual([opened.conv_id]);
  });

  it("K774-API-023 待っている仕事が 1 つの会話に 20 を超えた：21 個目の言うは 409・E-TALK-012（K-758 と同じ番号・欄なし・始める側の 50 個の片付けとは別）。何も増えず、1 つ終われば通る", async () => {
    const w = await ready("k774-023");
    const conv = await started(w.me);
    await sent(w.me, conv, "1 つ目");
    for (let i = 0; i < 19; i++)
      await h.f.admin.query(
        "insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, created_by) values ($1, $2, $3, $4, 'queued', '（試験）', $3)",
        [w.tenantId, w.scopeA, w.me.id, conv],
      );
    const before = await shot(w);
    const r = await say(w.me, conv, { text: "21 個目", draft: FILLED });
    expect(r.status).toBe(409);
    expect(await code(r)).toBe(TOO_MANY);
    expect((await h.json(r))["details"]).toBeUndefined();
    expect(await shot(w)).toEqual(before);
    await h.f.admin.query(
      "update bridge_jobs set state_id = 'done' where id = (select id from bridge_jobs where conversation_id = $1 and state_id = 'queued' limit 1)",
      [conv],
    );
    expect((await say(w.me, conv, { text: "1 つ空いた後", draft: FILLED })).status).toBe(201);
  });
});
