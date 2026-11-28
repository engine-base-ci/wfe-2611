"use client";
// 作る面の「期限」の行の中身（K-442 が置いた差し込み口の先・K-444 が日付の欄＋早見の小窓に替えた）
import type { DueSlotProps } from "../create-ticket/create-slot-types";
import { DueField } from "./due-field";

export function DueSlotFill({ value, onChange, error }: DueSlotProps) {
  return <DueField value={value} onChange={onChange} error={error} />;
}
