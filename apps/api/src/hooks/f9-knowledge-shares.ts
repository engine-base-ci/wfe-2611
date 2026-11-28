// グループを選んで共有の口（K-689：共有の選びを読む・頼む・やめる・取り下げる）の契約の登録。振る舞いの本体は
//   apps/api/src/features/F9/knowledge/shares-get.ts と shares-set.ts。持ち主の表は features/F9/knowledge/ops.ts
import type { Hook } from "../contract/deps.js";
import { createGetKnowledgeShares } from "../features/F9/knowledge/shares-get.js";
import { createSetKnowledgeShares } from "../features/F9/knowledge/shares-set.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgeSharesHooks(d: HookDeps): Record<string, Hook> {
  return {
    getKnowledgeShares: { before: createGetKnowledgeShares(d.appPool) },
    setKnowledgeShares: { before: createSetKnowledgeShares(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgeSharesHooks",
  make: (d) => knowledgeSharesHooks(d),
  fuzz: "same",
});
