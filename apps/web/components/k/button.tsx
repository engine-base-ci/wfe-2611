"use client";
// ボタン（K-24・正本 components.button-*）。1 画面に主ボタン（primary）は 1 つ。danger は取り消せない操作
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outlined" | "inverted" | "ghost" | "danger";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: ReactNode;
  /** 押したあと答えを待っている間。押し直しを止め、読み上げにも「処理中」と伝える */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={className ? `k-btn ${className}` : "k-btn"}
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="k-spin" aria-hidden="true" /> : icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}
