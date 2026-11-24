"use client";
// 作る面の「期限」の行の中身（K-442 が既定を置き、K-444 が小窓に替える）。既定は日付の欄 textbox「期限」
import { TextField } from "@/components/k";
import type { DueSlotProps } from "../create-ticket/create-slot-types";

export function DueSlotFill({ value, onChange, error }: DueSlotProps) {
  return (
    <TextField
      label="期限"
      name="due_on"
      type="date"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...(error ? { error } : {})}
    />
  );
}
