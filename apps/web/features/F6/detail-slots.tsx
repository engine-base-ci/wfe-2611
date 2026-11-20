"use client";
// 段 7（F6 自分で進める・話す・決める）がチケットの詳細に中身を足す差し込み口の先（K-380）。
//   段 7 の葉がここから区画のファイルへ配る。この葉（K-380）では何も出さない：
//   中身（children）をそのまま返すか null。口を呼ばず、状態を持たず、要素を描かない（詳細の見た目と操作は今のまま）。
//   入る所は features/F4/create-ticket/ の ticket-detail.tsx・detail-head.tsx・detail-panel.tsx（帯の順は detail-slots.ts の BAND_ORDER）
import type { ReactNode } from "react";
import type { BandSlotProps, SlotTicket } from "@/features/F4/create-ticket/detail-slots";

interface Wrap {
  ticket: SlotTicket;
  children: ReactNode;
}

export interface SlotSection {
  key: string;
  label: string;
  body: { text?: string } | null;
  version: number;
}

/** 詳細の答えを待たずに段 7 の口を先読みする（DetailBody が useRuns の横で呼ぶ・この葉では何もしない・K-392・K-397） */
export function usePrefetchDetail(_id: string, _enabled: boolean): void {
  // 何もしない（口を呼ばない・状態を持たない）。引数は約束の形を示すためだけに受ける
  void _id;
  void _enabled;
}

/** 区画をまたぐ状態の入れ物（DOM を足さない） */
export function DetailScope({ children }: Wrap): ReactNode {
  return <>{children}</>;
}

/** 頭の行の段の札（children＝今の段の札） */
export function StageSlot({ children }: Wrap): ReactNode {
  return <>{children}</>;
}

/** 題名の行のすぐ下（スマホの「やり取り N ↓」の飛び先・代表の答え ㉑） */
export function TitleSlot(_props: { ticket: SlotTicket }): ReactNode {
  void _props;
  return null;
}

/** 題名の下の帯の入れ物の中・渡しの帯の後（保留の帯・K-395） */
export function HoldBandSlot(_props: BandSlotProps): ReactNode {
  void _props;
  return null;
}

/** 本文の区画の 1 つずつ（children＝今の section.k-section・決定ログの区画の描き分け・代表の答え ⑳） */
export function SectionSlot({ children }: Wrap & { section: SlotSection }): ReactNode {
  return <>{children}</>;
}

/** 右のパネルのタブと中身（attrs＝今の属性の中身・children＝今のタブと中身） */
export function PanelTabsSlot({ children }: Wrap & { attrs: ReactNode }): ReactNode {
  return <>{children}</>;
}

/** 「日付と時間」の「予定」の値（代表の答え ⑥・中身は K-395） */
export function EstimateSlot({ children }: Wrap): ReactNode {
  return <>{children}</>;
}

/** 「日付と時間」の「実績」の値 */
export function ActualTimeSlot({ children }: Wrap): ReactNode {
  return <>{children}</>;
}
