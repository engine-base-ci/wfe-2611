// 依頼を書く間に分身が聞く契約の口（K-910）：askPortalRequestQuestions。振る舞いの本体は apps/api/src/features/F11/portal/questions.ts。
//   待つ時間（waitMs・既定 10 秒）と見る間隔（pollMs・既定 250 ミリ秒）は試験が短い値を渡す
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createAskPortalRequestQuestions } from "../features/F11/portal/questions.js";
import { defineHooks } from "./registry.js";

export function portalQuestionsHooks(
  appPool: pg.Pool,
  o: { waitMs?: number; pollMs?: number } = {},
): Record<string, Hook> {
  return {
    askPortalRequestQuestions: { before: createAskPortalRequestQuestions(appPool, o) },
  };
}

export const register = defineHooks({
  name: "portalQuestionsHooks",
  make: (d) => portalQuestionsHooks(d.appPool),
  fuzz: "same",
});
