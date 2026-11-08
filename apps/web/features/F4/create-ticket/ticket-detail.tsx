"use client";
// チケットの詳細（K-60 では読むだけ・道 /tickets/[id]）。番号・題名・種別・段・担当者・期限と、区画の本文（版 1）。
//   本文は文字として出す（HTML やスクリプトを動かさない）。題名のすぐ下に承認と実行の帯（K-63・apps/web/features/F5/approve-complete/）、
//   その下に AI に任せるの帯、右に実行の記録（K-62・apps/web/features/F5/delegate/）。詳細は K-63 の帯と同じ鍵で読む（帯が読み直す）
import { useEffect } from "react";
import { Badge, ErrorState, Loading } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { getToken } from "@/lib/api/client";
import { DelegateBand } from "@/features/F5/delegate/delegate-band";
import { RunLog } from "@/features/F5/delegate/run-log";
import { useRuns } from "@/features/F5/delegate/use-run";
import "@/features/F5/delegate/delegate.css";
import { ApproveBand } from "@/features/F5/approve-complete/band";
import { TicketReadError, useTicket } from "@/features/F5/approve-complete/shared";
import "@/features/F5/approve-complete/approve.css";
import { TicketShell } from "./ticket-shell";

interface Detail {
  ticket: {
    id: string;
    number: string;
    title: string;
    due_on: string | null;
    start_on: string | null;
    priority: string;
  };
  sections: { key: string; label: string; body: { text?: string } | null; version: number }[];
  kind: { name: string } | null;
  stage: { key?: string | null; name: string } | null;
  assignee: { display_name: string } | null;
  /** 見ている人ができること（K-62 が delegate を足す） */
  can?: { delegate?: boolean; complete?: boolean } | null;
  /** 承認待ちの承認（K-63 が足す）。can_decide＝見ている人が承認する人か */
  approval?: { id: string; can_decide: boolean } | null;
}

/** 前からある外枠（AppShell）に載せる（D-128.151） */
export function TicketDetail({ id }: { id: string }) {
  return (
    <TicketShell>
      <DetailBody id={id} />
    </TicketShell>
  );
}

function DetailBody({ id }: { id: string }) {
  const here = `/tickets/${id}`;
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const ready = typeof window !== "undefined" && !!getToken() && valid;
  const q = useTicket<Detail>(id, { enabled: ready });
  useEffect(() => {
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [here]);
  const code = !valid
    ? PAGE_ERROR.notFound
    : q.error && !q.data
      ? q.error instanceof TicketReadError
        ? q.error.code
        : errorCodeOf({ kind: "failed", code: "", status: 0 })
      : null;
  if (code)
    return (
      <ErrorState
        code={code}
        heading={1}
        acts={code === PAGE_ERROR.sessionExpired ? [`/login?next=${encodeURIComponent(here)}`] : ["/tickets"]}
      />
    );
  if (!q.data) return <Loading />;
  return (
    <DetailView
      id={id}
      d={q.data}
      reload={async () => {
        await q.refetch();
      }}
    />
  );
}

function DetailView({ id, d, reload }: { id: string; d: Detail; reload: () => Promise<void> }) {
  const runs = useRuns(id);
  const t = d.ticket;
  return (
    <section className="k-root k-page" aria-labelledby="ticket-title">
      <a className="k-link" href="/tickets">
        チケットへ戻る
      </a>
      <header className="k-page-head">
        <p className="k-desc">{t.number}</p>
        <h1 id="ticket-title">{t.title}</h1>
        <p>
          <Badge>{d.stage?.name ?? ""}</Badge> {d.kind?.name ?? ""}・担当 {d.assignee?.display_name ?? "—"}・期限{" "}
          {t.due_on ?? "—"}
          {t.start_on ? `・開始 ${t.start_on}` : ""}・優先度 {t.priority === "high" ? "高" : "中"}
        </p>
      </header>
      <ApproveBand ticketId={id} run={runs.current} />
      <DelegateBand
        ticket={{
          id,
          stageKey: d.stage?.key ?? null,
          canDelegate: d.can?.delegate === true,
          canDecide: d.approval?.can_decide === true,
        }}
        run={runs.current}
        onRun={runs.follow}
        onChanged={async () => {
          await Promise.all([reload(), runs.reload()]);
        }}
      />
      <div className="k62-layout">
        <div>
          {d.sections.map((s) => (
            <section key={s.key} className="k-section" aria-label={s.label}>
              <h2>{s.label}</h2>
              <p className="k-pre">{s.body?.text ?? ""}</p>
            </section>
          ))}
        </div>
        <RunLog runs={runs.runs} />
      </div>
    </section>
  );
}
