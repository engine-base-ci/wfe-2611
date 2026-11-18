// K-309「パスキーを足す・名前を変える・外す口」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K309-API-…）は 11_tickets/K-309.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては本番と同じ bootApi。本人とログインはログインの部品で直に作る（K-308 の my-security.test.ts と同じ）。
// パスキーを足す儀式は、部品の口（GET /api/auth/passkey/generate-register-options → POST /api/auth/passkey/verify-registration）を
// この試験の「ソフトの認証器」（P-256 の鍵・attestation は none）で通す。チャレンジの受け渡しは K-304 の入る口と同じ形：
// 始めの答えの JSON の challenge_token を、確かめの要求の頭 x-passkey-challenge に入れる（carry・Cookie は使わない・D-051.2）。
// 名前を変える・外すの試験は、部品の表（kaname_auth.passkey）に行を直に入れて作る。
//
// 本人確認の取り直し（K-19 の stepUp・POST /api/v1/auth/step-up）をパスキーでも通す（代表の答え ① answer=9177d9dbe0d9）:
//   チャレンジは K-304 の始めの口（GET /api/auth/passkey/generate-authenticate-options・ログイン中の Bearer つき）の challenge_token。
//   体 { passkey: <認証器の応答> }・頭 x-passkey-challenge → 201 { data: { step_up_at, valid_until } }。新しいセッションは作らない（今のセッションに時刻を付ける）
//   他人のパスキー・期限切れのチャレンジ・token なし → 401・STEP_UP_FAILED（時刻は付かない）。パスワードのある人の { password } はこれまでどおり
// 試験が決める口の形:
//   renamePasskey（PATCH /api/v1/me/passkeys/:id・本人だけ・60 回／分／人）体 { name } → 200 { data: { id, name } }
//     name は前後の空白を除き NFKC。1〜40 文字（D-128.141）。空・41 文字以上・制御文字は 422（欄 name）。HTML は文字のまま保存する
//   deletePasskey（DELETE /api/v1/me/passkeys/:id・本人だけ）→ 200 { data: { id } }。外しても入っている端末は切らない（D-128.141）
//     最後の入り方：パスワードも 2 段階も無い → 409・E-AUTH-015／パスワードだけで 2 段階が無い → 409・E-AUTH-016
//   本人確認の取り直し（D-125.139）：外すは「直前 15 分の取り直し」か「ログインから 15 分の内」なら通る（聞くこと 2 の勧め (b)）。外は 403・STEP_UP_REQUIRED
//   足す（部品の口）：始める口は「直前 15 分の取り直し」か「ログインから 15 分の内」なら通る（D-128.141）。外は 403・STEP_UP_REQUIRED で何も作らない
//     同じ認証器をもう一度 → 409・E-AUTH-018（行は増えない）。足したら security_events に passkey_added・その人の印 mfa_pending を下ろす
//   他の人のパスキーの id・外したパスキーの id は 404（有ることも漏らさない）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createHash,
  createHmac,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
  type KeyObject,
} from "node:crypto";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { signInWithLock, signUp } from "@kaname/auth/signup";
import { enableTotp, verifyTotp } from "@kaname/auth/two_factor";
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
const OPS_EMAIL = "ops-k309@example.com";
const RUN = `k309-${Date.now().toString(36)}`;
const PW = "correct-horse-battery-1";
const ORIGIN = "http://127.0.0.1:3123"; // 画面の origin（パスキーの部品の origin・K-304 の設定と同じ）
const OPTIONS = "/api/auth/passkey/generate-register-options";
const VERIFY = "/api/auth/passkey/verify-registration";
const SECURITY = "/api/v1/me/security";
const STEP_UP = "/api/v1/auth/step-up";
const pk = (id: string) => `/api/v1/me/passkeys/${id}`;
const WEB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const LAST_METHOD = "E-AUTH-015"; // 入り方が 1 つだけなので外せません。先にほかの入り方を付けてください
const NEED_2FA = "E-AUTH-016"; // パスワードで入るには 2 段階認証が要ります。先に 2 段階認証を付けてください
const DUP_PASSKEY = "E-AUTH-018"; // このパスキーは、もうこの端末に付いています
const MSG_LAST = "入り方が 1 つだけなので外せません。先にほかの入り方を付けてください";
const MSG_NEED_2FA = "パスワードで入るには 2 段階認証が要ります。先に 2 段階認証を付けてください";
const MSG_DUP = "このパスキーは、もうこの端末に付いています";
const MSG_STEP_UP_NG = "本人か確かめられませんでした。もう一度確かめてください"; // E-AUTH-021（取り直しで本人か確かめられなかった・パスワード・パスキー）
const MSG_WRONG_CODE = "コードが違います。認証アプリの時刻が合っているか確かめてください"; // E-AUTH-004

