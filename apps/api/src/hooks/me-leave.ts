// ワークスペースから抜ける口（K-838）の契約の口：leaveWorkspace。振る舞いの本体は apps/api/src/features/F10/me/leave.ts。
//   抜ける前の確かめの材料（担当しているチケット・最後の管理者か）は読む口 getMe の workspaces[]（K-833・me-profile.ts）にある
import type { Hook } from "../contract/deps.js";
import { createLeaveWorkspace } from "../features/F10/me/leave.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function meLeaveHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    leaveWorkspace: { before: createLeaveWorkspace(d.appPool) },
  };
}

export const register = defineHooks({
  name: "meLeaveHooks",
  make: (d) => meLeaveHooks(d),
  fuzz: "same",
});
