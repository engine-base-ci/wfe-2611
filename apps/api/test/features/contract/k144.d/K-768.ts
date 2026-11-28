// 葉 K-768「まとめて承認の口（previewBulkApproval・bulkApprove）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。uuid の行は無い（id は体の並びの中だけで、道すじ・問い合わせの uuid は持たない）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // まとめて承認の口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-768
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["approval-bulk"]); // K-768（まとめて承認の口：確かめ・承認）
  },
  BODIES: {
    previewBulkApproval: {}, // K-768
    bulkApprove: { approval_ids: ["00000000-0000-4000-8000-000000000768"] }, // K-768
  },
};
