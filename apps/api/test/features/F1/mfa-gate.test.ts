// K-321「付けるまで進めない：入口の 403 と前からの試験の道具」の単体の試験（口・本物の Postgres）。
// テストの名前の頭の行 ID（K321-API-…）は 11_tickets/K-321.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては本番と同じ bootApi。本人とログインはログインの部品で直に作る（K-308 の my-security.test.ts と同じ）。
// 印（sessions.mfa_pending）を立てるのは K-308（ログインの hook）。この葉は、印の立ったセッションを入口で止める。
//
// 試験が決める形:
//   印の立ったセッションは、開いている口のほかが 403 { error: "forbidden", code: "MFA_REQUIRED", message: "入り方を 1 つ足してから使い始めます" }。何も書かない
//   開いている口（05_flow/screen_api.py の MFA_OPEN_OPS）：getMySecurity・startTwoFactor・confirmTwoFactor・stepUp・signOut・getMe・
//     getCurrentTerms・consentToTerms。認証の部品の口（/api/auth/*）は get-session とパスキーを足す 2 本（generate-register-options・verify-registration）だけ
//   開いている口に入れないもの（代表の答え ⑮ の勧め）：名前を変える・外す・パスワードを変える・決める
//   同意し直しの印（terms_pending）と両方立っていれば、同意し直し（E-AUTH-010）を先に返す。PC（Bridge）のセッションは止めない（D-128.137）
//   入口で印を読めなければ 503・E-PAGE-003（止める側に倒す）
//   止めは 3 つの入口に置く：契約の口（op.ts）・認証の部品の口（app.ts の /api/auth/*）・前の道すじ（ext.ts の /api/auth-ext/*）。
//     前の道すじで止めない道は同意し直し（K-53）の TERMS_OPEN_EXT と同じ（/me・/sign-in・/two-factor/verify・/invitations/*）。PC の印（x-bridge-session）は止めない
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
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
// K-358：書き直した行の作り物の秘密の値は _fake/secrets.ts に置いて import する（K-328）
import { K358_K321_PASSWORD } from "../../_fake/secrets.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PKG = join(HERE, "..", "..", "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const OPS_EMAIL = "ops-k321@example.com";
const RUN = `k321-${Date.now().toString(36)}`; // この回が作るものの印（G-10）
const PW = "correct-horse-battery-1";
const SECURITY = "/api/v1/me/security";
const OTHER_API = "/api/v1/conversations"; // 止まるべき、ふつうの口（素の一覧・K-53 の試験と同じ）
const MFA_CODE = "MFA_REQUIRED";
const MSG_MFA = "入り方を 1 つ足してから使い始めます"; // E-AUTH-019（番号は仮・文で引く・代表の答え ⑮ answer=6bdcb125e8f7）
const MFA_FN = "app.session_mfa_pending(uuid)"; // K-308 の migration が足す
const WEB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const BRIDGE_UA = "Kaname-Bridge/1.0 (K-321 test)";

type Seams = BootOptions & { mail: MailLike; outboundFetch: typeof fetch };
const fakeMail: MailLike = { send: async () => ({ error: null }) };
const fakeFetch: typeof fetch = async (input) => {
  throw new Error(`K-321 は外に出ない: ${String(input)}`);
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
const nextIp = () => `198.18.21.${(ipSeq = (ipSeq % 250) + 1)}`;
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

interface Person {
  email: string;
  userId: string;
  memberId: string;
  tenantId: string;
}
/** 本人を作る（会社ごと）。今の版の規約に同意済みにし、登録のときのセッションは閉じる（ここからはログインでできたセッションだけを見る） */
const person = async (tag: string): Promise<Person> => {
  const e = email(tag);
  const r = await signUp(authFixture.auth, { email: e, password: PW, name: "付ける前の人", companyName: `${RUN}-社` });
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
const expectMfaBlocked = async (r: Response, what: string) => {
  expect(r.status, `${what}: ${await r.clone().text()}`).toBe(403);
  const j = await json(r);
  expect(j["code"], what).toBe(MFA_CODE);
  expect(j["message"], what).toBe(MSG_MFA);
};
const expectNotMfaBlocked = async (r: Response, what: string) => {
  const code = r.status === 403 ? ((await r.clone().json()) as Record<string, unknown>)["code"] : null;
  expect(code, `${what} は付けるまで進めないで止めない`).not.toBe(MFA_CODE);
};
const insertPasskey = async (userId: string): Promise<string> =>
  (
    await admin.query<{ id: string }>(
      `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
       values ($1, 'この Mac', $2, $3, $4, 0, 'multiDevice', true, 'internal', now()) returning id`,
      [randomUUID(), `pk-${randomUUID()}`, userId, `cred-${randomUUID()}`],
    )
  ).rows[0]!.id;
const conversationsOf = async (tenantId: string) =>
  (await admin.query("select 1 from conversations where tenant_id = $1", [tenantId])).rowCount ?? 0;

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
  await admin?.query(`grant execute on function ${MFA_FN} to kaname_app`);
  await admin?.query(
    `delete from kaname_auth.passkey where "userId" in (select id from kaname_auth."user" where email like $1)`,
    [`${RUN}-%`],
  );
  await app?.close();
  await authFixture?.pool.end();
  await fixturePool?.end();
  await admin?.end();
});

