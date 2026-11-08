"use client";
// 承認待ち（K-63・道 /approvals）。自分が決めるもの（承認する人＝今の担当者）だけを、期限で区切って並べる（日本時間の日付・D-128.36）。
//   取り消せる操作で人が見る項目が無い行だけ、その場で「承認する」。取り消せない操作は「中身を見る」でチケットの詳細の帯へ。
//   見出しの横と左のメニューの「承認待ち」に同じ数（口の meta.counts.total）。文は全部文字として出す（HTML を作らない）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Callout, ErrorState, Loading, Table, type Column } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { ReturnDialog } from "./return-dialog";
import { DUE_GROUPS, TicketReadError, dueGroupOf, messageOf, queueKey, type DueGroup } from "./shared";
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
interface Queue {
  rows: QueueRow[];
  total: number;
}

export function ApprovalsPage() {
  const q = useQuery({
    queryKey: queueKey,
    enabled: typeof window !== "undefined" && !!getToken(),
    retry: false,
    queryFn: async (): Promise<Queue> => {
      const r = await call("listApprovalQueue", { screenId: "approvals" });
      if (!r.ok) throw new TicketReadError(errorCodeOf(r));
      const rows = r.data as unknown as QueueRow[];
      const counts = (r.meta["counts"] ?? {}) as { total?: number };
      return { rows, total: Number(counts.total ?? rows.length) };
    },
  });
  useEffect(() => {
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent("/approvals")}`);
  }, []);
  return (
    <TicketShell counts={{ approvals: q.data ? q.data.total : 0 }}>
      <QueueBody q={q} />
    </TicketShell>
  );
}

function QueueBody({ q }: { q: { data: Queue | undefined; error: Error | null } }) {
  if (q.error && !q.data) {
    const code = q.error instanceof TicketReadError ? q.error.code : PAGE_ERROR.loadFailed;
    return <ErrorState code={code} heading={1} acts={["/tickets"]} />;
  }
  if (!q.data) return <Loading />;
  return <QueueView queue={q.data} />;
}

function QueueView({ queue: served }: { queue: Queue }) {
  const qc = useQueryClient();
  // 決めた行は、読み直しの答えを待たずに一覧から外す（押した人の画面では二度押させない）
  const [decided, setDecided] = useState<Set<string>>(() => new Set());
  const queue = useMemo(() => {
    const rows = served.rows.filter((r) => !decided.has(r.id));
    return { rows, total: Math.max(0, served.total - (served.rows.length - rows.length)) };
  }, [served, decided]);
  const forget = (id: string) => setDecided((cur) => new Set(cur).add(id));
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [returning, setReturning] = useState<string | null>(null);
  const sending = useRef<string | null>(null);
  const reload = () => qc.invalidateQueries({ queryKey: queueKey });
  const failed = async (r: CallErr) => {
    if (r.status === 401) return; // 入り直しへ（共通の扱い）
    setNotice(messageOf(r));
    await reload();
  };
  const approve = async (row: QueueRow) => {
    if (sending.current) return;
    sending.current = row.id;
    setBusy(row.id);
    setNotice(null);
    try {
      const r = await call("approveApproval", { params: { id: row.id }, body: {}, screenId: "approvals" });
      if (r.ok) {
        forget(row.id);
        await reload();
      } else await failed(r);
    } finally {
      sending.current = null;
      setBusy(null);
    }
  };
  const groups = DUE_GROUPS.map((g) => [g, queue.rows.filter((r) => dueGroupOf(r.due_on) === g)] as const).filter(
    ([, rows]) => rows.length > 0,
  );
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
      cell: (r) => (
        <span className="k63-acts">
          {r.decide_inline ? (
            <Button size="sm" loading={busy === r.id} disabled={busy !== null} onClick={() => void approve(r)}>
              承認する
            </Button>
          ) : (
            <a className="k-link" href={`/tickets/${r.ticket_id}`}>
              中身を見る
            </a>
          )}
          <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => setReturning(r.id)}>
            差し戻す
          </Button>
        </span>
      ),
    },
  ];
  return (
    <section className="k-root k-page" aria-labelledby="approvals-title">
      <header className="k-page-head k63-head">
        <h1 id="approvals-title">承認待ち</h1>
        <span className="k63-count">{queue.total} 件</span>
      </header>
      {notice ? <Callout tone="danger">{notice}</Callout> : null}
      {queue.rows.length === 0 ? (
        <p className="k63-empty">いま決めるものはありません</p>
      ) : (
        groups.map(([g, rows]: readonly [DueGroup, QueueRow[]]) => (
          <Table key={g} caption={g} columns={columns} rows={rows} rowKey={(r) => r.id} />
        ))
      )}
      {returning ? (
        <ReturnDialog
          approvalId={returning}
          open
          onOpenChange={(o) => {
            if (!o) setReturning(null);
          }}
          onDone={async () => {
            setNotice(null);
            await reload();
          }}
          onFailed={failed}
        />
      ) : null}
    </section>
  );
}
