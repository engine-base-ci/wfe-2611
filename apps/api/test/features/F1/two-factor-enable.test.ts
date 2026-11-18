// K-311「2 段階認証を付ける口」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K311-API-…）は 11_tickets/K-311.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては本番と同じ bootApi。本人とログインはログインの部品で直に作る（K-308 の my-security.test.ts と同じ）。
//
// 試験が決める口の形（05_flow/screen_api.py の型を K-311 が直す）:
//   startTwoFactor（POST /api/v1/me/two-factor/enable・本人）体 { password } → 201 { data: { otpauth_uri, secret } }
//     secret は認証アプリに手で入れる鍵の文字（この答えの 1 回だけ）。まだ付かない（"user".two_factor_enabled は false のまま）
//     本人確認の取り直し：直前 15 分の取り直しか、ログインから 15 分の内なら通る（聞くこと 2 の勧め (b)）。外は 403・STEP_UP_REQUIRED
//     パスワードが違う → 422・欄 password（401 にしない：画面がログアウト扱いにしないため）。鍵を作らない
//     もう付いている → 409・E-AUTH-017「2 段階認証はもう付いています」。鍵は変わらない
//     付けていない途中でもう一度 → 前の鍵を捨てて新しい鍵（前の鍵の 6 けたは通らない）
//   confirmTwoFactor（POST /api/v1/me/two-factor/confirm・本人）体 { code } → 201 { data: { backup_codes: string[10], token: string | null } }
//     付く（two_factor_enabled = true）。バックアップコード 10 個はこの答えの 1 回だけ。部品がセッションを作り直したら token に新しい印（画面は差し替える）
//     コードの形：空・5 けた・7 けた・数字でない → 422・欄 code。全角の数字と間の空白は直して比べる
//     違う → 422・E-AUTH-004（1 つ前の 30 秒のコードまでは通す）。始めていない → 409・CONFLICT。もう付いた後 → 409（コードは返さない）
//     付いたら security_events に two_factor_enabled・その人の生きているセッションの印 mfa_pending を全部下ろす
//     バックアップコードは小文字の英字と数字だけで作る（代表の答え ⑭ answer=6bdcb125e8f7。入れる側で小文字にそろえるのは K-302）
//   パスワードの無い人（パスキーだけ・代表の答え ② answer=9177d9dbe0d9）が始める → 409・E-AUTH-020「2 段階認証を付けるには、先にパスワードを決めてください」
//     （決める口は K-312 の setMyPassword。決めた後なら始められる）
//   バックアップコードを引けなければ付けない（先に引いてから確かめる）→ 503・E-PAGE-003
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { signInWithLock, signUp } from "@kaname/auth/signup";
import { createPool } from "@kaname/db/pool";
import type { Config } from "@kaname/config";
import type { MailLike } from "@kaname/notify";
import { agreeCurrentTerms } from "../../../../../packages/db/test/agree-terms.js";
import { bootApi, type BootOptions } from "../../../src/server.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PKG = join(HERE, "..", "..", "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const OPS_EMAIL = "ops-k311@example.com";
const RUN = `k311-${Date.now().toString(36)}`;
const PW = "correct-horse-battery-1";
const START = "/api/v1/me/two-factor/enable";
const CONFIRM = "/api/v1/me/two-factor/confirm";
const SECURITY = "/api/v1/me/security";
const STEP_UP = "/api/v1/auth/step-up";
const WEB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const ALREADY = "E-AUTH-017";
const MSG_ALREADY = "2 段階認証はもう付いています";
const WRONG_CODE = "E-AUTH-004";
const NEED_PASSWORD = "E-AUTH-020"; // 番号は仮（取り込む時点の次の空き）
const MSG_NEED_PASSWORD = "2 段階認証を付けるには、先にパスワードを決めてください";
const MSG_WRONG_CODE = "コードが違います。認証アプリの時刻が合っているか確かめてください";

type Seams = BootOptions & { mail: MailLike; outboundFetch: typeof fetch };
const fakeMail: MailLike = { send: async () => ({ error: null }) };
const fakeFetch: typeof fetch = async (input) => {
  throw new Error(`K-311 は外に出ない: ${String(input)}`);
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
const nextIp = () => `198.18.11.${(ipSeq = (ipSeq % 250) + 1)}`;
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
const fieldsOf = (j: Record<string, unknown>) =>
  ((j["details"] as { field?: string }[] | undefined) ?? []).map((d) => d.field);

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
/** 6 けたを全角の数字にする（表記ゆらぎ） */
const wide = (s: string) => s.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0));

