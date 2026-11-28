// 消したチケットを戻す（K-489）の契約の口 restoreTicket。振る舞いの本体は apps/api/src/features/F7/ticket-delete/restore.ts。
//   下見（K-487）・消す（K-488）は、それぞれの葉が自分の hooks のファイルを持つ（このファイルに足さない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type { Hook } from "../contract/deps.js";
import { createRestoreTicket } from "../features/F7/ticket-delete/restore.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function ticketRestoreHooks(d: HookDeps): Record<string, Hook> {
  return {
    restoreTicket: { before: createRestoreTicket(d.appPool) },
  };
}

export const register = defineHooks({
  name: "ticketRestoreHooks",
  make: (d) => ticketRestoreHooks(d),
  fuzz: "same",
});
