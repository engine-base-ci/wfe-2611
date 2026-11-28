"use client";
// 会話の固定枠（D-072「会話の固定枠」・user「チャットは動いていい。周りは固定」）。
//   768 以上では、枠の高さを画面の残り（枠の上端から、枠の下に続くものと余白を引いた分）に合わせ、
//   中の吹き出しだけがスクロールする。入力欄・見出し・段の帯・右の欄は動かない。767 以下は今までどおり流れる。
//   会話を本文に出す画面はどれもこれで包む（L-008：1 部品）。右の自分のAIのパネルはもともと固定の枠なので包まない
import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

/** 固定にする幅（D-072 の 1024 を D-064.7 で 768 に：タブレットも上の帯と入力欄は動かず、吹き出しだけが動く） */
export const FRAME_MIN_WIDTH = 768;
/** 画面が低すぎるときの下限（これより低いとページごと動く） */
const FRAME_MIN_HEIGHT = 360;
/** 測るときに一時的に置く高さ（確実に溢れさせて、枠の下に続く高さを読むため） */
const PROBE = 10_000;

/** いちばん近い、縦に動く入れ物（無ければ画面そのもの＝null） */
function scroller(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
  }
  return null;
}

/** 枠の高さを「入れ物がちょうど溢れない高さ」にする。狭い画面では外す */
export function fitFrame(el: HTMLElement): void {
  if (window.innerWidth < FRAME_MIN_WIDTH) {
    el.style.removeProperty("height");
    return;
  }
  const sc = scroller(el);
  const clientH = sc ? sc.clientHeight : window.innerHeight;
  const origin = sc ? sc.getBoundingClientRect().top - sc.scrollTop : -window.scrollY;
  const top = el.getBoundingClientRect().top - origin;
  // 測り直しても読んでいる位置を動かさない：会話の下からの距離を覚えて戻す
  // （測るときに一時的に高くするので、覚えないと会話が先頭へ飛ぶ・2026-09-29 広げたときに実測）
  const chat = el.querySelector<HTMLElement>(".chat");
  const fromBottom = chat ? chat.scrollHeight - chat.scrollTop - chat.clientHeight : 0;
  el.style.height = `${PROBE}px`;
  const total = sc ? sc.scrollHeight : document.documentElement.scrollHeight;
  const after = Math.max(0, total - top - PROBE);
  el.style.height = `${Math.max(FRAME_MIN_HEIGHT, Math.floor(clientH - top - after))}px`;
  if (chat) chat.scrollTop = Math.max(0, chat.scrollHeight - chat.clientHeight - fromBottom);
}

export function ChatFrame({ children, ...rest }: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => fitFrame(el));
    };
    fitFrame(el);
    window.addEventListener("resize", run);
    // 枠の上の中身（見出し・知らせの帯）や下の中身が変わったら測り直す
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(run);
    ro?.observe(document.body);
    if (el.parentElement) ro?.observe(el.parentElement);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", run);
      ro?.disconnect();
    };
  }, []);
  return (
    <div ref={ref} data-chat-frame="" {...rest}>
      {children}
    </div>
  );
}
