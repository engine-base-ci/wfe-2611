"use client";
// 段 12 の下絵（会社の側）の描き手。関数の名前と引数は変えない。id の頭で 3 つの描き手に振り分ける
//   mb-＝ゲストをメンバーに足す（render-cu-mb.tsx）／rq-＝届いた依頼（render-cu-rq.tsx）／tk-＝チケットの詳細：ゲストに見せる（render-cu-tk.tsx）
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import { renderMb } from "./render-cu-mb";
import { renderRq } from "./render-cu-rq";
import { renderTk } from "./render-cu-tk";

export function renderCu(id: string, theme: Theme): ReactNode | null {
  if (id.startsWith("mb-")) return renderMb(id, theme);
  if (id.startsWith("rq-")) return renderRq(id, theme);
  if (id.startsWith("tk-")) return renderTk(id, theme);
  return null;
}
