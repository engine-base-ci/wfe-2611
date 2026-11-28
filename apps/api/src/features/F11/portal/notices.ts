// 先方の場所のお知らせを読む口（K-906）：listPortalNotices（GET /api/v1/portal/notices・D-155.37）。
//   運営からの全部向けのお知らせ（公開済み・消していない・全部向け・置き場に banner・保守の終わりが過ぎていない）を新しい順に 3 件まで。
//   答えは app.portal_notices() が組む（[{ id, title, body }]・無ければ []）。ゲストでない → 403・DB が落ちた → 503
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { readPortal } from "./home.js";

export function createListPortalNotices(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return (a: HookArgs) =>
    readPortal(appPool, a, "select app.portal_notices() as v", [], { status: 200, body: { data: [] } });
}
