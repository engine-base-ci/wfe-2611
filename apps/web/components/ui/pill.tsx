import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// 状態は面（pill）で示す。データの系列は点と線（D-052 色の二層分離）。白文字で 4.6:1 以上
export type PillTone = "success" | "warning" | "danger" | "progress" | "neutral" | "ai";
const TONE: Record<PillTone, string> = {
  success: "bg-[var(--st-success)] text-white",
  warning: "bg-[var(--st-warning)] text-white",
  danger: "bg-[var(--st-danger)] text-white",
  progress: "bg-[var(--st-progress)] text-white",
  neutral: "bg-[#6b7585] text-white",
  ai: "bg-[var(--tertiary-c)] text-[var(--on-tertiary-c)]",
};
export function Pill({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: PillTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold whitespace-nowrap [&>svg]:size-3",
        TONE[tone],
        className,
      )}
      {...rest}
    />
  );
}
