"use client";
// 配るもの › ひな形（/ops/skills/templates・K-994）。listOpsTemplates を 1 回読み → 部品 TemplatesPage に行の値と中の行き先を渡す。
//   ［ひな形を足す］［新しい版］は押せない形（押せる形にして直す頁へ向けるのは K-1111：ここで newHref を渡す）。
//   403 は「この権限では見えない」・読めないは「もう一度」・401 は運営のログインへ
import { PlansFallback, plansHrefs, useRelogin } from "./plans-screen";
import { templateRow } from "./templates-shape";
import { useOpsTemplates } from "./use-ops-templates";
import { TemplatesPage } from "./views-skills";

export const TEMPLATES_PATH = "/ops/skills/templates";
const TITLE = "ひな形";

export function TemplatesScreen() {
  const list = useOpsTemplates();
  useRelogin(list.data?.kind === "login");

  if (list.isPending || list.data?.kind === "login") return null;
  const res = list.data;
  if (res?.kind === "forbidden") return <PlansFallback title={TITLE} kind="forbidden" />;
  if (res?.kind !== "ok") return <PlansFallback title={TITLE} kind="failed" retry={() => void list.refetch()} />;

  const { nav } = plansHrefs(null);
  return <TemplatesPage rows={res.data.map(templateRow)} {...(nav ? { nav } : {})} />;
}
