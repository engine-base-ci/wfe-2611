"use client";
// 詳細の「子チケット・つながり」のカードの先（K-571 が置いた差し込み口の先・K-452 が LinksBlock に替えた）
import type { ReactNode } from "react";
import type { EntryProps } from "@/features/F4/create-ticket/detail-types";
import { LinksBlock } from "./links-block";

export function LinksEntryFill({ ticket }: EntryProps): ReactNode {
  return <LinksBlock ticket={ticket} />;
}
