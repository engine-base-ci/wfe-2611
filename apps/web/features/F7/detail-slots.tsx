"use client";
// 段 8（F7）の詳細の差し込み口の入口（K-599）。ここは書き出しだけ（定義を置かない）。後ろの葉は自分の区画のファイルだけを直す。
//   入れる所と本物にする葉：DueSlot（detail-panel.tsx の「期限を変える」）→ K-484／MoreMenuSlot（detail-head.tsx の「…」）→ K-590／
//     StoppedHandSlot（delegate-band.tsx の止まった箱ぜんたい）→ K-486
export { DueSlot } from "./due/due-slot";
export { MoreMenuSlot } from "./delete/more-menu-slot";
export { StoppedHandSlot } from "./stopped/stopped-hand-slot";
