// 外枠の数と帯（K-465）の契約の口 getShell。振る舞いの本体は apps/api/src/features/F7/shell/read.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。速さの台帳の試験（k237_perf_budget.test.ts）は
//   shellHooks(appPool) の形で差す（setupTaskHooks と同じ形）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createGetShell } from "../features/F7/shell/read.js";
import { defineHooks } from "./registry.js";

export function shellHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    getShell: { before: createGetShell(appPool) },
  };
}

export const register = defineHooks({
  name: "shellHooks",
  make: (d) => shellHooks(d.appPool),
  fuzz: "same",
});
