// 問い合わせに返事を書く・済みにする口（K-952）の契約の口 postInquiryMessage・resolveMyInquiry。振る舞いの本体は apps/api/src/features/F12/inquiries/reply.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type { Hook } from "../contract/deps.js";
import { createPostInquiryMessage, createResolveMyInquiry } from "../features/F12/inquiries/reply.js";
import { inquiryMissing } from "../features/F12/inquiries/errors.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function inquiryReplyHooks(d: HookDeps): Record<string, Hook> {
  return {
    postInquiryMessage: { before: createPostInquiryMessage(d.appPool), rowMissing: inquiryMissing },
    resolveMyInquiry: { before: createResolveMyInquiry(d.appPool), rowMissing: inquiryMissing },
  };
}

export const register = defineHooks({
  name: "inquiryReplyHooks",
  make: (d) => inquiryReplyHooks(d),
  fuzz: "same",
});
