"use client";
// チケットの詳細（K-60 では読むだけ・道 /tickets/[id]）。K-226 でキャンバス TicketDetail の形にした：
//   左に本文の箱（.k-page）：白いカード（頭の行・題名の行・帯・本文の道具の帯・区画）と、その下に子チケット・つながりのカード。
//   右に属性パネル（幅 380・detail-panel.tsx）。1023 以下はパネルを本文の下に回す。
//   題名の行の下に承認と実行の帯（K-162・apps/web/features/F5/approve-complete/）と AI に任せるの帯（K-62）。帯の中身は K-227・K-228。
//   本文は文字として出す（HTML やスクリプトを動かさない）。戻る道は外枠の上の帯のいまの場所（チケット › 番号・K-138）
//   layout="side"（K-252）：一覧の右に開く詳細。題名の行（帯と h1）・右のパネル・パネルを開く／閉じるを描かず、題名は h2。
//     ログインの確かめと入り直しは一覧の画面が持つ（ここでは移らない）。エラーの見出しも h2（頁の h1 は一覧の 1 つ）
import { useQuery } from "@tanstack/react-query";
import { PanelRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isUuid } from "@kaname/contracts";
import { DocTools, ErrorState, Loading, Prose } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { me } from "@/lib/auth/ext";
import { ApproveBand } from "@/features/F5/approve-complete/band";
import { DelegateBand } from "@/features/F5/delegate/delegate-band";
import { ACTIVE, useRuns } from "@/features/F5/delegate/use-run";
import "@/features/F5/delegate/delegate.css";
import { DetailMeta, DetailTitle, InertButton } from "./detail-head";
import { DetailPanel } from "./detail-panel";
import { SCOPES_KEY, TicketShell, readScopes, type ScopeRow } from "./ticket-shell";
import "./ticket-detail.css";

