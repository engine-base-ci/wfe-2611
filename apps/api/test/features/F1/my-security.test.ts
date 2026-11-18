// K-308「安全の設定を読む口と『付けるまで進めない』の印」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K308-API-… / K308-DB-…）は 11_tickets/K-308.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては本番と同じ bootApi（apps/api/src/server.ts）。外に出るものは関門の差し込み口だけを差し替える（K-53 の terms.test.ts と同じ）。
// 本人とログインは、ログインの部品で直に作る（signUp・signInWithLock・2 段階は enableTotp → verifyTotp）。
// パスキーの行は、パスキーの部品（@better-auth/passkey・K-304 が kaname_auth.passkey を足す）の表に直に入れる（足す儀式そのものは K-309）。
//
// 試験が決める口の形（K-308 が 05_flow/screen_api.py の getMySecurity の型を直す）:
//   getMySecurity（GET /api/v1/me/security・本人だけ・120 回／分／人）→ 200 { data: {
//     passkeys: [{ id, name, created_at, last_used_at, synced }]（作った順）, has_password, two_factor, two_factor_required,
//     backup_codes_left, mfa_pending } }
//   two_factor_required ＝ パスワードがあり、パスキーが 0 本で、2 段階が無い（D-128.61）
//   返さないもの：公開鍵・credential_id・TOTP の鍵・バックアップコードの中身・端末の一覧（sessions）・安全の記録（recent_events。F10 の口）
// 試験が前提にする DB の形（このチケットの migration・番号は取り込む時点の次の空き）:
//   app.login_methods(text) → (passkeys int, has_password boolean, two_factor boolean)
//   sessions.mfa_pending boolean not null default false・app.mark_session_mfa(text)（ログインでセッションができた hook が呼ぶ）
//   app.settle_mfa_pending(text) → int（入り方がそろったら、その人の生きているセッションの印を全部下ろす）
//   app.revoke_sessions_for_auth_user_except(text, text, text) → int（K-312 が使う：全部のワークスペースの端末と PC を、残す 1 つのほか切る）
// 取り直しの判定（案 3 で K-309 から移した・代表の答え ⑬）:
//   resolver が文脈に loginAt（部品のセッションの createdAt）を入れる。apps/api/src/contract/permissions.ts の
//   stepUpOrFreshLogin(ctx, now) は「step_up_at が 15 分の内」か「loginAt が 15 分の内」なら true
//   apps/api/src/contract/op.ts は stepUpGuards(ctx, now?) を export し、hooks に渡す { requireStepUp, requireStepUpOrFreshLogin } を
//   ここから作る（入口が組み立てる HookArgs と同じ物）。requireStepUpOrFreshLogin() は通れば undefined、
//   通らなければ 403 { error: "step_up_required", code: "STEP_UP_REQUIRED" }（requireStepUp と同じ形）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { signInWithLock, signUp } from "@kaname/auth/signup";
import { enableTotp, signIn, verifyTotp } from "@kaname/auth/two_factor";
import { createPool } from "@kaname/db/pool";
import type { Config } from "@kaname/config";
import type { MailLike } from "@kaname/notify";
import { createSessionResolver } from "@kaname/auth/resolver";
import { agreeCurrentTerms } from "../../../../../packages/db/test/agree-terms.js";
import { stepUpOrFreshLogin } from "../../../src/contract/permissions.js";
import { stepUpGuards } from "../../../src/contract/op.js";
import { bootApi, type BootOptions } from "../../../src/server.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PKG = join(HERE, "..", "..", "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const OPS_EMAIL = "ops-k308@example.com";
const RUN = `k308-${Date.now().toString(36)}`; // この回が作るものの印（G-10）
const PW = "correct-horse-battery-1";
const SECURITY = "/api/v1/me/security";
const WEB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const BRIDGE_UA = "Kaname-Bridge/1.0 (K-308 test)";
const ANSWER_KEYS = [
  "backup_codes_left",
  "has_password",
  "mfa_pending",
  "passkeys",
  "two_factor",
  "two_factor_required",
];
const PASSKEY_KEYS = ["created_at", "id", "last_used_at", "name", "synced"];

