"use client";
// 続けて裁くのキー（K-752）：J 次・K 前・A 承認・R 差し戻す・E 自分で直す・S 飛ばす・Esc 閉じる。
//   焦点が入力欄の中・続けて裁くの外の小窓（確かめ・差し戻す・止める・大きく見る）の中のときは効かない。
//   押しっぱなしの繰り返し（repeat）・修飾キーつき・字を変換している間は数えない（1 回押した分だけ動く）
import { useEffect, useRef } from "react";

/** 続けて裁くの層に付ける印（この層の中の焦点はキーを受ける） */
export const FOCUS_LAYER_ATTR = "data-k752-layer";

export interface FocusKeyHandlers {
  next: () => void;
  prev: () => void;
  approve: () => void;
  ret: () => void;
  edit: () => void;
  skip: () => void;
  close: () => void;
}

const KEYMAP: Readonly<Record<string, keyof FocusKeyHandlers>> = {
  j: "next",
  k: "prev",
  a: "approve",
  r: "ret",
  e: "edit",
  s: "skip",
  escape: "close",
};

const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const DIALOG = '[role="dialog"], [role="alertdialog"]';

function ignored(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(TYPING)) return true;
  const dialog = target.closest(DIALOG);
  // 閉じかけの小窓（やめるを押した直後・焦点が層に戻る前）の中のキーは層のキーとして受ける（K752-UI-004：押した直後の A が消えていた）
  if (dialog?.matches("[data-closed], [data-ending-style]")) return false;
  return dialog !== null && !dialog.hasAttribute(FOCUS_LAYER_ATTR);
}

/** enabled が偽の間（小窓を開いている・答えを待っている）は何もしない */
export function useFocusKeys(handlers: FocusKeyHandlers, enabled: boolean): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (ignored(e.target)) return;
      const name = KEYMAP[e.key.toLowerCase()];
      if (!name) return;
      e.preventDefault();
      ref.current[name]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
