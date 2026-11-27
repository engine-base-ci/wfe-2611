"use client";
// 配るもの › ひな形（/ops/skills/templates・K-994）。listOpsTemplates を 1 回読み → 部品 TemplatesPage に行の値と中の行き先を渡す。
//   ［ひな形を足す］は押せない形。［新しい版］は直す頁（K-1111）へのリンク。新しい版を出して戻ったら「v<N> を出しました」を 1 回出す（role=status）。
//   403 は「この権限では見えない」・読めないは「もう一度」・401 は運営のログインへ
import { useEffect, useState } from "react";
import { PlansFallback, plansHrefs, useRelogin } from "./plans-screen";
import { templateRow } from "./templates-shape";
import { useOpsTemplates } from "./use-ops-templates";
import { clearTemplateFlash, peekTemplateFlash, templateNewPath } from "./use-template-edit";
import { TemplatesPage } from "./views-skills";

export const TEMPLATES_PATH = "/ops/skills/templates";
const TITLE = "ひな形";

export function TemplatesScreen() {
  const list = useOpsTemplates();
  const [status] = useState(() => peekTemplateFlash());
  useEffect(() => clearTemplateFlash(), []);
  useRelogin(list.data?.kind === "login");

  if (list.isPending || list.data?.kind === "login") return null;
  const res = list.data;
  if (res?.kind === "forbidden") return <PlansFallback title={TITLE} kind="forbidden" />;
  if (res?.kind !== "ok") return <PlansFallback title={TITLE} kind="failed" retry={() => void list.refetch()} />;

  const { nav } = plansHrefs(null);
  return (
    <TemplatesPage
      rows={res.data.map(templateRow)}
      newHref={(r) => templateNewPath(r.id)}
      status={status}
      {...(nav ? { nav } : {})}
    />
  );
}
