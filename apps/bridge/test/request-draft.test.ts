// K-929「Bridge が案の仕事（kind client_request_draft）を取って AI に 1 回だけ作らせ、結果を K-897 の口へ返す」の単体の試験
//   （実際の startLoop を、偽の Kaname（node:http）と偽の CLI（fake-claude.mjs）で通す。loop.test.ts と同じ組み立て）。行 ID（K929-BRG-…）は 11_tickets/K-929.md の表の行と 1 対 1。
//   偽の CLI は「答え:」＋指示文の 1 行目を返す。JSON を返させるには、仕事の prompt の 1 行目を JSON（1 行）にする。
//   偽の Kaname の結果の口：POST /api/v1/bridge/jobs/<id>/client-request-draft（K-897 の形）。答えは replies の順に返す（無ければ 200）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startLoop } from "../src/loop";
import { forgetClaude } from "../src/runner";

interface Hit {
  path: string;
  body: Record<string, unknown>;
  key: string;
}
let server: Server;
let base = "";
let hits: Hit[] = [];
let jobs: Record<string, unknown>[] = [];
let replies: number[] = [];
let sid = "";
const JOB_ID = (n: number) => `0000000${n}-0000-4000-8000-00000000000${n}`;

beforeAll(async () => {
  process.env["KANAME_CLAUDE_BIN"] = join(__dirname, "fake-claude.mjs");
  forgetClaude();
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = req.url ?? "";
      const send = (data: unknown, status = 200) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(status < 300 ? { data } : { error: "x", code: "E" }));
      };
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const path = url
        .replace(/^\/api\/auth-ext/, "")
        .replace(/^\/api\/v1/, "")
        .replace(/^\/api/, "");
      hits.push({ path, body, key: String(req.headers["idempotency-key"] ?? "") });
      if (path === "/bridge/jobs/take")
        return send(
          {
            job: req.headers["x-bridge-session"] === sid ? (jobs.shift() ?? null) : null,
            forbidden_domains: [],
            next_ms: 50,
            outdated: false,
          },
          201,
        );
      if (/\/client-request-draft$/.test(path)) {
        const status = replies.shift() ?? 200;
        return send({ state: "ready" }, status);
      }
      return send({ ok: true, stop: false, steers: [], answer: null });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
afterAll(() => {
  server.close();
  delete process.env["KANAME_CLAUDE_BIN"];
  forgetClaude();
});

const GOOD = {
  ticket: {
    title: "見積もりを作る",
    kind: "タスク",
    owner: "高本のAI",
    due: "2026-12-10",
    cost: "2 時間",
    route_name: "営業",
  },
  reply: "ご予算を教えてください",
  questions: ["いつまでですか"],
  route: { name: "営業", reason: "営業の依頼です" },
};
const job = (n: number, firstLine: string, more = ""): Record<string, unknown> => ({
  job_id: JOB_ID(n),
  prompt: `${firstLine}\n${more}===データ-${JOB_ID(n)}:ここから===\n見積もりをください\n===データ-${JOB_ID(n)}:ここまで===`,
  agent_session_id: null,
  conversation_id: null,
  kind: "client_request_draft",
});
/** 余計な口の見張りに使う合図の仕事の番号（各試験の仕事は 1〜6） */
const SENTINEL = 9;
const reports = () => hits.filter((h) => /\/client-request-draft$/.test(h.path));
const paths = () => hits.map((h) => h.path);
let gone = 0;

