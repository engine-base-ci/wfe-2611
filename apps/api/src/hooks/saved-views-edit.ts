// 保存した検索条件を直す・消す口（K-476）の契約の口 updateSavedView・deleteSavedView。
//   振る舞いの本体は apps/api/src/features/F7/saved-views/（update.ts・delete.ts。入力の確かめ・答えの形は K-475 の input.ts・shape.ts を使う）。
//   保存・一覧（K-475）は hooks/saved-views.ts が持つ（同じ口を 2 つの hooks が持つと registry が止めるので、このファイルは別にした）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createDeleteSavedView } from "../features/F7/saved-views/delete.js";
import { createUpdateSavedView, input } from "../features/F7/saved-views/update.js";
import { defineHooks } from "./registry.js";

export function savedViewsEditHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    updateSavedView: { input, before: createUpdateSavedView(appPool) },
    deleteSavedView: { before: createDeleteSavedView(appPool) },
  };
}

export const register = defineHooks({
  name: "savedViewsEditHooks",
  make: (d) => savedViewsEditHooks(d.appPool),
  fuzz: "same",
});
