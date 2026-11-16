"use client";
// チケットの一覧の画面（K-251・画面 tickets・道 /tickets）。キャンバス OnHome（はじめて・0 件）と Main（自分に関わるもの）。
//   外枠（TicketShell・K-138）の中に、見出しの帯（h1「チケット」と補足「すべてのグループ」・見え方のタブ）と本文の行。
//   帯とタブは一覧を読む前に描く。読み込み中の文は 3 秒より長いときだけ（D-144.8）。読めなかったら正本のエラーの 1 件（D-142.2）。
//   0 件で読めたら、あいさつと空の箱・右の列にはじめにやること。チケットが在れば、自分に関わるものの部品（数の札・絞り）と表・右の列。
//   帯に作るボタンは置かない（作る入口は外枠と空の箱・主は 1 つ）。グループの一覧と横の詳細は K-252 が足す
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ErrorState, Loading } from "@/components/k";
import { ShellBell } from "@/components/k/shell";
import { getToken } from "@/lib/api/client";
import { me } from "@/lib/auth/ext";
import { SCOPES_KEY, TicketShell, readScopes } from "../create-ticket/ticket-shell";
import { ListEmpty } from "./list-empty";
import { MineCards, MineFilter } from "./list-mine-parts";
import { FirstSide, MainSide } from "./list-side";
import { ListTable } from "./list-table";
import { ListViews } from "./list-views";
import { useApprovals, useSetupTasks, useTicketList, type ListView, type TicketList } from "./use-ticket-list";
import "./ticket-list.css";

const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

/** 本人の名前と、書けるグループがあるか（外枠と同じ問い合わせを分け合う。口を 2 回呼ばない） */
function useViewer(enabled: boolean): { name: string; canCreate: boolean } {
  const who = useQuery({ queryKey: ["me"], queryFn: me, enabled, ...ONCE });
  const scopes = useQuery({ queryKey: SCOPES_KEY, queryFn: () => readScopes("tickets"), enabled, ...ONCE });
  return {
    name: who.data?.display_name ? String(who.data.display_name) : "",
    canCreate: (scopes.data?.writable.length ?? 0) > 0,
  };
}

function ListHead({ view }: { view: ListView }) {
  return (
    <header className="k-page-head k-list-head">
      <div className="k-list-head-row">
        <h1 id="tickets-title">チケット</h1>
        <span className="k-list-dim">すべてのグループ</span>
        <ShellBell />
      </div>
      <ListViews view={view} />
    </header>
  );
}

function ListBody({ view, data, onCreate }: { view: ListView; data: TicketList; onCreate: () => void }) {
  const { list } = data;
  const empty = list.state === "ok" && list.rows.length === 0;
  const viewer = useViewer(true);
  const setup = useSetupTasks(empty);
  const approvals = useApprovals(list.state === "ok" && !empty);
  if (list.state === "loading")
    return (
      <div className="k-list-body">
        <Loading />
      </div>
    );
  if (list.state === "error")
    return (
      <div className="k-list-body">
        <ErrorState code={list.code} acts={[data.reload]} />
      </div>
    );
  if (empty)
    return (
      <div className="k-list-body" data-first>
        <ListEmpty name={viewer.name} canCreate={viewer.canCreate} onCreate={onCreate} />
        <FirstSide setup={setup} />
      </div>
    );
  return (
    <div className="k-list-body">
      <section className="k-list-main" aria-labelledby="tickets-title">
        {view === "mine" ? <MineCards /> : null}
        <div className="k-list-panel">
          {view === "mine" ? <MineFilter /> : null}
          <ListTable
            rows={list.rows}
            hasMore={list.next !== null}
            loadingMore={data.loadingMore}
            moreError={data.moreError}
            onMore={data.loadMore}
          />
        </div>
      </section>
      <MainSide name={viewer.name} approvals={approvals} />
    </div>
  );
}

export interface TicketListPageProps {
  view: ListView;
  /** 作る面を開く（外枠の作るボタンと空の箱の主ボタン） */
  onCreate: () => void;
}

export function TicketListPage({ view, onCreate }: TicketListPageProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const here = view === "all" ? "/tickets?view=all" : "/tickets";
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent(here)}`);
    else setReady(true);
  }, [view]);
  const data = useTicketList(view, ready);
  return (
    <TicketShell
      screen="tickets"
      crumbs={[{ label: "チケット", href: "/tickets" }, { label: view === "all" ? "一覧" : "自分に関わるもの" }]}
      onCreate={onCreate}
    >
      <div className="k-root k-list-page">
        <ListHead view={view} />
        {ready ? <ListBody view={view} data={data} onCreate={onCreate} /> : null}
      </div>
    </TicketShell>
  );
}
