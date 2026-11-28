// 自分の AI に言う・止める口（K-758）の登録（K-326）。振る舞いの本体は apps/api/src/features/F5/talk/say.ts。
//   server.ts・fuzz の的には書かない（作り手 scripts/ci/gen_ts_registries.py が一覧 all.generated.ts に入れる）
import type { Hook } from "../contract/deps.js";
import { talkSayHooks as make } from "../features/F5/talk/say.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function talkSayHooks(d: HookDeps): Record<string, Hook> {
  const h = make(d.appPool);
  return {
    sendConversationMessage: { ...h["sendConversationMessage"] },
    stopConversation: { ...h["stopConversation"] },
  };
}

export const register = defineHooks({
  name: "talkSayHooks",
  make: (d) => talkSayHooks(d),
  fuzz: "same",
});
