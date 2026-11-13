// 承認して完了する（K-63 の孫 K-161〜K-166）の DB の答えの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   ログに成果物の中身・差し戻しの理由・メールを出さない（ログは言葉と場所だけ）。
//   K-161 は読む口（not_found）。K-162 は承認（not_member・not_approver・not_writable → 403・decided → 409・guard_failed → 503）。
//   差し戻し・完了の言葉は K-163〜K-166 が replyOf に足す
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 正本のエラー（欄つき） */
export const fromCatalog = (code: string, status: number, o: { field?: string } = {}): HookReply => {
  const e = kanameError(code);
  return {
    status,
    body: {
      ...e.toJSON(),
      ...(o.field ? { field: o.field, details: [{ field: o.field, message: e.entry.message }] } : {}),
    },
  };
};
/** 見つからない（他の会社の id・消されたチケット・成果物でない承認も同じ。中身を返さない・D-131.11） */
export const notFound = (): HookReply => fromCatalog("E-PAGE-001", 404);
/** 入力の形違い（422・欄つき）。入口（op.ts）と同じ形 */
export const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
/** 止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と言葉の種類だけ */
export const down = (where: string, word: string): HookReply => {
  console.error(`[approve-complete] ${where}：知らない答え（${word}）なので止める側に倒した`);
  return fromCatalog("E-PAGE-003", 503);
};

/** DB の関数の答え { error: <言葉> } → 答え。知らない言葉は止める側（503・言葉は記録にだけ残し、答えに出さない） */
export function replyOf(r: { error?: unknown }, where: string): HookReply {
  const word = String(r.error);
  if (word === "not_found") return notFound();
  // 承認する人でない・今のメンバーでない・書けない（副作用なし。担当者がいない承認も not_approver）
  if (word === "not_member" || word === "not_approver" || word === "not_writable")
    return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  // 決まった・取り下げた承認（E-CONF-003「この承認はもう処理されています」）
  if (word === "decided") return fromCatalog("E-CONF-003", 409);
  // 差し戻す理由が空・空白だけ・制御文字だけ（E-VAL-020・欄 note・何も書かない・K-163）
  if (word === "reason_empty") return fromCatalog("E-VAL-020", 422, { field: "note" });
  // 守りの判定で例外（fail-closed・K63-API-059）。知らない言葉（bad_decision を含む）も止める側
  return down(where, word);
}
