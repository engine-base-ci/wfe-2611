// 葉 K-742「自分で直す口（editApproval）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 承認の残りの口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-742
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["approval-edit"]); // K-742（自分で直す口（editApproval）：K144-API-983）
  },
  UUID_PARAM_CASES: [
    ["K144-API-983", "editApproval", "path", "id"], // K-742
  ],
  BODIES: {
    editApproval: { text: "直した成果物", version: 1 }, // K-742
  },
};
