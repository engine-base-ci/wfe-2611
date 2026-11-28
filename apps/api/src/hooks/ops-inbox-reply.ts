// 運営が受信箱の問い合わせに返す口 replyOpsInquiry と社内メモの口 addOpsInquiryNote（K-975）の契約の口。
//   振る舞いの本体は apps/api/src/features/F12/ops/inbox-reply.ts。材料は appPool と repo（関門 C6 の証跡）だけ
import type { Hook } from "../contract/deps.js";
import { createAddOpsInquiryNote, createReplyOpsInquiry } from "../features/F12/ops/inbox-reply.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsInboxReplyHooks(d: Pick<HookDeps, "appPool" | "repo">): Record<string, Hook> {
  return {
    // 関数で書き、関門 C6 で問い合わせた本人に inapp を 1 通（1 取引・送れなければ戻す）
    replyOpsInquiry: { before: createReplyOpsInquiry({ appPool: d.appPool, repo: d.repo }), contractAtEntry: true },
    // 運営の中だけの社内メモ（鈴なし）
    addOpsInquiryNote: { before: createAddOpsInquiryNote(d.appPool), contractAtEntry: true },
  };
}

export const register = defineHooks({
  name: "opsInboxReplyHooks",
  make: (d) => opsInboxReplyHooks(d),
  // fuzz の的：replyOpsInquiry は外す（鈴を送る口・関門 C6。的に送り口を渡さない）。addOpsInquiryNote は本物と同じ
  fuzz: (d) => ({ addOpsInquiryNote: opsInboxReplyHooks(d).addOpsInquiryNote! }),
});
