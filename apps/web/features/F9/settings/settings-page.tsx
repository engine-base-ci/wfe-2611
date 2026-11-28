"use client";
// チケットの設定（K-707・画面 masters・道 /workspace/ticket-settings）。外枠（TicketShell）の中に、ワークスペースの管理の頭（WsHead）・
//   第 2 ナビ（WsSub・「チケットの設定」が今の場所）・本文（TicketSettings：種別／状態／項目のタブ）。モック /dev/mock/f9/set-* の WsFrame と同じ組み立て。
//   管理者（R1・R2）だけ：役を読み終えるまでは読み込み中、見られない人は「この画面を見る権限がありません」（E-PAGE-002）で、設定の口は呼ばない。
//   タブの中身は tab-panels.tsx の登録（K-708・K-709 が足す）。タブと種別は ?tab=・?id= で持ち、離れる前に保存していない変更を確かめる
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { NoAccess } from "@/components/k";
import { me } from "@/lib/auth/ext";
import { useMyRoles } from "@/lib/auth/role";
import { ONCE, TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { useMembers } from "@/features/F10/invite/use-members";
import { WsHead, WsSub, type WsSubItemOverrides } from "@/features/F10/invite/views";
import { inertTabsOf, tabOf, type SettingsTabKey } from "./settings-tabs";
import { TAB_PANELS } from "./tab-panels";
import { UnsavedProvider, useUnsaved } from "./unsaved-guard";
import { SettingsLoading, TicketSettings } from "./views";

const PATH = "/workspace/ticket-settings";
const ADMIN_ROLES = ["R1", "R2"];
const SUB_ITEMS: WsSubItemOverrides = {
  rules: { label: "チケットの設定", icon: SlidersHorizontal, href: PATH },
};
const SUB_ENABLED = ["members", "rules"] as const;
const CRUMBS = [{ label: "ワークスペースの管理", disabled: true }, { label: "チケットの設定" }];

const hrefOf = (tab: SettingsTabKey, id?: string): string =>
  `${PATH}?tab=${tab}${id ? `&id=${encodeURIComponent(id)}` : ""}`;

export function TicketSettingsPage({ tab, id }: { tab: SettingsTabKey; id?: string | undefined }) {
  const { roles } = useMyRoles();
  const admin = roles?.some((r) => ADMIN_ROLES.includes(r)) ?? false;
  const [forbidden, setForbidden] = useState(false);
  const onForbidden = useCallback(() => setForbidden(true), []);
  let body;
  if (roles === undefined) body = <SettingsLoading />;
  else if (!admin || forbidden) body = <NoAccess />;
  else
    body = (
      <UnsavedProvider>
        <AdminBody tab={tab} id={id} onForbidden={onForbidden} />
      </UnsavedProvider>
    );
  return (
    <TicketShell screen="masters" crumbs={CRUMBS}>
      {body}
    </TicketShell>
  );
}

function AdminBody({
  tab: tabProp,
  id: idProp,
  onForbidden,
}: {
  tab: SettingsTabKey;
  id: string | undefined;
  onForbidden: () => void;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const { confirmLeave } = useUnsaved();
  const members = useMembers();
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const company = (who.data as { workspace_name?: string | null } | undefined)?.workspace_name?.trim() ?? "";

  const asked = tabOf(sp?.get("tab") ?? tabProp);
  const inert = inertTabsOf(TAB_PANELS);
  const tab: SettingsTabKey = inert.includes(asked) ? "kinds" : asked;
  const id = sp?.get("id") ?? idProp;
  const Panel = TAB_PANELS[tab];

  const go = (href: string) => confirmLeave(() => router.push(href as Route, { scroll: false }));
  const onTab = (t: SettingsTabKey) => {
    if (t === tab || inert.includes(t)) return;
    go(hrefOf(t));
  };

  return (
    <>
      <WsHead name={company} initial={company.slice(0, 1)} />
      <div className="k-me-wrap">
        <WsSub
          active="rules"
          enabled={SUB_ENABLED}
          items={SUB_ITEMS}
          {...(members.data ? { members: members.data.count } : {})}
        />
        <TicketSettings tab={tab} onTab={onTab} inertTabs={inert}>
          {Panel ? (
            <Panel
              id={id ?? undefined}
              hrefOf={(to) => hrefOf(tab, to)}
              select={(to) => go(hrefOf(tab, to))}
              onForbidden={onForbidden}
            />
          ) : null}
        </TicketSettings>
      </div>
    </>
  );
}
