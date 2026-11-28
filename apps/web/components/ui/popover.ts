"use client";
// 押したボタンから開く小さな箱（メニュー・選ぶ箱）を、いちばん上の層に出す（2026-10-01 user「パネルの中に入っている」）。
// 由来：会話の一覧の「…」の箱が、一覧の枠（スクロールする箱）に切られて半分しか見えなかった。
//   箱を親の中に absolute で置くと、親が overflow を持つ限り必ず切られる。どの画面のどの箱もこの 1 つで出す（L-008）。
// 仕組み：ブラウザの popover（top layer）に載せ、位置は基準の要素から fixed で決める。下（上）に入らなければ反対側へ出し、
//   画面の端から 8px 内に収める。DOM の位置は元のままなので、Tab の順・外を押したら閉じる判定（closest）はそのまま効く。
import { useCallback, type RefObject } from "react";

export interface AnchorOptions {
  /** 基準の要素の下に出すか、上に出すか（入らなければ反対側） */
  side: "below" | "above";
  /** 基準の要素の左端にそろえるか、右端にそろえるか */
  align: "start" | "end";
  /** 揃える端から内側へずらす量（px） */
  inset?: number;
  /** 基準の要素との隙間（px） */
  gap?: number;
}

const EDGE = 8;

function place(el: HTMLElement, anchor: HTMLElement, o: AnchorOptions): void {
  const a = anchor.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const gap = o.gap ?? 4;
  const inset = o.inset ?? 0;
  const below = a.bottom + gap;
  const above = a.top - gap - h;
  const fitsBelow = below + h <= window.innerHeight - EDGE;
  const fitsAbove = above >= EDGE;
  const top = o.side === "below" ? (fitsBelow || !fitsAbove ? below : above) : fitsAbove || !fitsBelow ? above : below;
  const left = o.align === "end" ? a.right - inset - w : a.left + inset;
  el.style.inset = "auto";
  el.style.top = `${Math.max(EDGE, Math.min(top, window.innerHeight - EDGE - h))}px`;
  el.style.left = `${Math.max(EDGE, Math.min(left, window.innerWidth - EDGE - w))}px`;
}

/** 箱の ref に渡す。箱が出ている間だけ top layer に載せ、スクロール・大きさの変化で位置を直す */
export function useAnchoredPopover(anchor: RefObject<HTMLElement | null>, o: AnchorOptions) {
  const { side, align, inset, gap } = o;
  return useCallback(
    (el: HTMLElement | null) => {
      const a = anchor.current;
      if (!el || !a) return;
      const opts = { side, align, inset, gap };
      if (typeof el.showPopover === "function") {
        el.setAttribute("popover", "manual");
        el.showPopover();
      }
      const fix = () => place(el, a, opts);
      fix();
      window.addEventListener("resize", fix);
      window.addEventListener("scroll", fix, true);
      const ro = new ResizeObserver(fix);
      ro.observe(el);
      ro.observe(a);
      return () => {
        window.removeEventListener("resize", fix);
        window.removeEventListener("scroll", fix, true);
        ro.disconnect();
      };
    },
    [anchor, side, align, inset, gap],
  );
}
