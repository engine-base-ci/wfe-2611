"use client";
// チケットの詳細の頭（K-226・キャンバス TicketDetail）：頭の行（種別の札・番号・番号をコピー・作成・開始日・期限・段の札）と
//   題名の行（h1・右に 複製・〈見ている人〉のAI と話す・ほかの操作）。
//   本当の値が無い字は空にする（「—」を出さない・作成者の名前は口が返さないので出さない）。
//   複製・AI と話す・ほかの操作はまだ使えない：押せない形で出す（D-145.9）。番号のコピーは手元のクリップボードだけ
import { Bot, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/k";
import { ShellBell } from "@/components/k/shell";

const DAY_MS = 86_400_000;
const JST_MS = 9 * 3_600_000;
const WEEK = ["日", "月", "火", "水", "木", "金", "土"] as const;
/** 種別の色（口が返す #RRGGBB）→ 正本の色の段の名前。塗りは CSS の段の色だけ（生の色を画面に書かない）。
 *  段に無い色は既定の塗り（secondary）。既定の種別の色は packages/db/migrations/0071_tickets.sql */
const KIND_TONE: Record<string, string> = {
  "#186F69": "teal",
  "#B45309": "warning",
  "#6B5B99": "lavender",
  "#22345C": "primary",
  "#2F4B7C": "indigo",
  "#7E570D": "amber",
  "#A34A3E": "coral",
  "#516F46": "sage",
  "#6B3F5E": "plum",
  "#537E7B": "teal-light",
  "#6D4AA6": "tertiary",
};
const toneOf = (color: string | null | undefined): string | undefined =>
  color ? KIND_TONE[color.toUpperCase()] : undefined;

/** 日本時間の今日（YYYY-MM-DD） */
export const todayJst = (): string => new Date(Date.now() + JST_MS).toISOString().slice(0, 10);
/** YYYY-MM-DD → 「MM/DD」（キャンバスどおり 2 桁） */
export const mmdd = (ymd: string): string => `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}`;
/** YYYY-MM-DD → 「MM/DD（曜）」 */
export const mmddWeek = (ymd: string): string =>
  `${mmdd(ymd)}（${WEEK[new Date(`${ymd.slice(0, 10)}T00:00:00Z`).getUTCDay()]}）`;
/** 期限を何日過ぎたか（過ぎていなければ 0。日本時間の日付で数える） */
export function daysOver(due: string | null, today = todayJst()): number {
  if (!due) return 0;
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due.slice(0, 10)}T00:00:00Z`)) / DAY_MS);
  return diff > 0 ? diff : 0;
}
/** ISO の時刻 → 日本時間の「MM/DD HH:MM」 */
export function mmddTime(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = new Date(t + JST_MS).toISOString();
  return `${s.slice(5, 7)}/${s.slice(8, 10)} ${s.slice(11, 16)}`;
}

/** 押せない操作（まだ使えない・D-145.9）：在るが押せない。Tab で止まらない */
export function InertButton({
  label,
  children,
  className,
  size = "md",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  size?: "md" | "sm";
}) {
  return (
    <Button
      variant="outlined"
      size={size}
      {...(className ? { className } : {})}
      aria-disabled="true"
      tabIndex={-1}
      title="まだ使えません"
      {...(label ? { "aria-label": label } : {})}
    >
      {children}
    </Button>
  );
}

export interface HeadTicket {
  number: string;
  title: string;
  created_at?: string | null;
  start_on: string | null;
  due_on: string | null;
}

export function DetailMeta({
  ticket,
  kind,
  stage,
}: {
  ticket: HeadTicket;
  kind: { name: string; color?: string | null } | null;
  stage: { key?: string | null; name: string } | null;
}) {
  const [copied, setCopied] = useState("");
  const over = daysOver(ticket.due_on);
  const copy = () => {
    const done = (msg: string) => setCopied(msg);
    if (!navigator.clipboard?.writeText) {
      done("番号をコピーできませんでした");
      return;
    }
    navigator.clipboard.writeText(ticket.number).then(
      () => done("番号をコピーしました"),
      () => done("番号をコピーできませんでした"),
    );
  };
  return (
    <div className="k-detail-meta">
      {kind ? (
        <span data-part="kind" className="k-detail-kind" data-tone={toneOf(kind.color)}>
          {kind.name}
        </span>
      ) : null}
      <span data-part="number" className="k-detail-number">
        {ticket.number}
      </span>
      <button type="button" className="k-detail-copy" aria-label="番号をコピー" title="番号をコピー" onClick={copy}>
        <Copy size={12} aria-hidden="true" />
      </button>
      <span role="status" className="sr-only">
        {copied}
      </span>
      <span data-part="created" className="k-detail-created">
        作成 {mmddTime(ticket.created_at ?? null)}
      </span>
      <span className="k-detail-meta-side">
        <span data-part="start">
          開始日 <b>{ticket.start_on ? mmdd(ticket.start_on) : ""}</b>
        </span>
        <span data-part="due">
          期限{" "}
          <b data-over={over > 0 || undefined}>
            {ticket.due_on ? `${mmdd(ticket.due_on)}${over > 0 ? `（${over} 日過ぎ）` : ""}` : ""}
          </b>
        </span>
        {stage ? (
          <span data-part="stage" className="k-detail-stage" data-stage={stage.key ?? undefined}>
            {stage.name}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** 題名の行。me は見ている人の名前（読めるまで AI と話すは出さない） */
export function DetailTitle({ title, me }: { title: string; me: string }) {
  return (
    <header className="k-page-head">
      <div className="k-detail-title">
        <h1 id="ticket-title" title={title}>
          {title}
        </h1>
        {/* 767 以下は鈴を見出しの右に置く（キャンバス MobileList・K-138）。題名の行の高さは変えない */}
        <span className="k-detail-bell">
          <ShellBell />
        </span>
      </div>
      <div className="k-page-acts">
        <InertButton>複製</InertButton>
        {me ? (
          <InertButton>
            <Bot size={13} aria-hidden="true" />
            {`${me}のAI と話す`}
          </InertButton>
        ) : null}
        <InertButton label="ほかの操作" className="k-detail-more">
          …
        </InertButton>
      </div>
    </header>
  );
}
