"use client";
// 一覧の差し込み口：自分に関わるものの数の札（K-600 が入れ、K-478 が本物にした）。list-page.tsx の MineCards を包む。
//   押せる札（NumberCards）を描く（children の押せない形は出さない）。数は一覧の答えの meta.counts（無ければ数の字を出さない・D-144.3）。
//   押すと URL の絞りの組を表の欄に替える（mine-focus.ts・絞りの札と同じ絞り・もう一度押すと戻る）。並びは残す。
//   上の数字の見え方（外した札）は use-mine-view.ts（このブラウザに覚える）
import type { ReactNode } from "react";
import type { Counts, ListExtra } from "@/features/F4/ticket-list/use-ticket-list";
import { COUNT_OF, extraFor, focusOf, type FocusKey } from "../overview/mine-focus";
import { useMineView } from "../overview/use-mine-view";
import { todayJst } from "../saved/filter-params";
import { NumberCards, type NumberCard } from "./number-cards";

/** この区画が本物になったか */
export const READY: boolean = true;

export interface NumberCardsSlotProps {
  /** URL の絞りの組（一覧の口の問い合わせにそのまま足す欄） */
  extra: ListExtra;
  /** 絞りの組を替える（URL を替えて読み直す） */
  onExtra: (next: ListExtra) => void;
  /** 一覧の答えの meta.counts（無ければ null） */
  counts: Counts | null;
  children?: ReactNode;
}

type CardKey = Exclude<FocusKey, "all" | "assigned">;
export const CARD_DEFS: readonly { key: CardKey; label: string; tone: NumberCard["tone"] }[] = [
  { key: "overdue", label: "期限切れ", tone: "danger" },
  { key: "today", label: "今日まで", tone: "neutral" },
  { key: "approve", label: "自分が承認", tone: "warning" },
  { key: "ai", label: "AI が動いている", tone: "neutral" },
];

export function NumberCardsSlot({ extra, onExtra, counts }: NumberCardsSlotProps) {
  const view = useMineView();
  const today = todayJst();
  // 札は本人の id を使わない（自分が担当は絞りの札だけ）
  const focus = focusOf(extra, today, "");
  const defs = CARD_DEFS.filter((d) => !view.hiddenCards.includes(d.key));
  const pressed = defs.find((d) => d.key === focus) ?? null;
  const cards: NumberCard[] = defs.map((d) => ({
    key: d.key,
    label: d.label,
    tone: d.tone,
    value: counts ? counts[COUNT_OF[d.key]] : undefined,
  }));
  return (
    <NumberCards
      cards={cards}
      pressed={pressed?.key ?? null}
      onPress={(key) => onExtra(extraFor(extra, (key as FocusKey | null) ?? "all", today, ""))}
      {...(pressed ? { pressedNote: `${pressed.label}で絞っています。もう一度押すと戻ります` } : {})}
    />
  );
}
