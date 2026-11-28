"use client";
// 見え方の頭（段 8・F7）：見出しの行（グループの印・名前・補足・メンバーの顔）と、見え方のタブ。
//   口とはつながず、値を受け取って描くだけ。本番では葉（K-478〜K-482）が、行き先とグループの値をつなぐ。
//   タブ（キャンバス Main の header nav）：自分に関わるもの・概要・一覧・カレンダー・ガント。今いるものに aria-current="page"。
//   スマホ（767 以下）はガントのタブを出さない（キャンバス MobileList のとおり）
import type { ReactNode } from "react";
import "../../F4/ticket-list/ticket-list.css";
import "./tones.css";
import "./overview.css";

/** 色の段（tones.css） */
export type Tone =
  | "neutral"
  | "indigo"
  | "tertiary"
  | "warning"
  | "progress"
  | "amber"
  | "success"
  | "danger"
  | "hold"
  | "teal"
  | "teal-light"
  | "lavender"
  | "plum"
  | "coral"
  | "sage";

/** 状態の名前 → 色の段（キャンバス Main・Gantt の状態の色と同じ組） */
export const STAGE_TONE: Readonly<Record<string, Tone>> = {
  未着手: "neutral",
  作業中: "indigo",
  確認中: "tertiary",
  承認待ち: "warning",
  実行中: "progress",
  渡し中: "amber",
  完了: "success",
  保留: "hold",
};

/** 種別の名前 → 色の段（キャンバス Main・Calendar：タスク teal・QA 赤・課題 橙・会議 紫） */
export const KIND_TONE: Readonly<Record<string, Tone>> = {
  タスク: "teal",
  QA: "danger",
  課題: "warning",
  会議: "tertiary",
};

export type ViewKey = "mine" | "overview" | "list" | "calendar" | "gantt";

const VIEW_TABS: readonly { key: ViewKey; label: string }[] = [
  { key: "mine", label: "自分に関わるもの" },
  { key: "overview", label: "概要" },
  { key: "list", label: "一覧" },
  { key: "calendar", label: "カレンダー" },
  { key: "gantt", label: "ガント" },
];

/** 見え方のタブ。hrefs は行き先（無ければ「#」）。current は今いるもの */
export function ViewTabs({ current, hrefs }: { current: ViewKey; hrefs?: Partial<Record<ViewKey, string>> }) {
  return (
    <nav className="k-list-views" aria-label="チケットの見え方">
      {VIEW_TABS.map((t) => (
        <a
          key={t.key}
          className="k-list-view"
          href={hrefs?.[t.key] ?? "#"}
          aria-current={t.key === current ? "page" : undefined}
          data-phone={t.key === "gantt" ? "off" : undefined}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}

export interface ScopeHeadProps {
  title: string;
  /** グループの印（頭字と色）。「すべてのグループ」の見出しには付けない */
  mark?: { code: string; tone: Tone };
  /** 見出しの右の補足（「すべてのグループ」「（EG）」）。メンバーの顔・人数は口に値が無いので出さない（D-144.3） */
  sub?: string;
  /** 見え方のタブ（ViewTabs） */
  tabs: ReactNode;
}

export function ScopeHead({ title, mark, sub, tabs }: ScopeHeadProps) {
  return (
    <header className="k-page-head k-list-head">
      <div className="k-list-head-row">
        {mark ? (
          <span className="k-list-scope-mark" data-tone={mark.tone} aria-hidden="true">
            {mark.code}
          </span>
        ) : null}
        <h1 id="tickets-title">{title}</h1>
        {sub ? <span className="k-list-dim">{sub}</span> : null}
      </div>
      {tabs}
    </header>
  );
}
