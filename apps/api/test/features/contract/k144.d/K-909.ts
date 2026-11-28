// 葉 K-909「ゲストが依頼に付ける添付を足す口（uploadPortalAttachment）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   道の値を持たない口なので uuid の行は無い。足すのは「準備」と、口を叩く時の体（必須の欄を 3 つ入れ、正しい形では 422 にならない）だけ。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/portal-attachment.ts。置き場は渡さない（共有の試験は入口の形・認証までを見る物で、ゲストの文脈には進まず置く所へ届かない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { Hook } from "../../../../src/contract/deps.js";
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    const m = (await import("../../../../src/hooks/portal-attachment.js")) as {
      portalAttachmentHooks: (p: typeof f.pool, objects: unknown) => Record<string, Hook>;
    };
    Object.assign(f.hooks, m.portalAttachmentHooks(f.pool, undefined));
  },
  BODIES: {
    uploadPortalAttachment: { name: "a.pdf", content_type: "application/pdf", data: "JVBERi0xLjQK" }, // K-909
  },
};
