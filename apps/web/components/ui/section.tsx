import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

// 箱ではなく段：罫線 1 本と余白で区切る（影より罫線・D-052。1px の箱を並べない・D-071.5）
export function Section({
  title,
  aside,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & { title?: ReactNode; aside?: ReactNode }) {
  return (
    <section
      className={cn("border-t border-[var(--line)] pt-[22px] pb-2.5 first:border-t-0 first:pt-1", className)}
      {...rest}
    >
      {title ? (
        <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
          <h2 className="text-h2 font-bold tracking-[-0.01em]">{title}</h2>
          <div className="flex-1" />
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}
