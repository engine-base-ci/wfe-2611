"use client";
// 差し込み口の先：続けて裁く（持ち主の葉 K-752・この先を本物に替える。器 slots.tsx と承認待ちのファイルは触らない）。
//   最初は今の本線と同じ物：押せない形の［続けて裁く（N 件）］
import type { ReactNode } from "react";
import { Button } from "@/components/k";
import type { QueueFocusProps } from "../slots";

export function QueueFocusFill({ total }: QueueFocusProps): ReactNode {
  return <Button className="k-ap-next" aria-disabled="true" tabIndex={-1}>{`続けて裁く（${total} 件）`}</Button>;
}