type Seams = BootOptions & { mail: MailLike; outboundFetch: typeof fetch };
const fakeMail: MailLike = { send: async () => ({ error: null }) };
const fakeFetch: typeof fetch = async (input) => {
  throw new Error(`K-309 は外に出ない: ${String(input)}`);
};
const config = {
  env: "test",
  databaseUrl: APP_URL,
  authDatabaseUrl: AUTH_URL,
  authSecret: "test-secret-0123456789-abcdefghijklmnop",
  baseUrl: "http://127.0.0.1:3001",
  webBaseUrl: ORIGIN,
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
const nextIp = () => `198.18.9.${(ipSeq = (ipSeq % 250) + 1)}`;
const email = (tag: string) => `${RUN}-${tag}@example.com`;
const req = (method: string, path: string, body?: unknown, o: { ip?: string; headers?: Record<string, string> } = {}) =>
  app.app.request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": o.ip ?? nextIp(),
      "user-agent": WEB_UA,
      origin: ORIGIN,
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

// ── ソフトの認証器（WebAuthn の登録・attestation none）。CBOR は使う形（整数・バイト列・文字列・map）だけを書く ──
const head = (major: number, n: number): Buffer =>
  n < 24
    ? Buffer.from([(major << 5) | n])
    : n < 256
      ? Buffer.from([(major << 5) | 24, n])
      : Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
type Cbor = number | string | Buffer | Map<Cbor, Cbor>;
const cbor = (v: Cbor): Buffer => {
  if (typeof v === "number") return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === "string") {
    const b = Buffer.from(v, "utf8");
    return Buffer.concat([head(3, b.length), b]);
  }
  if (Buffer.isBuffer(v)) return Buffer.concat([head(2, v.length), v]);
  return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
};
interface SoftKey {
  id: Buffer;
  x: Buffer;
  y: Buffer;
  privateKey: KeyObject;
}
const softKey = (): SoftKey => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  return { id: randomBytes(16), x: Buffer.from(jwk.x, "base64url"), y: Buffer.from(jwk.y, "base64url"), privateKey };
};
/** 認証器の確かめの応答（webauthn.get・K-304 の試験と同じ形）。rpId は画面の host */
const assertWith = (key: SoftKey, userId: string, challenge: string, rpId: string) => {
  const cnt = Buffer.alloc(4);
  cnt.writeUInt32BE(1);
  const authData = Buffer.concat([createHash("sha256").update(rpId).digest(), Buffer.from([0x05]), cnt]); // UP + UV
  const clientData = Buffer.from(
    JSON.stringify({ type: "webauthn.get", challenge, origin: ORIGIN, crossOrigin: false }),
  );
  const signature = sign(
    "sha256",
    Buffer.concat([authData, createHash("sha256").update(clientData).digest()]),
    key.privateKey,
  );
  const id = key.id.toString("base64url");
  return {
    id,
    rawId: id,
    type: "public-key",
    response: {
      authenticatorData: authData.toString("base64url"),
      clientDataJSON: clientData.toString("base64url"),
      signature: signature.toString("base64url"),
      userHandle: Buffer.from(userId).toString("base64url"),
    },
    clientExtensionResults: {},
    authenticatorAttachment: "platform",
  };
};
const attest = (key: SoftKey, options: { challenge: string; rp: { id: string } }) => {
  const clientData = Buffer.from(
    JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin: ORIGIN, crossOrigin: false }),
  );
  const cose = cbor(
    new Map<Cbor, Cbor>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, key.x],
      [-3, key.y],
    ]),
  );
  const len = Buffer.alloc(2);
  len.writeUInt16BE(key.id.length);
  const flags = Buffer.from([0x45]); // UP・UV・AT
  const authData = Buffer.concat([
    createHash("sha256").update(options.rp.id).digest(),
    flags,
    Buffer.alloc(4),
    Buffer.alloc(16),
    len,
    key.id,
    cose,
  ]);
  const att = cbor(
    new Map<Cbor, Cbor>([
      ["fmt", "none"],
      ["attStmt", new Map()],
      ["authData", authData],
    ]),
  );
  const id = key.id.toString("base64url");
  return {
    id,
    rawId: id,
    type: "public-key",
    response: {
      clientDataJSON: clientData.toString("base64url"),
      attestationObject: att.toString("base64url"),
      transports: ["internal"],
    },
    clientExtensionResults: {},
    authenticatorAttachment: "platform",
  };
};
/** 始めの答えの JSON の challenge_token を、確かめの要求の頭 x-passkey-challenge に戻す（K-304 の形・Cookie は使わない・D-051.2） */
const CHALLENGE_FIELD = "challenge_token";
const CHALLENGE_HEADER = "x-passkey-challenge";
const carry = (options: Record<string, unknown>): Record<string, string> => ({
  [CHALLENGE_HEADER]: String(options[CHALLENGE_FIELD]),
});
/** パスキーを足す儀式（始める → 認証器で作る → 確かめる）。始めの答えと確かめの答えを返す */
const addPasskey = async (
  token: string,
  key: SoftKey = softKey(),
  o: { beforeVerify?: (challenge: string) => Promise<void>; name?: string } = {},
) => {
  const begin = await req("GET", OPTIONS, undefined, { headers: bearer(token) });
  if (begin.status !== 200) return { begin, finish: null as Response | null, key };
  const options = (await begin.clone().json()) as { challenge: string; rp: { id: string } } & Record<string, unknown>;
  expect(typeof options[CHALLENGE_FIELD], `始めの答えの JSON に ${CHALLENGE_FIELD}`).toBe("string");
  await o.beforeVerify?.(options.challenge);
  const finish = await req(
    "POST",
    VERIFY,
    { response: attest(key, options), ...(o.name === undefined ? {} : { name: o.name }) },
    { headers: { ...bearer(token), ...carry(options) } },
  );
  return { begin, finish, key };
};

