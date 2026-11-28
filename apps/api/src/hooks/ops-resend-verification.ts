// 運営が 1 社のメンバーに本人確認のメールを送り直す口（K-967）の契約の口。振る舞いの本体は apps/api/src/features/F12/ops/resend-verification.ts。
//   fuzz の的からは外す（メールを送る口・関門 C6。的に送り口を渡さない）
import type { Hook } from "../contract/deps.js";
import { resendOpsVerification } from "../features/F12/ops/resend-verification.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsResendVerificationHooks(d: Pick<HookDeps, "appPool" | "repo" | "auth">): Record<string, Hook> {
  return {
    // 確かめて記録を書き、関門 C6 で 1 通送る（1 取引・送れなければ戻す）
    resendOpsVerification: { before: resendOpsVerification({ appPool: d.appPool, repo: d.repo, auth: d.auth }) },
  };
}

export const register = defineHooks({
  name: "opsResendVerificationHooks",
  make: (d) => opsResendVerificationHooks(d),
  fuzz: { skip: "メールを送る口（関門 C6）。fuzz の的に送り口を渡さない" },
});
