// AI に任せる（K-62）の契約の口の振る舞い。人が呼ぶ口は people.ts、PC が呼ぶ口は bridge.ts（取る・様子・合図・終わる）と tools.ts（道具）。
//   チケットの詳細（getTicket）に can.delegate を足すので、チケットを作る（K-60）の口の振る舞いも一緒に返す（上書きするのは getTicket だけ）
import type pg from "pg";
import type { Hook } from "../../../contract/deps.js";
import { createTicketHooks } from "../../F4/create-ticket/hooks.js";
import { bridgeJobHooks } from "./bridge.js";
import { peopleHooks } from "./people.js";
import { toolHooks } from "./tools.js";

export function delegateHooks(pool: pg.Pool): Record<string, Hook> {
  const tickets = createTicketHooks(pool);
  return { ...tickets, ...peopleHooks(pool, tickets), ...bridgeJobHooks(pool), ...toolHooks(pool) };
}
