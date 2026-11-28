// 葉 K-746「試し打ちの口（dryRunTicket）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 試し打ちの口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-746
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["dry-run"]); // K-746（試し打ちの口（dryRunTicket）：K144-API-984）
  },
  UUID_PARAM_CASES: [
    ["K144-API-984", "dryRunTicket", "path", "id"], // K-746
  ],
  BODIES: {
    dryRunTicket: {}, // K-746
  },
};
