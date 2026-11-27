// 運営が 1 社を止める・再開する（K-970）の契約の口 stopWorkspace・resumeWorkspace。振る舞いの本体は apps/api/src/features/F12/ops/stop.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createResumeWorkspace, createStopWorkspace } from "../features/F12/ops/stop.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsStopHooks(d: HookDeps): Record<string, Hook> {
  return {
    stopWorkspace: { before: createStopWorkspace(d.appPool), contractAtEntry: true },
    resumeWorkspace: { before: createResumeWorkspace(d.appPool), contractAtEntry: true },
  };
}

export const register = defineHooks({
  name: "opsStopHooks",
  make: (d) => opsStopHooks(d),
  fuzz: "same",
});
