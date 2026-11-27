"use client";
// 詳細の右のパネルの項目（K-1153）。形は下絵 features/F4/doc/detail-views.tsx の ItemsPanel と同じ：
//   区（section[aria-label]・h2・k-detail-panel-sec）の中に dl.k-detail-fields の行（div.k-detail-field＝dt 名前・dd 値）。
//   用意してある項目と会社が足した項目を同じ並びに入れる（見出しを分けない・D-150.36・D-150.37）：
//   日付の型の会社の項目は「日付と時間」の終わり、ほかは「関連」の終わりに、並びの順で入れる。
//   出すのは .k-detail-panel-body の中の区だけ（aside・タブは使う側＝K-571 の DetailPanel が持つ）。
//   用意してある項目の中身は差し込み口（slots）で受ける。無ければ dd は空・グループと実績時間（actual）は渡したときだけ行を出す
import type { ReactNode } from "react";
import "@/features/F4/doc/doc.css";
import "@/features/F4/doc/extra.css";
import { PanelValue, type PanelField } from "./panel-value";
import { useFieldSave } from "./use-field-save";

export type PanelSlot =
  | "assignee"
  | "approver"
  | "priority"
  | "start"
  | "due"
  | "estimate"
  | "actual"
  | "group"
  | "milestone"
  | "parent"
  | "specs";

export interface ItemsPanelProps {
  ticketId: string;
  fields: readonly PanelField[];
  slots?: Partial<Record<PanelSlot, ReactNode>>;
  /** 区に足す class（段 8 の期限の小窓を重ねる印 k-f7-due-anchor を「日付と時間」に付ける・K-599） */
  sectionClass?: { dates?: string };
  onReload: () => void;
}

const NO_SPECS = "確認項目はまだありません。足すと、終わったときに機械と人が確かめます";

function Item({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="k-detail-field">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Section({ name, className, children }: { name: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={name} className={className ? `k-detail-panel-sec ${className}` : "k-detail-panel-sec"}>
      <h2>{name}</h2>
      {children}
    </section>
  );
}

export function ItemsPanel({ ticketId, fields, slots = {}, sectionClass = {}, onReload }: ItemsPanelProps) {
  const saver = useFieldSave(ticketId);
  const sorted = [...fields].sort((a, b) => a.position - b.position);
  const row = (f: PanelField): ReactNode => (
    <Item key={f.id} k={f.name} v={<PanelValue field={f} saver={saver} onReload={onReload} />} />
  );
  return (
    <>
      <Section name="担当">
        <dl className="k-detail-fields">
          <Item k="担当者" v={slots.assignee} />
          <Item k="承認する人" v={slots.approver} />
          <Item k="優先度" v={slots.priority} />
        </dl>
      </Section>
      <Section name="日付と時間" {...(sectionClass.dates ? { className: sectionClass.dates } : {})}>
        <dl className="k-detail-fields">
          <Item k="開始日" v={slots.start} />
          <Item k="期限" v={slots.due} />
          <Item k="予定時間" v={slots.estimate} />
          {slots.actual !== undefined ? <Item k="実績時間" v={slots.actual} /> : null}
          {sorted.filter((f) => f.field_type === "date").map(row)}
        </dl>
      </Section>
      <Section name="関連">
        <dl className="k-detail-fields">
          {slots.group !== undefined ? <Item k="グループ" v={slots.group} /> : null}
          <Item k="節目" v={slots.milestone} />
          <Item k="親" v={slots.parent} />
          {sorted.filter((f) => f.field_type !== "date").map(row)}
        </dl>
      </Section>
      <Section name="確認項目">{slots.specs ?? <p className="k-f4d-hint">{NO_SPECS}</p>}</Section>
    </>
  );
}
