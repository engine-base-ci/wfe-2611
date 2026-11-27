"use client";
// 差し込み口の先：取り下げる（K-735・器 slots.tsx の ExecuteQueuedSlot）。器と帯のファイルは触らない。
//   承認の後の実行待ちの箱に［承認を取り下げる］を足す・替える（本体は features/F5/withdraw/withdraw-box.tsx）
import type { ReactNode } from "react";
import { WithdrawBox } from "@/features/F5/withdraw/withdraw-box";
import type { ExecuteQueuedProps } from "../slots";

export function ExecuteQueuedFill(props: ExecuteQueuedProps): ReactNode {
  return <WithdrawBox {...props} />;
}
