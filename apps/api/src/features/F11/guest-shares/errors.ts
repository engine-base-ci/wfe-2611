// チケットの見せる相手の口（K-881）の DB の断り → HTTP と errors.json の文。文言はコードに書かず正本（errors.json）から引く。
//   404（E-GST-040・NOT_FOUND）と 409（E-GST-041）には field・details・detail を付けない（在るかを漏らさない）。
//   知らない断り・関数の例外は 503・E-PAGE-003（止める側に倒す）。ログは場所と例外の種類だけ（グループの名前・題名を出さない）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 正本のエラーを、欄なし・detail なしの形で */
const bare = (status: number, code: string): HookReply => {
  const j = kanameError(code).toJSON();
  return {
    status,
    body: {
      error: j.error,
      code: j.code,
      message: j.message,
      action: j.action,
      undo: j.undo,
      support_code: j.support_code,
    },
  };
};

/** 道の id のチケットが見えない・無い（入口が先に断る。防御の 2 層目） */
export const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
/** チケットに書けない（入口が先に断る。防御の 2 層目） */
export const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });

/** DB の例外の番号と hint だけを読む（文や値は読まない） */
export const pgInfo = (e: unknown): { code: string; hint: string } => {
  const x = (e ?? {}) as { code?: unknown; hint?: unknown };
  return { code: typeof x.code === "string" ? x.code : "", hint: typeof x.hint === "string" ? x.hint : "" };
};
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 止める側に倒す（503・E-PAGE-003）。ログには場所と例外の種類だけ */
export const down = (where: string, e: unknown): HookReply => {
  console.error(`[guest-shares] ${where}：例外（${kindOf(e)}）なので止める側に倒した`);
  return bare(503, "E-PAGE-003");
};

/** 読む口の例外：見えない（42501）は 404、ほかは 503 */
export function replyOfRead(e: unknown): HookReply {
  return pgInfo(e).code === "42501" ? notFound() : down("見せる相手を読む", e);
}

/** 付け外しの口の例外：無いグループ 404・E-GST-040／20 を超える 409・E-GST-041／書けない 403／ほかは 503 */
export function replyOfUpdate(e: unknown): HookReply {
  const { code, hint } = pgInfo(e);
  if (code === "42501" && hint === "E-GST-040") return bare(404, "E-GST-040");
  if (code === "22023" && hint === "E-GST-041") return bare(409, "E-GST-041");
  if (code === "42501") return forbidden();
  return down("見せる相手を付け外す", e);
}
