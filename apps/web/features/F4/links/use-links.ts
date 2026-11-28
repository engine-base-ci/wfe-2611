"use client";
// 子チケット・つながりの口（K-452）。読む（listTicketLinks・子は同じ答えの meta.children）・足す（createTicketLink）・外す（deleteTicketLink）・
//   作る面へ移る（/tickets?new=1&parent=<id>）。口を呼ぶのはこのファイルだけで、カード（links-block.tsx）は値と関数を部品に渡すだけ。
//   読むのは「開く」を押したときの 1 回だけ（詳細を開いたときは呼ばない・口 6 のまま）。離れて戻れば捨てて閉じた形から（gcTime 0）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { call, type CallErr } from "@/lib/api/call";
import type { ApiChild, ApiLink } from "./link-search";

const SCREEN = "tickets";

export type LinksState =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "failed"; err: CallErr | null }
  | { kind: "ready"; links: ApiLink[]; children: ApiChild[] };

type ReadResult = { ok: true; links: ApiLink[]; children: ApiChild[] } | { ok: false; err: CallErr | null };

export type WriteResult<T> = { ok: true; data: T } | { ok: false; err: CallErr | null };

export const linksKey = (id: string) => ["f4", "links", id] as const;

async function readLinks(id: string): Promise<ReadResult> {
  const r = await call("listTicketLinks", { params: { id }, screenId: SCREEN }).catch(() => null);
  if (!r) return { ok: false, err: null };
  if (!r.ok) return { ok: false, err: r };
  if (!Array.isArray(r.data)) return { ok: false, err: null };
  const kids = r.meta["children"];
  return {
    ok: true,
    links: r.data as unknown as ApiLink[],
    children: Array.isArray(kids) ? (kids as ApiChild[]) : [],
  };
}

export interface Links {
  state: LinksState;
  /** 「開く」：読む口を 1 回 */
  open: () => void;
  /** 読み直す（もう一度読む・外すの 404） */
  reload: () => void;
  add: (otherId: string, kind: ApiLink["kind"], key: string) => Promise<WriteResult<ApiLink>>;
  remove: (linkId: string) => Promise<WriteResult<{ id: string }>>;
  /** 作る面を、このチケットを親にして開く */
  toCreateChild: () => void;
}

export function useLinks(ticketId: string): Links {
  const [opened, setOpened] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();
  const key = linksKey(ticketId);
  const q = useQuery({
    queryKey: key,
    queryFn: () => readLinks(ticketId),
    enabled: opened,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const put = useCallback(
    (f: (links: ApiLink[]) => ApiLink[]) =>
      qc.setQueryData<ReadResult>(linksKey(ticketId), (old) => (old?.ok ? { ...old, links: f(old.links) } : old)),
    [qc, ticketId],
  );

  const add = useCallback(
    async (otherId: string, kind: ApiLink["kind"], idem: string): Promise<WriteResult<ApiLink>> => {
      const r = await call("createTicketLink", {
        params: { id: ticketId },
        body: { other_ticket_id: otherId, kind },
        idempotencyKey: idem,
        screenId: SCREEN,
      }).catch(() => null);
      if (!r) return { ok: false, err: null };
      if (!r.ok) return { ok: false, err: r };
      const made = r.data as unknown as ApiLink;
      put((links) => [...links.filter((l) => l.id !== made.id), made]);
      return { ok: true, data: made };
    },
    [ticketId, put],
  );

  const remove = useCallback(
    async (linkId: string): Promise<WriteResult<{ id: string }>> => {
      const r = await call("deleteTicketLink", { params: { id: linkId }, screenId: SCREEN }).catch(() => null);
      if (!r) return { ok: false, err: null };
      if (!r.ok) return { ok: false, err: r };
      put((links) => links.filter((l) => l.id !== linkId));
      return { ok: true, data: { id: linkId } };
    },
    [put],
  );

  const { refetch } = q;
  const reload = useCallback(() => void refetch(), [refetch]);
  const open = useCallback(() => setOpened(true), []);
  const toCreateChild = useCallback(
    () => router.push(`/tickets?new=1&parent=${encodeURIComponent(ticketId)}`),
    [router, ticketId],
  );

  const state: LinksState = !opened
    ? { kind: "closed" }
    : q.isFetching && !q.data?.ok
      ? { kind: "loading" }
      : q.data?.ok
        ? { kind: "ready", links: q.data.links, children: q.data.children }
        : q.data
          ? { kind: "failed", err: q.data.err }
          : { kind: "loading" };
  return { state, open, reload, add, remove, toCreateChild };
}
