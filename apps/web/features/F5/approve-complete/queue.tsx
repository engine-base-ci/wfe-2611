"use client";
// 承認待ち（K-161・道 /approvals）。自分が決めるもの（承認する人＝今の担当者）だけを、期限で区切って並べる（日本時間の日付・D-128.36）。
//   1 回 20 件。末尾の「もっと見る」で、口がくれた続きの印（meta.cursor）を渡して最後の行の次から読み足す（D-131.9）。
//   見出しの横と左のメニューの「承認待ち」に同じ数（口の meta.counts.total）。文は全部文字として出す（HTML を作らない）。
//   行の「承認する」（K-180）：取り消せる操作で人が見る項目が無い行だけ、その場で承認する。答えが来るまでどの行も押せない。
//   決まっていた（409）・消されていた（404）は知らせ（role=alert）に正本の文を出し、どの答えでも一覧を読み直す。「差し戻す」は K-163 が足す
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Callout, Loading, Table, type Column } from "@/components/k";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { DUE_GROUPS, dueGroupOf } from "./due";
import "./approve.css";

export interface QueueRow {
  kind: string;
  id: string;
  ticket_id: string;
  ticket_number: string;
  title: string;
  from_member_id: string | null;
  from_name: string | null;
  check_summary: string;
  due_on: string | null;
  decide_inline: boolean;
  irreversible: boolean;
  primary_action: "approve" | "open";
  secondary_action: "return";
  note: string | null;
  created_at: string;
}
interface QueuePage {
  rows: QueueRow[];
  total: number;
  cursor: string | null;
}

export const queueKey = ["k63", "queue"] as const;
const LOAD_FAILED = "承認待ちを読み込めませんでした。もう一度お試しください";

class QueueReadError extends Error {}

async function readPage(cursor: string | null): Promise<QueuePage> {
  const r = await call("listApprovalQueue", {
    query: cursor ? { cursor } : {},
    screenId: "approvals",
  });
  if (!r.ok) throw new QueueReadError(r.code);
  const counts = (r.meta["counts"] ?? {}) as { total?: number };
  const rows = r.data as unknown as QueueRow[];
  return { rows, total: Number(counts.total ?? rows.length), cursor: r.meta.cursor ?? null };
}

export function ApprovalsPage() {
  const q = useInfiniteQuery({
    queryKey: queueKey,
    enabled: typeof window !== "undefined" && !!getToken(),
    retry: false,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => readPage(pageParam),
    getNextPageParam: (last) => last.cursor,
  });
  useEffect(() => {
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent("/approvals")}`);
  }, []);
  const pages = q.data?.pages ?? [];
  const total = pages.at(-1)?.total ?? 0;
  return (
    <TicketShell counts={{ approvals: total }}>
      <section className="k-root k-page k63-queue" aria-labelledby="approvals-title">
        <header className="k-page-head k63-head">
          <h1 id="approvals-title">承認待ち</h1>
          {q.data ? <span className="k63-count">{total} 件</span> : null}
        </header>
        {q.isError ? (
          <div className="k-state" role="alert">
            <p className="k-state-body">{LOAD_FAILED}</p>
            <div className="k-state-actions">
              <Button onClick={() => void q.refetch()}>もう一度</Button>
            </div>
          </div>
        ) : !q.data ? (
          <Loading />
        ) : (
          <QueueView
            rows={pages.flatMap((p) => p.rows)}
            more={q.hasNextPage}
            loadingMore={q.isFetchingNextPage}
            onMore={() => void q.fetchNextPage()}
          />
        )}
      </section>
    </TicketShell>
  );
}

interface QueueViewProps {
  rows: QueueRow[];
  more: boolean;
  loadingMore: boolean;
  onMore: () => void;
}

/** 知らせの文（正本の文）。正本に無い言葉は「読み込めなかった」の文 */
function messageOf(r: Pick<CallErr, "kind" | "code" | "status">): string {
  try {
    return errorText(errorCodeOf(r)).entry.message;
  } catch {
    return errorText(PAGE_ERROR.loadFailed).entry.message;
  }
}

function QueueView({ rows, more, loadingMore, onMore }: QueueViewProps) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set()); // 承認した行は、読み直しの前でも一覧から外す
  const sending = useRef(false); // 答えが来るまで 2 本目を送らない（押せない間の click も含む）
  const approve = async (row: QueueRow) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(row.id);
    setNotice(null);
    try {
      const r = await call("approveApproval", { params: { id: row.id }, body: {}, screenId: "approvals" });
      if (r.ok) setDone((d) => new Set([...d, row.id]));
      else if (r.status !== 401) setNotice(messageOf(r)); // 401 は入り直し（共通の扱い）
      await qc.invalidateQueries({ queryKey: queueKey });
    } finally {
      sending.current = false;
      setBusy(null);
    }
  };
  const columns: Column<QueueRow>[] = [
    { key: "number", header: "番号", cell: (r) => r.ticket_number },
    {
      key: "title",
      header: "題名",
      cell: (r) => (
        <span className="k63-title">
          <a className="k-link" href={`/tickets/${r.ticket_id}`}>
            {r.title}
          </a>
          {r.note ? <span className="k-desc">{r.note}</span> : null}
        </span>
      ),
    },
    { key: "from", header: "作った AI", cell: (r) => `${r.from_name ?? "自分"}のAI` },
    { key: "check", header: "検査", cell: (r) => <Badge>{r.check_summary}</Badge> },
    { key: "due", header: "期限", cell: (r) => r.due_on ?? "—" },
    {
      key: "act",
      header: "操作",
      // 取り消せない操作の行は、行では決めずにチケットの詳細の帯で中身を見てから決める（D-128.36）
      cell: (r) =>
        r.decide_inline ? (
          <Button size="sm" loading={busy === r.id} disabled={busy !== null} onClick={() => void approve(r)}>
            承認する
          </Button>
        ) : (
          <a className="k-link" href={`/tickets/${r.ticket_id}`}>
            中身を見る
          </a>
        ),
    },
  ];
  const alert = notice ? <Callout tone="danger">{notice}</Callout> : null;
  const shown = rows.filter((r) => !done.has(r.id));
  if (shown.length === 0)
    return (
      <>
        {alert}
        <p className="k-desc">いま決めるものはありません</p>
      </>
    );
  const groups = DUE_GROUPS.map((g) => [g, shown.filter((r) => dueGroupOf(r.due_on) === g)] as const).filter(
    ([, rs]) => rs.length > 0,
  );
  return (
    <>
      {alert}
      {groups.map(([g, rs]) => (
        <Table key={g} caption={g} columns={columns} rows={rs} rowKey={(r) => r.id} />
      ))}
      {more ? (
        <Button className="k63-more" variant="secondary" loading={loadingMore} disabled={loadingMore} onClick={onMore}>
          もっと見る
        </Button>
      ) : null}
    </>
  );
}
