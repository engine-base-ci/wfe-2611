"use client";
// チケットの画面の外枠（K-60・D-128.151）。前からある外枠（AppShell・ShellProvider）と、役を読む仕組み（useMyRoles・/api/auth-ext/me）を使う。
//   役と名前を読む契約の口（getMe）はまだ作っていない（持ち主は K-70）。それまでは前の口で足りる。
//   前の外枠の画面の一覧（lib/nav.legacy）にはチケットの画面がまだ無いので、画面の印は付けず（見出しは本文が出す）、サイドバーと下の帯だけを出す。
//   右の自分のAIのパネルは出さない（チケットは PC をつないでいなくても作れる・D-127.8）
import type { ReactNode } from "react";
import { AppShell, ShellProvider } from "@/components/shell";
import { useMyRoles } from "@/lib/auth/role";
import type { RoleId } from "@/lib/nav.legacy";

/** counts：左のメニューの数（承認待ちの数・K-63）。画面 ID → 数 */
export function TicketShell({ children, counts }: { children: ReactNode; counts?: Record<string, number> }) {
  const { roles } = useMyRoles();
  const role = (roles?.[0] ?? "R1") as RoleId;
  return (
    <ShellProvider screenId={null} role={role} {...(counts ? { counts } : {})}>
      <AppShell panel={false}>
        <div data-ticket-shell>{children}</div>
      </AppShell>
    </ShellProvider>
  );
}
