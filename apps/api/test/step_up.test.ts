// 本人確認の取り直しの口（KN-56・D-125.139）を本物の Postgres とログインの部品で通す。
//   正しいパスワードで、セッションに時刻が付き（15 分効く）、いつも本人確認が要る口が STEP_UP_REQUIRED で止まらなくなる
//   間違えたら 401 で時刻は付かない。成功も失敗もセキュリティの出来事に残る
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
import { ENDPOINTS } from "@kaname/contracts";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { authHooks } from "../src/hooks/auth.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const uniq = () => `su-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

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
  app = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, appPool),
    authExt: authExt({
      auth,
      appPool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }),
      repo,
      secrets: new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9)),
      objects: new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "kaname-obj-"))), {
        signingSecret: "test-files",
        maxBytes: 1024 * 1024,
      }),
      mailer: async (m) => void sent.push({ to: m.to, url: m.url, kind: m.kind }),
      config: {
        secretsMasterKey: "test-master",
        baseUrl: "http://localhost:3001",
        webBaseUrl: "http://localhost:3123",
        opsEmail: "ops@example.com",
        env: "test" as const,
      },
    }),
    contract: { hooks: authHooks(auth, appPool) },
  });
}, 60_000);

/** 登録（確認メールを通す）→ ログイン済みのトークン */
async function signedIn() {
  const email = `${uniq()}@example.com`;
  expect((await call("POST", "/api/auth-ext/sign-up", { email, password: PW, company_name: "K" })).status).toBe(201);
  const mail = sent.filter((m) => m.to === email && m.kind === "verify").at(-1)!;
  const ver = (await (
    await call("POST", "/api/auth-ext/verify-signup", { token: new URL(mail.url).searchParams.get("token") })
  ).json()) as { data: { token: string } };
  const H = { authorization: `Bearer ${ver.data.token}` };
  const member = (
    await admin.query<{ member_id: string }>(
      "select s.member_id from sessions s join kaname_auth.session a on a.id = s.auth_session_id where a.token = $1",
      [ver.data.token.split(".")[0]],
    )
  ).rows[0]!.member_id;
  return { H, member };
}
const stepUpAt = async (member: string) =>
  (
    await admin.query<{ at: Date | null }>(
      "select step_up_at as at from sessions where member_id = $1 and revoked_at is null order by issued_at desc limit 1",
      [member],
    )
  ).rows[0]?.at ?? null;
// いつも本人確認が要る社内の口（中身は作っていなくても、本人確認の段は 501 より前に止める）
const ALWAYS = ENDPOINTS.find((e) => e.perm.stepUp === "always" && e.auth === "member" && !e.path.includes(":"))!;

describe("本人確認の取り直し（KN-56）", () => {
  it("正しいパスワードで時刻が付き、いつも要る口が STEP_UP_REQUIRED で止まらなくなる", async () => {
    const { H, member } = await signedIn();
    const before = await call(ALWAYS.method, ALWAYS.path, ALWAYS.method === "GET" ? undefined : {}, H);
    expect(((await before.json()) as { code: string }).code).toBe("STEP_UP_REQUIRED");
    const r = await call("POST", "/api/v1/auth/step-up", { password: PW }, H);
    expect(r.status).toBe(201);
    const b = (await r.json()) as { data: { step_up_at: string; valid_until: string } };
    expect(new Date(b.data.valid_until).getTime() - new Date(b.data.step_up_at).getTime()).toBe(15 * 60 * 1000);
    expect(await stepUpAt(member)).not.toBeNull();
    const after = await call(ALWAYS.method, ALWAYS.path, ALWAYS.method === "GET" ? undefined : {}, H);
    expect(((await after.json()) as { code: string }).code).not.toBe("STEP_UP_REQUIRED");
    const ev = await admin.query("select 1 from security_events where member_id = $1 and kind_id = 'step_up'", [
      member,
    ]);
    expect(ev.rowCount).toBe(1);
  });

  it("間違ったパスワードは 401 で、時刻は付かない。失敗も記録に残る", async () => {
    const { H, member } = await signedIn();
    const r = await call("POST", "/api/v1/auth/step-up", { password: "wrong-password-123" }, H);
    expect(r.status).toBe(401);
    expect(((await r.json()) as { code: string }).code).toBe("STEP_UP_FAILED");
    expect(await stepUpAt(member)).toBeNull();
    const ev = await admin.query("select 1 from security_events where member_id = $1 and kind_id = 'step_up_failed'", [
      member,
    ]);
    expect(ev.rowCount).toBe(1);
  });

  it("パスワードが空なら 422・ログインしていなければ 401", async () => {
    const { H } = await signedIn();
    expect((await call("POST", "/api/v1/auth/step-up", {}, H)).status).toBe(422);
    expect((await call("POST", "/api/v1/auth/step-up", { password: PW })).status).toBe(401);
  });
});
