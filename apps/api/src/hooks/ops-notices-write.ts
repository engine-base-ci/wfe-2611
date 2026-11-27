// 運営がお知らせを作る・直す口（K-1014）の契約の口 createOpsNotice・updateOpsNotice。振る舞いの本体は apps/api/src/features/F12/ops/notices/write.ts。
//   読む口（listOpsNotices・getOpsNotice）は K-977 の ops-notices-read.ts、出す口は K-978 が自分の hooks のファイルを作る（このファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createCreateOpsNotice, createUpdateOpsNotice } from "../features/F12/ops/notices/write.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsNoticesWriteHooks(d: HookDeps): Record<string, Hook> {
  return {
    createOpsNotice: { before: createCreateOpsNotice(d.appPool) },
    updateOpsNotice: { before: createUpdateOpsNotice(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsNoticesWriteHooks",
  make: (d) => opsNoticesWriteHooks(d),
  fuzz: "same",
});