interface Person {
  email: string;
  userId: string;
  memberId: string;
  tenantId: string;
}
const person = async (tag: string): Promise<Person> => {
  const e = email(tag);
  const r = await signUp(authFixture.auth, {
    email: e,
    password: PW,
    name: "2 段階 を付ける人",
    companyName: `${RUN}-社`,
  });
  const m = (
    await admin.query<{ id: string; tenant_id: string }>("select id, tenant_id from members where auth_user_id = $1", [
      r.userId,
    ])
  ).rows[0]!;
  await admin.query("update sessions set revoked_at = now() where member_id = $1 and revoked_at is null", [m.id]);
  await agreeCurrentTerms((sql, p = []) => admin.query(sql, p).then((x) => x.rows), r.userId);
  return { email: e, userId: r.userId, memberId: m.id, tenantId: m.tenant_id };
};
/** パスワードでログイン（印 mfa_pending はそのまま：この口は付けるまで進めない間も開いている口） */
const login = async (p: Person): Promise<string> => {
  const r = await signInWithLock(authFixture.auth, fixturePool, p.email, PW, WEB_UA);
  expect(r.ok, "ログインできる").toBe(true);
  return r.token!;
};
const authSessionId = async (token: string) =>
  (await admin.query<{ id: string }>("select id from kaname_auth.session where token = $1", [token.split(".")[0]]))
    .rows[0]!.id;
const ageLogin = async (token: string, minutes: number) => {
  const id = await authSessionId(token);
  await admin.query(`update kaname_auth.session set "createdAt" = now() - make_interval(mins => $2) where id = $1`, [
    id,
    minutes,
  ]);
  await admin.query("update sessions set issued_at = now() - make_interval(mins => $2) where auth_session_id = $1", [
    id,
    minutes,
  ]);
};
const stepUp = async (token: string) => {
  const r = await req("POST", STEP_UP, { password: PW }, { headers: bearer(token) });
  expect(r.status, await r.clone().text()).toBe(201);
};
type Started = { otpauth_uri: string; secret: string };
const start = async (token: string): Promise<Started> => {
  const r = await req("POST", START, { password: PW }, { headers: bearer(token) });
  expect(r.status, await r.clone().text()).toBe(201);
  return (await json(r)).data as Started;
};
type Confirmed = { backup_codes: string[]; token: string | null };
const confirm = (token: string, code: string) => req("POST", CONFIRM, { code }, { headers: bearer(token) });
const enabled = async (userId: string) =>
  (
    await admin.query<{ on: boolean | null }>('select "twoFactorEnabled" as on from kaname_auth."user" where id = $1', [
      userId,
    ])
  ).rows[0]!.on === true;
const factorRow = async (userId: string) =>
  (
    await admin.query<{ secret: string; backup_codes: string }>(
      'select secret, "backupCodes" as backup_codes from kaname_auth."twoFactor" where "userId" = $1',
      [userId],
    )
  ).rows;

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
  await app?.close();
  await authFixture?.pool.end();
  await fixturePool?.end();
  await admin?.end();
});

