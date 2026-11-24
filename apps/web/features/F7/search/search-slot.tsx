"use client";
// 外枠の探す欄の差し込み口（K-599 が置く・K-471 が本物にする）。この葉では何も出さない：探す欄は今のとおりグレーで打てない。
//   useSearchSlot は Shell に渡す props（shellProps）と Shell の中に置く箱（node）を返す。口を呼ばず・状態を持たない
import type { KeyboardEvent, ReactNode } from "react";

/** 本物にする葉（K-471）が true にする */
export const READY = false;

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

/** この葉では何も返さない（本物にする葉が input を読む） */
export const useSearchSlot: (input: SearchSlotInput) => SearchSlotState = () => EMPTY;

export function SearchSlot({ slot }: { slot: SearchSlotState }): ReactNode {
  return slot.node;
}
