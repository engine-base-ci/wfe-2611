// ログインの契約の口の振る舞い（K-301 パスワード。K-302 確認のコード・K-306 ログアウトもここに足す）。中身は apps/api/src/features/F1/login/。
//   上限・入力の形は契約の入口（op.ts）が先に確かめる。答えにログインの印が入るので、冪等の器には残さない
import type { Hook } from "../contract/deps.js";
import { loginFeature, type LoginDeps } from "../features/F1/login/sign-in.js";
import { signOutFeature } from "../features/F1/login/sign-out.js";

export function loginHooks(d: LoginDeps): Record<string, Hook> {
  const f = loginFeature(d);
  const out = signOutFeature(d);
  return {
    signInWithPassword: { input: f.input, before: f.signIn, noIdempotency: true },
    signOut: { before: out.signOut, noIdempotency: true },
  };
}
