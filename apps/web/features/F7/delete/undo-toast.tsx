"use client";
// 消した直後の小さなお知らせ「元に戻す」（F7・段 8・A116・D-128.84・D-151.16）。5 秒（段 9 の作法・前からの Toaster の置き場に出す）。
//   前からの useNotify は ボタンを持てないので、ここで sonner の action を使う（まとめ役に頼むこと：useNotify に action を受ける口を足す。足したらここを置き換える）。
//   元に戻すのは出ている間だけ。間に合わなかった人は 記録 › 消した（F10・後）から戻す。口は restoreTicket（K-489）
import { useEffect } from "react";
import { toast } from "sonner";
import "./delete.css";

/** Toaster（components/k/notice.tsx）の置き場の鍵。そこで決めた値と同じにする */
const TOASTER_ID = "k";
/** お知らせが出ている長さ（段 9 と同じ 5 秒） */
const UNDO_MS = 5000;
const UNDO_LABEL = "元に戻す";

/** 「元に戻す」つきのお知らせを出す。keep＝出したままにする（モックで見せるとき）。返すのはお知らせの鍵 */
export function showUndoToast(title: string, onUndo: () => void, o: { keep?: boolean } = {}) {
  return toast(title, {
    toasterId: TOASTER_ID,
    duration: o.keep ? Infinity : UNDO_MS,
    className: "k-toast",
    classNames: { actionButton: "k-f7-undo-btn" },
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
    return () => void toast.dismiss(id);
  }, [title, onUndo, keep]);
  return null;
}
