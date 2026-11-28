// 試し打ち（K-746）の契約の口。振る舞いの本体は apps/api/src/features/F5/more/dry-run.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createDryRun } from "../features/F5/more/dry-run.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function dryRunHooks(d: HookDeps): Record<string, Hook> {
  return {
    dryRunTicket: { before: createDryRun(d.appPool) },
  };
}

export const register = defineHooks({
  name: "dryRunHooks",
  make: (d) => dryRunHooks(d),
  fuzz: "same",
});
