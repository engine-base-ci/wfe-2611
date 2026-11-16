// K-233「速さ：認証の解決を 1 回の文にまとめる」の単体の試験（口・本物の DB・本物の Better Auth のログイン）。
//   行 ID（K233-API-…）は 11_tickets/K-233.md の表と 1 対 1。
//   文の数は、試験が作った 2 つのプール（アプリの appPool と認証の pool）の接続が流した問い合わせを数える（接続を取る所を包む）。
//   振る舞い（失効・見張り・同意し直し・抜けた人・期限切れ・別の会社）は今と同じであることも、ここで一緒に見る。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth, type Auth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { ticketHooks } from "../src/hooks/tickets.js";
import { keepAuth, verifiedUser } from "./_pending.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "correct-horse-battery-1";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

let admin: pg.Pool;
let appPool: pg.Pool;
let authPool: pg.Pool;
let auth: Auth;
let app: ReturnType<typeof createApp>;
let broken: ReturnType<typeof createApp>;

// ---------------------------------------------------------------- 文を数える（接続を取る所を包み、その接続の query を記録する）
interface Hit {
  sql: string;
  client: object;
}
const hits: Hit[] = [];
function tap(pool: pg.Pool): void {
  const orig = pool.connect.bind(pool) as unknown as (cb?: unknown) => unknown;
  const wrap = (cl: pg.PoolClient): pg.PoolClient => {
    const c = cl as pg.PoolClient & { __k233?: boolean };
    if (!c.__k233) {
      const q = c.query.bind(c) as (...a: unknown[]) => unknown;
      (c as unknown as { query: (...a: unknown[]) => unknown }).query = (...a: unknown[]) => {
        const t = a[0];
        hits.push({ sql: typeof t === "string" ? t : String((t as { text?: string } | null)?.text ?? ""), client: c });
        return q(...a);
      };
      c.__k233 = true;
    }
    return cl;
  };
  (
    pool as unknown as { connect: (cb?: (e: Error | undefined, c?: pg.PoolClient, d?: unknown) => void) => unknown }
  ).connect = (cb) =>
    cb
      ? orig((e: Error | undefined, c?: pg.PoolClient, d?: unknown) => cb(e, c ? wrap(c) : c, d))
      : (orig() as Promise<pg.PoolClient>).then(wrap);
}
/** fn の間に流れた文 */
async function counted<T>(fn: () => Promise<T>): Promise<{ out: T; sql: string[] }> {
  hits.length = 0;
  const out = await fn();
  return { out, sql: hits.map((h) => h.sql) };
}
const beforeFirstBegin = (sql: string[]) => {
  const i = sql.findIndex((s) => /^\s*begin\b/i.test(s));
  return i < 0 ? sql : sql.slice(0, i);
};
const n = (sql: string[], re: RegExp) => sql.filter((s) => re.test(s)).length;

// ---------------------------------------------------------------- 人と要求
interface Who {
  token: string;
  userId: string;
  memberId: string;
  tenantId: string;
  authSessionId: string;
}
const uniq = () => `k233-${Date.now().toString(36)}${Math.floor(Math.random() * 1e5)}`;
async function person(company = "K233 の会社"): Promise<Who> {
  const v = await verifiedUser(AUTH_URL, { email: `${uniq()}@example.com`, password: PW, companyName: company });
  const m = (
    await admin.query<{ id: string; tenant_id: string }>(
      "select id, tenant_id from members where auth_user_id = $1 and deleted_at is null",
      [v.userId],
    )
  ).rows[0]!;
  const s = (await admin.query<{ id: string }>('select id from kaname_auth."session" where token = $1', [v.token]))
    .rows[0]!;
  return { token: v.token, userId: v.userId, memberId: m.id, tenantId: m.tenant_id, authSessionId: s.id };
}
const head = (t: string, o: { country?: string; ip?: string } = {}) => ({
  authorization: `Bearer ${t}`,
  "user-agent": UA,
  ...(o.country ? { "x-vercel-ip-country": o.country } : {}),
  ...(o.ip ? { "x-forwarded-for": o.ip } : {}),
});
const get = (a: ReturnType<typeof createApp>, path: string, h: Record<string, string> = {}) =>
  a.request(`http://localhost${path}`, { headers: { "x-screen-id": "tickets", ...h } });
