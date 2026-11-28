"use client";
// 記録（K-825・画面 audit・道 /audit）。外枠（TicketShell）の中に、口の答えの scope で 2 つの形：
//   all（管理者）＝ワークスペースの管理の頭（WsHead）・第 2 ナビ（WsSub「記録」）・本文（LogPage・札 6 つ）
//   groups（マネージャー）＝本文だけ（札なし・頭と第 2 ナビなし・パンくずは「記録」だけ）。答えが来るまでは Loading（形を決めない）
//   閲覧のみ（R4）は口を呼ばずに「この画面を見る権限がありません」。R3 は口を呼び、403 か scope で決まる。続きの 403 も同じ画面に替える
//   絞りは URL が状態（?kind・q・member・ticket）。札は push（戻るで 1 つ前の絞り）・ことばと 1 人の絞りを外すのは replace。
//   書き出し・消す・直すは作らない（D-154.4・D-154.25）。消した行の「戻す」は押せない形（D-145.9）
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { Loading, NoAccess, type Crumb } from "@/components/k";
import { me } from "@/lib/auth/ext";
import { useMyRoles } from "@/lib/auth/role";
import { ONCE, TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { WsHead, WsSub } from "@/features/F10/invite/views";
import {
  cleanQ,
  countText,
  filtersFromUrl,
  isFiltered,
  searchOf,
  toLogEntry,
  type AuditFilters,
  type AuditScope,
} from "./audit-shape";
import { LogPage, type LogTab } from "./log";
import { SCREEN, isForbidden, useAudit } from "./use-audit";

/** 閲覧のみ（依頼する側）の役。記録を読めないので口を呼ばずに止める（D-154.11） */
const NO_AUDIT_ROLE = "R4";
const SECTION_LABEL = "記録";
const SCAN_CAPPED = "ここまでしか探していません。ことばか札を変えてみてください";
const MEMBER_NOTE = "1 人に絞っています";
const MEMBER_CLEAR = "1 人に絞っているのを外す";
const TICKET_NOTE = "1 つのチケットに絞っています";
const TICKET_CLEAR = "1 つのチケットに絞っているのを外す";
const CRUMBS_ALL: Crumb[] = [{ label: "ワークスペースの管理", disabled: true }, { label: "記録" }];
const CRUMBS_ONE: Crumb[] = [{ label: "記録" }];

function Frame({ crumbs, children }: { crumbs: Crumb[]; children: ReactNode }) {
  return (
    <>
      <TicketShell screen={SCREEN} crumbs={crumbs}>
        {children}
      </TicketShell>
    </>
  );
}

function Denied() {
  return (
    <Frame crumbs={CRUMBS_ONE}>
      <section className="k-root k-page k-me-page k-inv-page" aria-label={SECTION_LABEL}>
        <NoAccess />
      </section>
    </Frame>
  );
}

/** 絞りを変えて URL に書く（push は戻るで 1 つ前の絞りに戻れる） */
function useNavigate(): (next: AuditFilters, how: "push" | "replace") => void {
  const router = useRouter();
  const path = usePathname();
  return (next, how) => router[how](`${path}${searchOf(next)}` as Route, { scroll: false });
}

export function AuditScreen() {
  const params = useSearchParams();
  const f = filtersFromUrl((k) => params.get(k));
  const { roles } = useMyRoles();
  const blocked = roles?.includes(NO_AUDIT_ROLE) ?? false;
  const q = useAudit(f, roles !== undefined && !blocked);
  const navigate = useNavigate();
  const fetchingMore = useRef(false);

  if (roles === undefined) return <Frame crumbs={CRUMBS_ONE}>{<Loading />}</Frame>;
  if (blocked || isForbidden(q.error)) return <Denied />;
  const pages = q.data?.pages ?? [];
  const first = pages[0];
  if (!first && !q.isError) return <Frame crumbs={CRUMBS_ONE}>{<Loading />}</Frame>;

  const scope: AuditScope = first?.scope ?? "all";
  const manager = scope === "groups";
  const entries = pages.flatMap((p) => p.entries).map(toLogEntry);
  const hasMore = q.hasNextPage === true;
  const failed = !first && q.isError;

  const loadMore = () => {
    if (fetchingMore.current) return; // 二度押しで 1 回
    fetchingMore.current = true;
    void q.fetchNextPage({ cancelRefetch: false }).finally(() => {
      fetchingMore.current = false;
    });
  };
  const pickTab = (t: LogTab | null) => navigate({ ...f, kind: t }, "push");
  const search = (text: string) => navigate({ ...f, q: cleanQ(text) }, "replace");
  const note =
    f.member !== null || f.ticket !== null
      ? {
          text: f.member !== null ? MEMBER_NOTE : TICKET_NOTE,
          clearLabel: f.member !== null ? MEMBER_CLEAR : TICKET_CLEAR,
          onClear: () => navigate({ ...f, member: null, ticket: null }, "replace"),
        }
      : undefined;

  const page = (
    <LogPage
      entries={entries}
      query={f.q ?? ""}
      tab={f.kind}
      status={failed ? "failed" : entries.length === 0 ? "empty" : "ok"}
      manager={manager}
      onSearch={search}
      onRetry={() => void q.refetch()}
      {...(manager ? {} : { onTab: pickTab })}
      {...(isFiltered(f) ? { searchLabel: countText(entries.length, hasMore) } : {})}
      {...(note ? { filterNote: note } : {})}
      {...(first?.scan_capped ? { emptyHint: SCAN_CAPPED } : {})}
      {...(hasMore || q.isFetchNextPageError
        ? { more: { onClick: loadMore, busy: q.isFetchingNextPage, failed: q.isFetchNextPageError } }
        : {})}
    />
  );
  if (manager) return <Frame crumbs={CRUMBS_ONE}>{page}</Frame>;
  return (
    <Frame crumbs={CRUMBS_ALL}>
      <AdminHead />
      <div className="k-me-wrap">
        <WsSub active="log" items={{ members: { href: "/members" } }} />
        {page}
      </div>
    </Frame>
  );
}

/** 会社の頭（外枠と同じ「自分の情報」の答えを使う・二重に読まない） */
function AdminHead() {
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const company = (who.data as { workspace_name?: string | null } | undefined)?.workspace_name?.trim() ?? "";
  return <WsHead name={company} initial={company.slice(0, 1)} />;
}
