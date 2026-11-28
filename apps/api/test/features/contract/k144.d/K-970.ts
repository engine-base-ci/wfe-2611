// 葉 K-970 の運営の口が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   統合の枝で入口の uuid の行が無かった（K144-SHAPE-017）ので足した（直しの担当 XC・PM の決め 2026-11-28）。
//   運営の口（auth: ops）は、本体の叩き手が運営の人（opsPerson）で叩く。体は必須の欄を入れた正しい形（正しい uuid では 422 にしない）
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    (await import("../../F3/leaf-hooks.js")).leafHooks(f, ["ops-stop"]); // K-970（K144-API-1323・1326）
  },
  UUID_PARAM_CASES: [
    ["K144-API-1323", "resumeWorkspace", "path", "id"], // K-970
    ["K144-API-1326", "stopWorkspace", "path", "id"], // K-970
  ],
  BODIES: {
    resumeWorkspace: {}, // K-970
    stopWorkspace: { reason_key: "request", mode: "now" }, // K-970
  },
};
