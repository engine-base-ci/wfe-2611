// ログインと安全（K-318）：パスキーを足す・パスキーで取り直す。部品の addPasskey（Cookie を使う）は使わず、
//   @simplewebauthn/browser と口を直に呼ぶ（K-304・K-309 の受け渡し）：始めの口（GET）の答えの challenge_token を持ち、
//   確かめ（verify-registration・stepUp）の頭 x-passkey-challenge で返す。Cookie は使わない
import { startAuthentication, startRegistration, WebAuthnError } from "@simplewebauthn/browser";
import { CATALOG } from "@kaname/errors/catalog";
import { call } from "@/lib/api/call";
import { apiBase, getToken } from "@/lib/api/client";

const REGISTER_OPTIONS = "/api/auth/passkey/generate-register-options";
const REGISTER_VERIFY = "/api/auth/passkey/verify-registration";
const AUTH_OPTIONS = "/api/auth/passkey/generate-authenticate-options";
const CHALLENGE_HEADER = "x-passkey-challenge";
const CHALLENGE_FIELD = "challenge_token";
/** この端末に付いている（口の 409・端末の InvalidStateError） */
export const PASSKEY_EXISTS = "E-AUTH-018";
/** 端末でやめた・時間切れ */
export const PASSKEY_FAILED = "パスキーを付けられませんでした。もう一度試すか、2 段階認証を使ってください";

export type PasskeyFailKind = "step_up" | "cancelled" | "exists" | "unauthenticated" | "failed";
export type PasskeyResult =
  { ok: true } | { ok: false; kind: PasskeyFailKind; status: number; code: string; message: string | null };

type Json = Record<string, unknown>;

const bearer = (): Record<string, string> => {
  const t = getToken();
  return t ? { authorization: `Bearer ${t}` } : {};
};
async function readJson(res: Response): Promise<Json> {
  const v: unknown = await res.json().catch(() => ({}));
  return typeof v === "object" && v !== null ? (v as Json) : {};
}
function failOf(status: number, body: Json): PasskeyResult {
  const code = String(body["code"] ?? body["error"] ?? status);
  const message = typeof body["message"] === "string" ? body["message"] : null;
  const kind: PasskeyFailKind =
    status === 401
      ? "unauthenticated"
      : status === 403 && code === "STEP_UP_REQUIRED"
        ? "step_up"
        : code === PASSKEY_EXISTS
          ? "exists"
          : "failed";
  return { ok: false, kind, status, code, message };
}
/** 網が切れた・口に届かない（fetch の例外）。正本の E-PAGE-008 の文を出す */
export const NETWORK_FAIL = "E-PAGE-008";
const netFail = (): PasskeyResult => ({ ok: false, kind: "failed", status: 0, code: NETWORK_FAIL, message: null });

/** 端末の手順の失敗：もう付いている（InvalidStateError）か、やめた・時間切れ（それ以外） */
function deviceFail(e: unknown): PasskeyResult {
  const name = e instanceof Error ? e.name : "";
  const code = e instanceof WebAuthnError ? e.code : "";
  const exists = name === "InvalidStateError" || code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED";
  return exists
    ? { ok: false, kind: "exists", status: 0, code: PASSKEY_EXISTS, message: null }
    : { ok: false, kind: "cancelled", status: 0, code: "", message: null };
}
/** 始めの口（GET）を呼び、challenge_token と残り（端末に渡す options）に分ける */
async function options(
  path: string,
): Promise<{ ok: true; token: string; options: Json } | { ok: false; fail: PasskeyResult }> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { accept: "application/json", ...bearer() },
    credentials: "omit",
  });
  const body = await readJson(res);
  if (!res.ok) return { ok: false, fail: failOf(res.status, body) };
  const { [CHALLENGE_FIELD]: token, ...rest } = body;
  return { ok: true, token: typeof token === "string" ? token : "", options: rest };
}

/** パスキーを足す（名前は前後の空白を除いた値を呼ぶ側が渡す） */
export async function addPasskey(name: string): Promise<PasskeyResult> {
  try {
    return await addPasskeyOnce(name);
  } catch {
    return netFail();
  }
}
async function addPasskeyOnce(name: string): Promise<PasskeyResult> {
  const o = await options(REGISTER_OPTIONS);
  if (!o.ok) return o.fail;
  let response: unknown;
  try {
    response = await startRegistration({ optionsJSON: o.options as never });
  } catch (e: unknown) {
    return deviceFail(e);
  }
  const res = await fetch(`${apiBase()}${REGISTER_VERIFY}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      [CHALLENGE_HEADER]: o.token,
      ...bearer(),
    },
    credentials: "omit",
    body: JSON.stringify({ response, name }),
  });
  if (res.ok) return { ok: true };
  return failOf(res.status, await readJson(res));
}

/** パスキーで本人確認を取り直す（パスワードの無い人・K-309） */
export async function stepUpWithPasskey(): Promise<PasskeyResult> {
  try {
    return await stepUpWithPasskeyOnce();
  } catch {
    return netFail();
  }
}
async function stepUpWithPasskeyOnce(): Promise<PasskeyResult> {
  const o = await options(AUTH_OPTIONS);
  if (!o.ok) return o.fail;
  let response: unknown;
  try {
    response = await startAuthentication({ optionsJSON: o.options as never });
  } catch (e: unknown) {
    return deviceFail(e);
  }
  const r = await call("stepUp", {
    body: { passkey: response as Record<string, unknown> },
    headers: { [CHALLENGE_HEADER]: o.token },
    screenId: "mfa-setup",
    keepOn401: true,
  });
  if (r.ok) return { ok: true };
  return failOf(r.status, r.body);
}

/** 失敗を小窓に出す文にする（正本の文が在ればそれ・口の文・決まった文）。
 *  cancelled は端末でやめた・時間切れのときの文（足すは PASSKEY_FAILED、取り直しは E-AUTH-021 の文を呼ぶ側が渡す） */
export function passkeyFailText(
  f: Extract<PasskeyResult, { ok: false }>,
  expired: string,
  cancelled: string = PASSKEY_FAILED,
): string {
  if (f.kind === "unauthenticated" && f.code !== "STEP_UP_FAILED") return expired;
  if (f.kind === "exists") return CATALOG[PASSKEY_EXISTS]?.message ?? cancelled;
  if (f.kind === "cancelled") return cancelled;
  return f.message ?? CATALOG[f.code]?.message ?? cancelled;
}

/** パスキーの名前の既定：端末の種類から「<OS>（<ブラウザ>）」（K-309 の口の既定と同じ形。機種名はブラウザから分からない） */
export function defaultPasskeyName(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /CrOS/.test(ua)
          ? "ChromeOS"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Windows/.test(ua)
              ? "Windows"
              : /Linux/.test(ua)
                ? "Linux"
                : "この端末";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\/|FxiOS/.test(ua)
      ? "Firefox"
      : /Chrome\/|CriOS/.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "ブラウザ";
  return `${os}（${browser}）`;
}