type Seams = BootOptions & { mail: MailLike; outboundFetch: typeof fetch };
const fakeMail: MailLike = { send: async () => ({ error: null }) };
const fakeFetch: typeof fetch = async (input) => {
  throw new Error(`K-308 は外に出ない: ${String(input)}`);
};
const config = {
  env: "test",
  databaseUrl: APP_URL,
  authDatabaseUrl: AUTH_URL,
  authSecret: "test-secret-0123456789-abcdefghijklmnop",
  baseUrl: "http://127.0.0.1:3001",
  webBaseUrl: "http://127.0.0.1:3123",
  webOrigins: [],
  storage: {
    endpoint: "http://127.0.0.1:9000",
    region: "ap-northeast-1",
    bucket: "kaname-dev",
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
    forcePathStyle: true,
  },
  secretsMasterKey: Buffer.alloc(32, 7).toString("base64"),
  resendApiKey: null,
  mailFrom: "Kaname <noreply@example.com>",
  opsEmail: OPS_EMAIL,
  mailReplyTo: OPS_EMAIL,
  operator: { service: "Kaname", company: "試験", representative: "試験", email: OPS_EMAIL, phone: "", address: null },
  mailSuppressPrefix: "",
  bridgeReleaseBase: "",
  bridgeReleaseDir: "",
  infisical: null,
  listenDatabaseUrl: null,
  port: 0,
} as Config;

let app: Awaited<ReturnType<typeof bootApi>>;
let admin: pg.Pool;
let authFixture: ReturnType<typeof createAuth>;
let fixturePool: pg.Pool;
let ipSeq = 0;
const nextIp = () => `198.18.8.${(ipSeq = (ipSeq % 250) + 1)}`;
const email = (tag: string) => `${RUN}-${tag}@example.com`;
const req = (method: string, path: string, body?: unknown, o: { ip?: string; headers?: Record<string, string> } = {}) =>
  app.app.request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": o.ip ?? nextIp(),
      "user-agent": WEB_UA,
      ...(o.headers ?? {}),
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const json = async (r: Response) => (await r.json()) as Record<string, unknown> & { data?: unknown };

/** TOTP（RFC 6238・SHA1・30 秒・6 桁）。認証アプリの代わり（apps/web/tests/_lib/api.ts の totp と同じ計算） */
function totp(secretBase32: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const off = h[h.length - 1]! & 0xf;
  const code =
    ((h[off]! & 0x7f) << 24) | ((h[off + 1]! & 0xff) << 16) | ((h[off + 2]! & 0xff) << 8) | (h[off + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

interface Person {
  email: string;
  userId: string;
  memberId: string;
  tenantId: string;
}
/** 本人を作る（会社ごと）。今の版の規約に同意済みにし、登録のときのセッションは閉じる（ここからはログインでできたセッションだけを見る） */
const person = async (tag: string): Promise<Person> => {
  const e = email(tag);
  const r = await signUp(authFixture.auth, { email: e, password: PW, name: "安全 を見る人", companyName: `${RUN}-社` });
  const m = (
    await admin.query<{ id: string; tenant_id: string }>("select id, tenant_id from members where auth_user_id = $1", [
      r.userId,
    ])
  ).rows[0]!;
  await admin.query("update sessions set revoked_at = now() where member_id = $1 and revoked_at is null", [m.id]);
  await agreeCurrentTerms((sql, p = []) => admin.query(sql, p).then((x) => x.rows), r.userId);
  return { email: e, userId: r.userId, memberId: m.id, tenantId: m.tenant_id };
};
/** パスワードでログインする（ログインでセッションができた hook が印を決める） */
const login = async (p: Person, ua = WEB_UA): Promise<string> => {
  const r = await signInWithLock(authFixture.auth, fixturePool, p.email, PW, ua);
  expect(r.ok, "ログインできる").toBe(true);
  return r.token!;
};
/** そのトークンの public.sessions の行 */
const sessionOf = async (token: string) =>
  (
    await admin.query<{ id: string; mfa_pending: boolean; revoked_at: Date | null; kind_id: string }>(
      `select s.id, s.mfa_pending, s.revoked_at, s.kind_id from sessions s
         join kaname_auth.session a on a.id = s.auth_session_id where a.token = $1`,
      [token.split(".")[0]],
    )
  ).rows[0]!;
/** 2 段階認証を付ける（ログインの部品で直に。口の startTwoFactor・confirmTwoFactor は K-311）。部品がセッションを作り直すので新しい token を返す */
const enable2fa = async (token: string): Promise<{ token: string; secret: string }> => {
  const h = new Headers(bearer(token));
  const { totpURI } = await enableTotp(authFixture.auth, h, PW);
  const secret = new URL(totpURI).searchParams.get("secret")!;
  const v = await verifyTotp(authFixture.auth, h, totp(secret));
  return { token: v.token || token, secret };
};
/** パスキーの行を部品の表に直に入れる（足す儀式は K-309）。返すのは id */
const insertPasskey = async (userId: string, name: string, at = "now()"): Promise<string> =>
  (
    await admin.query<{ id: string }>(
      `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
       values ($1, $2, $3, $4, $5, 0, 'multiDevice', true, 'internal', ${at}) returning id`,
      [randomUUID(), name, `pk-secret-${randomUUID()}`, userId, `cred-${randomUUID()}`],
    )
  ).rows[0]!.id;
const security = async (token: string) => {
  const r = await req("GET", SECURITY, undefined, { headers: bearer(token) });
  expect(r.status, await r.clone().text()).toBe(200);
  return (await json(r)).data as Record<string, unknown> & { passkeys: Record<string, unknown>[] };
};
const methods = async (userId: string) =>
  (
    await admin.query<{ passkeys: number; has_password: boolean; two_factor: boolean }>(
      "select * from app.login_methods($1)",
      [userId],
    )
  ).rows[0]!;

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 3 });
  const seams: Seams = { bucketExists: async () => true, mail: fakeMail, outboundFetch: fakeFetch };
  app = await bootApi(config, seams);
  fixturePool = createPool({ databaseUrl: APP_URL, max: 2 });
  authFixture = createAuth({
    authDatabaseUrl: AUTH_URL,
    appPool: fixturePool,
    secret: config.authSecret,
    baseURL: config.baseUrl,
  });
}, 60_000);

