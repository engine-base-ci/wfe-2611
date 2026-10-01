// 資格情報の預かり先が決まっていない間（段階 1・D-097.8）：staging／本番では預からない（E-SEC-002）。
// メモリの預かり先は再起動・Vercel の関数の実体ごとに消えるので、「預かりました」と言って消える、を作らない。開発では預かる。
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
import { MemoryVault, RateLimited, SecretsGateway, type Vault } from "@kaname/secrets";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
type Env = "development" | "staging" | "production" | "test";
let build: (env: Env, vault: Vault) => ReturnType<typeof createApp>;
const sent: { to: string; url: string; kind: string }[] = [];

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  const appPool = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(appPool);
  const { auth } = createAuth({ authDatabaseUrl: AUTH_URL, appPool, secret: "test-secret-0123456789-abcdefghijklmnop", baseURL: "http://localhost:3001", webBaseURL: "http://localhost:3123", mailer: async () => undefined });
  const authPool = new pg.Pool({ connectionString: AUTH_URL, max: 2 });
  build = (env, vault) =>
    createApp({ repo, auth, resolve: createSessionResolver(auth, appPool), authExt: authExt({ auth, appPool, authPool, repo, secrets: new SecretsGateway(repo, vault, Buffer.alloc(32, 9)), mailer: async (m) => void sent.push({ to: m.to, url: m.url, kind: m.kind }), config: { secretsMasterKey: "test-master", baseUrl: "http://localhost:3001", webBaseUrl: "http://localhost:3123", opsEmail: "ops@example.com", env } }) });
}, 60_000);

async function signedIn(app: ReturnType<typeof createApp>) {
  const post = (p: string, b: unknown, h: Record<string, string> = {}) => app.request(`http://localhost${p}`, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) });
  const email = `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  expect((await post("/api/auth-ext/sign-up", { email, password: PW, company_name: "K" })).status).toBe(201);
  const mail = sent.filter((m) => m.to === email && m.kind === "verify").at(-1)!;
  const ver = await post("/api/auth-ext/verify-signup", { token: new URL(mail.url).searchParams.get("token") ?? "" });
  const H = { authorization: `Bearer ${((await ver.json()) as { data: { token: string } }).data.token}` };
  return (b: unknown) => post("/api/auth-ext/vault/credentials", b, H);
}
const cred = { service_name: "freee", login: "a@example.com", password: "p" };

describe("預かり先が消える保管先のとき（D-097.8）", () => {
  it("staging では 503 E-SEC-002 で断り、何も預からない", async () => {
    const store = await signedIn(build("staging", new MemoryVault()));
    const r = await store(cred);
    expect(r.status).toBe(503);
    expect(((await r.json()) as { code: string }).code).toBe("E-SEC-002");
  });
  it("本番でも断る", async () => {
    const store = await signedIn(build("production", new MemoryVault()));
    expect((await store(cred)).status).toBe(503);
  });
  it("開発では預かる（誤検知なし）", async () => {
    const store = await signedIn(build("development", new MemoryVault()));
    expect((await store(cred)).status).toBe(201);
  });
  it("消えない預かり先なら staging でも預かる", async () => {
    const durable: Vault = Object.assign(new MemoryVault(), { durable: true });
    const store = await signedIn(build("staging", durable));
    expect((await store(cred)).status).toBe(201);
  });
});

// 起動時の確認（D-101・G-11）：staging／本番は消えない預かり先に入れないと起動しない
import { startupChecks } from "../src/startup.js";
describe("起動時の確認 secrets:vault（D-101）", () => {
  const cfg = (env: Env) => ({ env, secretsMasterKey: Buffer.alloc(32).toString("base64"), resendApiKey: "x" }) as never;
  const base = { repo: {} as never, bucketExists: async () => true };
  it("staging でメモリの預かり先なら落ちる", async () => {
    expect(await startupChecks({ ...base, config: cfg("staging"), vault: new MemoryVault() })["secrets:vault"]!()).toBe(false);
  });
  it("staging で入れる預かり先なら通る。入れなければ例外", async () => {
    const ok = Object.assign(new MemoryVault(), { durable: true, ping: async () => true as const });
    expect(await startupChecks({ ...base, config: cfg("staging"), vault: ok })["secrets:vault"]!()).toBe(true);
    const ng = Object.assign(new MemoryVault(), { durable: true, ping: async (): Promise<true> => { throw new Error("Infisical で入ることができない（401）"); } });
    await expect(startupChecks({ ...base, config: cfg("production"), vault: ng })["secrets:vault"]!()).rejects.toThrow(/401/);
  });
  it("開発はメモリでよい", async () => {
    expect(await startupChecks({ ...base, config: cfg("development"), vault: new MemoryVault() })["secrets:vault"]!()).toBe(true);
  });
});

describe("上限に当たったとき（D-102.5・E-SEC-003）", () => {
  it("預かり先が 429 なら、待つ秒数つきで断り、表に行を作らない", async () => {
    const busy = Object.assign(new MemoryVault(), { durable: true, put: async () => { throw new RateLimited(42); } });
    const store = await signedIn(build("development", busy));
    const r = await store(cred);
    expect(r.status).toBe(503);
    const j = (await r.json()) as { code: string; message: string; retry_after_sec: number };
    expect(j.code).toBe("E-SEC-003");
    expect(j.retry_after_sec).toBe(42);
    expect(j.message).toContain("42 秒");
  });
});
