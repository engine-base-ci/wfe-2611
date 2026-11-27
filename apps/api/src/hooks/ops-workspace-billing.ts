// 運営が 1 社のプランと請求を読む・頼まれたときに代わりにプランを変える口（K-968）の契約の口。
//   振る舞いの本体は apps/api/src/features/F12/ops/workspace-billing.ts。材料の config は要求の時に読む（make で読まない）
import type { Hook } from "../contract/deps.js";
import {
  changeOpsWorkspacePlan,
  getOpsWorkspaceBilling,
  type OpsWorkspaceBillingDeps,
} from "../features/F12/ops/workspace-billing.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsWorkspaceBillingHooks(
  d: Pick<HookDeps, "appPool"> & Partial<Pick<HookDeps, "config">>,
): Record<string, Hook> {
  const deps: OpsWorkspaceBillingDeps = { appPool: d.appPool, config: () => d.config };
  return {
    // 1 社のプラン・人数・支払い条件・請求書（読むだけ・関数 1 回・1 取引）
    getOpsWorkspaceBilling: { before: getOpsWorkspaceBilling(deps) },
    // 頼まれたときに代わりにプランを変える（関数 1 回・1 取引・運営と会社の記録）
    changeOpsWorkspacePlan: { before: changeOpsWorkspacePlan(deps) },
  };
}

export const register = defineHooks({
  name: "opsWorkspaceBillingHooks",
  make: (d) => opsWorkspaceBillingHooks(d),
  fuzz: "same",
});
