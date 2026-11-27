"use client";
// 承認待ちの絞り込みの札と並べ替え（K-749・D-153.10・D-153.30）。正の絵は下絵 /dev/mock/f5/queue-filter-*（features/F5/more/queue.tsx の QueueTools・FilteredEmpty）。
//   押した札と並べ替えは道（?kind=…&sort=…）に残す。既定（すべて・期限の近い順）は道に何も付けない。決まった値でない道の値は既定として読む（口に送らない）。
//   札の数は口の meta.counts（total・artifact・handover・絞っても全体の数）。一覧の問い合わせの頁が持つ counts を問い合わせの入れ物から読む（口を増やさない）。
//   文は全部文字として出す。生の色・大きさは書かない（more.css・approve.css の形を使う）
import type { Route } from "next";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button, Empty } from "@/components/k";
import { queueKey } from "@/features/F5/approve-complete/queue";

export type QueueKind = "artifact" | "handover";
export type QueueSort = "waiting" | "title";

const KINDS: readonly { kind: QueueKind | null; label: string }[] = [
  { kind: null, label: "すべて" },
  { kind: "artifact", label: "AI の成果物" },
  { kind: "handover", label: "渡された" },
];
/** 物がまだ無い札：押せない形（「決まりの例外」「やり方を広げる」は札から外した・下絵） */
const INERT_CHIPS = ["上位の承認", "判断を仰がれた"] as const;
const INERT = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

const SORTS: readonly { sort: QueueSort | null; label: string }[] = [
  { sort: null, label: "期限の近い順" },
  { sort: "waiting", label: "新しく承認待ちになった順" },
  { sort: "title", label: "題名の順" },
];

const asKind = (v: string | null): QueueKind | null => (v === "artifact" || v === "handover" ? v : null);
const asSort = (v: string | null): QueueSort | null => (v === "waiting" || v === "title" ? v : null);

export const kindLabel = (k: QueueKind | null): string => KINDS.find((x) => x.kind === k)?.label ?? "すべて";
const sortLabel = (s: QueueSort | null): string => SORTS.find((x) => x.sort === s)?.label ?? "期限の近い順";

export interface QueueParams {
  kind: QueueKind | null;
  sort: QueueSort | null;
  setKind: (k: QueueKind | null) => void;
  setSort: (s: QueueSort | null) => void;
}

/** 道の kind・sort を読み、替える（router.replace・履歴を積まない・道のほかの欄は残す） */
export function useQueueParams(): QueueParams {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const kind = asKind(sp.get("kind"));
  const sort = asSort(sp.get("sort"));
  const put = useCallback(
    (name: "kind" | "sort", value: string | null) => {
      const next = new URLSearchParams(sp.toString());
      if (value) next.set(name, value);
      else next.delete(name);
      const s = next.toString();
      router.replace((s ? `${pathname}?${s}` : pathname) as Route, { scroll: false });
    },
    [sp, router, pathname],
  );
  const setKind = useCallback((k: QueueKind | null) => put("kind", k), [put]);
  const setSort = useCallback((s: QueueSort | null) => put("sort", s), [put]);
  return { kind, sort, setKind, setSort };
}

/** 承認待ちの問い合わせの足しと鍵（決まった値だけを入れる・既定は入れない） */
export function queueQueryOf(kind: QueueKind | null, sort: QueueSort | null) {
  const query: Record<string, string> = {};
  if (kind) query["kind"] = kind;
  if (sort) query["sort"] = sort;
  return { query, key: [kind ?? "all", sort ?? "due"] as const };
}

