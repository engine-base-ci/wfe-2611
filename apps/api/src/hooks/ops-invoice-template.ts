// 運営の請求書の型の口（K-1107・getOpsInvoiceTemplate・updateOpsInvoiceTemplate）の契約の口。振る舞いの本体は apps/api/src/features/F12/ops/invoice-template.ts。
//   材料の config は要求の時に読む（make で読まない・k144 の葉の土台 leafHooks は appPool しか渡さない）
import type { Hook } from "../contract/deps.js";
import { getOpsInvoiceTemplate, updateOpsInvoiceTemplate } from "../features/F12/ops/invoice-template.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsInvoiceTemplateHooks(
  d: Pick<HookDeps, "appPool"> & Partial<Pick<HookDeps, "config">>,
): Record<string, Hook> {
  const deps = { appPool: d.appPool, config: () => d.config };
  return {
    // 読む（保存していない間は設定の値・版 0）
    getOpsInvoiceTemplate: { before: getOpsInvoiceTemplate(deps) },
    // 直す（版で取り合いを止める・同じ値なら書かない・運営の記録）
    updateOpsInvoiceTemplate: { before: updateOpsInvoiceTemplate(deps) },
  };
}

export const register = defineHooks({
  name: "opsInvoiceTemplateHooks",
  make: (d) => opsInvoiceTemplateHooks(d),
  fuzz: "same",
});
