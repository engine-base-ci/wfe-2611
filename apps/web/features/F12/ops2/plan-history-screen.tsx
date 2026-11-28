"use client";
// 配るもの › プラン › 記録（/ops/skills/plans/history・K-991）。listPlanHistory を 1 回読み → 部品 PlanLogPage に行を渡す。
//   プランの札で ?plan=<key> を道に載せ（戻るで戻れる）、口には plan_key で絞って聞く。消せない・直せない（読むだけ）
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { historyItem } from "./plans-shape";
import { PLANS_PATH, PlansFallback, openProposals, plansHrefs, useRelogin } from "./plans-screen";
import { useOpsPlans, usePlanHistory } from "./use-ops-plans";
import { PlanLogPage } from "./views-plans";

const HISTORY_PATH = `${PLANS_PATH}/history`;
const PLAN_KEYS = new Set(["free", "team", "business"]);

export function PlanHistoryScreen({ plan }: { plan: string | null }) {
  const router = useRouter();
  const key = plan && PLAN_KEYS.has(plan) ? plan : null;
  const log = usePlanHistory(key);
  const plans = useOpsPlans(); // 変える案の札の数と行き先だけ（記録と同時に読む）
  useRelogin(log.data?.kind === "login");

  if (log.isPending || log.data?.kind === "login") return null;
  const res = log.data;
  if (res?.kind === "forbidden") return <PlansFallback title="プランの記録" kind="forbidden" />;
  const open = plans.data?.kind === "ok" ? openProposals(plans.data.data) : { count: 0, first: null };
  return (
    <PlanLogPage
      items={res?.kind === "ok" ? res.data.map(historyItem) : []}
      plan={key}
      onPlan={(k) => router.push((k ? `${HISTORY_PATH}?plan=${encodeURIComponent(k)}` : HISTORY_PATH) as Route)}
      hrefs={plansHrefs(open.first)}
      proposals={open.count}
      {...(res?.kind === "ok"
        ? {}
        : { fallback: <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void log.refetch()]} /> })}
    />
  );
}
