// パスキーの名前を変える・外す（K-309）の契約の口の振る舞い。中身は apps/api/src/features/F1/passkeys/。
//   上限・認証・同意し直しの止めは契約の入口（op.ts）が先に確かめる。外すの取り直しの判定は口の中（requireStepUpOrFreshLogin）
import type { Hook } from "../contract/deps.js";
import { passkeysFeature, type PasskeysDeps } from "../features/F1/passkeys/index.js";

export function passkeysHooks(d: PasskeysDeps): Record<string, Hook> {
  const f = passkeysFeature(d);
  return {
    renamePasskey: { before: f.rename },
    deletePasskey: { before: f.remove },
  };
}
