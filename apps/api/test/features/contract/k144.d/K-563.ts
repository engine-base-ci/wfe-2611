// 葉 K-563「会社が足す項目を読む口（listTicketFields）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   問い合わせの種別の id（kind_id）が uuid の形でなければ 422・欄 kind_id になる行。正しい uuid では 404 の道を回る（種別が無いので）。
//   行 ID は段 5 の枠 K144-API-500〜599 のうち 530 を取った（K-434＝520・521、K-435＝522・523、K-439〜K-441＝539〜543）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 会社の項目を読む口は、葉の hooks のファイルの register（K-326）を葉ごとの 1 行が自分の分だけ足す。最初の要求の前に 1 回だけ読む // K-563
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["ticket-fields-read"]); // K-563（読む：K144-API-530）
  },
  UUID_PARAM_CASES: [
    ["K144-API-530", "listTicketFields", "query", "kind_id"], // K-563
  ],
};
