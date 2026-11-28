// 自前：文字の色の道具の hook（K-568）。出来合いの UI（color-text-popover）は有料 plan の部品で使えないので、
//   背景の色の hook（use-color-highlight.ts）と同じ形で書いた。色は #rrggbb だけ通す（旧い名前 red・teal・amber の字は読めるが、ここからは付けない）
import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { focusNow } from "./use-block-button";
import { isHexColor, type ColorState } from "./use-color-highlight";
import { useEditorTick } from "./use-mark-button";

export function canTextColor(editor: Editor | null): editor is Editor {
  if (!editor || !editor.isEditable) return false;
  if (!editor.schema.marks["textStyle"] || editor.isActive("image")) return false;
  return editor.can().setMark("textStyle");
}

/** 選びにいま付いている文字の色 */
export function activeTextColor(editor: Editor | null): string | null {
  if (!editor || !editor.isEditable) return null;
  const color: unknown = editor.getAttributes("textStyle")["color"];
  return isHexColor(color) ? color : null;
}

export function setTextColor(editor: Editor | null, color: string, keepFocus = false): boolean {
  if (!canTextColor(editor) || !isHexColor(color)) return false;
  if (!keepFocus) focusNow(editor);
  const chain = keepFocus ? editor.chain() : editor.chain().focus();
  return chain.setColor(color).run();
}

export function removeTextColor(editor: Editor | null, keepFocus = false): boolean {
  if (!canTextColor(editor)) return false;
  if (!keepFocus) focusNow(editor);
  const chain = keepFocus ? editor.chain() : editor.chain().focus();
  return chain.unsetColor().run();
}

/** 文字の色の道具の状態と命令 */
export function useTextColor(editor: Editor | null): ColorState {
  useEditorTick(editor);
  const setColor = useCallback((color: string, keepFocus = false) => setTextColor(editor, color, keepFocus), [editor]);
  const unsetColor = useCallback((keepFocus = false) => removeTextColor(editor, keepFocus), [editor]);
  return { canSet: canTextColor(editor), current: activeTextColor(editor), setColor, unsetColor };
}
