// メールを確かめる（K-52）の契約の口の振る舞い。中身は apps/api/src/features/F1/verify-email/。上限・入力の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { verifyEmailFeature, type VerifyEmailDeps } from "../features/F1/verify-email/index.js";
import { defineHooks } from "./registry.js";

export function verifyEmailHooks(d: VerifyEmailDeps): Record<string, Hook> {
  const f = verifyEmailFeature(d);
  return { verifySignup: { before: f.verify } };
}

// 契約 fuzz の的からは外す（理由は skip に書く・scripts/ci/fuzz_targets.py が理由の空を赤にする）
export const register = defineHooks({
  name: "verifyEmailHooks",
  make: (d) =>
    verifyEmailHooks({
      auth: d.auth,
      authPool: d.authPool,
      appPool: d.appPool,
      repo: d.repo,
      ...(d.mailer ? { mailer: d.mailer } : {}),
      config: d.config,
    }),
  fuzz: {
    skip: "Better Auth と送るメールの差し込みが要り、偽のセッションの的では回せない。口の振る舞いは K-52 と packages/auth の試験が持つ",
  },
});
