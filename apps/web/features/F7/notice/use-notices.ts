"use client";
// お知らせの口の読み書き（K-467）：一覧 listNotifications（K-461）・既読 readNotification・全部既読 readAllNotifications（K-462）。
//   一覧は箱が開いている間だけ読む（開くたびに 1 回・窓に戻っても読まない・G-16）。鈴の数は外枠の getShell（SHELL_KEY）の
//   notifications_unread を画面の中で書き換える（一覧の meta に未読の総数が無い）。既読は先に数と行を変え、失敗したら戻す。
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { errorText, useNotify } from "@/components/k";
import { SHELL_KEY } from "@/features/F4/create-ticket/ticket-shell";
import { call } from "@/lib/api/call";
import { peopleOf, rawOf, type NoticeRaw } from "./notice-text";
import type { NoticePerson } from "./notice-types";

const PAGE_SIZE = 20;
const SCREEN = "tickets";
const MSG_READ_FAILED = "既読にできませんでした。もう一度お試しください";
const MSG_READ_ALL_FAILED = "すべて既読にできませんでした。もう一度お試しください";
const PAST_BROKEN = "E-NTF-001";

export interface NoticePage {
  rows: NoticeRaw[];
  next: string | null;
  people: NoticePerson[];
}

interface Filter {
  onlyUnread: boolean;
  personId: string | null;
}
const keyOf = (f: Filter) => ["f7-notices", f.onlyUnread, f.personId] as const;

type ReadErr = Error & { status: number; code: string };
const errOf = (status: number, code: string): ReadErr => Object.assign(new Error(code), { status, code });

async function readPage(f: Filter, cursor: string | null): Promise<NoticePage> {
  const r = await call("listNotifications", {
    query: {
      limit: PAGE_SIZE,
      ...(f.onlyUnread ? { unread: "true" } : {}),
      ...(f.personId ? { actor_member_id: f.personId } : {}),
      ...(cursor ? { cursor } : {}),
    },
    screenId: SCREEN,
  });
  if (!r.ok) throw errOf(r.status, r.code);
  const rows = (Array.isArray(r.data) ? (r.data as unknown[]) : []).flatMap((x) => {
    const one = rawOf(x);
    return one ? [one] : [];
  });
  const next = r.meta["next_cursor"];
  return { rows, next: typeof next === "string" && next !== "" ? next : null, people: peopleOf(r.meta["actors"]) };
}

/** 外枠の鈴の数（getShell の答え）を書き換える。答えがまだ無いときは何もしない */
function setShellUnread(qc: QueryClient, f: (n: number) => number): void {
  qc.setQueryData(SHELL_KEY, (old: unknown) => {
    if (typeof old !== "object" || old === null) return old;
    const cur = (old as { notifications_unread?: unknown }).notifications_unread;
    if (typeof cur !== "number") return old;
    return { ...old, notifications_unread: Math.max(0, f(cur)) };
  });
}

const mapRows = (p: NoticePage | undefined, f: (r: NoticeRaw) => NoticeRaw | null): NoticePage | undefined =>
  p
    ? {
        ...p,
        rows: p.rows.flatMap((r) => {
          const x = f(r);
          return x ? [x] : [];
        }),
      }
    : p;

export interface NoticeData {
  status: "ready" | "loading" | "failed";
  rows: NoticeRaw[];
  /** 「過去のお知らせ」で足した分（開く前は undefined） */
  past: NoticeRaw[] | undefined;
  canOpenPast: boolean;
  people: NoticePerson[];
  retry: () => void;
  loadPast: () => void;
  markRead: (id: string) => void;
  markAll: () => void;
}

export function useNoticeData(f: Filter): NoticeData {
  const qc = useQueryClient();
  const notify = useNotify();
  const key = keyOf(f);
  const q = useQuery({
    queryKey: key,
    queryFn: () => readPage(f, null),
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [past, setPast] = useState<{ key: string; page: NoticePage } | undefined>(undefined);
  const [people, setPeople] = useState<NoticePerson[]>([]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // 人の候補は最初の分の meta.actors（絞り込み中も前の候補を保つ）
  const actors = q.data?.people;
  useEffect(() => {
    if (actors?.length) setPeople(actors);
  }, [actors]);

  const keyText = JSON.stringify(key);
  const pastNow = past?.key === keyText ? past.page : undefined;
  const update = (fn: (r: NoticeRaw) => NoticeRaw | null) => {
    qc.setQueryData<NoticePage>(key, (p) => mapRows(p, fn));
    setPast((p) => (p ? { ...p, page: mapRows(p.page, fn)! } : p));
  };
  const setRead = (id: string, read: boolean) => update((r) => (r.id === id ? { ...r, read } : r));
  const all = (): NoticeRaw[] => [...(q.data?.rows ?? []), ...(pastNow?.rows ?? [])];

  const loadPast = () => {
    const cursor = q.data?.next;
    if (!cursor) return;
    void readPage(f, cursor).then(
      (page) => setPast({ key: keyText, page }),
      (e: ReadErr) => {
        setPast(undefined);
        if (e.code === PAST_BROKEN) {
          // 続きの鍵が読めない：足した分を捨てて、鍵なしで最初の分を読み直す
          void q.refetch();
          notify(errorText(PAST_BROKEN).entry.message, { type: "error" });
        } else if (e.status !== 401) notify(errorText("E-PAGE-007").title, { type: "error" });
      },
    );
  };

  const markRead = (id: string) => {
    const row = all().find((r) => r.id === id);
    if (!row || row.read) return;
    setRead(id, true);
    setShellUnread(qc, (n) => n - 1);
    void call("readNotification", { params: { id }, body: { read: true }, screenId: SCREEN }).then(async (r) => {
      if (r.ok) return;
      if (r.status === 404) {
        // もう無いお知らせ：箱が開いていれば行を外して読み直し、数を読み直しの答えに合わせる。移った後は数をそのまま
        if (!mounted.current) return;
        update((x) => (x.id === id ? null : x));
        const res = await q.refetch();
        const page = res.data;
        if (page && page.next === null && !f.personId)
          setShellUnread(qc, () => page.rows.filter((x) => !x.read).length);
        return;
      }
      setRead(id, false);
      setShellUnread(qc, (n) => n + 1);
      if (r.status !== 401) notify(MSG_READ_FAILED, { type: "error" });
    });
  };

  const markAll = () => {
    void call("readAllNotifications", { body: {}, screenId: SCREEN }).then((r) => {
      if (!r.ok) {
        if (r.status !== 401) notify(MSG_READ_ALL_FAILED, { type: "error" });
        return;
      }
      update((x) => (x.read ? x : { ...x, read: true }));
      setShellUnread(qc, () => 0);
    });
  };

  return {
    status: q.isError ? "failed" : q.data ? "ready" : "loading",
    rows: q.data?.rows ?? [],
    past: pastNow?.rows,
    canOpenPast: Boolean(q.data?.next),
    people,
    retry: () => void q.refetch(),
    loadPast,
    markRead,
    markAll,
  };
}
