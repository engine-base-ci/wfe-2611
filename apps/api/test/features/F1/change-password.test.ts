// K-312「パスワードを変える・決める口」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K312-API-…）は 11_tickets/K-312.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 組み立ては本番と同じ bootApi。漏れたパスワードの照合（関門 C1）は K-51 の sign-up.test.ts と同じ偽の fetch で答える。
//
// 試験が決める口の形（05_flow/screen_api.py の入力の型を K-312 が直す）:
//   changePassword（PATCH /api/v1/me/password・本人・60 回／分／人）体 { current_password, new_password } → 200
//     先に「今の画面のほか」を全部切ってから変える（切れずに残るより入り直しを選ぶ）。切る所で落ちたら変えない → 503・E-PAGE-003
//     切るのは、全部のワークスペースの画面と PC（Bridge）。今の画面（この要求のセッション）だけ残す（D-128.141）
//     今のパスワードが違う → 422・欄 current_password（401 にしない）。変わらない。security_events に password_change_failed
//     新しいパスワード：11 文字は 422・E-VAL-005（欄 new_password）、漏れたものは 422・E-VAL-011（K-51 と同じ照合・同じ文）
//     本人確認の取り直し：直前 15 分の取り直しか、ログインから 15 分の内なら通る（聞くこと 2 の勧め (b)）。外は 403・STEP_UP_REQUIRED
//     変えたら、その人の全部のワークスペースの security_events に password_changed
//   setMyPassword（POST /api/v1/me/password・本人・60 回／分／人・代表の答え ② answer=9177d9dbe0d9）体 { new_password } → 201
//     パスワードの無い人（パスキーだけで入る人）がパスワードを決める（部品の setPassword・サーバーだけ）。決めた後は 2 段階も付けられる
//     もうパスワードがある人 → 409・CONFLICT（変えるのは changePassword）。新しいパスワードの決まりは changePassword と同じ
//     取り直しは changePassword と同じ（ログインから 15 分の内か直前 15 分の取り直し・⑬ answer=6bdcb125e8f7）。外は 403・STEP_UP_REQUIRED
//     決めても、ほかの端末は切らない（前の秘密が無いので）。security_events に password_set
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
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
const OPS_EMAIL = "ops-k312@example.com";
const RUN = `k312-${Date.now().toString(36)}`;
const PW = "correct-horse-battery-1";
const NEW_PW = "fresh-horse-battery-22"; // 12 文字以上・漏れていない
const LEAKED_PW = "password1234"; // 偽の照合が「漏れた」と答えるもの（12 文字・K-51 と同じ）
const PASSWORD = "/api/v1/me/password";
const SECURITY = "/api/v1/me/security";
const STEP_UP = "/api/v1/auth/step-up";
const WEB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const BRIDGE_UA = "Kaname-Bridge/1.0 (K-312 test)";
const DOWN = "Kaname の調子が悪くなっています。運営が直しています。あなたの操作や PC の問題ではありません"; // E-PAGE-003
const REVOKE_FN = "app.revoke_sessions_for_auth_user_except(text, text, text)"; // K-308 の migration が足す

type Seams = BootOptions & { mail: MailLike; outboundFetch: typeof fetch };
const fakeMail: MailLike = { send: async () => ({ error: null }) };
const sha1 = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();
const fakeFetch: typeof fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const m = /^https:\/\/api\.pwnedpasswords\.com\/range\/([0-9A-F]{5})$/i.exec(url);
  if (!m) throw new Error(`K-312 の外への口は照合だけ: ${url}`);
  const leaked = sha1(LEAKED_PW);
  const lines = ["0018A45C4D1DEF81644B54AB7F969B88D65:3"];
  if (leaked.startsWith(m[1]!.toUpperCase())) lines.push(`${leaked.slice(5)}:24230577`);
  return new Response(lines.join("\r\n"), { status: 200, headers: { "content-type": "text/plain" } });
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
const nextIp = () => `198.18.12.${(ipSeq = (ipSeq % 250) + 1)}`;
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

