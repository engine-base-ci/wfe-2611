// ワークスペースを切り替える・自分に届いた招待を読む口（K-851）の契約の口：switchWorkspace・listMyInvitations（D-154.81）。
//   振る舞いの本体は apps/api/src/features/F10/me/switch.ts。材料の auth は口を呼んだときに初めて触る（make では触らない：
//   k144 の準備が auth なしで make を呼ぶため・K-836 と同じ）
import type { Hook } from "../contract/deps.js";
import { createListMyInvitations, createSwitchWorkspace, type SwitchDeps } from "../features/F10/me/switch.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function meSwitchHooks(d: HookDeps): Record<string, Hook> {
  const deps: SwitchDeps = {
    appPool: d.appPool,
    get auth() {
      return d.auth;
    },
  };
  return {
    switchWorkspace: { before: createSwitchWorkspace(deps) },
    listMyInvitations: { before: createListMyInvitations(deps) },
  };
}

export const register = defineHooks({ name: "meSwitchHooks", make: (d) => meSwitchHooks(d), fuzz: "same" });
