// チケットを作る（K-60）・一覧（K-92）の契約の口。振る舞いの本体は apps/api/src/features/F4/create-ticket/・ticket-list/（流れと操作ごとのフォルダ・D-128.130）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createTicketHooks } from "../features/F4/create-ticket/hooks.js";
import { createTicketListHooks } from "../features/F4/ticket-list/hooks.js";
import { defineHooks } from "./registry.js";

export function ticketHooks(appPool: pg.Pool): Record<string, Hook> {
  const h = createTicketHooks(appPool);
  const l = createTicketListHooks(appPool);
  return {
    listTickets: { ...l["listTickets"] },
    createTicket: { ...h["createTicket"] },
    listTicketKinds: { ...h["listTicketKinds"] },
    listScopes: { ...h["listScopes"] },
    getTicket: { ...h["getTicket"] },
    listMyTicketDrafts: { ...h["listMyTicketDrafts"] },
    saveMyTicketDraft: { ...h["saveMyTicketDraft"] },
  };
}

export const register = defineHooks({
  name: "ticketHooks",
  make: (d) => ticketHooks(d.appPool),
  fuzz: "same",
});
