// fidelity_compare.mjs の型（K-216）。TypeScript（apps/web の試験・K-238）から読む
import type { Page } from "@playwright/test";

/** 組の値 1 つ：同じ役の要素をキャンバスと画面でそれぞれ指すセレクタと、比べる値の名前 */
export interface FidelityPair {
  name: string;
  role: string;
  canvas: string;
  app: string;
  props: string[];
}
/** 読んだ値：texts だけ字の一覧、__count は当たった（見えている）要素の数、ほかは文字。要素が無ければ null */
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