afterAll(async () => {
  await admin?.query(
    `delete from kaname_auth.passkey where "userId" in (select id from kaname_auth."user" where email like $1)`,
    [`${RUN}-%`],
  );
  await app?.close();
  await authFixture?.pool.end();
  await fixturePool?.end();
  await admin?.end();
});

describe("K-308 DB：入り方を数える関数と『付けるまで進めない』の印", () => {
  it("K308-DB-001 app.login_methods：パスワードだけ → (0, true, false)。パスキー 2 本と 2 段階 → (2, true, true)。パスワードの行が無ければ has_password は false", async () => {
    const p = await person("methods");
    expect(await methods(p.userId)).toEqual({ passkeys: 0, has_password: true, two_factor: false });
    await insertPasskey(p.userId, "1 本目");
    await insertPasskey(p.userId, "2 本目");
    await enable2fa(await login(p));
    expect(await methods(p.userId)).toEqual({ passkeys: 2, has_password: true, two_factor: true });
    await admin.query(`delete from kaname_auth.account where "userId" = $1 and "providerId" = 'credential'`, [
      p.userId,
    ]);
    expect((await methods(p.userId)).has_password).toBe(false);
  });

  it("K308-DB-002 パスワードだけ・パスキー無し・2 段階無しでログイン：そのセッションの mfa_pending は true", async () => {
    const p = await person("mark-pw");
    const t = await login(p);
    expect((await sessionOf(t)).mfa_pending).toBe(true);
  });

  it("K308-DB-003 パスキーが 1 本ある人がパスワードでログイン：mfa_pending は false", async () => {
    const p = await person("mark-pk");
    await insertPasskey(p.userId, "この Mac");
    const t = await login(p);
    expect((await sessionOf(t)).mfa_pending).toBe(false);
  });

  it("K308-DB-004 2 段階を付けた人がパスワード → 6 けたでログイン：できたセッションの mfa_pending は false", async () => {
    const p = await person("mark-2fa");
    const { secret } = await enable2fa(await login(p));
    const s = await signIn(authFixture.auth, p.email, PW, WEB_UA);
    expect(s.twoFactor, "2 段階を求められる").toBe(true);
    const v = await verifyTotp(authFixture.auth, new Headers({ cookie: s.cookie, "user-agent": WEB_UA }), totp(secret));
    expect((await sessionOf(v.token)).mfa_pending).toBe(false);
  });

  it("K308-DB-005 PC（Bridge）のセッション：パスワードだけの人でも mfa_pending は立てない（PC の仕事を人の印で止めない・D-128.137）", async () => {
    const p = await person("mark-bridge");
    const t = await login(p, BRIDGE_UA);
    const s = await sessionOf(t);
    expect(s.kind_id).toBe("bridge");
    expect(s.mfa_pending).toBe(false);
  });

  it("K308-DB-006 app.settle_mfa_pending：入り方がそろっていなければ 0 で印は残る。パスキーが付いたら、その人の生きているセッション 2 つの印が全部下りて 2 を返す", async () => {
    const p = await person("settle");
    const a = await login(p);
    const b = await login(p);
    const none = await admin.query<{ n: number }>("select app.settle_mfa_pending($1) as n", [p.userId]);
    expect(none.rows[0]!.n).toBe(0);
    expect([(await sessionOf(a)).mfa_pending, (await sessionOf(b)).mfa_pending]).toEqual([true, true]);
    await insertPasskey(p.userId, "足した");
    const done = await admin.query<{ n: number }>("select app.settle_mfa_pending($1) as n", [p.userId]);
    expect(done.rows[0]!.n).toBe(2);
    expect([(await sessionOf(a)).mfa_pending, (await sessionOf(b)).mfa_pending]).toEqual([false, false]);
  });

  it("K308-DB-007 付けている途中でセッションが切れた → 入り直す：まだ付いていなければ、新しいセッションにも印が立つ（続きから）", async () => {
    const p = await person("relogin");
    const a = await login(p);
    await admin.query("update sessions set revoked_at = now(), revoke_reason_id = 'expired' where id = $1", [
      (await sessionOf(a)).id,
    ]);
    const b = await login(p);
    expect((await sessionOf(b)).mfa_pending).toBe(true);
  });

  it("K308-DB-008 app.revoke_sessions_for_auth_user_except：2 つのワークスペースの画面と PC のセッションを、残す 1 つのほか全部切る（理由 password_changed）。各ワークスペースの security_events に残る", async () => {
    const p = await person("except");
    const keep = await login(p);
    const other = await login(p);
    const bridge = await login(p, BRIDGE_UA);
    // 2 つ目のワークスペース（同じログインの人＝ tenant_memberships.auth_user_id が同じ・D-125.150）
    const t2 = (
      await admin.query<{ id: string }>(
        "insert into tenants (id, tenant_id, name) select u, u, $1 from gen_random_uuid() u returning id",
        [`${RUN}-2 つ目`],
      )
    ).rows[0]!.id;
    const sc2 = (
      await admin.query<{ id: string }>("insert into scopes (tenant_id, name) values ($1, $2) returning id", [
        t2,
        `${RUN}-2 つ目の全体`,
      ])
    ).rows[0]!.id;
    const m2 = (
      await admin.query<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '同じ人') returning id",
        [t2, sc2],
      )
    ).rows[0]!.id;
    await admin.query(
      "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, 'member', 'active')",
      [t2, m2, p.userId],
    );
    const s2 = (
      await admin.query<{ id: string }>(
        "insert into sessions (tenant_id, member_id, kind_id, auth_session_id) values ($1, $2, 'web', $3) returning id",
        [t2, m2, `${RUN}-ws2-${randomUUID()}`],
      )
    ).rows[0]!.id;
    const keepId = (
      await admin.query<{ id: string }>("select id from kaname_auth.session where token = $1", [keep.split(".")[0]])
    ).rows[0]!.id;
    const n = await admin.query<{ n: number }>(
      "select app.revoke_sessions_for_auth_user_except($1, $2, 'password_changed') as n",
      [p.userId, keepId],
    );
    expect(n.rows[0]!.n).toBe(3);
    expect((await sessionOf(keep)).revoked_at).toBeNull();
    expect((await sessionOf(other)).revoked_at).not.toBeNull();
    expect((await sessionOf(bridge)).revoked_at).not.toBeNull();
    const ws2 = await admin.query<{ revoked_at: Date | null; revoke_reason_id: string }>(
      "select revoked_at, revoke_reason_id from sessions where id = $1",
      [s2],
    );
    expect(ws2.rows[0]!.revoked_at).not.toBeNull();
    expect(ws2.rows[0]!.revoke_reason_id).toBe("password_changed");
    for (const tenant of [p.tenantId, t2]) {
      const ev = await admin.query(
        "select 1 from security_events where tenant_id = $1 and kind_id = 'sessions_revoked'",
        [tenant],
      );
      expect(ev.rowCount, `ワークスペース ${tenant} に記録`).toBeGreaterThan(0);
    }
  });

  it("K308-DB-009 足した関数はアプリの接続（kaname_app）だけが呼べる。誰でも（PUBLIC）は呼べない", async () => {
    for (const sig of [
      "app.login_methods(text)",
      "app.mark_session_mfa(text)",
      "app.settle_mfa_pending(text)",
      "app.session_mfa_pending(uuid)",
      "app.revoke_sessions_for_auth_user_except(text, text, text)",
    ]) {
      const r = await admin.query<{ app: boolean; acl: string | null }>(
        "select has_function_privilege('kaname_app', $1, 'execute') as app, (select proacl::text from pg_proc where oid = $1::regprocedure) as acl",
        [sig],
      );
      expect(r.rows[0]!.app, sig).toBe(true);
      expect(r.rows[0]!.acl ?? "", `${sig} は PUBLIC に開いていない`).not.toMatch(/(^|[{,])=X/);
    }
  });
});

