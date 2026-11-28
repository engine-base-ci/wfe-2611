"use client";
// 文字の色・背景の色の小さな画面（K-568）：よく使う色の並び・『ほかの色』（ブラウザの色の選び方）・『色を外す』。値は #rrggbb。
//   見た目は下絵 v2 の f4v2-editor-color と同じ class（k-f4d-pop k-f4d-colors・k-f4d-swatches・k-f4d-swatchbtn・k-f4d-othercolor）。帯の下（k-f4d-barwrap の中）に出す。
//   色の見本（features/F4/doc/color-swatches.ts）は文書の中身の色で、見本の四角に SVG の塗りで描く（style で当てない・画面の CSS に書かない）。
//   Esc・画面の外を押す・色を選ぶで閉じる。キーボードで選んだ・Esc で閉じたときは焦点を押した道具に戻す。マウスで選んだときは編集欄で続けて打てる
import { useEffect, useRef, type MouseEvent } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/k";
import { BG_SWATCHES, TEXT_SWATCHES, type Swatch } from "../color-swatches";
import { isHexColor, useColorHighlight } from "./bar/use-color-highlight";
import { useTextColor } from "./bar/use-text-color";

export type ColorKind = "text" | "background";
/** 小さな画面の名前＝押した道具の名前 */
export const COLOR_TOOL: Record<ColorKind, string> = { text: "文字の色", background: "背景の色" };
const SWATCHES: Record<ColorKind, readonly Swatch[]> = { text: TEXT_SWATCHES, background: BG_SWATCHES };
/** 『ほかの色』の最初の値（まだ色の付いていない字のとき。文書の中身の色で、画面の部品の色ではない） */
const OTHER_START: Record<ColorKind, string> = { text: "#000000", background: "#ffffff" };

export interface ColorPopoverProps {
  kind: ColorKind;
  editor: Editor;
  /** 閉じる。toTool が真なら焦点を押した道具に戻す */
  onClose: (toTool: boolean) => void;
}

const byKey = (e: MouseEvent): boolean => e.detail === 0;

export function ColorPopover({ kind, editor, onClose }: ColorPopoverProps) {
  const name = COLOR_TOOL[kind];
  const text = useTextColor(editor);
  const background = useColorHighlight(editor);
  const color = kind === "text" ? text : background;
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose(true);
    };
    const onDown = (e: PointerEvent): void => {
      const t = e.target;
      if (!(t instanceof Element) || box.current?.contains(t)) return;
      // 押した道具そのものは、道具の側が開け閉めする
      if (t.closest(`button[data-tool="${name}"]`)) return;
      onClose(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [name, onClose]);

  const pick = (value: string, keepFocus: boolean): void => {
    color.setColor(value, keepFocus);
    onClose(keepFocus);
  };
  const clear = (keepFocus: boolean): void => {
    color.unsetColor(keepFocus);
    onClose(keepFocus);
  };
  // 編集の選びを崩さないよう、押し下げでは焦点を移さない（色の選び方の入力だけは、ブラウザの動きのまま）
  const keepSelection = (e: MouseEvent<HTMLDivElement>): void => {
    if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
  };

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={name}
      className="k-f4d-pop k-f4d-colors"
      data-at="start"
      onMouseDown={keepSelection}
    >
      <p className="k-f4d-pop-title">{name}</p>
      <div className="k-f4d-swatches">
        {SWATCHES[kind].map((s) => (
          <button
            key={s.name}
            type="button"
            aria-label={s.name}
            aria-pressed={s.value === color.current}
            title={s.name}
            className="k-f4d-swatchbtn"
            onClick={(e) => pick(s.value, byKey(e))}
          >
            <svg aria-hidden="true" focusable="false" className="k-f4d-swatch-fill">
              <rect width="100%" height="100%" fill={s.value} />
            </svg>
          </button>
        ))}
      </div>
      <label className="k-f4d-othercolor">
        <span>ほかの色</span>
        <input
          type="color"
          aria-label="ほかの色"
          value={color.current ?? OTHER_START[kind]}
          onChange={(e) => {
            // 選んでいる間も付けていく（焦点は色の選び方に残す）。閉じるのは Esc か外を押したとき
            const value = e.target.value.toLowerCase();
            if (isHexColor(value)) color.setColor(value, true);
          }}
        />
      </label>
      <Button variant="ghost" size="sm" onClick={(e) => clear(byKey(e))}>
        色を外す
      </Button>
    </div>
  );
}
