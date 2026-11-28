// 運営が 1 社を読む（K-966）の契約の口 getOpsWorkspace・listOpsWorkspaceMembers。振る舞いの本体は apps/api/src/features/F12/ops/workspace.ts。
//   1 社の問い合わせと記録（listOpsWorkspaceInquiries・listOpsWorkspaceAudit）は K-1011 が自分の hooks のファイルを作る（このファイルに足さない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createGetOpsWorkspace, createListOpsWorkspaceMembers } from "../features/F12/ops/workspace.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsWorkspaceHooks(d: HookDeps): Record<string, Hook> {
  return {
    getOpsWorkspace: { before: createGetOpsWorkspace(d.appPool) },
    listOpsWorkspaceMembers: { before: createListOpsWorkspaceMembers(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsWorkspaceHooks",
  make: (d) => opsWorkspaceHooks(d),
  fuzz: "same",
});
