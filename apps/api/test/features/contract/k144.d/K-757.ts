// 葉 K-757「会話の置き場と読む口（getConversation・listConversations・listConversationMessages）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 会話を読む口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-757
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["talk-read"]); // K-757（会話を読む口：K144-API-920・921）
  },
  UUID_PARAM_CASES: [
    ["K144-API-920", "getConversation", "path", "id"], // K-757
    ["K144-API-921", "listConversationMessages", "path", "id"], // K-757
  ],
};
