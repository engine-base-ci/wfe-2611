// 登録する（K-51）の契約の口の振る舞い。中身は apps/api/src/features/F1/sign-up/。認可・上限・入力の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { signupFeature, type SignupDeps } from "../features/F1/sign-up/index.js";
import { defineHooks } from "./registry.js";

export function signupHooks(d: SignupDeps): Record<string, Hook> {
  const f = signupFeature(d);
  return {
    createSignup: { before: f.create },
    getSignupStatus: { before: f.status },
    resendSignupEmail: { before: f.resend },
  };
}

// 契約 fuzz の的からは外す（理由は skip に書く・scripts/ci/fuzz_targets.py が理由の空を赤にする）
export const register = defineHooks({
  name: "signupHooks",
  make: (d) =>
    signupHooks({
      authPool: d.authPool,
      repo: d.repo,
      actions: d.actions,
      ...(d.mailer ? { mailer: d.mailer } : {}),
      config: d.config,
    }),
  fuzz: {
    skip: "Better Auth と送るメールの差し込みが要り、偽のセッションの的では回せない。口の振る舞いは K-51 と packages/auth の試験が持つ",
  },
});
