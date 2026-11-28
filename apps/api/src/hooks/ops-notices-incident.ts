// 段 13「運営が数社を 1 か所で回す」の障害の続報を足す口（K-979）。振る舞いの本体は apps/api/src/features/F12/ops/notices/incident.ts
import type { Hook } from "../contract/deps.js";
import { createAddIncidentUpdate } from "../features/F12/ops/notices/incident.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsNoticesIncidentHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    // 続報の行と今の状態の行と運営の記録を 1 取引で（関数 1 回・鈴とメールは出さない）
    addIncidentUpdate: { before: createAddIncidentUpdate(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsNoticesIncidentHooks",
  make: (d) => opsNoticesIncidentHooks(d),
  fuzz: "same",
});