interface Person {
  email: string;
  userId: string;
  memberId: string;
  tenantId: string;
}
const person = async (tag: string): Promise<Person> => {
  const e = email(tag);
  const r = await signUp(authFixture.auth, { email: e, password: PW, name: "鍵 を変える人", companyName: `${RUN}-社` });
  const m = (
    await admin.query<{ id: string; tenant_id: string }>("select id, tenant_id from members where auth_user_id = $1", [
      r.userId,
    ])
  ).rows[0]!;
  await admin.query("update sessions set revoked_at = now() where member_id = $1 and revoked_at is null", [m.id]);
  await agreeCurrentTerms((sql, p = []) => admin.query(sql, p).then((x) => x.rows), r.userId);
  return { email: e, userId: r.userId, memberId: m.id, tenantId: m.tenant_id };
};
/** パスワードでログイン。「付けるまで進めない」の印は下ろす（このチケットの外の止めに当てない） */
const login = async (p: Person, ua = WEB_UA, pw = PW): Promise<string> => {
  const r = await signInWithLock(authFixture.auth, fixturePool, p.email, pw, ua);
  expect(r.ok, "ログインできる").toBe(true);
  await admin.query("update sessions set mfa_pending = false where member_id = $1 and revoked_at is null", [
    p.memberId,
  ]);
  return r.token!;
};
const canLogin = async (p: Person, pw: string) =>
  (await signInWithLock(authFixture.auth, fixturePool, p.email, pw, WEB_UA)).ok === true;
const authSessionId = async (token: string) =>
  (await admin.query<{ id: string }>("select id from kaname_auth.session where token = $1", [token.split(".")[0]]))
    .rows[0]!.id;
const sessionRow = async (token: string) =>
  (
    await admin.query<{ revoked_at: Date | null; revoke_reason_id: string | null }>(
      "select revoked_at, revoke_reason_id from sessions where auth_session_id = $1",
      [await authSessionId(token)],
    )
  ).rows[0]!;
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
const change = (token: string, current: string, next: string) =>
  req("PATCH", PASSWORD, { current_password: current, new_password: next }, { headers: bearer(token) });
const eventsOf = async (tenantId: string, kind: string) =>
  (await admin.query("select 1 from security_events where tenant_id = $1 and kind_id = $2", [tenantId, kind]))
    .rowCount ?? 0;
/** 同じ人を 2 つ目のワークスペースにも入れ（tenant_memberships・D-125.150）、そこの画面のセッションを 1 つ置く */
const secondWorkspace = async (p: Person) => {
  const t2 = (
    await admin.query<{ id: string }>(
      "insert into tenants (id, tenant_id, name) select u, u, $1 from gen_random_uuid() u returning id",
      [`${RUN}-2 つ目-${randomUUID().slice(0, 8)}`],
    )
  ).rows[0]!.id;
  const sc = (
    await admin.query<{ id: string }>("insert into scopes (tenant_id, name) values ($1, '2 つ目の全体') returning id", [
      t2,
    ])
  ).rows[0]!.id;
  const m2 = (
    await admin.query<{ id: string }>(
      "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '同じ人') returning id",
      [t2, sc],
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
  return { tenantId: t2, memberId: m2, sessionId: s2 };
};

/** パスキーだけで入る人にする（パスキーを 1 本置き、パスワードの行を消す。ログインのセッションは残る） */
const passkeyOnly = async (p: Person) => {
  await admin.query(
    `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
     values ($1, 'この Mac', $2, $3, $4, 0, 'multiDevice', true, 'internal', now())`,
    [randomUUID(), `pk-${randomUUID()}`, p.userId, `cred-${randomUUID()}`],
  );
  await admin.query(`delete from kaname_auth.account where "userId" = $1 and "providerId" = 'credential'`, [p.userId]);
};
const setPassword = (token: string, next: string) =>
  req("POST", PASSWORD, { new_password: next }, { headers: bearer(token) });
const setStepUp = async (token: string, seconds: number) => {
  await admin.query("update sessions set step_up_at = now() - make_interval(secs => $2) where auth_session_id = $1", [
    await authSessionId(token),
    seconds,
  ]);
};

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
  await admin?.query(`grant execute on function ${REVOKE_FN} to kaname_app`);
  await app?.close();
  await authFixture?.pool.end();
  await fixturePool?.end();
  await admin?.end();
});

