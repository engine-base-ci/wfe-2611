// 認証とセッション（実 Postgres・schema auth）。失効の正は public.sessions：認証のセッションが生きていても revoked なら文脈は無い（G-14）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createAuth, type Auth } from "../src/index.js";
import { migrateAuth } from "../src/migrate.js";
import { changePassword, createSessionResolver, signOut } from "../src/resolver.js";

const URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = URL.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db");
const admin = new pg.Pool({ connectionString: URL, max: 2 });
const app = new pg.Pool({ connectionString: APP_URL, max: 3 });
let auth: Auth;
let authPool: pg.Pool;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
const email = `staff-${Date.now()}@example.test`;
const password = "correct-horse-battery-staple";
const bearer = (token: string) => new Headers({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  await migrate(URL, dbPkg);
  await migrateAuth(URL);
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
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

describe("登録 → 会社に属す → ログイン → 文脈", () => {
  const resolve = () => createSessionResolver(auth, app);
  let token = "";
  it("登録した利用者を担当者（members）に結び、ログインすると public.sessions に行ができる", async () => {
    const su = await auth.api.signUpEmail({ body: { name: "担当者", email, password } });
    await admin.query("update members set auth_user_id = $1 where id = $2", [su.user.id, S.staffA]);
    const si = await auth.api.signInEmail({ body: { email, password } });
    token = si.token;
    const rows = await admin.query("select kind_id, revoked_at from sessions where member_id = $1", [S.staffA]);
    expect(rows.rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.rows.every((r) => r["revoked_at"] === null)).toBe(true);
  });
  it("Bearer のトークンでテナント文脈が決まる（会社 a の担当者）", async () => {
    const r = await resolve()(bearer(token));
    expect(r?.ctx).toEqual({ tenantId: S.tenantA, userId: S.staffA, role: "member", stepUpAt: null }); // ログインしただけでは本人確認の取り直しは無い
  });
  it("トークンが無い・でたらめなら文脈は無い", async () => {
    expect(await resolve()(new Headers())).toBeNull();
    expect(await resolve()(bearer("not-a-token"))).toBeNull();
  });
  it("上流を壊す（G-14）：権限が変わると public.sessions が全部 revoked になり、認証のセッションが生きていても 401 相当", async () => {
    await admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id) values ($1, $2, 'goal', 'view')",
      [S.tenantA, S.staffA],
    );
    const s = await auth.api.getSession({ headers: bearer(token) });
    expect(s).not.toBeNull(); // 認証側はまだ生きている（期限内）
    expect(await resolve()(bearer(token))).toBeNull(); // でも文脈は無い＝失効の正は sessions
    const sec = await admin.query(
      "select kind_id, detail from security_events where member_id = $1 and kind_id = 'sessions_revoked'",
      [S.staffA],
    );
    expect(sec.rows.length).toBeGreaterThanOrEqual(1);
  });
  it("ログインし直すと新しい行で戻る。ログアウトで両方閉じる", async () => {
    const si = await auth.api.signInEmail({ body: { email, password } });
    token = si.token;
    expect(await resolve()(bearer(token))).not.toBeNull();
    await signOut(auth, app, bearer(token));
    expect(await resolve()(bearer(token))).toBeNull();
    const live = await admin.query("select id from sessions where member_id = $1 and revoked_at is null", [S.staffA]);
    expect(live.rowCount).toBe(0);
  });
  it("パスワード変更で全端末が失効する", async () => {
    const a = await auth.api.signInEmail({ body: { email, password } });
    const b = await auth.api.signInEmail({ body: { email, password } });
    await changePassword(auth, app, bearer(a.token), password, "another-long-passphrase-42");
    expect(await resolve()(bearer(b.token))).toBeNull();
    expect(await resolve()(bearer(a.token))).toBeNull();
    const back = await auth.api.signInEmail({ body: { email, password: "another-long-passphrase-42" } });
    expect(await resolve()(bearer(back.token))).not.toBeNull();
  });
  it("人が抜けた（論理削除）ら失効する", async () => {
    const si = await auth.api.signInEmail({ body: { email, password: "another-long-passphrase-42" } });
    await admin.query("update members set deleted_at = now() where id = $1", [S.staffA]);
    expect(await resolve()(bearer(si.token))).toBeNull();
    await admin.query("update members set deleted_at = null where id = $1", [S.staffA]);
  });
  it("会社に属していない利用者はログインできても文脈が無い（登録の途中）", async () => {
    const e2 = `nobody-${Date.now()}@example.test`;
    await auth.api.signUpEmail({ body: { name: "誰か", email: e2, password } });
    const si = await auth.api.signInEmail({ body: { email: e2, password } });
    expect(await resolve()(bearer(si.token))).toBeNull();
  });
});
