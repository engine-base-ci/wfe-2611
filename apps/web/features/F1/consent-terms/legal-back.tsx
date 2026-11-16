"use client";
// 文面のページの頭の「← 戻る」（キャンバス LegalPage・K-232）。
//   前の画面へ戻る。前が無いときはログインへ（決める人の答え・D-146.7）。
//   「前の画面」は、このタブのこの履歴の項目の前に在る同じ origin の画面だけに数える。
//   最初に描いたとき前が無ければ、その履歴の項目に印を付ける（ブラウザの戻るでこの項目に帰っても、印で前が無いと分かる。
//   新しいタブ → 戻る（/login）→ ブラウザの戻る → 戻る で、タブの先頭で history.back() を呼んで何も起きないボタンにしない）
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState, type MouseEvent } from "react";

const LOGIN_HREF = "/login" as Route;
/** 前が無い履歴の項目の印（history.state に足す。Next の内部の state は残す） */
const NO_BACK = "kLegalNoBack";

interface NavigationLike {
  canGoBack?: boolean;
}

/** このタブで、今の項目の前に戻れる項目があるか（navigation が無いブラウザは履歴の数で見る） */
function canGoBack(): boolean {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  if (nav && typeof nav.canGoBack === "boolean") return nav.canGoBack;
  return window.history.length > 1;
}

/** referrer が同じ origin か（無い・読めない・外の origin は false） */
function sameOriginReferrer(): boolean {
  if (!document.referrer) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** 今の履歴の項目に「前が無い」の印が在るか */
function markedNoBack(): boolean {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && (state as Record<string, unknown>)[NO_BACK] === true;
}

export function LegalBack() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!markedNoBack() && (!canGoBack() || !sameOriginReferrer())) {
      const state: unknown = window.history.state;
      const base = typeof state === "object" && state !== null ? state : {};
      window.history.replaceState({ ...base, [NO_BACK]: true }, "");
    }
    setReady(true);
  }, []);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // 修飾キーつき（新しいタブで開く など）はブラウザに任せる
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (markedNoBack() || !canGoBack()) return; // /login へ（リンクのまま）
    e.preventDefault();
    window.history.back();
  };
  return (
    <Link href={LOGIN_HREF} className="k-auth-back" onClick={onClick} data-ready={ready ? "" : undefined}>
      ← 戻る
    </Link>
  );
}
