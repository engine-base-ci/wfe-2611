"use client";
// 本文の道具の部品を、本物のまま 1 つ置く開発用の頁（K-567・試験の置き場。正の絵ではない＝正の絵は下絵 v2 の /dev/mock/f4v2）。
//   置き方は下絵 v2 の作る面（f4v2-editor-link など）と同じ枠（Frame・CreateForm の本文の欄）。部品の出す文書の木を
//   data-testid="doc-json"（JSON）・"doc-text"（docToText）・"doc-verdict"（validateDoc の結果。ok か ng:理由）に出す。
//   最初の文書は ?doc=empty|plain|full|ghost。口は呼ばない
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { docToText, emptyDoc, validateDoc, type Doc } from "@kaname/contracts";
import type { Theme } from "@/lib/theme";
import { DocEditor } from "@/features/F4/doc/editor";
import { CreateForm, SPEC_LINES } from "@/features/F4/doc/views";
import { CreateHeadFull } from "@/features/F4/doc/create-views";
import { Frame } from "../f4/frame";

/** 置き場の状態の id（K-587 が f4v2-editor-format・K-568 が f4v2-editor-more を足す） */
export const LIVE_PAGES = ["f4v2-editor-tools"] as const;
export type LivePage = (typeof LIVE_PAGES)[number];
export const isLivePage = (id: string): id is LivePage => (LIVE_PAGES as readonly string[]).includes(id);

const CRUMBS = [{ label: "チケット", href: "/tickets" }, { label: "チケットを作る" }];
const p = (text: string, marks?: unknown[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});
/** 帯の道具が作れる節・印・属性を全部含む文書（K-567 の単体試験の FULL と同じ） */
const FULL = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "目的" }] },
    { type: "heading", attrs: { level: 4, textAlign: "center" }, content: [{ type: "text", text: "小さい見出し" }] },
    { type: "heading", attrs: { level: 3, ghost: true }, content: [{ type: "text", text: "薄い見出し" }] },
    p("支払期日は 12/15", [
      { type: "bold" },
      { type: "underline" },
      { type: "color", attrs: { color: "#dc2626" } },
      { type: "highlight", attrs: { color: "#fde68a" } },
    ]),
    { type: "paragraph", attrs: { textAlign: "right" }, content: [{ type: "text", text: "右寄せ" }] },
    { type: "paragraph", attrs: { textAlign: "justify" }, content: [{ type: "text", text: "両端" }] },
    { type: "paragraph", attrs: { ghost: true }, content: [{ type: "text", text: "薄い説明" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "消す", marks: [{ type: "strike" }] },
        { type: "text", text: "code", marks: [{ type: "code" }] },
        { type: "text", text: "2", marks: [{ type: "superscript" }] },
        { type: "text", text: "i", marks: [{ type: "subscript" }] },
        { type: "text", text: "青緑", marks: [{ type: "color", attrs: { color: "teal" } }] },
        { type: "text", text: "旧", marks: [{ type: "highlight" }] },
      ],
    },
    { type: "bulletList", content: [{ type: "listItem", content: [p("明細を集める")] }] },
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        { type: "listItem", content: [p("三つ目")] },
        { type: "listItem", content: [p("四つ目")] },
      ],
    },
    {
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: true }, content: [p("送った")] },
        { type: "taskItem", attrs: { checked: false }, content: [p("控える")] },
      ],
    },
    { type: "horizontalRule" },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [{ type: "tableHeader", attrs: { colspan: 2, colwidth: [120, 80] }, content: [p("項目")] }],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [p("見出しの行の左")] },
            { type: "tableCell", attrs: { rowspan: 2 }, content: [p("保守")] },
          ],
        },
        { type: "tableRow", content: [{ type: "tableHeader", content: [p("見出しの列")] }] },
      ],
    },
    { type: "blockquote", content: [p("先月と同じ書式で")] },
    { type: "codeBlock", content: [{ type: "text", text: "a = 1\nb = 2" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "資料", marks: [{ type: "link", attrs: { href: "https://example.com/a" } }] },
        { type: "hardBreak" },
        { type: "text", text: "次の行" },
      ],
    },
    { type: "image", attrs: { caption: "先月の請求書の見本.png", attachment_id: null } },
  ],
} as unknown as Doc;
const GHOST = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2, ghost: true }, content: [{ type: "text", text: "目的" }] },
    {
      type: "paragraph",
      attrs: { ghost: true },
      content: [{ type: "text", text: "このチケットで何を実現したいかを書きます" }],
    },
    { type: "heading", attrs: { level: 2, ghost: true }, content: [{ type: "text", text: "完了の条件" }] },
    { type: "paragraph", attrs: { ghost: true }, content: [{ type: "text", text: "どうなれば終わりかを書きます" }] },
  ],
} as unknown as Doc;
const PLAIN = { type: "doc", content: [p("先月の請求書の見本を見て書式をそろえる。")] } as unknown as Doc;
const START: Record<string, () => Doc> = { empty: emptyDoc, plain: () => PLAIN, full: () => FULL, ghost: () => GHOST };

function Out({ doc }: { doc: Doc }) {
  const v = validateDoc(doc);
  return (
    <section className="k-f4d-devout" aria-label="部品の出す文書">
      <pre data-testid="doc-json">{JSON.stringify(doc)}</pre>
      <pre data-testid="doc-text">{docToText(doc)}</pre>
      <p data-testid="doc-verdict">{v.ok ? "ok" : `ng:${v.reason}`}</p>
    </section>
  );
}

export function LiveView({ id, theme }: { id: string; theme: Theme }) {
  return isLivePage(id) ? <Live id={id} theme={theme} /> : <p>この状態はまだありません</p>;
}

function Live({ id, theme }: { id: LivePage; theme: Theme }) {
  const params = useSearchParams();
  const [doc, setDoc] = useState<Doc>(() => (START[params.get("doc") ?? "empty"] ?? emptyDoc)());
  return (
    <Frame theme={theme} crumbs={CRUMBS}>
      <div className="k-root" data-live={id}>
        <CreateForm
          titleValue="セイコー商事の 11 月分の請求書を送る"
          body="free"
          specs={SPEC_LINES}
          head={<CreateHeadFull saved="下書きを自動で保存しました（10:42）" />}
          editor={<DocEditor doc={doc} onChange={setDoc} />}
        />
        <Out doc={doc} />
      </div>
    </Frame>
  );
}
