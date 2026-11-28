"use client";
// 段 8（F7）の外枠の差し込み口の入口（K-599）。ここは書き出しだけ（定義を置かない）。後ろの葉は自分の区画のファイルだけを直す。
//   入れる所：features/F4/create-ticket/ticket-shell.tsx。本物にする葉：
//     useNoticeSlot・NoticeSlot（鈴）→ K-467／useSearchSlot・SearchSlot（探す欄）→ K-471／SavedViewSlot（Shell の belowGroups）→ K-479／
//     groupHref（グループの行の行き先・K-466 が使う）→ K-480
export { useNoticeSlot, NoticeSlot } from "./notice/notice-slot";
export { useSearchSlot, SearchSlot } from "./search/search-slot";
export { SavedViewSlot } from "./saved/saved-view-slot";
export { groupHref } from "./overview/group-link-slot";
