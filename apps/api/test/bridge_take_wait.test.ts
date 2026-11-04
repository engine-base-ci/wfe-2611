// 仕事の問い合わせ（D-097）：画面も API も Vercel なので、問い合わせの回数と長さがそのまま費用になる。本物の Postgres（RLS あり）で通す。
//   ・問い合わせ 1 回で「生きている」も知らせる（last_seen_at が進む）
//   ・仕事が動いていない（直近 5 分に何も無い）ときは待たずに返し、5 秒あけてもらう（next_ms）
//   ・動いている最中は wait_sec まで待ち受け、入ったらすぐ返す／何も来なければ待った後に next_ms 0
//   ・wait_sec を送らない古い Bridge は、これまでどおりすぐ返る。死んだ鍵は 410
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const uniq = () => `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
type Take = { data: { job_id: string } | null; next_ms: number };

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

/** 登録 → 端末の登録（Bridge の鍵）。仕事はまだ並べない */
async function paired() {
  const email = `${uniq()}@example.com`;
  expect((await post("/api/auth-ext/sign-up", { email, password: PW, company_name: "K" })).status).toBe(201);
  const mail = sent.filter((m) => m.to === email && m.kind === "verify").at(-1);
  if (!mail) throw new Error("確認メールが出ていない");
  const ver = await post("/api/auth-ext/verify-signup", { token: new URL(mail.url).searchParams.get("token") ?? "" });
  const H = { authorization: `Bearer ${((await ver.json()) as { data: { token: string } }).data.token}` };
  const pair = (await (await post("/api/auth-ext/bridge/pair", {}, H)).json()) as { data: { code: string } };
  const claim = (await (
    await post("/api/auth-ext/bridge/claim", { code: pair.data.code, device_label: "QA の PC" })
  ).json()) as { data: { session_id: string } };
  return { H, B: { "x-bridge-session": claim.data.session_id }, sid: claim.data.session_id };
}
const take = async (B: Record<string, string>, body: unknown) => {
  const t0 = Date.now();
  const r = await post("/api/auth-ext/bridge/take", { protocol: 4, ...(body as object) }, B);
  return { status: r.status, body: (await r.json()) as Take, ms: Date.now() - t0 };
};

describe("仕事が動いていないとき（D-097）", () => {
  it("待たずに返し、5 秒あけてもらう。問い合わせ 1 回で生きていると知らせる", async () => {
    const { B, sid } = await paired();
    await admin.query("update sessions set last_seen_at = now() - interval '10 minutes' where id = $1", [sid]);
    const r = await take(B, { wait_sec: 20 });
    expect(r.status).toBe(200);
    expect(r.body.data).toBeNull();
    expect(r.body.next_ms).toBe(5_000);
    expect(r.ms, "動いていないのに 20 秒待ち受けない（関数の時間がそのまま費用）").toBeLessThan(1_500);
    const seen = await admin.query(
      "select now() - last_seen_at < interval '5 seconds' as fresh from sessions where id = $1",
      [sid],
    );
    expect(seen.rows[0].fresh, "問い合わせが「生きている」を兼ねる").toBe(true);
  });
  it("wait_sec を送らない古い Bridge・負の値は、これまでどおりすぐ返る", async () => {
    const { B } = await paired();
    expect((await take(B, {})).ms).toBeLessThan(1_500);
    expect((await take(B, { wait_sec: -5 })).ms).toBeLessThan(1_500);
  });
  it("死んだ鍵は 410（Bridge は鍵を捨てる・G-14）", async () => {
    const r = await take({ "x-bridge-session": "00000000-0000-4000-8000-000000000000" }, { wait_sec: 20 });
    expect(r.status).toBe(410);
  });
});

describe("仕事が動いている最中（D-097）", () => {
  it("待ち受けている間に言われたら、すぐ返す（1 秒ごとに見る）", async () => {
    const { H, B } = await paired();
    const first = (await (await post("/api/auth-ext/agent/say", { text: "1 つめ" }, H)).json()) as {
      data: { job_id: string };
    };
    expect((await take(B, { wait_sec: 20 })).body.data?.job_id).toBe(first.data.job_id);
    await post("/api/auth-ext/bridge/finish", { job_id: first.data.job_id, state: "done", result: "済" }, B);
    const waiting = take(B, { wait_sec: 20 });
    await new Promise((r) => setTimeout(r, 1_500));
    const second = (await (await post("/api/auth-ext/agent/say", { text: "2 つめ" }, H)).json()) as {
      data: { job_id: string };
    };
    const r = await waiting;
    expect(r.body.data?.job_id).toBe(second.data.job_id);
    expect(r.ms, "言ってから 1 秒ちょっとで返る（20 秒を待ち切らない）").toBeLessThan(4_500);
    expect(r.body.next_ms).toBe(0);
  }, 30_000);
  it("何も来なければ wait_sec だけ待って返し、間をあけずに聞き直してもらう", async () => {
    const { H, B } = await paired();
    const j = (await (await post("/api/auth-ext/agent/say", { text: "1 つめ" }, H)).json()) as {
      data: { job_id: string };
    };
    await take(B, {});
    await post("/api/auth-ext/bridge/finish", { job_id: j.data.job_id, state: "done", result: "済" }, B);
    const r = await take(B, { wait_sec: 2 });
    expect(r.body.data).toBeNull();
    expect(r.ms).toBeGreaterThanOrEqual(1_900);
    expect(r.ms).toBeLessThan(4_500);
    expect(r.body.next_ms).toBe(0);
  }, 30_000);
});
