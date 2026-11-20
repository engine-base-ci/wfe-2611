// Bridge の窓から AI が使うブラウザを選び直す（K-366）の契約の口。振る舞いの本体は apps/api/src/features/F3/ai-browser/bridge-browser.ts。
//   画面から選ぶ口（updateMyDevice）は葉 K-364 の hooks/device-browser.ts（このファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createSetBridgeBrowser } from "../features/F3/ai-browser/bridge-browser.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function bridgeBrowserHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    setBridgeBrowser: { before: createSetBridgeBrowser(d.appPool) },
  };
}

export const register = defineHooks({
  name: "bridgeBrowserHooks",
  make: (d) => bridgeBrowserHooks(d),
  fuzz: "same",
});
