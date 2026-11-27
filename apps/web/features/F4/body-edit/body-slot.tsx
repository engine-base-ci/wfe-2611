"use client";
// 詳細の本文を包む差し込み口の先（K-571 が中身の無い形で先に置く・K-447 が「直す」の入口と編集の帯を足す）。今は children を返す
import type { ReactNode } from "react";
import type { BodySlotProps } from "@/features/F4/create-ticket/detail-types";

export function BodySlotFill({ children }: BodySlotProps): ReactNode {
  return <>{children}</>;
}