export interface QueueCounts {
  total?: number;
  artifact?: number;
  handover?: number;
}
const numOr = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** 一覧の問い合わせの頁が持つ meta.counts（頁の counts）を、問い合わせの入れ物から読む。口は呼ばない */
function useQueueCounts(key: readonly string[]): QueueCounts | null {
  const qc = useQueryClient();
  const full = useMemo(() => [...queueKey, ...key], [key]);
  const read = useCallback(() => {
    const d = qc.getQueryData<InfiniteData<{ counts?: unknown }>>(full);
    const c = d?.pages?.[0]?.counts;
    return c && typeof c === "object" ? (c as Record<string, unknown>) : null;
  }, [qc, full]);
  const subscribe = useCallback((cb: () => void) => qc.getQueryCache().subscribe(cb), [qc]);
  const raw = useSyncExternalStore(subscribe, read, () => null);
  // 札を替えた直後（新しい鍵の頁がまだ無い間）は前の数を出し続ける（数は絞っても全体の数）
  const lastRef = useRef<QueueCounts | null>(null);
  if (raw)
    lastRef.current = {
      total: numOr(raw["total"]),
      artifact: numOr(raw["artifact"]),
      handover: numOr(raw["handover"]),
    };
  return lastRef.current;
}

function Chip({ label, count, on, onPress }: { label: string; count?: number; on: boolean; onPress: () => void }) {
  return (
    <button type="button" className="k-ap-chip" aria-pressed={on ? "true" : "false"} onClick={onPress}>
      {label}
      {count !== undefined ? (
        <>
          {" "}
          <span className="k-more-count">{count}</span>
        </>
      ) : null}
    </button>
  );
}

/** 札の組（table・card で同じ 5 つ） */
export function QueueChips({ total, layout }: { total: number; layout: "table" | "card" }) {
  const { kind, sort, setKind } = useQueueParams();
  const counts = useQueueCounts(queueQueryOf(kind, sort).key);
  const countOf = (k: QueueKind | null): number | undefined => (k === null ? (counts?.total ?? total) : counts?.[k]);
  return (
    <div className={layout === "card" ? "k-hnd-mchips" : "k-ap-chips"} role="group" aria-label="絞り込み">
      {KINDS.map((c) => (
        <Chip
          key={c.label}
          label={c.label}
          count={countOf(c.kind)}
          on={kind === c.kind}
          onPress={() => {
            if (kind !== c.kind) setKind(c.kind);
          }}
        />
      ))}
      {INERT_CHIPS.map((label) => (
        <button key={label} type="button" className="k-ap-chip" aria-pressed="false" {...INERT}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** 並べ替えのボタンと箱（表だけ・スマホは出さない＝下絵） */
export function SortBox() {
  const { sort, setSort } = useQueueParams();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const opts = useRef<(HTMLLIElement | null)[]>([]);
  const current = SORTS.findIndex((s) => s.sort === sort);

  const close = useCallback((focusButton: boolean) => {
    setOpen(false);
    if (focusButton) btn.current?.focus();
  }, []);
  const choose = (i: number) => {
    const s = SORTS[i];
    if (!s) return;
    close(true);
    if (s.sort !== sort) setSort(s.sort);
  };

  useEffect(() => {
    if (!open) return;
    opts.current[active]?.focus();
  }, [open, active]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, SORTS.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <span className="k-more-sortwrap" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="k-more-sortbtn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) return close(false);
          setActive(current < 0 ? 0 : current);
          setOpen(true);
        }}
      >
        {`${sortLabel(sort)} ▾`}
      </button>
      {open ? (
        <ul className="k-more-pop" role="listbox" aria-label="並べ替え" onKeyDown={onKey}>
          {SORTS.map((s, i) => (
            <li
              key={s.label}
              ref={(el) => {
                opts.current[i] = el;
              }}
              role="option"
              tabIndex={-1}
              aria-selected={s.sort === sort}
              onClick={() => choose(i)}
            >
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  );
}

/** 絞った札で 0 件（下絵 FilteredEmpty） */
export function FilteredEmptyView({ kind, onReset }: { kind: QueueKind; onReset: () => void }): ReactNode {
  return (
    <Empty
      icon="✓"
      title={`「${kindLabel(kind)}」で決めるものはありません`}
      action={
        <Button variant="outlined" onClick={onReset}>
          すべてに戻す
        </Button>
      }
    >
      ほかの札には、決めるものが残っています
    </Empty>
  );
}
