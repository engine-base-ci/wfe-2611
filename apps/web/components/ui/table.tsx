import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// 表：見出しは小さく・数値列は右寄せ（tabular-nums）・横に長いときは自分の枠だけスクロール（D-052・DESIGN）
export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-[13.5px]", className)} {...rest} />
    </div>
  );
}
export function Th({ className, numeric, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "border-b border-[var(--line)] pb-2 pr-2.5 text-left text-[11px] font-semibold tracking-[0.06em] text-[var(--on-sv)]",
        numeric && "text-right",
        className,
      )}
      {...rest}
    />
  );
}
export function Td({ className, numeric, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-[var(--line-soft)] py-[11px] pr-2.5 align-middle [tr:last-child>&]:border-b-0",
        numeric && "num text-right font-medium",
        className,
      )}
      {...rest}
    />
  );
}
