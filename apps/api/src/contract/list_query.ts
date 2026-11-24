// 一覧の問い合わせ（limit・cursor・scope_id・sort）の形の確かめ（K-429）。決まりは共通の入口（op.ts）の `kind: list` と同じ。
//   口（hooks）が自分で答えを組む一覧（`kind: get` で答えが配列の口）が、契約の形から外れた問い合わせを素通りしないために呼ぶ。
//   空の値（?sort=）は指定なしと同じ（K-35）
import { isUuid } from "@kaname/contracts";
import type { Repository, TableName } from "@kaname/db/repository";

export const LIST_LIMIT_MAX = 200;
const CURSOR_FORM = /^[0-9]{1,9}$/;
const SORT_FORM = /^[a-z_][a-z0-9_]{0,62}$/;

export type QueryIssue = { field: string; message: string };

// sort の値を口が持つ一覧の口（K-748）。入口は列名の形だけ見て、表の列に在るかは見ない（値は口が決まった物だけ通す）。
//   契約の生成器 05_flow/build_api.py の OWN_SORT_OPS と同じ集まり
export const OWN_SORT_OPS: ReadonlySet<string> = new Set(["listApprovalQueue"]);

export function listQueryIssues(
  query: Record<string, string | undefined>,
  ctx: { table: TableName; repo: Pick<Repository, "hasColumn">; op?: string },
): QueryIssue[] {
  const q = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ""));
  const issues: QueryIssue[] = [];
  if (q["limit"] !== undefined) {
    const n = Number(q["limit"]);
    if (!Number.isInteger(n) || n < 1 || n > LIST_LIMIT_MAX)
      issues.push({ field: "limit", message: `1〜${LIST_LIMIT_MAX}` });
  }
  if (q["cursor"] !== undefined && !CURSOR_FORM.test(q["cursor"])) issues.push({ field: "cursor", message: "不正" });
  if (q["scope_id"] !== undefined && !isUuid(q["scope_id"])) issues.push({ field: "scope_id", message: "uuid" });
  const sort = q["sort"];
  const ownSort = ctx.op !== undefined && OWN_SORT_OPS.has(ctx.op);
  if (sort !== undefined && (!SORT_FORM.test(sort) || (!ownSort && !ctx.repo.hasColumn(ctx.table, sort))))
    issues.push({ field: "sort", message: "列名" });
  return issues;
}
