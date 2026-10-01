// 自分のAI が Kaname の道具でたたき台に置く（D-110）の API 側を本物の Postgres で通す。鍵はその仕事の間だけ・本人の会社にだけ
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

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const X = "/api/auth-ext";
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, { method, headers: { "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
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
    authDatabaseUrl: AUTH_URL, appPool, secret: "test-secret-0123456789-abcdefghijklmnop",
    baseURL: "http://localhost:3001", webBaseURL: "http://localhost:3123", mailer: async () => undefined,
  });
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "kaname-obj-"))), { signingSecret: "test-files", maxBytes: 1024 * 1024 });
  app = createApp({
    repo, auth, resolve: createSessionResolver(auth, appPool),
    authExt: authExt({
      auth, appPool, authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }), repo, secrets, objects,
      mailer: async (m) => void sent.push({ to: m.to, url: m.url, kind: m.kind }),
      config: { secretsMasterKey: "test-master", baseUrl: "http://localhost:3001", webBaseUrl: "http://localhost:3123", opsEmail: "ops@example.com", env: "test" as const },
    }),
  });
}, 60_000);

/** 登録（確認メールを通す）→ Bridge をつなぐ */
async function ready() {
  const email = `${uniq()}@example.com`;
  expect((await post("/sign-up", { email, password: PW, company_name: "K" })).status).toBe(201);
  const mail = sent.filter((m) => m.to === email && m.kind === "verify").at(-1)!;
  const ver = await json<{ token: string }>(post("/verify-signup", { token: new URL(mail.url).searchParams.get("token") }));
  const H = { authorization: `Bearer ${ver.token}` };
  const pair = await json<{ code: string }>(post("/bridge/pair", {}, H));
  const claim = await json<{ session_id: string }>(post("/bridge/claim", { code: pair.code, device_label: "QA の PC" }));
  const B = { "x-bridge-session": claim.session_id };
  const member = (await admin.query("select member_id from sessions where id = $1", [claim.session_id])).rows[0].member_id as string;
  return { H, B, member };
}