interface Detail {
  ticket: {
    id: string;
    number: string;
    title: string;
    due_on: string | null;
    start_on: string | null;
    priority: string;
    created_at?: string | null;
    scope_id?: string | null;
  };
  sections: { key: string; label: string; body: { text?: string } | null; version: number }[];
  kind: { name: string; color?: string | null } | null;
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

/** 外枠と同じ問い合わせ（同じ鍵・1 画面で 1 回・読み直さない）。外枠が読んでいれば口を 2 回呼ばない（G-16） */
const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

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

export type DetailLayout = "page" | "side";

/** 一覧の右に開く詳細（K-252・D-128.165）。外枠は一覧の画面のもの */
export function TicketDetailSide({ id }: { id: string }) {
  return <DetailBody id={id} layout="side" />;
}

function DetailBody({
  id,
  onNumber,
  layout = "page",
}: {
  id: string;
  onNumber?: (n: string) => void;
  layout?: DetailLayout;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const here = `/tickets/${id}`;
  const signedIn = typeof window !== "undefined" && Boolean(getToken());
  // 見ている人の名前（AI と話す・AI のタブ）とグループ（パネルの分類）。外枠と同じ鍵で分け合う
  const who = useQuery({ queryKey: ["me"], queryFn: me, enabled: signedIn, ...ONCE });
  const scopes = useQuery({ queryKey: SCOPES_KEY, queryFn: () => readScopes("tickets"), enabled: signedIn, ...ONCE });
  const load = useCallback(
    () =>
      call("getTicket", { params: { id }, screenId: "tickets" }).then((r) => {
        if (r.ok) {
          const detail = r.data as unknown as Detail;
          setD(detail);
          onNumber?.(detail.ticket.number);
        } else setCode(errorCodeOf(r));
      }),
    [id, onNumber],
  );
  useEffect(() => {
    if (!getToken()) {
      if (layout === "page") window.location.replace(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    // 入口と同じ正式な uuid の確かめ（版と variant の桁まで・D-129.42・K-144）。違えば口を呼ばずに「見つからない」。
    //   横の詳細（K-252）の id は一覧の口の答えから来る（URL の字ではない）ので確かめない
    if (layout === "page" && !isUuid(id)) {
      setCode(PAGE_ERROR.notFound);
      return;
    }
    void load();
  }, [here, id, load, layout]);
  if (code)
    return (
      <ErrorState
        code={code}
        heading={layout === "side" ? 2 : 1}
        acts={
          layout === "side"
            ? []
            : code === PAGE_ERROR.sessionExpired
              ? [`/login?next=${encodeURIComponent(here)}`]
              : ["/tickets"]
        }
      />
    );
  if (!d) return <Loading />;
  // 名前は読めてから AI と話す・AI のタブを出す（読み中・失敗の間も本文は出す・K138-SH-021）
  const name = who.isSuccess ? (who.data.display_name ?? "") : "";
  return (
    <DetailView
      id={id}
      d={d}
      layout={layout}
      me={name}
      scopesSettled={!scopes.isPending}
      scopes={scopes.isSuccess ? scopes.data.rows : null}
      reload={load}
      onTicket={setD}
    />
  );
}

function DetailView({
  id,
  d,
  layout,
  me: myName,
  scopes,
  scopesSettled,
  reload,
  onTicket,
}: {
  id: string;
  d: Detail;
  layout: DetailLayout;
  me: string;
  scopes: ScopeRow[] | null;
  /** グループの答え（失敗も含む）が届いたか。届く前の空のグループでパネルを描いてから描き替えない */
  scopesSettled: boolean;
  reload: () => Promise<void>;
  onTicket: (d: Detail) => void;
}) {
  const runs = useRuns(id);
  const [panelOpen, setPanelOpen] = useState(true);
  // パネルを閉じたら「パネルを開く」へ、開いたら「パネルを閉じる」へキーボードの場所を移す（押したボタンが消えて場所を失わない）
  const reopenRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (panelOpen ? closeRef : reopenRef).current?.focus();
  }, [panelOpen]);
  const togglePanel = (open: boolean) => {
    moveFocus.current = true;
    setPanelOpen(open);
  };
  // 動いていた実行が終わった・止まった読み直しで、チケットの詳細（段・can.delegate・成果物の区画）も読み直す（K62-UI-029・030・G-12）
  const status = runs.current?.status ?? null;
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (was && ACTIVE.has(was) && status && !ACTIVE.has(status)) void reload();
  }, [status, reload]);
  const t = d.ticket;
  const version = d.sections.reduce((n, s) => Math.max(n, s.version ?? 0), 0);
  const changed = async () => {
    await Promise.all([reload(), runs.reload()]);
  };
  const side = layout === "side";
  const titleId = side ? "ticket-side-title" : "ticket-title";
  return (
    <div className={side ? "k-detail k-detail-side" : "k-detail"}>
      <section className={side ? "k-root k-detail-side-body" : "k-root k-page"} aria-labelledby={titleId}>
        <article className="k-detail-card">
          <DetailMeta ticket={t} kind={d.kind} stage={d.stage} />
          {side ? (
            <h2 id={titleId} className="k-list-detail-title" title={t.title}>
              {t.title}
            </h2>
          ) : (
            <DetailTitle title={t.title} me={myName} />
          )}
          <div className="k-detail-bands">
            <ApproveBand
              ticketId={id}
              ticket={d}
              run={runs.current}
              runKnown={runs.known}
              onTicket={onTicket}
              onChanged={changed}
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
              onChanged={changed}
            />
          </div>
          <DocTools label="本文の道具" note={`「/」で部品を入れる ・ 本文の版 ${version}`}>
            <InertButton size="sm" className="k-detail-versions">
              版と差分
            </InertButton>
          </DocTools>
          <div className="k-detail-doc">
            {d.sections.map((s) => (
              <section key={s.key} className="k-section" aria-label={s.label}>
                <h2 id={`sec-${s.key}`}>{s.label}</h2>
                <Prose>{s.body?.text ?? ""}</Prose>
              </section>
            ))}
          </div>
        </article>
        <section className="k-detail-links" aria-label="子チケット・つながり">
          <div className="k-detail-links-head">
            <h2>子チケット・つながり</h2>
            <InertButton size="sm">子を足す</InertButton>
            <InertButton size="sm">つながりを足す</InertButton>
          </div>
        </section>
      </section>
      {side || panelOpen ? null : (
        <button
          type="button"
          className="k-detail-reopen"
          aria-label="パネルを開く"
          title="パネルを開く"
          ref={reopenRef}
          onClick={() => togglePanel(true)}
        >
          <PanelRight size={16} aria-hidden="true" />
        </button>
      )}
      {!side && scopesSettled ? (
        <DetailPanel
          ticket={t}
          assignee={d.assignee?.display_name ?? null}
          approver={d.approval?.approver_name ?? null}
          scopes={scopes}
          sections={d.sections}
          runs={runs.runs}
          me={myName}
          hidden={!panelOpen}
          closeRef={closeRef}
          onClose={() => togglePanel(false)}
        />
      ) : null}
    </div>
  );
}
