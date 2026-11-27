"use client";
// 差し込み口の先：取り下げる（持ち主の葉 K-735・この先を本物に替える。器 slots.tsx と帯のファイルは触らない）。
//   最初は今の本線と同じ物：承認の後の実行待ちの箱をそのまま返す
import type { ReactNode } from "react";
import type { ExecuteQueuedProps } from "../slots";

export function ExecuteQueuedFill({ box }: ExecuteQueuedProps): ReactNode {
  return <>{box}</>;
}
