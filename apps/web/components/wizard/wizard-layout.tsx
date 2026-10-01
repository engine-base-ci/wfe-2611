"use client";
// はじめの設定の枠（D-065.3）：手順バーだけ。サイドバー・第2ナビ・下タブは無い（app ∉ caps）
// 下の帯（D-116）：次の段へ進む主ボタンは 1 つだけ、画面の下に常に見える。進めないときは何をすれば進めるかを書く。
// 押せない段を押すと、いまの段で何をすれば開くかを出す（黙って押せない、にしない）
import { navRoute } from "@/lib/pending-route";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { SETUP_STEPS } from "@/lib/onboarding";
import { useSetupStep } from "@/lib/onboarding";
import { useSession } from "@/lib/auth/session";
import { KanameMark } from "@/components/brand/kaname-mark";
import { Button } from "@/components/ui";

/** 互換：以前ここに置いていた段の一覧。正本は lib/onboarding.ts */
export const WIZARD_STEPS = SETUP_STEPS;

/** 下の帯の中身。無ければ「今の段を通していれば 次の段へ」を出す */
export interface WizardNext {
  /** 押せるか（その段の主たる操作ができる状態か） */
  ready: boolean;
  /** ボタンの文字（既定は「次へ：N. 名前」） */
  label?: string;
  /** 押したとき（既定は次の段へ移るだけ）。段を通した記録はここで付ける */
  onGo?: () => void | Promise<void>;
  /** 押せないときに出す文（既定は「〇〇すると進めます」） */
  waiting?: string;
}

