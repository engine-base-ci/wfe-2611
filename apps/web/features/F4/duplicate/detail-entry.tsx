"use client";
// 詳細の題の行の「複製」の入口の先（K-571 が中身の無い形で先に置き、K-446 が中身を入れた）。
//   押すと複製の小窓（duplicate-button.tsx の DuplicateButton・詳細を開いたときに読んだ答えを使い、口を増やさない）
import type { ReactNode } from "react";
import type { EntryProps } from "@/features/F4/create-ticket/detail-types";
import { DuplicateButton } from "./duplicate-button";

export function DuplicateEntryFill({ ticket }: EntryProps): ReactNode {
  return <DuplicateButton ticket={ticket} />;
}
