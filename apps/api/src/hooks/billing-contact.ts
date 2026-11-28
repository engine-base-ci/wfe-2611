// 段 13「請求とプラン（利用者の側）」の請求先を変える口（K-959）。振る舞いの本体は apps/api/src/features/F12/billing/contact.ts
import type { Hook } from "../contract/deps.js";
import { updateBillingContact } from "../features/F12/billing/contact.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function billingContactHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    // 請求先を書き、管理者全員に画面のお知らせと記録（関数 1 回・1 取引・メールは送らない）
    updateBillingContact: { before: updateBillingContact(d.appPool), contractAtEntry: true },
  };
}

export const register = defineHooks({
  name: "billingContactHooks",
  make: (d) => billingContactHooks(d),
  fuzz: "same",
});
