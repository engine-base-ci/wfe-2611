// チケットの表（K-251・キャンバス Main の表・一覧の共通の部品）。列は list-columns.tsx の 9 つのうち表示設定で選んだもの。
//   番号と題名は /tickets/<id> へのリンク。担当者は頭文字の丸と名前、AI に任せていれば名前の横に「AI」の札（「〈名前〉のAI」とは書かない・D-128.26）。
//   グループ・予定・実績は一覧の口に値が無いので空（D-144.3）。期限切れの行は期限の横に炎の印（読み上げ「期限切れ」）。題名は字のまま出す（K251-UI-016）。
//   自分に関わるものは期限で区切る（期限切れ・今日まで・今週・来週以降・件数は出さない）。読んだ行全部を区切り直し、中は口の並びのまま。
//   下に「もっと見る」（次がある時だけ・押している間は押せない）。次の分が読めなかったら、読んだ行を残して「もう一度」
import { Bot, Flame } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Button } from "@/components/k";
import { errorText } from "@/components/k/error-of";
import { COLUMN_LABEL, type ColumnKey } from "./list-columns";
import type { ListItem } from "./use-ticket-list";

/** 種別の札の色（キャンバス Main：タスク teal・QA 赤・課題 橙・会議 紫。ほかは中立） */
const KIND_TONE: Record<string, string> = { タスク: "secondary", QA: "error", 課題: "warning", 会議: "tertiary" };
/** 状態の札の色（作業の段の key・キャンバス Main と同じ組） */
const STAGE_TONE: Record<string, string> = {
  awaiting_approval: "warning",
  running: "progress",
  checking: "tertiary",
  doing: "indigo",
  done: "success",
};
const DAY = 86_400_000;
const JST = 9 * 3_600_000;

/** 日付（YYYY-MM-DD か ISO）を日本時間の MM/DD に */
export function mmdd(v: string | null | undefined): string {
  if (!v) return "";
  const t = Date.parse(v.length === 10 ? `${v}T00:00:00+09:00` : v);
  if (Number.isNaN(t)) return "";
  return new Date(t + JST).toISOString().slice(5, 10).replace("-", "/");
}

export type SectionKey = "overdue" | "today" | "week" | "later";
const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "overdue", label: "期限切れ" },
  { key: "today", label: "今日まで" },
  { key: "week", label: "今週" },
  { key: "later", label: "来週以降" },
];

/** 日本時間の今日と今週の日曜（週は月曜から）を YYYY-MM-DD で */
function jstDays(now: number): { today: string; sunday: string } {
  const d = new Date(now + JST);
  const toSunday = (7 - d.getUTCDay()) % 7;
  return {
    today: d.toISOString().slice(0, 10),
    sunday: new Date(d.getTime() + toSunday * DAY).toISOString().slice(0, 10),
  };
}

/** 行の区切り：期限切れ → 期限が今日以前 → 今週の日曜まで → ほか（期限なしを含む） */
export function sectionOf(row: ListItem, now: number): SectionKey {
  if (row.overdue) return "overdue";
  if (!row.due_on) return "later";
  const { today, sunday } = jstDays(now);
  if (row.due_on <= today) return "today";
  if (row.due_on <= sunday) return "week";
  return "later";
}

function Assignee({ row }: { row: ListItem }) {
  const name = row.assignee?.display_name ?? "";
  return (
    <span className="k-list-who">
      {name ? (
        <span className="k-list-avatar" aria-hidden="true">
          {name.slice(0, 1)}
        </span>
      ) : null}
      {name}
      {row.delegated_to_clone ? (
        <span className="k-list-ai" role="img" aria-label="AI に任せている" title="AI に任せている">
          <Bot aria-hidden="true" />
          AI
        </span>
      ) : null}
    </span>
  );
}

/** 列ごとのセル（td の属性と中身） */
function cellOf(key: ColumnKey, row: ListItem): { className?: string; late?: boolean; body: ReactNode } {
  const href = `/tickets/${encodeURIComponent(row.id)}`;
  switch (key) {
    case "kind":
      return {
        body: row.kind ? (
          <span className="k-list-tag" data-tone={KIND_TONE[row.kind.name] ?? "neutral"}>
            {row.kind.name}
          </span>
        ) : null,
      };
    case "number":
      return {
        body: (
          <a className="k-list-link k-list-number" href={href}>
            {row.number}
          </a>
        ),
      };
    case "title":
      return {
        className: "k-list-title-cell",
        body: (
          <a className="k-list-link" href={href}>
            {row.title}
          </a>
        ),
      };
    case "stage":
      return {
        body: row.stage ? (
          <span className="k-list-tag" data-tone={STAGE_TONE[row.stage.key ?? ""] ?? "neutral"}>
            {row.stage.name}
          </span>
        ) : null,
      };
    case "assignee":
      return { body: <Assignee row={row} /> };
    case "due":
      return {
        late: row.overdue,
        body: (
          <>
            {mmdd(row.due_on)}
            {row.overdue ? (
              <span className="k-list-late" role="img" aria-label="期限切れ">
                <Flame aria-hidden="true" />
              </span>
            ) : null}
          </>
        ),
      };
    case "updated":
      return { className: "k-list-dim", body: mmdd(row.updated_at) };
    default:
      // グループ・予定・実績：一覧の口に値が無いので空（D-144.3）
      return { className: "k-list-dim", body: null };
  }
}

function Row({ row, columns }: { row: ListItem; columns: ColumnKey[] }) {
  return (
    <tr data-ticket={row.id}>
      {columns.map((k) => {
        const c = cellOf(k, row);
        return (
          <td key={k} className={c.className} data-late={c.late || undefined}>
            {c.body}
          </td>
        );
      })}
    </tr>
  );
}

export interface ListTableProps {
  rows: ListItem[];
  columns: ColumnKey[];
  /** 期限で区切る（自分に関わるもの） */
  sections: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  moreError: string | null;
  onMore: () => void;
}

function Body({ rows, columns, sections }: Pick<ListTableProps, "rows" | "columns" | "sections">) {
  if (!sections) return rows.map((r) => <Row key={r.id} row={r} columns={columns} />);
  const now = Date.now();
  return SECTIONS.map((s) => {
    const mine = rows.filter((r) => sectionOf(r, now) === s.key);
    if (!mine.length) return null;
    return (
      <Fragment key={s.key}>
        <tr className="k-list-section" data-section={s.key}>
          <td colSpan={columns.length}>{s.label}</td>
        </tr>
        {mine.map((r) => (
          <Row key={r.id} row={r} columns={columns} />
        ))}
      </Fragment>
    );
  });
}

export function ListTable({ rows, columns, sections, hasMore, loadingMore, moreError, onMore }: ListTableProps) {
  return (
    <>
      <div className="k-list-scroll">
        <table className="k-list-table" aria-label="チケットの一覧">
          <thead>
            <tr>
              {columns.map((k) => (
                <th key={k} scope="col">
                  {COLUMN_LABEL[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Body rows={rows} columns={columns} sections={sections} />
          </tbody>
        </table>
      </div>
      {moreError ? (
        <div className="k-list-more" role="alert">
          <span>{errorText(moreError).title}</span>
          <Button variant="outlined" onClick={onMore}>
            もう一度
          </Button>
        </div>
      ) : hasMore ? (
        <div className="k-list-more">
          <Button variant="outlined" loading={loadingMore} onClick={onMore}>
            もっと見る
          </Button>
        </div>
      ) : null}
    </>
  );
}
