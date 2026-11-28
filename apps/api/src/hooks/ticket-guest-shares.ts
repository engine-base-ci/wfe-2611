// チケットの見せる相手（K-881）の契約の口。振る舞いの本体は apps/api/src/features/F11/guest-shares/（流れと操作ごとのフォルダ・D-128.130）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type pg from "pg";
import type { Hook, HookArgs } from "../contract/deps.js";
import { readGuestShares } from "../features/F11/guest-shares/read.js";
import { updateGuestShares } from "../features/F11/guest-shares/update.js";
import { defineHooks } from "./registry.js";

export function ticketGuestShareHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    listTicketGuestShares: { before: (a: HookArgs) => readGuestShares(appPool, a) },
    updateTicketGuestShares: { before: (a: HookArgs) => updateGuestShares(appPool, a) },
  };
}

export const register = defineHooks({
  name: "ticketGuestShareHooks",
  make: (d) => ticketGuestShareHooks(d.appPool),
  fuzz: "same",
});