interface Person {
  email: string;
  userId: string;
  memberId: string;
  tenantId: string;
}
const person = async (tag: string): Promise<Person> => {
  const e = email(tag);
  const r = await signUp(authFixture.auth, { email: e, password: PW, name: "鍵 を足す人", companyName: `${RUN}-社` });
  const m = (
    await admin.query<{ id: string; tenant_id: string }>("select id, tenant_id from members where auth_user_id = $1", [
      r.userId,
    ])
  ).rows[0]!;
  await admin.query("update sessions set revoked_at = now() where member_id = $1 and revoked_at is null", [m.id]);
  await agreeCurrentTerms((sql, p = []) => admin.query(sql, p).then((x) => x.rows), r.userId);
  return { email: e, userId: r.userId, memberId: m.id, tenantId: m.tenant_id };
};
/** パスワードでログイン。keepPending でなければ「付けるまで進めない」の印を下ろす（このチケットの外の止めに当てない） */
const login = async (p: Person, o: { keepPending?: boolean } = {}): Promise<string> => {
  const r = await signInWithLock(authFixture.auth, fixturePool, p.email, PW, WEB_UA);
  expect(r.ok, "ログインできる").toBe(true);
  if (!o.keepPending)
    await admin.query("update sessions set mfa_pending = false where member_id = $1 and revoked_at is null", [
      p.memberId,
    ]);
  return r.token!;
};
const authSessionId = async (token: string) =>
  (await admin.query<{ id: string }>("select id from kaname_auth.session where token = $1", [token.split(".")[0]]))
    .rows[0]!.id;
/** ログインから minutes 分たったことにする（認証の側と public.sessions の両方） */
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
/** 直前の取り直しを seconds 秒前にする（null で無し） */
const setStepUp = async (token: string, seconds: number | null) => {
  const id = await authSessionId(token);
  await admin.query(
    "update sessions set step_up_at = case when $2::int is null then null else now() - make_interval(secs => $2::int) end where auth_session_id = $1",
    [id, seconds],
  );
};
const stepUp = async (token: string) => {
  const r = await req("POST", STEP_UP, { password: PW }, { headers: bearer(token) });
  expect(r.status, await r.clone().text()).toBe(201);
};
const enable2fa = async (token: string): Promise<string> => {
  const h = new Headers(bearer(token));
  const { totpURI } = await enableTotp(authFixture.auth, h, PW);
  const secret = new URL(totpURI).searchParams.get("secret")!;
  const v = await verifyTotp(authFixture.auth, h, totp(secret));
  return v.token || token;
};
const insertPasskey = async (userId: string, name: string): Promise<string> =>
  (
    await admin.query<{ id: string }>(
      `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
       values ($1, $2, $3, $4, $5, 0, 'multiDevice', true, 'internal', now()) returning id`,
      [randomUUID(), name, `pk-${randomUUID()}`, userId, `cred-${randomUUID()}`],
    )
  ).rows[0]!.id;
const passkeysOf = async (userId: string) =>
  (
    await admin.query<{ id: string; name: string }>(
      'select id, name from kaname_auth.passkey where "userId" = $1 order by "createdAt", id',
      [userId],
    )
  ).rows;
const events = async (tenantId: string, kind: string, memberId: string) =>
  (
    await admin.query("select 1 from security_events where tenant_id = $1 and kind_id = $2 and member_id = $3", [
      tenantId,
      kind,
      memberId,
    ])
  ).rowCount ?? 0;
