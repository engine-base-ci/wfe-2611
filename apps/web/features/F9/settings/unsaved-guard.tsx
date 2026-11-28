"use client";
// 保存していない変更を持ったまま離れる前の確かめ（K-707・種別／状態 K-708／項目 K-709 の欄が同じ物を使う）。
//   欄は setDirty で「変えた所がある」を知らせ、離れる側（別の種別・別のタブを押す）は confirmLeave(go) を呼ぶ。
//   変えた所が無ければすぐ go、あれば小窓「保存していない変更があります」（捨てて移る／戻る）
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { DiscardConfirm } from "./settings-dialogs";

export interface Unsaved {
  setDirty: (dirty: boolean) => void;
  confirmLeave: (go: () => void) => void;
}

const UnsavedContext = createContext<Unsaved>({ setDirty: () => undefined, confirmLeave: (go) => go() });

export function UnsavedProvider({ children }: { children: ReactNode }) {
  const dirty = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const setDirty = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);
  const confirmLeave = useCallback((go: () => void) => {
    if (!dirty.current) return go();
    setPending(() => go);
  }, []);
  const value = useMemo(() => ({ setDirty, confirmLeave }), [setDirty, confirmLeave]);
  return (
    <UnsavedContext.Provider value={value}>
      {children}
      <DiscardConfirm
        open={pending !== null}
        onStay={() => setPending(null)}
        onDiscard={() => {
          const go = pending;
          setPending(null);
          dirty.current = false;
          go?.();
        }}
      />
    </UnsavedContext.Provider>
  );
}

export const useUnsaved = (): Unsaved => useContext(UnsavedContext);
