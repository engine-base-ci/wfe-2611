// 答えるの種類ごとのファイル：申し出に答える（K-408・D-148.12）。渡す＝申し出た人に担当者が替わる（受け箱だけ）・断る＝理由を残して知らせる。
//   申し出は一緒に切り替える物を選ばないので、答えに switch が付いていたら断る（この種類だけの決まり）
import { withTenant } from "@kaname/db/context";
import { down, kindOf, replyOf } from "../errors.js";
import type { AnswerKind } from "../kinds.js";
import { sendHandoverMails, type MailRow } from "../notify.js";

type OfferAnswer = { ok?: boolean; error?: string; handover?: unknown; mails?: MailRow[]; [k: string]: unknown } | null;

export const answerOffer: AnswerKind = async (c) => {
  const where = "申し出に答える";
  if (c.input.switch !== null) return replyOf({ error: "switch", field: "switch" }, where);
  let v: OfferAnswer;
  try {
    v = await withTenant(c.d.appPool, c.a.ctx, async (cl) => {
      const r = await cl.query<{ v: OfferAnswer }>("select app.handover_answer_offer($1, $2::jsonb) as v", [
        c.handoverId,
        JSON.stringify(c.input),
      ]);
      return r.rows[0]?.v ?? null;
    });
  } catch (e) {
    return down(where, `例外（${kindOf(e)}）`);
  }
  if (!v) return down(where, "答えが無い");
  if (typeof v.error === "string") return replyOf(v as { error: string }, where);
  if (v.ok !== true || !v.handover) return down(where, "知らない答え");
  await sendHandoverMails(
    c.d,
    { tenantId: c.a.ctx.tenantId ?? "", userId: c.a.ctx.userId ?? "" },
    v.mails ?? [],
    `answer-offer:${c.handoverId}`,
  );
  return { status: 200, body: { data: v.handover } };
};
