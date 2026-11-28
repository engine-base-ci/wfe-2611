// 葉 K-906「先方の画面を読む口（getPortalHome・getPortalTicket・listPortalNotices）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行 ID は段 12 の枠 K144-API-1200〜1299（K-906 は 1206 の 1 行。K-881 が 1281〜1282）。
//   入口の uuid の行（道の値 :id＝見せてもらったチケット）。体を受けない GET なので BODIES は持たない。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/portal-read.ts。最初の要求の前に 1 回だけ読む（本体の準備の中だけ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { Hook } from "../../../../src/contract/deps.js";
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    const m = (await import("../../../../src/hooks/portal-read.js")) as {
      portalReadHooks: (p: typeof f.pool) => Record<string, Hook>;
    };
    Object.assign(f.hooks, m.portalReadHooks(f.pool));
  },
  UUID_PARAM_CASES: [
    ["K144-API-1206", "getPortalTicket", "path", "id"], // K-906
  ],
};
