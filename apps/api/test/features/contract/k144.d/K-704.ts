// 葉 K-704「種別を足す・直す・並べる・消す」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   道の値 :id が uuid の形でなければ 422 になる行（直す口・消す口）。行 ID は段 10 の枠 K144-API-970〜979 のうち 970・971 を取った（K-705＝972・973、K-706＝974〜976）。
//   テストはチケットを作る人が書き、実装する人は変えない。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 種別を書く口の振る舞い（葉の hooks のファイルの register・K-326）を、最初の要求の前に 1 回だけ読む // K-704
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["ticket-kinds-write"]); // K-704
  },
  UUID_PARAM_CASES: [
    ["K144-API-970", "updateTicketKind", "path", "id"], // K-704
    ["K144-API-971", "deleteTicketKind", "path", "id"], // K-704
  ],
};
