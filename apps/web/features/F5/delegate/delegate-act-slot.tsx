"use client";
// 詳細の題の行の「AI に任せる」の差し込み口の先（K-571 が中身の無い形で先に置く・K-573 がボタンと流れを入れ、帯から外す）。今は何も出さない
import type { ReactNode } from "react";
import type { ActsProps } from "@/features/F4/create-ticket/detail-types";

export function DelegateActSlotFill(props: ActsProps): ReactNode {
  void props; // 中身の葉が使う（今の既定は値を見ない）
  return null;
}
