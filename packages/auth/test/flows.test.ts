// T-F-06：2 段階認証・招待・端末（実 Postgres・schema auth）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createPool } from "@kaname/db/pool";
import { createRepository, type Repository } from "@kaname/db/repository";
import { createAuth, type Auth } from "../src/index.js";
import { migrateAuth } from "../src/migrate.js";
import { createSessionResolver } from "../src/resolver.js";
import { enableTotp, signIn, verifyTotp } from "../src/two_factor.js";
import { acceptInvitation, createInvitation, revokeInvitation } from "../src/invitations.js";
import { listOwnDevices, revokeOwnDevice } from "../src/devices.js";

const DB_URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db");
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let app: pg.Pool;
let repo: Repository;
let auth: Auth;
let authPool: pg.Pool;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
const password = "correct-horse-battery-staple";
const bearer = (token: string) => new Headers({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  await migrate(DB_URL, dbPkg);
  await migrateAuth(DB_URL);
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
  app = createPool({ databaseUrl: APP_URL, max: 3 });
  repo = await createRepository(app);
  const a = createAuth({
    authDatabaseUrl: AUTH_URL,
    appPool: app,
    secret: "test-secret-0123456789-abcdefghijklmnop",
    baseURL: "http://localhost:3000",
  });
  auth = a.auth;
  authPool = a.pool;
});
afterAll(async () => {
  await authPool.end();
  await app.end();
  await admin.end();
});
const boss = () => ({ tenantId: S.tenantA, userId: S.bossA, role: "member" as const });
const staff = () => ({ tenantId: S.tenantA, userId: S.staffA, role: "member" as const });

describe("招待（作る → 受ける → 取り消し）", () => {
  it("権限のある代表が招待し、新しい利用者が受けると担当者としてメンバーになりログインできる", async () => {
    const inv = await createInvitation(repo, boss(), {
      email: "Guest@Example.test",
      scopeId: S.scopeDeptA,
      roleId: "R3",
    });
    expect(inv.token.length).toBeGreaterThan(30);
    const email = `guest-${Date.now()}@example.test`;
    const su = await auth.api.signUpEmail({ body: { name: "招かれた人", email, password } });
    const member = await acceptInvitation(app, inv.token, su.user.id, "招かれた人");
    const si = await signIn(auth, email, password);
    const r = await createSessionResolver(auth, app)(bearer(si.token!));
    expect(r?.ctx).toEqual({ tenantId: S.tenantA, userId: member, role: "member", stepUpAt: null });
    await expect(acceptInvitation(app, inv.token, su.user.id, "x")).rejects.toThrow(/無効|既に/); // 2 回目は無効
  });
  it("権限の無い担当者は招待を作れない。取り消した招待は即受けられない（G-14）", async () => {
    await expect(createInvitation(repo, staff(), { email: "x@example.test" })).rejects.toThrow(/row-level security/);
    const inv = await createInvitation(repo, boss(), { email: "y@example.test" });
    expect(await revokeInvitation(repo, boss(), inv.id)).toBe(true);
    const su = await auth.api.signUpEmail({
      body: { name: "遅い人", email: `late-${Date.now()}@example.test`, password },
    });
    await expect(acceptInvitation(app, inv.token, su.user.id, "遅い人")).rejects.toThrow(/無効/);
  });
  it("でたらめなトークンは無効", async () => {
    await expect(acceptInvitation(app, "nope", "u", "x")).rejects.toThrow(/無効/);
  });
});

describe("2 段階認証（TOTP）", () => {
  const email = `totp-${Date.now()}@example.test`;
  it("有効化 → コードで確認 → 次のログインはコードが要る → コードで通る", async () => {
    const su = await auth.api.signUpEmail({ body: { name: "2 段階", email, password } });
    await admin.query("update members set auth_user_id = $1 where id = $2", [su.user.id, S.bossA]);
    const first = await signIn(auth, email, password);
    expect(first.twoFactor).toBe(false);
    const en = await enableTotp(auth, bearer(first.token!), password);
    expect(en.totpURI).toMatch(/^otpauth:\/\/totp\//);
    expect(en.backupCodes.length).toBeGreaterThan(0);
    // URI の secret は base32（padding 無し）。createOTP は生の秘密を取る
    const secret = new TextDecoder().decode(base32.decode(new URL(en.totpURI).searchParams.get("secret")!));
    const code = await createOTP(secret, { digits: 6, period: 30 }).totp();
    await verifyTotp(auth, bearer(first.token!), code);
    const second = await signIn(auth, email, password);
    expect(second.twoFactor).toBe(true);
    expect(second.token).toBeNull();
    const code2 = await createOTP(secret, { digits: 6, period: 30 }).totp();
    const done = await verifyTotp(auth, new Headers({ cookie: second.cookie }), code2);
    expect(done.token).toBeTruthy();
    const r = await createSessionResolver(auth, app)(bearer(done.token));
    expect(r?.ctx.userId).toBe(S.bossA);
  });
  it("間違ったコードは通らない", async () => {
    const s = await signIn(auth, email, password);
    await expect(verifyTotp(auth, new Headers({ cookie: s.cookie }), "000000")).rejects.toThrow();
  });
});

describe("端末", () => {
  it("Bridge の UA は kind=bridge。自分の端末を一覧して 1 台だけ失効できる。他人の端末は触れない", async () => {
    const email = `dev-${Date.now()}@example.test`;
    const su = await auth.api.signUpEmail({ body: { name: "端末", email, password } });
    await admin.query("update members set auth_user_id = $1 where id = $2", [su.user.id, S.staffA]);
    const web = await signIn(auth, email, password, "Mozilla/5.0");
    const bridge = await signIn(auth, email, password, "Kaname-Bridge/0.1 (macOS)");
    const list = await listOwnDevices(repo, staff());
    const kinds = list.filter((d) => d["revoked_at"] === null).map((d) => d["kind_id"]);
    expect(kinds.filter((k) => k === "bridge")).toHaveLength(1); // Bridge の UA は bridge
    expect(kinds).toContain("web"); // 種の web ＋ このテストの web
    const bridgeRow = list.find((d) => d["kind_id"] === "bridge")!;
    expect(await revokeOwnDevice(app, staff(), String(bridgeRow["id"]))).toBe(true);
    expect(await createSessionResolver(auth, app)(bearer(bridge.token!))).toBeNull();
    expect(await createSessionResolver(auth, app)(bearer(web.token!))).not.toBeNull();
    // 他人（代表）が担当者の端末を本人用の関数で消そうとしても 0
    expect(await revokeOwnDevice(app, boss(), String(list.find((d) => d["kind_id"] === "web")!["id"]))).toBe(false);
  });
});
