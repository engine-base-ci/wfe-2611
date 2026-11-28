// ログインと安全（K-318・K-319）の動きが共に使う小さな物：正本の文・今いる道・ログインへ戻す
import { CATALOG } from "@kaname/errors/catalog";
import { notifyUnauthorized } from "@/lib/api/client";
import { NETWORK_FAIL } from "./passkey";

export const SCREEN = "mfa-setup";
/** 正本の番号の文（無ければ空） */
export const msgOf = (code: string): string => CATALOG[code]?.message ?? "";
/** 網が切れた・口に届かない（call が投げた） */
export const offline = (): string => msgOf(NETWORK_FAIL);
/** 今いる道（問いを付けたまま）。ログインから戻る先 */
export const hereNow = (): string => `${window.location.pathname}${window.location.search}`;
/** ログインが切れた（口が 401）：手元の印を捨て、問いを付けたままログインへ。入り直すと同じ画面から続く */
export function toLogin(): void {
  notifyUnauthorized();
  window.location.assign(`/login?next=${encodeURIComponent(hereNow())}`);
}
