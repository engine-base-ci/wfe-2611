"use client";
// チケットの画面の入口（K-60・画面 tickets・道 /tickets）。作る面（?new=1・K-224）と一覧（K-251・features/F4/ticket-list）を切り替える。
//   作るの入口：左のメニューの「チケットを作る」（外枠・K-138）・空の箱の「＋ チケットを作る」・URL の印 ?new=1（再読み込みでも開いたまま）。
//   書けるグループが 1 つも無い人（閲覧のみ）には「作る」を出さない（口も 403）。PC をつないでいなくても作れる（D-127.8）
//   一覧の口の答えは作る面の選択肢に使わない（親の候補は作る面が一覧の口の q で引く・K-224）
//   一覧には URL の印 ?scope=<グループ>（グループの一覧）と ?open=<番号>（右に開く詳細）を渡す（K-252）
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorState, Loading } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { me } from "@/lib/auth/ext";
import { TicketListPage } from "../ticket-list/list-page";
import { TICKET_KINDS_KEY } from "../items/use-ticket-fields";
import { CreateHead } from "./create-head";
import { CreateTicket, seedParent, type Choices, type CreateSeed, type KindChoice } from "./create-ticket";
import { readDraftList } from "./draft";
import { ONCE, TicketShell, fetchScopes } from "./ticket-shell";

