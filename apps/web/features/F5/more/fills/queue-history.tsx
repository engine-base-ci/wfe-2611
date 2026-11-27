"use client";
// 差し込み口の先：決めた履歴（持ち主の葉 K-751・この先を本物に替える。器 slots.tsx と承認待ちのファイルは触らない）。
//   最初は今の本線と同じ物：押せない形の［決めた履歴］（道具の行は小さい形）
import type { ReactNode } from "react";
import { Button } from "@/components/k";
import { INERT } from "@/features/F5/approve-complete/queue-card";
import type { QueueHistoryProps } from "../slots";

export function QueueHistoryFill({ where }: QueueHistoryProps): ReactNode {
  return (
    <Button variant="outlined" {...(where === "tools" ? { size: "sm" as const } : {})} {...INERT}>
      決めた履歴
    </Button>
  );
}
