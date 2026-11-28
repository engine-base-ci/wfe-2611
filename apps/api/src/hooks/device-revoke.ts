// PC を外す（K-362）の契約の口。振る舞いの本体は apps/api/src/features/F3/remove-pc/index.ts。
//   同じ道の PC のほかの口（ブラウザを選ぶ・確かめる・Bridge の窓から選ぶ）は、それぞれの葉が自分の hooks のファイルを作る（このファイルに足さない）
import type { Hook } from "../contract/deps.js";
import { createRevokeMyDevice } from "../features/F3/remove-pc/index.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function deviceRevokeHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    revokeMyDevice: { before: createRevokeMyDevice(d.appPool) },
  };
}

export const register = defineHooks({
  name: "deviceRevokeHooks",
  make: (d) => deviceRevokeHooks(d),
  fuzz: "same",
});
