// メールを変える口（K-835）の契約の口：requestEmailChange・verifyEmailChange。振る舞いの本体は apps/api/src/features/F10/me/email.ts。
//   頼む口は契約の stepUp: always（取り直しが直前 15 分の内でなければ入口が 403）。宛ての形は前処理（inputEmailChange）が 422・E-ME-020 にする
import type { Hook } from "../contract/deps.js";
import { inputEmailChange, meEmailFeature, type MeEmailDeps } from "../features/F10/me/email.js";
import { defineHooks } from "./registry.js";

export function meEmailHooks(d: MeEmailDeps): Record<string, Hook> {
  const f = meEmailFeature(d);
  return {
    requestEmailChange: { input: inputEmailChange, before: f.request },
    verifyEmailChange: { before: f.verify },
  };
}

export const register = defineHooks({
  name: "meEmailHooks",
  make: (d) => meEmailHooks({ appPool: d.appPool, ...(d.mailer ? { mailer: d.mailer } : {}), config: d.config }),
  fuzz: { skip: "メールを送る口は的に差さない（外へ出る）" },
});
