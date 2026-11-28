// やり取りを読む口（K-383）の契約の口。振る舞いの本体は apps/api/src/features/F6/thread/timeline.ts。
//   最後に開いた時刻・書く・直す・消す・☆ の口は、それぞれの葉が自分の hooks のファイルを作る（このファイルに足さない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createListTicketTimeline } from "../features/F6/thread/timeline.js";
import { defineHooks } from "./registry.js";

export function ticketTimelineHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    listTicketTimeline: { before: createListTicketTimeline(appPool) },
  };
}

export const register = defineHooks({
  name: "ticketTimelineHooks",
  make: (d) => ticketTimelineHooks(d.appPool),
  fuzz: "same",
});
