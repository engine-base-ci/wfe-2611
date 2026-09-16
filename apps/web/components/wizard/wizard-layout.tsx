"use client";
// はじめの設定の枠（D-065.3）：手順バーだけ。サイドバー・第2ナビ・下タブは無い（app ∉ caps）
import { navRoute } from "@/lib/pending-route";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const WIZARD_STEPS: { n: number; label: string; href: string }[] = [
  { n: 1, label: "PCをつなぐ", href: "/setup/bridge" },
  { n: 2, label: "話す", href: "/onboard/interview" },
  { n: 3, label: "たたき台", href: "/onboard/draft" },
  { n: 4, label: "ログイン情報", href: "/settings/credentials" },
  { n: 5, label: "テスト", href: "/onboard/testrun" },
  { n: 6, label: "本番へ", href: "/onboard/golive" },
];
export function WizardLayout({
  title,
  purpose,
  children,
  existing,
}: {
  title: string;
  purpose: string;
  children: ReactNode;
  existing: string[];
}) {
  const path = usePathname();
  return (
    <div className="min-h-dvh" data-frame="wizard">
      <header className="border-b border-[var(--line)] bg-[var(--card)] px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/" className="text-[14px] font-bold">
            Kaname
          </Link>
          <span className="text-[12.5px] text-[var(--on-sv)]">はじめの設定 ── PCをつないで、自分のAIと作る</span>
          <ol className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]" aria-label="手順">
            {WIZARD_STEPS.map((s) => {
              const on = path.startsWith(s.href);
              const ok = existing.includes(s.href);
              const inner = (
                <>
                  <span
                    className={cn(
                      "num grid size-[18px] place-items-center rounded-full text-[10.5px] font-semibold",
                      on ? "bg-[var(--primary)] text-white" : "bg-[var(--sv)] text-[var(--on-sv)]",
                    )}
                  >
                    {s.n}
                  </span>
                  <span className={cn(on ? "font-semibold text-[var(--on-surface)]" : "text-[var(--on-sv)]")}>
                    {s.label}
                  </span>
                </>
              );
              return (
                <li key={s.n} className="flex items-center gap-1.5">
                  {ok ? (
                    <Link href={navRoute(s.href)} className="flex items-center gap-1.5">
                      {inner}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1.5 opacity-60" title="この段はまだ作っていません">
                      {inner}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <h1 className="text-h1 font-bold tracking-[-0.015em]">{title}</h1>
        <p className="mt-1 max-w-[65ch] text-[13.5px] text-[var(--on-sv)]">{purpose}</p>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
