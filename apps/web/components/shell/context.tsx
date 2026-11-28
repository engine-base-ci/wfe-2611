"use client";
// シェルの文脈（T-US-01）：役割（R1〜R6）・時点の caps・いま見ている画面・件数。枠（外／はじめの設定／アプリ）はここから機械で導く（D-065.5）
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NAV, type RoleId, type ScreenId } from "@/lib/nav.legacy";

export type Frame = "outside" | "wizard" | "app";
export type Layout = "page" | "threepane";
export interface ShellState {
  role: RoleId;
  caps: readonly string[];
  psId: string;
  screenId: ScreenId | null;
  counts: Record<string, number>;
  frame: Frame;
  layout: Layout;
  subMode: "column" | "anchors";
  panelOpen: boolean;
  /** 第2ナビの中身（会話の一覧）の引き出し。1179 以下だけ意味を持つ（D-064.7） */
  subOpen: boolean;
  setSubOpen: (v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  aiName: string;
}
const Ctx = createContext<ShellState | null>(null);

/** 枠の導出：needs_login=false → 外／app ∉ caps → はじめの設定／それ以外 → アプリ（D-065・shell_rule） */
export function deriveFrame(screenId: ScreenId | null, caps: readonly string[]): Frame {
  if (!screenId) return "app";
  const s = NAV.screens[screenId];
  if (!s.needsLogin) return "outside";
  if (!caps.includes("app")) return "wizard";
  return "app";
}
export const capsOf = (psId: string): readonly string[] => NAV.productStates.find((p) => p.id === psId)?.caps ?? [];

const PANEL_KEY = "kaname.panel";
export function ShellProvider({
  role = "R1",
  psId = "PS3",
  screenId = null,
  counts = {},
  aiName = "自分のAI",
  children,
}: {
  role?: RoleId;
  psId?: string;
  screenId?: ScreenId | null;
  counts?: Record<string, number>;
  aiName?: string;
  children: ReactNode;
}) {
  const caps = capsOf(psId);
  const frame = deriveFrame(screenId, caps);
  const layout = (screenId && NAV.layoutByScreen[screenId] === "threepane" ? "threepane" : "page") as Layout;
  const subMode = (screenId && NAV.subModeByScreen[screenId] === "anchors" ? "anchors" : "column") as
    "column" | "anchors";
  const [panelOpen, setPanel] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  useEffect(() => {
    // パネルの既定：本文が 720（三画面は中央 640）を保てる幅でだけ開く。覚えるのは広い幅（1180+）だけ（D-070）
    const vw = window.innerWidth;
    const tp = layout === "threepane";
    const room =
      vw - (tp && vw >= 1180 ? 72 : 216) - (subMode === "column" && !tp ? 230 : 0) - 340 - (tp ? 380 : 0) >=
      (tp ? 640 : 720);
    let init = room;
    try {
      const v = window.localStorage.getItem(PANEL_KEY);
      if (v !== null && vw >= 1180) init = v === "1";
    } catch {
      /* 覚えられなくても動く */
    }
    setPanel(init);
  }, [layout, subMode]);
  const setPanelOpen = (v: boolean) => {
    setPanel(v);
    try {
      if (window.innerWidth >= 1180) window.localStorage.setItem(PANEL_KEY, v ? "1" : "0");
    } catch {
      /* noop */
    }
  };
  const value = useMemo<ShellState>(
    () => ({
      role,
      caps,
      psId,
      screenId,
      counts,
      frame,
      layout,
      subMode,
      panelOpen,
      setPanelOpen,
      subOpen,
      setSubOpen,
      aiName,
    }),
    [role, caps, psId, screenId, counts, frame, layout, subMode, panelOpen, subOpen, aiName],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useShell(): ShellState {
  const v = useContext(Ctx);
  if (!v) throw new Error("ShellProvider の中で使う");
  return v;
}
