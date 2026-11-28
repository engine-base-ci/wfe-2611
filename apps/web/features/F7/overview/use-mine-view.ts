"use client";
// 自分に関わるものの見え方（自分だけ・このブラウザに覚える・K-478）：上の数字のうち外した札・右に出すもののうち外した区画。
//   覚える先は localStorage `kaname.f7.mine-view`（{ cards: 外した札の key, side: 外した区画の key }）。口は呼ばない。
//   札（数の札）・右の列・表示設定の箱が同じ値を読む（1 つの置き場を分け合い、替えたら全部が描き直す）。
//   読めない・壊れている・書けないときは既定（全部出す）のまま動く（エラーは出さない）
import { useCallback, useSyncExternalStore } from "react";

export const MINE_VIEW_STORAGE = "kaname.f7.mine-view";
export const SIDE_KEYS = ["approvals", "ai-now", "notices"] as const;
export type SideKey = (typeof SIDE_KEYS)[number];

export interface MineView {
  cards: readonly string[];
  side: readonly SideKey[];
}
const EMPTY: MineView = { cards: [], side: [] };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function parse(raw: string | null): MineView {
  if (raw === null) return EMPTY;
  try {
    const v = JSON.parse(raw) as { cards?: unknown; side?: unknown } | null;
    if (typeof v !== "object" || v === null) return EMPTY;
    const side = strings(v.side).filter((k): k is SideKey => (SIDE_KEYS as readonly string[]).includes(k));
    return { cards: strings(v.cards), side };
  } catch {
    return EMPTY;
  }
}

let current: MineView | null = null;
const listeners = new Set<() => void>();

function read(): MineView {
  if (current) return current;
  try {
    current = parse(window.localStorage.getItem(MINE_VIEW_STORAGE));
  } catch {
    current = EMPTY;
  }
  return current;
}

function save(next: MineView): void {
  current = next;
  try {
    window.localStorage.setItem(MINE_VIEW_STORAGE, JSON.stringify(next));
  } catch {
    // 覚えられないときは、この画面の間だけ効く
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

const flip = <T extends string>(list: readonly T[], key: T, show: boolean): T[] =>
  show ? list.filter((k) => k !== key) : list.includes(key) ? [...list] : [...list, key];

export interface MineViewState {
  hiddenCards: readonly string[];
  hiddenSide: readonly SideKey[];
  toggleCard: (key: string, show: boolean) => void;
  toggleSide: (key: SideKey, show: boolean) => void;
  reset: () => void;
}

export function useMineView(): MineViewState {
  // サーバーで描くときと最初の描画は既定（全部出す）
  const view = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggleCard = useCallback((key: string, show: boolean) => {
    const v = read();
    save({ ...v, cards: flip(v.cards, key, show) });
  }, []);
  const toggleSide = useCallback((key: SideKey, show: boolean) => {
    const v = read();
    save({ ...v, side: flip(v.side, key, show) });
  }, []);
  const reset = useCallback(() => save(EMPTY), []);
  return { hiddenCards: view.cards, hiddenSide: view.side, toggleCard, toggleSide, reset };
}
