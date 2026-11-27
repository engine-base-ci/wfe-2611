// ゲストが見せたチケットのチャットに書く口（K-882）：postPortalTicketMessage（POST /api/v1/portal/tickets/:id/messages・D-155.53・D-155.44）。
//   入口（op.ts）が先に、ログイン・役（先方の口なので社内の人は 403）・上限・冪等・体の形（body だけ・前後の空白を取った後が空なら 422・知らない欄は 422）を確かめる。
//   ここは 1 取引・文 1 つ（app.portal_ticket_message_post）に渡すだけ。見えるかの判定・書き込み・担当者の受け箱（メールは送らない）・証跡は DB の関数が持つ。
//   201 { data: { id } }。見えない（見せていない・外した・別のグループ・消した・無い）は 404・E-GST-060（欄・details なし）・ほかは 503・E-PAGE-003。
//   ログには場所と例外の種類だけ（本文を出さない）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

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
const pgInfo = (e: unknown): { code: string; hint: string } => {
  const x = (e ?? {}) as { code?: unknown; hint?: unknown };
  return { code: typeof x.code === "string" ? x.code : "", hint: typeof x.hint === "string" ? x.hint : "" };
};
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** DB の断り → 答え：見えない 404・E-GST-060／ほかは止める側（503・E-PAGE-003） */
export function replyOfPost(e: unknown): HookReply {
  const { code, hint } = pgInfo(e);
  if (code === "42501" && hint === "E-GST-060") return bare(404, "E-GST-060");
  if (code === "42501" && hint === "") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } }; // ゲストの文脈でない人
  console.error(`[portal-chat] チャットに書く：例外（${kindOf(e)}）なので止める側に倒した`);
  return bare(503, "E-PAGE-003");
}

export async function postPortalMessage(appPool: pg.Pool, a: HookArgs): Promise<HookReply> {
  if (!a.id) return bare(404, "E-GST-060");
  const body = typeof a.input["body"] === "string" ? a.input["body"].trim() : "";
  // 欄が無い・前後の空白（全角を含む）を取ると空は 422（入口の zod は欄を optional のまま・必須は口が断る）。何も書かない
  if (body === "")
    return {
      status: 422,
      body: {
        error: "validation_failed",
        code: "VALIDATION_ERROR",
        details: [{ field: "body", message: "本文を入れてください" }],
      },
    };
  try {
    const v = await withTenant(
      appPool,
      a.ctx,
      async (cl) =>
        (
          await cl.query<{ v: { id: string } }>("select app.portal_ticket_message_post($1::uuid, $2) as v", [
            a.id,
            body,
          ])
        ).rows[0]!.v,
    );
    return { status: 201, body: { data: { id: v.id } } };
  } catch (e) {
    return replyOfPost(e);
  }
}
