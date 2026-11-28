"use client";
// 「PC と使った量」の外枠・第 2 ナビ・本文の箱と見出しの行（K-349 で connect-pc.tsx の frame をそのまま移した）。どの状態でも同じで、中身だけを替える。
//   5 つの戻りがどれもこの部品を根にする（ConnectPc の中で宣言すると描き直すたびに外枠ごと作り直され、外枠の口を何回も呼ぶ）
import type { ReactNode } from "react";
import { MeSub } from "@/components/k";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";

export function PcFrame({
  back,
  bridgeConnected,
  children,
}: {
  back: string | null;
  bridgeConnected: boolean | null;
  children: ReactNode;
}) {
  return (
    <TicketShell
      screen="bridge-setup"
      crumbs={[{ label: "自分の設定", disabled: true }, { label: "PC と使った量" }]}
      bridgeConnected={bridgeConnected}
    >
      <div className="k-me-wrap">
        <MeSub current="bridge" />
        <section className="k-page k-me-page" aria-labelledby="connect-pc-title">
          <header className="k-page-head">
            {back ? (
              <a className="k-link" href={back} data-act="back">
                戻る
              </a>
            ) : null}
            <h1 id="connect-pc-title">PC と使った量</h1>
            <p className="k-desc">分身はあなたの PC で動く。どのワークスペースの分身も同じ PC を使う</p>
          </header>
          {children}
        </section>
      </div>
    </TicketShell>
  );
}