describe("K-308 口：getMySecurity（自分の安全の設定を読む）", () => {
  it("K308-API-001 パスワードだけの人：200・passkeys は空・has_password true・two_factor false・two_factor_required true・backup_codes_left 0・mfa_pending true", async () => {
    const p = await person("read-pw");
    const d = await security(await login(p));
    expect(d.passkeys).toEqual([]);
    expect(d["has_password"]).toBe(true);
    expect(d["two_factor"]).toBe(false);
    expect(d["two_factor_required"]).toBe(true);
    expect(d["backup_codes_left"]).toBe(0);
    expect(d["mfa_pending"]).toBe(true);
  });

  it("K308-API-002 パスキー 2 本の人：作った順に 2 件。各件は id・name・created_at・last_used_at・synced だけ。two_factor_required false", async () => {
    const p = await person("read-pk");
    const first = await insertPasskey(p.userId, "この Mac", "now() - interval '2 days'");
    const second = await insertPasskey(p.userId, "iPhone", "now() - interval '1 day'");
    const d = await security(await login(p));
    expect(d.passkeys.map((x) => x["id"])).toEqual([first, second]);
    expect(d.passkeys.map((x) => x["name"])).toEqual(["この Mac", "iPhone"]);
    for (const k of d.passkeys) expect(Object.keys(k).sort()).toEqual(PASSKEY_KEYS);
    expect(d["two_factor_required"]).toBe(false);
    expect(d["mfa_pending"]).toBe(false);
  });

  it("K308-API-003 2 段階を付けた人：two_factor true・backup_codes_left 10・two_factor_required false", async () => {
    const p = await person("read-2fa");
    const { token } = await enable2fa(await login(p));
    const d = await security(token);
    expect(d["two_factor"]).toBe(true);
    expect(d["backup_codes_left"]).toBe(10);
    expect(d["two_factor_required"]).toBe(false);
  });

  it("K308-API-013 2 段階の印はあるのにバックアップコードを読めない（部品の行が無い食い違い）：読む口は 200 で返し、two_factor true・mfa_pending・passkeys はそのまま、backup_codes_left だけ null（読めない）。中身もエラーの文も答えに出さない", async () => {
    const p = await person("read-2fa-broken");
    await insertPasskey(p.userId, "この Mac");
    const { token } = await enable2fa(await login(p));
    await admin.query('delete from kaname_auth."twoFactor" where "userId" = $1', [p.userId]);
    const r = await req("GET", SECURITY, undefined, { headers: bearer(token) });
    const text = await r.text();
    expect(r.status, text).toBe(200);
    const d = (JSON.parse(text) as { data: Record<string, unknown> & { passkeys: unknown[] } }).data;
    expect(Object.keys(d).sort()).toEqual(ANSWER_KEYS);
    expect(d["two_factor"]).toBe(true);
    expect(d["backup_codes_left"]).toBeNull();
    expect(d["two_factor_required"]).toBe(false);
    expect(d["mfa_pending"]).toBe(false);
    expect(d.passkeys).toHaveLength(1);
    expect(text).not.toMatch(/BACKUP_CODES|backup codes/i);
  });

  it("K308-API-004 答えの欄は決めた 6 つだけ。公開鍵・credential_id・TOTP の鍵・バックアップコード・端末の一覧・安全の記録は返さない", async () => {
    const p = await person("read-keys");
    await insertPasskey(p.userId, "鍵を持つ");
    const { token, secret } = await enable2fa(await login(p));
    const r = await req("GET", SECURITY, undefined, { headers: bearer(token) });
    const text = await r.text();
    const d = (JSON.parse(text) as { data: Record<string, unknown> }).data;
    expect(Object.keys(d).sort()).toEqual(ANSWER_KEYS);
    const row = (
      await admin.query<{ public_key: string; credential_id: string }>(
        'select "publicKey" as public_key, "credentialID" as credential_id from kaname_auth.passkey where "userId" = $1',
        [p.userId],
      )
    ).rows[0]!;
    expect(text).not.toContain(row.public_key);
    expect(text).not.toContain(row.credential_id);
    expect(text).not.toContain(secret);
    for (const k of ["sessions", "recent_events", "public_key", "credential_id", "secret", "backup_codes"])
      expect(text).not.toContain(`"${k}"`);
  });

  it("K308-API-005 他の人のパスキーは、自分の一覧にも数にも混ざらない（2 人）", async () => {
    const a = await person("mine-a");
    const b = await person("mine-b");
    await insertPasskey(b.userId, "B さんの鍵");
    const d = await security(await login(a));
    expect(d.passkeys).toEqual([]);
    expect(d["two_factor_required"]).toBe(true);
  });

  it("K308-API-006 権限を何も持たない人（見るだけの役）も、自分の安全の設定は読める：200", async () => {
    const boss = await person("viewer-boss");
    const e = email("viewer");
    const u = await authFixture.auth.api.signUpEmail({ body: { email: e, password: PW, name: "見るだけの人" } });
    const scope = (
      await admin.query<{ id: string }>("select id from scopes where tenant_id = $1 limit 1", [boss.tenantId])
    ).rows[0]!.id;
    const mid = (
      await admin.query<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id) values ($1, $2, 'human', '見るだけの人', $3) returning id",
        [boss.tenantId, scope, u.user.id],
      )
    ).rows[0]!.id;
    await admin.query("update sessions set revoked_at = now() where member_id = $1 and revoked_at is null", [mid]);
    await agreeCurrentTerms((sql, p = []) => admin.query(sql, p).then((x) => x.rows), u.user.id);
    const viewer: Person = { email: e, userId: u.user.id, memberId: mid, tenantId: boss.tenantId };
    const d = await security(await login(viewer));
    expect(d["has_password"]).toBe(true);
  });

  it("K308-API-007 付け終わった後に、古いリンク・ブックマークでもう一度読む：今の状態（パスキーあり・mfa_pending false）を返す", async () => {
    const p = await person("after-done");
    const t = await login(p);
    expect((await security(t))["mfa_pending"]).toBe(true);
    await insertPasskey(p.userId, "付け終わった");
    await admin.query("select app.settle_mfa_pending($1)", [p.userId]);
    const d = await security(t);
    expect(d["mfa_pending"]).toBe(false);
    expect(d.passkeys).toHaveLength(1);
  });

  it("K308-API-008 ログインしていない・ログアウトした後のセッション：401・何も返さない", async () => {
    const none = await req("GET", SECURITY);
    expect(none.status).toBe(401);
    const p = await person("logged-out");
    const t = await login(p);
    // ログアウト（口の signOut は K-306）と同じ閉じ方：認証の側と public.sessions の両方を閉じる
    const authId = (
      await admin.query<{ id: string }>("select id from kaname_auth.session where token = $1", [t.split(".")[0]])
    ).rows[0]!.id;
    await admin.query("select app.close_session($1, 'logout')", [authId]);
    await admin.query("delete from kaname_auth.session where id = $1", [authId]);
    const after = await req("GET", SECURITY, undefined, { headers: bearer(t) });
    expect(after.status).toBe(401);
    expect(await after.text()).not.toContain("has_password");
  });

  it("K308-API-009 同じ人が 1 分に 121 回読む：121 回目は 429・retry_after_sec（120 回まで通る）", async () => {
    const p = await person("rate");
    const t = await login(p);
    for (let i = 0; i < 120; i++) {
      const r = await req("GET", SECURITY, undefined, { headers: bearer(t) });
      expect(r.status, `${i + 1} 回目は上限の内`).toBe(200);
    }
    const r = await req("GET", SECURITY, undefined, { headers: bearer(t) });
    expect(r.status).toBe(429);
    expect((await json(r))["retry_after_sec"]).toBe(60);
  });
});

