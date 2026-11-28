"use client";
// 運営のお知らせの一覧の画面（/ops/notices・K-980）。URL の札を読み → 外枠の答え（caps）と一覧の口を読み → 部品に値と押したときの関数を渡す。
//   種類と下書きの札は URL に持つ（router.push で戻るが効く）。notice ができない人には口を呼ばずに見る権限が無い旨。読めなければ E-PAGE-007
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { ErrorState, NoAccess, PageBody, PageHeader } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { capsOf, noticeRowsOf, noticeRowView, noticesQuery, noticesSearch, type NoticeChip } from "./notices-shape";
import { shellDataOf, useOpsNotices, useOpsShellOnce } from "./use-ops-notices";
import { NoticesPage, type NoticeChipItem } from "./views-notices";

export const NOTICES_HOME = "/ops/notices";
const CHIPS: readonly [NoticeChip, string][] = [
  ["all", "すべて"],
  ["incident", "障害"],
  ["maintenance", "メンテ"],
  ["release", "リリース"],
  ["draft", "下書き"],
];

/** 本文の代わりに出す（権限が無い・読めない） */
export function NoticeBodyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageBody labelledBy="oq-notices-state-title">
      <PageHeader id="oq-notices-state-title" title={title} />
      {children}
    </PageBody>
  );
}

/** 口が 401 を返したら運営のログインへ（戻り先つき） */
export function useOpsRelogin(relogin: boolean): void {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (relogin) router.replace(`/ops/login?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [relogin, router, pathname]);
}

export function NoticesScreen() {
  const router = useRouter();
  const sp = useSearchParams();
  const { chip } = useMemo(() => noticesQuery(sp), [sp]);
  const shell = useOpsShellOnce();
  const shellData = shellDataOf(shell.data);
  const allowed = capsOf(shellData).includes("notice");
  const list = useOpsNotices(chip, allowed);
  const relogin = list.data?.kind === "login";
  useOpsRelogin(relogin);

  if (shell.isPending || relogin) return null;
  if (shell.data?.kind === "login" || shell.data?.kind === "setup") return null; // 入れ物（K-946）が移す
  if (shellData === undefined)
    return (
      <NoticeBodyState title="お知らせ">
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void shell.refetch()]} />
      </NoticeBodyState>
    );
  if (!allowed)
    return (
      <NoticeBodyState title="お知らせ">
        <NoAccess />
      </NoticeBodyState>
    );
  if (list.isPending) return null;
  const rows = list.data?.kind === "ok" ? noticeRowsOf(list.data.data) : null;
  if (!rows)
    return (
      <NoticeBodyState title="お知らせ">
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void list.refetch()]} />
      </NoticeBodyState>
    );

  const chips: NoticeChipItem[] = CHIPS.map(([c, label]) => ({
    label,
    on: chip === c,
    onClick: () => router.push(`${NOTICES_HOME}${noticesSearch({ chip: c })}`),
  }));
  return (
    <NoticesPage
      rows={rows.map(noticeRowView)}
      chips={chips}
      rowHref={(r) => `${NOTICES_HOME}/${encodeURIComponent(r.id ?? "")}`}
      writeHref={`${NOTICES_HOME}/new`}
      empty="まだお知らせはありません"
    />
  );
}
