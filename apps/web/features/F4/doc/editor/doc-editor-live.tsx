"use client";
// 本文を見たまま編集する部品の本体（K-567・Tiptap）。doc-editor.tsx が編集のときだけ遅く読む（next/dynamic）。
//   doc（K-561 を K-584 が広げた文書の木）を受けて編集させ、変えるたびに validateDoc を通った doc だけを onChange に渡す（通らなければ渡さず前のまま）。
//   日本語の変換中（composition）は渡さず、確定したときに渡す。貼った HTML は sanitize-html で掃除してから読む。
//   薄い字（ghost）の段落・見出しに打ち始めると、その節の薄い字を消して打った字だけを普通の字で残す（ghost の attr も外す）。
//   外から渡された doc が変わったときだけ中身を入れ替える（自分の onChange で戻ってきた同じ物では入れ替えない）。口は呼ばない。
//   K-568：text/plain だけの Markdown を貼ると変換する（paste-markdown.ts）。貼れなかったときは本文の箱の下に role="status" で知らせ、
//   次に何かを打つか 5 秒で消す。本文の箱の下の右に案内『Markdown を貼ると変換します』を出す。貼った HTML の中の Markdown の記号は字のまま残す
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import { TextSelection } from "@tiptap/pm/state";
import { validateDoc, type Doc } from "@kaname/contracts";
import { buildExtensions } from "./extensions";
import { fromEditorJson, toEditorContent } from "./convert";
import { sanitizePastedHtml } from "./sanitize-html";
import { DocBarLive } from "./doc-bar-live";
import { PasteMarkdown } from "./paste-markdown";
import { LinkDialog } from "./link-dialog";
import { useLinkPopover } from "./bar/use-link-popover";
import "../doc.css";
import "../extra.css";
import "./editor.css";

const MD_NOTE = "Markdown を貼ると変換します";
const PASTE_FAILED = "貼る文が大きすぎるか入れ子が深すぎるため、貼れませんでした";
/** 貼れなかった知らせを出しておく長さ */
const NOTICE_MS = 5000;

export interface DocEditorLiveProps {
  doc: Doc;
  onChange: (doc: Doc) => void;
  ariaLabel?: string;
}

/** 薄い字の節に打ち始めたら、その節の字を打った字だけにして ghost を外す。扱ったら true */
function typeIntoGhost(view: EditorView, from: number, to: number, text: string): boolean {
  const $from = view.state.doc.resolve(from);
  const node = $from.parent;
  if (!node.isTextblock || node.attrs["ghost"] !== true) return false;
  if (to > $from.end()) return false;
  const start = $from.start();
  const tr = view.state.tr
    .replaceWith(start, $from.end(), view.state.schema.text(text))
    .setNodeMarkup($from.before(), undefined, { ...node.attrs, ghost: null });
  tr.setSelection(TextSelection.create(tr.doc, start + text.length));
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** 空の文書（content が空）は、編集の部品には空の段落 1 つで渡す。段が 1 つも無いと選びが段の外（深さ 0）になり、
 *  本文に入っても帯の道具（表を入れる・太字 など）が押せない。出すときは fromEditorJson が空の段落 1 つを content の空に戻す */
function editorContent(doc: Doc): ReturnType<typeof toEditorContent> {
  return doc.content.length === 0 ? { type: "doc", content: [{ type: "paragraph" }] } : toEditorContent(doc);
}

export default function DocEditorLive({ doc, onChange, ariaLabel = "本文" }: DocEditorLiveProps) {
  const sent = useRef<string>(JSON.stringify(doc));
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkBad, setLinkBad] = useState(false);
  // 貼れなかった回数（0 は知らせなし）。続けて貼れなかったら、消すまでの時間を数え直す
  const [pasteFailed, setPasteFailed] = useState(0);
  useEffect(() => {
    if (pasteFailed === 0) return;
    const timer = window.setTimeout(() => setPasteFailed(0), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [pasteFailed]);

  const emit = useCallback((editor: Editor) => {
    if (editor.view.composing) return;
    const next = fromEditorJson(editor.getJSON());
    const key = JSON.stringify(next);
    if (key === sent.current || !validateDoc(next).ok) return;
    sent.current = key;
    changeRef.current(next);
  }, []);

  const editor = useEditor({
    extensions: [...buildExtensions(), PasteMarkdown.configure({ onNotice: () => setPasteFailed((n) => n + 1) })],
    content: editorContent(doc),
    immediatelyRender: false,
    // 部品の印の貼り付けの決まり（**a** を太字にする など）は、貼った HTML の中の字にも効いてしまう（html は Markdown と読まない・K-568）。
    //   Markdown は text/plain だけのときに paste-markdown.ts が変換するので、部品の決まりは使わない（打つときの決まりは残す）
    enablePasteRules: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        class: "k-f4d-pm",
      },
      transformPastedHTML: sanitizePastedHtml,
      handleTextInput: (view, from, to, text) => typeIntoGhost(view, from, to, text),
      handleDOMEvents: {
        compositionend: (view) => {
          // 確定の取引が終わってから渡す
          window.setTimeout(() => {
            if (editor && !view.composing) emit(editor);
          }, 0);
          return false;
        },
      },
    },
    onUpdate: ({ editor: e }) => {
      setPasteFailed(0);
      emit(e);
    },
  });

  // 外から渡された doc が変わったときだけ入れ替える
  useEffect(() => {
    if (!editor) return;
    const key = JSON.stringify(doc);
    if (key === sent.current) return;
    sent.current = key;
    editor.commands.setContent(editorContent(doc), { emitUpdate: false });
  }, [doc, editor]);

  const link = useLinkPopover(editor);
  const { refresh, setLink, removeLink } = link;
  const toggleLink = useCallback(() => {
    setLinkBad(false);
    if (!linkOpen) refresh();
    setLinkOpen((o) => !o);
  }, [linkOpen, refresh]);
  const closeLink = useCallback(() => {
    setLinkOpen(false);
    setLinkBad(false);
    document.querySelector<HTMLButtonElement>('.k-f4d-bar button[data-tool="リンク"]')?.focus();
  }, []);
  const apply = useCallback(() => {
    if (!setLink()) {
      setLinkBad(true);
      return;
    }
    setLinkOpen(false);
    setLinkBad(false);
  }, [setLink]);
  const remove = useCallback(() => {
    removeLink();
    setLinkOpen(false);
    setLinkBad(false);
  }, [removeLink]);

  return (
    <div className="k-f4d-ed2">
      <div className="k-f4d-editor" data-writing="true">
        <div className="k-f4d-barwrap">
          <DocBarLive editor={editor} onLink={toggleLink} linkOpen={linkOpen} linkActive={link.isActive} />
          {linkOpen ? (
            <LinkDialog
              url={link.url}
              error={linkBad}
              onUrl={(u) => {
                link.setUrl(u);
                setLinkBad(false);
              }}
              onApply={apply}
              onRemove={remove}
              onClose={closeLink}
            />
          ) : null}
        </div>
        <EditorContent editor={editor} className="k-f4d-doc k-f4d-big" />
        <p className="k-f4d-md-note">{MD_NOTE}</p>
        {pasteFailed > 0 ? (
          <p role="status" className="k-f4d-editnote">
            {PASTE_FAILED}
          </p>
        ) : null}
      </div>
    </div>
  );
}
