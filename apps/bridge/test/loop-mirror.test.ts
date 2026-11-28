// K-760「PC の側：会話の写しを送る・取り戻す先を読む」の Bridge 側の単体の試験（呼び先を契約の口に替えた）。
//   写しを送る：POST /api/v1/bridge/jobs/:id/conversation-entries（体 { entries }）／取り戻す先：GET /api/v1/bridge/mirror-targets
//   前の道すじ（/api/auth-ext/bridge/entries・/api/auth-ext/bridge/mirror-targets）は呼ばない。名前の頭の行 ID（K760-BR-…）は 11_tickets/K-760.md の表に結ぶ。
//   Kaname の代わりは fake-kaname.ts（K-761 が持ち込む）。本人の Claude Code の記録には触らず、一時フォルダを置き場にする。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { restoreClaude, runOneJob, startFakeKaname, useFakeClaude, type FakeKaname, type Seen } from "./fake-kaname";

const JOB = "11111111-1111-1111-1111-111111111111";
const PAST_JOB = "22222222-2222-2222-2222-222222222222";
const SESSION = "386d5cb2-fc77-4cb1-a91f-6ecb032a2a57";
const ENTRIES = `/api/v1/bridge/jobs/${JOB}/conversation-entries`;
let kaname: FakeKaname;
let mine = "";
let job: Record<string, unknown> | null = null;
let targets: unknown = [];
let projects = "";

beforeAll(async () => {
  useFakeClaude();
  projects = mkdtempSync(join(tmpdir(), "kaname-projects-"));
  mkdirSync(join(projects, "-Users-q-work"));
  writeFileSync(
    join(projects, "-Users-q-work", `${SESSION}.jsonl`),
    JSON.stringify({
      type: "assistant",
      uuid: "a2",
      message: { content: [{ type: "text", text: "記録から取り戻す返事です。" }] },
      timestamp: "2026-09-28T08:07:57.000Z",
    }),
  );
  process.env["KANAME_CLAUDE_PROJECTS"] = projects;
  kaname = await startFakeKaname({
    job: () => (job ? { ...job } : null),
    mine: () => mine,
    handler: (s) => (s.path.startsWith("/api/v1/bridge/mirror-targets") ? { data: targets } : undefined),
  });
});
afterAll(async () => {
  await kaname.close();
  delete process.env["KANAME_CLAUDE_PROJECTS"];
  restoreClaude();
});

const run = async (j: Record<string, unknown> | null, until: (p: Seen[]) => boolean): Promise<Seen[]> => {
  kaname.seen.length = 0;
  job = j;
  mine = crypto.randomUUID();
  const seen = await runOneJob(kaname, mine, until);
  job = null;
  return seen;
};
const finished = (p: Seen[]) => p.some((x) => x.path.endsWith("/finish"));
const old = (p: Seen[]) =>
  p.filter(
    (x) =>
      x.path.startsWith("/api/auth-ext/bridge/entries") || x.path.startsWith("/api/auth-ext/bridge/mirror-targets"),
  );

describe("K-760 会話の写しを送る・取り戻す先を読む（Bridge）", () => {
  it("K760-BR-001 仕事の中で返事の文ができるたびに、その仕事の道すじ（conversation-entries）へ { entries: [{ uuid, text, at }] } を POST する。PC の印つき・前の道すじは呼ばない", async () => {
    const p = await run({ job_id: JOB, prompt: "請求書", agent_session_id: null, conversation_id: "c" }, finished);
    const sent = p.filter((x) => x.path === ENTRIES);
    expect(sent.length).toBeGreaterThan(0);
    for (const x of sent) {
      expect(x.method).toBe("POST");
      expect(x.sid).toBe(mine);
      const list = x.body?.["entries"] as { uuid: string; text: string; at: string }[];
      expect(Array.isArray(list) && list.length === 1).toBe(true);
      expect(Object.keys(list[0]!).sort()).toEqual(["at", "text", "uuid"]);
      expect(x.body).not.toHaveProperty("conversation_id");
      expect(x.body).not.toHaveProperty("job_id");
    }
    expect(old(p)).toEqual([]);
  });

  it("K760-BR-002 会話の無い仕事（記憶のまとめ）は写しを送らない", async () => {
    const p = await run({ job_id: JOB, prompt: "請求書", agent_session_id: null, conversation_id: null }, finished);
    expect(p.filter((x) => x.path === ENTRIES)).toEqual([]);
  });

  it("K760-BR-003 つながったら、取り戻す先を GET /api/v1/bridge/mirror-targets で読み、記録のある物だけ、その仕事（job_id）の道すじへ写しを送る。記録が無い物は送らない。前の道すじは呼ばない", async () => {
    targets = [
      { conversation_id: "c1", agent_session_id: SESSION, job_id: PAST_JOB },
      { conversation_id: "c2", agent_session_id: "00000000-0000-0000-0000-000000000000", job_id: JOB },
    ];
    const past = `/api/v1/bridge/jobs/${PAST_JOB}/conversation-entries`;
    const p = await run(null, (x) => x.some((y) => y.path === past));
    const get = p.find((x) => x.path.startsWith("/api/v1/bridge/mirror-targets"))!;
    expect(get.method).toBe("GET");
    expect(get.sid).toBe(mine);
    const sent = p.filter((x) => x.path === past);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toEqual({
      entries: [{ uuid: "a2", text: "記録から取り戻す返事です。", at: "2026-09-28T08:07:57.000Z" }],
    });
    expect(p.filter((x) => x.path === ENTRIES)).toEqual([]);
    expect(old(p)).toEqual([]);
    targets = [];
  });

  it("K760-BR-004 取り戻す先の答えが配列でない・空のとき（古い Kaname・不調）は何も送らず、落ちない", async () => {
    for (const odd of [{ ok: true }, null, []]) {
      targets = odd;
      const p = await run(null, (x) => x.some((y) => y.path.startsWith("/api/v1/bridge/mirror-targets")));
      await new Promise((r) => setTimeout(r, 200));
      expect(p.filter((x) => x.path.endsWith("/conversation-entries"))).toEqual([]);
    }
    targets = [];
  });

  it("K760-BR-005 取り戻しの写しが 409（会話の無い仕事）で断られたら、その会話は送り直さない（仕事の終わりの取り戻しでも 1 回だけ）", async () => {
    targets = [{ conversation_id: "c1", agent_session_id: SESSION, job_id: PAST_JOB }];
    const past = `/api/v1/bridge/jobs/${PAST_JOB}/conversation-entries`;
    const down = await startFakeKaname({
      job: () => (job ? { ...job } : null),
      mine: () => mine,
      handler: (s) =>
        s.path.startsWith("/api/v1/bridge/mirror-targets")
          ? { data: targets }
          : s.path === past
            ? { status: 409, data: { code: "E-TALK-030" } }
            : undefined,
    });
    try {
      job = { job_id: JOB, prompt: "請求書", agent_session_id: null, conversation_id: "c" };
      mine = crypto.randomUUID();
      const p = await runOneJob(down, mine, (x) => x.some((y) => y.path.endsWith("/finish")));
      await new Promise((r) => setTimeout(r, 300));
      expect(p.filter((x) => x.path === past)).toHaveLength(1);
    } finally {
      job = null;
      targets = [];
      await down.close();
    }
  });
});