/** 仕事を並べて輪を回し、until が真になるまで（最大 8 秒）待つ */
async function run(list: Record<string, unknown>[], until: () => boolean, rep: number[] = []): Promise<void> {
  hits = [];
  jobs = [...list];
  replies = [...rep];
  gone = 0;
  sid = crypto.randomUUID();
  const mine = sid;
  const stop = startLoop({
    apiBase: base,
    sessionId: () => mine,
    health: async () => ({}),
    onChange: () => undefined,
    onGone: () => void gone++,
  });
  const t0 = Date.now();
  while (!until() && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 50));
  // 余計な口が後から来ないかを見る：輪が続けて取る合図の仕事（SENTINEL）の結果が届くまで待つ。輪は仕事を 1 件ずつ順に処理するので、
  // 合図より前の余計な口はこの時点で届き終わっている（固定の待ちは置かない）。合図の分は数えない。輪が止まった（401 で onGone）ときは合図を待たない
  jobs.push(job(SENTINEL, JSON.stringify(GOOD)));
  while (gone === 0 && !hits.some((h) => h.path.includes(JOB_ID(SENTINEL))) && Date.now() - t0 < 8000)
    await new Promise((r) => setTimeout(r, 50));
  stop();
  hits = hits.filter((h) => !h.path.includes(JOB_ID(SENTINEL)));
}
const noConversation = () => {
  const bad = paths().filter((p) => /\/(finish|entries|partial|progress|ask|answer2|steers)$/.test(p));
  expect(bad, "会話の口に何も送らない").toEqual([]);
};

