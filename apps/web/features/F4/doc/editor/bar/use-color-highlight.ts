// 背景の色の道具（ハイライト）の hook（K-568）。
// 出どころ：Tiptap UI Components（https://github.com/ueberdosis/tiptap-ui-components）
//   版（コミット）：799929bea4804c73767562b69f8acc2acdb8ac86（2025-10-07）
//   元のファイルの道：apps/web/src/components/tiptap-ui/color-highlight-button/use-color-highlight.ts
// 許諾：MIT License — Copyright (c) 2025 Tiptap
//   許諾の全文はファイルの終わり（写した部分に元の著作権の表示と許諾の文を付ける）
// 改めた所：色の並び HIGHLIGHT_COLORS（CSS 変数）を #rrggbb の並び（features/F4/doc/color-swatches.ts の BG_SWATCHES）に替えた。
//   editor を引数で受ける（useTiptapEditor・アイコン・react-hotkeys-hook・useIsMobile の呼びを外す）。色は付け外しの切り替え（toggleMark）でなく
//   いつも付ける（setHighlight({ color })）。色は #rrggbb だけ通す。キーボードで選んだときは焦点を道具に残せるよう keepFocus を足した。
//   今押せるか（canColorHighlight）・外す（removeHighlight）・覚えている印を先に外す所は元のまま
import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { DOC_HEX_COLOR } from "@kaname/contracts";
import { focusNow } from "./use-block-button";
import { useEditorTick } from "./use-mark-button";

/** 色の道具（文字の色・背景の色）が返す形 */
export interface ColorState {
  /** いま色を付けられるか（コードの囲みの中などでは偽） */
  canSet: boolean;
  /** 選びにいま付いている色（#rrggbb。無い・別の形なら null） */
  current: string | null;
  /** 色を付ける。keepFocus が真なら焦点を動かさない（キーボード・ほかの色の入力） */
  setColor: (color: string, keepFocus?: boolean) => boolean;
  /** 色を外す */
  unsetColor: (keepFocus?: boolean) => boolean;
}

export const isHexColor = (v: unknown): v is string => typeof v === "string" && DOC_HEX_COLOR.test(v);

export function canColorHighlight(editor: Editor | null): editor is Editor {
  if (!editor || !editor.isEditable) return false;
  if (!editor.schema.marks["highlight"] || editor.isActive("image")) return false;
  return editor.can().setMark("highlight");
}

/** 選びにいま付いている背景の色 */
export function activeHighlight(editor: Editor | null): string | null {
  if (!editor || !editor.isEditable) return null;
  const color: unknown = editor.getAttributes("highlight")["color"];
  return isHexColor(color) ? color : null;
}

export function setHighlight(editor: Editor | null, color: string, keepFocus = false): boolean {
  if (!canColorHighlight(editor) || !isHexColor(color)) return false;
  const type = editor.schema.marks["highlight"];
  if (editor.state.storedMarks && type) editor.view.dispatch(editor.state.tr.removeStoredMark(type));
  if (!keepFocus) focusNow(editor);
  const chain = keepFocus ? editor.chain() : editor.chain().focus();
  return chain.setHighlight({ color }).run();
}

export function removeHighlight(editor: Editor | null, keepFocus = false): boolean {
  if (!canColorHighlight(editor)) return false;
  if (!keepFocus) focusNow(editor);
  const chain = keepFocus ? editor.chain() : editor.chain().focus();
  return chain.unsetMark("highlight").run();
}

/** 背景の色の道具の状態と命令 */
export function useColorHighlight(editor: Editor | null): ColorState {
  useEditorTick(editor);
  const setColor = useCallback((color: string, keepFocus = false) => setHighlight(editor, color, keepFocus), [editor]);
  const unsetColor = useCallback((keepFocus = false) => removeHighlight(editor, keepFocus), [editor]);
  return { canSet: canColorHighlight(editor), current: activeHighlight(editor), setColor, unsetColor };
}

/*
 * MIT License
 *
 * Copyright (c) 2025 Tiptap
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