describe("K-312 パスワードを変える：今の画面は残し、ほかを切る", () => {
  it("K312-API-001 取り直しの内 × 変える：200。新しいパスワードで入れ、前のパスワードでは入れない。今の画面のセッションは残り、続けて使える", async () => {
    const p = await person("change");
    const t = await login(p);
    await stepUp(t);
    const r = await change(t, PW, NEW_PW);
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await sessionRow(t)).revoked_at).toBeNull();
    expect((await req("GET", SECURITY, undefined, { headers: bearer(t) })).status).toBe(200);
    expect(await canLogin(p, NEW_PW)).toBe(true);
    expect(await canLogin(p, PW)).toBe(false);
  });

  it("K312-API-002 同じワークスペースの別の端末のセッション：切れて（理由 password_changed）、その端末で押すと 401", async () => {
    const p = await person("other-device");
    const t = await login(p);
    const other = await login(p);
    await stepUp(t);
    expect((await change(t, PW, NEW_PW)).status).toBe(200);
    const row = await sessionRow(other);
    expect(row.revoked_at).not.toBeNull();
    expect(row.revoke_reason_id).toBe("password_changed");
    expect((await req("GET", SECURITY, undefined, { headers: bearer(other) })).status).toBe(401);
  });

  it("K312-API-003 2 つ目のワークスペースの画面のセッションと PC（Bridge）のセッションも切れる（D-125.150・D-125.140）", async () => {
    const p = await person("all-workspaces");
    const t = await login(p);
    const pc = await login(p, BRIDGE_UA);
    const ws2 = await secondWorkspace(p);
    await stepUp(t);
    expect((await change(t, PW, NEW_PW)).status).toBe(200);
    expect((await sessionRow(pc)).revoked_at).not.toBeNull();
    const s2 = await admin.query<{ revoked_at: Date | null }>("select revoked_at from sessions where id = $1", [
      ws2.sessionId,
    ]);
    expect(s2.rows[0]!.revoked_at).not.toBeNull();
    expect((await sessionRow(t)).revoked_at).toBeNull();
  });

  it("K312-API-004 変えたら、その人の全部のワークスペース（2 つ）の security_events に password_changed が残る。中身にパスワードは入らない", async () => {
    const p = await person("events");
    const t = await login(p);
    const ws2 = await secondWorkspace(p);
    await stepUp(t);
    expect((await change(t, PW, NEW_PW)).status).toBe(200);
    expect(await eventsOf(p.tenantId, "password_changed")).toBe(1);
    expect(await eventsOf(ws2.tenantId, "password_changed")).toBe(1);
    const detail = await admin.query<{ d: string }>(
      "select detail::text as d from security_events where tenant_id = any($1::uuid[]) and kind_id = 'password_changed'",
      [[p.tenantId, ws2.tenantId]],
    );
    for (const r of detail.rows) {
      expect(r.d).not.toContain(PW);
      expect(r.d).not.toContain(NEW_PW);
    }
  });

  it("K312-API-005 新しいパスワードの長さ：11 文字は 422・E-VAL-005・欄 new_password（変わらない）、12 文字は通る", async () => {
    const p = await person("length");
    const t = await login(p);
    await stepUp(t);
    const short = await change(t, PW, "abcdefghij1");
    expect(short.status).toBe(422);
    const j = await json(short);
    expect(j["code"]).toBe("E-VAL-005");
    expect(fieldsOf(j)).toContain("new_password");
    expect(await canLogin(p, PW)).toBe(true);
    expect((await change(t, PW, "abcdefghij12")).status).toBe(200);
  });

  it("K312-API-006 新しいパスワードが漏れたもの：422・E-VAL-011「漏れたことのあるパスワードです。別のパスワードにしてください」・欄 new_password。変わらない", async () => {
    const p = await person("leaked");
    const t = await login(p);
    await stepUp(t);
    const r = await change(t, PW, LEAKED_PW);
    expect(r.status).toBe(422);
    const j = await json(r);
    expect(j["code"]).toBe("E-VAL-011");
    expect(j["message"]).toBe("漏れたことのあるパスワードです。別のパスワードにしてください");
    expect(fieldsOf(j)).toContain("new_password");
    expect(await canLogin(p, PW)).toBe(true);
  });

  it("K312-API-007 今のパスワードが違う：422・欄 current_password（401 にしない＝今の画面は入ったまま）。変わらず、誰も切らない。security_events に password_change_failed", async () => {
    const p = await person("wrong-current");
    const t = await login(p);
    const other = await login(p);
    await stepUp(t);
    const r = await change(t, "wrong-horse-battery-9", NEW_PW);
    expect(r.status).toBe(422);
    expect(fieldsOf(await json(r))).toContain("current_password");
    expect(await canLogin(p, PW)).toBe(true);
    expect((await sessionRow(other)).revoked_at).toBeNull();
    expect(await eventsOf(p.tenantId, "password_change_failed")).toBe(1);
  });

  it("K312-API-008 ログインから 16 分・取り直し無し × 変える：403・STEP_UP_REQUIRED。変わらない", async () => {
    const p = await person("stale");
    const t = await login(p);
    await ageLogin(t, 16);
    const r = await change(t, PW, NEW_PW);
    expect(r.status).toBe(403);
    expect((await json(r))["code"]).toBe("STEP_UP_REQUIRED");
    expect(await canLogin(p, PW)).toBe(true);
  });

  it("K312-API-009 ログインから 15 分の内・取り直し無し × 変える：200（ログインを取り直しとみなす・聞くこと 2 の勧め (b)）", async () => {
    const p = await person("fresh-login");
    const t = await login(p);
    expect((await change(t, PW, NEW_PW)).status).toBe(200);
  });

  it("K312-API-010 「変える」を 2 回押す：1 回目で変わり、2 回目は今のパスワード（前の）が違うので 422。2 回目で何も切らない", async () => {
    const p = await person("twice");
    const t = await login(p);
    await stepUp(t);
    const rs = [await change(t, PW, NEW_PW), await change(t, PW, NEW_PW)];
    expect(rs.map((r) => r.status)).toEqual([200, 422]);
    expect((await sessionRow(t)).revoked_at).toBeNull();
    expect(await canLogin(p, NEW_PW)).toBe(true);
  });

  it("K312-API-011 ほかを切る所（DB の関数）で失敗：503・E-PAGE-003。パスワードは変わらない（先に切ってから変える）", async () => {
    const p = await person("revoke-fails");
    const t = await login(p);
    await stepUp(t);
    await admin.query(`revoke execute on function ${REVOKE_FN} from kaname_app`);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const r = await change(t, PW, NEW_PW);
      expect(r.status).toBe(503);
      const j = await json(r);
      expect(j["code"]).toBe("E-PAGE-003");
      expect(j["message"]).toBe(DOWN);
    } finally {
      spy.mockRestore();
      await admin.query(`grant execute on function ${REVOKE_FN} to kaname_app`);
    }
    expect(await canLogin(p, PW)).toBe(true);
    expect(await canLogin(p, NEW_PW)).toBe(false);
  });
});

