// 葉 K-837「知らせの設定（getNotificationSettings）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   統合の枝で入口の uuid の行が無かった（K144-SHAPE-017）ので足した（直しの担当 XC・PM の決め 2026-11-28）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 葉ごとの hooks のファイルの register（K-326）。最初の要求の前に 1 回だけ読む // K-837
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["me-notify"]); // K-837（問い合わせ workspace_id：K144-API-1299）
  },
  UUID_PARAM_CASES: [
    ["K144-API-1299", "getNotificationSettings", "query", "workspace_id"], // K-837
  ],
};
