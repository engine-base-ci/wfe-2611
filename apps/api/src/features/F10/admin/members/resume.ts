// 戻す口（K-814）：resumeMember（POST /api/v1/members/:id/resume・体なし・本人確認の取り直しは入口）。
//   書くのは関門 C2 の app.member_resume（会社ごとの錠・members の edit・相手・止まっているかを関数の中で確かめ、止めを解いて証跡を残す。1 取引）だけ。
//   切ったセッションと取り消した PC の仕事は戻さない（入り直し）。
//   答えの言葉 → 状態と番号は gate.ts の replyOf。例外は 503・E-PAGE-003（ログは場所と例外の種類だけ・名前は出さない・何も残らない）。
import { withTenant } from "@kaname/db/context";
import { replyOf } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";
import { MEMBER_STATE_KEYS } from "./suspend.js";

type Answer = { ok?: boolean; result?: unknown; error?: string; [k: string]: unknown };

export const ready = true as boolean;

export const run: AdminOp = async ({ d, a }) => {
  let v: Answer | undefined;
  try {
    v = await withTenant(
      d.appPool,
      a.ctx,
      async (cl) => (await cl.query<{ v: Answer }>("select app.member_resume($1::uuid) as v", [a.id])).rows[0]?.v,
    );
  } catch (e) {
    console.error(`[members] 戻す：書く所で失敗した（${(e as Error)?.name ?? "Error"}）`);
    return replyOf({ error: "db_error" });
  }
  if (!v) return replyOf({ error: "empty" });
  if (typeof v.error === "string") return replyOf({ ...v, error: v.error });
  return dataReply(200, v.result, MEMBER_STATE_KEYS);
};
