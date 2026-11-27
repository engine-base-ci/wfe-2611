// choice-align.mjs の型（K-642）。TypeScript（apps/web の試験）から読む
import type { Page } from "@playwright/test";

/** 測った印 1 つ。diff＝印の縦の真ん中 − 字の 1 行目の縦の真ん中（px・下が正）。lines は最初の字の行の数、blockMid は最初の字の全部の行の縦の真ん中 */
export interface ChoiceAlignRow {
  kind: "mid";
  where: string;
  diff: number;
  boxMid: number;
  textMid: number;
  lines: number;
  blockMid: number;
}
/** 同じ並び（縦に積んだ印の列）の左端・印と字の間のずれ。kind: "left"＝印の左端が並びの一番左から diff px・"gap"＝印と字の間の幅が diff px */
export interface ChoiceEdgeBad {
  kind: "left" | "gap";
  where: string;
  diff: number;
  names: string[];
}
/** 並び 1 つ（印が 2 個以上）。left＝印の左端の幅・gap＝印と字の間の幅（px） */
export interface ChoiceColumn {
  marks: number;
  left: number;
  gap: number;
  names: string[];
}
/** 1 頁の結果。measured＝字のある見えている印の数・hidden＝見えない印の数・bare＝字の無い印・bad＝上限を超えた物（縦の真ん中・並びの左端・印と字の間）・columns＝並び・leftMax／gapMax＝並びの中の一番大きい幅 */
export interface ChoiceAlignResult {
  limit: number;
  measured: number;
  hidden: number;
  bare: string[];
  rows: ChoiceAlignRow[];
  bad: (ChoiceAlignRow | ChoiceEdgeBad)[];
  columns: ChoiceColumn[];
  leftMax: number;
  gapMax: number;
}
export const CHOICE_ALIGN_LIMIT_PX: number;
export function measureChoiceAlign(limit: number): ChoiceAlignResult;
export function choiceAlignOf(page: Page, limit?: number): Promise<ChoiceAlignResult>;
export function choiceAlignLines(r: ChoiceAlignResult, where?: string): string[];
