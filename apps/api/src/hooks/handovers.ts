// 段 9「渡す・配る」の契約の口（K-401）。振る舞いの本体は apps/api/src/features/F8/handovers/。
//   足す口（listTicketHandovers・withdraw・remind・claim）は、それぞれの葉（K-405・K-406・K-410）が自分の hooks のファイルを作る（このファイルに足さない）。
//   上限・道の値の形・入口の行の確かめ（row_rules.mjs）は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { handoverFeature, type HandoverDeps } from "../features/F8/handovers/index.js";
import { defineHooks } from "./registry.js";

export function handoverHooks(d: HandoverDeps): Record<string, Hook> {
  const f = handoverFeature(d);
  return {
    // 渡す（引き継いでもらう・申し出る・配る）。入力 → 共通の確かめ → 種類ごとのファイル（K-402・K-408・K-409・K-410）
    createTicketHandover: { before: f.create },
    // 答える（受ける・断る）。答える人だけ（app.handover_answerer）。種類ごとのファイル（K-403・K-408・K-409・K-410）
    answerTicketHandover: { before: f.answer },
    // 渡す前の下見（読むだけ・1 取引・文 1 つ）
    previewTicketHandover: { before: f.preview },
    // 渡すときに一緒に切り替えるものの決まり（読むだけ）
    listHandoverRules: { before: f.rules },
  };
}

export const register = defineHooks({
  name: "handoverHooks",
  make: (d) =>
    handoverHooks({
      appPool: d.appPool,
      ...(d.mailer ? { mailer: d.mailer } : {}),
      config: { webBaseUrl: d.config.webBaseUrl ?? "" },
    }),
  fuzz: "same",
});
