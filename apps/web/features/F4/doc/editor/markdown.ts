// 貼った Markdown を文書の木（K-561 を K-584 が広げた Doc）へ写す（K-568）。画面を使わない（DOM は要らない）。
//   解析は前から入っている remark（unified＋remark-parse＋remark-gfm＋remark-cjk-friendly）で木（mdast）を作るところまで。描かない。
//   写しは自前：# → 見出し 1（level 2）・## → 見出し 2（level 3）・### 以降 → 見出し 3（level 4）／並び（チェックの箱・番号つきの始まり）／表（揃えの印は捨てる）／
//     太字・斜体・取り消し線・行の中のコード／区切りの線／コードの段（言語名は捨てる）／引用／許されたリンク（それ以外は字だけ）／画像は代わりの字／生の HTML は字のまま。
//   置けない場所の節は置ける所に寄せる（1 つの規則）：引用・チェックの項目・表のセルの中は段落だけ／並びの項目の中は段落と並びだけ。置けない場所の区切りの線は落とす。
//   上限（深さ DOC_MAX_DEPTH・大きさ DOC_MAX_BYTES）を超えたら理由つきで断る（投げない）。結果は必ず validateDoc を通る
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { DOC_MAX_BYTES, DOC_MAX_DEPTH, DOC_START_MAX, validateDoc, type Doc } from "@kaname/contracts";
import { MARK_ORDER } from "./convert";
import { normalizeHref } from "./link-policy";

export type MarkdownResult = { ok: true; doc: Doc } | { ok: false; reason: "too_deep" | "too_big" };

/** mdast の節（使う鍵だけ。型の部品 @types/mdast は足さない） */
interface Md {
  type: string;
  children?: Md[];
  value?: string;
  depth?: number;
  ordered?: boolean | null;
  start?: number | null;
  checked?: boolean | null;
  url?: string;
  alt?: string | null;
}
type Mark = { type: string; attrs?: Record<string, unknown> };
type Inline = { type: "text"; text: string; marks?: Mark[] } | { type: "hardBreak" };
type Block = { type: string; attrs?: Record<string, unknown>; content?: (Block | Inline)[] };
type Para = Block & { type: "paragraph" };

/** Markdown の木がこれより深ければ、写さずに「深すぎ」で断る（再帰を止める） */
const MD_DEPTH_GUARD = DOC_MAX_DEPTH * 4;
const NUL = String.fromCharCode(0);
class TooDeep extends Error {}

// ---------------------------------------------------------------- Markdown らしさの見分け
const MD_SIGNS: readonly RegExp[] = [
  /^ {0,3}#{1,6}[ \t]+\S/m, // # 見出し
  /^ {0,3}[-*+][ \t]+\S/m, // - 並び（- [ ] も）
  /^ {0,3}\d{1,9}[.)][ \t]+\S/m, // 1. 番号つき
  /^ {0,3}> ?\S/m, // > 引用
  /^ {0,3}```/m, // ``` コードの段
  /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)+\|?[ \t]*$/m, // 表の区切りの行
  /\*\*[^\s*](?:[^*\n]*[^\s*])?\*\*/, // **太字**
  /~~[^\s~](?:[^~\n]*[^\s~])?~~/, // ~~消す~~
  /\[[^\]\n]+\]\([^)\s]+\)/, // [字](…)
];

