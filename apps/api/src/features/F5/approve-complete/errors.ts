// 承認して完了する（K-63 の孫 K-161〜K-166）の DB の答えの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   ログに成果物の中身・差し戻しの理由・メールを出さない（ログは言葉と場所だけ）。
//   K-161 は読む口だけなので、言葉は not_found だけ。ほかの言葉（承認・差し戻し・完了）は K-162〜K-166 が replyOf に足す
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

const fromCatalog = (code: string, status: number): HookReply => ({ status, body: kanameError(code).toJSON() });

/** 入力の形違い（422・欄つき）。入口（op.ts）と同じ形 */
export const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

/** DB の関数の答え { error: <言葉> } → 答え。not_found は 404・E-PAGE-001（他の会社の id・消されたチケット・成果物でない承認も同じ・
 *  中身を返さない・D-131.11）。知らない言葉は止める側（503・E-PAGE-003。言葉は記録にだけ残し、答えに出さない） */
export function replyOf(r: { error?: unknown }, where: string): HookReply {
  const word = String(r.error);
  if (word === "not_found") return fromCatalog("E-PAGE-001", 404);
  console.error(`[approve-complete] ${where}：知らない答え（${word}）なので止める側に倒した`);
  return fromCatalog("E-PAGE-003", 503);
}
