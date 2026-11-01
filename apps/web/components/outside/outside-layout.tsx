// 外の枠（ログイン前）：左に製品の言葉、右に 1 枚の用件。見た目は 06_mockup/_parts.py の AUTH_CSS と s_p0.py の _left／_box（D-065.2）
// 左：印と Kaname（上）・言葉と手順（真ん中）・会社名（下）。右：376px の箱を上下の真ん中に
import type { ReactNode } from "react";
import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { KanameMark } from "@/components/brand/kaname-mark";

export function OutsideLayout({
  eyebrow,
  pitch,
  lead,
  children,
  steps,
  stepsDone = 0,
}: {
  eyebrow?: string;
  pitch: ReactNode;
  lead: ReactNode;
  children: ReactNode;
  steps?: readonly string[];
  /** 先頭から何段が済んでいるか（済は印、まだは時計） */
  stepsDone?: number;
}) {
  return (
    <div className="grid min-h-dvh md:grid-cols-2" data-frame="outside">
      <aside className="flex flex-col bg-[var(--primary)] px-5 py-[30px] text-white md:px-11 md:py-[52px]">
        <Link href="/" className="mb-[26px] flex items-center gap-2.5 text-[21px] font-bold md:mb-auto">
          <KanameMark className="size-6" />
          <span>Kaname</span>
        </Link>
        <h2 className="mb-4 text-[22px] leading-[1.5] font-bold tracking-[-0.01em] md:text-[28px]">{pitch}</h2>
        <p className="max-w-[420px] text-[14px] leading-[1.9] opacity-[.82]">{lead}</p>
        {steps?.length ? (
          <ol className="mt-7 hidden flex-col gap-[9px] text-[13px] opacity-[.85] md:flex" aria-label="はじめるまでの手順">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-[9px]">
                {i < stepsDone ? <Check className="size-4" aria-label="済" /> : <Clock className="size-4" aria-hidden />}
                <span className={i < stepsDone ? undefined : "opacity-[.78]"}>{s}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="mt-auto pt-10 text-[12px] opacity-[.72]">{eyebrow ?? "株式会社ENGINE BASE"}</div>
      </aside>
      <main className="grid place-items-center bg-[var(--card)] px-6 py-11">
        <div className="w-full max-w-[376px]" data-part="auth-box">
          {children}
        </div>
      </main>
    </div>
  );
}
export const SETUP_STEPS = [
  "アカウントを作る",
  "自分のPCをつなぐ（Bridge）",
  "自分のAIに会社のことを話す",
  "たたき台を確かめる",
  "テストで動かして本番へ",
];

/** 用件の箱の頭の丸い印（06_mockup s_p0 の 52px の丸） */
export function AuthIcon({ tone = "info", children }: { tone?: "info" | "ok" | "ng" | "muted"; children: ReactNode }) {
  const c = {
    info: "bg-[var(--secondary-c)] text-[var(--on-secondary-c)]",
    ok: "bg-[var(--st-success-c)] text-[var(--st-success)]",
    ng: "bg-[var(--st-danger-c)] text-[var(--error)]",
    muted: "bg-[var(--sv)] text-[var(--on-sv)]",
  }[tone];
  return <div className={`mb-[18px] grid size-[52px] place-items-center rounded-full [&>svg]:size-5 ${c}`}>{children}</div>;
}
/** 箱の中の補足（.pz：淡い面・左に印） */
export function AuthNote({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-[22px] flex gap-[9px] rounded-[var(--r-md)] bg-[var(--surface)] px-3.5 py-[11px] text-[12.5px] leading-[1.75] text-[var(--on-sv)] [&>svg]:mt-[3px] [&>svg]:size-4 [&>svg]:shrink-0">
      {icon}
      <span>{children}</span>
    </div>
  );
}
/** 箱の下の 1 行（真ん中寄せ・小さく） */
export function AuthFoot({ children }: { children: ReactNode }) {
  return <p className="mt-[18px] text-center text-[12.5px] text-[var(--on-sv)] [&_a]:font-semibold [&_a]:text-[var(--primary)]">{children}</p>;
}
/** 箱の見出しと説明（h1 24px・説明 13.5px） */
export function AuthHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <>
      <h1 className="mb-[5px] text-[24px] font-bold">{title}</h1>
      {children ? <div className="mb-[26px] text-[13.5px] leading-[1.8] text-[var(--on-sv)] [&_b]:text-[var(--on-surface)]">{children}</div> : null}
    </>
  );
}