/** 貼った字が Markdown らしいか（「a * b = c」「100 円 - 税込」「a_b@example.com」は違う） */
export function looksLikeMarkdown(text: string): boolean {
  return MD_SIGNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------- 行の中（字・印）
const sortMarks = (marks: readonly Mark[]): Mark[] =>
  MARK_ORDER.flatMap((t) => {
    const m = marks.find((x) => x.type === t);
    return m ? [m] : [];
  });
const sameMarks = (a?: Mark[], b?: Mark[]): boolean => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

function pushText(out: Inline[], raw: string, marks: readonly Mark[]): void {
  // 行の中の改行（Markdown の行の折り返し）は、貼った行のまま改行にする
  raw
    .split(NUL)
    .join("")
    .split("\n")
    .forEach((line, i) => {
      if (i > 0) out.push({ type: "hardBreak" });
      if (line === "") return;
      const sorted = sortMarks(marks);
      const last = out[out.length - 1];
      if (last && last.type === "text" && sameMarks(last.marks, sorted)) {
        out[out.length - 1] = { ...last, text: last.text + line };
        return;
      }
      out.push(sorted.length ? { type: "text", text: line, marks: sorted } : { type: "text", text: line });
    });
}

function inline(nodes: readonly Md[] | undefined, marks: readonly Mark[], out: Inline[], depth: number): Inline[] {
  if (depth > MD_DEPTH_GUARD) throw new TooDeep();
  const add = (type: string): Mark[] => (marks.some((m) => m.type === type) ? [...marks] : [...marks, { type }]);
  for (const n of nodes ?? []) {
    switch (n.type) {
      case "text":
      case "html": // 生の HTML は HTML として読まず字のまま
        pushText(out, n.value ?? "", marks);
        break;
      case "inlineCode": // 行の中のコードはほかの印と重ねない（編集の部品の決まりと同じ）
        pushText(out, (n.value ?? "").split("\n").join(" "), [{ type: "code" }]);
        break;
      case "break":
        out.push({ type: "hardBreak" });
        break;
      case "strong":
        inline(n.children, add("bold"), out, depth + 1);
        break;
      case "emphasis":
        inline(n.children, add("italic"), out, depth + 1);
        break;
      case "delete":
        inline(n.children, add("strike"), out, depth + 1);
        break;
      case "link": {
        const href = normalizeHref(n.url ?? "");
        const next = href ? [...marks.filter((m) => m.type !== "link"), { type: "link", attrs: { href } }] : marks;
        inline(n.children, next, out, depth + 1);
        break;
      }
      case "image":
      case "imageReference": // 画像は代わりの字（画像の置き場にはしない）
        pushText(out, n.alt ?? "", marks);
        break;
      default:
        if (n.children) inline(n.children, marks, out, depth + 1);
        else if (typeof n.value === "string") pushText(out, n.value, marks);
    }
  }
  return out;
}

const para = (content: Inline[]): Para => (content.length ? { type: "paragraph", content } : { type: "paragraph" });
const plainPara = (text: string): Para => para(inline([{ type: "text", value: text }], [], [], 0));
const hasText = (p: Para): boolean => (p.content?.length ?? 0) > 0;
const atLeastOne = (paras: Para[]): Para[] => (paras.length ? paras : [{ type: "paragraph" }]);

// ---------------------------------------------------------------- 置けない場所の節を段落に寄せる
/** 節を、字を保った段落の並びにする（並びは 1 項目ごと・コードは 1 行ごと・表は 1 行ごと。区切りの線は落とす） */
function flatten(n: Md, depth: number): Para[] {
  if (depth > MD_DEPTH_GUARD) throw new TooDeep();
  switch (n.type) {
    case "paragraph":
    case "heading":
      return [para(inline(n.children, [], [], depth + 1))].filter(hasText);
    case "code":
    case "html":
      return (n.value ?? "")
        .split("\n")
        .filter((l) => l.trim() !== "")
        .map(plainPara);
    case "thematicBreak":
    case "definition":
      return [];
    case "table":
      return (n.children ?? []).map((row) => {
        const out: Inline[] = [];
        (row.children ?? []).forEach((cell, i) => {
          if (i > 0) pushText(out, " | ", []);
          inline(cell.children, [], out, depth + 1);
        });
        return para(out);
      });
    default:
      return (n.children ?? []).flatMap((c) => flatten(c, depth + 1));
  }
}

// ---------------------------------------------------------------- 段（節）
function headingLevel(depth: number | undefined): 2 | 3 | 4 {
  if (depth === 1) return 2;
  return depth === 2 ? 3 : 4;
}

function table(n: Md, depth: number): Block {
  const rows = n.children ?? [];
  const width = rows[0]?.children?.length ?? 0;
  return {
    type: "table",
    content: rows.map((row, r) => ({
      type: "tableRow",
      // 列の数は見出しの行にそろえる（足りないセルは空・余るセルは捨てる＝GFM と同じ）
      content: Array.from({ length: width }, (_, c) => ({
        type: r === 0 ? "tableHeader" : "tableCell",
        content: [para(inline(row.children?.[c]?.children, [], [], depth + 1))],
      })),
    })),
  };
}

/** 並びの項目の中：段落と並びはそのまま・ほかは段落に寄せる */
function listItemContent(item: Md, depth: number): Block[] {
  const out: Block[] = (item.children ?? []).flatMap((c): Block[] => {
    if (c.type === "list") return list(c, depth + 1);
    if (c.type === "paragraph") return [para(inline(c.children, [], [], depth + 1))];
    return flatten(c, depth + 1);
  });
  return out.length ? out : [{ type: "paragraph" }];
}

/** 並び：チェックの箱の続き（checked が真偽）はチェックの並び・ほかは箇条書き／番号つき。混ざっていたら続きごとに分ける */
function list(n: Md, depth: number): Block[] {
  if (depth > MD_DEPTH_GUARD) throw new TooDeep();
  const out: Block[] = [];
  const items = n.children ?? [];
  const first = typeof n.start === "number" ? n.start : 1;
  items.forEach((item, i) => {
    const isTask = typeof item.checked === "boolean";
    const type = isTask ? "taskList" : n.ordered ? "orderedList" : "bulletList";
    const node: Block = isTask
      ? {
          type: "taskItem",
          attrs: { checked: item.checked === true },
          content: atLeastOne((item.children ?? []).flatMap((c) => flatten(c, depth + 1))),
        }
      : { type: "listItem", content: listItemContent(item, depth) };
    const last = out[out.length - 1];
    if (last && last.type === type) {
      out[out.length - 1] = { ...last, content: [...(last.content ?? []), node] };
      return;
    }
    const start = first + i;
    const numbered = type === "orderedList" && Number.isInteger(start) && start >= 2 && start <= DOC_START_MAX;
    out.push(numbered ? { type, attrs: { start }, content: [node] } : { type, content: [node] });
  });
  return out;
}

/** 文書の直下の節 */
function block(n: Md, depth: number): Block[] {
  if (depth > MD_DEPTH_GUARD) throw new TooDeep();
  switch (n.type) {
    case "paragraph":
      return [para(inline(n.children, [], [], depth + 1))];
    case "heading":
      return [
        { type: "heading", attrs: { level: headingLevel(n.depth) }, content: inline(n.children, [], [], depth + 1) },
      ].map((h) => (h.content.length ? h : { type: h.type, attrs: h.attrs }));
    case "thematicBreak":
      return [{ type: "horizontalRule" }];
    case "code": {
      const text = (n.value ?? "").split(NUL).join("");
      return [text === "" ? { type: "codeBlock" } : { type: "codeBlock", content: [{ type: "text", text }] }];
    }
    case "blockquote":
      return [{ type: "blockquote", content: atLeastOne((n.children ?? []).flatMap((c) => flatten(c, depth + 1))) }];
    case "list":
      return list(n, depth);
    case "table":
      return [table(n, depth)];
    case "html":
      return flatten(n, depth);
    case "definition":
      return [];
    default:
      return n.children ? n.children.flatMap((c) => block(c, depth + 1)) : flatten(n, depth);
  }
}

// ---------------------------------------------------------------- 上限
const bytesOf = (s: string): number => new TextEncoder().encode(s).length;
function depthOf(n: Block | Inline, depth = 0): number {
  const kids = "content" in n && Array.isArray(n.content) ? n.content : [];
  return kids.reduce(
    (max, c) => (c.type === "text" || c.type === "hardBreak" ? max : Math.max(max, depthOf(c, depth + 1))),
    depth,
  );
}

/** 貼った Markdown を文書の木にする。上限を超えたら理由つきで断る（投げない） */
export function markdownToDoc(text: string): MarkdownResult {
  const source = text.split("\r\n").join("\n").split("\r").join("\n");
  // 貼る字そのものが文書の上限より大きければ、解析しないで断る（画面を固めない）
  if (bytesOf(source) > DOC_MAX_BYTES) return { ok: false, reason: "too_big" };
  // 写せなかったとき（ここには来ない作り）は、印を付けずに行ごとの段落にする
  const lines = (): Block[] =>
    source
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map(plainPara);
  let content: Block[];
  try {
    const tree = unified().use(remarkParse).use(remarkGfm).use(remarkCjkFriendly).parse(source) as unknown as Md;
    content = (tree.children ?? []).flatMap((c) => block(c, 1));
  } catch (e) {
    if (e instanceof TooDeep || e instanceof RangeError) return { ok: false, reason: "too_deep" };
    content = lines();
  }
  const check = (c: Block[]): MarkdownResult | null => {
    const doc = { type: "doc", content: c } as unknown as Doc;
    if (bytesOf(JSON.stringify(doc)) > DOC_MAX_BYTES) return { ok: false, reason: "too_big" };
    if (depthOf({ type: "doc", content: c }) > DOC_MAX_DEPTH) return { ok: false, reason: "too_deep" };
    return validateDoc(doc).ok ? { ok: true, doc } : null;
  };
  return check(content) ?? check(lines()) ?? { ok: false, reason: "too_big" };
}
