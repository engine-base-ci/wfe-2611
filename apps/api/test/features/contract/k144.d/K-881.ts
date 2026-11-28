// 葉 K-881「チケットの見せる相手を読む・付け外しする口（listTicketGuestShares・updateTicketGuestShares）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行 ID は段 12 の枠 K144-API-1200〜1299（葉ごと：K-881 1281〜1282。本線と段 4 は 001〜072・801〜855・段 7 は 700 台・段 9 は 900 台で重ならない）。
//   入口の uuid の行（道の値 :id＝チケット）と、付け外す口を叩く時の体（必須の欄 add を 1 つ入れ、正しい uuid では 422 にならない形。無いチケットは 404）。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/ticket-guest-shares.ts。最初の要求の前に 1 回だけ読む（本体の準備の中だけ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { Hook } from "../../../../src/contract/deps.js";
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    const m = (await import("../../../../src/hooks/ticket-guest-shares.js")) as {
      ticketGuestShareHooks: (p: typeof f.pool) => Record<string, Hook>;
    };
    Object.assign(f.hooks, m.ticketGuestShareHooks(f.pool));
  },
  UUID_PARAM_CASES: [
    ["K144-API-1281", "listTicketGuestShares", "path", "id"], // K-881
    ["K144-API-1282", "updateTicketGuestShares", "path", "id"], // K-881
  ],
  BODIES: {
    updateTicketGuestShares: { add: ["3b6f3a52-6f0e-4c1c-8a0e-5d2b1c9e4f10"] }, // K-881
  },
};
