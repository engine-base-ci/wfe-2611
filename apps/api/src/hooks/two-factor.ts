// 2 段階認証を付ける（K-311）の契約の口の振る舞い。中身は apps/api/src/features/F1/two-factor/。
//   上限・認証・同意し直しの止め・入力の形は契約の入口（op.ts）が先に確かめる。
//   答えに 1 回だけ渡す秘密（鍵の文字・バックアップコード）が入るので、冪等の器に答えを残さない
import type { Hook } from "../contract/deps.js";
import { twoFactorFeature, type TwoFactorDeps } from "../features/F1/two-factor/index.js";

export function twoFactorHooks(d: TwoFactorDeps): Record<string, Hook> {
  const f = twoFactorFeature(d);
  return {
    startTwoFactor: { before: f.start, noIdempotency: true },
    confirmTwoFactor: { before: f.confirm, noIdempotency: true },
  };
}
