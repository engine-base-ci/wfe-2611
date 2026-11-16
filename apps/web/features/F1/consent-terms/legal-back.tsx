"use client";
// 文面のページの頭の「← 戻る」（キャンバス LegalPage・K-232）。
//   前の画面へ戻る。前が無いときはログインへ（決める人の答え・D-146.7）。
//   「前の画面」は同じ origin の画面だけに数える：referrer が外の origin（メール・検索など）なら、このタブに履歴があっても戻らずログインへ（K232-UI-017）
import Link from "next/link";
import type { Route } from "next";
import type { MouseEvent } from "react";

const LOGIN_HREF = "/login" as Route;

/** このタブに同じ origin の前の画面があるか */
function hasSameOriginPrevious(): boolean {
  if (window.history.length <= 1 || !document.referrer) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function LegalBack() {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // 修飾キーつき（新しいタブで開く など）はブラウザに任せる
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (!hasSameOriginPrevious()) return;
    e.preventDefault();
    window.history.back();
  };
  return (
    <Link href={LOGIN_HREF} className="k-auth-back" onClick={onClick}>
      ← 戻る
    </Link>
  );
}
