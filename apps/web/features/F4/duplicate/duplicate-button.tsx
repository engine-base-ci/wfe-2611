"use client";
// 複製の小窓の流れ（K-446・A129）。DuplicateFlow は開く・閉じるを props で受ける（詳細の「複製」・作る面の入口・K-458 の「…」が呼ぶ）。
//   DuplicateButton は詳細の題の行の「複製」（K-571 の入れ物 DuplicateEntry の先が置く）。押しても口は呼ばない（詳細を開いたときに読んだ答えを使う）。
//   sourceOf は getTicket の答え → 複製の元（K-458 も使う）。作った後は作った詳細へ移る（K-60 と同じ着地）
import { useState, type ReactNode } from "react";
import { Button } from "@/components/k";
import type { SlotDetail, SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { DueDialog } from "@/features/F4/due/views";
import { useDuplicate, type DupSource } from "./use-duplicate";
import { DuplicateDialog } from "./views";

export type { DupSource } from "./use-duplicate";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** getTicket の答え（SlotTicket.detail）→ 複製の元 */
export function sourceOf(detail: SlotDetail): DupSource {
  const t = (detail["ticket"] ?? {}) as Record<string, unknown>;
  const a = (detail["assignee"] ?? null) as Record<string, unknown> | null;
  const n = Number(detail["child_count"] ?? 0);
  return {
    id: str(t["id"]),
    number: str(t["number"]),
    title: str(t["title"]),
    scope_id: str(t["scope_id"]),
    kind_id: str(t["kind_id"]),
    due_on: strOrNull(t["due_on"]),
    assignee_id: strOrNull(a?.["id"]),
    child_count: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0,
  };
}

/** 作った詳細へ移る（作る面の K-60 と同じ着地） */
const land = (id: string): void => window.location.assign(`/tickets/${id}`);

export function DuplicateFlow({
  source,
  open,
  onOpenChange,
}: {
  source: DupSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactNode {
  const { dialog, due } = useDuplicate(source, open, (id) => {
    onOpenChange(false);
    land(id);
  });
  return (
    <DuplicateDialog {...dialog} onClose={() => (dialog.busy ? undefined : onOpenChange(false))}>
      <DueDialog {...due} />
    </DuplicateDialog>
  );
}

/** 詳細の題の行の「複製」 */
export function DuplicateButton({ ticket }: { ticket: SlotTicket }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outlined" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        複製
      </Button>
      <DuplicateFlow source={sourceOf(ticket.detail)} open={open} onOpenChange={setOpen} />
    </>
  );
}
