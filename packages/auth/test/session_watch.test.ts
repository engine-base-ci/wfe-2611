// セッションの見張り（KN-57・D-125.140・D-128.120・ZT6）。実 Postgres・schema auth。
//   操作が無い 12 時間・最長 7 日で 401 ／ 国か端末が変わったら 401（閉じる）／ 同じ国の中の IP の変化は記録だけ ／
//   新しい端末でのログインは本人に知らせる ／ 管理者は会社の長さを短くできる（長くはできない）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createAuth, type Auth, type Mail } from "../src/index.js";
import { migrateAuth } from "../src/migrate.js";
import { createSessionResolver } from "../src/resolver.js";
import { deviceOf } from "../src/device.js";

const URL = process.env["DATABASE_URL"]!;
const APP_URL = URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = URL.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const dbPkg = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db");
const admin = new pg.Pool({ connectionString: URL, max: 2 });
const app = new pg.Pool({ connectionString: APP_URL, max: 3 });
let auth: Auth;
let authPool: pg.Pool;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
const mails: Mail[] = [];
const email = `watch-${Date.now()}@example.test`;
const password = "correct-horse-battery-staple";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const WIN_FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";
const req = (token: string, o: { ua?: string; country?: string; ip?: string } = {}) =>
  new Headers({
    authorization: `Bearer ${token}`,
    "user-agent": o.ua ?? MAC_CHROME,
    ...(o.country ? { "x-vercel-ip-country": o.country } : {}),
    ...(o.ip ? { "x-forwarded-for": o.ip } : {}),
  });

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
    mailer: async (m) => {
      mails.push(m);
    },
  });
  auth = a.auth;
  authPool = a.pool;
  const su = await auth.api.signUpEmail({ body: { name: "見張り", email, password } });
  await admin.query("update members set auth_user_id = $1 where id = $2", [su.user.id, S.staffA]);
});
afterAll(async () => {
  await authPool.end();
  await app.end();
  await admin.end();
});

const signIn = async (ua = MAC_CHROME) =>
  (await auth.api.signInEmail({ body: { email, password }, headers: new Headers({ "user-agent": ua }) })).token;
const resolve = () => createSessionResolver(auth, app);
const reasonOf = async (token: string) => {
  const s = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
  return (
    await admin.query<{ r: string | null }>("select revoke_reason_id as r from sessions where auth_session_id = $1", [
      s!.session.id,
    ])
  ).rows[0]?.r;
};

