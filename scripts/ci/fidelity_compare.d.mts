// fidelity_compare.mjs の型（K-216）。TypeScript（apps/web の試験・K-238）から読む
import type { Page } from "@playwright/test";

/** 組の値 1 つ：同じ役の要素をキャンバスと画面でそれぞれ指すセレクタと、比べる値の名前 */
/** 幅が max_width 以下のとき、y をこの箱（canvas・app のセレクタ）の上端から読む。訳 why は必ず書く（K-230） */
export interface FidelityYFrom {
  max_width: number;
  canvas: string;
  app: string;
  why: string;
}
export interface FidelityPair {
  name: string;
  role: string;
  canvas: string;
  app: string;
  props: string[];
  y_from?: FidelityYFrom;
}
/** 読んだ値：texts だけ字の一覧、__count は当たった（見えている）要素の数、ほかは文字。readVals は当たる要素が無ければ {__count: 0}（比べる側は null も受ける） */
export type FidelityVals = ({ __count?: number } & Record<string, string | string[] | number>) | null;
export interface FidelityRow {
  part: string;
  prop: string;
  canvas: string | string[] | number;
  app: string | string[] | number;
  ok: boolean;
}

export const PX_TOLERANCE: number;
export const ROUND_TOLERANCE: number;
export const MISSING: string;
export function compareRows(pairs: FidelityPair[], canvasVals: FidelityVals[], appVals: FidelityVals[]): FidelityRow[];
export function compareFonts(canvasLoaded: string[], appLoaded: string[]): FidelityRow;
export function mismatches(rows: FidelityRow[]): number;
export function waitRows(side: "canvas" | "app", missing: string[]): FidelityRow[];
export class ArgError extends Error {}
export interface FidelityArgs {
  reportOnly: boolean;
  group?: string;
  width?: number;
  out?: string;
  storage?: string;
  rest: string[];
}
export function parseArgs(argv: string[]): FidelityArgs;
export function exitFor(rows: FidelityRow[], opts: { reportOnly: boolean }): 0 | 1;
export function widthsFor(group: { id: string; widths: number[] }, width: number | undefined): number[];
export function defaultOutDir(id: string, width?: number): string;
export function exitCode(rows: FidelityRow[], strict: boolean): 0 | 1;
export function readVals(page: Page, pairs: FidelityPair[], side: "canvas" | "app"): Promise<FidelityVals[]>;
export function loadedFonts(page: Page): Promise<string[]>;
export const CAPTURE_TIMEOUT: number;
export const STILL_CSS: string;
export interface CaptureOptions {
  /** 最後に撮る写しの置き場（値を読んだ後に撮る） */
  shot?: string;
  /** 待ちの上限（ミリ秒・既定 CAPTURE_TIMEOUT） */
  timeout?: number;
  /** 読み込み中の画面の組（設定の組の busy: true・K-255）：aria-busy を待たず、状態の文（role=status）が出るのを待つ */
  busy?: boolean;
}
export interface Captured {
  vals: FidelityVals[];
  fonts: string[];
}
export function capture(page: Page, pairs: FidelityPair[], side: "canvas" | "app", opts?: CaptureOptions): Promise<Captured>;
/** キャンバスの書体を手元に差し替える（外の書体の道は手元の書体・ほかの外の道は止める） */
export function routeCanvasFonts(page: Page): Promise<void>;
