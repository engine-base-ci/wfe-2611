// 見せてもらったチケット 1 件を読む口（K-906）：getPortalTicket（GET /api/v1/portal/tickets/:id・D-155.41・D-155.42）。
//   見えるのは「見せる相手に自分のゲストのグループが選ばれた」チケットだけ（K-881 の app.guest_sees_ticket）。答えは app.portal_ticket(:id) が組む：
//   ticket（id・title・stage・body・detail・from_request）と messages（K-882 の app.portal_ticket_messages の答え）。
//   見えない・無い・消した・別のグループ・別の会社 → 関数が null → 404・NOT_FOUND（欄なし・題や本文を出さない）。ゲストでない → 403・DB が落ちた → 503
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { NOT_FOUND, readPortal } from "./home.js";

export function createGetPortalTicket(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    if (!a.id) return NOT_FOUND;
    return readPortal(appPool, a, "select app.portal_ticket($1::uuid) as v", [a.id]);
  };
}
