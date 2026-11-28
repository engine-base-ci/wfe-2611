// 設定を読む・名前を直す口（K-827）の契約の口：getWorkspaceSettings・updateWorkspace（D-154.83）。
//   振る舞いの本体は apps/api/src/features/F10/workspace/。「誰ができるか」を変える口（updateWorkspacePermissions）は K-829、
//   消す手続きは K-830 が自分の hooks に足す
import type { Hook } from "../contract/deps.js";
import { createUpdateWorkspace, workspaceUpdateInput } from "../features/F10/workspace/rename.js";
import { createGetWorkspaceSettings } from "../features/F10/workspace/settings.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function workspaceSettingsHooks(d: HookDeps): Record<string, Hook> {
  const deps = { appPool: d.appPool, objects: d.objects };
  return {
    getWorkspaceSettings: { before: createGetWorkspaceSettings(deps) },
    updateWorkspace: { input: workspaceUpdateInput, before: createUpdateWorkspace(deps) },
  };
}

export const register = defineHooks({
  name: "workspaceSettingsHooks",
  make: (d) => workspaceSettingsHooks(d),
  fuzz: "same",
});
