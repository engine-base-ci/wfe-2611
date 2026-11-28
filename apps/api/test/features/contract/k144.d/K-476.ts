// 葉 K-476「検索条件を直す・消す（updateSavedView・deleteSavedView）」の葉のファイル（置き方は README.md・K-378）。
//   入口の uuid の行：道の値 id が uuid でなければ、口の振る舞いに入る前に 422（欄 id・理由 uuid）。
//   口の振る舞い（hooks）は、この葉の hooks のファイル apps/api/src/hooks/saved-views-edit.ts を準備で 1 回だけ動的 import で足す
//   （この葉が入った木にだけ在るファイル。範囲の地図は ci_scope.d/K-476.json の reads_ok）。正しい uuid の道は入口の行の確かめで 404 になり口に入らない。
//   行 ID は段 8 の枠 K144-API-8NN（K-476 は 876 と 866・K-477 は 877・段 7 は 700 台・段 9 は 900 台・本線と段 4 は 001〜072・801〜855 で重ならない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type pg from "pg";
import type { Hook } from "../../../../src/contract/deps.js";
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  setup: async (f) => {
    const m = (await import("../../../../src/hooks/saved-views-edit.js")) as {
      savedViewsEditHooks: (p: pg.Pool) => Record<string, Hook>;
    };
    Object.assign(f.hooks, m.savedViewsEditHooks(f.pool));
  },
  UUID_PARAM_CASES: [
    ["K144-API-876", "updateSavedView", "path", "id"],
    ["K144-API-866", "deleteSavedView", "path", "id"],
  ],
  BODIES: {
    updateSavedView: { name: "K144 の試験" },
  },
};
