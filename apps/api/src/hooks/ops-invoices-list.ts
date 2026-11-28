// 運営の請求の一覧（K-983）の契約の口 listOpsInvoices。振る舞いの本体は apps/api/src/features/F12/ops/invoices-list.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createListOpsInvoices } from "../features/F12/ops/invoices-list.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsInvoicesListHooks(d: HookDeps): Record<string, Hook> {
  return {
    listOpsInvoices: { before: createListOpsInvoices(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsInvoicesListHooks",
  make: (d) => opsInvoicesListHooks(d),
  fuzz: "same",
});
