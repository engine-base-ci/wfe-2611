"use client";
// チケットの画面の「作る」の入口（K-60・画面 tickets・道 /tickets）。左のメニューの「チケットを作る」（外枠・K-138）・空の箱の「＋ チケットを作る」・URL の印 ?new=1（再読み込みでも開いたまま）。
//   書けるグループが 1 つも無い人（閲覧のみ）には「作る」を出さない（口も 403）。PC をつないでいなくても作れる（D-127.8）
//   一覧そのもの（絞り込み・並べ替え）は F4 のこれからのチケット。ここは作ったチケットが並ぶところまで
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Button, Empty, ErrorState, Loading } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { me } from "@/lib/auth/ext";
import { CreateHead } from "./create-head";
import { CreateTicket, type Choices, type KindChoice } from "./create-ticket";
import { ShellBell } from "@/components/k/shell";
import { TicketShell, fetchScopes, type Scopes } from "./ticket-shell";

type Row = { id: string; number: string; title: string };
type Load =
  | { state: "loading" }
  | { state: "error"; code: string }
  | { state: "ok"; choices: Choices; writable: boolean; rows: Row[] };

export async function loadChoices(qc: QueryClient): Promise<Load> {
  // 本人と本人の会社（下書きの写しの鍵・H1）。分からないうちは作る面を出さない（写しを読まない・書かない）
  let who: Awaited<ReturnType<typeof me>>;
  try {
    who = await me();
  } catch (e) {
    // 入っていない（401）は入り直しへ（lib/auth/ext が鍵と写しを捨てる）。ほかは「読み込めませんでした」
    const status = (e as { status?: number }).status;
    return { state: "error", code: status === 401 ? PAGE_ERROR.sessionExpired : PAGE_ERROR.loadFailed };
  }
  // グループは外枠と同じ問い合わせ（口を 2 回呼ばない・K-138）
  let scopes: Scopes;
  try {
    scopes = await fetchScopes(qc, "tickets");
  } catch (e) {
    const r = (e as { result?: Parameters<typeof errorCodeOf>[0] }).result;
    return { state: "error", code: r ? errorCodeOf(r) : PAGE_ERROR.loadFailed };
  }
  const [kinds, members, list] = await Promise.all([
    call("listTicketKinds", { screenId: "tickets" }),
    call("listMembers", { query: { limit: 200 }, screenId: "tickets" }),
    call("listTickets", { query: { limit: 50 }, screenId: "tickets" }),
  ]);
  for (const r of [kinds, members]) if (!r.ok) return { state: "error", code: errorCodeOf(r) };
  if (!kinds.ok || !members.ok) return { state: "error", code: PAGE_ERROR.loadFailed };
  const all = scopes.rows;
  const writableIds = new Set(scopes.writable);
  const rows = list.ok ? (list.data as unknown as Row[]) : [];
  return {
    state: "ok",
    writable: writableIds.size > 0,
    rows,
    choices: {
      workspace: String(who.tenant_id),
      member: String(who.member_id),
      scopes: all.filter((s) => writableIds.has(s.id)).map((s) => ({ id: s.id, name: s.name })),
      kinds: kinds.data as unknown as KindChoice[],
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

/** キャンバスどおりの新しい外枠に載せる（D-143.1）。作る面の開け閉めは外枠の作るボタンと本文で分け合う */
export function TicketsPage({ openNew }: { openNew: boolean }) {
  const [open, setOpen] = useState(openNew);
  const show = useCallback((v: boolean) => {
    setOpen(v);
    withNew(v);
  }, []);
  return (
    <TicketShell
      screen="tickets"
      crumbs={open ? [{ label: "チケット", href: "/tickets" }, { label: "作る" }] : [{ label: "チケット" }]}
      onCreate={() => show(true)}
    >
      <TicketsBody open={open} show={show} />
    </TicketShell>
  );
}

function TicketsBody({ open, show }: { open: boolean; show: (v: boolean) => void }) {
  const [ready, setReady] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [expired, setExpired] = useState(false);
  const qc = useQueryClient();
  const here = open ? "/tickets?new=1" : "/tickets";

  useEffect(() => {
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent(here)}`);
    else setReady(true);
  }, [here]);
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

  if (!ready) return <Loading />;
  if (expired)
    return (
      <ErrorState code={PAGE_ERROR.sessionExpired} heading={1} acts={[`/login?next=${encodeURIComponent(here)}`]} />
    );
  // 作る面：帯を先に出し、選ぶ欄を読み終えたら本文（K-224・D-144.8）。書けるグループが無い人は一覧のまま
  if (open && load.state === "ok" && load.writable)
    return (
      <CreateTicket
        choices={load.choices}
        onCreated={(id) => window.location.assign(`/tickets/${id}`)}
        onClose={() => show(false)}
        onExpired={() => setExpired(true)}
      />
    );
  if (open && load.state !== "ok")
    return (
      <div className="k-root k-create-page">
        <CreateHead save={{ kind: "none" }} />
        <div className="k-create-body">
          {load.state === "loading" ? <Loading /> : <ErrorState code={load.code} acts={[reload]} />}
        </div>
      </div>
    );
  return (
    <section className="k-root k-page" aria-labelledby="tickets-title">
      <header className="k-page-head k-row">
        <h1 id="tickets-title">チケット</h1>
        <ShellBell />
      </header>
      {load.state === "loading" ? <Loading /> : null}
      {load.state === "error" ? <ErrorState code={load.code} acts={[reload]} /> : null}
      {load.state === "ok" ? (
        load.rows.length ? (
          <ul className="k-list" aria-label="チケットの一覧">
            {load.rows.map((r) => (
              <li key={r.id}>
                <a className="k-link" href={`/tickets/${r.id}`}>
                  {r.number} {r.title}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            title="まだチケットはありません"
            action={load.writable ? <Button onClick={() => show(true)}>＋ チケットを作る</Button> : null}
          >
            自分で書いて作れます。
          </Empty>
        )
      ) : null}
    </section>
  );
}
