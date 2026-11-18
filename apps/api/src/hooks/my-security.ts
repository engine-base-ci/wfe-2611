// 自分の安全の設定を読む（K-308）の契約の口の振る舞い。中身は apps/api/src/features/F1/my-security/。
//   上限・認証・同意し直しの止めは契約の入口（op.ts）が先に確かめる。読むだけの口
import type { Hook } from "../contract/deps.js";
import { mySecurityFeature, type MySecurityDeps } from "../features/F1/my-security/index.js";

export function mySecurityHooks(d: MySecurityDeps): Record<string, Hook> {
  const f = mySecurityFeature(d);
  return {
    getMySecurity: { before: f.read },
  };
}
