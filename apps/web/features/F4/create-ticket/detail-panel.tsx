"use client";
// チケットの詳細の右のパネル（K-226・下絵 v2 の ItemsPanel・K-571）。
//   タブ：項目（今いる）・やり取り・〈見ている人〉のAI（タブの列は段 7 の F6.PanelTabsSlot の中で F6 の TalkTabs が描く）。
//   項目の中：区（担当・日付と時間・関連・確認項目）は K-1153 の ItemsPanel が組む（会社の項目も同じ並び・D-150.36・D-150.37）。
//     この葉は差し込み口（用意してある項目の値）を渡すだけ。区の後ろに実行の記録（最新・K-62）。本文の目次は出さない。
//   口が返さない値（節目・業務の型）は空（嘘の値を書かない）。取引先の行は出さない（answer=4961f0280e9a）。
//   グループは外枠と同じ問い合わせ（SCOPES_KEY）の答えから引く（口を 2 回呼ばない・G-16）。読めなければグループの行は出さない
//   差し込み口（K-380）：タブと中身は段 7 の F6.PanelTabsSlot、予定時間・実績時間は F6.EstimateSlot・F6.ActualTimeSlot、
//   担当者は段 9 の F8.AssigneeSlot、親の行は ParentRowSlot（K-443）、確認項目は K-450 の SpecsItem、期限の ▾ は段 8 の F7.DueSlot（K-599）
import { Bot, PanelRight } from "lucide-react";
import type { ComponentProps, RefObject } from "react";
import * as F6 from "@/features/F6/detail-slots";
import * as F7 from "@/features/F7/detail-slots";
import * as F8 from "@/features/F8/handover/detail-slots";
import { RunLatest } from "@/features/F5/delegate/run-log";
import type { RunView } from "@/features/F5/delegate/use-run";
import { ItemsPanel } from "@/features/F4/items/items-panel";
import { SpecsItem } from "@/features/F4/specs/specs-item";
import { InertButton, daysOver, mmddWeek } from "./detail-head";
import { ParentRowSlot } from "./detail-entry-slots";
import type { SlotTicket } from "./detail-slots";
import type { DetailField } from "./detail-types";
import type { ScopeRow } from "./ticket-shell";
import { GuestShareSection } from "@/features/F11/share/share-section";

export interface PanelTicket {
  scope_id?: string | null;
  start_on: string | null;
  due_on: string | null;
  priority: string;
}

type PanelFields = ComponentProps<typeof ItemsPanel>["fields"];

export interface DetailPanelProps {
  ticketId: string;
  ticket: PanelTicket;
  assignee: string | null;
  approver: string | null;
  scopes: ScopeRow[] | null;
  /** 会社の項目（getTicket の fields・並びの順） */
  fields: DetailField[];
  /** 確認項目の件数（getTicket の spec_count） */
  specCount: number;
  /** 確認項目を足す小窓（詳細の一番上が合図を聞いて開く・K-450 の外から開ける口） */
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  runs: RunView[] | null;
  me: string;
  hidden: boolean;
  /** パネルに足す class（段 8 の印など） */
  className?: string;
  /** パネルを開いたときにキーボードの場所を移す先（パネルを閉じる） */
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  /** 詳細を読み直す（会社の項目が消されたとき・K-1153） */
  onReload: () => void;
  /** 差し込み口に渡す値（K-380） */
  slot: SlotTicket;
}

const groupOf = (scopes: ScopeRow[] | null, id: string | null | undefined): string => {
  const s = scopes?.find((x) => x.id === id) ?? null;
  if (!s) return "";
  return s.ticket_prefix ? `${s.name}（${s.ticket_prefix}）` : s.name;
};

export function DetailPanel(p: DetailPanelProps) {
  const t = p.ticket;
  const over = daysOver(t.due_on);
  const group = groupOf(p.scopes, t.scope_id);
  const attrs = (
    <div className="k-detail-panel-body">
      <ItemsPanel
        ticketId={p.ticketId}
        fields={p.fields as unknown as PanelFields}
        onReload={p.onReload}
        sectionClass={{ dates: "k-f7-due-anchor" }}
        slots={{
          assignee: (
            <F8.AssigneeSlot ticket={p.slot}>
              {p.assignee ? (
                <span className="k-detail-who">
                  <span className="k-detail-avatar" aria-hidden="true">
                    {p.assignee.slice(0, 1)}
                  </span>
                  {p.assignee}
                </span>
              ) : (
                ""
              )}
            </F8.AssigneeSlot>
          ),
          approver: p.approver ?? "",
          priority: t.priority === "high" ? "高" : "中",
          start: t.start_on ? mmddWeek(t.start_on) : "",
          due: (
            <span data-over={over > 0 || undefined}>
              {t.due_on ? mmddWeek(t.due_on) : ""}
              {over > 0 ? `${over} 日過ぎ` : ""}
              <F7.DueSlot ticket={p.slot}>
                <InertButton label="期限を変える" size="sm" className="k-detail-due-btn">
                  ▾
                </InertButton>
              </F7.DueSlot>
            </span>
          ),
          estimate: <F6.EstimateSlot ticket={p.slot}>{""}</F6.EstimateSlot>,
          actual: <F6.ActualTimeSlot ticket={p.slot}>{""}</F6.ActualTimeSlot>,
          ...(group ? { group } : {}),
          milestone: "",
          parent: <ParentRowSlot ticket={p.slot} />,
          specs: (
            <SpecsItem
              mode="detail"
              ticketId={p.ticketId}
              count={p.specCount}
              addOpen={p.addOpen}
              onAddOpenChange={p.onAddOpenChange}
            />
          ),
        }}
      />
      {/* 「ゲストに見せる」の区画（F11・K-905）：区の後・実行の記録の前（answer=9096d8002961） */}
      <GuestShareSection ticket={p.slot} />
      <RunLatest runs={p.runs} />
    </div>
  );
  return (
    <aside
      aria-label="チケットのパネル"
      className={p.className ? `k-detail-panel ${p.className}` : "k-detail-panel"}
      hidden={p.hidden}
    >
      <button
        ref={p.closeRef}
        type="button"
        className="k-detail-panel-close"
        aria-label="パネルを閉じる"
        title="パネルを閉じる"
        onClick={p.onClose}
      >
        <PanelRight size={16} aria-hidden="true" />
      </button>
      <F6.PanelTabsSlot ticket={p.slot} attrs={attrs}>
        <nav aria-label="パネルのタブ" className="k-detail-tabs">
          <button type="button" aria-current="page">
            項目
          </button>
          <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
            やり取り
          </button>
          {p.me ? (
            <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
              <Bot size={14} aria-hidden="true" />
              {`${p.me}のAI`}
            </button>
          ) : null}
        </nav>
        {attrs}
      </F6.PanelTabsSlot>
    </aside>
  );
}
