// 最後にやり取りを開いた時刻を書く口（K-384）の契約の口。振る舞いの本体は apps/api/src/features/F6/thread/seen.ts。
//   読む口（listTicketTimeline）は K-383 の ticket-timeline.ts。書く・直す・消す・☆ の口はそれぞれの葉が自分の hooks のファイルを作る
import type pg from "pg";
import type { Hook } from "../contract/deps.js";
import { createMarkTicketTimelineSeen } from "../features/F6/thread/seen.js";
import { defineHooks } from "./registry.js";

export function ticketTimelineSeenHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    markTicketTimelineSeen: { before: createMarkTicketTimelineSeen(appPool) },
  };
}

export const register = defineHooks({
  name: "ticketTimelineSeenHooks",
  make: (d) => ticketTimelineSeenHooks(d.appPool),
  fuzz: "same",
});
