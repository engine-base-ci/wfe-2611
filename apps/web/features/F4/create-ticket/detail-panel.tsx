"use client";
// チケットの詳細の右のパネル（K-226・キャンバス TicketDetail の aside「チケットのパネル」）。
//   タブ：属性（今いる）・やり取り・〈見ている人〉のAI（後の 2 つはまだ使えない＝押せない形・D-145.9）。
//   属性の中：担当・日付と時間・分類・本文の目次・実行の記録（最新）。
//   口が返さない値（業務の型・予定・実績・分類・節目・取引先・親）は空（嘘の値を書かない）。
//   グループは外枠と同じ問い合わせ（SCOPES_KEY）の答えから引く（口を 2 回呼ばない・G-16）。読めなければグループだけ空
//   差し込み口（K-380・今は中身をそのまま返す）：タブと中身は段 7 の F6.PanelTabsSlot、予定・実績は F6.EstimateSlot・F6.ActualTimeSlot、
//   担当者は段 9 の F8.AssigneeSlot
import { Bot, PanelRight } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import * as F6 from "@/features/F6/detail-slots";
import * as F8 from "@/features/F8/handover/detail-slots";
import { RunLatest } from "@/features/F5/delegate/run-log";
import type { RunView } from "@/features/F5/delegate/use-run";
import { InertButton, daysOver, mmddWeek } from "./detail-head";
import type { SlotTicket } from "./detail-slots";
import type { ScopeRow } from "./ticket-shell";

export interface PanelTicket {
  scope_id?: string | null;
  start_on: string | null;
  due_on: string | null;
  priority: string;
}

function Fields({ rows }: { rows: [string, ReactNode, { over?: boolean }?][] }) {
  return (
    <dl className="k-detail-fields">
      {rows.map(([k, v, o]) => (
        <div key={k} className="k-detail-field">
          <dt>{k}</dt>
          <dd data-over={o?.over || undefined}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Sec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="k-detail-panel-sec">
      <h2>{label}</h2>
      {children}
    </section>
  );
}

export interface DetailPanelProps {
  ticket: PanelTicket;
  assignee: string | null;
  approver: string | null;
  scopes: ScopeRow[] | null;
  sections: { key: string; label: string }[];
  runs: RunView[] | null;
  me: string;
  hidden: boolean;
  /** パネルを開いたときにキーボードの場所を移す先（パネルを閉じる） */
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  /** 差し込み口に渡す値（K-380） */
  slot: SlotTicket;
}

export function DetailPanel(p: DetailPanelProps) {
  const t = p.ticket;
  const over = daysOver(t.due_on);
  const scope = p.scopes?.find((s) => s.id === t.scope_id) ?? null;
  const group = scope ? (scope.ticket_prefix ? `${scope.name}（${scope.ticket_prefix}）` : scope.name) : "";
  const attrs = (
    <div className="k-detail-panel-body">
      <Sec label="担当">
        <Fields
          rows={[
            [
              "担当者",
              <F8.AssigneeSlot key="assignee" ticket={p.slot}>
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
              </F8.AssigneeSlot>,
            ],
            ["業務の型", ""],
            ["承認する人", p.approver ?? ""],
          ]}
        />
      </Sec>
      <Sec label="日付と時間">
        <Fields
          rows={[
            ["開始日", t.start_on ? mmddWeek(t.start_on) : ""],
            [
              "期限",
              <>
                {t.due_on ? mmddWeek(t.due_on) : ""}
                {over > 0 ? `${over} 日過ぎ` : ""}
                <InertButton label="期限を変える" size="sm" className="k-detail-due-btn">
                  ▾
                </InertButton>
              </>,
              { over: over > 0 },
            ],
            [
              "予定",
              <F6.EstimateSlot key="estimate" ticket={p.slot}>
                {""}
              </F6.EstimateSlot>,
            ],
            [
              "実績",
              <F6.ActualTimeSlot key="actual" ticket={p.slot}>
                {""}
              </F6.ActualTimeSlot>,
            ],
          ]}
        />
      </Sec>
      <Sec label="分類">
        <Fields
          rows={[
            ["グループ", group],
            ["分類", ""],
            ["節目", ""],
            ["取引先", ""],
            ["優先度", t.priority === "high" ? "高" : "中"],
            ["親", ""],
          ]}
        />
      </Sec>
      <nav aria-label="本文の目次" className="k-detail-panel-sec k-detail-toc">
        <h2>本文の目次</h2>
        {p.sections.map((s) => (
          <a key={s.key} className="k-detail-link" href={`#sec-${s.key}`}>
            {s.label}
          </a>
        ))}
      </nav>
      <RunLatest runs={p.runs} />
    </div>
  );
  return (
    <aside aria-label="チケットのパネル" className="k-detail-panel" hidden={p.hidden}>
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
            属性
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
