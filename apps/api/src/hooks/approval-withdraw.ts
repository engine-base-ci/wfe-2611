// 承認を取り下げる（K-733）の契約の口。振る舞いの本体は apps/api/src/features/F5/more/withdraw.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createApprovalWithdraw } from "../features/F5/more/withdraw.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function approvalWithdrawHooks(d: HookDeps): Record<string, Hook> {
  return {
    withdrawApproval: { before: createApprovalWithdraw(d.appPool) },
  };
}

export const register = defineHooks({
  name: "approvalWithdrawHooks",
  make: (d) => approvalWithdrawHooks(d),
  fuzz: "same",
});
