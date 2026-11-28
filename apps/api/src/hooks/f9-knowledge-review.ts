// 見直すページを読む口（K-695）の契約の登録。振る舞いの本体は apps/api/src/features/F9/knowledge/review.ts。
//   持ち主の表は features/F9/knowledge/ops.ts（getKnowledgeReview → f9-knowledge-review）
import type { Hook } from "../contract/deps.js";
import { createGetKnowledgeReview } from "../features/F9/knowledge/review.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgeReviewHooks(d: HookDeps): Record<string, Hook> {
  return {
    getKnowledgeReview: { before: createGetKnowledgeReview(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgeReviewHooks",
  make: (d) => knowledgeReviewHooks(d),
  fuzz: "same",
});
