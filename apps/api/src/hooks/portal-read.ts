// 先方の場所を読む契約の口（K-906）：getPortalHome・getPortalTicket・listPortalNotices。振る舞いの本体は apps/api/src/features/F11/portal/。
//   依頼 1 件を読む口（K-907）・チャットに書く口（K-882）は、それぞれの葉が自分の hooks のファイルを作る（このファイルに足さない）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createGetPortalHome } from "../features/F11/portal/home.js";
import { createListPortalNotices } from "../features/F11/portal/notices.js";
import { createGetPortalTicket } from "../features/F11/portal/ticket.js";
import { defineHooks } from "./registry.js";

export function portalReadHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    getPortalHome: { before: createGetPortalHome(appPool) },
    getPortalTicket: { before: createGetPortalTicket(appPool) },
    listPortalNotices: { before: createListPortalNotices(appPool) },
  };
}

export const register = defineHooks({
  name: "portalReadHooks",
  make: (d) => portalReadHooks(d.appPool),
  fuzz: "same",
});
