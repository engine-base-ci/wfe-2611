// 自分で直す（K-742）の契約の口。振る舞いの本体は apps/api/src/features/F5/more/edit.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createApprovalEdit } from "../features/F5/more/edit.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function approvalEditHooks(d: HookDeps): Record<string, Hook> {
  return {
    editApproval: { before: createApprovalEdit(d.appPool) },
  };
}

export const register = defineHooks({
  name: "approvalEditHooks",
  make: (d) => approvalEditHooks(d),
  fuzz: "same",
});
