// ワークスペースを消す手続き・取り消す口の登録（K-830）：requestWorkspaceDeletion・cancelWorkspaceDeletion（D-128.65・D-154.5）。
//   振る舞いの本体は apps/api/src/features/F10/workspace/deletion.ts（DB の関数 app.workspace_deletion_request・app.workspace_deletion_cancel）。
//   体の形（confirm_name の 1〜100 字・strict）と本人確認の取り直しは契約の入口が見る
import type { Hook } from "../contract/deps.js";
import { createCancelWorkspaceDeletion, createRequestWorkspaceDeletion } from "../features/F10/workspace/deletion.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function workspaceDeletionHooks(d: HookDeps): Record<string, Hook> {
  return {
    requestWorkspaceDeletion: { before: createRequestWorkspaceDeletion(d) },
    cancelWorkspaceDeletion: { before: createCancelWorkspaceDeletion(d) },
  };
}

export const register = defineHooks({
  name: "workspaceDeletionHooks",
  make: (d) => workspaceDeletionHooks(d),
  fuzz: "same",
});
