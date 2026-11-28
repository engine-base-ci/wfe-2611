// 運営が入金を記録する口（K-982・契約の口 recordPayment）。中身は apps/api/src/features/F12/ops/invoice-payments.ts。
//   上限・ops:money・本人確認の取り直し（契約の step_up）・入力の形（知らない欄は 422）は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { createRecordPayment, type OpsInvoicePaymentsDeps } from "../features/F12/ops/invoice-payments.js";
import { defineHooks } from "./registry.js";

export function opsInvoicePaymentsHooks(d: OpsInvoicePaymentsDeps): Record<string, Hook> {
  return {
    recordPayment: { before: createRecordPayment(d), contractAtEntry: true },
  };
}

export const register = defineHooks({
  name: "opsInvoicePaymentsHooks",
  make: (d) => opsInvoicePaymentsHooks({ appPool: d.appPool }),
  fuzz: "same",
});
