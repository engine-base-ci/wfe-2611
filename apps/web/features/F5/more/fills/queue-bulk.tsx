"use client";
// 差し込み口の先：まとめて承認（持ち主の葉 K-769・この先を本物に替える。器 slots.tsx と承認待ちのファイルは触らない）。
//   最初は今の本線と同じ物：頭の四角は押せない・行は押せない四角か「—」（1 件ずつ決める行）・［選んだものをまとめて承認］は押せない形・
//   表の上には何も足さない・スマホのカードは番号だけ（カードの番号の所は差し込み口が描く。四角を足すときは番号を四角の字にして 1 回だけ）
import type { ReactNode } from "react";
import { Button } from "@/components/k";
import { INERT } from "@/features/F5/approve-complete/queue-card";
import type { QueueBulkProps } from "../slots";

export function QueueBulkFill({ part, row }: QueueBulkProps): ReactNode {
  if (part === "head") return <input type="checkbox" disabled aria-label="まとめて選べるものをすべて選ぶ" />;
  if (part === "row") {
    if (row?.decide_inline) return <input type="checkbox" disabled aria-label="まとめて承認に入れる" />;
    return (
      <span className="k-ap-dash" title="1 件ずつ決める">
        —
      </span>
    );
  }
  if (part === "tool")
    return (
      <Button variant="outlined" size="sm" {...INERT}>
        選んだものをまとめて承認
      </Button>
    );
  if (part === "card") return row ? <span className="k-hnd-mcard-num">{row.ticket_number}</span> : null;
  return null;
}
