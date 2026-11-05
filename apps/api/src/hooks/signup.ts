// 登録する（K-51）の契約の口の振る舞い。中身は apps/api/src/features/F1/sign-up/。認可・上限・入力の形は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { signupFeature, type SignupDeps } from "../features/F1/sign-up/index.js";

export function signupHooks(d: SignupDeps): Record<string, Hook> {
  const f = signupFeature(d);
  return {
    createSignup: { before: f.create },
    getSignupStatus: { before: f.status },
    resendSignupEmail: { before: f.resend },
  };
}
