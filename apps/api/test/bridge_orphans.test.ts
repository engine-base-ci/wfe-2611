// 途中で止まった Bridge の仕事の後始末と、作業中の「最後の動き」（2026-09-28 実例）を本物の Postgres で通す。
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { createDeviceResolver, createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { keepAuth, verifiedUser } from "./_pending.js";
import { pairForTest } from "./bridge_pair.js";
import { isMovedBridgePath, oldBridge, type OldBridge } from "./bridge_contract.js";
import { withDevice } from "../src/middleware/tenant.js";
import { delegateHooks } from "../src/hooks/delegate.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const X = "/api/auth-ext";
// 前の道すじ 5 本（take・progress・finish・control・tool）は契約の口へ向け直す（K-62・apps/api/test/bridge_contract.ts）
let ob: OldBridge | undefined;
const viaContract = (): OldBridge => (ob ??= oldBridge(app));
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  isMovedBridgePath(path)
    ? viaContract().call(path, body, headers)
    : app.request(`http://localhost${X}${path}`, {
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
  const { auth } = keepAuth(
    createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3001",
      webBaseURL: "http://localhost:3123",
      mailer: async () => undefined,
    }),
  );
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "kaname-obj-"))), {
    signingSecret: "test-files",
    maxBytes: 1024 * 1024,
  });
  app = createApp({
    repo,
    auth,
    // PC の口は契約の口（K-57・K-62）。PC の印で解き、振る舞いは delegate の hooks
    resolve: withDevice(createSessionResolver(auth, appPool), createDeviceResolver(appPool)) as never,
    contract: { hooks: delegateHooks(appPool) },
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
  const ver = await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K" });
  const H = { authorization: `Bearer ${ver.token}` };
  const bp = await pairForTest(admin, email);
  const B = { "x-bridge-session": bp.token };
  const member = (await admin.query("select member_id from sessions where id = $1", [bp.sid])).rows[0]
    .member_id as string;
  return { H, B, member };
}

type State = {
  work: { job_id: string; last_at: string | null } | null;
  stopped: { job_id: string; reason: string } | null;
};
describe("途中で止まった Bridge の仕事（2026-09-28 実例）", () => {
  it("CHT-27-003 Bridge が止まって戻ってきた（何も動かしていないのに仕事を取りに来た）ら、動いたまま残った仕事は理由つきで止まり、次の仕事が渡る", async () => {
    const { H, B } = await ready();
    const a = await json<{ job_id: string; conversation_id: string }>(post("/agent/say", { text: "1 本目" }, H));
    expect((await json<{ job_id: string }>(post("/bridge/take", { protocol: 5 }, B))).job_id).toBe(a.job_id);
    // 動いている間は作業の行に最後の動きが出る
    const st = await json<State>(req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, H));
    expect(st.work?.job_id).toBe(a.job_id);
    expect(Date.now() - new Date(st.work!.last_at!).getTime()).toBeLessThan(60_000);
    // ここで Bridge が止まり、戻ってきた。後から言ったことを取りに来る
    const b = await json<{ job_id: string }>(
      post("/agent/say", { text: "2 本目", conversation_id: a.conversation_id }, H),
    );
    // 動いている途中の取りに来る（idle ではない）では止めない
    expect(await json(post("/bridge/take", { protocol: 5 }, B))).toBeNull();
    expect((await admin.query("select state_id from bridge_jobs where id = $1", [a.job_id])).rows[0].state_id).toBe(
      "running",
    );
    const next = await json<{ job_id: string }>(post("/bridge/take", { protocol: 5, idle: true }, B));
    expect(next.job_id).toBe(b.job_id);
    const old = await admin.query("select state_id, stopped_reason from bridge_jobs where id = $1", [a.job_id]);
    expect(old.rows[0]).toEqual({
      state_id: "stopped",
      stopped_reason: "PC の Bridge が途中で止まったので、ここで止まりました。続けるなら「続けて」と送ってください",
    });
    // 会話にも「ここで止まりました」が残る（画面はこれで止まったと出す）
    const msg = await admin.query("select kind, body from messages where job_id = $1", [a.job_id]);
    expect(msg.rows).toContainEqual({
      kind: "stopped",
      body: "PC の Bridge が途中で止まったので、ここで止まりました。続けるなら「続けて」と送ってください",
    });
  });
  it("CHT-27-003 答えを待ったまま残った仕事も止まる。別の人の仕事は止めない", async () => {
    const me = await ready();
    const other = await ready();
    const a = await json<{ job_id: string }>(post("/agent/say", { text: "聞いて" }, me.H));
    await post("/bridge/take", { protocol: 5 }, me.B);
    await post(
      "/bridge/ask",
      {
        job_id: a.job_id,
        request_id: "r1",
        tool: "AskUserQuestion",
        input: { questions: [{ question: "どれ？" }] },
        summary: "",
      },
      me.B,
    );
    const o = await json<{ job_id: string }>(post("/agent/say", { text: "別の人" }, other.H));
    await post("/bridge/take", { protocol: 5 }, other.B);
    await post("/bridge/take", { protocol: 5, idle: true }, me.B); // 戻ってきた
    const rows = await admin.query(
      "select id, state_id from bridge_jobs where id = any($1::uuid[]) order by created_at",
      [[a.job_id, o.job_id]],
    );
    expect(rows.rows.map((r) => r.state_id)).toEqual(["stopped", "running"]);
  });
});
describe("答えた問い合わせを届かないまま捨てない（2026-09-28 実例：続けての後に同じ問いを最初から聞き直した）", () => {
  const Q = {
    questions: [
      { question: "主に何を受託していますか？", options: [{ label: "Web" }, { label: "システム" }] },
      { question: "体制は？", options: [{ label: "2〜5 名" }] },
    ],
  };
  async function answeredThenStopped(takeAnswer: boolean) {
    const r = await ready();
    const a = await json<{ job_id: string; conversation_id: string }>(
      post("/agent/say", { text: "会社のことを聞いて" }, r.H),
    );
    await post("/bridge/take", { protocol: 5 }, r.B);
    await post(
      "/bridge/ask",
      { job_id: a.job_id, request_id: "q1", tool: "AskUserQuestion", input: Q, summary: "" },
      r.B,
    );
    expect(
      (
        await post(
          "/agent/answer2",
          {
            job_id: a.job_id,
            request_id: "q1",
            allow: true,
            answers: { "主に何を受託していますか？": "システム", "体制は？": "2〜5 名" },
          },
          r.H,
        )
      ).status,
    ).toBeLessThan(300);
    if (takeAnswer) await post("/bridge/answer2", { job_id: a.job_id, request_id: "q1" }, r.B); // Bridge が受け取った
    await post("/bridge/take", { protocol: 5, idle: true }, r.B); // Bridge が止まって戻ってきた → 残った仕事は止まる
    return { ...r, a };
  }
  it("CHT-29-001 CHT-29-002 Bridge に届かないまま止まった答えは、次に言ったときに自分のAI への指示に添えて渡り、二度は渡らない", async () => {
    const { H, B, a } = await answeredThenStopped(false);
    await post("/agent/say", { text: "続けて", conversation_id: a.conversation_id }, H);
    const next = await json<{ prompt: string }>(post("/bridge/take", { protocol: 5, idle: true }, B));
    expect(next.prompt).toContain("本人はもう答えています");
    expect(next.prompt).toContain("- 主に何を受託していますか？：システム");
    expect(next.prompt).toContain("- 体制は？：2〜5 名");
    expect(next.prompt).toContain("続けて");
    await post(
      "/bridge/finish",
      { job_id: (next as unknown as { job_id: string }).job_id, state: "done", result: "了解" },
      B,
    );
    await post("/agent/say", { text: "もう一つ", conversation_id: a.conversation_id }, H);
    const again = await json<{ prompt: string }>(post("/bridge/take", { protocol: 5, idle: true }, B));
    expect(again.prompt, "二度は渡さない").not.toContain("本人はもう答えています");
  });
  it("CHT-29-002 Bridge が受け取った答えは渡し直さない", async () => {
    const { H, B, a } = await answeredThenStopped(true);
    await post("/agent/say", { text: "続けて", conversation_id: a.conversation_id }, H);
    const next = await json<{ prompt: string }>(post("/bridge/take", { protocol: 5, idle: true }, B));
    expect(next.prompt).not.toContain("本人はもう答えています");
  });
});
