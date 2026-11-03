// 札（KN-104・D-052）。状態は淡い面と濃い文字の対。色だけで意味を伝えない（文字を必ず持つ）
import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "progress" | "ai";
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className="k-badge" data-tone={tone}>
      {children}
    </span>
  );
}
