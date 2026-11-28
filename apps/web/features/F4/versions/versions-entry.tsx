"use client";
// 詳細の題の行の「版と差分」の入口の先（K-571 が置いた入れ物・K-449 が中身を入れた）。
//   版と差分の頁（/tickets/:id/versions）へのリンク。道は versionsHref の 1 か所で作る
//   題の行のほかの操作（複製・ほかの操作）と同じボタンの形で読み上げる（role=button・K571-UI-008・K226-UI-003 が名前のボタンで探す）
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { EntryProps } from "@/features/F4/create-ticket/detail-types";
import { versionsHref } from "./versions-href";

export function VersionsEntryFill({ ticket }: EntryProps): ReactNode {
  return (
    <Link
      href={versionsHref(ticket.id) as Route}
      role="button"
      className="k-btn k-detail-versions"
      data-variant="outlined"
      data-size="md"
    >
      版と差分
    </Link>
  );
}
