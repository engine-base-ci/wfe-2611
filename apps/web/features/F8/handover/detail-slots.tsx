"use client";
// 段 9（F8 渡す・配る）がチケットの詳細と承認待ちに中身を足す差し込み口の先（K-380）。
//   段 9 の葉がここから区画のファイルへ配る。この葉（K-380）では何も出さない：
//   中身（children）をそのまま返すか null。口を呼ばず、状態を持たず、要素を描かない（詳細と承認待ちの見た目と操作は今のまま）。
//   入る所は features/F4/create-ticket/ の ticket-detail.tsx・detail-panel.tsx と features/F5/approve-complete/queue-table.tsx
import type { ReactNode } from "react";
import type { BandSlotProps, SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import type { QueueRow } from "@/features/F5/approve-complete/queue";
import type { RowActs } from "@/features/F5/approve-complete/queue-table";

interface Wrap {
  ticket: SlotTicket;
  children: ReactNode;
}

/** 区画をまたぐ状態の入れ物（DOM を足さない） */
export function DetailScope({ children }: Wrap): ReactNode {
  return <>{children}</>;
}

/** 右のパネルの「担当」の「担当者」の値（children＝今の顔と名前） */
export function AssigneeSlot({ children }: Wrap): ReactNode {
  return <>{children}</>;
}

/** 題名の下の帯の入れ物の中・F5 の 2 つの帯の後（渡しの帯・K-400） */
export function HandoverBandSlot(_props: BandSlotProps): ReactNode {
  void _props;
  return null;
}

/** 承認待ちの行の 1 つずつ（children＝今の行。承認でない種類は段 9 の行の部品へ・K-412） */
export function QueueRowSlot({ children }: { row: QueueRow; acts: RowActs; children: ReactNode }): ReactNode {
  return <>{children}</>;
}
