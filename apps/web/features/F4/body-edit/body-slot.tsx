"use client";
// 詳細の本文を包む差し込み口の先（K-571 が先に置き、K-447 が中身を書く）：「本文を直す」の入口と編集の形は body-edit-slot.tsx の BodyEditSlot
import type { ReactNode } from "react";
import type { BodySlotProps } from "@/features/F4/create-ticket/detail-types";
import { BodyEditSlot } from "./body-edit-slot";

export function BodySlotFill(p: BodySlotProps): ReactNode {
  return <BodyEditSlot {...p} />;
}
