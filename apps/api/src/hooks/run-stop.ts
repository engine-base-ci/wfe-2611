// 動いている AI の実行を止める（K-731）の契約の口。振る舞いの本体は apps/api/src/features/F5/stop/。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createRunStop } from "../features/F5/stop/index.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function runStopHooks(d: HookDeps): Record<string, Hook> {
  return {
    stopActionRun: { before: createRunStop(d.appPool) },
  };
}

export const register = defineHooks({
  name: "runStopHooks",
  make: (d) => runStopHooks(d),
  fuzz: "same",
});
