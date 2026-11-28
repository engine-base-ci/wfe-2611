// 決めた履歴を読む（K-750）の契約の口。振る舞いの本体は apps/api/src/features/F5/more/history.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createApprovalHistory } from "../features/F5/more/history.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function approvalHistoryHooks(d: HookDeps): Record<string, Hook> {
  return {
    listApprovalHistory: { before: createApprovalHistory(d.appPool) },
  };
}

export const register = defineHooks({
  name: "approvalHistoryHooks",
  make: (d) => approvalHistoryHooks(d),
  fuzz: "same",
});
