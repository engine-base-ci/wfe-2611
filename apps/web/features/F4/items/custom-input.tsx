"use client";
// 会社の項目の入力（K-569・7 つの型）。組み立ては下絵（features/F4/doc/views.tsx の CustomPairs・create-views.tsx の RequiredTypes）と同じ：
//   文字・数・日付・選ぶは components/k の部品（説明は .k-desc）。複数選ぶは fieldset.k-f4d-multi（見出し legend.k-f4d-sr・説明 p.k-f4d-hint）。
//   チェックは label.k-f4d-check で箱の横の字は説明（無ければ項目の名前）。誤りがあるとき、複数選ぶ・チェックは説明の代わりに p.k-err。
//   見た目は doc.css のクラスだけを使う（新しい見た目は書かない）
import type { KeyboardEvent } from "react";
import { Select, TextArea, TextField } from "@/components/k";
import type { FieldValue, TicketField } from "./field-values";

export interface CustomInputProps {
  field: TicketField;
  value: FieldValue | undefined;
  error?: string | null | undefined;
  onChange: (value: FieldValue) => void;
  disabled?: boolean;
  /** 必須でない 1 つ選ぶの選択肢の先頭に「選ばない」（値 null）を出す（詳細でその場で直すとき・K-1153） */
  allowNone?: boolean;
  /** 説明（.k-desc・複数選ぶの .k-f4d-hint）を出さない（詳細でその場で直すとき・K-1153） */
  hideDescription?: boolean;
  /** 出たときに入力へキーボードの場所を移す */
  autoFocus?: boolean;
  /** 文字・数・日付の欄のキー（詳細で Enter・Esc を受ける・K-1153） */
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}

export const NONE = "__none__";
const textOf = (v: FieldValue | undefined): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";

export function CustomInput(p: CustomInputProps) {
  const { field: f, value, error, onChange, disabled, hideDescription, autoFocus, onKeyDown } = p;
  const desc = hideDescription ? undefined : (f.description ?? undefined);
  const name = `f_${f.id}`;
  const options = [...f.options].sort((a, b) => a.position - b.position);
  switch (f.field_type) {
    case "short_text":
    case "number":
    case "money":
    case "date":
      return (
        <TextField
          label={f.name}
          name={name}
          required={f.required}
          description={desc}
          error={error}
          value={textOf(value)}
          disabled={disabled}
          autoFocus={autoFocus}
          onKeyDown={onKeyDown}
          {...(f.field_type === "number" || f.field_type === "money" ? { inputMode: "numeric" as const } : {})}
          {...(f.field_type === "date" ? { type: "date" } : {})}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "long_text":
      return (
        <TextArea
          label={f.name}
          name={name}
          required={f.required}
          rows={2}
          description={desc}
          error={error}
          value={textOf(value)}
          disabled={disabled}
          autoFocus={autoFocus}
          onKeyDown={onKeyDown}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select": {
      const none = p.allowNone && !f.required ? [{ value: NONE, label: "選ばない" }] : [];
      return (
        <Select
          label={f.name}
          name={name}
          required={f.required}
          placeholder="選ぶ"
          description={desc}
          error={error}
          disabled={disabled}
          value={typeof value === "string" && value !== "" ? value : null}
          options={[...none, ...options.map((o) => ({ value: o.id, label: o.name }))]}
          onValueChange={(v) => onChange(v === null || v === NONE ? null : v)}
        />
      );
    }
    case "multi_select": {
      const chosen = new Set(Array.isArray(value) ? value : []);
      return (
        <fieldset className="k-f4d-multi" disabled={disabled}>
          <legend className="k-f4d-sr">{f.name}</legend>
          {options.map((o, i) => (
            <label key={o.id}>
              <input
                type="checkbox"
                checked={chosen.has(o.id)}
                autoFocus={autoFocus && i === 0}
                onChange={(e) => {
                  const next = new Set(chosen);
                  if (e.target.checked) next.add(o.id);
                  else next.delete(o.id);
                  onChange(options.filter((x) => next.has(x.id)).map((x) => x.id));
                }}
              />{" "}
              {o.name}
            </label>
          ))}
          {error ? (
            <p className="k-err" role="alert">
              {error}
            </p>
          ) : desc ? (
            <p className="k-f4d-hint">{desc}</p>
          ) : null}
        </fieldset>
      );
    }
    case "check": {
      const box = (
        <label className="k-f4d-check">
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.checked)}
          />{" "}
          {f.description ?? f.name}
        </label>
      );
      return error ? (
        <div className="k-f4d-reqrow">
          {box}
          <p className="k-err" role="alert">
            {error}
          </p>
        </div>
      ) : (
        box
      );
    }
  }
}
