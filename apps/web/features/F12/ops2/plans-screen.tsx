"use client";
// 配るもの › プラン › いまのプラン（/ops/skills/plans・K-991）。listOpsPlans を 1 回読み → 部品 PlansPage に箱の値と押したときの関数を渡す。
//   決めた・差し戻した後は一覧に戻り、知らせ（role=status）を 1 回出す。403 は「この権限では見えない」・読めないは「もう一度」
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ErrorState, NoAccess, PageBody, PageHeader } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { FALLBACKS } from "@/lib/nav";
import { planBox, type PlanOps } from "./plans-shape";
import { clearFlash, peekFlash, useOpsPlans } from "./use-ops-plans";
import { PlansPage, type PlansHrefs } from "./views-plans";

export const PLANS_PATH = "/ops/skills/plans";
export const proposalPath = (id: string) => `${PLANS_PATH}/proposals/${encodeURIComponent(id)}`;
/** 配るものの中の行き先・プランの見方の札（本番の道） */
export function plansHrefs(open: string | null): PlansHrefs {
  return {
    nav: { ops: "/ops/skills/operations", templates: "/ops/skills/templates", plans: PLANS_PATH },
    chips: { now: PLANS_PATH, log: `${PLANS_PATH}/history`, ...(open ? { proposal: proposalPath(open) } : {}) },
  };
}
/** 開いている案（下書き・待っている）の数と最初の 1 つ */
export function openProposals(plans: readonly PlanOps[]): { count: number; first: string | null } {
  const ids = plans.flatMap((p) => (p.proposal ? [p.proposal.id] : []));
  return { count: ids.length, first: ids[0] ?? null };
}

/** 入り直し（401）なら運営のログインへ移す */
export function useRelogin(need: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (need) router.replace(`/ops/login?next=${encodeURIComponent(pathname)}` as Route);
  }, [need, router, pathname]);
}

/** 読めない・見えないときの頁（見出しと中身だけ） */
export function PlansFallback({
  title,
  kind,
  retry,
}: {
  title: string;
  kind: "forbidden" | "failed" | "missing";
  retry?: () => void;
}): ReactNode {
  return (
    <PageBody labelledBy="oq-plans-fallback">
      <PageHeader
        id="oq-plans-fallback"
        title={title}
        {...(kind === "forbidden" ? { sub: FALLBACKS.forbidden.title } : {})}
      />
      {kind === "forbidden" ? (
        <NoAccess />
      ) : kind === "missing" ? (
        <ErrorState code={PAGE_ERROR.notFound} acts={[PLANS_PATH]} />
      ) : (
        <ErrorState code={PAGE_ERROR.loadFailed} acts={retry ? [retry] : []} />
      )}
    </PageBody>
  );
}

export function PlansScreen() {
  const router = useRouter();
  const list = useOpsPlans();
  const [status] = useState(() => peekFlash());
  useEffect(() => clearFlash(), []);
  useRelogin(list.data?.kind === "login");

  if (list.isPending || list.data?.kind === "login") return null;
  const res = list.data;
  if (res?.kind === "forbidden") return <PlansFallback title="プラン" kind="forbidden" />;
  if (res?.kind !== "ok") return <PlansFallback title="プラン" kind="failed" retry={() => void list.refetch()} />;

  const open = openProposals(res.data);
  return (
    <PlansPage
      plans={res.data.map((p) => ({ ...planBox(p), key: p.plan_key }))}
      onPropose={(key) => router.push(`${PLANS_PATH}/new?plan=${encodeURIComponent(key)}` as Route)}
      hrefs={plansHrefs(open.first)}
      proposals={open.count}
      status={status}
    />
  );
}
