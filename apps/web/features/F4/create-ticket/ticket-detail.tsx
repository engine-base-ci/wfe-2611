"use client";
// チケットの詳細（K-60 では読むだけ・道 /tickets/[id]）。番号・題名・種別・段・担当者・期限と、区画の本文（版 1）。
//   本文は文字として出す（HTML やスクリプトを動かさない）。見出しの下に承認と実行の帯（K-162・apps/web/features/F5/approve-complete/）と
//   AI に任せるの帯、右に実行の記録（K-62・apps/web/features/F5/delegate/）
import { useCallback, useEffect, useRef, useState } from "react";
import { isUuid } from "@kaname/contracts";
import { Badge, ErrorState, Loading } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { ApproveBand } from "@/features/F5/approve-complete/band";
import { DelegateBand } from "@/features/F5/delegate/delegate-band";
import { RunLog } from "@/features/F5/delegate/run-log";
import { ACTIVE, useRuns } from "@/features/F5/delegate/use-run";
import "@/features/F5/delegate/delegate.css";
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
  /** 見ている人ができること（K-62 が delegate を、K165 が complete を足す） */
  can?: { delegate?: boolean; complete?: boolean } | null;
  /** 完了の時刻と押した人の表示名（K165 が足す。完了していなければ null） */
  completed?: { at: string; by: string | null } | null;
  /** 承認待ちの承認（K-162 が足す）。can_decide＝見ている人が承認する人か */
  approval?: {
    id: string;
    can_decide: boolean;
    irreversible?: boolean;
    note?: string | null;
    approver_name?: string | null;
  } | null;
}

/** キャンバスどおりの新しい外枠に載せる（D-143.1）。上の帯のいまの場所は チケット › 番号（番号は読めてから） */
export function TicketDetail({ id }: { id: string }) {
  const [number, setNumber] = useState<string | null>(null);
  return (
    <TicketShell
      screen="tickets"
      crumbs={[{ label: "チケット", href: "/tickets" }, ...(number ? [{ label: number }] : [])]}
    >
      <DetailBody id={id} onNumber={setNumber} />
    </TicketShell>
  );
}

function DetailBody({ id, onNumber }: { id: string; onNumber: (n: string) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const here = `/tickets/${id}`;
  const load = useCallback(
    () =>
      call("getTicket", { params: { id }, screenId: "tickets" }).then((r) => {
        if (r.ok) {
          const detail = r.data as unknown as Detail;
          setD(detail);
          onNumber(detail.ticket.number);
        } else setCode(errorCodeOf(r));
      }),
    [id, onNumber],
  );
  useEffect(() => {
    if (!getToken()) {
      window.location.replace(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    // 入口と同じ正式な uuid の確かめ（版と variant の桁まで・D-129.42・K-144）。違えば口を呼ばずに「見つからない」
    if (!isUuid(id)) {
      setCode(PAGE_ERROR.notFound);
      return;
    }
    void load();
  }, [here, id, load]);
  if (code)
    return (
      <ErrorState
        code={code}
        heading={1}
        acts={code === PAGE_ERROR.sessionExpired ? [`/login?next=${encodeURIComponent(here)}`] : ["/tickets"]}
      />
    );
  if (!d) return <Loading />;
  return <DetailView id={id} d={d} reload={load} onTicket={setD} />;
}

function DetailView({
  id,
  d,
  reload,
  onTicket,
}: {
  id: string;
  d: Detail;
  reload: () => Promise<void>;
  onTicket: (d: Detail) => void;
}) {
  const runs = useRuns(id);
  // 動いていた実行が終わった・止まった読み直しで、チケットの詳細（段・can.delegate・成果物の区画）も読み直す（K62-UI-029・030・G-12）
  const status = runs.current?.status ?? null;
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (was && ACTIVE.has(was) && status && !ACTIVE.has(status)) void reload();
  }, [status, reload]);
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
      <ApproveBand
        ticketId={id}
        ticket={d}
        run={runs.current}
        runKnown={runs.known}
        onTicket={onTicket}
        onChanged={async () => {
          await Promise.all([reload(), runs.reload()]);
        }}
      />
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
