// 葉 K-907「依頼を出す・グループの依頼を読む口（createPortalRequest・getPortalRequest）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行 ID は段 12 の枠 K144-API-1200〜1299（K-907 は 1207 の 1 行）。
//   入口の uuid の行（道の値 :id＝依頼）と、出す口を叩く時の体（必須の欄 body を入れ、正しい形では 422 にならない）。口の振る舞いは葉の hooks のファイル apps/api/src/hooks/portal-request.ts。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { Hook } from "../../../../src/contract/deps.js";
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    const m = (await import("../../../../src/hooks/portal-request.js")) as {
      portalRequestHooks: (p: typeof f.pool) => Record<string, Hook>;
    };
    Object.assign(f.hooks, m.portalRequestHooks(f.pool));
  },
  UUID_PARAM_CASES: [
    ["K144-API-1207", "getPortalRequest", "path", "id"], // K-907
  ],
  BODIES: {
    createPortalRequest: { body: "報告書をください" }, // K-907
  },
};
