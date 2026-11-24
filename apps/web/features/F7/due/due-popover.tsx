"use client";
// 期限を変える小さな箱（キャンバス TdDue・F7 段 8 片付ける・D-151.11）。値を受け取って描くだけ（口は呼ばない）。
//   上から：すぐ選ぶ 4 つ（今日・明日・今週の金曜・来週の月曜）／月のカレンダー／時刻と先方の締め／理由（必須・絵に欄が無いので足した）／
//   「期限を延ばすと、承認する人（〇〇）にお知らせが出る」／期限をなくす・〇〇 にする。
//   失敗：理由が空・過去日は欄の下の赤い字、口が断った（同時に変えられた など）は箱の上の赤い箱（書いた中身は消さない）。
//   文は正本（K-483 が足す期限の断り・過去日の E-VAL-012）：理由が空「期限を変える理由を書いてください」／過去日「期限は今日か、それより後の日にしてください」／
//   同時に「ほかの人が先に期限を変えました。開き直してから、もう一度変えてください」。呼ぶ側が字を渡す。先方の締めは列が無いので、渡さなければ出さない
//   置き場：「日付と時間」の欄のすぐ下に重ねて開く（欄の箱を .k-f7-due-anchor にする。本番は Popover に包んでよい）
//   動きを受ける口（K-484・全部任意）：渡さなければ今のまま描くだけ（モックの形）。渡すと押せる・書ける形になる
import { ChevronLeft, ChevronRight } from "lucide-react";
import type React from "react";
import { Button, NoticeBox, TextArea } from "@/components/k";

export interface DueQuick {
  label: string;
  /** YYYY-MM-DD */
  value: string;
}

export interface DuePopoverProps {
  /** 今日（YYYY-MM-DD・日本時間）。呼ぶ側が渡す（この部品は時計を読まない） */
  today: string;
  /** いま選んでいる日（YYYY-MM-DD） */
  picked: string;
  /** 見ている月 */
  month: { year: number; month: number };
  quick: readonly DueQuick[];
  /** 時刻（HH:MM） */
  time: string;
  /** 先方の締め（あれば「□ 先方の締め 11/05」を出す。日は YYYY-MM-DD） */
  clientDeadline?: string | undefined;
  /** 承認する人の名前（「期限を延ばすと、承認する人（高本）にお知らせが出る」）。空なら注の行を出さない */
  approver: string;
  reason: string;
  dateError?: string | undefined;
  reasonError?: string | undefined;
  /** 口が断ったとき（同時に変えられた など）の赤い箱 */
  notice?: string | undefined;
  busy?: boolean;
  /** すぐ選ぶを押した（値は YYYY-MM-DD） */
  onQuick?: (value: string) => void;
  /** 格子の日を押した（YYYY-MM-DD） */
  onDay?: (value: string) => void;
  /** 前の月（-1）・次の月（+1） */
  onMonth?: (delta: number) => void;
  /** 理由を書いた */
  onReason?: (text: string) => void;
  /** 「〇〇 にする」 */
  onSubmit?: () => void;
  /** 「期限をなくす」 */
  onClear?: () => void;
  /** Esc で閉じる */
  onClose?: () => void;
  /** 「〇〇 にする」を押せない形にする（aria-disabled・title は訳） */
  submitDisabled?: string | undefined;
  /** 「期限をなくす」を押せない形にする（aria-disabled・title は訳） */
  clearDisabled?: string | undefined;
}

/** 押せない形（aria-disabled・title）の属性 */
const inert = (why: string | undefined) => (why ? { "aria-disabled": true as const, title: why } : {});

const WEEK = ["日", "月", "火", "水", "木", "金", "土"] as const;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** YYYY-MM-DD → MM/DD */
const mmdd = (v: string) => `${v.slice(5, 7)}/${v.slice(8, 10)}`;

/** 月の並び：頭の空き（日曜から数える）と 1 日から末日まで */
function monthDays(year: number, month: number): { blanks: number; days: number } {
  return {
    blanks: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
    days: new Date(Date.UTC(year, month, 0)).getUTCDate(),
  };
}

export function DuePopover({
  today,
  picked,
  month,
  quick,
  time,
  clientDeadline,
  approver,
  reason,
  dateError,
  reasonError,
  notice,
  busy = false,
  onQuick,
  onDay,
  onMonth,
  onReason,
  onSubmit,
  onClear,
  onClose,
  submitDisabled,
  clearDisabled,
}: DuePopoverProps) {
  const { blanks, days } = monthDays(month.year, month.month);
  return (
    <section
      className="k-f7-due-pop"
      role="dialog"
      aria-label="期限を変える"
      {...(onClose
        ? {
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Escape") onClose();
            },
          }
        : {})}
    >
      {notice ? <NoticeBox>{notice}</NoticeBox> : null}
      <div className="k-f7-due-quick" role="group" aria-label="すぐ選ぶ">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            className="k-f7-due-quick-item"
            aria-pressed={q.value === picked}
            {...(onQuick ? { onClick: () => onQuick(q.value) } : {})}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="k-f7-due-month">
        <b>{`${month.year}年 ${month.month}月`}</b>
        <span className="k-f7-due-month-nav">
          <button
            type="button"
            className="k-f7-due-nav-btn"
            aria-label="前の月"
            {...(onMonth ? { onClick: () => onMonth(-1) } : {})}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="k-f7-due-nav-btn"
            aria-label="次の月"
            {...(onMonth ? { onClick: () => onMonth(1) } : {})}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </span>
      </div>
      <div className="k-f7-due-grid" role="group" aria-label={`${month.year}年 ${month.month}月の日付`}>
        {WEEK.map((w) => (
          <span key={w} className="k-f7-due-week" aria-hidden="true">
            {w}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`b${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = ymd(month.year, month.month, i + 1);
          return (
            <button
              key={d}
              type="button"
              className="k-f7-due-day"
              aria-pressed={d === picked}
              aria-current={d === today ? "date" : undefined}
              aria-label={`${month.month}月${i + 1}日`}
              {...(onDay ? { onClick: () => onDay(d) } : {})}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {dateError ? (
        <p className="k-err" role="alert">
          {dateError}
        </p>
      ) : null}
      <div className="k-f7-due-time">
        <label className="k-f7-due-time-field">
          <span className="k-label">時刻</span>
          <input className="k-input" type="time" value={time} readOnly aria-label="時刻" />
        </label>
        {clientDeadline ? (
          <label className="k-dialog-check">
            <input type="checkbox" readOnly checked={false} onChange={() => undefined} />
            <span>{`先方の締め ${mmdd(clientDeadline)}`}</span>
          </label>
        ) : null}
      </div>
      <TextArea
        label="理由"
        name="due-reason"
        required
        rows={2}
        value={reason}
        {...(onReason
          ? { onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onReason(e.target.value) }
          : { readOnly: true })}
        description="やり取りに残る"
        error={reasonError}
      />
      {approver ? <p className="k-f7-due-note">{`期限を延ばすと、承認する人（${approver}）にお知らせが出る`}</p> : null}
      <div className="k-f7-due-acts">
        <Button
          variant="outlined"
          disabled={busy}
          {...inert(clearDisabled)}
          {...(onClear ? { onClick: () => !clearDisabled && onClear() } : {})}
        >
          期限をなくす
        </Button>
        <Button
          loading={busy}
          {...inert(submitDisabled)}
          {...(onSubmit ? { onClick: () => !submitDisabled && onSubmit() } : {})}
        >{`${mmdd(picked)} にする`}</Button>
      </div>
    </section>
  );
}