describe("端末の読み方", () => {
  it("ブラウザの種類と OS まで（版の数字は見ない）", () => {
    expect(deviceOf(MAC_CHROME)).toBe("chrome/macos");
    expect(deviceOf(MAC_CHROME.replace("130.0", "131.0"))).toBe("chrome/macos");
    expect(deviceOf(WIN_FIREFOX)).toBe("firefox/windows");
    expect(deviceOf("Kaname-Bridge/1.2 (Windows)")).toBe("bridge/windows");
    expect(deviceOf(null)).toBeNull();
    // 読み取りは ua-parser-js（1 系・MIT）に任せる
    expect(
      deviceOf(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("safari/ios");
    expect(
      deviceOf(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
      ),
    ).toBe("edge/windows");
    expect(
      deviceOf(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
      ),
    ).toBe("chrome/android");
  });
});

describe("セッションの見張り（KN-57）", () => {
  it("新しい端末でログインすると本人に知らせる（画面とメール）。同じ端末の 2 回目は知らせない", async () => {
    const before = mails.length;
    await signIn();
    expect(mails.length).toBe(before + 1);
    expect(mails.at(-1)!.kind).toBe("new_device");
    const n = await admin.query(
      "select 1 from notifications where member_id = $1 and event_kind_id = 'security.new_device'",
      [S.staffA],
    );
    expect(n.rowCount).toBeGreaterThanOrEqual(1);
    await signIn();
    expect(mails.length).toBe(before + 1);
  });

  it("同じ国の中で IP だけ変わっても切らず、記録だけ残す", async () => {
    const t = await signIn();
    expect(await resolve()(req(t, { country: "JP", ip: "203.0.113.1" }))).not.toBeNull();
    expect(await resolve()(req(t, { country: "JP", ip: "203.0.113.99" }))).not.toBeNull();
    const ev = await admin.query("select detail from security_events where member_id = $1 and kind_id = 'ip_changed'", [
      S.staffA,
    ]);
    expect(ev.rowCount).toBeGreaterThanOrEqual(1);
  });

  it("国が変わったら 401（閉じる）。印が無い所では国で判定しない", async () => {
    const t = await signIn();
    expect(await resolve()(req(t, { country: "JP" }))).not.toBeNull();
    expect(await resolve()(req(t))).not.toBeNull(); // 印が無い（ローカル）なら国では切らない
    expect(await resolve()(req(t, { country: "US" }))).toBeNull();
    expect(await reasonOf(t)).toBe("country_changed");
    expect(await resolve()(req(t, { country: "JP" }))).toBeNull(); // 戻しても閉じたまま（入り直し）
  });

  it("端末が変わったら 401（閉じる）", async () => {
    const t = await signIn();
    expect(await resolve()(req(t))).not.toBeNull();
    expect(await resolve()(req(t, { ua: WIN_FIREFOX }))).toBeNull();
    expect(await reasonOf(t)).toBe("device_changed");
  });

  it("操作が無い 12 時間で 401・最長 7 日で 401", async () => {
    const t1 = await signIn();
    expect(await resolve()(req(t1))).not.toBeNull();
    const s1 = await auth.api.getSession({ headers: req(t1) });
    await admin.query(
      "update sessions set last_seen_at = now() - interval '12 hours 1 minute' where auth_session_id = $1",
      [s1!.session.id],
    );
    expect(await resolve()(req(t1))).toBeNull();
    expect(await reasonOf(t1)).toBe("idle");

    const t2 = await signIn();
    const s2 = await auth.api.getSession({ headers: req(t2) });
    await admin.query("update sessions set issued_at = now() - interval '7 days 1 minute' where auth_session_id = $1", [
      s2!.session.id,
    ]);
    expect(await resolve()(req(t2))).toBeNull();
    expect(await reasonOf(t2)).toBe("max_age");
  });

  it("管理者は会社の長さを短くできる。長くはできない", async () => {
    await admin.query("update tenants set session_idle_hours = 1 where id = $1", [S.tenantA]);
    try {
      const t = await signIn();
      const s = await auth.api.getSession({ headers: req(t) });
      await admin.query("update sessions set last_seen_at = now() - interval '61 minutes' where auth_session_id = $1", [
        s!.session.id,
      ]);
      expect(await resolve()(req(t))).toBeNull();
    } finally {
      await admin.query("update tenants set session_idle_hours = 12 where id = $1", [S.tenantA]);
    }
    const tooLong = await admin.query("update tenants set session_idle_hours = 24 where id = $1", [S.tenantA]).then(
      () => null,
      (e: Error) => e.message,
    );
    expect(tooLong).toMatch(/tenants_session_idle_ck/);
  });
});

describe("Bridge は時間では切らない（D-128.121）", () => {
  it("Bridge のセッションは 25 時間操作が無くても生きている。画面のセッションは切れる", async () => {
    const BRIDGE = "Kaname-Bridge/1.0 (Macintosh; Mac OS X)";
    const t = await signIn(BRIDGE);
    const s = await auth.api.getSession({ headers: req(t, { ua: BRIDGE }) });
    await admin.query(
      "update sessions set last_seen_at = now() - interval '25 hours', issued_at = now() - interval '8 days' where auth_session_id = $1",
      [s!.session.id],
    );
    expect(await resolve()(req(t, { ua: BRIDGE }))).not.toBeNull();
  });
});
