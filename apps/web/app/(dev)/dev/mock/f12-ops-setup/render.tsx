"use client";
// 段 13 の下絵（運営：パスキーを付ける）の 1 つの状態を描く（id → 部品の組み合わせ）。誰も持っていない id は「まだありません」
import type { ReactNode } from "react";
import { OpsSetup } from "@/features/F12/ops/ops-setup";
import type { Theme } from "@/lib/theme";

export function MockView({ id }: { id: string; theme: Theme }): ReactNode {
  switch (id) {
    case "op-setup":
      return <OpsSetup />;
    case "op-setup-done":
      return <OpsSetup mode="done" />;
    case "op-setup-invalid":
      return <OpsSetup mode="invalid" />;
    case "op-setup-failed":
      return <OpsSetup mode="failed" />;
    default:
      return <p>この状態はまだありません：{id}</p>;
  }
}
