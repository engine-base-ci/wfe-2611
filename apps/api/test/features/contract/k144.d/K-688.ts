// 葉 K-688「承認待ちを読む・承認する・断る」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   入口の uuid の行：道の値 id が uuid でなければ、口の振る舞いに入る前に 422（欄 id・理由 uuid）。道に :id を持つ 2 本の行を、この葉が持つ
//   （承認待ちを読む口は道に id を持たない）。行 ID は段 10 の枠 K144-API-100〜149 のうち、K-688 の枠 130〜139（土台 5 章）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    // 正しい uuid の行は口の振る舞いまで進む（hooks が無いと 501＝契約の並びに無い）。葉ごとの hooks のファイルの register（K-326）を 1 回だけ読む // K-688
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["f9-knowledge-approvals"]); // K-688
  },
  UUID_PARAM_CASES: [
    ["K144-API-130", "approveKnowledgeRequest", "path", "id"], // K-688
    ["K144-API-131", "declineKnowledgeRequest", "path", "id"], // K-688
  ],
  BODIES: {
    approveKnowledgeRequest: {}, // K-688
    declineKnowledgeRequest: { reason: "理由" }, // K-688
  },
};
