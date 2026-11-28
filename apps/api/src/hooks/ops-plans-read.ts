// 配るもの › プランを読む（K-987）の契約の口 listOpsPlans・listPlanProposals・listPlanHistory。振る舞いの本体は
//   apps/api/src/features/F12/ops/plans/read.ts。ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createListOpsPlans, createListPlanHistory, createListPlanProposals } from "../features/F12/ops/plans/read.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsPlansReadHooks(d: HookDeps): Record<string, Hook> {
  return {
    listOpsPlans: { before: createListOpsPlans(d.appPool) },
    listPlanProposals: { before: createListPlanProposals(d.appPool) },
    listPlanHistory: { before: createListPlanHistory(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsPlansReadHooks",
  make: (d) => opsPlansReadHooks(d),
  fuzz: "same",
});
