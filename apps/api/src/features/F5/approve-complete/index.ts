// 承認して完了する（K-63 の孫 K-161〜K-166）の契約の口の振る舞い。apps/api/src/server.ts の contract.hooks に足す。
//   K-161：読む口（listApprovalQueue・getApproval・queue.ts）。K-162：承認（approveApproval・decide.ts）。
//   K-163：差し戻し（returnApproval・decide.ts）。K-165：完了（completeTicket・complete.ts）
import type pg from "pg";
import type { Hook } from "../../../contract/deps.js";
import { completeHooks } from "./complete.js";
import { decideHooks } from "./decide.js";
import { queueHooks } from "./queue.js";

export function approveHooks(pool: pg.Pool): Record<string, Hook> {
  return { ...queueHooks(pool), ...decideHooks(pool), ...completeHooks(pool) };
}
