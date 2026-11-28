// 預ける口（K-352）の契約の口。振る舞いの本体は apps/api/src/features/F3/credentials/create.ts。
//   一覧・上書きと消す・PC が取り出す・ログインの確かめの口は、それぞれの葉が自分の hooks のファイルを持つ（このファイルに足さない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type { Hook, HookReply } from "../contract/deps.js";
import { createCreateCredential } from "../features/F3/credentials/create.js";
import { fail } from "../features/F3/credentials/input.js";
import { defineHooks, type HookDeps } from "./registry.js";

/** 前処理：使える場所が並びでない体は、契約の形の確かめ（欄の型）より前に「使える場所を入れてください」で断る（無い・空と同じ答え・E-CRED-003）。
 *  体はそのまま返す（欄を落とさない。知らない欄は入口の strict な形が 422 にする） */
const input = (raw: unknown): { input: Record<string, unknown> } | { reply: HookReply } => {
  const b = raw as Record<string, unknown> | null;
  if (b && typeof b === "object" && !Array.isArray(b) && "destinations" in b && !Array.isArray(b["destinations"]))
    return { reply: fail("E-CRED-003", "destinations") };
  return { input: raw as Record<string, unknown> };
};

export function credentialsCreateHooks(d: HookDeps): Record<string, Hook> {
  // d をそのまま渡す：env（d.config.env）と保管先が消えないか（d.secrets.durable）は要求ごとに読む
  return {
    // 体に秘密（パスワード・鍵の値）が入るので、冪等の器に体の要約も答えも残さない（パスワードを受けるほかの口と同じ）。
    //   二度押しは同じ名前の 409（E-CRED-006）で止まる
    createCredential: { input, before: createCreateCredential(d), noIdempotency: true },
  };
}

export const register = defineHooks({
  name: "credentialsCreateHooks",
  make: (d) => credentialsCreateHooks(d),
  fuzz: "same",
});
