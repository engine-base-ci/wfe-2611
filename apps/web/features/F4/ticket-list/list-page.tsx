"use client";
// チケットの一覧の画面（K-251・画面 tickets・道 /tickets）。キャンバス OnHome（はじめて・0 件）と Main（自分に関わるもの）。
//   外枠（TicketShell・K-138）の中に、見出しの帯（h1「チケット」と補足「すべてのグループ」・見え方のタブ）と本文の行。
//   帯とタブは一覧を読む前に描く。読み込み中の文は 3 秒より長いときだけ（D-144.8）。読めなかったら正本のエラーの 1 件（D-142.2）。
//   0 件で読めたら、あいさつと空の箱・右の列にはじめにやること。チケットが在れば、自分に関わるものの部品（数の札・絞り）と表・右の列。
//   帯に作るボタンは置かない（作る入口は外枠と空の箱・主は 1 つ）。
// K-252（キャンバス List）：一覧（?view=all）とグループの一覧（?scope=<id>）に検索条件の箱と表の上の道具・行の頭の選ぶ印。
//   グループの一覧は帯の h1 がグループの名前と「（頭字）」・口に scope_id と view=all。見えない・無い・uuid でないグループは h1「チケット」と「見つかりませんでした」。
//   行を押すと、幅 1024 以上は移らずに右に詳細を開き（URL に open=<番号> を足す・push）、1023 以下は /tickets/<id> へ移る（D-128.165）。
//   1024〜1279 で開いている間は、列を選んだ列のうち 種別・番号・題名・状態・担当者 にし、左のメニューを 56 に畳む（D-128.14）。
//   自分に関わるものの右の列は、詳細を開いている間は出さない
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isUuid } from "@kaname/contracts";
import { ErrorState, Loading } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { getToken } from "@/lib/api/client";
import { me } from "@/lib/auth/ext";
import { SCOPES_KEY, TicketShell, readScopes, scopeTone, type ScopeRow } from "../create-ticket/ticket-shell";
import { ListDetailSide } from "./list-detail-side";
import { ListEmpty } from "./list-empty";
import { useColumns, type ColumnKey } from "./list-columns";
import { ListSearch, ListTools } from "./list-filter";
import { MineCards, MineFilter } from "./list-mine-parts";
import { FirstSide, MainSide } from "./list-side";
import { ListTable, type OpenRow } from "./list-table";
import { ListViews } from "./list-views";
import {
  useApprovals,
  useOpenLookup,
  useSetupTasks,
  useTicketList,
  type ListView,
  type OpenLookup,
  type TicketList,
} from "./use-ticket-list";
import "./ticket-list.css";

const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
/** 横に開いた間に残す列（D-128.14）。並びは 9 列と同じ */
const SIDE_COLUMNS = new Set<ColumnKey>(["kind", "number", "title", "stage", "assignee"]);

/** 幅の段：narrow（1023 以下・移る）／mid（1024〜1279・横で列 5・メニュー 56）／wide（1280 以上） */
type Band = "narrow" | "mid" | "wide";
const SIDE_MIN = "(min-width: 1024px)";
const WIDE_MIN = "(min-width: 1280px)";
const bandNow = (): Band =>
  window.matchMedia(WIDE_MIN).matches ? "wide" : window.matchMedia(SIDE_MIN).matches ? "mid" : "narrow";

function useBand(): Band | null {
  const [band, setBand] = useState<Band | null>(null);
  useEffect(() => {
    const on = () => setBand(bandNow());
    on();
    const qs = [window.matchMedia(SIDE_MIN), window.matchMedia(WIDE_MIN)];
    qs.forEach((q) => q.addEventListener("change", on));
    return () => qs.forEach((q) => q.removeEventListener("change", on));
  }, []);
  return band;
}

/** 本人の名前と、書けるグループがあるか（外枠と同じ問い合わせを分け合う。口を 2 回呼ばない） */
function useViewer(enabled: boolean): { name: string; canCreate: boolean } {
  const who = useQuery({ queryKey: ["me"], queryFn: me, enabled, ...ONCE });
  const scopes = useQuery({ queryKey: SCOPES_KEY, queryFn: () => readScopes("tickets"), enabled, ...ONCE });
  return {
    name: who.data?.display_name ? String(who.data.display_name) : "",
    canCreate: (scopes.data?.writable.length ?? 0) > 0,
  };
}

/** ?scope= のグループ。none＝絞らない・pending＝グループを読んでいる・bad＝見えない／無い／uuid でない・
 *  error＝グループの口が失敗した（読み込みの失敗。見つからないとは別・K252-UI-022） */
type ScopeState =
  | { state: "none" }
  | { state: "pending" }
  | { state: "bad" }
  | { state: "error"; code: string; retry: () => void }
  | { state: "ok"; row: ScopeRow; tone: string };

