"use client";
// 条件を組む（キャンバス LsFilter・一覧の検索条件「詳しく」・K-478）。
//   上から：題（件数は出さない：口が総数を返さない）／ことばで探す（AI・まだ使えないので押せない形・D-145.9）／条件の行（かつ）／＋ 条件・＋ まとまり（押せない形）／足の行。
//   行は 項目・言い方・値の選び（<select>）と × で外す。口が AND と 1 つの値だけなので、項目は 担当者・状態・種別・期限（分類は押せない）。
//   「この条件で見る」で行を欄に直して（filter-params.ts の paramsOf）呼ぶ側へ渡す。誤りのある行は行の下に文を出し、渡さない。
//   items（見本の行）だけを渡すと、見本の値をそのまま描く（モック）
import { useState, type ReactNode } from "react";
import { Button } from "@/components/k";
import {
  COND_FIELDS,
  COND_OPS,
  DUE_VALUES,
  NOT_DONE,
  paramsOf,
  rowError,
  todayJst,
  type CondField,
  type CondRow,
} from "./filter-params";

export interface ConditionRow {
  field: string;
  /** 「が」「でない」「に含む」 */
  op: string;
  /** 値の札（鈴木・鈴木のAI など） */
  values?: readonly string[];
  /** 値が 1 つの字（今週（11/02〜11/08）・見積） */
  text?: string;
}

export type ConditionItem =
  { kind: "row"; row: ConditionRow } | { kind: "group"; join: string; rows: readonly ConditionRow[] };

export interface ConditionChoices {
  people: readonly { id: string; name: string }[];
  kinds: readonly { id: string; name: string }[];
  /** 段（読む前は null） */
  stages: readonly { id: string; name: string }[] | null;
}

export interface ConditionBuilderProps {
  /** ことばで探すの見本の文（AI がまだ使えない間は押せない形） */
  aiSample: string;
  /** 見本の行（モック）。choices を渡したときは使わない */
  items?: readonly ConditionItem[];
  /** 選びに出す名前。渡したら行を組める */
  choices?: ConditionChoices;
  /** 状態の値を選ぶのに段の名前が要るとき（1 回だけ読む） */
  onNeedStages?: () => void;
  /** 「この条件で見る」：行を直した欄 */
  onApply?: (params: Record<string, string>) => void;
  /** 「かんたんに戻す」 */
  onBack?: () => void;
  /** 足の「検索条件を保存」（一覧では K-479 の SaveViewButton を渡す。無ければ見本の押せない形のボタン） */
  saveAction?: ReactNode;
}

interface Opt {
  value: string;
  label: string;
}

const PENDING_PROPS = { "aria-disabled": "true" as const, tabIndex: -1 };
const fieldLabel = (f: CondField | ""): string => COND_FIELDS.find((x) => x.value === f)?.label ?? "条件";

function valueOptions(r: CondRow, c: ConditionChoices): Opt[] {
  const named = (xs: readonly { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  if (r.field === "assignee") return named(c.people);
  if (r.field === "kind") return named(c.kinds);
  if (r.field === "stage" && r.op === "でない") return [{ value: NOT_DONE, label: "完了" }];
  if (r.field === "stage") return named(c.stages ?? []);
  if (r.field === "due") return DUE_VALUES.map((d) => ({ value: d.value, label: d.label }));
  return [];
}

interface RowViewProps {
  lead: string;
  field: { value: string; options: readonly Opt[]; onChange?: (v: string) => void };
  op: { value: string; options: readonly Opt[]; onChange?: (v: string) => void };
  val: { value: string; options: readonly Opt[]; onChange?: (v: string) => void };
  range?: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void } | undefined;
  removeLabel: string;
  onRemove?: () => void;
  error?: string | null;
}

function Pick({
  label,
  value,
  options,
  onChange,
  placeholder,
}: { label: string; placeholder?: string } & RowViewProps["field"]) {
  return (
    <select
      className="k-f7-saved-pick"
      aria-label={label}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={onChange === undefined && options.length === 0}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function RowView({ lead, field, op, val, range, removeLabel, onRemove, error }: RowViewProps) {
  return (
    <li className="k-f7-saved-cond-row">
      <span className="k-f7-saved-cond-lead">{lead}</span>
      <select
        className="k-f7-saved-pick"
        aria-label="項目"
        value={field.value}
        onChange={(e) => field.onChange?.(e.target.value)}
      >
        <option value="">項目を選ぶ</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="class" disabled>
          分類
        </option>
      </select>
      <Pick label="言い方" {...op} />
      <span className="k-f7-saved-cond-values">
        <Pick label="値" placeholder="値を選ぶ" {...val} />
        {range ? (
          <>
            <input
              className="k-f7-saved-pick"
              type="date"
              aria-label="から"
              value={range.from}
              onChange={(e) => range.onFrom(e.target.value)}
            />
            <input
              className="k-f7-saved-pick"
              type="date"
              aria-label="まで"
              value={range.to}
              onChange={(e) => range.onTo(e.target.value)}
            />
          </>
        ) : null}
      </span>
      <button type="button" className="k-f7-saved-cond-x" aria-label={`外す：${removeLabel}`} onClick={onRemove}>
        ×
      </button>
      {error ? <p className="k-f7-saved-cond-error">{error}</p> : null}
    </li>
  );
}

/** 見本の行（モック）を同じ形で描く */
function SampleRow({ lead, row }: { lead: string; row: ConditionRow }) {
  const value = row.values?.join("・") ?? row.text ?? "";
  return (
    <RowView
      lead={lead}
      field={{ value: "sample", options: [{ value: "sample", label: row.field }] }}
      op={{ value: row.op, options: [{ value: row.op, label: row.op }] }}
      val={{ value: "sample", options: [{ value: "sample", label: value }] }}
      removeLabel={row.field}
    />
  );
}

function SampleItems({ items }: { items: readonly ConditionItem[] }) {
  return (
    <>
      {items.map((it, i) =>
        it.kind === "row" ? (
          <SampleRow key={`${it.row.field}-${i}`} lead={i === 0 ? "条件" : "かつ"} row={it.row} />
        ) : (
          <li key={`group-${i}`} className="k-f7-saved-cond-group">
            <p className="k-f7-saved-cond-lead">まとまり：{it.join}</p>
            <ul className="k-f7-saved-cond-list" aria-label="まとまりの条件">
              {it.rows.map((r, j) => (
                <SampleRow key={`${r.field}-${j}`} lead={j === 0 ? "" : "または"} row={r} />
              ))}
            </ul>
          </li>
        ),
      )}
    </>
  );
}

const blank = (id: number): CondRow => ({ id, field: "", op: "", value: "", from: "", to: "" });

function useRows(onNeedStages?: () => void) {
  const [rows, setRows] = useState<readonly CondRow[]>([]);
  const [seq, setSeq] = useState(1);
  const [shown, setShown] = useState(false);
  const add = () => {
    setRows((cur) => [...cur, blank(seq)]);
    setSeq((n) => n + 1);
  };
  const patch = (id: number, next: Partial<CondRow>) =>
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...next } : r)));
  const setField = (id: number, v: string) => {
    const field = (COND_FIELDS.some((f) => f.value === v) ? v : "") as CondField | "";
    if (field === "stage") onNeedStages?.();
    patch(id, { field, op: field ? COND_OPS[field][0]! : "", value: "", from: "", to: "" });
  };
  const remove = (id: number) => setRows((cur) => cur.filter((r) => r.id !== id));
  return { rows, shown, setShown, add, patch, setField, remove };
}

