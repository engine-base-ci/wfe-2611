// 預けた後のログインの確かめの口（K-355）の契約の口。振る舞いの本体は apps/api/src/features/F3/credentials/login-check.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type { Hook } from "../contract/deps.js";
import { createLoginCheckHooks } from "../features/F3/credentials/login-check.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function credentialsCheckHooks(d: HookDeps): Record<string, Hook> {
  const h = createLoginCheckHooks({ appPool: d.appPool });
  return {
    checkCredentialLogin: { before: h.check },
    // 体に 2 段階のコードが入る・PC への答えにコードが入るので、冪等の器に体の要約も答えも残さない（1 回だけ渡す）
    answerCredentialLoginCheck: { before: h.answer, noIdempotency: true },
    reportCredentialCheck: { before: h.report, noIdempotency: true },
  };
}

export const register = defineHooks({
  name: "credentialsCheckHooks",
  make: (d) => credentialsCheckHooks(d),
  fuzz: "same",
});
