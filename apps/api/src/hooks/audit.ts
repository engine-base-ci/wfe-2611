// 記録を探す口（K-823）の契約の口 listAuditEvents。振る舞いの本体は apps/api/src/features/F10/audit/list.ts。
//   ことばで探す（q）は孫 K-850 が同じ口に足した（道は list.ts → search.ts。このファイルの口の持ち主は K-823）。画面から記録を書く口は作らない（D-154.25）
import type { Hook } from "../contract/deps.js";
import { createListAuditEvents } from "../features/F10/audit/list.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function auditHooks(d: HookDeps): Record<string, Hook> {
  return {
    listAuditEvents: { before: createListAuditEvents(d.appPool) },
  };
}

export const register = defineHooks({
  name: "auditHooks",
  make: (d) => auditHooks(d),
  fuzz: "same",
});
