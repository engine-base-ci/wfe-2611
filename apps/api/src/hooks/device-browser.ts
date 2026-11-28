// AI が使うブラウザを PC ごとに選ぶ（K-364）の契約の口。振る舞いの本体は apps/api/src/features/F3/ai-browser/pick.ts。
//   同じ道の PC を外す・ブラウザを確かめる・Bridge の窓から選ぶ口は、それぞれの葉が自分の hooks のファイルを作る（このファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createPickDeviceBrowser } from "../features/F3/ai-browser/pick.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function deviceBrowserHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    updateMyDevice: { before: createPickDeviceBrowser(d.appPool) },
  };
}

export const register = defineHooks({
  name: "deviceBrowserHooks",
  make: (d) => deviceBrowserHooks(d),
  fuzz: "same",
});
