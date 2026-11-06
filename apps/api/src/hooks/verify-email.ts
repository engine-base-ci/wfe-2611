// メールを確かめる（K-52）の契約の口の振る舞い。中身は apps/api/src/features/F1/verify-email/。上限・入力の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { verifyEmailFeature, type VerifyEmailDeps } from "../features/F1/verify-email/index.js";

export function verifyEmailHooks(d: VerifyEmailDeps): Record<string, Hook> {
  const f = verifyEmailFeature(d);
  return { verifySignup: { before: f.verify } };
}
