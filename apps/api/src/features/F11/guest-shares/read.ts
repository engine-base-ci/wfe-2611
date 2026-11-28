// 見せる相手を読む口（K-881）：listTicketGuestShares（GET /api/v1/tickets/:id/guest-shares）。
//   入口（op.ts）が先に、ログイン・道の :id のチケットが見えるか（見えなければ 404・NOT_FOUND）を確かめる。
//   1 取引・文 1 つ（app.ticket_guest_share_state）。選べるグループ（choices）は書ける人にだけ DB の関数が返す。
//   200 { data: { shared, choices, can_change } }。関数の 42501 は 404（防御の 2 層目）・DB が落ちたら 503・E-PAGE-003
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { notFound, replyOfRead } from "./errors.js";

export async function readGuestShares(appPool: pg.Pool, a: HookArgs): Promise<HookReply> {
  if (!a.id) return notFound();
  try {
    const v = await withTenant(
      appPool,
      a.ctx,
      async (cl) =>
        (await cl.query<{ v: unknown }>("select app.ticket_guest_share_state($1::uuid) as v", [a.id])).rows[0]?.v ??
        null,
    );
    if (!v) return notFound();
    return { status: 200, body: { data: v } };
  } catch (e) {
    return replyOfRead(e);
  }
}
