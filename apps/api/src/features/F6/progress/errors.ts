// 段・実績・保留を変える（K-387）の DB の答えの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   写し元は F5/approve-complete/errors.ts の fromCatalog・invalid と同じ形（F5 のファイルは触らない）。
//   ログに理由の字・題名を出さない（ログは場所と言葉だけ）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 正本のエラー（欄つき：明細はその欄の正本の文） */
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
/** 入力の形違い（422・欄ごとの文）。入口（op.ts）と同じ形 */
export const invalid = (details: { field: string; message: string }[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});
/** 止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と言葉の種類だけ */
export const down = (where: string, word: string): HookReply => {
  console.error(`[progress] ${where}：知らない答え（${word}）なので止める側に倒した`);
  return fromCatalog("E-PAGE-003", 503);
};

/** 保留の欄ごとの番号（欄の順＝hold_reason → resume_condition） */
const HOLD_CODES: Record<string, string> = { hold_reason: "E-VAL-041", resume_condition: "E-VAL-047" };
/** 保留でない行き先に付けた欄の文 */
export const HOLD_ONLY_MESSAGE = "保留にするときだけ書けます";

const fieldsOf = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

/** DB の関数 app.ticket_progress_set の答え { error: <言葉>, fields? } → 答え。知らない言葉は止める側（503） */
export function replyOf(r: { error?: unknown; fields?: unknown }, where: string): HookReply {
  const word = String(r.error);
  const fields = fieldsOf(r.fields);
  if (word === "not_found") return fromCatalog("E-PAGE-001", 404);
  if (word === "not_member" || word === "not_writable")
    return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (word === "bad_stage") return fromCatalog("E-VAL-040", 422, { field: fields[0] ?? "stage_id" });
  if (word === "stage_both") return invalid([{ field: "stage_key", message: "どちらか 1 つにしてください" }]);
  if (word === "busy") return fromCatalog("E-CONF-030", 409);
  if (word === "done") return fromCatalog("E-CONF-032", 409);
  if (word === "hold_required" && fields.length) {
    const missing = fields.filter((f) => HOLD_CODES[f]);
    const first = HOLD_CODES[missing[0] ?? "hold_reason"]!;
    return {
      status: 422,
      body: {
        ...kanameError(first).toJSON(),
        details: missing.map((field) => ({ field, message: kanameError(HOLD_CODES[field]!).entry.message })),
      },
    };
  }
  if (word === "hold_not_allowed" && fields.length)
    return invalid(fields.map((field) => ({ field, message: HOLD_ONLY_MESSAGE })));
  if (word === "bad_minutes")
    return invalid([{ field: "actual_minutes", message: "0〜100000 の整数（分）で送ってください" }]);
  // 守りの判定で例外（guard_failed・D-136.1）。知らない言葉も止める側
  return down(where, word);
}
