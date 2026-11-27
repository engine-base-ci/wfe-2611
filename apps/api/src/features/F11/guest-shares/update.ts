// 見せる相手を付け外しする口（K-881）：updateTicketGuestShares（PATCH /api/v1/tickets/:id/guest-shares・D-155.35・D-155.45）。
//   入口（op.ts）が先に、ログイン・チケットに書けるか（403）・見えるか（404）・体の形（add／remove は 1〜20 個の uuid・どちらか 1 つは要る・知らない欄は 422）を確かめる。
//   ここは重なる id を 1 つにして、1 取引・文 1 つ（app.ticket_guest_shares_update）に渡すだけ。
//   DB の関数が、先に外してから足す（同じ id が両方にあれば足す方が勝つ）・全部か無しか・20 まで・証跡・新しく見せたグループのゲストの受け箱に 1 件（メールは送らない）を持つ。
//   200 { data: { shared } }。断りは errors.ts（404 E-GST-040・409 E-GST-041・403・503 E-PAGE-003）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { notFound, replyOfUpdate } from "./errors.js";

/** 体の uuid の並びを、重なりを落として取り出す（形は入口が確かめた後） */
const ids = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : [];

export async function updateGuestShares(appPool: pg.Pool, a: HookArgs): Promise<HookReply> {
  if (!a.id) return notFound();
  const add = ids(a.input["add"]);
  const remove = ids(a.input["remove"]);
  try {
    const v = await withTenant(
      appPool,
      a.ctx,
      async (cl) =>
        (
          await cl.query<{ v: { shared: unknown[] } }>(
            "select app.ticket_guest_shares_update($1::uuid, $2::uuid[], $3::uuid[]) as v",
            [a.id, add, remove],
          )
        ).rows[0]!.v,
    );
    return { status: 200, body: { data: { shared: v.shared } } };
  } catch (e) {
    return replyOfUpdate(e);
  }
}
