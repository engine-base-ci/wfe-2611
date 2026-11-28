// 運営が 1 社の中を見る（K-969）の契約の口 openPeek・closePeek。振る舞いの本体は apps/api/src/features/F12/ops/peek.ts。
//   見ている間の上の帯は稼働状況の口（K-955 の getServiceStatusForMember）の bands に DB の関数で入る（このファイルに足さない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createClosePeek, createOpenPeek } from "../features/F12/ops/peek.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsPeekHooks(d: HookDeps): Record<string, Hook> {
  return {
    openPeek: { before: createOpenPeek(d.appPool) },
    closePeek: { before: createClosePeek(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsPeekHooks",
  make: (d) => opsPeekHooks(d),
  fuzz: "same",
});