describe("K-308 取り直しの判定（ログインから 15 分の内は取り直し不要・案 3 で K-309 から移した）", () => {
  const MIN = 60 * 1000;
  const ctxAt = (stepUpAgo: number | null, loginAgo: number | null, now: number) => ({
    tenantId: randomUUID(),
    userId: randomUUID(),
    role: "member" as const,
    stepUpAt: stepUpAgo === null ? null : new Date(now - stepUpAgo),
    loginAt: loginAgo === null ? null : new Date(now - loginAgo),
  });

  it("K308-API-010 stepUpOrFreshLogin：取り直し 14 分 50 秒前は通る・15 分 10 秒前は通らない（ログインから 16 分）。取り直しが無くてもログインから 14 分 50 秒なら通る・15 分 10 秒なら通らない。どちらも無ければ通らない", () => {
    const now = Date.now();
    expect(stepUpOrFreshLogin(ctxAt(14 * MIN + 50_000, 16 * MIN, now), now)).toBe(true);
    expect(stepUpOrFreshLogin(ctxAt(15 * MIN + 10_000, 16 * MIN, now), now)).toBe(false);
    expect(stepUpOrFreshLogin(ctxAt(null, 14 * MIN + 50_000, now), now)).toBe(true);
    expect(stepUpOrFreshLogin(ctxAt(null, 15 * MIN + 10_000, now), now)).toBe(false);
    expect(stepUpOrFreshLogin(ctxAt(null, null, now), now)).toBe(false);
  });

  it("K308-API-011 resolver は文脈に loginAt（部品のセッションの createdAt）を入れる。ログインから 16 分たったことにすると loginAt も 16 分前になる", async () => {
    const p = await person("login-at");
    const t = await login(p);
    const resolve = createSessionResolver(authFixture.auth, fixturePool);
    const created = async () =>
      (
        await admin.query<{ at: Date }>('select "createdAt" as at from kaname_auth.session where token = $1', [
          t.split(".")[0],
        ])
      ).rows[0]!.at;
    const r1 = await resolve(new Headers({ authorization: `Bearer ${t}`, "user-agent": WEB_UA }));
    expect(r1, "解ける").not.toBeNull();
    expect(new Date(r1!.ctx.loginAt!).getTime()).toBe((await created()).getTime());
    const id = (
      await admin.query<{ id: string }>("select id from kaname_auth.session where token = $1", [t.split(".")[0]])
    ).rows[0]!.id;
    await admin.query(`update kaname_auth.session set "createdAt" = now() - interval '16 minutes' where id = $1`, [id]);
    await admin.query("update sessions set issued_at = now() - interval '16 minutes' where auth_session_id = $1", [id]);
    const r2 = await resolve(new Headers({ authorization: `Bearer ${t}`, "user-agent": WEB_UA }));
    const ago = Date.now() - new Date(r2!.ctx.loginAt!).getTime();
    expect(ago).toBeGreaterThan(15 * MIN);
    expect(stepUpOrFreshLogin(r2!.ctx)).toBe(false);
  });

  it("K308-API-012 hooks に渡す requireStepUpOrFreshLogin()（op.ts の stepUpGuards）：ログインから 14 分 50 秒・取り直し無しは通る（undefined）。ログインから 16 分・取り直し 15 分 10 秒前は 403・STEP_UP_REQUIRED。取り直し 14 分 50 秒前なら通る", () => {
    const now = Date.now();
    const guard = (stepUpAgo: number | null, loginAgo: number | null) =>
      stepUpGuards(ctxAt(stepUpAgo, loginAgo, now), now).requireStepUpOrFreshLogin();
    expect(guard(null, 14 * MIN + 50_000)).toBeUndefined();
    const denied = guard(15 * MIN + 10_000, 16 * MIN);
    expect(denied).toBeDefined();
    expect(denied!.status).toBe(403);
    expect(denied!.body).toMatchObject({ error: "step_up_required", code: "STEP_UP_REQUIRED" });
    expect(guard(14 * MIN + 50_000, 16 * MIN)).toBeUndefined();
  });
});
