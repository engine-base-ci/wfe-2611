// はじめにやること（K-250）の契約の口。振る舞いの本体は apps/api/src/features/F4/setup-tasks/（流れと操作ごとのフォルダ・D-128.130）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createSetupTaskHooks } from "../features/F4/setup-tasks/hooks.js";
import { defineHooks } from "./registry.js";

export function setupTaskHooks(appPool: pg.Pool): Record<string, Hook> {
  const h = createSetupTaskHooks(appPool);
  return {
    listSetupTasks: { ...h["listSetupTasks"] },
    dismissSetupTasks: { ...h["dismissSetupTasks"] },
  };
}

export const register = defineHooks({
  name: "setupTaskHooks",
  make: (d) => setupTaskHooks(d.appPool),
  fuzz: "same",
});
