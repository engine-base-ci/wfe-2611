// 承認する（K-162）・差し戻す（K-163）の書く口：approveApproval（承認して実行の仕事を積む）・returnApproval（理由つきの作り直しを積む）。
//   書くのは関門 C2 の app.approval_decide（承認の行・実行の記録と仕事・段・やり取りの 1 行・証跡を 1 つの処理で・0096）だけ。
//   承認する人＝今の担当者（行の決まり OP_RULES.approveApproval と関数の中の判定の 2 層）。本人確認は取り直さない（D-128.177）。
//   守りの判定で例外になったら止める側（503・E-PAGE-003・何も書かない）。書く所の DB の失敗は 500（何も残らない）。
//   ログに成果物の中身・メールを出さない（承認の場所と言葉の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { fromCatalog, invalid, replyOf } from "./errors.js";

/** DB の関数の答え（決めた行）か、だめな理由の言葉 */
type Decided = Record<string, unknown> & { error?: unknown };

/** 差し戻しの後に直す人（K-744・D-153.29）：clone＝AI が作り直す（既定・今までどおり）・self＝自分で直す（仕事を積まない） */
export type NextActor = "clone" | "self";
/** 入力の next_actor：欄が無ければ clone。あれば文字の clone か self だけ（null・空・大文字・ほかの値は欄 next_actor の 422）。
 *  入口の zod は文字か null かしか見ないので、値の確かめは口の仕事（null を「無い」と同じにしない） */
export const nextActorOf = (input: Record<string, unknown>): NextActor | HookReply => {
  if (!Object.prototype.hasOwnProperty.call(input, "next_actor")) return "clone";
  const v = input["next_actor"];
  return v === "clone" || v === "self"
    ? v
    : invalid("next_actor", "次に直す人は AI（clone）か自分（self）を選んでください");
};

/** 決めた答え（201 ApprovalDecided）。run_id は作り直し・実行の id（自分で直す差し戻しは null）。pc は任せた人のアカウントの PC が最後の知らせから 75 秒以内なら live（K-62 と同じ式） */
const decidedReply = (r: Decided): HookReply => ({
  status: 201,
  body: {
    data: {
      id: r["id"],
      decision: r["decision"],
      decided_at: r["decided_at"],
      status_id: r["status_id"],
      ticket_id: r["ticket_id"],
      run_id: r["run_id"],
      pc: r["pc"],
    },
  },
});

/** 承認か差し戻しを決める。関数を 1 回呼ぶ（1 要求＝接続 1 本・関門 C2） */
/** 差し戻しの理由：NUL と制御文字（タブ・改行・復帰を除く）を入口で取り除く（断らない・切らない・D-131.1）。空かどうかは DB の関数が見る */
export const cleanReason = (v: unknown): string =>
  // eslint-disable-next-line no-control-regex
  (typeof v === "string" ? v : "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

export async function decide(
  pool: pg.Pool,
  a: HookArgs,
  decision: "approve" | "return",
  where: string,
  reason: string | null = null,
  next: NextActor = "clone",
): Promise<HookReply> {
  let r: Decided | undefined;
  try {
    r = await withTenant(
      pool,
      a.ctx,
      async (cl) =>
        (
          await cl.query<{ v: Decided }>("select app.approval_decide($1, $2, $3, $4) as v", [
            a.id,
            decision,
            reason,
            next,
          ])
        ).rows[0]?.v,
    );
  } catch (e) {
    // 書く所の失敗（1 つの処理なので何も残らない）。中身を返さず、ログは場所と例外の種類だけ
    console.error(`[approve-complete] ${where}：書く所で失敗した（${(e as Error)?.name ?? "Error"}）`);
    return fromCatalog("E-PAGE-003", 500);
  }
  if (!r) return replyOf({ error: "empty" }, where);
  if (r.error === undefined) return decidedReply(r);
  return replyOf(r, where);
}

export function decideHooks(pool: pg.Pool): Record<string, Hook> {
  return {
    approveApproval: { before: (a: HookArgs) => decide(pool, a, "approve", "承認する") },
    returnApproval: {
      before: (a: HookArgs) => {
        const next = nextActorOf(a.input);
        if (typeof next !== "string") return Promise.resolve(next);
        return decide(pool, a, "return", "差し戻す", cleanReason(a.input["note"]), next);
      },
    },
  };
}
