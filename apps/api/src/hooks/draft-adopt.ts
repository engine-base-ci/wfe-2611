// 作った後に会話をチケットへ移す口（K-776）の登録（K-326）。振る舞いの本体は apps/api/src/features/F5/talk/adopt.ts。
//   server.ts・fuzz の的には書かない（作り手 scripts/ci/gen_ts_registries.py が一覧 all.generated.ts に入れる）
import type { Hook } from "../contract/deps.js";
import { draftAdoptHooks as make } from "../features/F5/talk/adopt.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function draftAdoptHooks(d: HookDeps): Record<string, Hook> {
  const h = make(d.appPool);
  return { adoptDraftConversation: { ...h["adoptDraftConversation"] } };
}

export const register = defineHooks({
  name: "draftAdoptHooks",
  make: (d) => draftAdoptHooks(d),
  fuzz: "same",
});
