// 承認して完了する（K-63 の孫 K-161〜K-166）の契約の口。振る舞いの本体は apps/api/src/features/F5/approve-complete/（流れと操作ごとのフォルダ・D-128.130）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。K-161 は読む口 2 本・K-162 は承認する
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { approveHooks as make } from "../features/F5/approve-complete/index.js";

export function approveHooks(appPool: pg.Pool): Record<string, Hook> {
  const h = make(appPool);
  return {
    listApprovalQueue: { ...h["listApprovalQueue"] },
    getApproval: { ...h["getApproval"] },
    approveApproval: { ...h["approveApproval"] },
  };
}
