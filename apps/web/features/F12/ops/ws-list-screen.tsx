"use client";
// 運営のワークスペースの一覧の画面（/ops・K-965）。URL の絞り込みを読み → 外枠の答え（上の数）と一覧の口を読み → 部品に値と押したときの関数を渡す。
//   絞り込み・探す・並びは URL に持つ（router.push で戻るが効く）。どちらかが読めなければ本文は読めなかった旨（E-PAGE-007）
//   照合が使えなかった登録の帯と小窓（K-1019）：帯の数は外枠の pwned.unchecked・小窓を開いたときだけ一覧を読む・「確かめた」で 1 行ずつ
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, ErrorState, PageBody, PageHeader } from "@/components/k";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import { PwnedError, useAckOpsPwned, useOpsPwned } from "./use-ops-pwned";
import { pwnedCountOf, pwnedRowView } from "./pwned-shape";
import { useOpsShellData, useOpsWorkspaces } from "./use-ops-workspaces";
import {
  PWNED_DESC,
  PWNED_TITLE,
  PwnedDialog,
  WsListPage,
  type ListChip,
  type PwnedNotice,
  type WsSort,
} from "./views-list";
import {
  cleanQ,
  emptyKind,
  listQuery,
  rowsOf,
  shellOfData,
  statsView,
  toSearch,
  wsRowView,
  type ListPlan,
  type ListQuery,
  type ListSort,
  type ListView,
} from "./ws-list-shape";

const HOME = "/ops";
const TO_WS_SORT: Record<ListSort, WsSort> = { attention: "care", members: "people", runs: "runs" };
const TO_API_SORT: Record<WsSort, ListSort> = { care: "attention", people: "members", runs: "runs" };
const VIEW_CHIPS: readonly [ListView, string][] = [
  ["all", "すべて"],
  ["attention", "気にかける"],
  ["stopped", "止めている"],
  ["closing", "やめる手続き中"],
];
const PLAN_CHIPS: readonly [ListPlan, string][] = [
  ["free", "無料"],
  ["team", "チーム"],
  ["business", "ビジネス"],
];

/** もう確かめてあった（409）の番号（K-995 が errors の目録に足す） */
const ALREADY_ACKED = "E-OPS-026";

/** 照合が使えなかった登録の小窓の入れ物（読む → 部品の値 → 小窓・確かめた → 行を外して帯の数を置き換える） */
function PwnedBox({ onClose }: { onClose: () => void }) {
  const list = useOpsPwned(true);
  const ack = useAckOpsPwned();
  const [notice, setNotice] = useState<PwnedNotice | null>(null);
  // 押している行の id（ref は同じ番の二度押しを同期に弾く・state は描く用）。押せないのはその行だけ
  const pressing = useRef<ReadonlySet<string>>(new Set());
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(pressing.current);
  const setPressing = (next: ReadonlySet<string>) => {
    pressing.current = next;
    setBusyIds(next);
  };

  if (list.isError)
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()} size="connect" title={PWNED_TITLE} description={PWNED_DESC}>
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void list.refetch()]} />
      </Dialog>
    );
  if (!list.data)
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()} size="connect" title={PWNED_TITLE} description={PWNED_DESC} />
    );

  /** 押すたびにその呼び出しの結果を 1 回ずつ受け取り、知らせと閉じるを決める（最後の呼び出しだけに頼らない） */
  const onAck = (id: string) => {
    if (pressing.current.has(id)) return;
    setPressing(new Set([...pressing.current, id]));
    setNotice(null);
    ack
      .mutateAsync(id)
      .then((a) => {
        if (a.remaining === 0) onClose();
      })
      .catch((e: unknown) => {
        const conflict = e instanceof PwnedError && e.kind === "conflict";
        setNotice(
          conflict
            ? { text: errorText(ALREADY_ACKED).title, tone: "info" }
            : { text: errorText(PAGE_ERROR.down).title, tone: "danger" },
        );
      })
      .finally(() => setPressing(new Set([...pressing.current].filter((x) => x !== id))));
  };
  return (
    <PwnedDialog
      rows={list.data.map(pwnedRowView)}
      onClose={onClose}
      onAck={(r) => r.id && onAck(r.id)}
      busyIds={busyIds}
      notice={notice}
    />
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <PageBody labelledBy="op-list-title">
      <PageHeader id="op-list-title" title="ワークスペース" />
      <ErrorState code={PAGE_ERROR.loadFailed} acts={[onRetry]} />
    </PageBody>
  );
}

export function WsListScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const lq = useMemo(() => listQuery(sp), [sp]);
  const shell = useOpsShellData();
  const list = useOpsWorkspaces(lq);
  const [pwnedOpen, setPwnedOpen] = useState(false);

  const go = (next: ListQuery) => router.push(`${HOME}${toSearch(next)}` as Route);
  const relogin = list.data?.kind === "login";
  useEffect(() => {
    if (relogin) router.replace(`/ops/login?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [relogin, router, pathname]);

  if (shell.isPending || list.isPending || relogin) return null;
  const shellData = shell.data?.kind === "ok" ? shellOfData(shell.data.data) : null;
  const rows = list.data?.kind === "ok" ? rowsOf(list.data.data) : null;
  if (!shellData || !rows) return <Failed onRetry={() => void Promise.all([shell.refetch(), list.refetch()])} />;

  const s = statsView(shellData);
  const money = shellData.invoices !== null; // 上の数と同じ印（K-963 が caps の money で invoices を null にする・D-156.67）
  const now = new Date();
  const chips: ListChip[] = VIEW_CHIPS.map(([v, label]) => ({
    label,
    count: s.chips[v],
    on: lq.view === v,
    onClick: () => go({ ...lq, view: v }),
  }));
  const plans: ListChip[] = PLAN_CHIPS.map(([p, label]) => ({
    label,
    count: s.chips[p],
    on: lq.plan === p,
    onClick: () => go({ ...lq, plan: lq.plan === p ? null : p }),
  }));
  return (
    <>
      <WsListPage
        pwned={pwnedCountOf(shell.data?.kind === "ok" ? shell.data.data : null)}
        onPwned={() => setPwnedOpen(true)}
        rows={rows.map((r) => wsRowView(r, now, money))}
        query={lq.q}
        total={s.total}
        stats={s}
        chips={chips}
        plans={plans}
        onQuery={(q) => go({ ...lq, q: cleanQ(q) })}
        sort={TO_WS_SORT[lq.sort]}
        onSort={(v) => go({ ...lq, sort: TO_API_SORT[v] })}
        rowHref={(r) => `${HOME}/tenants/${encodeURIComponent(r.id)}`}
        onClear={() => go({ ...lq, q: "" })}
        empty={emptyKind(lq)}
        onResetFilter={() => go({ ...lq, view: "all", plan: null })}
      />
      {pwnedOpen ? <PwnedBox onClose={() => setPwnedOpen(false)} /> : null}
    </>
  );
}
