// 承認して完了する（K-63 の孫 K-161〜K-166）の契約の口。振る舞いの本体は apps/api/src/features/F5/approve-complete/（流れと操作ごとのフォルダ・D-128.130）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。K-161 は読む口 2 本・K-162 は承認する・K-163 は差し戻す・K-165 は完了にする
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { approveHooks as make } from "../features/F5/approve-complete/index.js";
import { defineHooks } from "./registry.js";

export function approveHooks(appPool: pg.Pool): Record<string, Hook> {
  const h = make(appPool);
  return {
    listApprovalQueue: { ...h["listApprovalQueue"] },
    getApproval: { ...h["getApproval"] },
    approveApproval: { ...h["approveApproval"] },
    returnApproval: { ...h["returnApproval"] },
    completeTicket: { ...h["completeTicket"] },
  };
}

export const register = defineHooks({
  name: "approveHooks",
  make: (d) => approveHooks(d.appPool),
  fuzz: "same",
});
