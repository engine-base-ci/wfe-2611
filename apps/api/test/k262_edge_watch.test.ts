// K-262「画面と口を同じ住所にまとめる」：セッションの見張り（K-20・国や端末が変わったら閉じる）が、直の道と中継の道を
//   行き来しても全員を閉じないことの試験（実 Postgres・本物の Better Auth）。行 ID（K262-API-…）は 11_tickets/K-262.md の表と 1 対 1。
//   中継の道の要求は、口の入口（edgeRequest）で写した本当の IP と国に置き換えてから解く（本番の apps/api/src/vercel.ts と同じ順）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { seedAccessMatrix } from "@kaname/db/seeds";
import { createAuth, type Auth } from "@kaname/auth";
import { migrateAuth } from "@kaname/auth/migrate";
import { createSessionResolver } from "@kaname/auth/resolver";
import { edgeRequest } from "../src/edge.js";
import { keepAuth } from "./_pending.js";

const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const SECRET = "k262-edge-secret-0123456789abcdef";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const USER_IP = "203.0.113.5";
const EDGE_IP = "76.76.21.9"; // 画面の入口（中継した Vercel）の IP。国は US に見える
const admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
const appPool = new pg.Pool({ connectionString: APP_URL, max: 3 });
let auth: Auth;
let authPool: pg.Pool;
let memberId = "";
const email = `k262-${Date.now().toString(36)}@example.test`;
const password = "correct-horse-battery-staple";

/** 直の道（Bridge・切り替えの途中の古いタブ）：Vercel が上書きした本当の値 */
const direct = (token: string, country = "JP", ip = USER_IP) =>
  new Request("https://kaname-api.example.com/api/auth-ext/me", {
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": UA,
      "x-forwarded-for": ip,
      "x-real-ip": ip,
      "x-vercel-ip-country": country,
    },
  });
/** 中継の道：元の頭は画面の入口のもの（US・76.76.21.9）、写した頭が利用者 */
const proxied = (token: string, clientCountry = "JP", secret = SECRET) =>
  new Request("https://kaname-api.example.com/api/auth-ext/me", {
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": UA,
      "x-forwarded-for": EDGE_IP,
      "x-real-ip": EDGE_IP,
      "x-vercel-ip-country": "US",
      "x-kaname-client-ip": USER_IP,
      "x-kaname-client-country": clientCountry,
      "x-kaname-edge-secret": secret,
    },
  });
const headersOf = (r: Request) => edgeRequest(r, SECRET).headers;
const resolve = () => createSessionResolver(auth, appPool);
const reasonOf = async (token: string) => {
  const s = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
  return (
    await admin.query<{ r: string | null }>("select revoke_reason_id as r from sessions where auth_session_id = $1", [
      s!.session.id,
    ])
  ).rows[0]?.r;
};

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  const c = await admin.connect();
  let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
  const made = keepAuth(
    createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3001",
      mailer: async () => undefined,
    }),
  );
  auth = made.auth;
  authPool = made.pool;
  const su = await auth.api.signUpEmail({ body: { name: "中継", email, password } });
  memberId = S.staffA;
  await admin.query("update members set auth_user_id = $1 where id = $2", [su.user.id, memberId]);
}, 60_000);
afterAll(async () => {
  await authPool.end();
  await appPool.end();
  await admin.end();
});

/** 中継の道でログインする（画面の入口を通った sign-in・口の入口で置き換えてから Better Auth に渡す） */
const signInProxied = async () =>
  (
    await auth.api.signInEmail({
      body: { email, password },
      headers: headersOf(proxied("")),
    })
  ).token;

describe("K-262 セッションの見張りと中継の道", () => {
  it("K262-API-009 中継の道でログインすると、セッションに記録される IP は利用者の IP（中継の IP でない）", async () => {
    const t = await signInProxied();
    const s = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${t}` }) });
    expect(s!.session.ipAddress).toBe(USER_IP);
  });

  it("K262-API-010 同じセッションで直の道と中継の道を 3 回ずつ行き来しても閉じない（国 JP・IP が同じ）。国の変化と IP の変化の記録も足されない", async () => {
    const t = await signInProxied();
    const since = new Date();
    for (let i = 0; i < 3; i++) {
      expect(await resolve()(headersOf(direct(t))), `直 ${i}`).not.toBeNull();
      expect(await resolve()(headersOf(proxied(t))), `中継 ${i}`).not.toBeNull();
    }
    expect(await reasonOf(t)).toBeNull();
    const ev = await admin.query(
      "select kind_id from security_events where member_id = $1 and kind_id in ('ip_changed', 'suspicious_connection') and created_at >= $2",
      [memberId, since],
    );
    expect(ev.rows).toEqual([]);
  });

  it("K262-API-011 見張りは中継の道でも効く：秘密が合う中継の道で利用者の国が本当に変わった（JP → US）ら 401（閉じる・country_changed）", async () => {
    const t = await signInProxied();
    expect(await resolve()(headersOf(proxied(t, "JP")))).not.toBeNull();
    expect(await resolve()(headersOf(proxied(t, "US")))).toBeNull();
    expect(await reasonOf(t)).toBe("country_changed");
  });

  it("K262-API-012 秘密を偽った中継の道（秘密が違う）は写した頭を使わない：元の頭（中継の国 US）で判定され、利用者の国だと名乗っても通らない", async () => {
    const t = await signInProxied();
    expect(await resolve()(headersOf(direct(t)))).not.toBeNull();
    const forged = headersOf(proxied(t, "JP", "wrong-secret-0123456789abcdefghij"));
    expect(forged.get("x-vercel-ip-country")).toBe("US");
    expect(await resolve()(forged)).toBeNull();
    expect(await reasonOf(t)).toBe("country_changed");
  });
});
