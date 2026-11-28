// 運営がひな形の新しい版を出す口（K-1010・releaseOpsTemplate）と、操作を読む口（listOperations）の契約の口。
//   振る舞いの本体は apps/api/src/features/F12/ops/templates/release.ts・apps/api/src/features/F12/ops/operations.ts。
//   ひな形を読む 2 本（K-992）は ops-templates-read.ts（同じファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createReleaseOpsTemplate } from "../features/F12/ops/templates/release.js";
import { createListOperations } from "../features/F12/ops/operations.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsTemplatesReleaseHooks(d: HookDeps): Record<string, Hook> {
  return {
    releaseOpsTemplate: { before: createReleaseOpsTemplate(d.appPool) },
    listOperations: { before: createListOperations(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsTemplatesReleaseHooks",
  make: (d) => opsTemplatesReleaseHooks(d),
  fuzz: "same",
});
