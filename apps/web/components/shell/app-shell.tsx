"use client";
// 共通シェル（T-US-01）。枠は導出（外／はじめの設定／アプリ）。全画面がこれを通る（画面ごとにナビを手書きしない）
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { useShell } from "./context";
import { Sidebar } from "./sidebar";
import { SubNav } from "./subnav";
import { TabBar } from "./tabbar";
import { TopBar } from "./topbar";
import "./shell.css";

export interface AppShellProps {
  children: ReactNode;
  /** 自分のAIの右パネル（components/ai）。渡さなければ置かない（会話そのものが本文の画面） */
  panel?: ReactNode;
  primary?: ReactNode;
  subActive?: number;
  onSubSelect?: (i: number) => void;
  who?: { initials: string; name: string; org: string };
  /** 止まっている帯など、本文の上に出すもの */
  banner?: ReactNode;
}
export function AppShell({ children, panel, primary, subActive, onSubSelect, who, banner }: AppShellProps) {
  const { frame, layout, subMode, panelOpen, screenId, role } = useShell();
  const ref = useRef<HTMLDivElement>(null);
  // 本文の最小幅（D-070）：幅 − サイドバー − 第2ナビ（列のとき）− パネル（開いているとき）− 一覧（三画面）が 720 を下回るなら第2ナビを上の帯（chips）に畳む
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const vw = window.innerWidth;
      if (vw < 1180) {
        el.classList.remove("sub-chips");
        return;
      }
      const tp = layout === "threepane";
      const hasSub = !!(screenId && NAV.subByScreen[screenId]?.length);
      const subCol = hasSub && subMode === "column";
      const mainW = vw - (tp ? 72 : 216) - (subCol ? 230 : 0) - (panelOpen && panel ? 340 : 0) - (tp ? 380 : 0);
      el.classList.toggle("sub-chips", subMode === "anchors" || tp || (subCol && mainW < NAV.mainMinPx));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [layout, subMode, panelOpen, panel, screenId]);
  const s = screenId ? NAV.screens[screenId] : null;
  const blocked = s && !s.roles.includes(role);
  if (frame === "outside")
    return (
      <div className="shell" data-frame="outside">
        {children}
      </div>
    );
  return (
    <>
      <div
        ref={ref}
        className={cn("shell", panelOpen && panel && "panel-open")}
        data-frame={frame}
        data-layout={layout}
      >
        {frame === "app" ? <Sidebar {...(who ? { who } : {})} /> : null}
        {frame === "app" && !blocked ? (
          <SubNav
            {...(subActive !== undefined ? { active: subActive } : {})}
            {...(onSubSelect ? { onSelect: onSubSelect } : {})}
            actions={layout === "threepane" ? primary : undefined}
          />
        ) : null}
        {blocked ? (
          <main className="main norole">
            <h1 className="text-h1 font-bold">
              この画面は「{NAV.roles.find((r) => r.id === role)?.name}」には見えません
            </h1>
            <p className="text-[var(--on-sv)]">
              権限で主ナビの項目そのものが変わるため、この画面への入口がありません。
            </p>
          </main>
        ) : (
          <main className="main">
            {banner}
            <TopBar {...(primary && layout !== "threepane" ? { primary } : {})} />
            <div className={cn("content", layout === "threepane" && "content-tp")}>{children}</div>
          </main>
        )}
        {frame === "app" && panel ? (
          <aside className={cn("aipanel", panelOpen && "on")} data-requires="ai app">
            {panel}
          </aside>
        ) : null}
      </div>
      {frame === "app" ? <TabBar /> : null}
    </>
  );
}
