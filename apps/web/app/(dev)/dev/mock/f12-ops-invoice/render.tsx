"use client";
// 段 13 の下絵（運営：請求書の型）の 1 つの状態を描く（id → 部品の組み合わせ）。誰も持っていない id は「まだありません」
import type { ReactNode } from "react";
import type { Crumb } from "@/components/k";
import { OpsShell } from "@/features/F12/ops/ops-shell";
import { InvoiceTemplatePage } from "@/features/F12/ops2/views-invoice-template";
import type { Theme } from "@/lib/theme";

const CRUMBS: Crumb[] = [{ label: "請求", href: "/dev/mock/f12-ops2/oq-bills" }, { label: "請求書の型" }];

function Ops({ children }: { children: ReactNode }) {
  return (
    <OpsShell
      screen="ops-billing"
      crumbs={CRUMBS}
      badges={{ support: 3, billing: 2 }}
      operator={{ name: "高本 聖斗", initial: "高" }}
      notices={3}
    >
      {children}
    </OpsShell>
  );
}

export function MockView({ id }: { id: string; theme: Theme }): ReactNode {
  switch (id) {
    case "op-invoice-template":
      return (
        <Ops>
          <InvoiceTemplatePage />
        </Ops>
      );
    case "op-invoice-template-edit":
      return (
        <Ops>
          <InvoiceTemplatePage mode="edit" />
        </Ops>
      );
    case "op-invoice-template-failed":
      return (
        <Ops>
          <InvoiceTemplatePage mode="failed" />
        </Ops>
      );
    default:
      return <p>この状態はまだありません：{id}</p>;
  }
}