export function WizardLayout({
  title,
  purpose,
  children,
  existing,
  next,
  chat = false,
}: {
  title: string;
  purpose: string;
  children: ReactNode;
  existing: string[];
  next?: WizardNext;
  /** 会話が本文の画面（話す・たたき台を会話で直す）。見出しを 1 行に詰め、「会話を広げる」を出す（2026-09-29 user「やり取りスペースが小さすぎて見づらい」） */
  chat?: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const { session } = useSession();
  const { step } = useSetupStep(session != null);
  const [note, setNote] = useState<string | null>(null);
  const [going, setGoing] = useState(false);
  // 会話を広げる：段の帯・見出しの説明・右の欄を閉じて会話だけにする。Esc でも戻る
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (!wide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide]);
  const showWide = chat && wide;
  // 押せるのは、済んだ段と今の段（次に進む段）だけ。まだ届かない段は押せない形で出す（押しても戻されるだけ、を作らない）
  const reach = (step ?? 0) + 1;
  const here = SETUP_STEPS.find((s) => path.startsWith(s.href)) ?? null;
  const after = here ? (SETUP_STEPS.find((s) => s.n === here.n + 1) ?? null) : null;
  const current = SETUP_STEPS.find((s) => s.n === reach) ?? null;
  // 下の帯：その段を通していれば次へ。ページが中身を渡していれば、そちらを使う
  const passed = here !== null && step !== null && step >= here.n;
  // 次の段の画面がまだ無いときは、そう書いて、いま使える所（入口が決める）へ送る（まだ無いものを隠さない・D-089.6）
  const notYet = after !== null && !after.built;
  const bar: WizardNext | null = !here || !after ? null : (next ?? { ready: passed });
  const label = bar?.label ?? (notYet ? "Kaname を開く" : after ? `次へ：${after.n}. ${after.label}` : "");
  const waiting = bar?.waiting ?? (here ? `${here.doneWhen}と進めます` : "");
  const later = notYet
    ? `次の「${after.n}. ${after.label}」からは、AI社員を動かす仕組みと一緒に作っています（まだ使えません）。それまでは自分のAIとの会話とたたき台の手直しが使えます`
    : "";
  const go = async () => {
    if (!bar?.ready || !after || going) return;
    setGoing(true);
    try {
      if (bar.onGo) await bar.onGo();
      // はじめの設定から Kaname に移るときは履歴を置き換える（戻るで設定の画面に戻らない・2026-09-30 user「戻るとウィザードへ戻る」）
      else if (notYet) router.replace("/");
      else router.push(navRoute(after.href));
    } finally {
      setGoing(false);
    }
  };
  return (
    <div className="min-h-dvh" data-frame="wizard" data-chat-wide={showWide ? "" : undefined}>
      <div className="mx-auto max-w-[1120px] px-4 pt-[26px] sm:px-6">
        {showWide ? null : (
          <>
            <header className="mb-[22px] flex flex-wrap items-center gap-3">
              <Link href="/" className="flex items-center gap-2 text-[16px] font-bold text-[var(--primary)]">
                <KanameMark className="size-5" />
                Kaname
              </Link>
              <span className="text-[12.5px] text-[var(--on-sv)]">はじめの設定 ── PCをつないで、自分のAIと作る</span>
            </header>
            <ol className="flex" aria-label="手順">
              {SETUP_STEPS.map((s) => {
                const on = path.startsWith(s.href);
                const ok = existing.includes(s.href);
                const done = step !== null && s.n <= step && !on;
                const reachable = ok && s.n <= reach;
                const text = `${s.n}. ${s.label}`;
                return (
                  <li
                    key={s.n}
                    className={cn(
                      "flex-1 border-b-[3px] pb-[11px] text-center text-[12px] font-semibold",
                      on
                        ? "border-[var(--primary)] text-[var(--primary)]"
                        : done
                          ? "border-[var(--st-success)] text-[var(--st-success)]"
                          : "border-[var(--line)] text-[var(--on-sv)]",
                    )}
                  >
                    {reachable ? (
                      <Link
                        href={navRoute(s.href)}
                        className="block rounded-[var(--r-sm)] hover:underline"
                        aria-current={on ? "step" : undefined}
                        aria-label={done ? `（済）${text}` : text}
                      >
                        {text}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full cursor-help opacity-60"
                        // 押すと「何をすれば開くか」が出るボタン。押せない印（aria-disabled）は付けず、名前で伝える
                        aria-label={`${text}（まだ開けません。押すと理由が出ます）`}
                        data-step-locked
                        onClick={() =>
                          setNote(
                            !ok
                              ? `「${text}」はまだ作っていません。${current ? `いまの段は「${current.n}. ${current.label}」です` : ""}`
                              : current
                                ? `「${text}」は、いまの段「${current.n}. ${current.label}」で${current.doneWhen}と開きます`
                                : `「${text}」は、前の段を終えると開きます`,
                          )
                        }
                      >
                        {text}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
            {/* 押せない段の理由。出たときだけ場所を取る */}
            <p className={cn("text-[12.5px] text-[var(--on-sv)]", note ? "mt-2" : "")} role="status" data-step-note>
              {note}
            </p>
          </>
        )}
        <main className={cn("pb-4", showWide ? "pt-[18px]" : chat ? "mt-4" : "mt-[26px]")}>
          {chat ? (
            // 会話の画面は見出しと説明を 1 行に詰める（会話に高さを渡す）
            <div className="mb-3 flex items-center gap-3">
              <h1 className="shrink-0 text-h2 font-bold">{title}</h1>
              {showWide ? null : <p className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--on-sv)]">{purpose}</p>}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                icon={showWide ? <Minimize2 /> : <Maximize2 />}
                onClick={() => setWide((w) => !w)}
                aria-pressed={showWide}
                data-chat-wide-toggle
              >
                {showWide ? "元に戻す" : "会話を広げる"}
              </Button>
            </div>
          ) : (
            <>
              <h1 className="mb-1.5 text-[22px] font-bold">{title}</h1>
              <p className="mb-5 max-w-[65ch] text-[13.5px] leading-[1.8] text-[var(--on-sv)]">{purpose}</p>
            </>
          )}
          {children}
        </main>
        {bar ? (
          <div
            className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3.5 border-t border-[var(--line)] bg-[var(--surface)] py-3"
            data-wiz-next
          >
            <span className="mr-auto text-[13px] text-[var(--on-sv)]" data-wiz-next-note>
              {bar.ready ? later : waiting}
            </span>
            <Button icon={<Check />} disabled={!bar.ready || going} onClick={() => void go()} data-wiz-next-go>
              {label}
            </Button>
          </div>
        ) : (
          <div className="pb-20" />
        )}
      </div>
    </div>
  );
}