/** グループの口の失敗を正本のエラーの 1 件に（readScopes は口の答えを result に付けて投げる） */
const scopeErrorCode = (e: unknown): string => {
  const r = (e as { result?: Parameters<typeof errorCodeOf>[0] } | null)?.result;
  return r ? errorCodeOf(r) : PAGE_ERROR.loadFailed;
};

function useScope(scope: string | null, enabled: boolean): ScopeState {
  const valid = scope !== null && isUuid(scope);
  const scopes = useQuery({
    queryKey: SCOPES_KEY,
    queryFn: () => readScopes("tickets"),
    enabled: enabled && valid,
    ...ONCE,
  });
  if (scope === null) return { state: "none" };
  if (!valid) return { state: "bad" };
  if (scopes.isError) return { state: "error", code: scopeErrorCode(scopes.error), retry: () => void scopes.refetch() };
  if (!scopes.isSuccess) return { state: "pending" };
  const row = scopes.data.rows.find((s) => s.id === scope);
  return row ? { state: "ok", row, tone: scopeTone(scopes.data.rows, row.id) } : { state: "bad" };
}

function ListHead({ view, scope }: { view: ListView; scope: ScopeState }) {
  const group = scope.state === "ok" ? scope.row : null;
  const code = group ? group.ticket_prefix || group.name.slice(0, 1) : "";
  return (
    <header className="k-page-head k-list-head">
      <div className="k-list-head-row">
        {group && scope.state === "ok" ? (
          <span className="k-list-scope-mark" data-tone={scope.tone} aria-hidden="true">
            {code}
          </span>
        ) : null}
        <h1 id="tickets-title">{group ? group.name : "チケット"}</h1>
        {group ? (
          <span className="k-list-dim">（{code}）</span>
        ) : scope.state === "none" ? (
          <span className="k-list-dim">すべてのグループ</span>
        ) : null}
      </div>
      <ListViews view={view} />
    </header>
  );
}

interface SideState {
  /** 右に開いている（幅 1024 以上で open が在る） */
  lookup: OpenLookup | null;
  /** 開いている行の id（分かっていれば） */
  openId: string | null;
  /** 1024〜1279 で開いている（列 5・メニュー 56） */
  squeezed: boolean;
  onOpen: OpenRow;
}

interface BodyProps {
  view: ListView;
  /** グループで絞った（一覧の形・はじめて にしない） */
  scoped: boolean;
  data: TicketList;
  side: SideState;
  onCreate: () => void;
  onQuery: (q: string) => void;
}

function ListBody({ view, scoped, data, side, onCreate, onQuery }: BodyProps) {
  const { list } = data;
  const mine = view === "mine" && !scoped;
  // はじめて（OnHome）は会社にチケットが 1 枚も無いときだけ。自分に関わるものが 0 件でも会社に在れば Main の形で表を空にする
  const first = list.state === "ok" && list.first;
  const viewer = useViewer(true);
  // 右の列の口（はじめにやること・承認待ち）は一覧の答えを待たずに最初に呼ぶ（段を 1 にする・K-235）。
  //   はじめにやることは、はじめて（0 件）のときだけ箱を出す。承認待ちは外枠の数と同じ問い合わせ（口は 1 本）
  const setup = useSetupTasks(true);
  // 右の列（承認待ちの行）は自分に関わるものだけ（一覧はキャンバス List に右の列が無い）
  const approvals = useApprovals(mine);
  const columns = useColumns();
  const shown = useMemo(
    () => (side.squeezed ? columns.visible.filter((k) => SIDE_COLUMNS.has(k)) : columns.visible),
    [columns.visible, side.squeezed],
  );
  const open = side.lookup !== null;
  if (first)
    return (
      <div className="k-list-body" data-first>
        <ListEmpty name={viewer.name} canCreate={viewer.canCreate} onCreate={onCreate} />
        <FirstSide setup={setup} />
      </div>
    );
  if (mine && list.state !== "ok")
    return (
      <div className="k-list-body">
        {list.state === "loading" ? <Loading /> : <ErrorState code={list.code} acts={[data.reload]} />}
      </div>
    );
  // 一覧・グループの一覧は、読み込み中・失敗の間も言葉の欄を出したまま（打った字を残す・K252-UI-021）
  const content =
    list.state === "loading" ? (
      <Loading />
    ) : list.state === "error" ? (
      <ErrorState code={list.code} acts={[data.reload]} />
    ) : (
      <div className="k-list-panel">
        {mine ? <MineFilter columns={columns} name={viewer.name} /> : <ListTools columns={columns} />}
        <ListTable
          rows={list.rows}
          columns={shown}
          sections={mine}
          selectable={!mine}
          onOpen={side.onOpen}
          openId={side.openId}
          hasMore={list.next !== null && !data.reloading}
          loadingMore={data.loadingMore}
          moreError={data.moreError}
          onMore={data.loadMore}
        />
        {list.rows.length === 0 ? (
          <p className="k-list-none">{mine ? "自分に関わるチケットはありません" : "条件に合うチケットはありません"}</p>
        ) : null}
      </div>
    );
  return (
    <div className="k-list-body" data-split={open || undefined}>
      <section className="k-list-main" aria-labelledby="tickets-title">
        {mine ? <MineCards /> : <ListSearch onQuery={onQuery} />}
        {content}
      </section>
      {mine && !open ? <MainSide name={viewer.name} approvals={approvals} /> : null}
      {side.lookup ? <ListDetailSide open={side.lookup} /> : null}
    </div>
  );
}

