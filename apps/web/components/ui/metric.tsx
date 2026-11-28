import { cn } from "@/lib/cn";

// 数字：tabular-nums・単位は小さく・比較は右（DESIGN metric-lg／md）。数字カードを並べる画面にしない（D-071）
export function Metric({
  label,
  value,
  unit,
  sub,
  tone,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  tone?: "ok" | "warn" | "bad";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-[7px] text-[11.5px] font-semibold tracking-[0.04em] text-[var(--on-sv)]">{label}</div>
      <div className="num text-[34px] leading-none font-semibold tracking-[-0.02em]">
        {value}
        {unit ? <span className="ml-1 text-[14px] font-medium text-[var(--on-sv)]">{unit}</span> : null}
      </div>
      {sub ? (
        <div
          className={cn(
            "num mt-[7px] text-[12.5px] text-[var(--on-sv)]",
            tone === "ok" && "text-[var(--st-success)]",
            tone === "warn" && "text-[var(--st-warning)]",
            tone === "bad" && "text-[var(--st-danger)]",
          )}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}
