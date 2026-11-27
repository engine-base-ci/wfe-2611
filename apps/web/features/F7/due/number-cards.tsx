"use client";
// 数の札と絞りの札（キャンバス Main・F7 段 8 片付ける）。前の MineCards・MineFilter は押せない形・数は空だったので、押せる形で値を受け取って描く。
//   札を押すと、その札で表が絞られる（押している札は濃く）。もう一度押すと戻る。値（数）は一覧の 1 回目の答えの meta から葉が渡す。
//   「渡されたもの」の札は押せない形（D-148.13・D-151.19）
import type { ReactNode } from "react";

export interface NumberCard {
  key: string;
  label: string;
  /** 数（口が数を返さないときは undefined：字を出さない・0 と書かない・D-144.3） */
  value?: number | undefined;
  tone: "danger" | "neutral" | "warning";
  /** 札の字の前の印（期限切れの炎など） */
  icon?: ReactNode;
}

export interface NumberCardsProps {
  cards: readonly NumberCard[];
  /** 押している札（無ければ null） */
  pressed?: string | null;
  /** 押したとき。押している札をもう一度押したら null */
  onPress?: (key: string | null) => void;
  /** 札を押している間、札の下に出す 1 行（「期限切れで絞っています。もう一度押すと戻ります」・案） */
  pressedNote?: string;
}

export function NumberCards({ cards, pressed = null, onPress, pressedNote }: NumberCardsProps) {
  return (
    <div className="k-f7-due-cards-box">
      <div className="k-f7-due-cards" role="group" aria-label="数の札">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            className="k-f7-due-card"
            data-tone={c.tone}
            aria-pressed={pressed === c.key}
            onClick={() => onPress?.(pressed === c.key ? null : c.key)}
          >
            <span className="k-f7-due-card-label">
              {c.icon}
              {c.label}
            </span>
            <span className="k-f7-due-card-value">{c.value ?? "\u00a0"}</span>
          </button>
        ))}
      </div>
      {pressed !== null && pressedNote ? (
        <p className="k-f7-due-note" role="status">
          {pressedNote}
        </p>
      ) : null}
    </div>
  );
}

export interface MineChip {
  key: string;
  label: string;
  /** 件数（「すべて」は無し） */
  count?: number;
  /** 機能がまだ（渡されたもの）。グレーで押せない */
  pending?: boolean;
}

export interface MineChipsProps {
  chips: readonly MineChip[];
  /** 押している札の key（どれも押していなければ、どれとも合わない値） */
  current: string;
  /** 札を押したとき（押せない札では呼ばない） */
  onPick?: (key: string) => void;
}

export function MineChips({ chips, current, onPick }: MineChipsProps) {
  return (
    <span className="k-f7-due-chips" role="group" aria-label="絞りの札">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="k-f7-due-chip"
          aria-pressed={c.key === current}
          onClick={c.pending ? undefined : () => onPick?.(c.key)}
          {...(c.pending ? { "aria-disabled": true, tabIndex: -1, title: `${c.label}（準備中）` } : {})}
        >
          {c.label}
          {c.count !== undefined ? <span> {c.count}</span> : null}
        </button>
      ))}
    </span>
  );
}
