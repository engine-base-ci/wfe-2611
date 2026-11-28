// 葉 K-489「消したものを戻す口（restoreTicket）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 8 の戻す口は、葉ごとの hooks のファイルを最初の要求のときに 1 回だけ読む（準備で読まない）// K-489
    const { leafHooks } = await import("../../F3/leaf-hooks.js");
    leafHooks(f, ["ticket-restore"]); // K-489（戻す：K144-API-889）
  },
  UUID_PARAM_CASES: [
    ["K144-API-889", "restoreTicket", "path", "id"], // K-489
  ],
  BODIES: {
    restoreTicket: {}, // K-489
  },
};
