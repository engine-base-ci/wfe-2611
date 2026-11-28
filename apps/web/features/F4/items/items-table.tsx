"use client";
// 項目の表（K-569・作る面の 2 列の表）。並びと部品は下絵 features/F4/doc/views.tsx の ItemsTable と同じ：
//   用意してある 9 行（状態・担当者・優先度・節目・開始日・期限・予定時間・実績時間・親）→ 会社の項目（見出しで分けない）→ 全幅の確認項目。
//   行ごとの差し込み口（slots）があれば中身をそれに替え、無ければ作る面の既定の中身を出す（K-442 が作る面に組む）。
//   詳細の右のパネルは別の部品（K-1153 の ItemsPanel）
import type { ReactNode } from "react";
import { Button, Callout, Select, TextField } from "@/components/k";
import { Pair } from "@/features/F4/doc/views";
import { ParentEntry } from "@/features/F4/parent/views";
import { CustomRows } from "./custom-rows";
import type { FieldValue, TicketField } from "./field-values";
import type { FieldsState } from "./use-ticket-fields";

/** 既定の行の値の鍵（values の中で会社の項目の id と並ぶ） */
export type CoreKey = "assignee" | "priority" | "priority_reason" | "start" | "estimate";
/** 差し込み口の行の鍵 */
export type SlotKey =
  "stage" | "assignee" | "priority" | "milestone" | "start" | "due" | "estimate" | "actual" | "parent" | "specs";

export interface Person {
  id: string;
  display_name: string;
}

export interface ItemsTableProps {
  mode?: "create";
  /** 今の種別の会社の項目（答えの並びのまま） */
  fields: readonly TicketField[];
  values: Readonly<Record<string, FieldValue>>;
  errors?: Readonly<Record<string, string>>;
  onChange: (key: string, value: FieldValue) => void;
  slots?: Partial<Record<SlotKey, ReactNode>>;
  /** 担当者に選べる人（抜けていない・止められていない人） */
  people?: readonly Person[];
  /** 自分の member_id（担当者の既定・「私が担当」） */
  me?: string | null;
  /** 会社の項目の読みの状態（読み中は行を出さない・読めなければ赤い箱と「読み直す」） */
  customState?: FieldsState;
  onRetry?: () => void;
}

const STAGES = [
  { value: "todo", label: "未着手" },
  { value: "doing", label: "作業中" },
];
const PRIORITIES = [
  { value: "mid", label: "中" },
  { value: "high", label: "高" },
];
const SPECS_EMPTY = "確認項目はまだありません。足すと、終わったときに機械と人が確かめます";
const text = (v: FieldValue | undefined): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";

export function ItemsTable({
  fields,
  values,
  errors = {},
  onChange,
  slots = {},
  people = [],
  me = null,
  customState = "ok",
  onRetry,
}: ItemsTableProps) {
  const assignee = typeof values.assignee === "string" ? values.assignee : me;
  const priority = values.priority === "high" ? "high" : "mid";
  return (
    <div className="k-f4d-grid" role="group" aria-label="項目" aria-busy={customState === "loading"}>
      <Pair name="状態">
        {slots.stage ?? <Select label="状態" name="c_stage" defaultValue="todo" options={STAGES} />}
      </Pair>
      <Pair name="担当者" required>
        {slots.assignee ?? (
          <div className="k-f4d-inline">
            <Select
              label="担当者"
              name="c_assignee"
              required
              value={assignee}
              options={people.map((p) => ({ value: p.id, label: p.display_name }))}
              onValueChange={(v) => onChange("assignee", v)}
            />
            <Button variant="outlined" size="sm" type="button" onClick={() => onChange("assignee", me)}>
              私が担当
            </Button>
          </div>
        )}
      </Pair>
      <Pair name="優先度">
        {slots.priority ?? (
          <Select
            label="優先度"
            name="c_priority"
            value={priority}
            options={PRIORITIES}
            onValueChange={(v) => onChange("priority", v ?? "mid")}
          />
        )}
      </Pair>
      {!slots.priority && priority === "high" ? (
        <Pair name="高にする理由" required>
          <TextField
            label="高にする理由"
            name="c_priority_reason"
            required
            value={text(values.priority_reason)}
            error={errors.priority_reason}
            onChange={(e) => onChange("priority_reason", e.target.value)}
          />
        </Pair>
      ) : null}
      <Pair name="節目">
        {slots.milestone ?? (
          <button
            type="button"
            role="combobox"
            aria-expanded="false"
            aria-label="節目"
            aria-disabled="true"
            title="まだ使えません"
            className="k-select-trigger"
            onClick={(e) => e.preventDefault()}
            onKeyDown={(e) => e.preventDefault()}
          >
            <span>選ぶ</span>
            <span aria-hidden="true">▾</span>
          </button>
        )}
      </Pair>
      <Pair name="開始日">
        {slots.start ?? (
          <TextField
            label="開始日"
            name="c_start"
            type="date"
            value={text(values.start)}
            onChange={(e) => onChange("start", e.target.value)}
          />
        )}
      </Pair>
      <Pair name="期限" required>
        {slots.due ?? <TextField label="期限" name="c_due" type="date" required defaultValue="" />}
      </Pair>
      <Pair name="予定時間">
        {slots.estimate ?? (
          <TextField
            label="予定時間"
            name="c_estimate"
            description="このチケットにかかる見込みの時間です。例：1、0.25、36"
            value={text(values.estimate)}
            error={errors.estimate}
            onChange={(e) => onChange("estimate", e.target.value)}
          />
        )}
      </Pair>
      <Pair name="実績時間">
        {slots.actual ?? (
          <TextField label="実績時間" name="c_actual" value="" description="かかった作業時間です" readOnly />
        )}
      </Pair>
      <Pair name="親">{slots.parent ?? <ParentEntry parent={null} />}</Pair>
      {customState === "ok" ? <CustomRows fields={fields} values={values} errors={errors} onChange={onChange} /> : null}
      {customState === "error" ? (
        <Pair name="会社の項目" full>
          <Callout tone="danger">
            会社の項目を読めませんでした
            <Button variant="outlined" size="sm" type="button" onClick={onRetry}>
              読み直す
            </Button>
          </Callout>
        </Pair>
      ) : null}
      <Pair name="確認項目" full>
        {slots.specs ?? <p className="k-f4d-hint">{SPECS_EMPTY}</p>}
      </Pair>
    </div>
  );
}

/** 表の行の名前の並び（誤りの最初の欄にキーボードの場所を移すため・既定の行と会社の項目） */
export const rowNameOf = (fields: readonly TicketField[], key: string): string | null =>
  key === "priority_reason"
    ? "高にする理由"
    : key === "estimate"
      ? "予定時間"
      : (fields.find((f) => f.id === key)?.name ?? null);
