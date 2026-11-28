"use client";
// 配るもの › 操作（/ops/skills/operations・K-994）。listOperations を 1 回読み → 部品 OperationsPage に 1 枚ずつの値と中の行き先を渡す。
//   読むだけ：［操作を上げる］［版を見る］は押せない形（版は 1 つだけ）。403 は「この権限では見えない」・読めないは「もう一度」・401 は運営のログインへ
import { PlansFallback, plansHrefs, useRelogin } from "./plans-screen";
import { operationCard, type OpsOperation } from "./templates-shape";
import { useOpsOperations } from "./use-ops-templates";
import { OperationsPage, type OperationView } from "./views-skills";

export const OPERATIONS_PATH = "/ops/skills/operations";
const TITLE = "操作";

const viewOf = (o: OpsOperation): OperationView => ({
  ...operationCard(o),
  key: o.id,
  tone: o.check_state === "failed" ? "danger" : "success",
});

export function OperationsScreen() {
  const list = useOpsOperations();
  useRelogin(list.data?.kind === "login");

  if (list.isPending || list.data?.kind === "login") return null;
  const res = list.data;
  if (res?.kind === "forbidden") return <PlansFallback title={TITLE} kind="forbidden" />;
  if (res?.kind !== "ok") return <PlansFallback title={TITLE} kind="failed" retry={() => void list.refetch()} />;

  const { nav } = plansHrefs(null);
  return <OperationsPage operations={res.data.map(viewOf)} versionDisabled {...(nav ? { nav } : {})} />;
}
