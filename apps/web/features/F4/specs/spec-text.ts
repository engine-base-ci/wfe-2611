// 確認項目の文の決まりと、画面に出す字（K-450）。口の決まり（K-434 の app.test_spec_title_check）と同じ：前後の空白を落として 1〜200 字。
//   断りの文は正本（errors.json → @kaname/errors/catalog）から引く。正本に無い字（押せない形の title・欄の下の誤り）はここに 1 か所で持つ
import { CATALOG } from "@kaname/errors/catalog";
import { errorCodeOf, errorText } from "@/components/k/error-of";
import type { CallErr } from "@/lib/api/call";

export const TITLE_MAX = 200;
export const MAX_SPECS = 50;

export const TEXT = {
  hint: "確認項目はまだありません。足すと、終わったときに機械と人が確かめます",
  empty: "確かめることを書いてください",
  long: `確かめることは ${TITLE_MAX} 文字までです`,
  forbidden: "この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください",
  checkedLock: "チェックを外すと直せます",
  knowledgeLock: "必ず守る決まりから入った項目は、直せません・外せません",
  afterCreate: "作ったあとに付けます",
  limit: `確認項目は ${MAX_SPECS} 件までです`,
  notYet: "まだ使えません",
} as const;

/** 前後の空白（全角の空白・タブ・改行を含む）を落とす */
export function trimTitle(t: string): string {
  return t.replace(/^\s+|\s+$/g, ""); // \s は全角の空白（U+3000）・タブ・改行も含む
}

/** 文の誤り（無ければ null）。空・空白だけ／生の字で 200 を超える */
export function titleProblem(t: string): string | null {
  if (trimTitle(t) === "") return TEXT.empty;
  if ([...t].length > TITLE_MAX) return TEXT.long;
  return null;
}

/** 口の断りの文。403 は既定の文、正本に在る番号はその文、無ければ答えの種類で共通の 1 件 */
export function refusalText(r: Pick<CallErr, "kind" | "code" | "status">): string {
  if (r.status === 403) return TEXT.forbidden;
  const entry = CATALOG[r.code];
  if (entry) return entry.message;
  return errorText(errorCodeOf(r)).entry.message;
}
