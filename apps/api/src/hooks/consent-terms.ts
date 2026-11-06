// 規約に同意する（K-53）の契約の口の振る舞い。中身は apps/api/src/features/F1/consent-terms/。上限・認証・同意し直しの止めは契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { consentTermsFeature, parseConsent, type ConsentTermsDeps } from "../features/F1/consent-terms/index.js";

export function consentTermsHooks(d: ConsentTermsDeps): Record<string, Hook> {
  const f = consentTermsFeature(d);
  return {
    consentToTerms: { input: parseConsent, before: f.consent },
    getCurrentTerms: { before: f.current },
  };
}
