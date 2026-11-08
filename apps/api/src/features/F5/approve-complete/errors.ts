// 承認して完了する（K-63）の DB の答えの言葉 → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   ログに成果物の中身・差し戻しの理由・メールを出さない（ログは言葉と場所だけ）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 正本のエラー（欄つき）。details は欄ごとの理由 */
export const fromCatalog = (
  code: string,
  status: number,
  o: { field?: string; details?: { field: string; message: string; id?: string }[] } = {},
): HookReply => {
  const e = kanameError(code);
  const details = o.details ?? (o.field ? [{ field: o.field, message: e.entry.message }] : undefined);
  return {
    status,
    body: { ...e.toJSON(), ...(o.field ? { field: o.field } : {}), ...(details ? { details } : {}) },
  };
};
export const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
export const notFound = (): HookReply => fromCatalog("E-PAGE-001", 404);
export const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
/** 守りの所で例外になった：通さず止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と例外の種類だけ */
export const down = (where: string, e?: unknown): HookReply => {
  console.error(`[approve-complete] ${where}：止める側に倒した（${(e as Error)?.name ?? "guard_failed"}）`);
  return fromCatalog("E-PAGE-003", 503);
};

/** DB の関数の答え { error: <言葉>, … } → 答え。知らない言葉は止める側（503） */
export function replyOf(r: Record<string, unknown>, where: string): HookReply {
  const word = String(r["error"]);
  switch (word) {
    case "not_found":
      return notFound();
    case "not_approver":
    case "not_member":
    case "not_writable":
      return forbidden();
    case "decided":
      return fromCatalog("E-CONF-003", 409);
    case "stage":
      return fromCatalog("E-CONF-016", 409);
    case "todo_changed":
      return fromCatalog("E-CONF-017", 409);
    case "done":
      return fromCatalog("E-CONF-018", 409);
    case "reason_empty":
      return fromCatalog("E-VAL-020", 422, { field: "note" });
    case "reason_long":
      return fromCatalog("E-VAL-021", 422, { field: "note" });
    case "todo_left":
      return fromCatalog("E-VAL-022", 422, {
        field: "todo_checked",
        details: ((r["left"] as string[] | undefined) ?? []).map((message) => ({ field: "todo_checked", message })),
      });
    case "not_confirmed":
      return fromCatalog("E-VAL-023", 422, { field: "conditions_confirmed" });
    case "children_left":
      return fromCatalog("E-VAL-024", 422, {
        field: "children",
        details: ((r["children"] as { id: string; label: string }[] | undefined) ?? []).map((c) => ({
          field: "children",
          message: c.label,
          id: c.id,
        })),
      });
    default:
      return down(where);
  }
}

/** 決まった承認を変えようとした（approvals_once・0063）は、もう処理されている（409） */
export const isDecidedViolation = (e: unknown): boolean =>
  (e as { code?: string })?.code === "23514" && /決まった承認は変えられません/.test(String((e as Error)?.message));
