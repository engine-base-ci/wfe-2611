// 葉 K-732「承認待ちを止める口（stopApproval）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 承認の残りの口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-732
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["approval-stop"]); // K-732（承認待ちを止める口（stopApproval）：K144-API-981）
  },
  UUID_PARAM_CASES: [
    ["K144-API-981", "stopApproval", "path", "id"], // K-732
  ],
  BODIES: {
    stopApproval: {}, // K-732
  },
};
