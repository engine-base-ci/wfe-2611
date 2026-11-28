// チケットを作る画面の右の会話の口（K-774）の登録（K-326）。振る舞いの本体は apps/api/src/features/F5/talk/draft.ts。
//   server.ts・fuzz の的には書かない（作り手 scripts/ci/gen_ts_registries.py が一覧 all.generated.ts に入れる）
import type { Hook } from "../contract/deps.js";
import { draftTalkHooks as make } from "../features/F5/talk/draft.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function draftTalkHooks(d: HookDeps): Record<string, Hook> {
  const h = make(d.appPool);
  return {
    startDraftConversation: { ...h["startDraftConversation"] },
    sendDraftMessage: { ...h["sendDraftMessage"] },
  };
}

export const register = defineHooks({
  name: "draftTalkHooks",
  make: (d) => draftTalkHooks(d),
  fuzz: "same",
});
