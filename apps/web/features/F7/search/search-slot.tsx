"use client";
// 外枠の探す欄の差し込み口（K-599 が置き・K-471 が本物にした）。
//   useSearchSlot は Shell に渡す props（shellProps）と Shell の中に置く探す箱（node）を返す。開いている間だけ箱（SearchLive）を置き、
//   閉じると打った字を捨てる。箱の中身は最初の描画の後に別に読む（動的 import・最初の画面の JS を増やさない）。
//   ログイン前（enabled が false）は何も返さない：探す欄はグレーで打てない形のまま
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { SearchLiveApi, SearchLiveProps } from "./search-live";

/** 本物にした（K-471） */
export const READY = true;

export interface SearchSlotInput {
  /** ログイン済みのとき true（ログイン前に口を呼ばない） */
  enabled: boolean;
}
export interface SearchSlotState {
  shellProps: {
    onSearch?: (q: string) => void;
    onSearchOpen?: () => void;
    onSearchInput?: (q: string) => void;
    onSearchClose?: () => void;
    onSearchKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    defaultSearching?: boolean;
  };
  node: ReactNode;
}

const EMPTY: SearchSlotState = { shellProps: {}, node: null };

export function useSearchSlot({ enabled }: SearchSlotInput): SearchSlotState {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusTick, setFocusTick] = useState(0);
  const apiRef = useRef<SearchLiveApi | null>(null);
  const openRef = useRef(false);
  // 箱の中身は別に読む（最初の描画の後・ログイン済みのときだけ）。Suspense は使わない（中身が出るのを時計で遅らせない）
  const [Live, setLive] = useState<ComponentType<SearchLiveProps> | null>(null);
  useEffect(() => {
    if (!enabled || Live) return;
    let alive = true;
    void import("./search-live").then((m) => {
      if (alive) setLive(() => m.default);
    });
    return () => {
      alive = false;
    };
  }, [enabled, Live]);
  openRef.current = open;

  const onClose = useCallback((how: "esc" | "open" | "outside") => {
    setOpen(false);
    setQuery("");
    // Esc のときの焦点は本文へ（帯の探す欄へ戻すと、焦点で開く決めのため開き直す）。外を押したときは押した所に任せる
    if (how === "esc") document.getElementById("k-main")?.focus();
  }, []);

  const shellProps = useMemo<SearchSlotState["shellProps"]>(
    () => ({
      onSearch: () => apiRef.current?.openActive(),
      onSearchOpen: () => {
        if (openRef.current) setFocusTick((n) => n + 1);
        else setOpen(true);
      },
      onSearchInput: (q: string) => {
        setQuery(q);
        setOpen(true);
      },
      onSearchClose: () => {
        setOpen(false);
        setQuery("");
      },
      onSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => apiRef.current?.onKey(e),
    }),
    [],
  );

  if (!enabled) return EMPTY;
  return {
    shellProps,
    node:
      open && Live ? (
        <Live query={query} onQuery={setQuery} onClose={onClose} focusTick={focusTick} apiRef={apiRef} />
      ) : null,
  };
}

export function SearchSlot({ slot }: { slot: SearchSlotState }): ReactNode {
  return slot.node;
}
