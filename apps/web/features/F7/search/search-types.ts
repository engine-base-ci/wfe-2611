// 探す（F7・段 8）の表示部品が受け取る値の形。口とはつながず、値を受け取って描くだけ。
//   探す対象：チケット（題名・番号）・決定・ナレッジのページ・自分の会話。種類ごとに上位 5 件・札に総数は出さない（P10）。
//   ナレッジは 0 件でも「ナレッジ」の札は出す。権限で見えないものは結果にも出さない（見えない物があることも言わない）。
import type { BadgeTone } from "@/components/k";

export type HitKind = "ticket" | "decision" | "knowledge" | "conversation";
/** 札で選ぶ種類（all は全部） */
export type SearchKind = "all" | HitKind;

/** 種類ごとに出す上位の件数（P10） */
export const HITS_PER_KIND = 5;

export interface SearchHitView {
  id: string;
  kind: HitKind;
  title: string;
  /** 頭に出す番号（チケットの EG-128 など） */
  lead?: string;
  /** チケットの段の札 */
  tag?: { label: string; tone: BadgeTone };
  /** 右端の小さな字（決定「EG-128 ・ 10/28」・ナレッジ「ワークスペース ・ 版 4」・会話の日付） */
  meta?: string;
  /** 会話の引用 1 行 */
  snippet?: string;
  /** 行き先。無ければ押せない形（行き先の画面がまだ無い種類・準備中） */
  href?: string;
}

export interface SearchGroupView {
  kind: HitKind;
  hits: readonly SearchHitView[];
}

/** 探す箱の様子：start＝まだ打っていない／ready＝結果あり／empty＝合うものが無い／loading／failed */
export type SearchStatus = "start" | "ready" | "empty" | "loading" | "failed";

export const KIND_LABEL: Record<SearchKind, string> = {
  all: "すべて",
  ticket: "チケット",
  knowledge: "ナレッジ",
  decision: "決定",
  conversation: "会話",
};
/** 札の並び（キャンバスのとおり） */
export const KIND_ORDER: readonly SearchKind[] = ["all", "ticket", "knowledge", "decision", "conversation"];

/** 探す字を空白（全角も）で分ける。強調に使う（探す本体のそろえ方は口の側・D-128.157） */
export function splitTerms(query: string): string[] {
  return query.split(/\s+/).filter(Boolean);
}
