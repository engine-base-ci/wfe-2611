// 段の道具（引用・コードの囲み・区切りの線）の hook（K-587）。置ける場所の判定（atDocTop・insideAny）と focusNow もここに置き、書式の hook が読む。
// 出どころ：Tiptap UI Components（https://github.com/ueberdosis/tiptap-ui-components）
//   版（コミット）：799929bea4804c73767562b69f8acc2acdb8ac86（2025-10-07）
//   元のファイルの道：apps/web/src/components/tiptap-ui/blockquote-button/use-blockquote.ts
//                   apps/web/src/components/tiptap-ui/code-block-button/use-code-block.ts
// 許諾：MIT License — Copyright (c) 2025 Tiptap
//   許諾の全文はファイルの終わり（写した部分に元の著作権の表示と許諾の文を付ける）
// 改めた所：2 つの hook を 1 つにまとめ、editor を引数で受ける（useTiptapEditor・アイコン・react-hotkeys-hook の呼びを外す）。
//   元の「今の段を丸ごと選んで clearNodes で作り替える」道（turnInto）は使わず、can() の道だけを使う（clearNodes は引用・並びの外へ出してしまい、
//   K-584 の置ける親と合わなくなる）。置ける場所は doc の直下だけ（K-584 の CHILDREN）。区切りの線は元に帯の道具が無いので自前の 1 行（setHorizontalRule）
import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorTick } from "./use-mark-button";

export type BlockKind = "blockquote" | "codeBlock" | "horizontalRule";

/** 選びの両端が「doc の直下の字の段（段落・見出し・コードの囲み）」の中か。見出し・区切りの線・引用・コードの囲み・新しい並びを置ける場所 */
export function atDocTop(editor: Editor): boolean {
  const { $from, $to } = editor.state.selection;
  return $from.depth === 1 && $to.depth === 1 && $from.parent.isTextblock;
}

/** 選びの始まりの祖先に、名前の節が在るか */
export function insideAny(editor: Editor, names: readonly string[]): boolean {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d -= 1) if (names.includes($from.node(d).type.name)) return true;
  return false;
}

/** 命令の前に、焦点を編集欄へその場で移す（Tiptap の focus() は次の描画まで待つので、押した直後に打った字を取りこぼす）。
 *  もう編集欄に在れば何もしない */
export function focusNow(editor: Editor): void {
  if (!editor.view.hasFocus()) editor.view.focus();
}

const usable = (editor: Editor | null, kind: BlockKind): editor is Editor =>
  !!editor && editor.isEditable && !!editor.schema.nodes[kind] && !editor.isActive("image");

/** いま押せるか（置けない場所では偽） */
export function canToggleBlock(editor: Editor | null, kind: BlockKind): boolean {
  if (!usable(editor, kind)) return false;
  if (kind === "horizontalRule") return atDocTop(editor) && editor.can().setHorizontalRule();
  if (editor.isActive(kind)) return true;
  if (!atDocTop(editor)) return false;
  return kind === "blockquote" ? editor.can().wrapIn("blockquote") : editor.can().setNode("codeBlock");
}

/** いまその段の中か（区切りの線は押された形を持たない） */
export function isBlockActive(editor: Editor | null, kind: BlockKind): boolean {
  if (!editor || !editor.isEditable || kind === "horizontalRule") return false;
  return editor.isActive(kind);
}

/** 付ける・外す（区切りの線は入れる） */
export function toggleBlock(editor: Editor | null, kind: BlockKind): boolean {
  if (!editor || !canToggleBlock(editor, kind)) return false;
  focusNow(editor);
  const chain = editor.chain().focus();
  if (kind === "horizontalRule") return chain.setHorizontalRule().run();
  if (kind === "blockquote")
    return editor.isActive("blockquote") ? chain.lift("blockquote").run() : chain.wrapIn("blockquote").run();
  return editor.isActive("codeBlock") ? chain.setNode("paragraph").run() : chain.setNode("codeBlock").run();
}

export interface BlockButtonState {
  canToggle: boolean;
  /** 押された形を持たない道具（区切りの線）は undefined */
  isActive: boolean | undefined;
  handleToggle: () => boolean;
}

/** 引用・コードの囲み・区切りの線の道具の状態と命令 */
export function useBlockButton(editor: Editor | null, kind: BlockKind): BlockButtonState {
  useEditorTick(editor);
  const handleToggle = useCallback(() => toggleBlock(editor, kind), [editor, kind]);
  return {
    canToggle: canToggleBlock(editor, kind),
    isActive: kind === "horizontalRule" ? undefined : isBlockActive(editor, kind),
    handleToggle,
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
