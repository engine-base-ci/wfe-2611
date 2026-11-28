// 片付ける（F7・段 8）の画面の部品の入口（切る段の下絵・部品先行・枝 c/段8）。口とはまだつながず、値を受け取って描くだけ。
//   本番では葉（K-478 絞る・K-484 期限を変える）が、データと動きをつなぐ。値は正本のトークン（due.css）だけ。
import "./due.css";

export { DueMark, LateMark, StuckMark, StuckUpButton, type DueMarkProps } from "./due-mark";
export { DuePopover, type DuePopoverProps, type DueQuick } from "./due-popover";
export { MineChips, NumberCards, type MineChip, type NumberCard, type NumberCardsProps } from "./number-cards";
