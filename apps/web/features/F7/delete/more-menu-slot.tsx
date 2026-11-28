"use client";
// 詳細の題名の行の「…」（ほかの操作）の差し込み口（K-599 が置き・K-590 が本物にする）。
//   「…」の箱は段 5 の K-458 の DetailMore（自前の箱は作らない）。この葉は onDelete（「消す」を押したとき）で下見を読み、確認の小窓を開くだけ。
//   小窓は子・孫の有無で 2 つ（DeletePreview・DeleteChildrenDialog）、下見が断った・読めないときは断りだけの小窓（DeleteRefused）。
//   移す先は前からの親を探す欄（ParentPicker）。口・断りの出し分け・元に戻すは use-ticket-delete.ts
import type { ReactNode } from "react";
import { ParentPicker } from "@/features/F4/create-ticket/parent-picker";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { DetailMore } from "@/features/F4/detail-more/more-menu";
import { DeleteChildrenDialog, DeletePreview, DeleteRefused } from "./delete-dialogs";
import { useTicketDelete } from "./use-ticket-delete";

/** 本物にした（K-590） */
export const READY = true;

export interface MoreMenuSlotProps {
  /** 無い呼び方（下絵）もある */
  ticket?: SlotTicket;
  children: ReactNode;
}

function DeleteFlow({ ticket }: { ticket: SlotTicket }) {
  const del = useTicketDelete(ticket);
  const { view, form } = del;
  return (
    <>
      <DetailMore ticket={ticket} onDelete={del.start} />
      {view.kind === "refused" ? (
        <DeleteRefused
          open
          target={view.target}
          notice={view.notice}
          tone={view.tone}
          onOpenChange={del.onOpenChange}
        />
      ) : null}
      {view.kind === "ready" && !view.hasChildren ? (
        <DeletePreview
          open
          data={view.data}
          reason={form.reason}
          notice={form.notice?.text}
          noticeTone={form.notice?.tone}
          busy={form.busy}
          onReasonChange={del.setReason}
          onOpenChange={del.onOpenChange}
          onConfirm={() => void del.confirm()}
        />
      ) : null}
      {view.kind === "ready" && view.hasChildren ? (
        <DeleteChildrenDialog
          open
          data={view.data}
          choice={form.choice}
          parentField={<ParentPicker value={form.parentId} onChange={del.setParent} />}
          parentChosen={form.parentId !== null}
          parentError={form.parentError}
          reason={form.reason}
          notice={form.notice?.text}
          noticeTone={form.notice?.tone}
          busy={form.busy}
          onChoice={del.setChoice}
          onReasonChange={del.setReason}
          onOpenChange={del.onOpenChange}
          onConfirm={() => void del.confirm()}
        />
      ) : null}
    </>
  );
}

export function MoreMenuSlot({ ticket, children }: MoreMenuSlotProps): ReactNode {
  return ticket ? <DeleteFlow ticket={ticket} /> : children;
}
