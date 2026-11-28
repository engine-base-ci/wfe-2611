"use client";
// 詳細の入口の差し込み口（K-571）。7 つとも 1 行で先のファイルの …Fill を呼ぶだけ。
//   中身を持つ葉（K-446・K-449・K-447・K-443・K-452・K-572・K-573）は先のファイルの自分の物だけを替え、このファイルは触らない。
//   名前と props を 1 字も変えない（props の型は detail-types.ts）
import type { ReactNode } from "react";
import { BodySlotFill } from "@/features/F4/body-edit/body-slot";
import { DuplicateEntryFill } from "@/features/F4/duplicate/detail-entry";
import { LinksEntryFill } from "@/features/F4/links/detail-entry";
import { ParentRowSlotFill } from "@/features/F4/parent/detail-row-slot";
import { VersionsEntryFill } from "@/features/F4/versions/versions-entry";
import { CompleteActSlotFill } from "@/features/F5/approve-complete/complete-act-slot";
import { DelegateActSlotFill } from "@/features/F5/delegate/delegate-act-slot";
import type { ActsProps, BodySlotProps, EntryProps } from "./detail-types";

export type { ActsProps, BodySlotProps, EntryProps } from "./detail-types";

/** 題の行の「複製」（K-446） */
export function DuplicateEntry(p: EntryProps): ReactNode {
  return <DuplicateEntryFill {...p} />;
}
/** 題の行の「版と差分」（K-449） */
export function VersionsEntry(p: EntryProps): ReactNode {
  return <VersionsEntryFill {...p} />;
}
/** 本文を包む（K-447 が「直す」の入口と編集の帯を足す） */
export function BodySlot(p: BodySlotProps): ReactNode {
  return <BodySlotFill {...p} />;
}
/** 右のパネルの「親」の行の中身（K-443） */
export function ParentRowSlot(p: EntryProps): ReactNode {
  return <ParentRowSlotFill {...p} />;
}
/** 子チケット・つながりのカード（K-452） */
export function LinksEntry(p: EntryProps): ReactNode {
  return <LinksEntryFill {...p} />;
}
/** 題の行の「完了にする」（K-572） */
export function CompleteActSlot(p: ActsProps): ReactNode {
  return <CompleteActSlotFill {...p} />;
}
/** 題の行の「AI に任せる」（K-573） */
export function DelegateActSlot(p: ActsProps): ReactNode {
  return <DelegateActSlotFill {...p} />;
}
