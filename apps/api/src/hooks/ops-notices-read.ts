// 運営がお知らせを読む（K-977）の契約の口 listOpsNotices・getOpsNotice。振る舞いの本体は apps/api/src/features/F12/ops/notices/read.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createGetOpsNotice, createListOpsNotices } from "../features/F12/ops/notices/read.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsNoticesReadHooks(d: HookDeps): Record<string, Hook> {
  return {
    listOpsNotices: { before: createListOpsNotices(d.appPool) },
    getOpsNotice: { before: createGetOpsNotice(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsNoticesReadHooks",
  make: (d) => opsNoticesReadHooks(d),
  fuzz: "same",
});
