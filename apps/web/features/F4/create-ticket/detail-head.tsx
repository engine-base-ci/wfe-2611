"use client";
// チケットの詳細の頭（K-226・キャンバス TicketDetail）：頭の行（種別の札・番号・番号をコピー・作成・開始日・期限・段の札）と
//   題名の行（h1・右に 複製・版と差分・AI に任せる・完了にする・ほかの操作＝下絵 v2・K-571）。
//   本当の値が無い字は空にする（「—」を出さない・作成者の名前は口が返さないので出さない）。
//   複製・版と差分は入口の差し込み口（detail-entry-slots.tsx・中身は K-446・K-449）。ほかの操作は「…」のメニュー（detail-more/more-menu.tsx・K-458。slot の無い下絵の呼び手は押せない形のまま・D-145.9）。番号のコピーは手元のクリップボードだけ
//   段の札は StagePill。詳細の本体は段 7 の差し込み口（F6.StageSlot）で包んだ札を stageSlot に渡す（K-380）
import { Bot, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/k";
import { DetailMore } from "@/features/F4/detail-more/more-menu";
import { DuplicateEntry, VersionsEntry } from "./detail-entry-slots";
import type { SlotTicket } from "./detail-slots";

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

export type HeadStage = { key?: string | null; name: string } | null;

/** 頭の行の段の札（段が無ければ出さない） */
export function StagePill({ stage }: { stage: HeadStage }) {
  if (!stage) return null;
  return (
    <span data-part="stage" className="k-detail-stage" data-stage={stage.key ?? undefined}>
      {stage.name}
    </span>
  );
}

export function DetailMeta({
  ticket,
  kind,
  stage,
  stageSlot,
}: {
  ticket: HeadTicket;
  kind: { name: string; color?: string | null } | null;
  stage: HeadStage;
  /** 段の札の差し込み口（K-380・渡されれば札の代わりに置く。無ければ StagePill） */
  stageSlot?: ReactNode;
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
        {stageSlot ?? <StagePill stage={stage} />}
      </span>
    </div>
  );
}

/** 題名の行（下絵 v2）。右に 複製・版と差分（入口の差し込み口）・acts（AI に任せる・完了にするの差し込み口）・ほかの操作。
 *  slot が無い呼び手（段 7・段 9 の下絵 f6・f8）は前の並び（複製・〈名前〉のAI と話す・ほかの操作）のまま描く */
export function DetailTitle({
  title,
  me,
  slot,
  acts,
}: {
  title: string;
  me: string;
  /** 差し込み口に渡す値（K-380）。本物の詳細は必ず渡す */
  slot?: SlotTicket;
  /** 題の行の「AI に任せる」「完了にする」の差し込み口（K-573・K-572） */
  acts?: ReactNode;
}) {
  return (
    <header className="k-page-head">
      <div className="k-detail-title">
        <h1 id="ticket-title" title={title}>
          {title}
        </h1>
      </div>
      <div className="k-page-acts">
        {slot ? (
          <>
            <DuplicateEntry ticket={slot} />
            <VersionsEntry ticket={slot} />
            {acts}
            <DetailMore ticket={slot} />
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </header>
  );
}
