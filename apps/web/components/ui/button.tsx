"use client";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

// 1 画面 1 主アクション（primary は 1 つ）。outline は補助、ghost は行の中、danger は取り消せない操作（D-052・DESIGN Components）
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[7px] rounded-[var(--r-md)] font-semibold whitespace-nowrap select-none active:translate-y-px disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-[var(--primary)] text-white hover:bg-[#1a2848]",
        secondary: "bg-[var(--secondary-c)] text-[var(--on-secondary-c)] hover:bg-[#bfe2de]",
        outline: "border-[1.5px] border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-c)]",
        ghost: "text-[var(--on-sv)] hover:bg-[var(--sv)] hover:text-[var(--on-surface)]",
        danger: "border-[1.5px] border-[var(--error)] text-[var(--error)] hover:bg-[#fbe9e9]",
      },
      size: { md: "px-[17px] py-[9px] text-[13.5px]", sm: "px-3 py-1.5 text-[12.5px]", icon: "size-8 p-0" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  icon?: ReactNode;
}
export function Button({ className, variant, size, icon, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...rest}>
      {icon ? <span className="[&>svg]:size-[15px]">{icon}</span> : null}
      {children}
    </button>
  );
}
