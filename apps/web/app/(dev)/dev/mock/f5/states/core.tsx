"use client";
// 段 6 core（チケットの詳細・承認待ち）の下絵の状態。詳細の側は core-ticket.tsx・承認待ちの側は core-queue.tsx。
//   部品は features/F5/more/。1 つの id ＝ 1 つの状態。
import type { Theme } from "@/lib/theme";
import type { MockGroup } from "../types";
import { queueView } from "./core-queue";
import { ticketView } from "./core-ticket";

export const CORE: MockGroup = {
  view: (id: string, theme: Theme) => ticketView(id, theme) ?? queueView(id, theme),
};
