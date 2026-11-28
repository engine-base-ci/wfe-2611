// 会社のロゴを変える契約の口（K-828）：uploadWorkspaceLogo（D-154.4）。振る舞いの本体は apps/api/src/features/F10/workspace/logo.ts。
//   体は契約の入口の multipart の道で読まれる（2 MB ＋ 余白までをバイトのまま・strict の形の対象外）。口は a.form を見る
import type { Hook } from "../contract/deps.js";
import { createUploadWorkspaceLogo, LOGO_MAX_BYTES, logoTooLarge } from "../features/F10/workspace/logo.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function workspaceLogoHooks(d: HookDeps): Record<string, Hook> {
  return {
    uploadWorkspaceLogo: {
      multipart: { maxFileBytes: LOGO_MAX_BYTES, tooLarge: logoTooLarge },
      before: createUploadWorkspaceLogo(d),
    },
  };
}

export const register = defineHooks({
  name: "workspaceLogoHooks",
  make: (d) => workspaceLogoHooks(d),
  fuzz: "same",
});
