// ナレッジのページを作る・下書きを保存する・やめる口 3 本（K-679）の契約の登録。振る舞いの本体は
//   apps/api/src/features/F9/knowledge/page-create.ts・draft-save.ts・draft-discard.ts。持ち主の表は features/F9/knowledge/ops.ts
import type { Hook } from "../contract/deps.js";
import { createCreateKnowledgePage } from "../features/F9/knowledge/page-create.js";
import { createSaveKnowledgeDraft } from "../features/F9/knowledge/draft-save.js";
import { createDiscardKnowledgeDraft } from "../features/F9/knowledge/draft-discard.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function knowledgeDraftHooks(d: HookDeps): Record<string, Hook> {
  return {
    createKnowledgePage: { before: createCreateKnowledgePage(d.appPool) },
    saveKnowledgeDraft: { before: createSaveKnowledgeDraft(d.appPool) },
    discardKnowledgeDraft: { before: createDiscardKnowledgeDraft(d.appPool) },
  };
}

export const register = defineHooks({
  name: "knowledgeDraftHooks",
  make: (d) => knowledgeDraftHooks(d),
  fuzz: "same",
});
