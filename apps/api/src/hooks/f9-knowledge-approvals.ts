// 承認待ちを読む・承認する・断る口（K-688）の契約の登録。振る舞いの本体は
//   apps/api/src/features/F9/knowledge/approvals.ts と decide.ts。持ち主の表は features/F9/knowledge/ops.ts
import type { Hook } from "../contract/deps.js";
import { createListKnowledgeApprovals } from "../features/F9/knowledge/approvals.js";
import { createApproveKnowledgeRequest, createDeclineKnowledgeRequest } from "../features/F9/knowledge/decide.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgeApprovalsHooks(d: HookDeps): Record<string, Hook> {
  return {
    listKnowledgeApprovals: { before: createListKnowledgeApprovals(d.appPool) },
    approveKnowledgeRequest: { before: createApproveKnowledgeRequest(d.appPool) },
    declineKnowledgeRequest: { before: createDeclineKnowledgeRequest(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgeApprovalsHooks",
  make: (d) => knowledgeApprovalsHooks(d),
  fuzz: "same",
});
