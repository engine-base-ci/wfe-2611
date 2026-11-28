// 葉 K-758「言う・止める口（sendConversationMessage・stopConversation）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 言う・止める口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-758
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["talk-say"]); // K-758（言う・止める口：K144-API-922・923）
  },
  UUID_PARAM_CASES: [
    ["K144-API-922", "sendConversationMessage", "path", "id"], // K-758
    ["K144-API-923", "stopConversation", "path", "id"], // K-758
  ],
  BODIES: {
    sendConversationMessage: { text: "見積を確かめて" }, // K-758
  },
};
