// K-304「パスキーで入る」の単体の試験（部品の口 /api/auth/passkey/*・本物の DB）。
// テストの名前の頭の行 ID（K304-API-…・K304-DOC-…）は 11_tickets/K-304.md の表のマスに 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。実装の前に流して赤を確かめない（D-128.143）。
//
// 土台は K-301 の login.harness.ts（本番と同じ bootApi・確定した本人 makeUser）。登録のときにできたセッションは土台の準備が閉じる
//   （段 2 の精査の後の決め 7）。それでも数の確かめは「前と後の差」で比べる。土台の makeUser は本人に「試験の鍵」（使えない仮のパスキー・K-321）を
//   1 つ置くので、この試験は自分の置いた鍵だけを名前で見る。
//
// パスキーの認証器は持たないので、この試験の中で仮の認証器を作る（@simplewebauthn が確かめる形の応答）:
//   ・鍵：node:crypto の P-256（ES256）。公開鍵は COSE（CBOR）にして、部品の表 kaname_auth.passkey に直に置く
//     （部品 1.7.15 の verify-registration が書く形：publicKey は COSE の鍵の base64・credentialID は base64url・counter は数）。付ける口は K-309
//   ・応答：authenticatorData（rpID の sha256・フラグ UP+UV・署名の回数）・clientDataJSON（webauthn.get・challenge・origin）・
//     署名（authenticatorData ‖ sha256(clientDataJSON) を秘密鍵で ES256・DER）
//
// 試験が決める形（K-304 が決める本体・精査の後の決め 5。K-309・K-317・K-318 が同じ形で使う）:
//   rpID は WEB_BASE_URL の host、origin は WEB_BASE_URL の origin（画面の origin）。trustedOrigins に画面の origin を入れる
//   チャレンジを作る口は GET（部品 1.7.15 の形）。Cookie で受け渡さない（画面は別の origin・Bearer だけ・D-051.2）:
//     GET /api/auth/passkey/generate-authenticate-options の答えの JSON に challenge_token（部品が Set-Cookie に入れる署名つきの値そのまま）を足す
//     POST /api/auth/passkey/verify-authentication は頭 x-passkey-challenge でそれを受け、部品のチャレンジの Cookie に入れて渡す
//     CORS の allowHeaders に x-passkey-challenge を足す（画面から別の origin で送れるように）
//   入れたら、セッションの印は答えの頭 set-auth-token（bearer の部品）。セッションは public.sessions に写る（今の hook のまま）
//   止められた人・会社がパスキーの道でも断られる行は K-308 に移した（待ちを減らす案 3・K-303 と同時に走らせる）
//   部品の口のうち、Kaname の決まり（最後の入り方・本人確認の取り直し）を通らない道（delete-passkey・update-passkey・list-user-passkeys）は 404
import { describe, expect, it } from "vitest";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createAuth } from "@kaname/auth";
import { emailHash } from "@kaname/auth/signup";
import { createApp } from "../../../src/app.js";
import { mails, setupLogin, type User } from "./login.harness.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const WEB = "http://127.0.0.1:3123"; // 土台（login.harness.ts）の config.webBaseUrl。画面の origin
const RP_ID = new URL(WEB).hostname;
const UA_A =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36";
const UA_B = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/140 Safari/537.36";
const OPTIONS = "/api/auth/passkey/generate-authenticate-options";
const VERIFY = "/api/auth/passkey/verify-authentication";
const CHALLENGE_FIELD = "challenge_token";
const CHALLENGE_HEADER = "x-passkey-challenge";

const h = setupLogin("k304");
const KEY_NAME = `${h.run}-鍵`;

const b64u = (b: Buffer) => b.toString("base64url");
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest();
const call = (method: "GET" | "POST", path: string, body: unknown, headers: Record<string, string> = {}) =>
  h.req(method, path, method === "GET" ? undefined : body, {
    headers: { "user-agent": UA_A, origin: WEB, ...headers },
  });

