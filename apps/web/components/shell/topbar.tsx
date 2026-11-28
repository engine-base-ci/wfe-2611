"use client";
import { navRoute } from "@/lib/pending-route";
import { Bot, PanelLeft, PauseCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { NAV } from "@/lib/nav.legacy";
import { useShell } from "./context";

/** 見出しの行：くくり・h1・自分のAIのトグル・主アクション 1 つ（D-071・D-072。三画面では第2ナビの行に寄せる） */
/** hasPanel が false の画面（会話モード＝会話そのものが本文）は、右パネルが無いのでトグルを出さない（押しても何も起きないボタンを作らない・G-01） */
export function TopBar({
  primary,
  extra,
  hasPanel = true,
  subToggle = false,
}: {
  primary?: ReactNode;
  extra?: ReactNode;
  hasPanel?: boolean;
  /** 第2ナビの中身（会話の一覧）を 1179 以下で引き出しとして開くボタンを出す（D-064.7） */
  subToggle?: boolean;
}) {
  const { screenId, caps, panelOpen, setPanelOpen, aiName, layout, subOpen, setSubOpen } = useShell();
  if (!screenId) return null;
  const s = NAV.screens[screenId];
  const crumb = NAV.sections.find((x) => (x.screens as readonly string[]).includes(screenId))?.label ?? "";
  const aiOk = hasPanel && caps.includes("ai") && caps.includes("app");
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
        {/* 一覧を開く：タイトルの左のアイコン（Claude・ChatGPT の狭い幅と同じ置き場）。1180 以上では出ない（左の列にある） */}
        {subToggle ? (
          <button
            type="button"
            className="btn btn-g sub-toggle"
            aria-label="会話の一覧"
            title="会話の一覧"
            aria-expanded={subOpen}
            aria-controls="subnav"
            data-sub-toggle
            onClick={() => setSubOpen(!subOpen)}
          >
            <PanelLeft />
          </button>
        ) : null}
        <div className="tt">
          <div className="crumb">{crumb}</div>
          <h1 title={s.purpose}>{s.name}</h1>
        </div>
        <div className="sp" />
        {btns}
      </div>
      <div className="purpose">
        <Info />
        <div title={s.purpose}>{s.purpose}</div>
      </div>
    </>
  );
}