describe("K-311 2 段階認証を始める・確かめる", () => {
  it("K311-API-001 2 段階なし・取り直しの内 × 始める：201・otpauth の URI と鍵の文字。まだ付いていない（two_factor_enabled は false）", async () => {
    const p = await person("start");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    expect(s.otpauth_uri).toMatch(/^otpauth:\/\/totp\//);
    expect(new URL(s.otpauth_uri).searchParams.get("secret")).toBe(s.secret);
    expect(s.secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(await enabled(p.userId)).toBe(false);
  });

  it("K311-API-002 始めた後に正しい 6 けたで確かめる：201・バックアップコード 10 個（重ならない）。付き、安全の設定は two_factor true・backup_codes_left 10", async () => {
    const p = await person("confirm");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    const r = await confirm(t, totp(s.secret));
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await json(r)).data as Confirmed;
    expect(d.backup_codes).toHaveLength(10);
    expect(new Set(d.backup_codes).size).toBe(10);
    expect(await enabled(p.userId)).toBe(true);
    const now = d.token ?? t;
    const sec = (await json(await req("GET", SECURITY, undefined, { headers: bearer(now) }))).data as Record<
      string,
      unknown
    >;
    expect(sec["two_factor"]).toBe(true);
    expect(sec["backup_codes_left"]).toBe(10);
  });

  it("K311-API-003 始めて確かめないまま、もう一度始める（入り直してからも同じ）：前の鍵を捨てて新しい鍵。前の鍵の 6 けたは 422・E-AUTH-004、新しい鍵で付く", async () => {
    const p = await person("restart");
    const t1 = await login(p);
    await stepUp(t1);
    const first = await start(t1);
    const t2 = await login(p); // 途中でセッションが切れて入り直した（D-128.141）
    await stepUp(t2);
    const second = await start(t2);
    expect(second.secret).not.toBe(first.secret);
    const old = await confirm(t2, totp(first.secret));
    expect(old.status).toBe(422);
    expect((await json(old))["code"]).toBe(WRONG_CODE);
    expect((await confirm(t2, totp(second.secret))).status).toBe(201);
  });

  it(`K311-API-004 もう付いている × 始めるを口に直に：409・${ALREADY}「${MSG_ALREADY}」。鍵は変わらない`, async () => {
    const p = await person("already");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    const now = ((await json(await confirm(t, totp(s.secret)))).data as Confirmed).token ?? t;
    const before = await factorRow(p.userId);
    // 2 段階を付けた人の取り直しはパスワードとその場の 6 けた（apps/api/src/hooks/auth.ts の stepUp）
    const su = await req("POST", STEP_UP, { password: PW, code: totp(s.secret) }, { headers: bearer(now) });
    expect(su.status, await su.clone().text()).toBe(201);
    const r = await req("POST", START, { password: PW }, { headers: bearer(now) });
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe(ALREADY);
    expect(j["message"]).toBe(MSG_ALREADY);
    expect(await factorRow(p.userId)).toEqual(before);
  });

  it("K311-API-005 付いた後に確かめの口をもう一度（古いタブ）：409。バックアップコードは返さない", async () => {
    const p = await person("confirm-again");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    const now = ((await json(await confirm(t, totp(s.secret)))).data as Confirmed).token ?? t;
    const r = await confirm(now, totp(s.secret));
    expect(r.status).toBe(409);
    expect(await r.text()).not.toContain("backup_codes");
  });

  it("K311-API-006 6 けたを 2 回同時に送る（自動で進むのと Enter）：201 は 1 回だけ。後の 1 本は 401（前のセッションが閉じた後に入口に着いた）か 409・422 で、バックアップコードを返さない", async () => {
    const p = await person("double");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    const code = totp(s.secret);
    const rs = await Promise.all([confirm(t, code), confirm(t, code)]);
    const ok = rs.filter((r) => r.status === 201);
    expect(ok).toHaveLength(1);
    const other = rs.find((r) => r.status !== 201)!;
    expect([401, 409, 422]).toContain(other.status);
    expect(await other.text()).not.toContain("backup_codes");
  });

  it("K311-API-007 コードの形：空・5 けた・7 けた・英字は 422・欄 code。全角の数字と間の空白は直して比べて通る", async () => {
    const p = await person("format");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    for (const code of ["", "12345", "1234567", "abcdef"]) {
      const r = await confirm(t, code);
      expect(r.status, JSON.stringify(code)).toBe(422);
      expect(fieldsOf(await json(r)), JSON.stringify(code)).toContain("code");
    }
    expect(await enabled(p.userId)).toBe(false);
    const c = totp(s.secret);
    const r = await confirm(t, `${wide(c.slice(0, 3))} ${wide(c.slice(3))}`);
    expect(r.status, await r.clone().text()).toBe(201);
  });

  it(`K311-API-008 6 けたが違う：422・${WRONG_CODE}「${MSG_WRONG_CODE}」。1 つ前の 30 秒のコードは通る`, async () => {
    const p = await person("wrong");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    const bad = String((Number(totp(s.secret)) + 1) % 1_000_000).padStart(6, "0");
    const r = await confirm(t, bad);
    expect(r.status).toBe(422);
    const j = await json(r);
    expect(j["code"]).toBe(WRONG_CODE);
    expect(j["message"]).toBe(MSG_WRONG_CODE);
    expect(await enabled(p.userId)).toBe(false);
    expect((await confirm(t, totp(s.secret, Date.now() - 30_000))).status).toBe(201);
  });

  it("K311-API-009 始めるときのパスワードが違う：422・欄 password（401 にしない）。鍵を作らない", async () => {
    const p = await person("bad-pw");
    const t = await login(p);
    await stepUp(t);
    const r = await req("POST", START, { password: "wrong-horse-battery-9" }, { headers: bearer(t) });
    expect(r.status).toBe(422);
    expect(fieldsOf(await json(r))).toContain("password");
    expect(await factorRow(p.userId)).toHaveLength(0);
  });

  it("K311-API-010 ログインから 16 分・取り直し無し × 始める：403・STEP_UP_REQUIRED。鍵を作らない", async () => {
    const p = await person("stale");
    const t = await login(p);
    await ageLogin(t, 16);
    const r = await req("POST", START, { password: PW }, { headers: bearer(t) });
    expect(r.status).toBe(403);
    expect((await json(r))["code"]).toBe("STEP_UP_REQUIRED");
    expect(await factorRow(p.userId)).toHaveLength(0);
  });

  it("K311-API-011 登録の直後（ログインから 15 分の内）・取り直し無し × 始める：201（ログインを取り直しとみなす・聞くこと 2 の勧め (b)）", async () => {
    const p = await person("fresh");
    const t = await login(p);
    const r = await req("POST", START, { password: PW }, { headers: bearer(t) });
    expect(r.status, await r.clone().text()).toBe(201);
  });

  it("K311-API-012 始めていないのに確かめる：409・CONFLICT。付かない", async () => {
    const p = await person("no-start");
    const t = await login(p);
    const r = await confirm(t, "123456");
    expect(r.status).toBe(409);
    expect(await enabled(p.userId)).toBe(false);
  });

  it("K311-API-013 始めた後の鍵に期限を設けない（PM が決めた作り方）：始めた記録は security_events の two_factor_started に 1 行（中身に鍵を入れない）。そのまま確かめて 201", async () => {
    const p = await person("late");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    // security_events は追記だけ（0003 のトリガ）なので時刻は動かさない。期限が無いことは、鍵に期限の欄を持たないこと（契約の答えに expires_at が無い）で見る
    const started = await admin.query<{ d: string }>(
      "select detail::text as d from security_events where tenant_id = $1 and member_id = $2 and kind_id = 'two_factor_started'",
      [p.tenantId, p.memberId],
    );
    expect(started.rowCount, "始めた記録が 1 行ある").toBe(1);
    expect(started.rows[0]!.d).not.toContain(s.secret);
    expect(Object.keys(s).sort()).toEqual(["otpauth_uri", "secret"]);
    expect((await confirm(t, totp(s.secret))).status).toBe(201);
  });

  it("K311-API-014 付けるまで進めない印が立った人（端末 2 つ）が付ける：両方のセッションの mfa_pending が下り、security_events に two_factor_enabled が 1 行", async () => {
    const p = await person("settle");
    const a = await login(p);
    await login(p);
    await stepUp(a);
    const s = await start(a);
    expect((await confirm(a, totp(s.secret))).status).toBe(201);
    const flags = await admin.query<{ mfa_pending: boolean }>(
      "select mfa_pending from sessions where member_id = $1 and revoked_at is null",
      [p.memberId],
    );
    expect(flags.rows.length).toBeGreaterThanOrEqual(2);
    expect(flags.rows.every((x) => x.mfa_pending === false)).toBe(true);
    const ev = await admin.query(
      "select 1 from security_events where tenant_id = $1 and kind_id = 'two_factor_enabled' and member_id = $2",
      [p.tenantId, p.memberId],
    );
    expect(ev.rowCount).toBe(1);
  });

  it("K311-API-015 パスキーを持つ人も、任意で 2 段階を付けられる（D-128.61）：始める 201・確かめる 201", async () => {
    const p = await person("with-passkey");
    await admin.query(
      `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
       values (gen_random_uuid()::text, 'この Mac', 'pk', $1, gen_random_uuid()::text, 0, 'multiDevice', true, 'internal', now())`,
      [p.userId],
    );
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    expect((await confirm(t, totp(s.secret))).status).toBe(201);
    await admin.query('delete from kaname_auth.passkey where "userId" = $1', [p.userId]);
  });
});

describe("K-311 守り", () => {
  it("K311-API-016 DB の中：TOTP の鍵とバックアップコードは平文で持たない（部品が鍵で包む・D-128.141 の C8 の例外）", async () => {
    const p = await person("at-rest");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    const d = (await json(await confirm(t, totp(s.secret)))).data as Confirmed;
    const row = (await factorRow(p.userId))[0]!;
    expect(row.secret).not.toContain(s.secret);
    for (const c of d.backup_codes) expect(row.backup_codes).not.toContain(c);
  });

  it("K311-API-017 ログ：始める・確かめるの間に、鍵の文字・otpauth の URI・6 けた・バックアップコード・パスワードが出ない", async () => {
    const out: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
    );
    let secrets: string[];
    try {
      const p = await person("logs");
      const t = await login(p);
      const s = await start(t);
      const code = totp(s.secret);
      const d = (await json(await confirm(t, code))).data as Confirmed;
      secrets = [s.secret, s.otpauth_uri, code, PW, ...d.backup_codes];
    } finally {
      for (const sp of spies) sp.mockRestore();
    }
    const text = out.join("\n");
    for (const x of secrets) expect(text).not.toContain(x);
  });

  it("K311-API-018 バックアップコードを引く所で失敗（部品の表の中身が壊れている）：503・E-PAGE-003。付かない（付いたのにコードを返せない状態を作らない）", async () => {
    const p = await person("codes-fail");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    await admin.query('update kaname_auth."twoFactor" set "backupCodes" = \'broken\' where "userId" = $1', [p.userId]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await confirm(t, totp(s.secret));
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
    }
    expect(await enabled(p.userId)).toBe(false);
  });

  it("K311-API-019 ログインしていない人が始める・確かめる：401。何も作らない", async () => {
    expect((await req("POST", START, { password: PW })).status).toBe(401);
    expect((await req("POST", CONFIRM, { code: "123456" })).status).toBe(401);
  });

  it("K311-API-020 同じ人が 1 分に確かめを 61 回：61 回目は 429・retry_after_sec（60 回まで通る）", async () => {
    const p = await person("rate");
    const t = await login(p);
    await stepUp(t);
    await start(t);
    for (let i = 0; i < 60; i++) {
      const r = await confirm(t, "000000");
      expect(r.status, `${i + 1} 回目は上限の内`).not.toBe(429);
    }
    const r = await confirm(t, "000000");
    expect(r.status).toBe(429);
    expect((await json(r))["retry_after_sec"]).toBe(60);
  });
});

