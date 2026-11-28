// 段 11 の層の一覧の口（K-803・listLayers・GET /api/v1/layers）。足す・直す口（createLayer・updateLayer）は K-800 の f10-admin.ts が登録する。
//   振る舞いの本体は apps/api/src/features/F10/admin/layers/list.ts。権限（会社の人なら誰でも・read）は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { listLayers } from "../features/F10/admin/layers/list.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function f10LayersHooks(d: HookDeps): Record<string, Hook> {
  const list = (a: Parameters<typeof listLayers>[1]) => listLayers({ appPool: d.appPool }, a);
  return {
    listLayers: { before: list },
  };
}

export const register = defineHooks({ name: "f10LayersHooks", make: (d) => f10LayersHooks(d), fuzz: "same" });
