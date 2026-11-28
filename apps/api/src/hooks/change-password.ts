// パスワードを変える・決める（K-312）の契約の口の振る舞い。中身は apps/api/src/features/F1/change-password/。
//   上限・認証・同意し直しの止め・入力の形は契約の入口（op.ts）が先に確かめる。取り直しの判定は口の中（requireStepUpOrFreshLogin）。
//   体にパスワードが入るので、冪等の器に答えも体も残さない（2 回押しは 2 回目を今のパスワードの確かめで断る・K312-API-010）
import type { Hook } from "../contract/deps.js";
import { changePasswordFeature, type ChangePasswordDeps } from "../features/F1/change-password/index.js";
import { defineHooks } from "./registry.js";

export function changePasswordHooks(d: ChangePasswordDeps): Record<string, Hook> {
  const f = changePasswordFeature(d);
  return {
    changePassword: { before: f.change, noIdempotency: true },
    setMyPassword: { before: f.set, noIdempotency: true },
  };
}

export const register = defineHooks({
  name: "changePasswordHooks",
  make: (d) => changePasswordHooks({ auth: d.auth, appPool: d.appPool, actions: d.actions }),
  fuzz: "same",
});