// ---- 仮の認証器（P-256・ES256） ----
interface Authenticator {
  credentialId: Buffer;
  privateKey: KeyObject;
  cose: Buffer;
}
const cborBytes = (b: Buffer) => Buffer.concat([Buffer.from([0x58, b.length]), b]);
const makeAuthenticator = (): Authenticator => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  // COSE_Key { 1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y }
  const cose = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21]),
    cborBytes(Buffer.from(jwk.x, "base64url")),
    Buffer.from([0x22]),
    cborBytes(Buffer.from(jwk.y, "base64url")),
  ]);
  return { credentialId: randomBytes(32), privateKey, cose };
};
/** 付いているパスキーを部品の表に置く（付ける口は K-309）。置いた行の id を返す */
const storePasskey = async (userId: string, a: Authenticator, counter = 0) => {
  const id = randomUUID();
  await h.admin.query(
    `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
     values ($1, $2, $3, $4, $5, $6, 'singleDevice', false, 'internal', now())`,
    [id, KEY_NAME, a.cose.toString("base64"), userId, b64u(a.credentialId), counter],
  );
  return id;
};
interface Assert {
  rpId?: string;
  origin?: string;
  counter?: number;
  key?: KeyObject;
  challenge: string;
}
/** 認証器の応答（AuthenticationResponseJSON） */
const assertion = (a: Authenticator, userId: string, o: Assert) => {
  const cnt = Buffer.alloc(4);
  cnt.writeUInt32BE(o.counter ?? 1);
  const authData = Buffer.concat([sha256(o.rpId ?? RP_ID), Buffer.from([0x05]), cnt]); // UP + UV
  const clientData = Buffer.from(
    JSON.stringify({ type: "webauthn.get", challenge: o.challenge, origin: o.origin ?? WEB, crossOrigin: false }),
  );
  const signature = sign("sha256", Buffer.concat([authData, sha256(clientData)]), o.key ?? a.privateKey);
  return {
    id: b64u(a.credentialId),
    rawId: b64u(a.credentialId),
    type: "public-key",
    response: {
      authenticatorData: b64u(authData),
      clientDataJSON: b64u(clientData),
      signature: b64u(signature),
      userHandle: b64u(Buffer.from(userId)),
    },
    clientExtensionResults: {},
    authenticatorAttachment: "platform",
  };
};
/** 入る前の 1 歩：チャレンジをもらう（GET） */
const options = async (ua = UA_A) => {
  const r = await call("GET", OPTIONS, undefined, { "user-agent": ua });
  expect(r.status, await r.clone().text()).toBe(200);
  const j = (await h.json(r)) as Record<string, unknown>;
  expect(typeof j["challenge"], "チャレンジがある").toBe("string");
  expect(typeof j[CHALLENGE_FIELD], `答えの JSON に ${CHALLENGE_FIELD}`).toBe("string");
  return { challenge: String(j["challenge"]), token: String(j[CHALLENGE_FIELD]), raw: j };
};
/** 応答を送る */
const verify = (body: unknown, token: string | null, ua = UA_A) =>
  call(
    "POST",
    VERIFY,
    { response: body },
    { "user-agent": ua, ...(token === null ? {} : { [CHALLENGE_HEADER]: token }) },
  );
/** 通しで入る（チャレンジ → 応答 → 送る） */
const passkeyLogin = async (u: User, a: Authenticator, extra: Partial<Assert> = {}, ua = UA_A) => {
  const o = await options(ua);
  return verify(assertion(a, u.userId, { challenge: o.challenge, ...extra }), o.token, ua);
};
const tokenOf = (r: Response) => r.headers.get("set-auth-token");
const counts = async (u: User) => ({ auth: await h.authSessions(u.userId), app: await h.liveSessions(u.memberId) });
/** 入れなかった：4xx で、セッションの印も無く、セッションが増えない */
const expectNoEntry = async (r: Response, u: User, before: { auth: number; app: number }) => {
  const text = await r.clone().text();
  expect(r.status, text).toBeGreaterThanOrEqual(400);
  expect(r.status, text).toBeLessThan(500);
  expect(tokenOf(r), "セッションの印を返さない").toBeNull();
  expect(await counts(u)).toEqual(before);
  return text;
};
/** 本人と、その人の仮の鍵 */
const userWithKey = async (tag: string, counter = 0) => {
  const u = await h.makeUser(tag);
  const a = makeAuthenticator();
  const keyId = await storePasskey(u.userId, a, counter);
  return { u, a, keyId, before: await counts(u) };
};