function EditRows({ s, choices }: { s: ReturnType<typeof useRows>; choices: ConditionChoices }) {
  return (
    <>
      {s.rows.map((r, i) => (
        <RowView
          key={r.id}
          lead={i === 0 ? "条件" : "かつ"}
          field={{ value: r.field, options: COND_FIELDS, onChange: (v) => s.setField(r.id, v) }}
          op={{
            value: r.op,
            options: r.field ? COND_OPS[r.field].map((o) => ({ value: o, label: o })) : [],
            onChange: (v) => s.patch(r.id, { op: v, value: "" }),
          }}
          val={{ value: r.value, options: valueOptions(r, choices), onChange: (v) => s.patch(r.id, { value: v }) }}
          range={
            r.field === "due" && r.value === "range"
              ? {
                  from: r.from,
                  to: r.to,
                  onFrom: (v) => s.patch(r.id, { from: v }),
                  onTo: (v) => s.patch(r.id, { to: v }),
                }
              : undefined
          }
          removeLabel={fieldLabel(r.field)}
          onRemove={() => s.remove(r.id)}
          error={s.shown ? rowError(r) : null}
        />
      ))}
    </>
  );
}

export function ConditionBuilder({
  aiSample,
  items = [],
  choices,
  onNeedStages,
  onApply,
  onBack,
  saveAction,
}: ConditionBuilderProps) {
  const s = useRows(onNeedStages);
  const apply = () => {
    if (s.rows.some((r) => rowError(r) !== null)) return s.setShown(true);
    s.setShown(false);
    onApply?.(paramsOf(s.rows, todayJst()));
  };
  return (
    <section className="k-f7-saved-cond" aria-label="条件を組む">
      <div className="k-f7-saved-cond-head">
        <b>条件を組む</b>
      </div>
      <div className="k-f7-saved-ai" aria-disabled="true" title="ことばで探す（準備中）">
        <span className="k-f7-saved-ai-mark" aria-hidden="true">
          AI
        </span>
        <span className="k-f7-saved-ai-text">ことばで探す：「{aiSample}」</span>
        <Button size="sm" variant="outlined" {...PENDING_PROPS} title="条件にする（準備中）">
          条件にする
        </Button>
      </div>
      <ul className="k-f7-saved-cond-list" aria-label="条件">
        {choices ? <EditRows s={s} choices={choices} /> : <SampleItems items={items} />}
      </ul>
      <div className="k-f7-saved-cond-add">
        <Button size="sm" variant="outlined" onClick={choices ? s.add : undefined}>
          ＋ 条件
        </Button>
        <Button size="sm" variant="outlined" {...PENDING_PROPS} title="まとまり（準備中）">
          ＋ まとまり
        </Button>
      </div>
      <div className="k-f7-saved-cond-foot">
        <Button variant="ghost" size="sm" onClick={onBack}>
          かんたんに戻す
        </Button>
        <span className="k-f7-saved-cond-foot-acts">
          {saveAction ?? (
            <Button variant="outlined" size="sm" {...PENDING_PROPS} title="検索条件を保存（準備中）">
              検索条件を保存
            </Button>
          )}
          <Button size="sm" onClick={apply}>
            この条件で見る
          </Button>
        </span>
      </div>
    </section>
  );
}
