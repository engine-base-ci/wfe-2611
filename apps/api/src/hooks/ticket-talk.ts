// チケットの中で話す口（K-763）の登録（K-326）。振る舞いの本体は apps/api/src/features/F5/talk/ticket.ts。
//   server.ts・fuzz の的には書かない（作り手 scripts/ci/gen_ts_registries.py が一覧 all.generated.ts に入れる）
import type { Hook } from "../contract/deps.js";
import { ticketTalkHooks as make } from "../features/F5/talk/ticket.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function ticketTalkHooks(d: HookDeps): Record<string, Hook> {
  const h = make(d.appPool);
  return {
    getTicketAgentSession: { ...h["getTicketAgentSession"] },
    sendTicketAgentMessage: { ...h["sendTicketAgentMessage"] },
  };
}

export const register = defineHooks({
  name: "ticketTalkHooks",
  make: (d) => ticketTalkHooks(d),
  fuzz: "same",
});
