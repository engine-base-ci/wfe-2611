// まとめて承認（K-768）の契約の口。振る舞いの本体は apps/api/src/features/F5/more/bulk.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createBulkApprove, createBulkPreview } from "../features/F5/more/bulk.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function approvalBulkHooks(d: HookDeps): Record<string, Hook> {
  return {
    previewBulkApproval: { before: createBulkPreview(d.appPool) },
    bulkApprove: { before: createBulkApprove(d.appPool) },
  };
}

export const register = defineHooks({
  name: "approvalBulkHooks",
  make: (d) => approvalBulkHooks(d),
  fuzz: "same",
});
