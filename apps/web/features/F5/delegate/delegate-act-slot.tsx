"use client";
// 詳細の題の行の「AI に任せる」の差し込み口の先（K-571 が置いた・K-573 がボタンと流れを入れ、帯から外した）。名前と props は変えない
import type { ActsProps } from "@/features/F4/create-ticket/detail-types";
import { DelegateAct } from "./delegate-act";

export function DelegateActSlotFill(props: ActsProps) {
  return <DelegateAct {...props} />;
}
