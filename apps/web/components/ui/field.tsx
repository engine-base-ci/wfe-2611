"use client";
import { AlertCircle } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

// 入力欄：ラベル・補足・エラーは 1 組（DESIGN Components）。エラーは何が起きた・次の一手を文で（D-069）
export function Field({
  label,
  help,
  error,
  children,
  id,
}: {
  label: string;
  help?: string;
  error?: string;
  children: (id: string) => ReactNode;
  id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="mb-[15px]">
      <label htmlFor={fid} className="mb-1.5 block text-[12px] font-semibold text-[var(--on-sv)]">
        {label}
      </label>
      {children(fid)}
      {error ? (
        <p className="mt-[5px] flex items-start gap-1.5 text-[12px] font-medium text-[var(--error)]" role="alert">
          <AlertCircle className="mt-[3px] size-3.5 shrink-0" />
          {error}
        </p>
      ) : help ? (
        <p className="mt-[5px] text-[12px] text-[var(--on-sv)]">{help}</p>
      ) : null}
    </div>
  );
}
export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-[var(--r-md)] border border-transparent bg-[var(--sv)] px-[13px] py-2.5 text-[16px] text-[var(--on-surface)] focus:bg-[var(--card)] focus:outline-2 focus:outline-offset-1 focus:outline-[var(--primary)] md:text-[14px]",
        invalid && "bg-[#fdf2f2] outline-2 outline-[var(--error)]",
        className,
      )}
      {...rest}
    />
  );
}
