"use client";
// 運営の 1 社の画面の入れ物（/ops/tenants/<id>・K-971）。URL の tab を読み → 1 社と開いたタブの口を読み → 部品に形の値と関数を渡す。
//   タブは URL に持つ（status は書かない・router.push で戻るが効く）。開いたタブの口だけを読む。
//   できること（外枠の答えの operator.caps）が無いタブは口を呼ばず見る権限がない形（NoAccess・E-PAGE-002）。
//   1 社が読めない：404 は見つからない（E-PAGE-001）・ほかは E-PAGE-007 と「もう一度」。タブの口だけが落ちたらタブの中だけ。
//   K-972：頭のボタン（中を見る・お知らせを送る・⋯ › 止める／再開する）・見ている間の帯・止めている帯・小窓をつなぐ（ws-dialogs.tsx）。
//   小窓が受けた答え（止める・再開する）は今の 1 社に重ねて置く（タブの読む欄を消さない）
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CATALOG } from "@kaname/errors/catalog";
import { ErrorState, NoAccess } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { PeekPanel } from "./tenant-dialogs";
import { TenantFrame } from "./tenant-frame";
import { BillingTab, InquiriesTab, LogTab, MembersTab, StatusTab, type ResendState } from "./tenant-tabs";
import {
  capsOf,
  resendVerification,
  useOpsShellCaps,
  useOpsWorkspace,
  useWsAudit,
  useWsBilling,
  useWsInquiries,
  useWsMembers,
  wsKey,
  WsReadError,
} from "./use-ops-workspace";
import {
  auditView,
  billingView,
  canSeeTab,
  frameView,
  infoView,
  inquiryView,
  memberView,
  statusView,
  tabLabels,
  tabOf,
  tabSearch,
  type MemberView,
  type WsDetail,
  type WsTab,
} from "./ws-tenant-shape";
import { ShellBanner, useWsDialogs, type WsAnswer } from "./ws-dialogs";

/** 1 社の答え：K-971 の読む欄と K-972 の小窓・帯が読む欄（peek など）の両方 */
type WsData = WsDetail & WsAnswer;

function codeOfError(e: unknown): string {
  return e instanceof WsReadError && e.status === 404 ? PAGE_ERROR.notFound : PAGE_ERROR.loadFailed;
}

/** 口の結果を中身にする：読んでいる間は何も出さない・読めなければタブの中だけ E-PAGE-007 */
function Loaded<T>({
  q,
  children,
}: {
  q: { isPending: boolean; isError: boolean; data: T | undefined; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  if (q.isError) return <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void q.refetch()]} />;
  if (q.isPending || q.data === undefined) return null;
  return <>{children(q.data)}</>;
}

export function WsTenantScreen({ id }: { id: string }) {
  const qc = useQueryClient();
  const shell = useOpsShellCaps();
  const ws = useOpsWorkspace(id);
  const reload = useCallback(() => void qc.invalidateQueries({ queryKey: wsKey(id) }), [qc, id]);
  const replace = useCallback(
    (next: WsAnswer) => qc.setQueryData<WsData>(wsKey(id), (prev) => ({ ...prev, ...next }) as WsData),
    [qc, id],
  );

  if (ws.isPending) return null;
  if (ws.isError || !ws.data) {
    const code = codeOfError(ws.error);
    return <ErrorState code={code} acts={code === PAGE_ERROR.loadFailed ? [reload] : []} />;
  }
  return <WsTenantBody id={id} ws={ws.data as WsData} caps={capsOf(shell.data)} reload={reload} replace={replace} />;
}

function WsTenantBody(props: {
  id: string;
  ws: WsData;
  caps: string[];
  reload: () => void;
  replace: (ws: WsAnswer) => void;
}) {
  const { id, ws, caps } = props;
  const dlg = useWsDialogs(props);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tab = tabOf(sp.get("tab"));
  const open = (t: WsTab) => tab === t && canSeeTab(t, caps);

  const members = useWsMembers(id, open("members"));
  const billing = useWsBilling(id, open("billing"));
  const inquiries = useWsInquiries(id, open("inquiries"));
  const audit = useWsAudit(id, open("log"));
  const [resend, setResend] = useState<Readonly<Record<string, ResendState>>>({});

  const onResend = async (m: MemberView) => {
    setResend((r) => ({ ...r, [m.id]: "sending" }));
    const out = await resendVerification(id, m.id);
    const message = out.kind === "refused" ? CATALOG[out.code]?.message : undefined;
    const next: ResendState = out.kind === "sent" ? "sent" : message ? { refused: message } : "failed";
    setResend((r) => ({ ...r, [m.id]: next }));
  };

  const { stats, recent } = statusView(ws);
  const body = (): ReactNode => {
    if (!canSeeTab(tab, caps)) return <NoAccess />;
    switch (tab) {
      case "members":
        return (
          <Loaded q={members}>
            {(d) => (
              <MembersTab
                members={d.map(memberView)}
                {...(ws.members ? { total: ws.members.count } : {})}
                onResend={(m) => void onResend(m)}
                resend={resend}
              />
            )}
          </Loaded>
        );
      case "billing":
        return <Loaded q={billing}>{(d) => <BillingTab billing={billingView(d)} />}</Loaded>;
      case "inquiries":
        return <Loaded q={inquiries}>{(d) => <InquiriesTab inquiries={d.map(inquiryView)} />}</Loaded>;
      case "log":
        return <Loaded q={audit}>{(d) => <LogTab log={d.map(auditView)} />}</Loaded>;
      default:
        return <StatusTab stats={stats} recent={recent} />;
    }
  };

  return (
    <>
      {dlg.peekBand ? <ShellBanner>{dlg.peekBand}</ShellBanner> : null}
      <TenantFrame
        tab={tab}
        view={frameView(ws)}
        tabs={tabLabels(ws)}
        onTab={(t) => router.push(`${pathname}${tabSearch(t)}` as Route, { scroll: false })}
        info={infoView(ws)}
        acts={dlg.acts}
        stopBand={dlg.stopBand}
        notice={dlg.notice}
        resuming={dlg.resuming}
      >
        {dlg.peeking ? <PeekPanel /> : null}
        {body()}
      </TenantFrame>
      {dlg.dialogs}
    </>
  );
}
