// もう一度確かめる仕事をその PC に宛てる（K-365）の契約の口。振る舞いの本体は apps/api/src/features/F3/ai-browser/check.ts。
//   同じ道の PC を外す・ブラウザを選ぶ・Bridge の窓から選ぶ口は、それぞれの葉が自分の hooks のファイルを持つ（このファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createCheckDeviceBrowser } from "../features/F3/ai-browser/check.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function deviceBrowserCheckHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    checkMyDeviceBrowser: { before: createCheckDeviceBrowser(d.appPool) },
  };
}

export const register = defineHooks({
  name: "deviceBrowserCheckHooks",
  make: (d) => deviceBrowserCheckHooks(d),
  fuzz: "same",
});