describe("K-321 付けるまで進めない：入口の止め", () => {
  it(`K321-API-001 印が立ったセッション × ふつうの口（一覧）：403・${MFA_CODE}「${MSG_MFA}」`, async () => {
    const p = await person("read");
    const t = await login(p);
    expect((await sessionOf(t)).mfa_pending, "K-308 が印を立てている").toBe(true);
    await expectMfaBlocked(await req("GET", OTHER_API, undefined, { headers: bearer(t) }), OTHER_API);
  });

  it("K321-API-002 印が立ったセッション × 書く口：403・MFA_REQUIRED。行を作らない", async () => {
    const p = await person("write");
    const t = await login(p);
    const before = await conversationsOf(p.tenantId);
    await expectMfaBlocked(
      await req("POST", OTHER_API, { title: "止まるはず" }, { headers: bearer(t) }),
      "POST " + OTHER_API,
    );
    expect(await conversationsOf(p.tenantId)).toBe(before);
  });

  it("K321-API-003 開いている契約の口（安全の設定を読む・規約・取り直し・2 段階を始める・自分の取得）は止めない", async () => {
    const p = await person("open");
    const t = await login(p);
    expect((await req("GET", SECURITY, undefined, { headers: bearer(t) })).status).toBe(200);
    expect((await req("GET", "/api/v1/auth/terms/current", undefined, { headers: bearer(t) })).status).toBe(200);
    expect((await req("POST", "/api/v1/auth/step-up", { password: PW }, { headers: bearer(t) })).status).toBe(201);
    expect((await req("POST", "/api/v1/me/two-factor/enable", { password: PW }, { headers: bearer(t) })).status).toBe(
      201,
    );
    await expectNotMfaBlocked(await req("GET", "/api/v1/me", undefined, { headers: bearer(t) }), "getMe");
  });

  it("K321-API-004 安全の設定のうち開かない 4 つ（名前を変える・外す・パスワードを変える・決める）：403・MFA_REQUIRED。何も変わらない", async () => {
    const p = await person("closed-four");
    const t = await login(p);
    await admin.query("update sessions set step_up_at = now() where member_id = $1 and revoked_at is null", [
      p.memberId,
    ]);
    const id = randomUUID();
    for (const [method, path, body] of [
      ["PATCH", `/api/v1/me/passkeys/${id}`, { name: "x" }],
      ["DELETE", `/api/v1/me/passkeys/${id}`, undefined],
      ["PATCH", "/api/v1/me/password", { current_password: PW, new_password: "fresh-horse-battery-22" }],
      ["POST", "/api/v1/me/password", { new_password: "fresh-horse-battery-22" }],
    ] as const)
      await expectMfaBlocked(await req(method, path, body, { headers: bearer(t) }), `${method} ${path}`);
    const ok = await signInWithLock(authFixture.auth, fixturePool, p.email, PW, WEB_UA);
    expect(ok.ok, "パスワードは変わっていない").toBe(true);
  });

  it("K321-API-005 認証の部品の口（/api/auth/*）：ほかのセッションの取り消しは 403・MFA_REQUIRED。セッションを読む・パスキーを足すの始めは止めない", async () => {
    const p = await person("parts");
    const t = await login(p);
    await expectMfaBlocked(
      await req("POST", "/api/auth/revoke-other-sessions", {}, { headers: bearer(t) }),
      "revoke-other-sessions",
    );
    expect((await req("GET", "/api/auth/get-session", undefined, { headers: bearer(t) })).status).toBe(200);
    await expectNotMfaBlocked(
      await req("GET", "/api/auth/passkey/generate-register-options", undefined, { headers: bearer(t) }),
      "generate-register-options",
    );
  });

  it("K321-API-006 PC（Bridge）のセッション：止めない（D-128.137）", async () => {
    const p = await person("bridge");
    const t = await login(p, BRIDGE_UA);
    await expectNotMfaBlocked(await req("GET", OTHER_API, undefined, { headers: bearer(t) }), "Bridge の一覧");
  });

  it("K321-API-007 同意し直しの印と両方立っている：同意し直し（403・E-AUTH-010）を先に返す", async () => {
    const p = await person("both");
    const t = await login(p);
    await admin.query("update sessions set terms_pending = true where id = $1", [(await sessionOf(t)).id]);
    const r = await req("GET", OTHER_API, undefined, { headers: bearer(t) });
    expect(r.status).toBe(403);
    expect((await json(r))["code"]).toBe("E-AUTH-010");
  });

  it("K321-API-008 入り方を足して印が下りた直後：同じセッションで、ふつうの口が通る（200）", async () => {
    const p = await person("settled");
    const t = await login(p);
    await expectMfaBlocked(await req("GET", OTHER_API, undefined, { headers: bearer(t) }), "下ろす前");
    await insertPasskey(p.userId);
    await admin.query("select app.settle_mfa_pending($1)", [p.userId]);
    expect((await req("GET", OTHER_API, undefined, { headers: bearer(t) })).status).toBe(200);
  });

  it("K321-API-010 印が立ったセッション × PC をつなぐ口（契約の createPairingCode）：403・MFA_REQUIRED。接続コードを作らない（PC をつないで止めを抜けさせない）", async () => {
    const p = await person("pair");
    const t = await login(p);
    const codes = async () =>
      (await admin.query("select 1 from bridge_pairing_codes where member_id = $1", [p.memberId])).rowCount ?? 0;
    const before = await codes();
    await expectMfaBlocked(
      await req("POST", "/api/v1/bridge/pairing-codes", {}, { headers: bearer(t) }),
      "POST /bridge/pairing-codes",
    );
    expect(await codes()).toBe(before);
  });

  it("K321-API-011 印が立ったセッション × 前の道すじ（/api/auth-ext/*）の PC の様子を読む・契約の口の資格情報を預けるは 403・MFA_REQUIRED（預けない）。自分の取得（/me）は止めない", async () => {
    const p = await person("ext");
    const t = await login(p);
    await expectMfaBlocked(
      await req("GET", "/api/auth-ext/bridge/state", undefined, { headers: bearer(t) }),
      "GET /bridge/state",
    );
    const vault = async () =>
      (await admin.query("select 1 from credentials where owner_member_id = $1", [p.memberId])).rowCount ?? 0;
    const vaultBefore = await vault();
    await expectMfaBlocked(
      // K-358：預ける前の道すじ（/api/auth-ext/vault/credentials）を消したので、契約の口 createCredential で止まることを見る（MFA_OPEN_OPS に無い）
      await req(
        "POST",
        "/api/v1/credentials",
        {
          name: "K321_SECRET",
          layer: "personal",
          kind: "login",
          login: "k321",
          password: K358_K321_PASSWORD,
          two_factor: "none",
          destinations: ["k321.example.com"],
        },
        { headers: bearer(t) },
      ),
      "POST /api/v1/credentials",
    );
    expect(await vault(), "預けない").toBe(vaultBefore);
    await expectNotMfaBlocked(
      await req("GET", "/api/auth-ext/me", undefined, { headers: bearer(t) }),
      "GET /api/auth-ext/me",
    );
  });

  it("K321-API-009 入口で印を読めない（印を読む関数を一時的に呼べなくする）：503・E-PAGE-003。止める側に倒す", async () => {
    const p = await person("unreadable");
    const t = await login(p);
    await admin.query(`revoke execute on function ${MFA_FN} from kaname_app`);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await req("GET", OTHER_API, undefined, { headers: bearer(t) });
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      spy.mockRestore();
      await admin.query(`grant execute on function ${MFA_FN} to kaname_app`);
    }
  });
});
