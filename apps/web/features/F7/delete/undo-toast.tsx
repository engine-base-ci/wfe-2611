"use client";
// 消した直後の小さなお知らせ「元に戻す」（F7・段 8・A116・D-128.84・D-151.16）。5 秒（段 9 の作法・前からの Toaster の置き場に出す）。
//   お知らせは components/k の notify（action つき）で出し、dismissNotify で閉じる（sonner を直に読まない・置き場の鍵と見た目は notice.tsx の 1 か所）。
//   元に戻すのは出ている間だけ。間に合わなかった人は 記録 › 消した（F10・後）から戻す。口は restoreTicket（K-489）
import { useEffect } from "react";
import { dismissNotify, notify } from "@/components/k";
/** お知らせが出ている長さ（段 9 と同じ 5 秒） */
const UNDO_MS = 5000;
const UNDO_LABEL = "元に戻す";

/** 「元に戻す」つきのお知らせを出す。keep＝出したままにする（モックで見せるとき）。返すのはお知らせの鍵 */
export function showUndoToast(title: string, onUndo: () => void, o: { keep?: boolean } = {}) {
  return notify(title, {
    duration: o.keep ? Infinity : UNDO_MS,
    action: { label: UNDO_LABEL, onClick: onUndo },
  });
}

/** 画面の葉が使う入口（useNotify と同じ形・毎回同じ関数を返す） */
export function useUndoNotify() {
  return showUndoToast;
}

export interface UndoToastProps {
  /** 「EG-128 を消しました」 */
  title: string;
  onUndo?: (() => void) | undefined;
  keep?: boolean;
}

/** 開いたときに 1 回、お知らせを出す（Toaster の中に置く）。字を出さない部品 */
export function UndoToast({ title, onUndo, keep = false }: UndoToastProps) {
  useEffect(() => {
    const id = showUndoToast(title, onUndo ?? (() => undefined), { keep });
    return () => void dismissNotify(id);
  }, [title, onUndo, keep]);
  return null;
}