describe("K-312 パスワードを決める（パスワードの無い人・setMyPassword）", () => {
  it("K312-API-015 パスキーだけの人 × 決める（ログインから 15 分の内）：201。そのパスワードで入れ、安全の設定は has_password true。ほかの端末は切らない。security_events に password_set", async () => {
    const p = await person("set");
    const t = await login(p);
    const other = await login(p);
    await passkeyOnly(p);
    const r = await setPassword(t, NEW_PW);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await canLogin(p, NEW_PW)).toBe(true);
    const sec = (await json(await req("GET", SECURITY, undefined, { headers: bearer(t) }))).data as Record<
      string,
      unknown
    >;
    expect(sec["has_password"]).toBe(true);
    expect((await sessionRow(other)).revoked_at).toBeNull();
    expect(await eventsOf(p.tenantId, "password_set")).toBe(1);
  });

  it("K312-API-016 もうパスワードがある人 × 決める：409・CONFLICT。パスワードは変わらない（変えるのは changePassword）", async () => {
    const p = await person("set-has");
    const t = await login(p);
    const r = await setPassword(t, NEW_PW);
    expect(r.status).toBe(409);
    expect(await canLogin(p, PW)).toBe(true);
    expect(await canLogin(p, NEW_PW)).toBe(false);
  });

  it("K312-API-017 決めるパスワードの決まり：11 文字は 422・E-VAL-005、漏れたものは 422・E-VAL-011（どちらも欄 new_password）。決まらない", async () => {
    const p = await person("set-rules");
    const t = await login(p);
    await passkeyOnly(p);
    const short = await setPassword(t, "abcdefghij1");
    expect(short.status).toBe(422);
    const a = await json(short);
    expect(a["code"]).toBe("E-VAL-005");
    expect(fieldsOf(a)).toContain("new_password");
    const leaked = await setPassword(t, LEAKED_PW);
    expect(leaked.status).toBe(422);
    const b = await json(leaked);
    expect(b["code"]).toBe("E-VAL-011");
    expect(fieldsOf(b)).toContain("new_password");
    const sec = (await json(await req("GET", SECURITY, undefined, { headers: bearer(t) }))).data as Record<
      string,
      unknown
    >;
    expect(sec["has_password"]).toBe(false);
  });

  it("K312-API-018 ログインから 16 分・取り直し無し × 決める：403・STEP_UP_REQUIRED（決まらない）。直前に取り直した（パスキーで・時刻だけ付ける）後は 201", async () => {
    const p = await person("set-stale");
    const t = await login(p);
    await passkeyOnly(p);
    await ageLogin(t, 16);
    const r = await setPassword(t, NEW_PW);
    expect(r.status).toBe(403);
    expect((await json(r))["code"]).toBe("STEP_UP_REQUIRED");
    expect(await canLogin(p, NEW_PW)).toBe(false);
    await setStepUp(t, 10);
    expect((await setPassword(t, NEW_PW)).status).toBe(201);
  });

  it("K312-API-019 ログインしていない人が決める：401。何も決まらない", async () => {
    const r = await req("POST", PASSWORD, { new_password: NEW_PW });
    expect(r.status).toBe(401);
  });
});

