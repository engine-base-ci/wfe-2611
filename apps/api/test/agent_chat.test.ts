// 自分のAIとの会話の作り込み（D-104・T-B-15〜T-B-22）を本物の Postgres（RLS あり）で通す。
//   会話を分ける（新しく・名前・星・記憶に残さない・消す・見た）／同じ会話は 1 本ずつ（順番待ち）／
//   書きながらの返事・何をしているか・手順・使用量／止める・止めずに直す／止まった理由だけ／
//   許可の 3 択＋一言・いつも許可 → 次の仕事の引数・取り消し／全部許可は既定にできない／資料を付ける → 署名 URL
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { pendingToken } from "./_pending.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const X = "/api/auth-ext";
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const post = (path: string, body: unknown, h: Record<string, string> = {}) => req("POST", path, body, h);
const json = async <T>(r: Response | Promise<Response>) => ((await (await r).json()) as { data: T }).data;
const uniq = () => `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  const appPool = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(appPool);
  const { auth } = createAuth({
    authDatabaseUrl: AUTH_URL,
    appPool,
    secret: "test-secret-0123456789-abcdefghijklmnop",
    baseURL: "http://localhost:3001",
    webBaseURL: "http://localhost:3123",
    mailer: async () => undefined,
  });
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "kaname-obj-"))), {
    signingSecret: "test-files",
    maxBytes: 1024 * 1024,
  });
  app = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, appPool),
    authExt: authExt({
      auth,
      appPool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }),
      repo,
      secrets,
      objects,
      mailer: async (m) => void sent.push({ to: m.to, url: m.url, kind: m.kind }),
      config: {
        secretsMasterKey: "test-master",
        baseUrl: "http://localhost:3001",
        webBaseUrl: "http://localhost:3123",
        opsEmail: "ops@example.com",
        env: "test" as const,
      },
    }),
  });
}, 60_000);

/** 登録（確認メールを通す）→ Bridge をつなぐ */
async function ready() {
  const email = `${uniq()}@example.com`;
  // 申し込みは直に置き、確認だけを通す（前の道すじ /sign-up は K-51 で契約の口に移した）
  const token = await pendingToken(AUTH_URL, "test-master", { email, password: PW, companyName: "K" });
  const ver = await json<{ token: string }>(post("/verify-signup", { token }));
  const H = { authorization: `Bearer ${ver.token}` };
  const pair = await json<{ code: string }>(post("/bridge/pair", {}, H));
  const claim = await json<{ session_id: string }>(
    post("/bridge/claim", { code: pair.code, device_label: "QA の PC" }),
  );
  const B = { "x-bridge-session": claim.session_id };
  const member = (await admin.query("select member_id from sessions where id = $1", [claim.session_id])).rows[0]
    .member_id as string;
  return { H, B, member };
}
type Take = {
  job_id: string;
  permission_mode: string;
  model: string | null;
  effort: string | null;
  allowed_tools: string[];
  attachments: { id: string; name: string }[];
  conversation_id: string;
} | null;
type State = {
  conversation: { id: string; title: string } | null;
  messages: { who: string; text: string; work: { ops: number; ms: number } | null; job_id: string | null }[];
  work: {
    job_id: string;
    status: string | null;
    plan: { content: string; status: string }[] | null;
    partial: string | null;
    stopping: boolean;
    permission_mode: string;
  } | null;
  queued: { job_id: string; text: string }[];
  usage: Record<string, { utilization: number }>;
};

describe("会話を分ける（D-104.1〜D-104.4）", () => {
  it("新しく話す → 名前は最初の言葉から自動・直せる・星・見た・消す。他人の会話は触れない", async () => {
    const { H } = await ready();
    const say = await json<{ conversation_id: string; job_id: string }>(
      post("/agent/say", { text: "9 月の請求書をまとめて" }, H),
    );
    const list = await json<{ id: string; title: string; unread: boolean }[]>(
      req("GET", "/agent/conversations", undefined, H),
    );
    expect(list.find((c) => c.id === say.conversation_id)?.title).toContain("9 月の請求書");
    expect(
      (await req("PATCH", `/agent/conversations/${say.conversation_id}`, { title: "請求の相談", starred: true }, H))
        .status,
    ).toBe(200);
    expect(
      (await req("PATCH", `/agent/conversations/${say.conversation_id}`, { title: "  " }, H)).status,
      "空の名前は 422",
    ).toBe(422);
    const hit = await json<{ id: string; title: string }[]>(
      req("GET", "/agent/conversations?q=%E8%AB%8B%E6%B1%82", undefined, H),
    );
    expect(hit.map((c) => c.title)).toContain("請求の相談");
    expect((await post(`/agent/conversations/${say.conversation_id}/read`, {}, H)).status).toBe(200);
    const other = await ready();
    expect(
      (await req("PATCH", `/agent/conversations/${say.conversation_id}`, { title: "乗っ取り" }, other.H)).status,
      "他人の会話は 404",
    ).toBe(404);
    expect((await req("DELETE", `/agent/conversations/${say.conversation_id}`, undefined, other.H)).status).toBe(404);
    expect((await req("DELETE", `/agent/conversations/${say.conversation_id}`, undefined, H)).status).toBe(200);
    const after = await json<{ id: string }[]>(req("GET", "/agent/conversations", undefined, H));
    expect(after.some((c) => c.id === say.conversation_id)).toBe(false);
    expect(
      (await post("/agent/say", { text: "続き", conversation_id: say.conversation_id }, H)).status,
      "消した会話には送れない",
    ).toBe(404);
  });
  it("新しい会話を空で作れ、記憶に残さない会話にもできる", async () => {
    const { H } = await ready();
    const c = await json<{ conversation_id: string }>(post("/agent/conversations", { incognito: true }, H));
    const row = (await admin.query("select incognito from conversations where id = $1", [c.conversation_id])).rows[0];
    expect(row.incognito).toBe(true);
  });
});

describe("長い会話（D-104.18）", () => {
  it("いまは新しい 200 件。上へ戻ると、それより前を 100 件ずつ読み込める。他人の会話は読めない", async () => {
    const { H, B } = await ready();
    const s = await json<{ conversation_id: string; job_id: string }>(post("/agent/say", { text: "はじめ" }, H));
    await post("/bridge/take", { protocol: 4 }, B);
    await post("/bridge/finish", { job_id: s.job_id, state: "done", result: "はい" }, B);
    await admin.query(
      "insert into messages (tenant_id, conversation_id, body, kind, created_at) select c.tenant_id, c.id, '古い ' || g, 'ai', now() - interval '1 day' + g * interval '1 second' from conversations c, generate_series(1, 250) g where c.id = $1",
      [s.conversation_id],
    );
    const st = await json<{ messages: { at: string; text: string }[] }>(
      req("GET", `/agent/state?conversation_id=${s.conversation_id}`, undefined, H),
    );
    expect(st.messages.length).toBe(200);
    const p1 = await json<{ messages: { text: string }[]; has_more: boolean }>(
      req(
        "GET",
        `/agent/messages?conversation_id=${s.conversation_id}&before=${encodeURIComponent(st.messages[0]!.at)}`,
        undefined,
        H,
      ),
    );
    expect(p1.messages.length).toBe(52);
    expect(p1.messages[0]!.text).toBe("古い 1");
    expect(p1.has_more).toBe(false);
    const other = await ready();
    expect(
      (
        await req(
          "GET",
          `/agent/messages?conversation_id=${s.conversation_id}&before=${encodeURIComponent(st.messages[0]!.at)}`,
          undefined,
          other.H,
        )
      ).status,
    ).toBe(404);
  });
});

describe("同じ会話は 1 本ずつ・書きながらの返事・止める・止めずに直す（D-104.8・D-104.9）", () => {
  it("動いている間の 2 通目は順番待ちで、前が終わるまで Bridge に渡らない", async () => {
    const { H, B } = await ready();
    const a = await json<{ conversation_id: string; job_id: string }>(post("/agent/say", { text: "1 つ目" }, H));
    expect((await json<Take>(post("/bridge/take", { protocol: 4 }, B)))?.job_id).toBe(a.job_id);
    const b = await json<{ job_id: string }>(
      post("/agent/say", { text: "2 つ目", conversation_id: a.conversation_id }, H),
    );
    expect(
      await json<Take>(post("/bridge/take", { protocol: 4 }, B)),
      "同じ会話の前が動いている間は渡さない",
    ).toBeNull();
    const st = await json<State>(req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, H));
    expect(st.queued.map((q) => q.text)).toEqual(["2 つ目"]);
    expect((await post("/bridge/finish", { job_id: a.job_id, state: "done", result: "済" }, B)).status).toBe(200);
    expect((await json<Take>(post("/bridge/take", { protocol: 4 }, B)))?.job_id).toBe(b.job_id);
  });
  it("書きながらの返事・何をしているか・手順・使用量が いま に出て、終わると返事と作業の記録（ops・ms）が残る", async () => {
    const { H, B } = await ready();
    const a = await json<{ conversation_id: string; job_id: string }>(post("/agent/say", { text: "台帳を見て" }, H));
    await post("/bridge/take", { protocol: 4 }, B);
    expect((await post("/bridge/partial", { job_id: a.job_id, text: "台帳を" }, B)).status).toBe(200);
    await post("/bridge/progress", { job_id: a.job_id, seq: 1, kind: "status", text: "読んでいます：/w/台帳.csv" }, B);
    await post(
      "/bridge/progress",
      {
        job_id: a.job_id,
        seq: 2,
        kind: "plan",
        todos: [
          { content: "読む", status: "completed" },
          { content: "まとめる", status: "in_progress" },
        ],
      },
      B,
    );
    await post(
      "/bridge/progress",
      {
        job_id: a.job_id,
        seq: 3,
        kind: "limit",
        windows: [
          { window: "five_hour", utilization: 0.42, resets_at: 1790000000 },
          { window: "bogus", utilization: 1, resets_at: 1 },
        ],
      },
      B,
    );
    await post(
      "/bridge/progress",
      { job_id: a.job_id, seq: 4, kind: "tool", tool: { name: "Read", target: "/w/台帳.csv", ok: true, ms: 12 } },
      B,
    );
    const st = await json<State>(req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, H));
    expect(st.work).toMatchObject({
      job_id: a.job_id,
      status: "読んでいます：/w/台帳.csv",
      partial: "台帳を",
      plan: [
        { content: "読む", status: "completed" },
        { content: "まとめる", status: "in_progress" },
      ],
    });
    expect(st.usage["five_hour"]?.utilization).toBeCloseTo(0.42);
    expect(Object.keys(await json<Record<string, unknown>>(req("GET", "/agent/usage", undefined, H)))).toEqual([
      "five_hour",
    ]);
    await post("/bridge/finish", { job_id: a.job_id, state: "done", result: "3 件ありました" }, B);
    const done = await json<State>(req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, H));
    expect(done.work).toBeNull();
    expect(done.messages.at(-1)).toMatchObject({ who: "ai", text: "3 件ありました", job_id: a.job_id });
    expect(done.messages.at(-1)!.work?.ops).toBe(1);
  });
  it("止めずに直す：一言は順番待ちに入り（取り消せる）、区切りで Bridge が取ったときに吹き出しになる。取った後は取り消せない。終わった仕事には 409", async () => {
    const { H, B } = await ready();
    const a = await json<{ conversation_id: string; job_id: string }>(post("/agent/say", { text: "見積を作って" }, H));
    await post("/bridge/take", { protocol: 4 }, B);
    expect((await post("/agent/steer", { job_id: a.job_id, text: "税込で" }, H)).status).toBe(201);
    expect((await post("/agent/steer", { job_id: a.job_id, text: "やっぱり今のは無し" }, H)).status).toBe(201);
    const st0 = await json<State & { queued: { id: string; kind: string; text: string }[] }>(
      req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, H),
    );
    expect(st0.queued.map((q) => [q.kind, q.text])).toEqual([
      ["steer", "税込で"],
      ["steer", "やっぱり今のは無し"],
    ]);
    expect(
      st0.messages.map((m) => m.text),
      "渡すまでは吹き出しにしない",
    ).toEqual(["見積を作って"]);
    expect((await req("DELETE", `/agent/steer/${st0.queued[1]!.id}`, undefined, H)).status).toBe(200);
    expect(
      (await json<{ stop: boolean }>(post("/bridge/control", { job_id: a.job_id }, B))).stop,
      "止める合図は出ない",
    ).toBe(false);
    const t1 = await json<{ steers: { text: string }[] }>(
      post("/bridge/steers", { job_id: a.job_id, reply: "税抜で作りました" }, B),
    );
    expect(
      t1.steers.map((s) => s.text),
      "取り消したものは渡さない",
    ).toEqual(["税込で"]);
    expect(
      (await json<{ steers: unknown[] }>(post("/bridge/steers", { job_id: a.job_id }, B))).steers,
      "2 回目は空（1 回だけ渡す）",
    ).toEqual([]);
    expect(
      (await req("DELETE", `/agent/steer/${st0.queued[0]!.id}`, undefined, H)).status,
      "渡した後は取り消せない",
    ).toBe(409);
    await post("/bridge/finish", { job_id: a.job_id, state: "done", result: "税込に直しました" }, B);
    const st = await json<State>(req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, H));
    expect(
      st.messages.map((m) => [m.who, m.text]),
      "読む順＝起きた順",
    ).toEqual([
      ["me", "見積を作って"],
      ["ai", "税抜で作りました"],
      ["me", "税込で"],
      ["ai", "税込に直しました"],
    ]);
    expect(st.queued).toEqual([]);
    expect((await post("/agent/steer", { job_id: a.job_id, text: "やっぱり" }, H)).status).toBe(409);
  });
  it("止める：動いているものは Bridge に合図が出て、止まった理由だけが残る。順番待ちはそのまま取り消す。他人は止められない", async () => {
    const { H, B } = await ready();
    const a = await json<{ conversation_id: string; job_id: string }>(post("/agent/say", { text: "長い仕事" }, H));
    await post("/bridge/take", { protocol: 4 }, B);
    const q = await json<{ job_id: string }>(
      post("/agent/say", { text: "次の仕事", conversation_id: a.conversation_id }, H),
    );
    const other = await ready();
    expect((await post("/agent/stop", { job_id: a.job_id }, other.H)).status).toBe(404);
    expect(await json<{ state: string }>(post("/agent/stop", { job_id: q.job_id }, H))).toEqual({ state: "cancelled" });
    expect(await json<{ state: string }>(post("/agent/stop", { job_id: a.job_id }, H))).toEqual({ state: "stopping" });
    expect((await json<{ stop: boolean }>(post("/bridge/control", { job_id: a.job_id }, B))).stop).toBe(true);
    const mid = await json<State>(req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, H));
    expect(mid.work?.stopping).toBe(true);
    await post("/bridge/finish", { job_id: a.job_id, state: "stopped", reason: "あなたが止めました" }, B);
    const st = await json<State>(req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, H));
    expect(st.messages.at(-1)).toMatchObject({ who: "stopped", text: "あなたが止めました" });
    expect(st.queued).toEqual([]);
  });
});

describe("引用して続ける（D-104.17）", () => {
  it("吹き出しは本人の文のまま、自分のAI への指示には引用した文が添わる", async () => {
    const { H, B } = await ready();
    const s = await json<{ conversation_id: string; job_id: string }>(
      post("/agent/say", { text: "ここを詳しく", quote: { text: "1 件が送付済み", message_id: null } }, H),
    );
    const t = await json<{ prompt: string } | null>(post("/bridge/take", { protocol: 4 }, B));
    expect(t?.prompt).toContain("1 件が送付済み");
    expect(t?.prompt).toContain("ここを詳しく");
    const st = await json<State>(req("GET", `/agent/state?conversation_id=${s.conversation_id}`, undefined, H));
    expect(st.messages.at(-1)).toMatchObject({ who: "me", text: "ここを詳しく" });
  });
});

describe("直して送り直す（D-104.17）", () => {
  it("新しい会話ができ、直した文より前のやりとりが写り、自分のAI にも添わる。元の会話は残る", async () => {
    const { H, B } = await ready();
    const a = await json<{ conversation_id: string; job_id: string }>(post("/agent/say", { text: "売上を見て" }, H));
    await post("/bridge/take", { protocol: 4 }, B);
    await post("/bridge/finish", { job_id: a.job_id, state: "done", result: "今月は 120 万円です" }, B);
    const b2 = await json<{ job_id: string }>(
      post("/agent/say", { text: "先月と比べて", conversation_id: a.conversation_id }, H),
    );
    await post("/bridge/take", { protocol: 4 }, B);
    await post("/bridge/finish", { job_id: b2.job_id, state: "done", result: "先月は 100 万円でした" }, B);
    const st = await json<State & { messages: { id: string; who: string; text: string }[] }>(
      req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, H),
    );
    const edited = st.messages.find((m) => m.text === "先月と比べて")!;
    const r = await json<{ conversation_id: string }>(
      post("/agent/say", { text: "去年と比べて", conversation_id: a.conversation_id, branch_from: edited.id }, H),
    );
    expect(r.conversation_id).not.toBe(a.conversation_id);
    const t = await json<{ prompt: string; agent_session_id: string | null } | null>(
      post("/bridge/take", { protocol: 4 }, B),
    );
    expect(t?.agent_session_id, "新しいセッション").toBeNull();
    expect(t?.prompt).toContain("今月は 120 万円です");
    expect(t?.prompt).not.toContain("先月と比べて");
    const nb = await json<State>(req("GET", `/agent/state?conversation_id=${r.conversation_id}`, undefined, H));
    expect(nb.messages.map((m) => m.text)).toEqual(["売上を見て", "今月は 120 万円です", "去年と比べて"]);
    const old = await json<State>(req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, H));
    expect(old.messages.map((m) => m.text)).toContain("先月と比べて");
  });
});

describe("許可のモードと 3 択（D-104.13・D-104.14）", () => {
  it("選んだモード・モデル・強さが仕事に乗る。知らない値は捨て、既定は毎回聞く", async () => {
    const { H, B } = await ready();
    await post("/agent/say", { text: "a", permission_mode: "acceptEdits", model: "sonnet", effort: "high" }, H);
    expect(await json<Take>(post("/bridge/take", { protocol: 4 }, B))).toMatchObject({
      permission_mode: "acceptEdits",
      model: "sonnet",
      effort: "high",
    });
    const b = await json<{ job_id: string }>(
      post(
        "/agent/say",
        { text: "b", permission_mode: "--dangerously-skip-permissions", model: "x; rm", effort: "ultra" },
        H,
      ),
    );
    const t = await json<Take>(post("/bridge/take", { protocol: 4 }, B));
    expect(t?.job_id === b.job_id || t === null).toBe(true); // 別の会話なので並んで取れる
    const row = (await admin.query("select permission_mode, model, effort from bridge_jobs where id = $1", [b.job_id]))
      .rows[0];
    expect(row).toEqual({ permission_mode: "manual", model: null, effort: null });
  });
  it("全部許可は、その会話で選んだときだけ乗る。既定にはできない", async () => {
    const { H, B } = await ready();
    const s = await json<{ job_id: string }>(
      post("/agent/say", { text: "全部やって", permission_mode: "bypassPermissions" }, H),
    );
    expect(await json<Take>(post("/bridge/take", { protocol: 4 }, B))).toMatchObject({
      job_id: s.job_id,
      permission_mode: "bypassPermissions",
    });
    expect((await post("/agent/default-mode", { mode: "bypassPermissions" }, H)).status).toBe(422);
    expect((await post("/agent/default-mode", { mode: "acceptEdits" }, H)).status).toBe(200);
    const r = await json<{ default_mode: string }>(req("GET", "/agent/permission-rules", undefined, H));
    expect(r.default_mode).toBe("acceptEdits");
    const s2 = await json<{ job_id: string }>(post("/agent/say", { text: "次" }, H));
    expect(
      (await admin.query("select permission_mode from bridge_jobs where id = $1", [s2.job_id])).rows[0].permission_mode,
      "何も選ばなければ既定",
    ).toBe("acceptEdits");
  });
  it("しない＋一言は理由として Bridge に渡る。いつも許可はルールになり、次の仕事の許可に乗る。取り消すと外れる", async () => {
    const { H, B } = await ready();
    const a = await json<{ job_id: string }>(post("/agent/say", { text: "ビルドして" }, H));
    await post("/bridge/take", { protocol: 4 }, B);
    await post(
      "/bridge/ask",
      {
        job_id: a.job_id,
        request_id: "r1",
        tool: "Bash",
        input: { command: "rm -rf dist" },
        summary: "Bash: rm -rf dist",
      },
      B,
    );
    expect(
      (await post("/agent/answer2", { job_id: a.job_id, request_id: "r1", allow: false, note: "dist は消さないで" }, H))
        .status,
    ).toBe(201);
    expect(
      await json<{ answer: unknown }>(post("/bridge/answer2", { job_id: a.job_id, request_id: "r1" }, B)),
    ).toMatchObject({ answer: { allow: false, note: "dist は消さないで" } });
    await post(
      "/bridge/ask",
      { job_id: a.job_id, request_id: "r2", tool: "Bash", input: { command: "npm test" }, summary: "Bash: npm test" },
      B,
    );
    expect(
      (await post("/agent/answer2", { job_id: a.job_id, request_id: "r2", allow: true, scope: "always" }, H)).status,
    ).toBe(201);
    await post("/bridge/finish", { job_id: a.job_id, state: "done", result: "済" }, B);
    const rules = await json<{ rules: { id: string; tool: string; target: string }[] }>(
      req("GET", "/agent/permission-rules", undefined, H),
    );
    expect(rules.rules.map((r) => `${r.tool}(${r.target})`)).toEqual(["Bash(npm test)"]);
    await post("/agent/say", { text: "もう一回" }, H);
    expect((await json<Take>(post("/bridge/take", { protocol: 4 }, B)))?.allowed_tools).toEqual(["Bash(npm test)"]);
    expect((await req("DELETE", `/agent/permission-rules/${rules.rules[0]!.id}`, undefined, H)).status).toBe(200);
    expect((await json<{ rules: unknown[] }>(req("GET", "/agent/permission-rules", undefined, H))).rules).toEqual([]);
  });
  it("問い合わせ（AskUserQuestion）の答えは Bridge にそのまま渡り、いつも許可のルールにはならない", async () => {
    const { H, B } = await ready();
    const a = await json<{ job_id: string }>(post("/agent/say", { text: "請求書" }, H));
    await post("/bridge/take", { protocol: 4 }, B);
    await post(
      "/bridge/ask",
      {
        job_id: a.job_id,
        request_id: "q1",
        tool: "AskUserQuestion",
        input: { questions: [{ question: "どの月？" }] },
        summary: "どの月？",
      },
      B,
    );
    expect(
      (
        await post(
          "/agent/answer2",
          { job_id: a.job_id, request_id: "q1", allow: true, scope: "always", answers: { "どの月？": "9 月" } },
          H,
        )
      ).status,
    ).toBe(201);
    expect(
      await json<{ answer: unknown }>(post("/bridge/answer2", { job_id: a.job_id, request_id: "q1" }, B)),
    ).toMatchObject({ answer: { allow: true, answers: { "どの月？": "9 月" } } });
    expect((await json<{ rules: unknown[] }>(req("GET", "/agent/permission-rules", undefined, H))).rules).toEqual([]);
  });
});

describe("資料を付ける（D-104.11）", () => {
  it("置き場に置いて id を返し、仕事に付き、Bridge は期限つきの署名 URL で中身を取れる。他の仕事・書き換えた署名は通らない", async () => {
    const { H, B } = await ready();
    const fd = new FormData();
    fd.append("file", new File([new TextEncoder().encode("日付,金額\n9/1,1000\n")], "台帳.csv", { type: "text/csv" }));
    const up = await app.request(`http://localhost${X}/agent/attachments`, { method: "POST", headers: H, body: fd });
    expect(up.status).toBe(201);
    const att = ((await up.json()) as { data: { id: string; name: string; size: number } }).data;
    expect(att).toMatchObject({ name: "台帳.csv", size: new TextEncoder().encode("日付,金額\n9/1,1000\n").length });
    const s = await json<{ job_id: string }>(post("/agent/say", { text: "これを見て", attachment_ids: [att.id] }, H));
    const t = await json<Take>(post("/bridge/take", { protocol: 4 }, B));
    expect(t?.attachments).toEqual([expect.objectContaining({ id: att.id, name: "台帳.csv" })]);
    const sr = await post("/bridge/attachment", { job_id: s.job_id, attachment_id: att.id }, B);
    const sb = (await sr.json()) as { data: { url: string; name: string } };
    expect(sr.status, JSON.stringify(sb)).toBe(200);
    const signed = sb.data;
    expect(signed.url).not.toContain("storage_ref");
    const path = new URL(signed.url).pathname + new URL(signed.url).search;
    const file = await app.request(`http://localhost${path}`);
    expect(file.status).toBe(200);
    expect(await file.text()).toBe("日付,金額\n9/1,1000\n");
    const bad = await app.request(`http://localhost${path.replace(/sig=[^&]+/, "sig=00")}`);
    expect(bad.status, "書き換えた署名は 403").toBe(403);
    const other = await json<{ job_id: string }>(post("/agent/say", { text: "別の仕事" }, H));
    expect(
      (await post("/bridge/attachment", { job_id: other.job_id, attachment_id: att.id }, B)).status,
      "付いていない仕事からは取れない",
    ).toBe(404);
    const empty = await app.request(`http://localhost${X}/agent/attachments`, {
      method: "POST",
      headers: H,
      body: new FormData(),
    });
    expect(empty.status).toBe(422);
  });
});
