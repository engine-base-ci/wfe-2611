// AI に任せる（K-62）の契約の口。振る舞いの本体は apps/api/src/features/F5/delegate/（流れと操作ごとのフォルダ・D-128.130）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。getTicket は K-60 の詳細に can.delegate を足したもの
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { delegateHooks as make } from "../features/F5/delegate/index.js";

export function delegateHooks(appPool: pg.Pool): Record<string, Hook> {
  const h = make(appPool);
  return {
    delegateTicket: { ...h["delegateTicket"] },
    listTicketRuns: { ...h["listTicketRuns"] },
    getActionRun: { ...h["getActionRun"] },
    getTicket: { ...h["getTicket"] },
    takeBridgeJob: { ...h["takeBridgeJob"] },
    reportJobProgress: { ...h["reportJobProgress"] },
    getJobControl: { ...h["getJobControl"] },
    callKanameTool: { ...h["callKanameTool"] },
    finishBridgeJob: { ...h["finishBridgeJob"] },
  };
}
