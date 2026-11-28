// 予定時間を変える（K-583）の答え：DB の答えの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   断る番号は役割で分ける（代表の答え answer=f0f290e785a9・03_architecture/共通の決まり.md）：
//     422＝形の誤り（契約に書ける物だけ）／404＝指した物が無い・見えない（在るかを漏らさない）／409＝今の状態ではできない
//   予定時間は DB の中身で決まる断りを持たない（会社・人・書けるか・見えるか・消していないかだけ）ので 409 は無い。
//   404 の body は error と code などの正本の文だけ（field・details・detail を付けない）。ログに値の字を出さない（ログは場所と言葉だけ）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 入力の形違い（422・欄ごとの文）。入口（op.ts）と同じ形 */
export const invalid = (details: { field: string; message: string }[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

/** 正本のエラー（field・details・detail を付けない：在るかを漏らさない） */
export const bare = (code: string, status: number): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code).toJSON() };
  delete body["detail"];
  return { status, body };
};

/** 止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と言葉の種類だけ */
export const down = (where: string, word: string): HookReply => {
  console.error(`[ticket-estimate] ${where}：知らない答え（${word}）なので止める側に倒した`);
  return bare("E-PAGE-003", 503);
};

/** 予定時間の上限（分）。作る口の見込み・実績と同じ */
export const ESTIMATE_MAX = 100000;
export const ESTIMATE_MESSAGE = "0〜100000 の整数（分）か null で送ってください";

/** DB の関数 app.ticket_estimate_set の答え { error: <言葉> } → 答え。知らない言葉は止める側（503） */
export function replyOf(r: { error?: unknown }, where: string): HookReply {
  const word = String(r.error);
  if (word === "not_found") return bare("E-PAGE-001", 404);
  if (word === "not_member" || word === "not_writable")
    return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  // 守りの二重の層（口の前処理と同じ決まり。口を通れば起きない）
  if (word === "bad_minutes") return invalid([{ field: "estimate_minutes", message: ESTIMATE_MESSAGE }]);
  // 守りの判定で例外（guard_failed・D-136.1）。知らない言葉も止める側
  return down(where, word);
}
