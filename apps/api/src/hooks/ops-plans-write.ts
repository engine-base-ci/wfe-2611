// 値段を変える案を作る・直す・決める人に回す（K-988）の契約の口 createPlanProposal・updatePlanProposal・submitPlanProposal。
//   振る舞いの本体は apps/api/src/features/F12/ops/plans/write.ts。読む 3 本（K-987）は ops-plans-read.ts（同じファイルに足さない）
import type { Hook } from "../contract/deps.js";
import {
  createCreatePlanProposal,
  createSubmitPlanProposal,
  createUpdatePlanProposal,
} from "../features/F12/ops/plans/write.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsPlansWriteHooks(d: HookDeps): Record<string, Hook> {
  return {
    createPlanProposal: { before: createCreatePlanProposal(d.appPool) },
    updatePlanProposal: { before: createUpdatePlanProposal(d.appPool) },
    submitPlanProposal: { before: createSubmitPlanProposal(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsPlansWriteHooks",
  make: (d) => opsPlansWriteHooks(d),
  fuzz: "same",
});
