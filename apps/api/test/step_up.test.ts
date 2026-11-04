// 本人確認の取り直しの口（K-19・D-125.139）を本物の Postgres とログインの部品で通す。
//   正しいパスワードで、セッションに時刻が付き（15 分効く）、いつも本人確認が要る口が STEP_UP_REQUIRED で止まらなくなる
//   間違えたら 401 で時刻は付かない。成功も失敗もセキュリティの出来事に残る
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync } from "node:fs";
import { createHmac } from "node:crypto";
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
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let authApi: ReturnType<typeof createAuth>["auth"]["api"];
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
  authApi = auth.api;
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
  return { H, member, email };
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

describe("本人確認の取り直し（K-19）", () => {
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

/** 2 段階のコード（RFC 6238・30 秒・6 桁・SHA-1。認証アプリと同じ作り方） */
function totp(secretB32: string, at = Date.now()): string {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secretB32.replace(/=+$/, "").toUpperCase()) bits += A.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

describe("2 段階を使う人の取り直し（K-19）", () => {
  it("パスワードとコードの両方で取り直す。コードが無ければ 422・違えば 401 で時刻は付かない", async () => {
    const { H, member, email } = await signedIn();
    const headers = new Headers(H);
    // 2 段階を有効にする（ログインの部品の手順どおり：有効にする → 最初のコードで確かめる）
    const en = (await authApi.enableTwoFactor({ body: { password: PW }, headers })) as { totpURI: string };
    const secret = new URL(en.totpURI).searchParams.get("secret")!;
    // 2 段階を有効にするとき、ログインの部品はセッションを作り直す（新しいトークンを返す）
    const v = (await authApi.verifyTOTP({ body: { code: totp(secret) }, headers, returnHeaders: true })) as unknown as {
      headers: Headers;
    };
    const fresh = v.headers.get("set-auth-token");
    expect(fresh, "新しいトークン").toBeTruthy();
    H.authorization = `Bearer ${fresh}`;
    const on = await admin.query<{ on: boolean }>(
      'select "twoFactorEnabled" as on from kaname_auth."user" where email = $1',
      [email],
    );
    expect(on.rows[0]?.on, "2 段階が有効になった").toBe(true);
    // 2 段階を確かめても、いまのセッションはそのまま使える（取り直しでログインが切れない）
    expect((await call("GET", "/api/v1/me", undefined, H)).status, "セッションが生きている").not.toBe(401);

    const noCode = await call("POST", "/api/v1/auth/step-up", { password: PW }, H);
    expect(noCode.status).toBe(422);
    const wrong = await call(
      "POST",
      "/api/v1/auth/step-up",
      { password: PW, code: "000000" === totp(secret) ? "111111" : "000000" },
      H,
    );
    expect(wrong.status).toBe(401);
    expect(await stepUpAt(member)).toBeNull();

    const ok = await call("POST", "/api/v1/auth/step-up", { password: PW, code: totp(secret) }, H);
    expect(ok.status).toBe(201);
    // 取り直したあとも、いまのセッションで続けられる（取り直しでログインが切れない）
    expect((await call("GET", "/api/v1/me", undefined, H)).status, "取り直しの後もセッションが生きている").not.toBe(
      401,
    );
    expect(await stepUpAt(member)).not.toBeNull();
    const ev = await admin.query<{ detail: { two_factor: boolean } }>(
      "select detail from security_events where member_id = $1 and kind_id = 'step_up' order by created_at desc limit 1",
      [member],
    );
    expect(ev.rows[0]?.detail.two_factor, "記録に 2 段階で確かめたことが残る").toBe(true);
  });
});
