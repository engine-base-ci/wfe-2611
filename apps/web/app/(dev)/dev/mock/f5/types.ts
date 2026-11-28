// 段 6（F5 AI に任せて、確かめて、終える）の下絵のモックの型。1 つの id ＝ 1 つの状態
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";

export type ProductState = "PS0" | "PS2" | "PS3";
export type MockScreen = "tickets" | "approvals" | "ai-room";
export interface MockEntry {
  id: string;
  screen: MockScreen;
  /** 製品の時点（PS0 PC がまだ／PS2 使っている／PS3 PC が閉じている） */
  ps: ProductState;
  label: string;
  /** この状態を本物にする画面の葉（頭の欄 mock: と両向きで合う） */
  ticket: string;
}
export interface MockGroup {
  /** その id の状態を描く。自分の物でなければ null */
  view: (id: string, theme: Theme) => ReactNode | null;
}
