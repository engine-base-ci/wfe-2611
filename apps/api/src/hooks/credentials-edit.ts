// 上書きと消す口（K-353）の契約の口。振る舞いの本体は apps/api/src/features/F3/credentials/update.ts・delete.ts。
//   一覧・預ける・PC が取り出す・ログインの確かめの口は、それぞれの葉が自分の hooks のファイルを持つ（このファイルに足さない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type { Hook } from "../contract/deps.js";
import { createDeleteCredential } from "../features/F3/credentials/delete.js";
import { createUpdateCredential } from "../features/F3/credentials/update.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function credentialsEditHooks(d: HookDeps): Record<string, Hook> {
  // d をそのまま渡す：env（d.config.env）と保管先が消えないか（d.secrets.durable）は要求ごとに読む
  return {
    updateCredential: { before: createUpdateCredential(d) },
    deleteCredential: { before: createDeleteCredential(d) },
  };
}

export const register = defineHooks({
  name: "credentialsEditHooks",
  make: (d) => credentialsEditHooks(d),
  fuzz: "same",
});
