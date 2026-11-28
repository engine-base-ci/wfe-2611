// 値段を変える案の影響を見る口（K-989・契約の口 getPlanProposalImpact）。中身は apps/api/src/features/F12/ops/plans/impact.ts。
//   上限・:id の uuid の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { createGetPlanProposalImpact, type OpsPlanImpactDeps } from "../features/F12/ops/plans/impact.js";
import { defineHooks } from "./registry.js";

export function opsPlansImpactHooks(d: OpsPlanImpactDeps): Record<string, Hook> {
  return {
    getPlanProposalImpact: { before: createGetPlanProposalImpact(d) },
  };
}

export const register = defineHooks({
  name: "opsPlansImpactHooks",
  make: (d) => opsPlansImpactHooks({ appPool: d.appPool }),
  fuzz: "same",
});
