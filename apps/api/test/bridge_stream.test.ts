// 1 行 1 イベント（D-093）の裏側：途中経過・確認・答え を本物の Postgres（RLS あり）で通す。
//   ・init で会話の id が仕事と会話に写る（D-093.4）／progress が残る（D-093.7）
//   ・ask で仕事が「確認待ち」になり、答えるまで Bridge には null（勝手に許可しない・D-093.3）
//   ・答えは 出来事・会話の記録（note）・証跡（audit_events）の 3 か所に残る（D-093.8）
//   ・他人の仕事には答えられない（404）／知らない Bridge は 401
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth, type Mail } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const mails: Mail[] = [];
const sent: { to: string; url: string; kind: string }[] = []; // 確認メールは authExt の mailer から出る（D-088）
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const get = (path: string, headers: Record<string, string> = {}) => app.request(`http://localhost${path}`, { headers });
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
    mailer: async (m) => void mails.push(m),
  });
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
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

/** 登録 → 端末の登録（Bridge の鍵）→ 言う（仕事が並ぶ）→ Bridge が取る */
async function ready() {
  const email = `${uniq()}@example.com`;
  // 登録が終わるのはメールを確認した時点（D-088）。確認メールのリンクの token で verify-signup を通して初めて token が出る
  expect((await post("/api/auth-ext/sign-up", { email, password: PW, company_name: "K" })).status).toBe(201);
  const mail = sent.filter((m) => m.to === email && m.kind === "verify").at(-1);
  if (!mail) throw new Error("確認メールが出ていない");
  const vt = new URL(mail.url).searchParams.get("token") ?? "";
  const ver = await post("/api/auth-ext/verify-signup", { token: vt });
  expect(ver.status).toBe(201);
  const token = ((await ver.json()) as { data: { token: string } }).data.token;
  const H = { authorization: `Bearer ${token}` };
  const pair = (await (await post("/api/auth-ext/bridge/pair", {}, H)).json()) as { data: { code: string } };
  const claim = (await (
    await post("/api/auth-ext/bridge/claim", { code: pair.data.code, device_label: "QA の PC" })
  ).json()) as { data: { session_id: string } };
  const sid = claim.data.session_id;
  const B = { "x-bridge-session": sid };
  const say = (await (await post("/api/auth-ext/agent/say", { text: "請求書を送っておいて" }, H)).json()) as {
    data: { job_id: string; conversation_id: string };
  };
  const take = (await (await post("/api/auth-ext/bridge/take", { protocol: 4 }, B)).json()) as {
    data: { job_id: string };
  };
  expect(take.data.job_id).toBe(say.data.job_id);
  return { H, B, job: say.data.job_id, conv: say.data.conversation_id };
}

