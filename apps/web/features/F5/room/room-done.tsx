"use client";
// 分身の部屋「やったこと」の入れ物（K-756）：口 listCloneActivity（K-754）を読み、部品 done.tsx に値と動きを渡す。
//   札（?kind=ran|made|stopped）と期間（?period=month|quarter）は道に残す（すべて・この 1 週間は付けない・知らない値は既定に戻し口に送らない）。
//   続きは meta.cursor を cursor で渡す無限の読み（1 回 50 件＝口の既定）。この期間の数は meta.summary（札で絞っても口の答えのまま・waiting は出さない）。
//   401 は call が入り直しへ送る。書き出しは作らない（D-153.33）
import { useInfiniteQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { call } from "@/lib/api/call";
import { DoneEmpty, DoneFailed, DoneLoading, RoomDone, type DoneFilter, type DoneSummary } from "./done";
import {
  DEFAULT_PERIOD,
  PERIOD_KEYS,
  PERIODS,
  kindOf,
  periodOf,
  rangeOf,
  toDays,
  type ActivityRow,
  type DonePeriod,
} from "./done-words";

const SCREEN = "ai-activity";
const PERIOD_OPTIONS = PERIOD_KEYS.map((key) => ({ key, label: PERIODS[key].label }));

interface Page {
  rows: ActivityRow[];
  cursor: string | null;
  summary: DoneSummary | null;
}
class ActivityReadError extends Error {}

async function readPage(kind: DoneFilter, period: DonePeriod, cursor: string | null): Promise<Page> {
  const query = {
    ...rangeOf(period),
    ...(kind === "all" ? {} : { kind }),
    ...(cursor ? { cursor } : {}),
  };
  const r = await call("listCloneActivity", { query, screenId: SCREEN });
  if (!r.ok) throw new ActivityReadError(r.code);
  const s = (r.meta["summary"] ?? null) as Partial<DoneSummary> | null;
  return {
    rows: r.data as unknown as ActivityRow[],
    cursor: r.meta.cursor ?? null,
    summary: s
      ? {
          total: Number(s.total ?? 0),
          passed: Number(s.passed ?? 0),
          fixed: Number(s.fixed ?? 0),
          stopped: Number(s.stopped ?? 0),
        }
      : null,
  };
}

/** 道の問い合わせの札と期間。書くときは既定を消し、ほかの問い合わせは残す */
function useDoneParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const kind = kindOf(sp.get("kind"));
  const period = periodOf(sp.get("period"));
  const write = (next: { kind?: DoneFilter; period?: DonePeriod }) => {
    const q = new URLSearchParams(sp.toString());
    const k = next.kind ?? kind;
    const p = next.period ?? period;
    if (k === "all") q.delete("kind");
    else q.set("kind", k);
    if (p === DEFAULT_PERIOD) q.delete("period");
    else q.set("period", p);
    const s = q.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
  };
  return { kind, period, write };
}

export function RoomDoneView() {
  const { kind, period, write } = useDoneParams();
  const q = useInfiniteQuery({
    queryKey: ["k756", "activity", kind, period],
    retry: false,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => readPage(kind, period, pageParam),
    getNextPageParam: (last) => last.cursor ?? undefined,
  });
  const fetching = useRef(false);
  const label = PERIODS[period].label;
  const acts = {
    onFilter: (k: DoneFilter) => write({ kind: k }),
    onPeriod: (p: string) => write({ period: periodOf(p) }),
    periods: PERIOD_OPTIONS,
  };
  if (q.isError && !q.data) return <DoneFailed onRetry={() => void q.refetch()} />;
  if (!q.data) return <DoneLoading />;
  const pages = q.data.pages;
  const rows = pages.flatMap((p) => p.rows);
  if (rows.length === 0) return <DoneEmpty filter={kind} period={label} {...acts} />;
  const summary = pages[0]?.summary ?? null;
  const onMore = () => {
    if (fetching.current || q.isFetchingNextPage) return;
    fetching.current = true;
    void q.fetchNextPage().finally(() => {
      fetching.current = false;
    });
  };
  return (
    <RoomDone
      days={toDays(rows)}
      filter={kind}
      period={label}
      {...(summary ? { summary } : {})}
      more={q.hasNextPage ? { busy: q.isFetchingNextPage, onMore } : null}
      {...acts}
    />
  );
}
