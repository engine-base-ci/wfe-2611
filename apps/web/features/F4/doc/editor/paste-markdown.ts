// Markdown を貼ると変換する拡張（K-568・Tiptap）。クリップボードが text/plain だけ（text/html が無い）で Markdown らしいときだけ、
//   markdown.ts で文書の木にして 1 回の変更として差し込む（Ctrl／⌘+Z 1 回で貼る前に戻る）。
//   上限（深さ・大きさ）を超える・貼った後の文書が通らないなら、貼らずに onNotice を呼ぶ（書いてある文書は変えない）。
//   text/html を持つ貼り付け・Markdown らしくない文・コードの囲みの中は、Tiptap の既定の貼り付けに任せる（K-567 の掃除を通る）。貼った文は外へ送らない
import { Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { validateDoc } from "@kaname/contracts";
import { fromEditorJson, toEditorContent } from "./convert";
import { looksLikeMarkdown, markdownToDoc } from "./markdown";

export type PasteNotice = "paste-too-big";
export interface PasteMarkdownOptions {
  /** 貼れなかったとき（貼る文が大きすぎる・入れ子が深すぎる） */
  onNotice: (notice: PasteNotice) => void;
}

/** 貼れたら・断ったら true（扱った）。既定の貼り付けに任せるなら false */
function pasteMarkdown(view: EditorView, event: ClipboardEvent, onNotice: PasteMarkdownOptions["onNotice"]): boolean {
  const data = event.clipboardData;
  if (!data || data.getData("text/html") !== "") return false;
  const text = data.getData("text/plain");
  if (view.state.selection.$from.parent.type.spec.code || !looksLikeMarkdown(text)) return false;
  const result = markdownToDoc(text);
  if (!result.ok) {
    onNotice("paste-too-big");
    return true;
  }
  if (result.doc.content.length === 0) return false;
  const node = view.state.schema.nodeFromJSON(toEditorContent(result.doc));
  // 飾りの付いた 1 行だけなら、今の段落の中に続けて入れる（段を割らない）
  const only = node.childCount === 1 ? node.firstChild : null;
  const open = only?.type.name === "paragraph" ? 1 : 0;
  // 貼り付けは 1 回の変更（前に打った字とまとめない・Ctrl／⌘+Z 1 回で貼る前に戻る）
  const tr = closeHistory(view.state.tr)
    .replaceSelection(new Slice(node.content, open, open))
    .scrollIntoView()
    .setMeta("paste", true)
    .setMeta("uiEvent", "paste");
  if (!validateDoc(fromEditorJson(tr.doc.toJSON())).ok) {
    onNotice("paste-too-big");
    return true;
  }
  view.dispatch(tr);
  return true;
}

export const PasteMarkdown = Extension.create<PasteMarkdownOptions>({
  name: "kPasteMarkdown",
  // ほかの拡張の貼り付けの取り扱いより先に見る
  priority: 1000,
  addOptions() {
    return { onNotice: () => undefined };
  },
  addProseMirrorPlugins() {
    const { onNotice } = this.options;
    return [
      new Plugin({
        key: new PluginKey("kPasteMarkdown"),
        props: {
          handlePaste: (view, event) => {
            try {
              return pasteMarkdown(view, event, onNotice);
            } catch {
              // 木にできなかった貼り付けは、既定の貼り付け（字のまま）に任せる
              return false;
            }
          },
        },
      }),
    ];
  },
});