const liveSessions = async (memberId: string) =>
  (await admin.query("select 1 from sessions where member_id = $1 and revoked_at is null", [memberId])).rowCount ?? 0;

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

describe("K-309 パスキーを足す（部品の口・本人確認の取り直し）", () => {
  it("K309-API-001 パスキー無し・ログインから 15 分の内（取り直し無し）× 足す：始めは 200、確かめると 1 本付き、安全の設定の一覧に出る（名前は端末から・40 文字以内）", async () => {
    const p = await person("add");
    const t = await login(p);
    const { begin, finish } = await addPasskey(t);
    expect(begin.status, await begin.clone().text()).toBe(200);
    expect(finish!.status, await finish!.clone().text()).toBe(200);
    const rows = await passkeysOf(p.userId);
    expect(rows).toHaveLength(1);
    const s = await req("GET", SECURITY, undefined, { headers: bearer(t) });
    const list = ((await json(s)).data as { passkeys: { id: string; name: string }[] }).passkeys;
    expect(list.map((x) => x.id)).toEqual([rows[0]!.id]);
    expect(list[0]!.name.length).toBeGreaterThan(0);
    expect(list[0]!.name.length).toBeLessThanOrEqual(40);
    expect(list[0]!.name).toMatch(/chrome/i);
  });

  it("K309-API-002 ログインから 16 分・取り直し無し × 足す：始めの口が 403・STEP_UP_REQUIRED。チャレンジも行も作らない", async () => {
    const p = await person("add-stale");
    const t = await login(p);
    await ageLogin(t, 16);
    const before = (await admin.query("select count(*)::int as n from kaname_auth.verification")).rows[0]!.n as number;
    const { begin } = await addPasskey(t);
    expect(begin.status).toBe(403);
    expect((await json(begin))["code"]).toBe("STEP_UP_REQUIRED");
    expect(await passkeysOf(p.userId)).toHaveLength(0);
    const after = (await admin.query("select count(*)::int as n from kaname_auth.verification")).rows[0]!.n as number;
    expect(after).toBeLessThanOrEqual(before);
  });

  it("K309-API-003 ログインから 16 分・直前に取り直した × 足す：通って 1 本付く", async () => {
    const p = await person("add-stepped");
    const t = await login(p);
    await ageLogin(t, 16);
    await stepUp(t);
    const { finish } = await addPasskey(t);
    expect(finish!.status, await finish!.clone().text()).toBe(200);
    expect(await passkeysOf(p.userId)).toHaveLength(1);
  });

  it(`K309-API-004 同じ認証器をもう一度足す：409・${DUP_PASSKEY}「${MSG_DUP}」。行は 1 本のまま`, async () => {
    const p = await person("add-dup");
    const t = await login(p);
    const first = await addPasskey(t);
    expect(first.finish!.status).toBe(200);
    const again = await addPasskey(t, first.key);
    expect(again.finish!.status).toBe(409);
    const j = await json(again.finish!);
    expect(j["code"]).toBe(DUP_PASSKEY);
    expect(j["message"]).toBe(MSG_DUP);
    expect(await passkeysOf(p.userId)).toHaveLength(1);
  });

  it("K309-API-005 別の認証器（2 台目の端末）で足す：2 本目が付く", async () => {
    const p = await person("add-two");
    const t = await login(p);
    expect((await addPasskey(t)).finish!.status).toBe(200);
    expect((await addPasskey(t)).finish!.status).toBe(200);
    expect(await passkeysOf(p.userId)).toHaveLength(2);
  });

  it("K309-API-006 付けるまで進めない印が立った人（端末 2 つ）が足す：両方のセッションの mfa_pending が下り、security_events に passkey_added が 1 行", async () => {
    const p = await person("add-settle");
    const a = await login(p, { keepPending: true });
    const b = await login(p, { keepPending: true });
    expect((await addPasskey(a)).finish!.status).toBe(200);
    const flags = await admin.query<{ mfa_pending: boolean }>(
      "select mfa_pending from sessions where member_id = $1 and revoked_at is null",
      [p.memberId],
    );
    expect(flags.rows.map((x) => x.mfa_pending)).toEqual([false, false]);
    expect(await events(p.tenantId, "passkey_added", p.memberId)).toBe(1);
    expect((await req("GET", SECURITY, undefined, { headers: bearer(b) })).status).toBe(200);
  });

  it("K309-API-007 チャレンジの期限が過ぎてから確かめる：部品が断る（2xx でない）。行は作らない", async () => {
    const p = await person("add-expired");
    const t = await login(p);
    const { finish } = await addPasskey(t, softKey(), {
      beforeVerify: async (challenge) => {
        await admin.query(
          "update kaname_auth.verification set \"expiresAt\" = now() - interval '1 minute' where value like '%' || $1 || '%'",
          [challenge],
        );
      },
    });
    expect(finish!.status).toBeGreaterThanOrEqual(400);
    expect(await passkeysOf(p.userId)).toHaveLength(0);
  });
});

