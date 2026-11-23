// 本文の読む形（K-577）の印と行の中の描き。編集の部品（Tiptap・ProseMirror）を読まない。
//   印：bold＝b・italic＝i・underline＝u・strike＝s・code＝code・superscript＝sup・subscript＝sub・
//     文字の色＝前の 3 つの名前は span[data-c]（正本のトークン）、#rrggbb は span[data-k-ink]・背景の色＝属性の無い物は mark、#rrggbb は span[data-k-bg]・
//     link＝許された href（link-policy）のときだけ a（target _blank・rel noopener noreferrer）。許されない href・形に合わない色は印を付けずに字だけ出す。
//   利用者の色は style 属性で当てない（PM の決め・class_gate）。読む形の頭に、確かめた #rrggbb だけを並べた <style> を 1 つ置き、data-k-ink／data-k-bg で当てる
import type { ReactNode } from "react";
import { DOC_COLORS, DOC_HEX_COLOR } from "@kaname/contracts";
import { isAllowedHref } from "./link-policy";

export type ViewMark = { type: string; attrs?: Record<string, unknown> };
export type ViewInline = { type: string; text?: string; marks?: ViewMark[] };

/** 文字の色の前の名前（正本のトークンで描く） */
const isNamed = (c: unknown): c is string => typeof c === "string" && (DOC_COLORS as readonly string[]).includes(c);
/** 決まった形の #rrggbb だけ（大文字・3 桁・rgb()・名前・url()・空は通さない） */
export const isHex = (c: unknown): c is string => typeof c === "string" && DOC_HEX_COLOR.test(c);

const SIMPLE: Record<string, (k: string, c: ReactNode) => ReactNode> = {
  bold: (k, c) => <b key={k}>{c}</b>,
  italic: (k, c) => <i key={k}>{c}</i>,
  underline: (k, c) => <u key={k}>{c}</u>,
  strike: (k, c) => <s key={k}>{c}</s>,
  code: (k, c) => <code key={k}>{c}</code>,
  superscript: (k, c) => <sup key={k}>{c}</sup>,
  subscript: (k, c) => <sub key={k}>{c}</sub>,
};

function wrap(m: ViewMark, k: string, c: ReactNode): ReactNode {
  const simple = SIMPLE[m.type];
  if (simple) return simple(k, c);
  const color = m.attrs?.["color"];
  if (m.type === "color") {
    if (isNamed(color))
      return (
        <span key={k} data-c={color}>
          {c}
        </span>
      );
    if (isHex(color))
      return (
        <span key={k} data-k-ink={color}>
          {c}
        </span>
      );
    return c;
  }
  if (m.type === "highlight") {
    if (color === undefined) return <mark key={k}>{c}</mark>;
    if (isHex(color))
      return (
        <span key={k} data-k-bg={color}>
          {c}
        </span>
      );
    return c;
  }
  if (m.type === "link") {
    const href = m.attrs?.["href"];
    if (typeof href === "string" && isAllowedHref(href))
      return (
        <a key={k} href={href.trim()} target="_blank" rel="noopener noreferrer">
          {c}
        </a>
      );
    return c;
  }
  return c;
}

/** 行の中の節（字と改行）を描く。印のある字は、外れた印しか無くても span で包む（字を 1 つの要素にまとめる） */
export function renderInline(nodes: readonly ViewInline[] | undefined, key: string): ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    const k = `${key}.${i}`;
    if (n.type === "hardBreak") return <br key={k} />;
    const text = typeof n.text === "string" ? n.text : "";
    const marks = n.marks ?? [];
    if (!marks.length) return text;
    const inner = marks.reduceRight<ReactNode>((c, m, j) => wrap(m, `${k}m${j}`, c), text);
    return <span key={k}>{inner}</span>;
  });
}

/** 文書に出てくる #rrggbb の文字の色と背景の色を集める（確かめた値だけ） */
export function collectColors(node: unknown, out = { ink: new Set<string>(), bg: new Set<string>() }) {
  const n = node as { content?: unknown[]; marks?: ViewMark[] } | null;
  for (const m of n?.marks ?? []) {
    const c = m.attrs?.["color"];
    if (m.type === "color" && isHex(c)) out.ink.add(c);
    if (m.type === "highlight" && isHex(c)) out.bg.add(c);
  }
  for (const c of n?.content ?? []) collectColors(c, out);
  return out;
}

/** 確かめた #rrggbb だけで組む色の決まり（値は DOC_HEX_COLOR に完全一致した物だけなので、ほかの字は入らない） */
export function colorRules(colors: { ink: Set<string>; bg: Set<string> }): string {
  const ink = [...colors.ink].map((c) => `.k-f4d-read [data-k-ink="${c}"]{color:${c}}`);
  const bg = [...colors.bg].map((c) => `.k-f4d-read [data-k-bg="${c}"]{background-color:${c}}`);
  return [...ink, ...bg].join("");
}
