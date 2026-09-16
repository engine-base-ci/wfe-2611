// 外の枠（ログイン前）：左に製品の言葉、右に 1 枚の用件（06_mockup v1-signup ほか）。枠は導出（needs_login=false → 外・D-065.2）
import type { ReactNode } from "react";
import Link from "next/link";

export function OutsideLayout({
  eyebrow,
  pitch,
  lead,
  children,
  steps,
}: {
  eyebrow?: string;
  pitch: ReactNode;
  lead: ReactNode;
  children: ReactNode;
  steps?: string[];
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" data-frame="outside">
      <aside className="flex flex-col justify-between bg-[var(--primary)] px-6 py-8 text-white lg:px-12 lg:py-12">
        <div>
          <Link href="/" className="text-[15px] font-bold tracking-[0.01em]">
            Kaname
          </Link>
          <h2 className="mt-8 max-w-[18ch] text-[26px] leading-[1.35] font-bold tracking-[-0.01em] text-balance lg:text-[32px]">
            {pitch}
          </h2>
          <p className="mt-4 max-w-[46ch] text-[14px] leading-[1.8] text-white/80">{lead}</p>
          {steps?.length ? (
            <ol className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-[12.5px] text-white/70">
              {steps.map((s, i) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className="num grid size-5 place-items-center rounded-full bg-white/15 text-[11px] font-semibold">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <div className="mt-10 text-[11.5px] text-white/60">{eyebrow ?? "株式会社ENGINE BASE"}</div>
      </aside>
      <main className="flex items-start justify-center px-4 py-10 sm:px-8 lg:items-center lg:py-16">
        <div className="w-full max-w-[440px]">{children}</div>
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
