// 会社が足す項目を読む契約の口（K-563）。振る舞いの本体は apps/api/src/features/F4/ticket-fields/list.ts。
//   値を書く口・マスタを作る直す口は、それぞれの葉が自分の hooks のファイルを作る（このファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createListTicketFields } from "../features/F4/ticket-fields/list.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function ticketFieldsReadHooks(d: HookDeps): Record<string, Hook> {
  return {
    listTicketFields: { before: createListTicketFields(d.appPool) },
  };
}

export const register = defineHooks({
  name: "ticketFieldsReadHooks",
  make: (d) => ticketFieldsReadHooks(d),
  fuzz: "same",
});