describe("K-312 パスワードの長さの上限（E-VAL-026・部品の上限 128 文字）", () => {
  const TOO_LONG = "a".repeat(120) + "-horse-9"; // 128 文字
  const LONGER = TOO_LONG + "x"; // 129 文字
  const MSG_TOO_LONG = "パスワードは 128 文字以内にしてください";

  it("K312-API-020 変える：新しいパスワードが 129 文字なら 422・E-VAL-026・欄 new_password。変わらず、ほかの端末も切らない。128 文字は通る", async () => {
    const p = await person("change-long");
    const t = await login(p);
    const other = await login(p);
    await stepUp(t);
    const r = await change(t, PW, LONGER);
    expect(r.status).toBe(422);
    const j = await json(r);
    expect(j["code"]).toBe("E-VAL-026");
    expect(j["message"]).toBe(MSG_TOO_LONG);
    expect(fieldsOf(j)).toContain("new_password");
    expect(await canLogin(p, PW)).toBe(true);
    expect((await sessionRow(other)).revoked_at).toBeNull();
    expect((await change(t, PW, TOO_LONG)).status).toBe(200);
  });

  it("K312-API-021 決める（パスキーだけの人）：129 文字なら 422・E-VAL-026・欄 new_password。決まらない", async () => {
    const p = await person("set-long");
    const t = await login(p);
    await passkeyOnly(p);
    const r = await setPassword(t, LONGER);
    expect(r.status).toBe(422);
    const j = await json(r);
    expect(j["code"]).toBe("E-VAL-026");
    expect(j["message"]).toBe(MSG_TOO_LONG);
    expect(fieldsOf(j)).toContain("new_password");
    const sec = (await json(await req("GET", SECURITY, undefined, { headers: bearer(t) }))).data as Record<
      string,
      unknown
    >;
    expect(sec["has_password"]).toBe(false);
  });
});

describe("K-312 守り", () => {
  it("K312-API-012 ログインしていない人が変える：401。変わらない", async () => {
    const p = await person("anon");
    const r = await req("PATCH", PASSWORD, { current_password: PW, new_password: NEW_PW });
    expect(r.status).toBe(401);
    expect(await canLogin(p, PW)).toBe(true);
  });

  it("K312-API-013 同じ人が 1 分に 61 回：61 回目は 429・retry_after_sec（60 回まで上限の内）", async () => {
    const p = await person("rate");
    const t = await login(p);
    await stepUp(t);
    for (let i = 0; i < 60; i++) {
      const r = await change(t, "wrong-horse-battery-9", NEW_PW);
      expect(r.status, `${i + 1} 回目は上限の内`).not.toBe(429);
    }
    const r = await change(t, "wrong-horse-battery-9", NEW_PW);
    expect(r.status).toBe(429);
    expect((await json(r))["retry_after_sec"]).toBe(60);
  }, 60_000); // 何十回も続けて口を呼ぶ送りすぎの確かめ（重い台でも既定の 5 秒で切らない）

  it("K312-API-014 ログ：変える間（通ったとき・今のパスワードが違うとき）に、今のパスワードも新しいパスワードも出ない", async () => {
    const out: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" "))),
    );
    try {
      const p = await person("logs");
      const t = await login(p);
      await stepUp(t);
      expect((await change(t, "wrong-horse-battery-9", NEW_PW)).status).toBe(422);
      expect((await change(t, PW, NEW_PW)).status).toBe(200);
    } finally {
      for (const sp of spies) sp.mockRestore();
    }
    const text = out.join("\n");
    for (const s of [PW, NEW_PW, "wrong-horse-battery-9"]) expect(text).not.toContain(s);
  });
});
