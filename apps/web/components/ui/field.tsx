"use client";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useId, useState } from "react";
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
  // パスワードは見る・隠すを切り替えられる（D-087）。入力欄の部品 1 つに入れるので画面ごとに書かない。
  // 既定は隠す。押すと type が text になり、読み上げの名前とアイコンが変わる。的は 32px（24px 以上・G14）
  const isPassword = rest.type === "password";
  const [shown, setShown] = useState(false);
  const el = (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full rounded-[var(--r-md)] border border-transparent bg-[var(--sv)] px-[13px] py-2.5 text-[16px] text-[var(--on-surface)] focus:bg-[var(--card)] focus:outline-2 focus:outline-offset-1 focus:outline-[var(--primary)] md:text-[14px]",
        invalid && "bg-[#fdf2f2] outline-2 outline-[var(--error)]",
        isPassword && "pr-11",
        className,
      )}
      {...rest}
      type={isPassword ? (shown ? "text" : "password") : rest.type}
    />
  );
  if (!isPassword) return el;
  return (
    <div className="relative">
      {el}
      <button
        type="button"
        aria-pressed={shown}
        aria-label={shown ? "パスワードを隠す" : "パスワードを表示"}
        onClick={() => setShown((v) => !v)}
        className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-[var(--r-sm)] text-[var(--on-sv)] hover:bg-[var(--surface)] hover:text-[var(--on-surface)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)]"
      >
        {shown ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
      </button>
    </div>
  );
}
