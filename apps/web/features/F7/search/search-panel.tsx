"use client";
// 探す箱（キャンバス StOverlay の探す側）。上の帯の探す欄（⌘K で焦点）に打つと重なって開く。画面は移らない。
//   頭：虫眼鏡・探す入力（この 1 つだけ。画面の中央・上寄りに開き、その真下に結果が続く 1 つの箱＝⌘K のパレットの形・後ろは薄い幕）／札／結果（種類ごとに上位 5 件）／足：↑↓ で選ぶ ・ Enter で開く ・ 絞るならチケットの一覧へ。
//   幅 767 以下：帯の探す欄が帯いっぱいに開くので、箱は帯の下の全面になり、頭の欄は隠して打った字だけを 1 行出す（↑↓ の案内も隠す）。
//   空は components/k の Empty・読み込み中は Loading・読めないは E-PAGE-007（ErrorState）。置き場：overlay＝重ねる／inline＝その場（モックで並べる）。
import type { KeyboardEvent, Ref } from "react";
import { Search } from "lucide-react";
import { Empty, ErrorState, Loading, PAGE_ERROR } from "@/components/k";
import { SearchGroup } from "./search-group";
import { SearchKindTabs } from "./search-kind-tabs";
import {
  splitTerms,
  type HitKind,
  type SearchGroupView,
  type SearchHitView,
  type SearchKind,
  type SearchStatus,
} from "./search-types";
import "./search.css";

export interface SearchPanelProps {
  query: string;
  onQuery?: ((q: string) => void) | undefined;
  kind: SearchKind;
  onKind?: ((k: SearchKind) => void) | undefined;
  /** 種類ごとの結果（札で絞った後・上位 5 件は部品が数える）。ナレッジは 0 件でも渡してよい */
  groups: readonly SearchGroupView[];
  status: SearchStatus;
  /** ↑↓ で選んでいる行 */
  activeId?: string | undefined;
  placement?: "overlay" | "inline" | undefined;
  onOpen?: ((hit: SearchHitView) => void) | undefined;
  onRetry?: (() => void) | undefined;
  /** 箱の入力の焦点を渡す（本物の箱・K-471）。モックは渡さない */
  inputRef?: Ref<HTMLInputElement> | undefined;
  /** 箱の入力のキー（↑↓ Enter Esc・K-471） */
  onInputKeyDown?: ((e: KeyboardEvent<HTMLInputElement>) => void) | undefined;
  /** 読み込み中を出すまでの待ち（既定は 3 秒より長いときだけ・モックは 0） */
  loadingDelayMs?: number | undefined;
}

/** 0 件でも見出しを出す種類の 1 行（案）。ナレッジのページはまだ無い間（F9 まで） */
const EMPTY_TEXT: Partial<Record<HitKind, string>> = { knowledge: "ナレッジのページはまだありません" };

function Body(p: SearchPanelProps) {
  const terms = splitTerms(p.query);
  if (p.status === "start")
    return <p className="k-f7-search-note">探したい言葉を打つと、チケット・ナレッジ・決定・会話をまとめて探します</p>;
  if (p.status === "loading")
    return <Loading label="探しています…" {...(p.loadingDelayMs === undefined ? {} : { delayMs: p.loadingDelayMs })} />;
  if (p.status === "failed") return <ErrorState code={PAGE_ERROR.loadFailed} acts={p.onRetry ? [p.onRetry] : []} />;
  if (p.status === "empty")
    return <Empty title={`「${p.query}」に合うものがありません`}>細かく絞るならチケットの一覧の検索条件へ</Empty>;
  return (
    <>
      {p.groups.map((g) => (
        <SearchGroup
          key={g.kind}
          kind={g.kind}
          hits={g.hits}
          terms={terms}
          activeId={p.activeId}
          emptyText={p.kind === "all" ? undefined : EMPTY_TEXT[g.kind]}
          onOpen={p.onOpen}
        />
      ))}
    </>
  );
}

export function SearchPanel(p: SearchPanelProps) {
  const { placement = "overlay" } = p;
  return (
    <>
      {placement === "overlay" ? <div className="k-f7-search-scrim" aria-hidden="true" /> : null}
      <section className="k-f7-search" data-placement={placement} aria-label="探す">
        <div className="k-f7-search-head">
          <Search size={18} aria-hidden="true" />
          <label className="k-f7-search-field">
            <span className="sr-only">探す</span>
            <input
              ref={p.inputRef}
              type="search"
              className="k-f7-search-input"
              value={p.query}
              placeholder="チケット・ナレッジ・決定を探す"
              onChange={(e) => p.onQuery?.(e.currentTarget.value)}
              onKeyDown={p.onInputKeyDown}
            />
          </label>
        </div>
        {p.query ? <p className="k-f7-search-q">「{p.query}」</p> : null}
        <SearchKindTabs kind={p.kind} onKind={p.onKind} />
        <div className="k-f7-search-scroll">
          <Body {...p} />
        </div>
        {p.status === "ready" ? (
          <footer className="k-f7-search-foot">
            <span className="k-f7-search-keys">↑↓ で選ぶ ・ Enter で開く ・ </span>
            細かく絞るならチケットの一覧の検索条件へ
          </footer>
        ) : null}
      </section>
    </>
  );
}
