// 再設定のメールを頼む（K-313）の契約の口の振る舞い。中身は apps/api/src/features/F1/password-reset/。上限・入力の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { passwordResetFeature, type PasswordResetDeps } from "../features/F1/password-reset/index.js";

export function passwordResetHooks(d: PasswordResetDeps): Record<string, Hook> {
  const f = passwordResetFeature(d);
  // 冪等キーは使わない：答えは誰にでも同じで、器に残すものが無い（登録の有無を残さない）
  return { requestPasswordReset: { before: f.request, noIdempotency: true } };
}
