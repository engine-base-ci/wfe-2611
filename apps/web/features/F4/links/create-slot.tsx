"use client";
// 作る面の「＋ つながりを足す」の中身（K-442 が既定を置き、K-580 が押せる形に替える）。既定は在るが押せない形（まだ使えません）
import type { LinksSlotProps } from "../create-ticket/create-slot-types";

export function LinksSlotFill(props: LinksSlotProps) {
  void props; // 既定は押せない形（K-580 が value・onChange・busy・title を使う）
  return (
    <button
      type="button"
      className="k-f4d-addlink"
      aria-disabled="true"
      title="まだ使えません"
      onClick={(e) => e.preventDefault()}
    >
      ＋ つながりを足す<span className="k-f4d-hint">関連・派生元のチケットを足します</span>
    </button>
  );
}
