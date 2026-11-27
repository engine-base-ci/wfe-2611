// 照合が使えなかった登録の回収（K-995）の契約の口。振る舞いの本体は apps/api/src/features/F12/ops/pwned.ts。
//   一覧（listOpsPwned）と確かめた（ackOpsPwned）。運営の人か・形・上限は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { createAckOpsPwned, createListOpsPwned } from "../features/F12/ops/pwned.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsPwnedHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    listOpsPwned: { before: createListOpsPwned(d.appPool) },
    ackOpsPwned: { before: createAckOpsPwned(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsPwnedHooks",
  make: (d) => opsPwnedHooks(d),
  fuzz: "same",
});
