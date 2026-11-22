// 段 7（F6 自分で進める・話す・決める）がチケットの詳細に中身を足す差し込み口の先（K-380 が置き、K-382 が区画のファイルへ配る）。
//   ここは書き出しだけ。名前と受ける物は K-380 の約束のまま。後ろの画面の葉は自分の区画のファイルだけを直す（ここは触らない）。
//   scope.tsx（区画をまたぐ状態）・progress/slot.tsx（段・保留・予定・実績・K-395）・decisions/slot.tsx（決定ログ・K-397）・
//   thread/panel.tsx（パネルのタブと題名の下・K-392）・prefetch.ts（詳細と同時の先読み）
export { DetailScope } from "./scope";
export { StageSlot, HoldBandSlot, ActualTimeSlot, EstimateSlot } from "./progress/slot";
export { SectionSlot } from "./decisions/slot";
export { PanelTabsSlot, TitleSlot } from "./thread/panel";
export { usePrefetchDetail } from "./prefetch";
