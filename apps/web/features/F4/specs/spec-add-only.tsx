"use client";
// 足す小窓だけ（K-450・K-571 がパネルの無い形〔一覧の右の詳細〕で使う）。行は出さない。足すときだけ createTestSpec を 1 回。
//   書けるかは口の答えで見る（断りは小窓の上の赤い箱）。足せたら小窓を閉じ、onAdded で親に知らせる
import { SpecAddDialog } from "./spec-add-dialog";
import { createSpec, type SpecRowData } from "./use-test-specs";

export interface SpecAddOnlyProps {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (row: SpecRowData) => void;
}

export function SpecAddOnly({ ticketId, open, onOpenChange, onAdded }: SpecAddOnlyProps) {
  return (
    <SpecAddDialog
      open={open}
      onOpenChange={onOpenChange}
      onAdd={async (title) => {
        const r = await createSpec(ticketId, title);
        if (r.ok && r.row) onAdded?.(r.row);
        return r;
      }}
    />
  );
}
