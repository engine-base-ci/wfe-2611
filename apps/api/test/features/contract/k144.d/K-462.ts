// 葉 K-462「既読にする・全部既読にする（readNotification・readAllNotifications）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 最初の要求の前に 1 回だけ読む（準備で読まない）。正しい uuid は無い行なので 404 の道を回る // K-462
    (await import("../../F7/notify.harness.js")).addNotifyLeafHooks(f, "notifications-read"); // K-462（既読：K144-API-862）
  },
  UUID_PARAM_CASES: [
    ["K144-API-862", "readNotification", "path", "id"], // K-462
  ],
  BODIES: {
    readNotification: { read: true }, // K-462
  },
};
