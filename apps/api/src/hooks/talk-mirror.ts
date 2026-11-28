// PC の側の会話の写しと取り戻す先（K-760）の登録（K-326）。振る舞いの本体は apps/api/src/features/F5/talk/mirror.ts。
//   server.ts・fuzz の的には書かない（作り手 scripts/ci/gen_ts_registries.py が一覧 all.generated.ts に入れる）
import type { Hook } from "../contract/deps.js";
import { talkMirrorHooks as make } from "../features/F5/talk/mirror.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function talkMirrorHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  const h = make(d.appPool);
  return {
    mirrorConversationEntries: { ...h["mirrorConversationEntries"] },
    listMirrorTargets: { ...h["listMirrorTargets"] },
  };
}

export const register = defineHooks({
  name: "talkMirrorHooks",
  make: (d) => talkMirrorHooks(d),
  fuzz: "same",
});
