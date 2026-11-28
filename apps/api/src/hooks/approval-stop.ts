// 承認待ちを使わずに止める（K-732）の契約の口。振る舞いの本体は apps/api/src/features/F5/more/stop.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createApprovalStop } from "../features/F5/more/stop.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function approvalStopHooks(d: HookDeps): Record<string, Hook> {
  return {
    stopApproval: { before: createApprovalStop(d.appPool) },
  };
}

export const register = defineHooks({
  name: "approvalStopHooks",
  make: (d) => approvalStopHooks(d),
  fuzz: "same",
});
