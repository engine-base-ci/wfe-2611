"use client";
// 版と差分の頁（K-449・道 /tickets/:id/versions?of=items&from=&to=・行為 A101・D-150.47）。
//   外枠は詳細と同じ TicketShell。上の帯のいまの場所は「チケット › 番号 › 版と差分」（番号は文字だけ）。
//   頭は下絵の VersionsHead と同じ形（「← 詳細に戻る」・番号と題名・見出し「版と差分」）。見出しは読めなかったときも出す。
//   無い（404：チケット・版の一覧・比べる版の指定）は赤い箱に E-PAGE-001 の文だけ（もう一度読むは出さない・差分も出さない）
import Link from "next/link";
import type { ReactNode } from "react";
import { NoticeBox, errorText } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import "@/features/F4/doc/doc.css";
import { selOf, useVersions } from "./use-versions";
import { VersionsView } from "./versions-view";

export interface VersionsPageProps {
  id: string;
  of: string | null;
  from: string | null;
  to: string | null;
}

export function VersionsPage({ id, of, from, to }: VersionsPageProps): ReactNode {
  const v = useVersions(id, selOf(of, from, to));
  const t = v.ticket.state === "ok" ? v.ticket.ticket : null;
  const gone =
    (v.ticket.state === "error" && v.ticket.code === PAGE_ERROR.notFound) ||
    (v.loaded.state === "error" && v.loaded.code === PAGE_ERROR.notFound);
  const headError = v.ticket.state === "error" && !gone ? v.ticket.code : null;
  return (
    <TicketShell
      screen="tickets"
      crumbs={[{ label: "チケット", href: "/tickets" }, ...(t ? [{ label: t.number }] : []), { label: "版と差分" }]}
    >
      <div className="k-root k-page">
        <header className="k-f4d-vhead">
          <Link className="k-f4d-back" href={`/tickets/${encodeURIComponent(id)}`}>
            ← 詳細に戻る
          </Link>
          {t ? (
            <p className="k-f4d-vticket">
              <b>{t.number}</b> {t.title}
            </p>
          ) : null}
          <h1>版と差分</h1>
        </header>
        {gone ? (
          <div className="k-f4d-ver">
            <NoticeBox>{errorText(PAGE_ERROR.notFound).entry.message}</NoticeBox>
          </div>
        ) : (
          <>
            {headError ? (
              <div className="k-f4d-ver">
                <NoticeBox>{errorText(headError).entry.message}</NoticeBox>
              </div>
            ) : null}
            <VersionsView
              sel={v.sel}
              loaded={v.loaded}
              completed={t?.completed ?? false}
              sending={v.sending}
              restoreError={v.restoreError}
              itemSending={v.itemSending}
              itemError={v.itemError}
              restoreNote={v.restoreNote}
              choose={v.choose}
              reload={v.reload}
              restore={() => void v.restore()}
              restoreItems={() => void v.restoreItems()}
            />
          </>
        )}
      </div>
    </TicketShell>
  );
}
