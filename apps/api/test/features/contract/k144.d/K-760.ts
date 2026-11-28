// 葉 K-760「PC の側：会話の写しを送る・取り戻す先」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 口の登録は葉の hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-760
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["talk-mirror"]); // K-760（会話の写しを送る口：K144-API-925）
  },
  UUID_PARAM_CASES: [
    ["K144-API-925", "mirrorConversationEntries", "path", "id"], // K-760
  ],
  BODIES: {
    mirrorConversationEntries: { entries: [{ uuid: "0000000a-aaaa-bbbb-cccc-000000000000", text: "写す文" }] }, // K-760
  },
};
