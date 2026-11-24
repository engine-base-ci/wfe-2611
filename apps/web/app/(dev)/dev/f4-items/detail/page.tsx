"use client";
// 詳細のパネルの項目の置き場（K-1153・開発用）。下絵の詳細の頁（features/F4/doc/detail-views.tsx の DetailPage）と同じ外枠と並び
//   （Frame の中の div.k-detail・左に本文の区・右に aside.k-detail-panel > div.k-detail-panel-body）の中に ItemsPanel を出す。
//   クエリ ticket=<uuid>（読むチケット）・slots=approver,group（差し込み口が使えることの確かめ）。
//   getTicket の fields を 1 回読み、直した値は ItemsPanel が 1 項目ずつ updateTicket で送る（404 のときだけ読み直す）
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Frame } from "@/app/(dev)/dev/mock/f4/frame";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import "@/features/F4/create-ticket/ticket-detail.css";
import { readTicket } from "@/features/F5/approve-complete/band";
import { ItemsPanel, type PanelSlot } from "@/features/F4/items/items-panel";
import type { PanelField } from "@/features/F4/items/panel-value";
import { parseTheme } from "@/lib/theme";

const CRUMBS = [{ label: "チケット", href: "/tickets" }, { label: "詳細の項目" }];
/** 差し込み口に渡す見本の字（slots= の名前 → 中身） */
const SAMPLE: Partial<Record<PanelSlot, ReactNode>> = { approver: "高本 聖斗", group: "営業（EG）" };

interface Detail {
  ticket: { id: string; number: string; title: string };
  fields: PanelField[];
}

function DetailHost() {
  const q = useSearchParams();
  const ticket = q.get("ticket") ?? "";
  const asked = (q.get("slots") ?? "").split(",").filter((s): s is PanelSlot => s in SAMPLE);
  const slots = Object.fromEntries(asked.map((s) => [s, SAMPLE[s]])) as Partial<Record<PanelSlot, ReactNode>>;
  const d = useQuery({
    queryKey: ["f4-items", "detail", ticket],
    queryFn: () => readTicket<Detail>(ticket),
    enabled: ticket !== "",
    ...ONCE,
  });
  const title = d.data?.ticket.title ?? "";
  return (
    <Frame theme={parseTheme(undefined)} crumbs={CRUMBS}>
      <div className="k-detail">
        <section className="k-root k-page" aria-labelledby="ticket-title">
          <article className="k-detail-card">
            <header className="k-page-head">
              <div className="k-detail-title">
                <h1 id="ticket-title" title={title}>
                  {title}
                </h1>
              </div>
            </header>
          </article>
        </section>
        {d.data ? (
          <aside aria-label="チケットのパネル" className="k-detail-panel">
            <div className="k-detail-panel-body">
              <ItemsPanel ticketId={ticket} fields={d.data.fields} slots={slots} onReload={() => void d.refetch()} />
            </div>
          </aside>
        ) : null}
      </div>
    </Frame>
  );
}

export default function F4ItemsDetailPage() {
  return (
    <Suspense fallback={null}>
      <DetailHost />
    </Suspense>
  );
}
