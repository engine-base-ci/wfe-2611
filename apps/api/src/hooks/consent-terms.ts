// 規約に同意する（K-53）の契約の口の振る舞い。中身は apps/api/src/features/F1/consent-terms/。上限・認証・同意し直しの止めは契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { consentTermsFeature, parseConsent, type ConsentTermsDeps } from "../features/F1/consent-terms/index.js";
import { defineHooks } from "./registry.js";

export function consentTermsHooks(d: ConsentTermsDeps): Record<string, Hook> {
  const f = consentTermsFeature(d);
  return {
    consentToTerms: { input: parseConsent, before: f.consent },
    getCurrentTerms: { before: f.current },
  };
}

// 契約 fuzz の的からは外す（理由は skip に書く・scripts/ci/fuzz_targets.py が理由の空を赤にする）
export const register = defineHooks({
  name: "consentTermsHooks",
  make: (d) => consentTermsHooks({ appPool: d.appPool }),
  fuzz: {
    skip: "同意し直しは Better Auth のセッションの印に頼り、偽のセッションの的では回せない。口の振る舞いは K-53 の試験が持つ",
  },
});
