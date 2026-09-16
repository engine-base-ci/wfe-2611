"use client";
import { navRoute } from "@/lib/pending-route";
import { Bot, PauseCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { NAV } from "@/lib/nav";
import { useShell } from "./context";

/** 見出しの行：くくり・h1・自分のAIのトグル・主アクション 1 つ（D-071・D-072。三画面では第2ナビの行に寄せる） */
export function TopBar({ primary, extra }: { primary?: ReactNode; extra?: ReactNode }) {
  const { screenId, caps, panelOpen, setPanelOpen, aiName, layout } = useShell();
  if (!screenId) return null;
  const s = NAV.screens[screenId];
  const crumb = NAV.sections.find((x) => (x.screens as readonly string[]).includes(screenId))?.label ?? "";
  const aiOk = caps.includes("ai") && caps.includes("app");
  const stopped = caps.includes("stopped");
  const nobridge = caps.includes("nobridge");
  const btns = (
    <>
      {aiOk ? (
        <button
          type="button"
          className="btn btn-o ap-toggle"
          aria-pressed={panelOpen}
          data-requires="ai app"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <Bot /> <span className="ap-name">{aiName}</span>
        </button>
      ) : null}
      {stopped ? (
        <Link
          className="btn btn-g ai-stopped"
          data-requires="stopped app"
          href={navRoute("/settings/automation-repair")}
          title="AI は止まっています"
        >
          <PauseCircle />
          <span>AI は止まっています</span>
        </Link>
      ) : null}
      {nobridge ? (
        <Link className="btn btn-g ai-stopped" data-requires="nobridge" href="/setup/bridge">
          <span>PC をつなぐと話せます</span>
        </Link>
      ) : null}
      {extra}
      {primary}
    </>
  );
  if (layout === "threepane")
    return (
      <div className="topbar-acts" hidden>
        {btns}
      </div>
    );
  return (
    <>
      <div className="topbar">
        <div className="tt">
          <div className="crumb">{crumb}</div>
          <h1 title={s.purpose}>{s.name}</h1>
        </div>
        <div className="sp" />
        {btns}
      </div>
      <div className="purpose">
        <Info />
        <div>{s.purpose}</div>
      </div>
    </>
  );
}
