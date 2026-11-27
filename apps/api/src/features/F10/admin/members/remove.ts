// 外す口 removeMember（POST /members/:id/remove・K-848）。管理者が選んだ引き継ぎ先にその場で担当を移し（D-154.6）、待っている渡しを取り消し、
//   後ろ半分（すぐ消える物・セッションと PC・外した印）は K-849 の app.member_erase に任せる。DB の関数 app.member_remove を 1 回（1 取引・関門 C2）。
//   権限・本人確認（always）・429・形の誤り（422）は入口（op.ts）。関数の答えの言葉は replyOf（番号つきの答え E-MEM-020〜023 はそのまま通る）。
//   ログに名前・メールを出さない（場所と例外の種類だけ）
import { withTenant } from "@kaname/db/context";
import { replyOf } from "../gate.js";
import type { AdminOp } from "../op.js";
import { dataReply } from "../shape.js";

export const ready = true as boolean;

/** 答えの鍵（ちょうど 4・K-800 の契約 MemberRemoved） */
export const REMOVED_KEYS = ["member_id", "tickets_moved", "handovers_cancelled", "restorable_until"] as const;

type Removed = Record<string, unknown> & { error?: string };

const uuidOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export const run: AdminOp = async ({ d, a }) => {
  const to = uuidOrNull(a.input["transfer_to_member_id"]);
  const items = Array.isArray(a.input["transfers"]) ? (a.input["transfers"] as unknown[]) : null;
  let v: Removed | undefined;
  try {
    v = await withTenant(
      d.appPool,
      a.ctx,
      async (c) =>
        (
          await c.query<{ v: Removed }>("select app.member_remove($1, $2, $3::jsonb) as v", [
            a.id,
            to,
            items ? JSON.stringify(items) : null,
          ])
        ).rows[0]?.v,
    );
  } catch (e) {
    console.error(`[F10 removeMember] 外す所で失敗した（${(e as Error)?.name ?? "Error"}）`);
    return replyOf({ error: "db_failed" });
  }
  if (!v) return replyOf({ error: "empty" });
  if (typeof v.error === "string") return replyOf(v as { error: string });
  return dataReply(200, v, REMOVED_KEYS);
};
