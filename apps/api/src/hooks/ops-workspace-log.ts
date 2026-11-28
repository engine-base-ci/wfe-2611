// 運営が 1 社の問い合わせと記録を読む（K-1011）の契約の口 listOpsWorkspaceInquiries・listOpsWorkspaceAudit。
//   振る舞いの本体は apps/api/src/features/F12/ops/workspace-log.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createListOpsWorkspaceAudit, createListOpsWorkspaceInquiries } from "../features/F12/ops/workspace-log.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsWorkspaceLogHooks(d: HookDeps): Record<string, Hook> {
  return {
    listOpsWorkspaceInquiries: { before: createListOpsWorkspaceInquiries(d.appPool) },
    listOpsWorkspaceAudit: { before: createListOpsWorkspaceAudit(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsWorkspaceLogHooks",
  make: (d) => opsWorkspaceLogHooks(d),
  fuzz: "same",
});
