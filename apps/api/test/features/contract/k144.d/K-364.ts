// 葉 K-364「AI が使うブラウザを選ぶ口（updateMyDevice）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行は、本体に印つきで書いていた物をそのまま移した（中身は変えていない。字下げと、手助けを読む道 ../F3 → ../../F3 だけ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 段 4 の PC の口も同じ：葉ごとの hooks のファイルを、葉ごとの 1 行が自分の分だけ足す（手助け leaf-hooks.ts は K-364 が運ぶ・最初の要求のときに 1 回だけ読む） // K-364
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["device-browser"]); // K-364（ブラウザを選ぶ：K144-API-070）
  },
  UUID_PARAM_CASES: [
    ["K144-API-070", "updateMyDevice", "path", "id"], // K-364
  ],
  BODIES: {
    updateMyDevice: { browser: "chrome" }, // K-364
  },
};