const scopes = (t: string, o: { country?: string; ip?: string } = {}) => get(app, "/api/v1/scopes", head(t, o));
const sessionRow = async (w: Who) =>
  (
    await admin.query<{ revoked_at: Date | null; revoke_reason_id: string | null; last_seen_at: Date }>(
      "select revoked_at, revoke_reason_id, last_seen_at from sessions where auth_session_id = $1",
      [w.authSessionId],
    )
  ).rows[0]!;
const events = async (w: Who, kind: string) =>
  Number(
    (
      await admin.query<{ n: string }>(
        "select count(*) as n from security_events where member_id = $1 and kind_id = $2",
        [w.memberId, kind],
      )
    ).rows[0]!.n,
  );

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  appPool = createPool({ databaseUrl: APP_URL, max: 4 });
  const repo = await createRepository(appPool);
  const made = keepAuth(
    createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3001",
      webBaseURL: "http://localhost:3123",
      mailer: async () => undefined,
    }),
  );
  auth = made.auth;
  authPool = made.pool;
  tap(appPool);
  tap(authPool);
  const ext = (resolvePool: pg.Pool) =>
    authExt({
      auth,
      appPool: resolvePool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 1 }),
      repo,
      secrets: new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9)),
      mailer: async () => undefined,
      config: {
        secretsMasterKey: "test-master",
        baseUrl: "http://localhost:3001",
        webBaseUrl: "http://localhost:3123",
        opsEmail: "ops@example.com",
        env: "test" as const,
      },
    });
  app = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, appPool),
    authExt: ext(appPool),
    contract: { hooks: ticketHooks(appPool) },
  });
  // 解決の 1 本の文が例外になるアプリ（アプリのプールの query だけが投げる。グループを読む口はそのままの repo を使う）
  const down = Object.assign(Object.create(appPool) as pg.Pool, {
    query: () => Promise.reject(Object.assign(new Error("試験：解決の文が落ちた"), { name: "DbDown" })),
  });
  broken = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, down),
    contract: { hooks: ticketHooks(appPool) },
  });
}, 60_000);
afterAll(async () => {
  await authPool.end();
  await appPool.end();
  await admin.end();
});

describe("K-233 数（直す前と後で同じ測り方）", () => {
  it("K233-API-001 ログインした人が GET /api/v1/scopes：200・文 10 以下・解決は 2 本・member_left 0 本・kaname_auth は 1 本・begin 2 以下", async () => {
    const w = await person();
    await scopes(w.token); // 端末と国を決める 1 回目（見張りの初回の書き込みを数えない）
    const { out, sql } = await counted(() => scopes(w.token));
    expect(out.status, await out.clone().text()).toBe(200);
    const body = (await out.json()) as { data: { id: string; tenant_id: string }[] };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((s) => s.tenant_id === w.tenantId)).toBe(true);
    expect(sql.length, sql.join("\n")).toBeLessThanOrEqual(10);
    expect(beforeFirstBegin(sql).length, sql.join("\n")).toBe(2);
    expect(n(sql, /member_left/), sql.join("\n")).toBe(0);
    expect(n(sql, /kaname_auth/), sql.join("\n")).toBe(1);
    expect(n(sql, /^\s*begin\b/i), sql.join("\n")).toBeLessThanOrEqual(2);
  });

  it("K233-API-002 ログインした人が GET /api/auth-ext/me：200・本人の member と会社・文 10 以下", async () => {
    const w = await person();
    await get(app, "/api/auth-ext/me", head(w.token));
    const { out, sql } = await counted(() => get(app, "/api/auth-ext/me", head(w.token)));
    expect(out.status, await out.clone().text()).toBe(200);
    const j = (await out.json()) as { data: { member_id: string; tenant_id: string } };
    expect(j.data.member_id).toBe(w.memberId);
    expect(j.data.tenant_id).toBe(w.tenantId);
    expect(sql.length, sql.join("\n")).toBeLessThanOrEqual(10);
  });

  it("K233-API-003 GET /api/auth/get-session：user と session の欄がそろい id が結ばれる・kaname_auth を引く文は 1 本", async () => {
    const w = await person();
    const { out, sql } = await counted(() => get(app, "/api/auth/get-session", head(w.token)));
    expect(out.status).toBe(200);
    const j = (await out.json()) as {
      user: Record<string, unknown>;
      session: Record<string, unknown>;
    };
    for (const k of ["id", "email", "name", "emailVerified"]) expect(j.user, k).toHaveProperty(k);
    for (const k of ["id", "token", "userId", "expiresAt"]) expect(j.session, k).toHaveProperty(k);
    expect(j.user["id"]).toBe(w.userId);
    expect(j.session["userId"]).toBe(w.userId);
    expect(n(sql, /kaname_auth/), sql.join("\n")).toBe(1);
  });
});

