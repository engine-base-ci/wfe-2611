"use client";
// 共通シェル（T-US-01）。枠は導出（外／はじめの設定／アプリ）。全画面がこれを通る（画面ごとにナビを手書きしない）
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { NAV } from "@/lib/nav.legacy";
import { cn } from "@/lib/cn";
import { useShell } from "./context";
import { Sidebar } from "./sidebar";
import { SubNav } from "./subnav";
import { TabBar } from "./tabbar";
import { TopBar } from "./topbar";
import { AssistantPanel } from "@/components/ai/panel";
import "./shell.css";

export interface AppShellProps {
  children: ReactNode;
  /** 自分のAIの右パネル。**渡さなくても必ず出す**（全部の作業画面に同じ 1 本の会話・D-062.1・D-103）。
   *  出さないのは、会話そのものが本文の画面（会話モード）だけで、そこは false を渡す。見本の画面は中身を差し替えられる */
  panel?: ReactNode | false;
  /** 選んでいる 1 件（三画面の一覧で選んだもの）。右パネルが自分のAI に添える */
  selected?: string | null;
  primary?: ReactNode;
  subActive?: number;
  onSubSelect?: (i: number) => void;
  who?: { initials: string; name: string; org: string };
  /** 止まっている帯など、本文の上に出すもの */
  banner?: ReactNode;
  /** 第2ナビの項目の代わりに出す中身（会話モードの会話の一覧） */
  subBody?: ReactNode;
}
export function AppShell({
  children,
  panel: panelProp,
  selected,
  primary,
  subActive,
  onSubSelect,
  who,
  banner,
  subBody,
}: AppShellProps) {
  const panel = panelProp === false ? null : (panelProp ?? <AssistantPanel selected={selected ?? null} />);
  const { frame, layout, subMode, panelOpen, screenId, role } = useShell();
  const hasPanel = !!panel;
  const ref = useRef<HTMLDivElement>(null);
  // 動きは組み上がってから（SSR の最初の描画では引き出しは閉じたまま・滑り出しもしない。1179 以下で開いた分類が一瞬見えて滑って消えていた）
  const [navReady, setNavReady] = useState(false);
  useEffect(() => setNavReady(true), []);
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
      const mainW = vw - (tp ? 72 : 216) - (subCol ? 230 : 0) - (panelOpen && hasPanel ? 340 : 0) - (tp ? 380 : 0);
      el.classList.toggle("sub-chips", subMode === "anchors" || tp || (subCol && mainW < NAV.mainMinPx));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [layout, subMode, panelOpen, hasPanel, screenId]);
  const s = screenId ? NAV.screens[screenId] : null;
  const blocked = s && !s.roles.includes(role);
  const head = frame === "app" && !blocked && layout !== "threepane";
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
        data-nav-ready={navReady ? "" : undefined}
      >
        {frame === "app" ? <Sidebar {...(who ? { who } : {})} /> : null}
        {/* 見出しの帯：左パネル（第2ナビ）と本文の上にまたがって 1 つだけ（2026-09-30 user「同じ文章が 2 回・ヘッドはパネルの幅も」）。
            三画面は見出しを出さず、主ボタンを第2ナビの行に寄せる（D-072） */}
        {head ? (
          <header className="shead">
            {banner}
            <TopBar {...(primary ? { primary } : {})} hasPanel={hasPanel} subToggle={!!subBody} />
          </header>
        ) : null}
        {frame === "app" && !blocked ? (
          <SubNav
            {...(subActive !== undefined ? { active: subActive } : {})}
            {...(onSubSelect ? { onSelect: onSubSelect } : {})}
            actions={layout === "threepane" ? primary : undefined}
            body={subBody}
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
            {head ? null : (
              <>
                {banner}
                <TopBar
                  {...(primary && layout !== "threepane" ? { primary } : {})}
                  hasPanel={hasPanel}
                  subToggle={!!subBody}
                />
              </>
            )}
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
