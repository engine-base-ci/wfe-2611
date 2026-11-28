// 見出しの道具（見出し 1・2・3・本文のメニュー）の hook（K-587）。
// 出どころ：Tiptap UI Components（https://github.com/ueberdosis/tiptap-ui-components）
//   版（コミット）：799929bea4804c73767562b69f8acc2acdb8ac86（2025-10-07）
//   元のファイルの道：apps/web/src/components/tiptap-ui/heading-button/use-heading.ts
//                   apps/web/src/components/tiptap-ui/heading-dropdown-menu/use-heading-dropdown-menu.ts
// 許諾：MIT License — Copyright (c) 2025 Tiptap
//   許諾の全文はファイルの終わり（写した部分に元の著作権の表示と許諾の文を付ける）
// 改めた所：editor を引数で受ける（useTiptapEditor・アイコン・react-hotkeys-hook の呼びを外す）。段は 2・3・4（頁の h1 は題名）で、
//   メニューの項目は「選ぶ」（同じ段をもう一度選んでも段落に戻さない。段落に戻すのは『本文』）。元の「今の段を丸ごと選んで clearNodes で作り替える」道
//   （turnInto）は使わず can() の道だけを使い、置ける場所は doc の直下だけにした（K-584：引用・表のセル・並びの項目の中に見出しは置けない）。
//   キーボードで選んだときは焦点を道具に残せるよう、命令に keepFocus を足した（マウスのときは命令の前に焦点を編集欄へその場で移す）
import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorTick } from "./use-mark-button";
import { atDocTop, focusNow } from "./use-block-button";

export const HEADING_LEVELS = [2, 3, 4] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

const usable = (editor: Editor | null): editor is Editor =>
  !!editor && editor.isEditable && !!editor.schema.nodes["heading"] && !editor.isActive("image");

/** いまその段の見出しにできるか（置けない場所では偽） */
export function canSetHeading(editor: Editor | null, level: HeadingLevel): boolean {
  if (!usable(editor) || !atDocTop(editor)) return false;
  return editor.isActive("heading", { level }) || editor.can().setNode("heading", { level });
}

/** いまの見出しの段（見出しでなければ null） */
export function activeHeadingLevel(editor: Editor | null): HeadingLevel | null {
  if (!editor || !editor.isEditable) return null;
  return HEADING_LEVELS.find((level) => editor.isActive("heading", { level })) ?? null;
}

/** いま段落（本文）か */
export function isParagraphActive(editor: Editor | null): boolean {
  return !!editor && editor.isEditable && editor.isActive("paragraph");
}

/** 見出しにする（もうその段なら何もしない） */
export function setHeading(editor: Editor | null, level: HeadingLevel, keepFocus = false): boolean {
  if (!editor || !canSetHeading(editor, level)) return false;
  if (!keepFocus) focusNow(editor);
  const chain = keepFocus ? editor.chain() : editor.chain().focus();
  if (editor.isActive("heading", { level })) return chain.run();
  return chain.setNode("heading", { level }).run();
}

/** 本文（段落）に戻す。もう段落なら何もしない（並び・引用の中の段落を外へ出さない） */
export function setBody(editor: Editor | null, keepFocus = false): boolean {
  if (!editor || !editor.isEditable) return false;
  if (!keepFocus) focusNow(editor);
  const chain = keepFocus ? editor.chain() : editor.chain().focus();
  if (editor.isActive("paragraph") || !atDocTop(editor)) return chain.run();
  return chain.setNode("paragraph").run();
}

export interface HeadingState {
  /** いまの見出しの段（見出しでなければ null） */
  level: HeadingLevel | null;
  /** いま段落か */
  isBody: boolean;
  canSet: (level: HeadingLevel) => boolean;
  handleHeading: (level: HeadingLevel, keepFocus?: boolean) => boolean;
  handleBody: (keepFocus?: boolean) => boolean;
}

/** 見出しのメニューの状態と命令 */
export function useHeading(editor: Editor | null): HeadingState {
  useEditorTick(editor);
  const canSet = useCallback((level: HeadingLevel) => canSetHeading(editor, level), [editor]);
  const handleHeading = useCallback(
    (level: HeadingLevel, keepFocus = false) => setHeading(editor, level, keepFocus),
    [editor],
  );
  const handleBody = useCallback((keepFocus = false) => setBody(editor, keepFocus), [editor]);
  return {
    level: activeHeadingLevel(editor),
    isBody: isParagraphActive(editor),
    canSet,
    handleHeading,
    handleBody,
  };
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
