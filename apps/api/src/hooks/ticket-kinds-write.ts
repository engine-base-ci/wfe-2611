// チケットの設定 › 種別を足す・直す・消す・並べる契約の口（K-704）。振る舞いの本体は apps/api/src/features/F9/settings/kinds.ts。
//   読む口 listTicketKinds は段 5 の F4/create-ticket/hooks.ts のまま（答えに color_key を足した）
import type { Hook } from "../contract/deps.js";
import { createKindHooks } from "../features/F9/settings/kinds.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function ticketKindsWriteHooks(d: HookDeps): Record<string, Hook> {
  return createKindHooks(d.appPool);
}

export const register = defineHooks({
  name: "ticketKindsWriteHooks",
  make: (d) => ticketKindsWriteHooks(d),
  fuzz: "same",
});
