// 端末をなくした：管理者に頼む（K-305）の契約の口の振る舞い。中身は apps/api/src/features/F1/admin-recovery/。上限・入力の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { adminRecoveryFeature, type AdminRecoveryDeps } from "../features/F1/admin-recovery/index.js";
import { defineHooks } from "./registry.js";

export function adminRecoveryHooks(d: AdminRecoveryDeps): Record<string, Hook> {
  const f = adminRecoveryFeature(d);
  // 冪等キーは使わない：1 時間の内の 2 回目は already を返す（頼みの回は DB の関数が決める）
  return { requestAdminRecovery: { input: f.input, before: f.request, noIdempotency: true } };
}

export const register = defineHooks({
  name: "adminRecoveryHooks",
  make: (d) =>
    adminRecoveryHooks({
      appPool: d.appPool,
      authPool: d.authPool,
      ...(d.mailer ? { mailer: d.mailer } : {}),
      config: { opsEmail: d.config.opsEmail },
    }),
  fuzz: "same",
});
