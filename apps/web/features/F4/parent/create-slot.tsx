"use client";
// 作る面の「親」の差し込み口の先（K-442 が中身の無い形で先に置く・K-443 が親の小窓つきの欄に替える）。
//   K-442 の ParentSlot が見出しの上（place="top"）と項目の表の「親」の行（place="row"）に 1 つずつ置き、同じ値を渡す
import type { ReactNode } from "react";
import type { ParentSlotProps } from "@/features/F4/create-ticket/create-slot-types";
import { ParentField } from "./parent-field";

export function ParentSlotFill(props: ParentSlotProps): ReactNode {
  return <ParentField {...props} />;
}
