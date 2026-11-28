// 止める口 stopActionRun（K-731）を呼ぶ 1 か所（K-734：止める口は features/F5/stop/ からだけ呼ぶ）。
//   画面の部品（帯の stop-run.tsx・片付けに失敗した帯の sweep-failed.tsx〈K-1192〉）はここを通して呼ぶ
import { call } from "@/lib/api/call";

/** 実行を 1 つ止める（体は空）。答えはそのまま返す（成功・断りの出し分けは呼んだ側） */
export function callStopRun(runId: string, screenId = "tickets") {
  return call("stopActionRun", { params: { id: runId }, body: {}, screenId });
}
