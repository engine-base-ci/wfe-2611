// 配るもの › ひな形・操作の画面（K-994）の、口の答え → 部品の値。画面の外の純粋な関数（@/ を読まない・単体の試験 k994-templates-shape.test.ts）。
//   答えの形は 11_tickets/K-992.md（OpsTemplateRow 8 欄）・K-1010.md（OpsOperation 6 欄）。字は下絵（views-skills.tsx）が正。日付は日本時間

/** listOpsTemplates の 1 行（K-992・契約の型が追いつくまで読む欄だけを持つ） */
export interface OpsTemplateRow {
  id: string;
  key: string;
  name: string;
  summary: string;
  version: number;
  using: number;
  took: { changed: number; offered: number } | null;
  last_released_at: string | null;
}
/** listOperations の 1 行（K-1010） */
export interface OpsOperation {
  id: string;
  key: string;
  name: string;
  version_label: string;
  description: string;
  check_state: string;
}
/** 部品 TemplatesPage の 1 行 */
export interface TemplateRowView {
  id: string;
  name: string;
  body: string;
  ver: string;
  using: string;
  took: string;
  last: string;
}
/** 部品 OperationsPage の 1 枚（札が無ければ null） */
export interface OperationCardView {
  title: string;
  aside: string;
  body: string;
  badge: string | null;
}

const NONE = "—";
const NUM = new Intl.NumberFormat("ja-JP");
const JST = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit" });

/** 時刻 → 「MM/DD」（日本時間）。無い・読めない時刻は「—」 */
export function jstDay(iso: string | null): string {
  if (!iso) return NONE;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NONE;
  const part = (t: string) => JST.formatToParts(d).find((p) => p.type === t)?.value ?? "";
  return `${part("month")}/${part("day")}`;
}

export function templateRow(r: OpsTemplateRow): TemplateRowView {
  return {
    id: r.key,
    name: r.name,
    body: r.summary,
    ver: `v${r.version}`,
    using: NUM.format(r.using),
    took: r.took ? `${NUM.format(r.took.changed)} ／ ${NUM.format(r.took.offered)}` : NONE,
    last: jstDay(r.last_released_at),
  };
}

const BADGE: Readonly<Record<string, string>> = { passed: "検査 通った", failed: "検査 落ちた" };

export function operationCard(o: OpsOperation): OperationCardView {
  return {
    title: o.name,
    aside: `${o.version_label} ・ 読むだけ`,
    body: o.description,
    badge: BADGE[o.check_state] ?? null,
  };
}
