// 葉 K-988 の運営の口が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   統合の枝で入口の uuid の行が無かった（K144-SHAPE-017）ので足した（直しの担当 XC・PM の決め 2026-11-28）。
//   運営の口（auth: ops）は、本体の叩き手が運営の人（opsPerson）で叩く。体は必須の欄を入れた正しい形（正しい uuid では 422 にしない）
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["ops-plans-write"]); // K-988（K144-API-1327・1331）
  },
  UUID_PARAM_CASES: [
    ["K144-API-1327", "submitPlanProposal", "path", "id"], // K-988
    ["K144-API-1331", "updatePlanProposal", "path", "id"], // K-988
  ],
  BODIES: {
    submitPlanProposal: {}, // K-988
    updatePlanProposal: { reason: "理由を直す" }, // K-988
  },
};
