// 会話を読む 3 つの口（K-757）の登録（K-326）。振る舞いの本体は apps/api/src/features/F5/talk/read.ts。
//   server.ts・fuzz の的には書かない（作り手 scripts/ci/gen_ts_registries.py が一覧 all.generated.ts に入れる）
import type { Hook } from "../contract/deps.js";
import { talkReadHooks as make } from "../features/F5/talk/read.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function talkReadHooks(d: HookDeps): Record<string, Hook> {
  const h = make(d.appPool);
  return {
    listConversations: { ...h["listConversations"] },
    getConversation: { ...h["getConversation"] },
    listConversationMessages: { ...h["listConversationMessages"] },
  };
}

export const register = defineHooks({
  name: "talkReadHooks",
  make: (d) => talkReadHooks(d),
  fuzz: "same",
});
