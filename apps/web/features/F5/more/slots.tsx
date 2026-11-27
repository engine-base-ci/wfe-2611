"use client";
// 段 6 の画面の葉の差し込み口の器（K-730）。任せる帯・承認の帯・成果物のカード・承認の確かめの小窓・承認待ち・右のパネルが置く。
//   器は受けた props をそのまま先（fills/<束>.tsx の <器の名前>Fill）に渡すだけで、判断を持たない。
//   先は最初、今の本線と同じ物（押せない形のボタン・今の部品・何も出さない）を返し、持ち主の葉が先のファイルの中だけを本物に替える。
//   props の型はここに置き、先が import する。葉は型を足すだけ（任意で足す・消さない・意味を変えない）。
//   帯のすぐ下の 1 行（TicketTrail）と帯の上の知らせ（TicketNotice）は trail.ts の store を読んで描く
import type { ReactNode } from "react";
import { NoticeBox } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import type { RunView } from "@/features/F5/delegate/use-run";
import type { BandApproval } from "@/features/F5/approve-complete/decide";
import type { QueueRow } from "@/features/F5/approve-complete/queue";
import { useNotice, useTrail } from "./trail";
import { RunStoppedFill, StopApprovalActFill, StopRunActFill } from "./fills/stop";
import { ExecuteQueuedFill } from "./fills/withdraw";
import { ApproveChecksFill, ChecksFill, QueueCheckCellFill } from "./fills/checks";
import { ArtifactAreaFill, SelfEditActFill } from "./fills/self-edit";
import { DryRunActFill, DryRunFill } from "./fills/dry-run";
import { QueueEmptyFill, QueueToolsFill } from "./fills/queue-tools";
/** 承認待ちの一覧の問い合わせの足し（K-749）。画面のファイルは差し込み口と同じくここから読む（K730-UI-015） */
export { useQueueQuery } from "./fills/queue-tools";
import { QueueHistoryFill } from "./fills/queue-history";
import { QueueFocusFill } from "./fills/queue-focus";
import { QueueBulkFill } from "./fills/queue-bulk";
import { TalkActFill, TicketAiTabButtonFill, TicketAiTabFill } from "./fills/talk";
import "./more.css";

// ---------------------------------------------------------------- props の型（先が import する）
export interface StopRunActProps {
  run: RunView;
  where: "make" | "execute";
  onChanged: () => Promise<void>;
}
export interface RunStoppedProps {
  run: RunView;
  box: ReactNode;
}
export interface StopApprovalActProps {
  approval: BandApproval;
  /** 押す物の見た目のクラス（続けて裁くの足の並び k-more-f-stop など）。無ければ今のまま */
  className?: string;
  ticketId?: string;
  target?: string;
  onChanged: () => Promise<void>;
  onFailed: (r: CallErr) => Promise<void>;
}
export interface ExecuteQueuedProps {
  run: RunView;
  ticketId: string;
  target?: string;
  box: ReactNode;
  onChanged: () => Promise<void>;
}
export interface ChecksProps {
  where: "stopped" | "approval";
  ticketId?: string;
  run?: RunView | null;
  approvalId?: string | null;
}
export interface ApproveChecksProps {
  approvalId?: string;
}
export interface QueueCheckCellProps {
  row: QueueRow;
  layout: "table" | "card";
}
export interface SelfEditActProps {
  approval: BandApproval;
  ticketId?: string;
  onChanged: () => Promise<void>;
  onFailed: (r: CallErr) => Promise<void>;
}
export interface ArtifactAreaProps {
  approvalId: string;
  ticketId?: string;
  artifact: { version: number; text: string } | null;
  card: ReactNode;
}
export interface DryRunActProps {
  approvalId?: string;
  ticketId?: string;
}
export interface DryRunProps {
  approvalId: string;
  ticketId?: string;
}
export interface QueueToolsProps {
  total: number;
  layout: "table" | "card";
  /** 表の道具の行の右の端に並べ替えと一緒に並べる物（まとめて承認・決めた履歴の差し込み口） */
  end?: ReactNode;
}
export interface QueueEmptyProps {
  empty: ReactNode;
}
export interface QueueHistoryProps {
  where: "tools" | "empty";
}
export interface QueueFocusProps {
  rows: QueueRow[];
  total: number;
}
export interface QueueBulkProps {
  part: "head" | "row" | "tool" | "band" | "card";
  /** band の置き場（table＝表の上・mobile＝スマホのカードの後ろ。幅で片方だけを出すのは先が BulkBar に渡す） */
  at?: "table" | "mobile";
  row?: QueueRow;
  rows?: QueueRow[];
  total?: number;
}
export interface TalkActProps {
  ticketId: string;
  run: RunView | null;
  kind: "talk";
}
export interface TicketAiTabButtonProps {
  me: string;
  active: boolean;
  onTab?: (tab: "ai") => void;
}
export interface TicketAiTabProps {
  ticketId: string;
  me: string;
}