/** 今の URL に open=<番号> を足して（替えて）積む。ほかの問い合わせ（view・scope）は残す */
function pushOpen(number: string): void {
  const u = new URL(window.location.href);
  u.searchParams.set("open", number);
  window.history.pushState(null, "", `${u.pathname}${u.search}`);
}

/** 行を押したとき・?open= を直に開いたときの右の詳細 */
function useSide(open: string | null, band: Band | null): SideState {
  const [known, setKnown] = useState<{ number: string; id: string } | null>(null);
  const lookup = useOpenLookup(band === null ? null : open, known);
  // 1023 以下で ?open= を直に開いたら、そのチケットの頁へ移す
  useEffect(() => {
    if (band === "narrow" && lookup?.state === "found")
      window.location.replace(`/tickets/${encodeURIComponent(lookup.id)}`);
  }, [band, lookup]);
  const onOpen = useCallback<OpenRow>((row) => {
    if (!window.matchMedia(SIDE_MIN).matches) return false;
    setKnown({ number: row.number, id: row.id });
    pushOpen(row.number);
    return true;
  }, []);
  const shown = band !== null && band !== "narrow" ? lookup : null;
  return {
    lookup: shown,
    openId: shown?.state === "found" ? shown.id : null,
    squeezed: shown !== null && band === "mid",
    onOpen,
  };
}

export interface TicketListPageProps {
  view: ListView;
  /** グループの一覧（?scope=<id>）。無ければ null */
  scope?: string | null;
  /** 右に開く詳細の番号（?open=<番号>）。無ければ null */
  open?: string | null;
  /** 作る面を開く（外枠の作るボタンと空の箱の主ボタン） */
  onCreate: () => void;
}

export function TicketListPage({ view, scope = null, open = null, onCreate }: TicketListPageProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent(here)}`);
    else setReady(true);
  }, [view, scope]);
  const group = useScope(scope, ready);
  const listView: ListView = scope !== null ? "all" : view;
  // 言葉は今の見え方・グループのときだけ効く（替えたら空から）
  const place = `${listView}|${scope ?? ""}`;
  const [query, setQuery] = useState({ place, q: "" });
  const q = query.place === place ? query.q : "";
  const onQuery = useCallback((next: string) => setQuery({ place, q: next }), [place]);
  const scopeId = group.state === "ok" ? group.row.id : null;
  const data = useTicketList(listView, ready && (group.state === "none" || group.state === "ok"), { q, scopeId });
  const band = useBand();
  const side = useSide(open, band);
  // いまの場所：グループの一覧は「営業 › 一覧」（キャンバス List）、ほかは「チケット › 一覧／自分に関わるもの」
  const crumbs =
    group.state === "ok"
      ? [{ label: group.row.name, href: `/tickets?scope=${encodeURIComponent(group.row.id)}` }, { label: "一覧" }]
      : [{ label: "チケット", href: "/tickets" }, { label: listView === "all" ? "一覧" : "自分に関わるもの" }];
  return (
    <TicketShell screen="tickets" crumbs={crumbs} onCreate={onCreate} railed={side.squeezed}>
      <div className="k-root k-list-page">
        <ListHead view={listView} scope={group} />
        {!ready ? null : group.state === "bad" ? (
          <div className="k-list-body">
            <ErrorState code={PAGE_ERROR.notFound} acts={["/tickets?view=all"]} />
          </div>
        ) : group.state === "error" ? (
          <div className="k-list-body">
            <ErrorState code={group.code} acts={[group.retry]} />
          </div>
        ) : group.state === "pending" ? (
          <div className="k-list-body">
            <Loading />
          </div>
        ) : (
          <ListBody
            view={listView}
            scoped={scope !== null}
            data={data}
            side={side}
            onCreate={onCreate}
            onQuery={onQuery}
          />
        )}
      </div>
    </TicketShell>
  );
}
