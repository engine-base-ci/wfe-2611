"use client";
// チケットの一覧の画面が読む口（K-251）。一覧の口（K-92）・はじめにやることの口（K-250）・承認待ちの口（K-161）。
//   一覧：1 回 50 件。見え方を切り替えたら、遅れて届いた前の答えでは描かない（問い合わせごとの印で見分ける）（K251-UI-004）。
//     「もっと見る」は押している間は押せない（2 回押しても口は 1 回・G-16）。失敗したら読んだ行を残して「もう一度」
//   401 は共通の決まり（lib/api/query の入り直し）に任せる。ほかの失敗は正本のエラーの 1 件（errorCodeOf・D-142.2）
//   はじめにやること：閉じる・飛ばすの口は押している間は押せず、失敗したら箱とその項目をそのまま残す（K251-UI-028）
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallResult } from "@/lib/api/call";
import type { OpName } from "@kaname/contracts";

export type ListView = "mine" | "all";

/** 一覧の口の 1 件（K-92 の答えの形） */
export interface ListItem {
  id: string;
  number: string;
  title: string;
  kind: { id: string; name: string } | null;
  stage: { id: string; name: string; key: string | null } | null;
  assignee: { id: string; display_name: string } | null;
  delegated_to_clone: boolean;
  due_on: string | null;
  overdue: boolean;
  updated_at: string;
}

export const PAGE_SIZE = 50;

export type ListState =
  { state: "loading" } | { state: "error"; code: string } | { state: "ok"; rows: ListItem[]; next: string | null };

/** 口を呼び、届かなかった（ネットが切れた）ときも答えの形にする */
async function safeCall<K extends OpName>(run: () => Promise<CallResult<K>>): Promise<CallResult<K> | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

const codeOf = <K extends OpName>(r: CallResult<K> | null): string =>
  r === null || r.ok ? PAGE_ERROR.loadFailed : errorCodeOf(r);

const listOf = (data: unknown): ListItem[] => (Array.isArray(data) ? (data as ListItem[]) : []);
const nextOf = (meta: Record<string, unknown>): string | null =>
  typeof meta["next_cursor"] === "string" && meta["next_cursor"] ? meta["next_cursor"] : null;

export interface TicketList {
  list: ListState;
  /** 次の分を読んでいる間 */
  loadingMore: boolean;
  /** 次の分が読めなかった（正本のエラーの ID） */
  moreError: string | null;
  reload: () => void;
  loadMore: () => void;
}