describe("K-929 Bridge が案の仕事をこなす", { timeout: 20_000 }, () => {
  it("K929-BRG-001 返事が JSON：口 /bridge/jobs/<id>/client-request-draft に体 { draft } が 1 回届く（鍵は draft だけ・draft の鍵は ticket・reply・questions・route）・finish・entries・partial・progress は 1 回も届かない・冪等キーは draft-<job id>", async () => {
    await run([job(1, JSON.stringify(GOOD))], () => reports().length >= 1);
    expect(reports().length).toBe(1);
    const r = reports()[0]!;
    expect(r.path).toBe(`/bridge/jobs/${JOB_ID(1)}/client-request-draft`);
    expect(Object.keys(r.body)).toEqual(["draft"]);
    expect(Object.keys(r.body["draft"] as object).sort()).toEqual(["questions", "reply", "route", "ticket"]);
    expect(r.body["draft"]).toEqual(GOOD);
    expect(r.key).toBe(`draft-${JOB_ID(1)}`);
    noConversation();
  });

  it("K929-BRG-002 失敗：返事が JSON でない・空（prompt の 1 行目が飾りだけ）は体 { failed } が届き（理由は「案の形になりませんでした」か「分身の返事がありませんでした」・AI の返事の本文を含まない）、draft は届かない。finish は届かない", async () => {
    await run([job(2, "ただの文章で JSON ではありません 秘密の字")], () => reports().length >= 1);
    const r = reports()[0]!;
    expect(Object.keys(r.body)).toEqual(["failed"]);
    expect(["案の形になりませんでした", "分身の返事がありませんでした"]).toContain(r.body["failed"]);
    expect(String(r.body["failed"])).not.toContain("秘密の字");
    noConversation();
  });

  it('K929-BRG-003 入力：JSON だが形が違う（ticket が無い・title が空・配列・数字）は体 { failed: "案の形になりませんでした" }。口が 422 になる形は送らない', async () => {
    for (const [i, firstLine] of [
      [3, JSON.stringify({ reply: "x", questions: [] })],
      [4, JSON.stringify({ ticket: { title: "" }, reply: "x" })],
      [5, JSON.stringify([1, 2])],
      [6, "12345"],
    ] as const) {
      await run([job(i, firstLine)], () => reports().length >= 1);
      expect(reports().length, firstLine).toBe(1);
      expect(reports()[0]!.body, firstLine).toEqual({ failed: "案の形になりませんでした" });
    }
  });

  it("K929-BRG-004 整え：title 300 字・questions 8 個（1 つは空）・route に scope_id・ticket に知らない欄・due が日付でない・reply が 12000 字は、送る draft では title 200 字・questions 5 個（空は除く）・route は name と reason だけ・ticket は決めた欄だけ・due は日付でなければ捨て・reply は 10000 字になり、決めた欄以外は無い", async () => {
    const raw = {
      ticket: { title: "あ".repeat(300), kind: "タスク", due: "来週", ticket_id: "x", priority: "high" },
      reply: "返".repeat(12000),
      questions: ["1", "", "2", "3", "4", "5", "6", "7"],
      route: { name: "営業", reason: "理由", scope_id: "00000000-0000-4000-8000-000000000001" },
      extra: "捨てる欄",
    };
    await run([job(1, JSON.stringify(raw))], () => reports().length >= 1);
    const d = reports()[0]!.body["draft"] as {
      ticket: Record<string, unknown>;
      reply: string;
      questions: string[];
      route: Record<string, unknown>;
    };
    expect(Object.keys(d).sort()).toEqual(["questions", "reply", "route", "ticket"]);
    expect((d.ticket["title"] as string).length).toBe(200);
    expect(Object.keys(d.ticket).sort()).toEqual(["kind", "title"]);
    expect(d.reply.length).toBe(10000);
    expect(d.questions).toEqual(["1", "2", "3", "4", "5"]);
    expect(d.route).toEqual({ name: "営業", reason: "理由" });
  });

  it("K929-BRG-005 守り（道具なし）：AI が許可・問い合わせを求める（prompt の 1 行目に PERM か ASK）と、許可・問い合わせの口は 1 回も呼ばれず AI には全部断りが返る。結果は { failed } か整った { draft } のどちらか 1 回だけ届き、会話の口には何も送らない", async () => {
    for (const [i, word] of [
      [1, "PERM"],
      [2, "ASK"],
    ] as const) {
      await run([job(i, `${word} ${JSON.stringify(GOOD)}`)], () => reports().length >= 1);
      expect(reports().length, word).toBe(1);
      expect(
        paths().filter((p) => /\/ask$/.test(p)),
        word,
      ).toEqual([]);
      const body = reports()[0]!.body;
      expect(Object.keys(body).length).toBe(1);
      expect(["draft", "failed"]).toContain(Object.keys(body)[0]);
      noConversation();
    }
  });

  it('K929-BRG-006 失敗：AI が動かない（prompt の 1 行目に SILENT＝返事を返さず終わる）と体 { failed: "分身が動きませんでした" } が届き、次の仕事を取りに行く（輪が止まらない）。2 つ目の仕事（返事が JSON）が続けて処理されて { draft } が届く', async () => {
    await run([job(1, "SILENT"), job(2, JSON.stringify(GOOD))], () => reports().length >= 2);
    expect(reports().map((r) => [r.path, Object.keys(r.body)[0]])).toEqual([
      [`/bridge/jobs/${JOB_ID(1)}/client-request-draft`, "failed"],
      [`/bridge/jobs/${JOB_ID(2)}/client-request-draft`, "draft"],
    ]);
    expect(reports()[0]!.body["failed"]).toBe("分身が動きませんでした");
  });

  it("K929-BRG-007 失敗：結果の口が答える形。404（仕事がもう無い）・422 は送り直さない（1 回だけ・輪は続く）。401 は送り直さず onGone が呼ばれる", async () => {
    await run([job(1, JSON.stringify(GOOD)), job(2, JSON.stringify(GOOD))], () => reports().length >= 2, [404, 422]);
    expect(reports().length).toBe(2);
    expect(gone).toBe(0);
    await run([job(1, JSON.stringify(GOOD))], () => gone >= 1, [401]);
    expect(reports().length).toBe(1);
    expect(gone).toBeGreaterThanOrEqual(1);
  });

  it("K929-BRG-008 失敗：結果の口が 1 回目 503・2 回目 200 なら、同じ冪等キーで送り直し、2 回目で終わる（{ draft } が 2 回届き 2 回とも同じキー・3 回目は無い）", async () => {
    await run([job(1, JSON.stringify(GOOD))], () => reports().length >= 2, [503, 200]);
    expect(reports().length).toBe(2);
    expect(reports().map((r) => r.key)).toEqual([`draft-${JOB_ID(1)}`, `draft-${JOB_ID(1)}`]);
    expect(reports().map((r) => Object.keys(r.body)[0])).toEqual(["draft", "draft"]);
  });
});
