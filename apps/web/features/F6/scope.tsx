"use client";
// 区画をまたぐ状態の入れ物（K-382・K-392 がタブと飛び先で使う）。DOM を足さない。
//   区画をまたぐ読み直しは問い合わせの鍵（react-query）で行い、この Context に欄を足さない（後ろの葉が同じファイルを取り合わないため）。
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";

export type PanelTab = "attr" | "talk" | "ai";

interface ScopeValue {
  tab: PanelTab;
  setTab: (tab: PanelTab) => void;
}

const Scope = createContext<ScopeValue | null>(null);

/** パネルのタブ（属性／やり取り）。DetailScope の外では null */
export function usePanelTab(): ScopeValue | null {
  return useContext(Scope);
}

/** 区画をまたぐ状態の入れ物（DOM を足さない） */
export function DetailScope({ children }: { ticket: SlotTicket; children: ReactNode }): ReactNode {
  const [tab, setTab] = useState<PanelTab>("attr");
  const value = useMemo(() => ({ tab, setTab }), [tab]);
  return <Scope.Provider value={value}>{children}</Scope.Provider>;
}
