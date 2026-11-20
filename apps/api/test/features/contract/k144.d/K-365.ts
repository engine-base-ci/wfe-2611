// 葉 K-365「もう一度確かめる仕事をその PC に宛てる口（checkMyDeviceBrowser）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行は、本体に印つきで書いていた物をそのまま移した（中身は変えていない。字下げと、手助けを読む道 ../F3 → ../../F3 だけ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["device-browser-check"]); // K-365（その PC に宛てる確かめ：K144-API-071）
  },
  UUID_PARAM_CASES: [
    ["K144-API-071", "checkMyDeviceBrowser", "path", "id"], // K-365
  ],
};
