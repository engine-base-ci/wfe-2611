// 期限・開始日を変える（K-483）の答え：DB の関数 app.ticket_due_set の答えの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   断る番号は役割で分ける（代表の答え answer=f0f290e785a9）：422＝形の誤り（契約に書ける物だけ）／404＝指した物が無い・見えない／409＝今の状態ではできない
//   409・404 の body は error と code などの正本の文だけ（field・details・detail を付けない）。ログに理由・題名・日付の字を出さない（場所と言葉だけ）
//   書く所の DB の例外は ticket-update/update.ts が 503 E-PAGE-003 にする（ここでは捕まえない）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 入力の形違い（422・欄ごとの文）。入口（op.ts）と同じ形 */
export const invalid = (details: { field: string; message: string }[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

/** 正本のエラー（field・details・detail を付けない） */
export const bare = (code: string, status: number): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code).toJSON() };
  delete body["detail"];
  return { status, body };
};

/** 正本のエラーに欄ごとの明細を付ける（422 の E-DUE-001・002） */
export const withField = (code: string, field: string): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code).toJSON() };
  delete body["detail"];
  return { status: 422, body: { ...body, details: [{ field, message: String(body["message"] ?? "") }] } };
};

/** 止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と言葉の種類だけ */
export const down = (where: string, word: string): HookReply => {
  console.error(`[due] ${where}：知らない答え（${word}）なので止める側に倒した`);
  return bare("E-PAGE-003", 503);
};

export const DATE_MESSAGE = "YYYY-MM-DD の暦にある日付か null で送ってください";
export const ONLY_WITH_DUE = "期限を変えるときだけ書けます";
export const PAIR_MESSAGE = "一緒に変える欄と送ってください";

/** DB の関数の答え { error: <言葉>, field? } → 答え。知らない言葉は止める側（503） */
export function replyOf(r: { error?: unknown; field?: unknown }, where: string): HookReply {
  const word = String(r.error);
  const field = typeof r.field === "string" ? r.field : "body";
  switch (word) {
    case "not_found":
      return bare("E-PAGE-001", 404);
    case "not_member":
    case "not_writable":
      return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
    case "done":
      return bare("E-DUE-007", 409);
    case "stale":
      return bare("E-DUE-008", 409);
    case "over_parent":
      return bare("E-DUE-005", 409);
    case "under_child":
      return bare("E-DUE-006", 409);
    case "order_state":
      return bare("E-VAL-028", 409);
    case "past":
      return bare("E-VAL-012", 409);
    // 守りの二重の層（口の前処理と同じ決まり。口を通れば起きない）
    case "bad_date":
      return invalid([{ field, message: DATE_MESSAGE }]);
    case "bad_input":
      return invalid([{ field, message: field === "due_reason" ? ONLY_WITH_DUE : PAIR_MESSAGE }]);
    case "reason_required":
      return withField("E-DUE-001", "due_reason");
    case "reason_long":
      return withField("E-DUE-002", "due_reason");
    default:
      // guard_failed（守りの判定の例外・D-136.1）と知らない言葉
      return down(where, word);
  }
}
