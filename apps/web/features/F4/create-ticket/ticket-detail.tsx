"use client";
// チケットの詳細（K-60 では読むだけ・道 /tickets/[id]）。番号・題名・種別・段・担当者・期限と、区画の本文（版 1）。
//   本文は文字として出す（HTML やスクリプトを動かさない）。直す・AI に任せるは後のチケット（K-62 が上の帯にボタンを足す）
import { useEffect, useState } from "react";
import { Badge, ErrorState, Loading } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
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
  stage: { name: string } | null;
  assignee: { display_name: string } | null;
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
  const [d, setD] = useState<Detail | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const here = `/tickets/${id}`;
  useEffect(() => {
    if (!getToken()) {
      window.location.replace(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      setCode(PAGE_ERROR.notFound);
      return;
    }
    void call("getTicket", { params: { id }, screenId: "tickets" }).then((r) => {
      if (r.ok) setD(r.data as unknown as Detail);
      else setCode(errorCodeOf(r));
    });
  }, [id, here]);
  if (code)
    return (
      <ErrorState
        code={code}
        heading={1}
        acts={code === PAGE_ERROR.sessionExpired ? [`/login?next=${encodeURIComponent(here)}`] : ["/tickets"]}
      />
    );
  if (!d) return <Loading />;
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
      {d.sections.map((s) => (
        <section key={s.key} className="k-section" aria-label={s.label}>
          <h2>{s.label}</h2>
          <p className="k-pre">{s.body?.text ?? ""}</p>
        </section>
      ))}
    </section>
  );
}
