// 誰ができるかを変える口の登録（K-829）：updateWorkspacePermissions（D-154.83）。振る舞いの本体は apps/api/src/features/F10/workspace/permissions.ts。
//   前処理（input）が「1 つ以上・値は 2 つだけ」を見て、before が 1 つの取引で値と記録を書く
import type { Hook } from "../contract/deps.js";
import { checkPermissionsInput, createUpdateWorkspacePermissions } from "../features/F10/workspace/permissions.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function workspacePermissionsHooks(d: HookDeps): Record<string, Hook> {
  return {
    updateWorkspacePermissions: { input: checkPermissionsInput, before: createUpdateWorkspacePermissions(d) },
  };
}

export const register = defineHooks({
  name: "workspacePermissionsHooks",
  make: (d) => workspacePermissionsHooks(d),
  fuzz: "same",
});
