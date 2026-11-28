// 預けたログイン情報の一覧（K-351）の契約の口。振る舞いの本体は apps/api/src/features/F3/credentials/list.ts。
//   預ける・上書きと消す・PC が取り出す・ログインの確かめの口は、それぞれの葉が自分の hooks のファイルを作る（このファイルに足さない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type { Hook } from "../contract/deps.js";
import { createListCredentials } from "../features/F3/credentials/list.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function credentialsListHooks(d: HookDeps): Record<string, Hook> {
  return {
    listCredentials: { before: createListCredentials(d.appPool) },
  };
}

export const register = defineHooks({
  name: "credentialsListHooks",
  make: (d) => credentialsListHooks(d),
  fuzz: "same",
});
