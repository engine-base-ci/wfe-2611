// 自分の顔の写真の契約の口（K-834）：uploadAvatar（D-154.57）。振る舞いの本体は apps/api/src/features/F10/me/avatar.ts。
//   体は入口の multipart の道（K-828）で読む：ファイルは 5 MB まで（体の先は入口が 64 KB の余白つきで見る・超えたら 413・E-ME-010）。
//   strict の形の対象外で、口が a.form を見る
import type { Hook } from "../contract/deps.js";
import { AVATAR_MAX_BYTES, avatarTooLarge, createUploadAvatar } from "../features/F10/me/avatar.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function meAvatarHooks(d: HookDeps): Record<string, Hook> {
  return {
    uploadAvatar: {
      multipart: { maxFileBytes: AVATAR_MAX_BYTES, tooLarge: avatarTooLarge },
      before: createUploadAvatar(d),
    },
  };
}

export const register = defineHooks({
  name: "meAvatarHooks",
  make: (d) => meAvatarHooks(d),
  fuzz: "same",
});