describe("K-233 振る舞いは今のまま", () => {
  it("K233-API-004 ログアウトした印：GET /api/v1/scopes も GET /api/auth-ext/me も 401", async () => {
    const w = await person();
    await auth.api.signOut({ headers: new Headers(head(w.token)) });
    await admin.query("select app.close_session($1, 'logout')", [w.authSessionId]);
    expect((await scopes(w.token)).status).toBe(401);
    expect((await get(app, "/api/auth-ext/me", head(w.token))).status).toBe(401);
  });

  it("K233-API-005 最後に見た時刻が 13 時間前：401・閉じた理由は idle", async () => {
    const w = await person();
    await scopes(w.token);
    await admin.query("update sessions set last_seen_at = now() - interval '13 hours' where auth_session_id = $1", [
      w.authSessionId,
    ]);
    expect((await scopes(w.token)).status).toBe(401);
    const s = await sessionRow(w);
    expect(s.revoked_at).not.toBeNull();
    expect(s.revoke_reason_id).toBe("idle");
  });

  it("K233-API-006 最後に見た時刻が 11 時間 50 分前（12 時間の直前）：200・最後に見た時刻が今に進む", async () => {
    const w = await person();
    await scopes(w.token);
    await admin.query(
      "update sessions set last_seen_at = now() - interval '11 hours 50 minutes' where auth_session_id = $1",
      [w.authSessionId],
    );
    expect((await scopes(w.token)).status).toBe(200);
    const s = await sessionRow(w);
    expect(s.revoked_at).toBeNull();
    expect(Date.now() - new Date(s.last_seen_at).getTime()).toBeLessThan(60_000);
  });

  it("K233-API-007 国が JP → US：1 回目 200・2 回目 401・country_changed・suspicious_connection が 1 行", async () => {
    const w = await person();
    expect((await scopes(w.token, { country: "JP" })).status).toBe(200);
    expect((await scopes(w.token, { country: "US" })).status).toBe(401);
    expect((await sessionRow(w)).revoke_reason_id).toBe("country_changed");
    expect(await events(w, "suspicious_connection")).toBe(1);
  });

  it("K233-API-018 端末が変わる（Chrome/macOS → Firefox/Windows）：1 回目 200・2 回目 401・device_changed・suspicious_connection が 1 行", async () => {
    const w = await person();
    const FIREFOX_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";
    expect((await scopes(w.token)).status).toBe(200);
    const r = await get(app, "/api/v1/scopes", { ...head(w.token), "user-agent": FIREFOX_WIN });
    expect(r.status).toBe(401);
    expect((await sessionRow(w)).revoke_reason_id).toBe("device_changed");
    expect(await events(w, "suspicious_connection")).toBe(1);
  });

  it("K233-API-008 同じ国のまま IP だけ変わる：2 回とも 200・ip_changed が 1 行増える", async () => {
    const w = await person();
    expect((await scopes(w.token, { country: "JP", ip: "203.0.113.10" })).status).toBe(200);
    const before = await events(w, "ip_changed"); // 1 回目の IP を覚えた後から数える（作った時の IP との差は数えない）
    expect((await scopes(w.token, { country: "JP", ip: "203.0.113.11" })).status).toBe(200);
    expect(await events(w, "ip_changed")).toBe(before + 1);
  });

  it("K233-API-009 本人確認の取り直しの時刻：入れたセッションは ctx.stepUpAt が DB の値・入れていなければ null", async () => {
    const resolve = createSessionResolver(auth, appPool);
    const a = await person();
    const b = await person();
    await admin.query("update sessions set step_up_at = now() - interval '5 minutes' where auth_session_id = $1", [
      a.authSessionId,
    ]);
    const at = (
      await admin.query<{ at: Date }>("select step_up_at as at from sessions where auth_session_id = $1", [
        a.authSessionId,
      ])
    ).rows[0]!.at;
    const ra = await resolve(new Headers(head(a.token)));
    const rb = await resolve(new Headers(head(b.token)));
    expect(ra?.ctx.stepUpAt ? new Date(ra.ctx.stepUpAt).getTime() : null).toBe(new Date(at).getTime());
    expect(rb?.ctx.stepUpAt ?? null).toBeNull();
  });

  it("K233-API-010 同意し直しの印が立ったセッション：GET /api/v1/scopes は 403・E-AUTH-010・解決の termsPending が true", async () => {
    const w = await person();
    await admin.query("update sessions set terms_pending = true where auth_session_id = $1", [w.authSessionId]);
    const r = await scopes(w.token);
    expect(r.status).toBe(403);
    expect(((await r.json()) as { code: string }).code).toBe("E-AUTH-010");
    const got = await createSessionResolver(auth, appPool)(new Headers(head(w.token)));
    expect(got?.termsPending).toBe(true);
  });

  it("K233-API-011 会社から抜けた人の印：401（今と同じ）・member_left の文は流れない", async () => {
    const w = await person();
    await scopes(w.token);
    await admin.query("update members set deleted_at = now() where id = $1", [w.memberId]);
    const { out, sql } = await counted(() => scopes(w.token));
    expect(out.status).toBe(401);
    expect(n(sql, /member_left/), sql.join("\n")).toBe(0);
  });

  it("K233-API-012 会社に属していない人（Better Auth の利用者だけ）：解決は null・GET /api/v1/scopes は 401", async () => {
    const su = await auth.api.signUpEmail({ body: { name: "会社なし", email: `${uniq()}@example.com`, password: PW } });
    expect(su.token).toBeTruthy();
    expect(await createSessionResolver(auth, appPool)(new Headers(head(su.token!)))).toBeNull();
    expect((await scopes(su.token!)).status).toBe(401);
  });

  it("K233-API-013 Better Auth のセッションの期限が過ぎた印：401", async () => {
    const w = await person();
    await admin.query(`update kaname_auth."session" set "expiresAt" = now() - interval '1 minute' where id = $1`, [
      w.authSessionId,
    ]);
    expect((await scopes(w.token)).status).toBe(401);
  });

  it("K233-API-014 解決の 1 本の文が例外：503・E-PAGE-003・グループを読む文は流れない", async () => {
    const w = await person();
    const { out, sql } = await counted(() => get(broken, "/api/v1/scopes", head(w.token)));
    expect(out.status).toBe(503);
    expect(((await out.json()) as { code: string }).code).toBe("E-PAGE-003");
    expect(n(sql, /"scopes"/), sql.join("\n")).toBe(0);
  });

  it("K233-API-015 2 つの会社の人：どちらの答えにも相手の会社のグループが無い", async () => {
    const a = await person("K233 の会社 A");
    const b = await person("K233 の会社 B");
    const ids = async (w: Who) => {
      const r = await scopes(w.token);
      expect(r.status).toBe(200);
      return ((await r.json()) as { data: { id: string; tenant_id: string }[] }).data;
    };
    const da = await ids(a);
    const db = await ids(b);
    expect(da.every((s) => s.tenant_id === a.tenantId)).toBe(true);
    expect(db.every((s) => s.tenant_id === b.tenantId)).toBe(true);
    const bIds = new Set(db.map((s) => s.id));
    expect(da.some((s) => bIds.has(s.id))).toBe(false);
  });

  it("K233-API-016 同じ印で 2 本同時：2 本とも 200・セッションは閉じない", async () => {
    const w = await person();
    await scopes(w.token);
    const [x, y] = await Promise.all([scopes(w.token), scopes(w.token)]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect((await sessionRow(w)).revoked_at).toBeNull();
  });

  it("K233-API-017 印が無い・形の違う印：どちらも 401・session_check の文は流れない", async () => {
    const none = await counted(() => get(app, "/api/v1/scopes", { "user-agent": UA }));
    expect(none.out.status).toBe(401);
    const bad = await counted(() =>
      get(app, "/api/v1/scopes", { authorization: "Bearer not-a-token", "user-agent": UA }),
    );
    expect(bad.out.status).toBe(401);
    expect(n([...none.sql, ...bad.sql], /session_check/)).toBe(0);
  });
});
