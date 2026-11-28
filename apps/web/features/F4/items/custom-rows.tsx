"use client";
// 会社の項目の行（K-569）。用意してある項目と同じ Pair（名前と入力の 1 組）に包み、マスタの並びの順に出す。
//   包む要素を作らない（表の直の子が 用意してある 9 行 → 会社の項目 → 確認項目 の並びになる）。長い文章の行は全幅
import { Pair } from "@/features/F4/doc/views";
import { CustomInput } from "./custom-input";
import type { FieldValue, TicketField } from "./field-values";

export interface CustomRowsProps {
  fields: readonly TicketField[];
  values: Readonly<Record<string, FieldValue>>;
  errors?: Readonly<Record<string, string>>;
  onChange: (id: string, value: FieldValue) => void;
}

export function CustomRows({ fields, values, errors = {}, onChange }: CustomRowsProps) {
  return (
    <>
      {fields.map((f) => (
        <Pair key={f.id} name={f.name} required={f.required} full={f.field_type === "long_text"}>
          <CustomInput field={f} value={values[f.id]} error={errors[f.id]} onChange={(v) => onChange(f.id, v)} />
        </Pair>
      ))}
    </>
  );
}

/** 誤りのある最初の欄にキーボードの場所を移す（names は表の並びの順の行の名前。行の名前の字で行を探し、その行の最初の入力へ） */
export function focusFirstError(root: HTMLElement | null, names: readonly string[]): void {
  if (!root) return;
  const pairs = Array.from(root.querySelectorAll<HTMLElement>(":scope > .k-f4d-pair"));
  for (const n of names) {
    const row = pairs.find((p) => p.querySelector(".k-f4d-name")?.firstChild?.textContent === n);
    const target = row?.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), textarea, .k-select-trigger, [role=combobox]",
    );
    if (target) {
      target.focus();
      return;
    }
  }
}
