// 値段を変える案を決める口・差し戻す口（K-990・契約の口 decidePlanProposal・returnPlanProposal）。中身は apps/api/src/features/F12/ops/plans/decide.ts。
//   上限・:id の uuid の形・入力の形・本人確認の取り直し（決める）は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import {
  createDecidePlanProposal,
  createReturnPlanProposal,
  type OpsPlanDecideDeps,
} from "../features/F12/ops/plans/decide.js";
import { defineHooks } from "./registry.js";

export function opsPlansDecideHooks(d: OpsPlanDecideDeps): Record<string, Hook> {
  return {
    decidePlanProposal: { before: createDecidePlanProposal(d), contractAtEntry: true },
    returnPlanProposal: { before: createReturnPlanProposal(d), contractAtEntry: true },
  };
}

export const register = defineHooks({
  name: "opsPlansDecideHooks",
  make: (d) => opsPlansDecideHooks({ appPool: d.appPool }),
  fuzz: "same",
});
