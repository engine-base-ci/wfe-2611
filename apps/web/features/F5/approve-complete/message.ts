// 承認して完了する（K-63 の孫）の画面の知らせの文。正本（errors.json）の文を引く。正本に無い言葉は「読み込めなかった」の文
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import type { CallErr } from "@/lib/api/call";

export function messageOf(r: Pick<CallErr, "kind" | "code" | "status">): string {
  return catalogMessage(errorCodeOf(r));
}

export function catalogMessage(code: string): string {
  try {
    return errorText(code).entry.message;
  } catch {
    return errorText(PAGE_ERROR.loadFailed).entry.message;
  }
}
