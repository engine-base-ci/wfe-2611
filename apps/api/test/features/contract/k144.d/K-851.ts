// 葉 K-851「会社を切り替える（switchWorkspace）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   統合の枝で入口の uuid の行が無かった（K144-SHAPE-017）ので足した（直しの担当 XC・PM の決め 2026-11-28）。
//   共有の試験のログインは偽（Bearer）で、ログインの部品（auth）の本物のセッションは無い。土台の leafHooks は appPool しか渡さず、
//   口が auth を読めずに 503 になっていた。ここでは「部品のセッションが無い」auth を渡し、口の答えは 401（契約どおり）になる。
//   無い会社が 404 になるのは本物のログインの上の K851-API-003（apps/api/test/features/F10/me-switch.test.ts）
import type { HookDeps } from "../../../../src/hooks/registry.js";
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    const m = await import("../../../../src/hooks/me-switch.js"); // K-851（道の値 id：K144-API-1301）
    const noSession = { api: { getSession: async () => null } };
    Object.assign(f.hooks, m.register.make({ appPool: f.pool, auth: noSession } as unknown as HookDeps));
  },
  UUID_PARAM_CASES: [
    ["K144-API-1301", "switchWorkspace", "path", "id"], // K-851
  ],
  BODIES: {
    switchWorkspace: {}, // K-851
  },
};
