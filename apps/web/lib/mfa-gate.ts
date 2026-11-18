// 付けるまで進めない（K-319・D-128.141・answer=6bdcb125e8f7 ⑮）：口が 403・MFA_REQUIRED を返したら、どの画面からでも
//   ログインと安全の画面（/mfa-setup?next=<今の道と問い>&back=1）へ移す。同意し直し（lib/terms-gate.ts）と同じ形。
//   口が返した文（戻された知らせ・番号は K-321 が正本に足す）は、戻された知らせとして出すためにこのタブの sessionStorage に渡す。ログインと安全の画面の中では移さない。
//   ログインしていない（手元に印が無い）ときは移さない（ログアウトした直後の画面を閉じ込めない）。口の入口の 403 は K-321
import { getToken } from "@/lib/api/client";

export const MFA_REQUIRED = "MFA_REQUIRED";
export const MFA_SETUP_PATH = "/mfa-setup";
const REASON_KEY = "kaname.mfa.reason";

/** ログインと安全の画面の道（元の道を next に持ち、戻された印 back=1） */
export const mfaSetupHref = (next: string): string =>
  `${MFA_SETUP_PATH}?${new URLSearchParams({ next, back: "1" }).toString()}`;

/** 答えが付けるまで進めないの 403 なら、ログインと安全の画面へ移す。移した（か、もうその画面にいる）なら true */
export function noticeMfaRequired(status: number, code: unknown, message: unknown): boolean {
  if (status !== 403 || code !== MFA_REQUIRED || typeof window === "undefined") return false;
  if (window.location.pathname === MFA_SETUP_PATH) return true;
  if (!getToken()) return false;
  try {
    if (typeof message === "string" && message) window.sessionStorage.setItem(REASON_KEY, message);
  } catch {
    /* 文を渡せなくても画面は移す（ログインと安全の画面が正本の文を出す） */
  }
  window.location.replace(mfaSetupHref(`${window.location.pathname}${window.location.search}`));
  return true;
}

/** ログインと安全の画面が、戻された理由の文を読む（口が返した文。無ければ null） */
export const mfaReason = (): string | null => {
  try {
    return window.sessionStorage.getItem(REASON_KEY);
  } catch {
    return null;
  }
};
/** 付け終わった（ログインと安全の画面が呼ぶ）。理由の文を消す */
export const clearMfaReason = (): void => {
  try {
    window.sessionStorage.removeItem(REASON_KEY);
  } catch {
    /* 消せなくても続ける */
  }
};
