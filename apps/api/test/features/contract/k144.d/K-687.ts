// 葉 K-687「上の棚に上げる」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   入口の uuid の行：道の値 id が uuid でなければ、口の振る舞いに入る前に 422（欄 id・理由 uuid）。入口の uuid の確かめは 501 より前なので、
//   口の振る舞い（hooks）がまだ無くても確かめられる（だから setup は要らない）。道に :id を持つ 3 本の行を、この葉が持つ。
//   行 ID は段 10 の枠 K144-API-100〜149 のうち、K-687 の枠 120〜129（土台 5 章）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 正しい uuid の行は口の振る舞いまで進む（hooks が無いと 501＝契約の並びに無い）。葉ごとの hooks のファイルの register（K-326）を 1 回だけ読む // K-687
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["f9-knowledge-raise"]); // K-687
  },
  UUID_PARAM_CASES: [
    ["K144-API-120", "requestKnowledgeRaise", "path", "id"], // K-687
    ["K144-API-121", "withdrawKnowledgeRequest", "path", "id"], // K-687
    ["K144-API-122", "dismissKnowledgeRequest", "path", "id"], // K-687
  ],
  BODIES: {
    requestKnowledgeRaise: {}, // K-687
    dismissKnowledgeRequest: {}, // K-687
  },
};