export function useTicketList(view: ListView, enabled: boolean): TicketList {
  const [list, setList] = useState<ListState>({ state: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const seq = useRef(0);
  const busy = useRef(false);

  const reload = useCallback(() => {
    const mine = ++seq.current;
    busy.current = false;
    setLoadingMore(false);
    setMoreError(null);
    setList({ state: "loading" });
    void safeCall(() => call("listTickets", { query: { view, limit: PAGE_SIZE }, screenId: "tickets" })).then((r) => {
      if (mine !== seq.current) return; // 後から切り替えた見え方の答えだけを描く
      if (r?.ok) setList({ state: "ok", rows: listOf(r.data), next: nextOf(r.meta) });
      else if (r?.kind !== "unauthenticated") setList({ state: "error", code: codeOf(r) });
    });
  }, [view]);

  useEffect(() => {
    if (enabled) reload();
    // 画面を離れたら、届いた答えを描かない（印を進める）
    return () => {
      seq.current += 1;
    };
  }, [enabled, reload]);

  const loadMore = useCallback(() => {
    if (busy.current || list.state !== "ok" || !list.next) return;
    busy.current = true;
    const mine = seq.current;
    const cursor = list.next;
    setLoadingMore(true);
    setMoreError(null);
    void safeCall(() =>
      call("listTickets", {
        query: { view, limit: PAGE_SIZE, cursor },
        screenId: "tickets",
      }),
    ).then((r) => {
      if (mine !== seq.current) return;
      busy.current = false;
      setLoadingMore(false);
      if (r?.ok) {
        const more = listOf(r.data);
        setList((cur) =>
          cur.state === "ok" ? { state: "ok", rows: [...cur.rows, ...more], next: nextOf(r.meta) } : cur,
        );
      } else if (r?.kind !== "unauthenticated") setMoreError(codeOf(r));
    });
  }, [list, view]);

  return { list, loadingMore, moreError, reload, loadMore };
}

/** はじめにやることの 1 件（K-250 の答えの形） */
export interface SetupTask {
  key: string;
  label: string;
  desc: string;
  done: boolean;
  href: string | null;
  available: boolean;
  optional: boolean;
  skipped: boolean;
}

export interface SetupTasks {
  /** 箱を出すか（読めた・閉じていない・使える項目が残っている） */
  show: boolean;
  tasks: SetupTask[];
  /** 済みか飛ばした数 ／ 使える項目の数（パスキーは数に入れない・D-145.15） */
  done: number;
  total: number;
  /** 押している口（閉じる＝"close"・飛ばす＝項目の key） */
  pending: string | null;
  close: () => void;
  skip: (key: string) => void;
}

const settled = (t: SetupTask): boolean => t.done || t.skipped;

export function useSetupTasks(enabled: boolean): SetupTasks {
  const [tasks, setTasks] = useState<SetupTask[] | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void safeCall(() => call("listSetupTasks", { screenId: "tickets" })).then((r) => {
      if (!live) return;
      // 読めないときは箱を出さない（K251-UI-029）
      if (!r?.ok) return setTasks(null);
      setTasks(Array.isArray(r.data) ? (r.data as SetupTask[]) : []);
      setDismissed(r.meta["dismissed"] === true);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  const send = useCallback((which: string, body: { key?: string }) => {
    if (busy.current) return; // 押している間は押せない（2 回押しても口は 1 回）
    busy.current = true;
    setPending(which);
    void safeCall(() => call("dismissSetupTasks", { body, screenId: "tickets" })).then((r) => {
      busy.current = false;
      setPending(null);
      if (!r?.ok) return; // 失敗したら箱とその項目をそのまま残し、また押せる
      const data = r.data as { dismissed?: boolean; skipped?: string[] };
      if (data.dismissed === true) setDismissed(true);
      const skipped = new Set(data.skipped ?? []);
      setTasks((cur) => cur?.map((t) => (skipped.has(t.key) ? { ...t, skipped: true } : t)) ?? cur);
    });
  }, []);

  const usable = (tasks ?? []).filter((t) => t.available);
  const done = usable.filter(settled).length;
  return {
    show: tasks !== null && !dismissed && usable.length > 0 && done < usable.length,
    tasks: tasks ?? [],
    done,
    total: usable.length,
    pending,
    close: () => send("close", {}),
    skip: (key: string) => send(key, { key }),
  };
}

/** 承認待ちの口の 1 件（契約 ApprovalQueueItem の使う所だけ） */
export interface Waiting {
  id: string;
  ticket_id: string | null;
  ticket_number: string;
  title: string;
}

export type Approvals = { state: "loading" } | { state: "error" } | { state: "ok"; rows: Waiting[] };

/** 自分の承認を待っているもの（チケットが在る画面の右の列）。外枠の数の問い合わせとは別に、行を 5 件読む */
export function useApprovals(enabled: boolean): Approvals {
  const q = useQuery({
    queryKey: ["k251-list", "approvals"],
    enabled,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Waiting[]> => {
      const r = await call("listApprovalQueue", { query: { limit: 5 }, screenId: "tickets" });
      if (!r.ok) throw new Error(r.code);
      return (r.data as unknown as Partial<Waiting>[]).map((w) => ({
        id: String(w.id ?? ""),
        ticket_id: w.ticket_id ?? null,
        ticket_number: String(w.ticket_number ?? ""),
        title: String(w.title ?? ""),
      }));
    },
  });
  if (q.isError) return { state: "error" };
  if (q.isSuccess) return { state: "ok", rows: q.data };
  return { state: "loading" };
}
