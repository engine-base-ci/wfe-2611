"use client";
// 段 12 の小さな共通部品（顔の丸・PC が要る所の押せない字）。値を受け取って描くだけ
//   2026-11-23（answer=4961f0280e9a）：取引先を別の登録として持たないので、取引先の札・第 2 ナビ・鍵は外した
import type { ReactNode } from "react";
import "./clients.css";
import "./clients-page.css";

/** 頭文字の丸 */
export function Avatar({ initial, tone = "indigo" }: { initial: string; tone?: "indigo" | "teal" | "amber" | "plum" }) {
  return (
    <span className="k-f11c-av" data-tone={tone} aria-hidden="true">
      {initial}
    </span>
  );
}

/** PC がつながっていないあいだの、押せない形の字（分身の案の所） */
export function NeedPc({ children }: { children: ReactNode }) {
  return (
    <span className="k-f11c-needpc" aria-disabled="true" title="まだ使えません">
      {children}
    </span>
  );
}
