// 並びの道具（箇条書き・番号つき・チェックのメニュー）の hook（K-587）。
// 出どころ：Tiptap UI Components（https://github.com/ueberdosis/tiptap-ui-components）
//   版（コミット）：799929bea4804c73767562b69f8acc2acdb8ac86（2025-10-07）
//   元のファイルの道：apps/web/src/components/tiptap-ui/list-button/use-list.ts
//                   apps/web/src/components/tiptap-ui/list-dropdown-menu/use-list-dropdown-menu.ts
// 許諾：MIT License — Copyright (c) 2025 Tiptap
//   許諾の全文はファイルの終わり（写した部分に元の著作権の表示と許諾の文を付ける）
// 改めた所：editor を引数で受ける（useTiptapEditor・アイコン・react-hotkeys-hook の呼びを外す）。元の「今の段を丸ごと選んで clearNodes で作り替える」道
//   （turnInto）は使わない。置ける場所は K-584 と同じ：引用・表のセルの中には置けない／並びの中では「並びの種類の付け替え」になる。
//   種類の付け替えは並びを丸ごと替える自前の 1 手（チェックの項目 ⇔ 並びの項目は節が違い、Tiptap の付け替えは 1 項目だけを外へ出すため）。
//   キーボードで選んだときは焦点を道具に残せるよう、命令に keepFocus を足した（マウスのときは命令の前に焦点を編集欄へその場で移す）
import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import { useEditorTick } from "./use-mark-button";
import { atDocTop, focusNow, insideAny } from "./use-block-button";

export const LIST_TYPES = ["bulletList", "orderedList", "taskList"] as const;
export type ListType = (typeof LIST_TYPES)[number];

const ITEM: Record<ListType, "listItem" | "taskItem"> = {
  bulletList: "listItem",
  orderedList: "listItem",
  taskList: "taskItem",
};
/** 中に並びを置けない節（K-584：中は段落だけ） */
const NO_LIST_INSIDE: readonly string[] = ["blockquote", "tableCell", "tableHeader"];
const isListType = (name: string): name is ListType => (LIST_TYPES as readonly string[]).includes(name);

interface ListAt {
  pos: number;
  node: PMNode;
  type: ListType;
}

/** カーソルのいちばん内側の並び（無ければ null） */
function parentList(editor: Editor): ListAt | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d -= 1) {
    const node = $from.node(d);
    const name = node.type.name;
    if (isListType(name)) return { pos: $from.before(d), node, type: name };
  }
  return null;
}

/** 並びを丸ごと別の種類に替えられるか（項目の中身が、替えた先の項目に置ける形か。入れ子の並びを持つ項目はチェックにできない） */
function convertible(editor: Editor, at: ListAt, type: ListType): boolean {
  const itemType = editor.schema.nodes[ITEM[type]];
  if (!itemType) return false;
  let ok = true;
  at.node.forEach((item) => {
    if (!itemType.validContent(item.content)) ok = false;
  });
  return ok;
}

/** 並びを丸ごと別の種類に替える（項目の中身はそのまま・カーソルは同じ位置） */
function convertList(editor: Editor, tr: Transaction, at: ListAt, type: ListType): boolean {
  const listType = editor.schema.nodes[type];
  const itemType = editor.schema.nodes[ITEM[type]];
  if (!listType || !itemType) return false;
  const items: PMNode[] = [];
  at.node.forEach((item) => items.push(itemType.create(null, item.content)));
  const { anchor, head } = tr.selection;
  const text = tr.selection instanceof TextSelection;
  tr.replaceWith(at.pos, at.pos + at.node.nodeSize, listType.create(null, items));
  // 並びと項目の大きさは替える前と同じなので、位置はそのまま使える
  if (text) tr.setSelection(TextSelection.create(tr.doc, anchor, head));
  return true;
}

const usable = (editor: Editor | null, type: ListType): editor is Editor =>
  !!editor && editor.isEditable && !!editor.schema.nodes[type] && !editor.isActive("image");

/** いまその並びにできる・外せるか（置けない場所では偽） */
export function canToggleList(editor: Editor | null, type: ListType): boolean {
  if (!usable(editor, type)) return false;
  const at = parentList(editor);
  if (at) return at.type === type || convertible(editor, at, type);
  if (insideAny(editor, NO_LIST_INSIDE) || !atDocTop(editor)) return false;
  const block = editor.state.selection.$from.parent.type.name;
  // 見出しは段落に直してから並びにする（Tiptap の toggleList の動き）。コードの囲みは並びにしない
  if (block === "heading") return true;
  return block === "paragraph" && editor.can().toggleList(type, ITEM[type]);
}

/** いまの並びの種類（並びの中でなければ null） */
export function activeListType(editor: Editor | null): ListType | null {
  if (!editor || !editor.isEditable) return null;
  return parentList(editor)?.type ?? null;
}

/** 並びにする・同じ種類なら外す・別の種類なら並びの種類を替える */
export function toggleList(editor: Editor | null, type: ListType, keepFocus = false): boolean {
  if (!editor || !canToggleList(editor, type)) return false;
  if (!keepFocus) focusNow(editor);
  const chain = keepFocus ? editor.chain() : editor.chain().focus();
  const at = parentList(editor);
  if (!at) return chain.toggleList(type, ITEM[type]).run();
  if (at.type === type) return chain.liftListItem(ITEM[type]).run();
  return chain.command(({ tr, dispatch }) => (dispatch ? convertList(editor, tr, at, type) : true)).run();
}

export interface ListState {
  /** いまの並びの種類（並びの中でなければ null） */
  type: ListType | null;
  canToggle: (type: ListType) => boolean;
  handleList: (type: ListType, keepFocus?: boolean) => boolean;
}

/** 並びのメニューの状態と命令 */
export function useList(editor: Editor | null): ListState {
  useEditorTick(editor);
  const canToggle = useCallback((type: ListType) => canToggleList(editor, type), [editor]);
  const handleList = useCallback((type: ListType, keepFocus = false) => toggleList(editor, type, keepFocus), [editor]);
  return { type: activeListType(editor), canToggle, handleList };
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
