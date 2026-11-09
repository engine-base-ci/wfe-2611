// チケットを作る（K-60）の契約の口。振る舞いの本体は apps/api/src/features/F4/create-ticket/（流れと操作ごとのフォルダ・D-128.130）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createTicketHooks } from "../features/F4/create-ticket/hooks.js";

export function ticketHooks(appPool: pg.Pool): Record<string, Hook> {
  const h = createTicketHooks(appPool);
  return {
    createTicket: { ...h["createTicket"] },
    listTicketKinds: { ...h["listTicketKinds"] },
    listScopes: { ...h["listScopes"] },
    getTicket: { ...h["getTicket"] },
    listMyTicketDrafts: { ...h["listMyTicketDrafts"] },
    saveMyTicketDraft: { ...h["saveMyTicketDraft"] },
  };
}
