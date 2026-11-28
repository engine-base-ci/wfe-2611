// 段 8 の一覧の差し込み口の入口（K-600）。定義は置かず、区画のファイルから書き出すだけ。読む側は `import * as F7 from "@/features/F7/list-slots"`。
//   入れる所と本物にする葉：
//     OverviewSlot・CalendarSlot・GanttSlot …… list-page.tsx の本体（?view=overview｜calendar｜gantt）。K-480・K-481・K-482
//     viewReady …… list-views.tsx のタブ・tickets-page.tsx の ?view= の読み（区画の READY を読む）
//     DueMarkSlot …… list-table.tsx の期限セルの炎。K-478
//     NumberCardsSlot・MineChipsSlot …… list-page.tsx の自分に関わるものの数の札と絞りの行。K-478
//   どれも入れた時点では中身（children）をそのまま返すか null（今の見た目と操作のまま）
export { OverviewSlot, viewReady, type F7View, type OverviewSlotProps } from "./overview/overview-slot";
export { CalendarSlot, type CalendarSlotProps } from "./calendar/calendar-slot";
export { GanttSlot, type GanttSlotProps } from "./gantt/gantt-slot";
export { DueMarkSlot, type DueMarkSlotProps } from "./due/due-mark-slot";
export { NumberCardsSlot, type NumberCardsSlotProps } from "./due/number-cards-slot";
export { MineChipsSlot, type MineChipsSlotProps } from "./due/mine-chips-slot";
