// 完了にする小窓（K-572）が出す未チェックの数え方。口の app.ticket_body_unchecked（K-566）と同じ定義の純粋な関数（入力を書き換えない）。
//   本文：文書の木（K-561 の Doc）を根から content の並びだけ辿り（入れ子も）、type が taskItem で attrs.checked が真偽の true でない節を未チェックと数える
//     （attrs が無い・文字の "true"・null も未チェック。段落の字の「[ ]」は数えない・content が並びでない節は 0）。
//     行の文は、その箱の直下の段落の字をつないだ物（入れ子の箱の字は含めない・hardBreak は空白 1 つ）。順は文書の出てくる順
//   確認項目：listTestSpecs（K-434）の行のうち checked が true でない物の文

type DocNode = { type?: unknown; attrs?: { checked?: unknown } | null; content?: unknown; text?: unknown };

const asNode = (v: unknown): DocNode | null => (typeof v === "object" && v !== null ? (v as DocNode) : null);
const childrenOf = (n: DocNode): unknown[] => (Array.isArray(n.content) ? n.content : []);

/** 段落の中の字（text はそのまま・hardBreak は空白 1 つ・ほかの節は中の字） */
function inlineText(node: unknown): string {
  const n = asNode(node);
  if (!n) return "";
  if (n.type === "text") return typeof n.text === "string" ? n.text : "";
  if (n.type === "hardBreak") return " ";
  return childrenOf(n).map(inlineText).join("");
}

/** 箱の行の文：直下の段落の字をつなぐ（入れ子の taskList は含めない） */
const taskText = (n: DocNode): string =>
  childrenOf(n)
    .map(asNode)
    .filter((c): c is DocNode => c !== null && c.type === "paragraph")
    .map(inlineText)
    .join(" ");

function collect(node: unknown): string[] {
  const n = asNode(node);
  if (!n) return [];
  const own = n.type === "taskItem" && n.attrs?.checked !== true ? [taskText(n)] : [];
  return [...own, ...childrenOf(n).flatMap(collect)];
}

/** 本文の未チェックの箱の文（doc が無い・形が違うなら空の並び＝前の形の口の答え） */
export function uncheckedTasks(doc: unknown): string[] {
  return collect(doc);
}

export interface SpecRow {
  title?: string | null;
  checked?: boolean | null;
}

/** 確認項目のうち、チェックの付いていない物の文 */
export function uncheckedSpecs(rows: readonly SpecRow[]): string[] {
  return rows.filter((r) => r.checked !== true).map((r) => r.title ?? "");
}
