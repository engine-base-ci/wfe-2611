"use client";
// 作る面の親の中身（K-442 が既定を置き、K-443 が親の小窓に替える）。見出しの上（top）と項目の表の「親」の行（row）の 2 か所に同じ値で出る。
//   既定：row は前からの親の欄（打って探す・parent-picker）。top は「親を探す」のボタンで、押すと row の欄へキーボードの場所を移す。place・onCopy・due は読み捨てる
import { Button } from "@/components/k";
import { ParentPicker } from "../create-ticket/parent-picker";
import type { ParentSlotProps } from "../create-ticket/create-slot-types";

const focusRow = (): void => {
  document.querySelector<HTMLInputElement>('.k-f4d-grid input[name="parent_ticket"]')?.focus();
};

export function ParentSlotFill({ place, value, onChange, error }: ParentSlotProps) {
  if (place === "top")
    return (
      <Button variant="ghost" size="sm" type="button" onClick={focusRow}>
        親のチケットを探す
      </Button>
    );
  return <ParentPicker value={value} onChange={onChange} error={error} />;
}