// ---------------------------------------------------------------- 器（props を先に渡すだけ）
export function StopRunActSlot(props: StopRunActProps): ReactNode {
  return <StopRunActFill {...props} />;
}
export function RunStoppedSlot(props: RunStoppedProps): ReactNode {
  return <RunStoppedFill {...props} />;
}
export function StopApprovalActSlot(props: StopApprovalActProps): ReactNode {
  return <StopApprovalActFill {...props} />;
}
export function ExecuteQueuedSlot(props: ExecuteQueuedProps): ReactNode {
  return <ExecuteQueuedFill {...props} />;
}
export function ChecksSlot(props: ChecksProps): ReactNode {
  return <ChecksFill {...props} />;
}
export function ApproveChecksSlot(props: ApproveChecksProps): ReactNode {
  return <ApproveChecksFill {...props} />;
}
export function QueueCheckCellSlot(props: QueueCheckCellProps): ReactNode {
  return <QueueCheckCellFill {...props} />;
}
export function SelfEditActSlot(props: SelfEditActProps): ReactNode {
  return <SelfEditActFill {...props} />;
}
export function ArtifactAreaSlot(props: ArtifactAreaProps): ReactNode {
  return <ArtifactAreaFill {...props} />;
}
export function DryRunActSlot(props: DryRunActProps): ReactNode {
  return <DryRunActFill {...props} />;
}
export function DryRunSlot(props: DryRunProps): ReactNode {
  return <DryRunFill {...props} />;
}
export function QueueToolsSlot(props: QueueToolsProps): ReactNode {
  return <QueueToolsFill {...props} />;
}
export function QueueEmptySlot(props: QueueEmptyProps): ReactNode {
  return <QueueEmptyFill {...props} />;
}
export function QueueHistorySlot(props: QueueHistoryProps): ReactNode {
  return <QueueHistoryFill {...props} />;
}
export function QueueFocusSlot(props: QueueFocusProps): ReactNode {
  return <QueueFocusFill {...props} />;
}
export function QueueBulkSlot(props: QueueBulkProps): ReactNode {
  return <QueueBulkFill {...props} />;
}
export function TalkActSlot(props: TalkActProps): ReactNode {
  return <TalkActFill {...props} />;
}
export function TicketAiTabButtonSlot(props: TicketAiTabButtonProps): ReactNode {
  return <TicketAiTabButtonFill {...props} />;
}
export function TicketAiTabSlot(props: TicketAiTabProps): ReactNode {
  return <TicketAiTabFill {...props} />;
}

// ---------------------------------------------------------------- 帯のすぐ下の 1 行・帯の上の知らせ
/** 帯のすぐ下の行（下絵の TrailLine と同じ形）。無ければ何も描かない */
export function TicketTrail({ ticketId }: { ticketId: string }): ReactNode {
  const lines = useTrail(ticketId);
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map((l, i) => (
        <p key={i} className="k-more-trail">
          <time>{l.time}</time>
          <span>{l.text}</span>
        </p>
      ))}
    </>
  );
}

/** 帯の上の知らせ（口が断った・1 つだけ）。無ければ何も描かない */
export function TicketNotice({ ticketId }: { ticketId: string }): ReactNode {
  const text = useNotice(ticketId);
  return text ? <NoticeBox tone="warn">{text}</NoticeBox> : null;
}
