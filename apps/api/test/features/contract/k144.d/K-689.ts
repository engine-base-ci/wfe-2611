// 葉 K-689「グループを選んで共有」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   入口の uuid の行：問い合わせの値 page_id・folder_id が uuid でなければ、口の振る舞いに入る前に 422（欄 page_id か folder_id・理由 uuid）。
//   書く口 setKnowledgeShares は道にも問い合わせにも id を持たない（体の欄の uuid は契約の形の検査が見る）ので、行は読む口の 2 つ。
//   行 ID は段 10 の枠 K144-API-100〜149 のうち、K-689 の枠 140〜149（土台 5 章）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 正しい uuid の行は口の振る舞いまで進む（hooks が無いと 501＝契約の並びに無い）。葉ごとの hooks のファイルの register（K-326）を 1 回だけ読む // K-689
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["f9-knowledge-shares"]); // K-689
  },
  UUID_PARAM_CASES: [
    ["K144-API-140", "getKnowledgeShares", "query", "page_id"], // K-689
    ["K144-API-141", "getKnowledgeShares", "query", "folder_id"], // K-689
  ],
};
