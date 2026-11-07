"use client";
// チケットの画面の「作る」の入口（K-60・画面 tickets・道 /tickets）。上の帯の「＋ チケットを作る」・空の一覧の「自分で書く」・URL の印 ?new=1（再読み込みでも開いたまま）。
//   書けるグループが 1 つも無い人（閲覧のみ）には「作る」を出さない（口も 403）。PC をつないでいなくても作れる（D-127.8）
//   一覧そのもの（絞り込み・並べ替え）は F4 のこれからのチケット。ここは作ったチケットが並ぶところまで
import { useCallback, useEffect, useState } from "react";
import { Button, Empty, ErrorState, Loading } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { CreateTicket, type Choices, type KindChoice } from "./create-ticket";
import { TicketShell } from "./ticket-shell";

type Row = { id: string; number: string; title: string };
type Load =
  | { state: "loading" }
  | { state: "error"; code: string }
  | { state: "ok"; choices: Choices; writable: boolean; rows: Row[] };

export async function loadChoices(): Promise<Load> {
  const [scopes, kinds, members, list] = await Promise.all([
    call("listScopes", { screenId: "tickets" }),
    call("listTicketKinds", { screenId: "tickets" }),
    call("listMembers", { query: { limit: 200 }, screenId: "tickets" }),
    call("listTickets", { query: { limit: 50 }, screenId: "tickets" }),
  ]);
  for (const r of [scopes, kinds, members]) if (!r.ok) return { state: "error", code: errorCodeOf(r) };
  if (!scopes.ok || !kinds.ok || !members.ok) return { state: "error", code: PAGE_ERROR.loadFailed };
  const all = scopes.data as unknown as { id: string; name: string; tenant_id: string }[];
  const writableIds = new Set(((scopes.meta["writable"] as string[] | undefined) ?? []).map(String));
  const rows = list.ok ? (list.data as unknown as Row[]) : [];
  return {
    state: "ok",
    writable: writableIds.size > 0,
    rows,
    choices: {
      workspace: all[0]?.tenant_id ?? "ws",
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
      parents: rows,
    },
  };
}

const withNew = (open: boolean) => {
  const u = new URL(window.location.href);
  if (open) u.searchParams.set("new", "1");
  else u.searchParams.delete("new");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
};

/** 前からある外枠（AppShell）に載せる（D-128.151） */
export function TicketsPage({ openNew }: { openNew: boolean }) {
  return (
    <TicketShell>
      <TicketsBody openNew={openNew} />
    </TicketShell>
  );
}

function TicketsBody({ openNew }: { openNew: boolean }) {
  const [ready, setReady] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [open, setOpen] = useState(openNew);
  const [expired, setExpired] = useState(false);
  const here = open ? "/tickets?new=1" : "/tickets";

  useEffect(() => {
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent(here)}`);
    else setReady(true);
  }, [here]);
  const reload = useCallback(() => {
    setLoad({ state: "loading" });
    void loadChoices().then((l) => {
      if (l.state === "error" && l.code === PAGE_ERROR.sessionExpired) setExpired(true);
      setLoad(l);
    });
  }, []);
  useEffect(() => {
    if (ready) reload();
  }, [ready, reload]);

  const show = (v: boolean) => {
    setOpen(v);
    withNew(v);
  };

  if (!ready) return <Loading />;
  if (expired)
    return (
      <ErrorState code={PAGE_ERROR.sessionExpired} heading={1} acts={[`/login?next=${encodeURIComponent(here)}`]} />
    );
  return (
    <section className="k-root k-page" aria-labelledby="tickets-title">
      <header className="k-page-head k-row">
        <h1 id="tickets-title">チケット</h1>
        {load.state === "ok" && load.writable ? (
          <Button onClick={() => show(true)} aria-expanded={open}>
            ＋ チケットを作る
          </Button>
        ) : null}
      </header>
      {load.state === "loading" ? <Loading /> : null}
      {load.state === "error" ? <ErrorState code={load.code} acts={[reload]} /> : null}
      {load.state === "ok" && open && load.writable ? (
        <CreateTicket
          choices={load.choices}
          onCreated={(id) => window.location.assign(`/tickets/${id}`)}
          onClose={() => show(false)}
          onExpired={() => setExpired(true)}
        />
      ) : null}
      {load.state === "ok" && !open ? (
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
            title="まだチケットがありません"
            action={
              load.writable ? (
                <Button variant="secondary" onClick={() => show(true)}>
                  自分で書く
                </Button>
              ) : null
            }
          >
            自分で書いて作れます。
          </Empty>
        )
      ) : null}
    </section>
  );
}