type Draft = { goals: { id: string; name: string; target_value: number | string | null; unit: string; period_start: string | null }[]; ledgers: { id: string; name: string; stages: string[]; fields: string[] }[]; duties: { id: string; name: string; staff: string; summary: string }[] };
/** 会話の仕事を 1 件渡して、道具の鍵をもらう */
async function withJob() {
  const r = await ready();
  const s = await json<{ job_id: string }>(post("/agent/say", { text: "会社のことを話します" }, r.H));
  const job = await json<{ job_id: string; tool_token: string | null }>(post("/bridge/take", { protocol: 4 }, r.B));
  expect(job.job_id).toBe(s.job_id);
  expect(job.tool_token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  const tool = (name: string, input: unknown, token = job.tool_token!) => post("/bridge/tool", { name, input }, { "x-kaname-tool-token": token });
  return { ...r, job, tool };
}

describe("Kaname の道具でたたき台に置く（D-110）", () => {
  it("CHT-25-002 CHT-25-005 目標・台帳・担当業務とAI社員を置くと、たたき台（画面が読むもの）にそのまま出て、証跡に残る", async () => {
    const { H, member, tool } = await withJob();
    const g = await json<{ id: string; done: string }>(tool("goal_set", { name: "今期の売上", target_value: "12,000,000", unit: "円", period_start: "2026-10-01", period_end: "2027-03-31" }));
    expect(g.done).toBe("created");
    const l = await json<{ id: string }>(tool("ledger_set", { name: "案件台帳", stages: ["引き合い", "見積", "受注", "納品"], fields: ["取引先", "金額", "納期"] }));
    const du = await json<{ id: string; staff: string }>(tool("duty_set", { name: "見積の下書き", definition: "引き合いから見積の下書きを作る\n金額は台帳から", staff: "見積さん" }));
    expect(du.staff).toBe("見積さん");
    const d = await json<Draft>(req("GET", "/onboard/draft", undefined, H));
    expect(d.goals).toEqual([expect.objectContaining({ id: g.id, name: "今期の売上", unit: "円", period_start: "2026-10-01" })]);
    expect(Number(d.goals[0]!.target_value)).toBe(12_000_000);
    expect(d.ledgers).toEqual([{ id: l.id, name: "案件台帳", stages: ["引き合い", "見積", "受注", "納品"], fields: ["取引先", "金額", "納期"] }]);
    expect(d.duties).toEqual([expect.objectContaining({ id: du.id, name: "見積の下書き", staff: "見積さん", summary: "引き合いから見積の下書きを作る" })]);
    const au = await admin.query("select action from audit_events where actor_member_id = $1 and action like 'agent.%' order by occurred_at, action", [member]);
    expect(au.rows.map((x) => x.action).sort()).toEqual(["agent.ai_employee_created", "agent.duty_created", "agent.goal_created", "agent.ledger_created"]);
  });
  it("直すと名前は新しい版になり（前の名前は履歴に残る）、外すとたたき台から消える。いまのたたき台も読める", async () => {
    const { H, tool } = await withJob();
    const g = await json<{ id: string }>(tool("goal_set", { name: "今期の売上", target_value: 100, unit: "万円" }));
    await json(tool("goal_set", { id: g.id, name: "今期の粗利", target_value: 40 }));
    const vs = await admin.query("select version, name from goal_versions where goal_id = $1 order by version", [g.id]);
    expect(vs.rows).toEqual([{ version: 1, name: "今期の売上" }, { version: 2, name: "今期の粗利" }]);
    const read = await json<Draft>(tool("draft_read", {}));
    expect(read.goals.map((x) => [x.name, Number(x.target_value), x.unit])).toEqual([["今期の粗利", 40, "万円"]]);
    await json(tool("goal_remove", { id: g.id }));
    expect((await json<Draft>(req("GET", "/onboard/draft", undefined, H))).goals).toEqual([]);
  });
  it("覚えるは記憶に入り、会話に「覚えました」が残る", async () => {
    const { member, job, tool } = await withJob();
    expect(await json(tool("remember", { items: ["受託の Web 制作が中心", "体制は 2〜5 名"] }))).toEqual({ remembered: 2 });
    const m = await admin.query("select body from memories where owner_member_id = $1 order by created_at", [member]);
    expect(m.rows.map((x) => x.body)).toEqual(["受託の Web 制作が中心", "体制は 2〜5 名"]);
    const msg = await admin.query("select count(*)::int n from messages where job_id = $1 and kind = 'memo'", [job.job_id]);
    expect(msg.rows[0].n).toBe(2);
  });
  it("CHT-25-003 鍵が違う・仕事が終わった後の鍵・別の会社の物・知らない道具・名前の無い目標は書けない", async () => {
    const a = await withJob();
    const b = await withJob();
    expect((await a.tool("goal_set", { name: "x" }, "x".repeat(43))).status).toBe(401);
    // 別の会社の目標は直せない・外せない
    const gb = await json<{ id: string }>(b.tool("goal_set", { name: "B の目標" }));
    const cross = await a.tool("goal_set", { id: gb.id, name: "乗っ取り" });
    expect(cross.status).toBe(422);
    expect((await a.tool("goal_remove", { id: gb.id })).status).toBe(422);
    expect((await admin.query("select app.goal_name($1) n", [gb.id])).rows[0].n).toBe("B の目標");
    expect((await a.tool("rm_rf", {})).status).toBe(422);
    const noname = await a.tool("goal_set", { target_value: 1 });
    expect(noname.status).toBe(422);
    expect(((await noname.json()) as { message: string }).message).toBe("目標の名前が要ります");
    // 仕事が終わったら同じ鍵は使えない
    await post("/bridge/finish", { job_id: a.job.job_id, state: "done", result: "おわり" }, a.B);
    const late = await a.tool("goal_set", { name: "終わった後" });
    expect(late.status).toBe(401);
    expect(((await late.json()) as { message: string }).message).toContain("仕事が終わっています");
  });
  it("CHT-30-004 会話の仕事には会話の決まり（問い合わせで聞く・絵文字を使わない・道具の名前を書かない）が一緒に渡る", async () => {
    const r = await ready();
    await post("/agent/say", { text: "会社のことを話します" }, r.H);
    const job = await json<{ conventions: string | null }>(post("/bridge/take", { protocol: 4 }, r.B));
    expect(job.conventions).toContain("AskUserQuestion の問い合わせで出す");
    expect(job.conventions).toContain("絵文字は使わない");
    expect(job.conventions).toContain("道具の名前（mcp__… や ToolSearch など）を本人に書かない");
  });
  it("CHT-25-001 会話でない仕事には鍵を渡さない", async () => {
    const { B, member } = await ready();
    // 会話の無い仕事（記憶のまとめと同じ形）を 1 件積む
    await admin.query(
      "insert into bridge_jobs (tenant_id, scope_id, member_id, prompt) select tenant_id, scope_id, id, 'まとめて' from members where id = $1",
      [member],
    );
    const job = await json<{ conversation_id: string | null; tool_token: string | null } | null>(post("/bridge/take", { protocol: 4 }, B));
    expect(job).not.toBeNull();
    expect(job!.conversation_id).toBeNull();
    expect(job!.tool_token).toBeNull();
  });
});