describe("K-311 代表の答え（⑭ バックアップコードの字・② パスワードの無い人）", () => {
  it("K311-API-021 バックアップコード 10 個は、どれも小文字の英字と数字だけ（大文字・記号を含まない）", async () => {
    const p = await person("lower");
    const t = await login(p);
    await stepUp(t);
    const s = await start(t);
    const r = await confirm(t, totp(s.secret));
    expect(r.status, await r.clone().text()).toBe(201);
    const codes = ((await json(r)).data as Confirmed).backup_codes;
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c, c).toMatch(/^[a-z0-9]{8,}$/);
  });

  it(`K311-API-022 パスワードの無い人（パスキーだけ）× 始める：409・${NEED_PASSWORD}「${MSG_NEED_PASSWORD}」。鍵を作らない`, async () => {
    const p = await person("no-password");
    const t = await login(p);
    await admin.query(
      `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
       values (gen_random_uuid()::text, 'この Mac', 'pk', $1, gen_random_uuid()::text, 0, 'multiDevice', true, 'internal', now())`,
      [p.userId],
    );
    await admin.query(`delete from kaname_auth.account where "userId" = $1 and "providerId" = 'credential'`, [
      p.userId,
    ]);
    const r = await req("POST", START, { password: "" }, { headers: bearer(t) });
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe(NEED_PASSWORD);
    expect(j["message"]).toBe(MSG_NEED_PASSWORD);
    expect(await factorRow(p.userId)).toHaveLength(0);
    await admin.query('delete from kaname_auth.passkey where "userId" = $1', [p.userId]);
  });
});
