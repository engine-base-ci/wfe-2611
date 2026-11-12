// 承認して完了する（K-63 の孫 K-161〜K-166）の契約の口の振る舞い。apps/api/src/server.ts の contract.hooks に足す。
//   K-161：読む口（listApprovalQueue・getApproval・queue.ts）。K-162：承認（approveApproval・decide.ts）。
//   差し戻し（K-163）と完了（K-165）は後の孫が同じ index.ts に足す
import type pg from "pg";
import type { Hook } from "../../../contract/deps.js";
import { decideHooks } from "./decide.js";
import { queueHooks } from "./queue.js";

export function approveHooks(pool: pg.Pool): Record<string, Hook> {
  return { ...queueHooks(pool), ...decideHooks(pool) };
}
