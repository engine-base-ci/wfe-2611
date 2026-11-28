import { PauseCircle } from "lucide-react";
import type { ReactNode } from "react";

// 止まっている帯（G18 stopped・D-055／D-018）：AI が動けない時点（PC が閉じている・覚え直し待ち）で全画面の上に出す
export function StoppedBanner({ reason, action }: { reason: string; action?: ReactNode }) {
  return (
    <div
      role="status"
      data-stopped
      className="flex flex-wrap items-center gap-2.5 border-b border-[var(--line)] bg-[#fbebd6] px-7 py-2 text-[13px] text-[var(--st-warning)]"
    >
      <PauseCircle className="size-4" />
      <b className="font-semibold">AI は止まっています</b>
      <span className="text-[var(--on-surface)]">{reason}</span>
      <div className="flex-1" />
      {action}
    </div>
  );
}