describe("K-304 パスキーで入る：ふつうの道", () => {
  it("K304-API-001 チャレンジをもらう（GET・ログインしていない）：200。rpId は画面の host、チャレンジと challenge_token が JSON にあり、誰のパスキーかを聞かない（allowCredentials は空）", async () => {
    const o = await options();
    expect(o.raw["rpId"]).toBe(RP_ID);
    expect((o.raw["allowCredentials"] as unknown[] | undefined) ?? []).toEqual([]);
  });

  it("K304-API-002 パスキーがこの PC にある × 入る：200 とセッションの印。認証側と業務側の画面のセッションが 1 つずつ増える", async () => {
    const { u, a, before } = await userWithKey("ok");
    const r = await passkeyLogin(u, a);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(tokenOf(r)).toBeTruthy();
    expect(await counts(u)).toEqual({ auth: before.auth + 1, app: before.app + 1 });
  });

  // 契約の口は、作り終えている listSetupTasks（K-250）で見る。getMe は K-70 まで 501（作っていない口）なので使わない
  it("K304-API-003 入った印で契約の口を呼べる（Bearer）：本物の解き方で解け、GET /api/v1/me/setup-tasks が 200。印なしは 401", async () => {
    const { u, a } = await userWithKey("bearer");
    const t = tokenOf(await passkeyLogin(u, a))!;
    expect(await h.resolves(t, UA_A)).toBe(true);
    const list = await h.req("GET", "/api/v1/me/setup-tasks", undefined, {
      headers: { authorization: `Bearer ${t}`, "user-agent": UA_A },
    });
    expect(list.status, await list.clone().text()).toBe(200);
    const none = await h.req("GET", "/api/v1/me/setup-tasks", undefined, { headers: { "user-agent": UA_A } });
    expect(none.status).toBe(401);
  });

  it("K304-API-004 2 段階認証を付けた人 × パスキーで入る：6 けたを聞かずにセッションができる（D-128.60・パスキーそれ自体が 2 段階）", async () => {
    const u = await h.makeUser("2fa", { twoFactor: true });
    const a = makeAuthenticator();
    await storePasskey(u.userId, a);
    const r = await passkeyLogin(u, a);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(((await h.json(r.clone())) as Record<string, unknown>)["twoFactorRedirect"]).toBeFalsy();
    expect(tokenOf(r)).toBeTruthy();
  });

  it("K304-API-005 パスワードのロック中（login_attempts.locked_until が未来）× パスキーで入る：入れる（パスキーはパスワードのロックの外）", async () => {
    const { u, a } = await userWithKey("locked");
    await h.admin.query(
      "insert into app.login_attempts (email_hash, fails, first_failed_at, locked_until) values ($1, 5, now(), now() + interval '15 minutes') on conflict (email_hash) do update set locked_until = now() + interval '15 minutes'",
      [emailHash(u.email)],
    );
    expect((await passkeyLogin(u, a)).status).toBe(200);
  });

  it("K304-API-006 別の端末（スマホで入った・新しいブラウザ）で初めて入る：画面の知らせ（security.new_device）が 1 つとメールが 1 通。同じ端末で 2 回目は知らせない", async () => {
    const { u, a } = await userWithKey("newdev");
    const count = async () =>
      Number(
        (
          await h.admin.query<{ n: string }>(
            "select count(*) as n from notifications where member_id = $1 and event_kind_id = 'security.new_device'",
            [u.memberId],
          )
        ).rows[0]!.n,
      );
    const before = await count();
    const sent = mails.filter((m) => m.to === u.email).length;
    expect((await passkeyLogin(u, a, { counter: 1 }, UA_B)).status).toBe(200);
    expect(await count()).toBe(before + 1);
    expect(mails.filter((m) => m.to === u.email)).toHaveLength(sent + 1);
    expect((await passkeyLogin(u, a, { counter: 2 }, UA_B)).status).toBe(200);
    expect(await count()).toBe(before + 1);
  });

  it("K304-API-007 規約の新しい版が出ている（本人はまだ同意していない）× パスキーで入る：そのセッションに同意し直しの印が立つ（パスワードと同じ hook・K-53）", async () => {
    const { u, a } = await userWithKey("terms");
    // 新しい版を出す（K301-API-026 と同じ作り方。DB にある版の数に頼らない・ほかの試験が版を消していても同じに動く）
    const ops = (await h.admin.query<{ id: string }>("select app.ops_tenant_id() as id")).rows[0]!.id;
    const v = `${h.run}-terms`;
    await h.admin.query(
      "insert into terms_versions (tenant_id, kind, version, url, published_at) values ($1, 'terms', $2, $3, now())",
      [ops, v, `https://kaname.example/terms/${v}`],
    );
    try {
      const r = await passkeyLogin(u, a);
      expect(r.status).toBe(200);
      // set-auth-token は署名つきの値（kaname_auth.session.token そのものではない）。K301-API-026 と同じく、その人の生きた画面のセッションを引く
      //   （準備のセッションは土台が閉じているので、生きた画面のセッションはこのログインの 1 つだけ）
      const s = await h.admin.query<{ terms_pending: boolean }>(
        "select terms_pending from sessions where member_id = $1 and revoked_at is null and kind_id = 'web'",
        [u.memberId],
      );
      expect(s.rows.map((x) => x.terms_pending)).toEqual([true]);
    } finally {
      await h.admin.query("delete from terms_versions where version = $1", [v]);
    }
  });
});

