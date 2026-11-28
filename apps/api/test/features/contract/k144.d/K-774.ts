// 葉 K-774「作る画面の会話の口（startDraftConversation・sendDraftMessage）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 話す口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-774
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["draft-talk"]); // K-774（作る画面の会話の口：K144-API-929）
  },
  UUID_PARAM_CASES: [
    ["K144-API-929", "sendDraftMessage", "path", "id"], // K-774
  ],
  BODIES: {
    startDraftConversation: {}, // K-774
    sendDraftMessage: { text: "題を考えたい", draft: { title: "", body: "", checks: [] } }, // K-774
  },
};
