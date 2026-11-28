// 同意し直し（K-53・D-125.162）：口が 403・E-AUTH-010 を返したら、どの画面からでも同意し直しの画面（/login?step=terms&next=元の道）へ移す。
//   なぜ移ったかが分かるように、口が返した文を同意し直しの画面に渡す（このタブの sessionStorage）。同意し直しの画面の中では移さない
export const TERMS_REQUIRED = "E-AUTH-010";
const REASON_KEY = "kaname.terms.reason";
/** 同意できた時刻（このタブ）。この時刻より前に出した要求の 403 は、後から届いても同意し直しの画面へ戻さない（時間の猶予は持たない） */
const DONE_KEY = "kaname.terms.agreedAt";

/** いま同意し直しの画面にいるか */
const onTermsStep = (): boolean => {
  try {
    return window.location.pathname === "/login" && new URLSearchParams(window.location.search).get("step") === "terms";
  } catch {
    return false;
  }
};
/** 同意し直しの画面の道（元の道を next に持つ） */
export const termsStepHref = (next: string): string =>
  `/login?${new URLSearchParams({ step: "terms", next }).toString()}`;

/** 答えが同意し直しの 403 なら、同意し直しの画面へ移す。移したら true。
 *  sentAt はその要求を出した時刻（Date.now()）。同意できた時刻より前に出した要求の 403 は、同意の前の答えなので無視する */
export function noticeTermsRequired(status: number, code: unknown, message: unknown, sentAt?: number): boolean {
  if (status !== 403 || code !== TERMS_REQUIRED || typeof window === "undefined") return false;
  if (onTermsStep()) return true;
  if (sentAt !== undefined && sentAt < agreedAt()) return true;
  try {
    if (typeof message === "string" && message) window.sessionStorage.setItem(REASON_KEY, message);
  } catch {
    /* 文を渡せなくても画面は移す（同意し直しの画面が正本の文を出す） */
  }
  window.location.replace(termsStepHref(`${window.location.pathname}${window.location.search}`));
  return true;
}
/** 同意し直しの画面が、移ってきた理由の文を読む（読んだら消さない：再読み込みでも出す。同意したら消す） */
export const termsReason = (): string | null => {
  try {
    return window.sessionStorage.getItem(REASON_KEY);
  } catch {
    return null;
  }
};
const agreedAt = (): number => {
  try {
    return Number(window.sessionStorage.getItem(DONE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
};
/** 同意できた（同意し直しの画面が呼ぶ）。理由の文を消し、同意できた時刻を覚える */
export const markTermsAgreed = (): void => {
  try {
    window.sessionStorage.removeItem(REASON_KEY);
    window.sessionStorage.setItem(DONE_KEY, String(Date.now()));
  } catch {
    /* 覚えられなくても続ける */
  }
};
export const clearTermsReason = (): void => {
  try {
    window.sessionStorage.removeItem(REASON_KEY);
  } catch {
    /* 消せなくても続ける */
  }
};
