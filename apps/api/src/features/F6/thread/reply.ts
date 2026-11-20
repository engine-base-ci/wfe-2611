// やり取りの口（段 7：K-383 読む・K-384 最後に開いた時刻・K-385 書く・K-386 直す・消す・☆）が共通で使う答え。
//   文言はコードに書かず正本（errors.json）から引く（K-165 の approve-complete/errors.ts と同じ形）。
//   ログには場所と例外の種類だけを出す（本文・人の id・例外の文を出さない・D-136.1）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 422 の明細の 1 件（入口 op.ts と同じ形） */
export type Issue = { field: string; message: string };

/** 見つからない（見えないチケット・別の会社・消したチケット。中身を返さない・D-136.2） */
export const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });

/** 正本のエラー（E-PAGE-003）を、場所と例外の種類だけのログと一緒に返す */
function pageDown(status: number, where: string, what: string, e: unknown): HookReply {
  console.error(`[thread] ${where}：${what}（${(e as Error)?.name ?? "Error"}）`);
  const x = kanameError("E-PAGE-003").toJSON() as { message?: string; action?: string };
  return {
    status,
    body: {
      error: status === 503 ? "unavailable" : "internal",
      code: "E-PAGE-003",
      message: x.message ?? "",
      action: x.action ?? "",
    },
  };
}

/** 守りの判定・読む所で例外になった：止める側に倒して 503・E-PAGE-003（fail-closed・D-136.1） */
export const down = (where: string, e: unknown): HookReply => pageDown(503, where, "止める側に倒した", e);

/** 書く所で DB が失敗した：500・E-PAGE-003（K-385・K-386 が使う） */
export const broke = (where: string, e: unknown): HookReply => pageDown(500, where, "書けなかった", e);

/** 入力の形違い（422・欄つき）。入口（op.ts）と同じ形。理由のある欄を全部まとめて返すときは issues に足す */
export const invalid = (
  field: string,
  message: string,
  code = "VALIDATION_ERROR",
  issues: Issue[] = [],
): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code, details: [{ field, message }, ...issues] },
});
