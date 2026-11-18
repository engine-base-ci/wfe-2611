// K-308 の行のうち「止め（K-303）がパスキーで入る道（K-304）でも効くか」の 3 行（K308-API-020〜022）の試験（口・本物の DB）。
// 待ちを減らす案 3（2026-11-17・代表の決め）で K-304 から移した（元は K304-API-008〜010）。K-303 と K-304 の両方が入った後に流れる K-308 が持つ。
// 行の文と試験のコードは K-304 の担当が書いたもの（.ticket-flow/out/K-304/move-to-K-308.md）を、そのまま写した。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 土台は K-301 の login.harness.ts（setupLogin・makeUser・h.req・h.json・h.authSessions・h.liveSessions）。
// 仮の認証器と入る道の道具は K-304 の passkey-sign-in.test.ts の頭の分を写した（K-304 の試験のファイルは K-304 の持ち物なので import しない）。
// 確かめていること：better-auth の session.create.before で投げた APIError の body（code・message）が、
//   部品の口（/api/auth/passkey/verify-authentication）の答えにそのまま出る（403 と errors.json の id）。セッションは認証側にも業務側にも増えない
import { describe, expect, it } from "vitest";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign, type KeyObject } from "node:crypto";
import { setupLogin, type User } from "./login.harness.js";

const WEB = "http://127.0.0.1:3123"; // 土台（login.harness.ts）の config.webBaseUrl。画面の origin
const RP_ID = new URL(WEB).hostname;
const UA_A =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36";
const OPTIONS = "/api/auth/passkey/generate-authenticate-options";
const VERIFY = "/api/auth/passkey/verify-authentication";
const CHALLENGE_FIELD = "challenge_token";
const CHALLENGE_HEADER = "x-passkey-challenge";

const h = setupLogin("k308gate");
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

describe("K-308 パスキーで入る道でも止めが効く（K-303 の止め × K-304 の道・案 3 で K-304 から移した）", () => {
  it("K308-API-020 人が止められた × パスキーで入る：403・E-AUTH-011。セッションは増えない", async () => {
    const { u, a, before } = await userWithKey("suspended");
    await h.admin.query("update members set suspended_at = now(), suspended_by = id where id = $1", [u.memberId]);
    const r = await passkeyLogin(u, a);
    await expectNoEntry(r, u, before);
    expect(r.status).toBe(403);
    expect(((await h.json(r)) as Record<string, unknown>)["code"]).toBe("E-AUTH-011");
  });

  it("K308-API-021 会社が止められた × パスキーで入る：403・E-AUTH-012。セッションは増えない", async () => {
    const { u, a, before } = await userWithKey("ws");
    await h.admin.query(
      "insert into subscriptions (tenant_id, status_id, started_at, suspended_at) values ($1, 'active', now(), now())",
      [u.tenantId],
    );
    const r = await passkeyLogin(u, a);
    await expectNoEntry(r, u, before);
    expect(r.status).toBe(403);
    expect(((await h.json(r)) as Record<string, unknown>)["code"]).toBe("E-AUTH-012");
  });

  it("K308-API-022 会社から抜けた × パスキーで入る：403・E-AUTH-007。セッションは増えない", async () => {
    const { u, a, before } = await userWithKey("left");
    await h.admin.query("update members set deleted_at = now() where id = $1", [u.memberId]);
    const r = await passkeyLogin(u, a);
    await expectNoEntry(r, u, before);
    expect(r.status).toBe(403);
    expect(((await h.json(r)) as Record<string, unknown>)["code"]).toBe("E-AUTH-007");
  });
});