describe("K-309 パスキーを足すときの名前（画面の欄の名前・K-318）", () => {
  it("K309-API-029 足すときに名前を送る：前後の空白を除き NFKC で保存。41 文字は 422・欄 name で行を作らない", async () => {
    const p = await person("add-name");
    const t = await login(p);
    const ok = await addPasskey(t, softKey(), { name: "  Ｍａｃ　仕事用  " });
    expect(ok.finish!.status, await ok.finish!.clone().text()).toBe(200);
    expect((await passkeysOf(p.userId)).map((x) => x.name)).toEqual(["Mac 仕事用"]);
    const long = await addPasskey(t, softKey(), { name: "あ".repeat(41) });
    expect(long.finish!.status).toBe(422);
    expect(fieldsOf(await json(long.finish!))).toContain("name");
    expect(await passkeysOf(p.userId)).toHaveLength(1);
  });
});

describe("K-309 パスキーの名前を変える（renamePasskey）", () => {
  it("K309-API-008 名前を変える：200。前後の空白を除き NFKC で保存。別の GET（getMySecurity）で読み直して同じ", async () => {
    const p = await person("rename");
    const id = await insertPasskey(p.userId, "前の名前");
    const t = await login(p);
    const r = await req("PATCH", pk(id), { name: "  ＭａｃＢｏｏｋ　仕事用  " }, { headers: bearer(t) });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(((await json(r)).data as { name: string }).name).toBe("MacBook 仕事用");
    const s = await req("GET", SECURITY, undefined, { headers: bearer(t) });
    expect(((await json(s)).data as { passkeys: { name: string }[] }).passkeys[0]!.name).toBe("MacBook 仕事用");
  });

  it("K309-API-009 名前が空・空白だけ：422・欄 name。名前は変わらない", async () => {
    const p = await person("rename-empty");
    const id = await insertPasskey(p.userId, "そのまま");
    const t = await login(p);
    for (const name of ["", "   ", "　"]) {
      const r = await req("PATCH", pk(id), { name }, { headers: bearer(t) });
      expect(r.status, JSON.stringify(name)).toBe(422);
      expect(fieldsOf(await json(r))).toContain("name");
    }
    expect((await passkeysOf(p.userId))[0]!.name).toBe("そのまま");
  });

  it("K309-API-010 名前の長さ：40 文字は通る・41 文字は 422・欄 name（D-128.141）", async () => {
    const p = await person("rename-len");
    const id = await insertPasskey(p.userId, "長さ");
    const t = await login(p);
    expect((await req("PATCH", pk(id), { name: "あ".repeat(40) }, { headers: bearer(t) })).status).toBe(200);
    const r = await req("PATCH", pk(id), { name: "あ".repeat(41) }, { headers: bearer(t) });
    expect(r.status).toBe(422);
    expect(fieldsOf(await json(r))).toContain("name");
    expect((await passkeysOf(p.userId))[0]!.name).toBe("あ".repeat(40));
  });

  it("K309-API-011 名前に制御文字（改行・タブ・NUL）は 422。HTML は文字のまま保存して返す（画面は文字として出す）", async () => {
    const p = await person("rename-ctrl");
    const id = await insertPasskey(p.userId, "元");
    const t = await login(p);
    for (const name of ["改\n行", "タ\tブ", "N\u0000UL"]) {
      const r = await req("PATCH", pk(id), { name }, { headers: bearer(t) });
      expect(r.status, JSON.stringify(name)).toBe(422);
    }
    const html = "<img src=x onerror=alert(1)>";
    const ok = await req("PATCH", pk(id), { name: html }, { headers: bearer(t) });
    expect(ok.status).toBe(200);
    expect((await passkeysOf(p.userId))[0]!.name).toBe(html);
  });

  it("K309-API-012 他の人のパスキーの id で名前を変える・外す：どちらも 404。相手の行は変わらない", async () => {
    const me = await person("other-me");
    const them = await person("other-them");
    const theirs = await insertPasskey(them.userId, "相手の鍵");
    await insertPasskey(them.userId, "相手の 2 本目");
    const t = await login(me);
    await stepUp(t);
    expect((await req("PATCH", pk(theirs), { name: "乗っ取り" }, { headers: bearer(t) })).status).toBe(404);
    expect((await req("DELETE", pk(theirs), undefined, { headers: bearer(t) })).status).toBe(404);
    expect((await passkeysOf(them.userId)).map((x) => x.name)).toEqual(["相手の鍵", "相手の 2 本目"]);
  });

  it("K309-API-013 外したパスキーの id で、古い画面から名前を変える：404", async () => {
    const p = await person("rename-gone");
    const gone = await insertPasskey(p.userId, "外す");
    await insertPasskey(p.userId, "残す");
    const t = await login(p);
    await stepUp(t);
    expect((await req("DELETE", pk(gone), undefined, { headers: bearer(t) })).status).toBe(200);
    expect((await req("PATCH", pk(gone), { name: "古い画面から" }, { headers: bearer(t) })).status).toBe(404);
  });
});

