// チケットの表（K-251・キャンバス Main の表）。列は 番号・題名・種別・状態・担当者・期限・更新 の 7 つ（D-128.15・D-128.25）。
//   番号と題名は /tickets/<id> へのリンク。担当者は頭文字の丸と名前、AI に任せていれば名前の横に「AI」の札（「〈名前〉のAI」とは書かない・D-128.26）。
//   期限切れの行は期限の横に炎の印（読み上げ「期限切れ」）。題名は字のまま出す（React が字として描く・K251-UI-016）。
//   下に「もっと見る」（次がある時だけ・押している間は押せない）。次の分が読めなかったら、読んだ行を残して「もう一度」
import { Bot, Flame } from "lucide-react";
import { Button } from "@/components/k";
import { errorText } from "@/components/k/error-of";
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

/** 日付（YYYY-MM-DD か ISO）を日本時間の MM/DD に */
export function mmdd(v: string | null): string {
  if (!v) return "";
  const t = Date.parse(v.length === 10 ? `${v}T00:00:00+09:00` : v);
  if (Number.isNaN(t)) return "";
  return new Date(t + 9 * 3600_000).toISOString().slice(5, 10).replace("-", "/");
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

function Row({ row }: { row: ListItem }) {
  const href = `/tickets/${encodeURIComponent(row.id)}`;
  return (
    <tr data-ticket={row.id}>
      <td>
        <a className="k-list-link k-list-number" href={href}>
          {row.number}
        </a>
      </td>
      <td className="k-list-title-cell">
        <a className="k-list-link" href={href}>
          {row.title}
        </a>
      </td>
      <td>
        {row.kind ? (
          <span className="k-list-tag" data-tone={KIND_TONE[row.kind.name] ?? "neutral"}>
            {row.kind.name}
          </span>
        ) : null}
      </td>
      <td>
        {row.stage ? (
          <span className="k-list-tag" data-tone={STAGE_TONE[row.stage.key ?? ""] ?? "neutral"}>
            {row.stage.name}
          </span>
        ) : null}
      </td>
      <td>
        <Assignee row={row} />
      </td>
      <td data-late={row.overdue || undefined}>
        {mmdd(row.due_on)}
        {row.overdue ? (
          <span className="k-list-late" role="img" aria-label="期限切れ">
            <Flame aria-hidden="true" />
          </span>
        ) : null}
      </td>
      <td className="k-list-dim">{mmdd(row.updated_at)}</td>
    </tr>
  );
}

const HEADS = ["番号", "題名", "種別", "状態", "担当者", "期限", "更新"] as const;

export interface ListTableProps {
  rows: ListItem[];
  hasMore: boolean;
  loadingMore: boolean;
  moreError: string | null;
  onMore: () => void;
}

export function ListTable({ rows, hasMore, loadingMore, moreError, onMore }: ListTableProps) {
  return (
    <>
      <div className="k-list-scroll">
        <table className="k-list-table" aria-label="チケットの一覧">
          <thead>
            <tr>
              {HEADS.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.id} row={r} />
            ))}
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