describe("途中経過と会話の id（D-093.4・D-093.7）", () => {
  it("init で会話の id が 仕事と会話 に写り、progress が並ぶ", async () => {
    const { H, B, job, conv } = await ready();
    expect(
      (
        await post(
          "/api/auth-ext/bridge/progress",
          { job_id: job, seq: 1, kind: "init", agent_session_id: "s-init-1" },
          B,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await post(
          "/api/auth-ext/bridge/progress",
          { job_id: job, seq: 2, kind: "progress", text: "「Read」を使っています：台帳.csv" },
          B,
        )
      ).status,
    ).toBe(200);
    const j = await admin.query("select agent_session_id from bridge_jobs where id = $1", [job]);
    expect(j.rows[0].agent_session_id).toBe("s-init-1");
    const c = await admin.query("select agent_session_id from conversations where id = $1", [conv]);
    expect(c.rows[0].agent_session_id, "落ちても続きからが引き継げるよう、会話にも写す").toBe("s-init-1");
    const st = (await (await get("/api/auth-ext/agent/state", H)).json()) as {
      data: { progress: { text: string }[]; running_job_id: string };
    };
    expect(st.data.running_job_id).toBe(job);
    expect(st.data.progress.map((p) => p.text)).toEqual(["「Read」を使っています：台帳.csv"]);
    expect(
      (await post("/api/auth-ext/bridge/progress", { job_id: job, seq: 3, kind: "weird" }, B)).status,
      "知らない kind は 422",
    ).toBe(422);
  });
});

describe("確認と答え（D-093.3・D-093.8）", () => {
  it("ask で確認待ちになり、答える前は null。許可すると allow・記録・証跡が残る", async () => {
    const { H, B, job } = await ready();
    const ask = await post(
      "/api/auth-ext/bridge/ask",
      { job_id: job, request_id: "r-1", tool: "Bash", input: { command: "ls" }, summary: "Bash: ls" },
      B,
    );
    expect(ask.status).toBe(201);
    expect((await admin.query("select state_id from bridge_jobs where id = $1", [job])).rows[0].state_id).toBe(
      "asking",
    );
    const st = (await (await get("/api/auth-ext/agent/state", H)).json()) as {
      data: { asking: { request_id: string; summary: string } | null };
    };
    expect(st.data.asking?.request_id).toBe("r-1");
    expect(st.data.asking?.summary).toBe("Bash: ls");
    const before = (await (
      await post("/api/auth-ext/bridge/answer", { job_id: job, request_id: "r-1" }, B)
    ).json()) as { data: { answer: string | null } };
    expect(before.data.answer, "答える前は null（勝手に許可しない）").toBeNull();
    expect((await post("/api/auth-ext/agent/answer", { job_id: job, request_id: "r-1", allow: true }, H)).status).toBe(
      201,
    );
    const after = (await (await post("/api/auth-ext/bridge/answer", { job_id: job, request_id: "r-1" }, B)).json()) as {
      data: { answer: string | null };
    };
    expect(after.data.answer).toBe("allow");
    expect(
      (await admin.query("select state_id from bridge_jobs where id = $1", [job])).rows[0].state_id,
      "答えたら動いているに戻る",
    ).toBe("running");
    const st2 = (await (await get("/api/auth-ext/agent/state", H)).json()) as {
      data: { asking: unknown; messages: { who: string; text: string }[] };
    };
    expect(st2.data.asking).toBeNull();
    expect(st2.data.messages.at(-1)).toMatchObject({ who: "note" });
    expect(st2.data.messages.at(-1)!.text).toContain("許可しました");
    const audit = await admin.query(
      "select action, choke_point_id from audit_events where target_type = 'bridge_jobs' and target_id = $1",
      [job],
    );
    expect(audit.rows).toEqual([{ action: "bridge.tool_allowed", choke_point_id: "C5" }]);
    expect(
      (await post("/api/auth-ext/agent/answer", { job_id: job, request_id: "r-1", allow: false }, H)).status,
      "二度目は 404（もう答えた）",
    ).toBe(404);
  });
  it("許可しないと deny。他人の仕事には答えられない。知らない Bridge の鍵は 410", async () => {
    const { B, job, H } = await ready();
    await post(
      "/api/auth-ext/bridge/ask",
      { job_id: job, request_id: "r-2", tool: "Bash", input: { command: "rm -rf x" }, summary: "Bash: rm -rf x" },
      B,
    );
    const other = await ready(); // 別の会社の人
    expect(
      (await post("/api/auth-ext/agent/answer", { job_id: job, request_id: "r-2", allow: true }, other.H)).status,
      "他人の確認には答えられない",
    ).toBe(404);
    expect((await post("/api/auth-ext/agent/answer", { job_id: job, request_id: "r-2", allow: false }, H)).status).toBe(
      201,
    );
    const a = (await (await post("/api/auth-ext/bridge/answer", { job_id: job, request_id: "r-2" }, B)).json()) as {
      data: { answer: string | null };
    };
    expect(a.data.answer).toBe("deny");
    expect(
      (await admin.query("select action from audit_events where target_type = 'bridge_jobs' and target_id = $1", [job]))
        .rows[0].action,
    ).toBe("bridge.tool_denied");
    expect(
      (
        await post(
          "/api/auth-ext/bridge/ask",
          { job_id: job, request_id: "r-3", tool: "Bash", summary: "x" },
          { "x-bridge-session": "00000000-0000-4000-8000-000000000000" },
        )
      ).status,
      "知らない鍵は 410（Bridge は鍵を捨てる）",
    ).toBe(410);
  });
});

describe("仕事の記録（D-100）", () => {
  it("BRG-13-001 BRG-13-003 道具の呼び出し（名前・対象・成否・時間）と使った量が残る。決めた欄だけで、中身の全文は残らない。会話の途中経過には出ない", async () => {
    const { H, B, job } = await ready();
    const t = await post(
      "/api/auth-ext/bridge/progress",
      {
        job_id: job,
        seq: 5,
        kind: "tool",
        tool: { name: "Read", target: "/w/台帳.csv", ok: true, ms: 120, content: "社外秘の中身" },
      },
      B,
    );
    expect(t.status).toBe(200);
    const u = await post(
      "/api/auth-ext/bridge/progress",
      {
        job_id: job,
        seq: 6,
        kind: "usage",
        usage: { turns: 3, input_tokens: 1200, output_tokens: 340, cost_usd: 0.012, transcript: "全文" },
      },
      B,
    );
    expect(u.status).toBe(200);
    const ev = await admin.query(
      "select kind, payload from bridge_job_events where job_id = $1 and kind in ('tool', 'usage') order by seq",
      [job],
    );
    expect(ev.rows[0]).toEqual({ kind: "tool", payload: { name: "Read", target: "/w/台帳.csv", ok: true, ms: 120 } });
    expect(ev.rows[1].payload).toMatchObject({
      turns: 3,
      input_tokens: 1200,
      output_tokens: 340,
      cost_usd: 0.012,
      duration_ms: null,
    });
    expect(JSON.stringify(ev.rows), "中身の全文は残さない（D-100.3）").not.toMatch(/社外秘|全文/);
    const st = (await (await get("/api/auth-ext/agent/state", H)).json()) as { data: { progress: unknown[] } };
    expect(st.data.progress, "会話には出さない（散らからない）").toEqual([]);
  });
});
