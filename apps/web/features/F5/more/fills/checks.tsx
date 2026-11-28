"use client";
// 差し込み口の先：確認の結果（持ち主の葉 K-740。器 slots.tsx と帯のファイルは触らない）。
//   止まった箱の下・承認の帯の成果物の下＝確認の区画（features/F5/checks/checks-section.tsx）
//   承認の確かめの小窓＝チェックの無い確認項目の注意とその場のチェック（features/F5/checks/approve-pending.tsx）
//   承認待ちの「確認」＝口の check_summary の字そのまま（表は空なら「—」・カードは「確認 〈字〉」の 1 行で、空なら出さない）
import type { ReactNode } from "react";
import { ApprovePending } from "@/features/F5/checks/approve-pending";
import { ChecksSection } from "@/features/F5/checks/checks-section";
import type { ApproveChecksProps, ChecksProps, QueueCheckCellProps } from "../slots";

export function ChecksFill(props: ChecksProps): ReactNode {
  return <ChecksSection {...props} />;
}
export function ApproveChecksFill(props: ApproveChecksProps): ReactNode {
  return <ApprovePending {...props} />;
}

/** 「N ／ M 済み」で N < M（まだの行がある） */
export function stillOpen(summary: string): boolean {
  const m = /^(\d+)\s*／\s*(\d+)/.exec(summary);
  return m ? Number(m[1]) < Number(m[2]) : false;
}

export function QueueCheckCellFill({ row, layout }: QueueCheckCellProps): ReactNode {
  const s = String(row.check_summary ?? "").trim();
  if (layout === "table") return <>{s || "—"}</>;
  if (!s) return null;
  return (
    <span className="k-more-mcard-open" data-open={stillOpen(s) ? "" : undefined}>
      {`確認 ${s}`}
    </span>
  );
}
