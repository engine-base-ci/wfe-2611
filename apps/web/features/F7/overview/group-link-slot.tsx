"use client";
// 左のメニューのグループの行の行き先（K-599 が置く・K-466 が外枠の groups に使い、K-480 が READY を true にする）。
//   概要が本物になるまで null（行は押せない形のまま）。口・状態を使わない
/** 本物にする葉（K-480）が true にした */
export const READY: boolean = true;

export function groupHref(scopeId: string): string | null {
  return READY ? `/tickets?view=overview&scope=${encodeURIComponent(scopeId)}` : null;
}
