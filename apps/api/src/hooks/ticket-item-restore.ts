// 項目の変更を点の形に戻す契約の口（K-576）。振る舞いの本体は apps/api/src/features/F4/versions/item-restore.ts。
//   点を読む口・本文の版の口は K-433 の ticket-versions.ts が持つ（このファイルに足さない）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createRestoreTicketItems } from "../features/F4/versions/item-restore.js";
import { defineHooks } from "./registry.js";

export function ticketItemRestoreHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    restoreTicketItems: { before: createRestoreTicketItems(appPool) },
  };
}

export const register = defineHooks({
  name: "ticketItemRestoreHooks",
  make: (d) => ticketItemRestoreHooks(d.appPool),
  fuzz: "same",
});