describe("K-304 パスキーで入る：通さない応答", () => {
  it("K304-API-011 パスキーが無い（どこにも置いていない鍵の応答）：4xx でセッションは増えない。答えにメール・人の id を出さない", async () => {
    const u = await h.makeUser("nokey");
    const before = await counts(u);
    const text = await expectNoEntry(await passkeyLogin(u, makeAuthenticator()), u, before);
    for (const s of [u.email, u.userId]) expect(text).not.toContain(s);
  });

  it("K304-API-012 別の鍵で署名した応答（盗んだ credential id だけを使う）：4xx でセッションは増えない", async () => {
    const { u, a, before } = await userWithKey("badsig");
    await expectNoEntry(await passkeyLogin(u, a, { key: makeAuthenticator().privateKey }), u, before);
  });

  it("K304-API-013 署名の回数が戻っている・同じ（保存 10 に応答 5・応答 10・写されたパスキーの疑い）：どちらも 4xx で入れず、security_events に passkey_counter_rollback が 1 行ずつ", async () => {
    const { u, a, before } = await userWithKey("rollback", 10);
    await expectNoEntry(await passkeyLogin(u, a, { counter: 5 }), u, before);
    await expectNoEntry(await passkeyLogin(u, a, { counter: 10 }), u, before);
    const ev = await h.admin.query(
      "select detail from security_events where tenant_id = $1 and kind_id = 'passkey_counter_rollback'",
      [u.tenantId],
    );
    expect(ev.rowCount).toBe(2);
    expect(JSON.stringify(ev.rows)).not.toContain(b64u(a.credentialId));
  });

  it("K304-API-014 別のサイトの origin で作った応答（clientDataJSON の origin）：4xx でセッションは増えない", async () => {
    const { u, a, before } = await userWithKey("origin");
    await expectNoEntry(await passkeyLogin(u, a, { origin: "https://evil.example" }), u, before);
  });

  it("K304-API-015 別の rpID（別のサイトの鍵）で作った応答：4xx でセッションは増えない", async () => {
    const { u, a, before } = await userWithKey("rpid");
    await expectNoEntry(await passkeyLogin(u, a, { rpId: "evil.example" }), u, before);
  });

  it("K304-API-016 同じ応答を 2 回送る（使い回し）：1 回目だけ入れる。チャレンジは 1 回で使い終わる", async () => {
    const { u, a, before } = await userWithKey("replay");
    const o = await options();
    const body = assertion(a, u.userId, { challenge: o.challenge });
    expect((await verify(body, o.token)).status).toBe(200);
    const second = await verify(body, o.token);
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(await h.authSessions(u.userId)).toBe(before.auth + 1);
  });

  it("K304-API-017 challenge_token を付けない・別のチャレンジの token を付ける：4xx でセッションは増えない", async () => {
    const { u, a, before } = await userWithKey("notoken");
    const o = await options();
    await expectNoEntry(await verify(assertion(a, u.userId, { challenge: o.challenge }), null), u, before);
    const other = await options();
    await expectNoEntry(await verify(assertion(a, u.userId, { challenge: o.challenge }), other.token), u, before);
  });

  it("K304-API-018 チャレンジの期限が切れた（部品の verification の expiresAt を過去へ）：4xx でセッションは増えない", async () => {
    const { u, a, before } = await userWithKey("expired");
    const o = await options();
    await h.admin.query(
      `update kaname_auth.verification set "expiresAt" = now() - interval '1 second' where value like '%' || $1 || '%'`,
      [o.challenge],
    );
    await expectNoEntry(await verify(assertion(a, u.userId, { challenge: o.challenge }), o.token), u, before);
  });
});