/** 失敗を答えの形にする（同時に呼んだ口のうち、どれが落ちても残りを待ってから順に見る） */
const settle = <T,>(p: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> =>
  p.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

type Load =
  { state: "loading" } | { state: "error"; code: string } | { state: "ok"; choices: Choices; writable: boolean };

export async function loadChoices(qc: QueryClient): Promise<Load> {
  // 最初の読み込みの口は全部同時に呼ぶ（前の答えを待たない・K-235）：本人（外枠と同じ鍵 ["me"]・口を 2 回呼ばない）・
  //   グループ（外枠と同じ問い合わせ・K-138）・種別・人・書きかけの一覧（本人が分かる前に呼んでおき、作る面が続きを選ぶ）
  const drafts = readDraftList();
  const [who, scopes, kinds, members] = await Promise.all([
    settle(qc.fetchQuery({ queryKey: ["me"], queryFn: me, ...ONCE })),
    settle(fetchScopes(qc, "tickets")),
    call("listTicketKinds", { screenId: "tickets" }),
    call("listMembers", { query: { limit: 200 }, screenId: "tickets" }),
  ]);
  // 本人と本人の会社（下書きの写しの鍵・H1）。分からないうちは作る面を出さない（写しを読まない・書かない）
  if (!who.ok) {
    // 入っていない（401）は入り直しへ（lib/auth/ext が鍵と写しを捨てる）。ほかは「読み込めませんでした」
    const status = (who.error as { status?: number }).status;
    return { state: "error", code: status === 401 ? PAGE_ERROR.sessionExpired : PAGE_ERROR.loadFailed };
  }
  if (!scopes.ok) {
    const r = (scopes.error as { result?: Parameters<typeof errorCodeOf>[0] }).result;
    return { state: "error", code: r ? errorCodeOf(r) : PAGE_ERROR.loadFailed };
  }
  for (const r of [kinds, members]) if (!r.ok) return { state: "error", code: errorCodeOf(r) };
  if (!kinds.ok || !members.ok) return { state: "error", code: PAGE_ERROR.loadFailed };
  // 種別の口の答えは項目の表（K-569 の useTicketKinds）と同じ鍵に置く（会社の項目は各種別の fields・同じ口を 2 回呼ばない・K442-UI-026）
  const kindRows = kinds.data as unknown as (KindChoice & { fields?: unknown })[];
  qc.setQueryData(
    TICKET_KINDS_KEY,
    kindRows.map((k) => ({ id: k.id, name: k.name, fields: Array.isArray(k.fields) ? k.fields : [] })),
  );
  const all = scopes.value.rows;
  const writableIds = new Set(scopes.value.writable);
  return {
    state: "ok",
    writable: writableIds.size > 0,
    choices: {
      workspace: String(who.value.tenant_id),
      member: String(who.value.member_id),
      drafts,
      scopes: all.filter((s) => writableIds.has(s.id)).map((s) => ({ id: s.id, name: s.name })),
      kinds: kindRows.map((k) => ({ id: k.id, name: k.name, body_template: k.body_template ?? null })),
      // 担当者に選べるのは、抜けていない・止められていない人だけ
      members: (
        members.data as unknown as {
          id: string;
          display_name: string;
          deleted_at?: string | null;
          suspended_at?: string | null;
          kind_id?: string;
        }[]
      )
        .filter((m) => !m.deleted_at && !m.suspended_at && (m.kind_id ?? "human") === "human")
        .map((m) => ({ id: m.id, display_name: m.display_name })),
    },
  };
}

const withNew = (open: boolean) => {
  const u = new URL(window.location.href);
  if (open) u.searchParams.set("new", "1");
  else u.searchParams.delete("new");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
};

/** 作る面が開いていれば作る面（K-224）、それ以外は一覧（K-251）。書けるグループが無い人には作る面を出さず一覧のまま */
export function TicketsPage({ openNew }: { openNew: boolean }) {
  const [open, setOpen] = useState(openNew);
  const params = useSearchParams();
  const view = params.get("view") === "all" ? "all" : "mine";
  const scope = params.get("scope");
  const openNumber = params.get("open") || null;
  // 道の印（K-453 の空の一覧のおすすめ・詳細の「子を足す」）：題名と、uuid の形の親だけを受ける
  const seedTitle = params.get("title") ?? undefined;
  const seedParentId = seedParent(params.getAll("parent"));
  const seed = useMemo<CreateSeed>(
    () => ({ ...(seedTitle ? { title: seedTitle } : {}), ...(seedParentId ? { parent: seedParentId } : {}) }),
    [seedTitle, seedParentId],
  );
  const show = useCallback((v: boolean) => {
    setOpen(v);
    withNew(v);
  }, []);
  if (!open) return <TicketListPage view={view} scope={scope} open={openNumber} onCreate={() => show(true)} />;
  return (
    <TicketShell
      screen="tickets"
      crumbs={[{ label: "チケット", href: "/tickets" }, { label: "作る" }]}
      onCreate={() => show(true)}
    >
      <CreateBody show={show} seed={seed} />
    </TicketShell>
  );
}

function CreateBody({ show, seed }: { show: (v: boolean) => void; seed: CreateSeed }) {
  const [ready, setReady] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [expired, setExpired] = useState(false);
  const qc = useQueryClient();
  const here = "/tickets?new=1";

  useEffect(() => {
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent(here)}`);
    else setReady(true);
  }, []);
  const reload = useCallback(() => {
    setLoad({ state: "loading" });
    void loadChoices(qc).then((l) => {
      if (l.state === "error" && l.code === PAGE_ERROR.sessionExpired) setExpired(true);
      setLoad(l);
    });
  }, [qc]);
  useEffect(() => {
    if (ready) reload();
  }, [ready, reload]);
  // 書けるグループが無い人は一覧に戻す（作る面を出さない）
  useEffect(() => {
    if (load.state === "ok" && !load.writable) show(false);
  }, [load, show]);

  if (!ready) return <Loading />;
  if (expired)
    return (
      <ErrorState code={PAGE_ERROR.sessionExpired} heading={1} acts={[`/login?next=${encodeURIComponent(here)}`]} />
    );
  // 作る面：読み込み中と読めなかったときは空の保存の状態の帯を先に出し、読めたら作る面が帯ごと描く（K-224・D-144.8・K-442）
  return (
    <div className="k-root k-create-page">
      {load.state === "ok" ? (
        <CreateTicket
          choices={load.choices}
          seed={seed}
          onCreated={(id) => window.location.assign(`/tickets/${id}`)}
          onClose={() => show(false)}
          onExpired={() => setExpired(true)}
        />
      ) : (
        <>
          <CreateHead save={{ kind: "none" }} />
          <div className="k-create-body">
            {load.state === "loading" ? <Loading /> : <ErrorState code={load.code} acts={[reload]} />}
          </div>
        </>
      )}
    </div>
  );
}