describe("K-309 パスキーを外す（deletePasskey）と最後の入り方", () => {
  it("K309-API-014 パスキー 2 本 × 1 本を外す（取り直しの内）：200。行が消え、security_events に passkey_removed。入っている端末は切らない", async () => {
    const p = await person("remove");
    const a = await insertPasskey(p.userId, "1 本目");
    await insertPasskey(p.userId, "2 本目");
    const t = await login(p);
    const other = await login(p);
    await stepUp(t);
    const r = await req("DELETE", pk(a), undefined, { headers: bearer(t) });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await passkeysOf(p.userId)).map((x) => x.name)).toEqual(["2 本目"]);
    expect(await events(p.tenantId, "passkey_removed", p.memberId)).toBe(1);
    expect(await liveSessions(p.memberId)).toBe(2);
    expect((await req("GET", SECURITY, undefined, { headers: bearer(other) })).status).toBe(200);
  });

  it("K309-API-015 最後の 1 本・パスワードあり・2 段階あり × 外す：200（パスワードと 6 けたで入れる）", async () => {
    const p = await person("remove-last-2fa");
    const t0 = await login(p);
    const t = await enable2fa(t0);
    const id = await insertPasskey(p.userId, "最後");
    await ageLogin(t, 16);
    await setStepUp(t, 10); // 2 段階の人の取り直し（パスワード＋6 けた）は K-19 の口が確かめ済み。ここは時刻だけ付ける
    const r = await req("DELETE", pk(id), undefined, { headers: bearer(t) });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await passkeysOf(p.userId)).toHaveLength(0);
  });

  it(`K309-API-016 最後の 1 本・パスワードあり・2 段階なし × 外す：409・${NEED_2FA}「${MSG_NEED_2FA}」。外れない`, async () => {
    const p = await person("remove-last-pw");
    const id = await insertPasskey(p.userId, "最後");
    const t = await login(p);
    await stepUp(t);
    const r = await req("DELETE", pk(id), undefined, { headers: bearer(t) });
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe(NEED_2FA);
    expect(j["message"]).toBe(MSG_NEED_2FA);
    expect(await passkeysOf(p.userId)).toHaveLength(1);
  });

  it(`K309-API-017 最後の 1 本・パスワードなし × 外す：409・${LAST_METHOD}「${MSG_LAST}」。外れない`, async () => {
    const p = await person("remove-last-only");
    const id = await insertPasskey(p.userId, "唯一");
    const t = await login(p);
    await stepUp(t);
    await admin.query(`delete from kaname_auth.account where "userId" = $1 and "providerId" = 'credential'`, [
      p.userId,
    ]);
    const r = await req("DELETE", pk(id), undefined, { headers: bearer(t) });
    expect(r.status).toBe(409);
    const j = await json(r);
    expect(j["code"]).toBe(LAST_METHOD);
    expect(j["message"]).toBe(MSG_LAST);
    expect(await passkeysOf(p.userId)).toHaveLength(1);
  });

  it("K309-API-018 ログインから 16 分・取り直し無し × 外す：403・STEP_UP_REQUIRED。外れない", async () => {
    const p = await person("remove-stale");
    const id = await insertPasskey(p.userId, "1 本目");
    await insertPasskey(p.userId, "2 本目");
    const t = await login(p);
    await ageLogin(t, 16);
    const r = await req("DELETE", pk(id), undefined, { headers: bearer(t) });
    expect(r.status).toBe(403);
    expect((await json(r))["code"]).toBe("STEP_UP_REQUIRED");
    expect(await passkeysOf(p.userId)).toHaveLength(2);
  });

  it("K309-API-020 ログインから 15 分の内・取り直し無し × 外す：200（ログインを取り直しとみなす・聞くこと 2 の勧め (b)）", async () => {
    const p = await person("remove-fresh-login");
    const id = await insertPasskey(p.userId, "1 本目");
    await insertPasskey(p.userId, "2 本目");
    const t = await login(p);
    const r = await req("DELETE", pk(id), undefined, { headers: bearer(t) });
    expect(r.status, await r.clone().text()).toBe(200);
  });

  it("K309-API-021 パスワードだけ（2 段階なし）の人がパスキー 2 本を 2 つのタブで同時に外す：1 本だけ外れ、後の方は 409・E-AUTH-016。0 本にならない", async () => {
    const p = await person("remove-race");
    const a = await insertPasskey(p.userId, "1 本目");
    const b = await insertPasskey(p.userId, "2 本目");
    const t = await login(p);
    await stepUp(t);
    const rs = await Promise.all([
      req("DELETE", pk(a), undefined, { headers: bearer(t) }),
      req("DELETE", pk(b), undefined, { headers: bearer(t) }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const lost = rs.find((r) => r.status === 409)!;
    expect((await json(lost))["code"]).toBe(NEED_2FA);
    expect(await passkeysOf(p.userId)).toHaveLength(1);
  });

  it("K309-API-022 2 つのタブで同時に名前を変える：どちらも 200。残るのはどちらか一方で、別の GET で読み直して DB と同じ", async () => {
    const p = await person("rename-race");
    const id = await insertPasskey(p.userId, "元");
    const t = await login(p);
    const rs = await Promise.all([
      req("PATCH", pk(id), { name: "タブ A" }, { headers: bearer(t) }),
      req("PATCH", pk(id), { name: "タブ B" }, { headers: bearer(t) }),
    ]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    const db = (await passkeysOf(p.userId))[0]!.name;
    expect(["タブ A", "タブ B"]).toContain(db);
    const s = await req("GET", SECURITY, undefined, { headers: bearer(t) });
    expect(((await json(s)).data as { passkeys: { name: string }[] }).passkeys[0]!.name).toBe(db);
  });
});

describe("K-309 守り", () => {
  it("K309-API-023 ログインしていない人が名前を変える・外す・足すを始める：401。何も変わらない", async () => {
    const p = await person("anon");
    const id = await insertPasskey(p.userId, "残る");
    expect((await req("PATCH", pk(id), { name: "x" })).status).toBe(401);
    expect((await req("DELETE", pk(id))).status).toBe(401);
    expect((await req("GET", OPTIONS)).status).toBe(401);
    expect((await passkeysOf(p.userId)).map((x) => x.name)).toEqual(["残る"]);
  });

  it("K309-API-024 同じ人が 1 分に名前を 61 回変える：61 回目は 429・retry_after_sec（60 回まで通る）", async () => {
    const p = await person("rate");
    const id = await insertPasskey(p.userId, "回数");
    const t = await login(p);
    for (let i = 0; i < 60; i++) {
      const r = await req("PATCH", pk(id), { name: `回数 ${i}` }, { headers: bearer(t) });
      expect(r.status, `${i + 1} 回目は上限の内`).toBe(200);
    }
    const r = await req("PATCH", pk(id), { name: "61 回目" }, { headers: bearer(t) });
    expect(r.status).toBe(429);
    expect((await json(r))["retry_after_sec"]).toBe(60);
  });
});

describe("K-309 本人確認の取り直しをパスキーで（stepUp・代表の答え ①）", () => {
  const AUTH_OPTIONS = "/api/auth/passkey/generate-authenticate-options";
  /** ログイン中に取り直しのチャレンジをもらう（K-304 の始めの口） */
  const challengeFor = async (token: string) => {
    const r = await req("GET", AUTH_OPTIONS, undefined, { headers: bearer(token) });
    expect(r.status, await r.clone().text()).toBe(200);
    const j = (await r.json()) as Record<string, unknown>;
    return {
      challenge: String(j["challenge"]),
      token: String(j["challenge_token"]),
      rpId: String(j["rpId"] ?? new URL(ORIGIN).hostname),
    };
  };
  const stepUpAt = async (token: string) =>
    (
      await admin.query<{ at: Date | null }>("select step_up_at as at from sessions where auth_session_id = $1", [
        await authSessionId(token),
      ])
    ).rows[0]!.at;
  /** パスキーだけで入る人：足す儀式でパスキーを 1 本付け、パスワードの行を消し、ログインから 16 分たったことにする */
  const passkeyOnly = async (tag: string) => {
    const p = await person(tag);
    const t = await login(p);
    const added = await addPasskey(t);
    expect(added.finish!.status, await added.finish!.clone().text()).toBe(200);
    await admin.query(`delete from kaname_auth.account where "userId" = $1 and "providerId" = 'credential'`, [
      p.userId,
    ]);
    await ageLogin(t, 16);
    return { p, t, key: added.key };
  };

  it("K309-API-025 パスワードの無い人 × パスキーで取り直す：201。今のセッションに step_up_at が付き、新しいセッションは作らない。続けて外すが通る", async () => {
    const { p, t, key } = await passkeyOnly("stepup-pk");
    const second = await insertPasskey(p.userId, "2 本目");
    const before = await liveSessions(p.memberId);
    const c = await challengeFor(t);
    const r = await req(
      "POST",
      STEP_UP,
      { passkey: assertWith(key, p.userId, c.challenge, c.rpId) },
      { headers: { ...bearer(t), "x-passkey-challenge": c.token } },
    );
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await stepUpAt(t)).not.toBeNull();
    expect(await liveSessions(p.memberId)).toBe(before);
    expect((await req("DELETE", pk(second), undefined, { headers: bearer(t) })).status).toBe(200);
  });

  it("K309-API-026 他人のパスキーの応答で取り直す：401・STEP_UP_FAILED・体の message は E-AUTH-021 の文（画面は欄の下に出し、ログアウトにしない）。時刻は付かない", async () => {
    const me = await passkeyOnly("stepup-me");
    const them = await passkeyOnly("stepup-them");
    const c = await challengeFor(me.t);
    const r = await req(
      "POST",
      STEP_UP,
      { passkey: assertWith(them.key, them.p.userId, c.challenge, c.rpId) },
      { headers: { ...bearer(me.t), "x-passkey-challenge": c.token } },
    );
    expect(r.status).toBe(401);
    const j = await json(r);
    expect(j["code"]).toBe("STEP_UP_FAILED");
    expect(j["message"]).toBe(MSG_STEP_UP_NG);
    expect(await stepUpAt(me.t)).toBeNull();
  });

  it("K309-API-027 期限の過ぎたチャレンジ・challenge_token を付けない：どちらも 401・STEP_UP_FAILED・体の message は E-AUTH-021 の文。時刻は付かない", async () => {
    const { p, t, key } = await passkeyOnly("stepup-old");
    const c = await challengeFor(t);
    const none = await req(
      "POST",
      STEP_UP,
      { passkey: assertWith(key, p.userId, c.challenge, c.rpId) },
      { headers: bearer(t) },
    );
    expect(none.status).toBe(401);
    const jn = await json(none);
    expect(jn["code"]).toBe("STEP_UP_FAILED");
    expect(jn["message"]).toBe(MSG_STEP_UP_NG);
    await admin.query(
      "update kaname_auth.verification set \"expiresAt\" = now() - interval '1 minute' where value like '%' || $1 || '%'",
      [c.challenge],
    );
    const old = await req(
      "POST",
      STEP_UP,
      { passkey: assertWith(key, p.userId, c.challenge, c.rpId) },
      { headers: { ...bearer(t), "x-passkey-challenge": c.token } },
    );
    expect(old.status).toBe(401);
    const jo = await json(old);
    expect(jo["code"]).toBe("STEP_UP_FAILED");
    expect(jo["message"]).toBe(MSG_STEP_UP_NG);
    expect(await stepUpAt(t)).toBeNull();
  });

  it("K309-API-028 パスワードのある人はこれまでどおり：正しいパスワードで 201（時刻が付く）、違うパスワードで 401・STEP_UP_FAILED・体の message は E-AUTH-021 の文", async () => {
    const p = await person("stepup-pw");
    const t = await login(p);
    await ageLogin(t, 16);
    const bad = await req("POST", STEP_UP, { password: "wrong-horse-battery-9" }, { headers: bearer(t) });
    expect(bad.status).toBe(401);
    const jb = await json(bad);
    expect(jb["code"]).toBe("STEP_UP_FAILED");
    expect(jb["message"]).toBe(MSG_STEP_UP_NG);
    expect(await stepUpAt(t)).toBeNull();
    await stepUp(t);
    expect(await stepUpAt(t)).not.toBeNull();
  });
  it("K309-API-030 2 段階の人が取り直しで違う 6 けた：401・STEP_UP_FAILED・体の message は E-AUTH-004 の文。時刻は付かない", async () => {
    const p = await person("stepup-code");
    const t = await enable2fa(await login(p));
    await ageLogin(t, 16);
    const r = await req("POST", STEP_UP, { password: PW, code: "000000" }, { headers: bearer(t) });
    expect(r.status).toBe(401);
    const j = await json(r);
    expect(j["code"]).toBe("STEP_UP_FAILED");
    expect(j["message"]).toBe(MSG_WRONG_CODE);
    const at = await admin.query<{ at: Date | null }>(
      "select step_up_at as at from sessions where auth_session_id = $1",
      [await authSessionId(t)],
    );
    expect(at.rows[0]!.at).toBeNull();
  });
});
