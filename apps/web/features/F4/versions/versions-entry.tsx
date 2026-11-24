"use client";
// 詳細の題の行の「版と差分」の入口の先（K-571 が中身の無い形で先に置く・K-449 が中身を入れる）。
//   今は在るが押せない形（aria-disabled・title「まだ使えません」・押しても口は呼ばれない）
import type { ReactNode } from "react";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import type { EntryProps } from "@/features/F4/create-ticket/detail-types";

export function VersionsEntryFill(props: EntryProps): ReactNode {
  void props; // 中身の葉が使う（今の既定は値を見ない）
  return <InertButton className="k-detail-versions">版と差分</InertButton>;
}
