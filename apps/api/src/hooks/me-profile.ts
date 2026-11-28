// 自分を読む・直す口（K-833）の契約の口：getMe・updateMe。振る舞いの本体は apps/api/src/features/F10/me/profile.ts。
//   答えの member の形は features/F10/me/member-shape.ts（K-834・K-835 も同じ形を使う）。
//   外枠が今読む手で書いた道すじ GET /api/auth-ext/me（apps/api/src/auth/ext.ts・K-253）は触らない
import type { Hook } from "../contract/deps.js";
import { createGetMe, createUpdateMe, inputMe } from "../features/F10/me/profile.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function meProfileHooks(d: HookDeps): Record<string, Hook> {
  return {
    getMe: { before: createGetMe(d.appPool, d.objects) },
    updateMe: { input: inputMe, before: createUpdateMe(d.appPool, d.objects) },
  };
}

export const register = defineHooks({
  name: "meProfileHooks",
  make: (d) => meProfileHooks(d),
  fuzz: "same",
});
