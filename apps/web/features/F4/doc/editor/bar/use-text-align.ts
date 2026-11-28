// 寄せの道具（左寄せ・中央・右寄せ・両端）の hook（K-587）。
// 出どころ：Tiptap UI Components（https://github.com/ueberdosis/tiptap-ui-components）
//   版（コミット）：799929bea4804c73767562b69f8acc2acdb8ac86（2025-10-07）
//   元のファイルの道：apps/web/src/components/tiptap-ui/text-align-button/use-text-align.ts
// 許諾：MIT License — Copyright (c) 2025 Tiptap
//   許諾の全文はファイルの終わり（写した部分に元の著作権の表示と許諾の文を付ける）
// 改めた所：editor を引数で受ける（useTiptapEditor・アイコン・react-hotkeys-hook の呼びを外す）。
//   寄せは段落と見出しの属性だけ（K-584）なので、選びの中に段落・見出しが無い場所（コードの囲みの中）では押せない形にする判定を足した。
//   命令が在るかの型の確かめ（hasSetTextAlign）は外した（寄せの拡張は extensions.ts が必ず組む）。押されているか・押したときの命令の中身は元のまま
import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorTick } from "./use-mark-button";
import { focusNow } from "./use-block-button";

export type TextAlign = "left" | "center" | "right" | "justify";

const ALIGNABLE: readonly string[] = ["paragraph", "heading"];

/** 選びの中に、寄せを持てる段（段落・見出し）が在るか */
function hasAlignable(editor: Editor): boolean {
  const { from, to } = editor.state.selection;
  let found = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (ALIGNABLE.includes(node.type.name)) found = true;
    return !found;
  });
  return found;
}

/** いま寄せられるか */
export function canSetTextAlign(editor: Editor | null, align: TextAlign): boolean {
  if (!editor || !editor.isEditable) return false;
  if (editor.isActive("image") || editor.isActive("horizontalRule")) return false;
  if (!hasAlignable(editor)) return false;
  return editor.can().setTextAlign(align);
}

/** いまその寄せか（寄せを持たない段は、どれも押された形にしない） */
export function isTextAlignActive(editor: Editor | null, align: TextAlign): boolean {
  if (!editor || !editor.isEditable) return false;
  return editor.isActive({ textAlign: align });
}

/** 寄せる */
export function setTextAlign(editor: Editor | null, align: TextAlign): boolean {
  if (!editor || !canSetTextAlign(editor, align)) return false;
  focusNow(editor);
  return editor.chain().focus().setTextAlign(align).run();
}

export interface TextAlignState {
  canAlign: boolean;
  isActive: boolean;
  handleTextAlign: () => boolean;
}

/** 寄せの道具の状態と命令 */
export function useTextAlign(editor: Editor | null, align: TextAlign): TextAlignState {
  useEditorTick(editor);
  const handleTextAlign = useCallback(() => setTextAlign(editor, align), [editor, align]);
  return { canAlign: canSetTextAlign(editor, align), isActive: isTextAlignActive(editor, align), handleTextAlign };
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
