// 運営の人のできることを変える・外す口（K-1009・契約の口 updateOpsMemberCaps・removeOpsMember）。中身は apps/api/src/features/F12/ops/team-edit.ts。
//   上限・本人確認の取り直し（契約の step_up）・道の uuid・知らない欄は契約の入口（op.ts）が先に確かめる。材料は appPool だけ
import type { Hook } from "../contract/deps.js";
import { createRemoveOpsMember, createUpdateOpsMemberCaps } from "../features/F12/ops/team-edit.js";
import { defineHooks, type HookDeps } from "./registry.js";

export function opsTeamEditHooks(d: Pick<HookDeps, "appPool">): Record<string, Hook> {
  return {
    updateOpsMemberCaps: { before: createUpdateOpsMemberCaps(d.appPool) },
    removeOpsMember: { before: createRemoveOpsMember(d.appPool) },
  };
}

export const register = defineHooks({
  name: "opsTeamEditHooks",
  make: (d) => opsTeamEditHooks(d),
  fuzz: "same",
});
