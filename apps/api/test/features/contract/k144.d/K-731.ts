// 葉 K-731「止める口（stopActionRun）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 止める口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない・まだ無いファイルで準備ごと落とさないため）// K-731
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["run-stop"]); // K-731（止める：K144-API-980）
  },
  UUID_PARAM_CASES: [
    ["K144-API-980", "stopActionRun", "path", "id"], // K-731
  ],
  BODIES: {
    stopActionRun: {}, // K-731
  },
};