describe("K-304 閉じた道・設定・正本・関門", () => {
  it("K304-API-019 部品の口のうち Kaname の決まりを通らない道（delete-passkey・update-passkey・list-user-passkeys）：本人の本物のパスキーの id でも 404。行は残り、名前も変わらない", async () => {
    const { u, a, keyId } = await userWithKey("closed");
    const t = tokenOf(await passkeyLogin(u, a))!;
    const auth = { authorization: `Bearer ${t}` };
    expect((await call("POST", "/api/auth/passkey/delete-passkey", { id: keyId }, auth)).status).toBe(404);
    expect(
      (await call("POST", "/api/auth/passkey/update-passkey", { id: keyId, name: "変えた名前" }, auth)).status,
    ).toBe(404);
    expect((await call("GET", "/api/auth/passkey/list-user-passkeys", undefined, auth)).status).toBe(404);
    const left = await h.admin.query<{ name: string }>("select name from kaname_auth.passkey where id = $1", [keyId]);
    expect(left.rows.map((x) => x.name)).toEqual([KEY_NAME]);
  });

  it("K304-API-020 ログ：credential id・チャレンジ・challenge_token・セッションの印・メールが出ない", async () => {
    const { u, a } = await userWithKey("log");
    const seen: string[] = [];
    const log = await h.captureLogs(async () => {
      const o = await options();
      const t = tokenOf(await verify(assertion(a, u.userId, { challenge: o.challenge }), o.token));
      seen.push(o.challenge, o.token, t ?? "-none-");
    });
    for (const s of [b64u(a.credentialId), ...seen, u.email]) expect(log).not.toContain(s);
  });

  it("K304-API-021 部品の表：migrateAuth が kaname_auth.passkey を作る（publicKey・userId・credentialID・counter・deviceType・backedUp・transports・createdAt・aaguid・name）", async () => {
    const cols = (
      await h.admin.query<{ c: string }>(
        "select column_name as c from information_schema.columns where table_schema = 'kaname_auth' and table_name = 'passkey'",
      )
    ).rows.map((x) => x.c);
    expect(cols).toEqual(
      expect.arrayContaining([
        "publicKey",
        "userId",
        "credentialID",
        "counter",
        "deviceType",
        "backedUp",
        "transports",
        "createdAt",
        "aaguid",
        "name",
      ]),
    );
  });

  it("K304-API-022 部品の版：packages/auth の依存に @better-auth/passkey を better-auth と同じ版（1.7.15・幅なし）で足す", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "packages", "auth", "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@better-auth/passkey"]).toBe("1.7.15");
  });

  it("K304-API-023 origin の確かめ：createAuth に画面の URL を渡すと、trustedOrigins に画面の origin が入る（Cookie つきの verify を本番で断らない）。origin の確かめを切らない", async () => {
    const appPool = new pg.Pool({ connectionString: process.env["DATABASE_URL"]!, max: 1 });
    const made = createAuth({
      authDatabaseUrl: process.env["DATABASE_URL"]!,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://127.0.0.1:3001",
      webBaseURL: "https://app.kaname.example",
    });
    try {
      const o = made.auth.options as { trustedOrigins?: unknown; advanced?: { disableOriginCheck?: boolean } };
      expect(Array.isArray(o.trustedOrigins) ? o.trustedOrigins : []).toContain("https://app.kaname.example");
      expect(o.advanced?.disableOriginCheck).not.toBe(true);
    } finally {
      await made.pool.end();
      await appPool.end();
    }
  });

  it("K304-API-024 CORS：画面の origin からの頭の事前の確かめ（OPTIONS）で、x-passkey-challenge が許される頭に入る", async () => {
    const app = createApp({ version: "test", corsOrigin: WEB });
    const r = await app.request(`http://localhost${VERIFY}`, {
      method: "OPTIONS",
      headers: {
        origin: WEB,
        "access-control-request-method": "POST",
        "access-control-request-headers": `content-type,${CHALLENGE_HEADER}`,
      },
    });
    expect(r.status).toBeLessThan(300);
    expect((r.headers.get("access-control-allow-headers") ?? "").toLowerCase()).toContain(CHALLENGE_HEADER);
    expect(r.headers.get("access-control-allow-origin")).toBe(WEB);
  });

  it("K304-DOC-001 キャンバスの AuthQR：Kaname が QR を描かない（ブラウザが QR を出す・answer=fe708d209427 の 2）。QR の絵（viewBox 0 0 21 21）が無く、「ブラウザ」の説明がある", () => {
    const html = readFileSync(join(ROOT, "04_design", "canvas", "AuthQR.dc.html"), "utf8");
    expect(html).not.toContain('viewBox="0 0 21 21"');
    expect(html).toContain("ブラウザ");
  });
});
