// ゲストの場所の道の組（K-911）。社内の (work) の Shell は使わず、外枠 PortalShell を 1 つ持つ
import type { ReactNode } from "react";
import { PortalShell } from "@/features/F11/portal/portal-shell";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
