// K-568「本文の道具の残り」のうち、Markdown を貼ったときの変換（features/F4/doc/editor/markdown.ts）の単体試験。
//   行 ID は 11_tickets/K-568.md の行の表（K568-UN-001〜008）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   変換の決め（本文の道具に在る物にそのまま写す・D-150.61）：# は見出し 1（level 2）・## は見出し 2（level 3）・### 以降は見出し 3（level 4）／番号つきは番号つきの並び（始まりが 1 以外なら start）／
//     ~~ は取り消し線・インラインのコードは行の中のコード／--- は区切りの線／画像は代わりの字（alt）の段落／リンクは http・https・mailto だけ（それ以外は字だけ）／生の HTML は字のまま（HTML として読まない）。
//   結果は必ず K-561 の validateDoc を通る。実装はまだ無いので、読み込みは試験の中（動的 import）で行う
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 写した hook の頭（20 行）に出どころと MIT の表示が在る（自前で書き直した物は頭の注の行を「自前」で始める） */
const BAR_DIR = new URL("../features/F4/doc/editor/bar/", import.meta.url);
const headOf = (file: string): string => {
  const url = new URL(file, BAR_DIR);
  // まだ無いときは、読み込みの失敗（ENOENT）でなく確かめの赤にする（準備の赤と見分ける）
  expect(existsSync(url), `${file} が在る`).toBe(true);
  return readFileSync(url, "utf8").split("\n").slice(0, 20).join("\n");
};
function expectOrigin(file: string): void {
  const h = headOf(file);
  if (/^\s*(\/\/|\*)\s*自前/m.test(h)) return;
  expect(h, `${file}：写し元のリポジトリ`).toMatch(/ueberdosis\/tiptap-ui-components/);
  expect(h, `${file}：写し元の版（コミット）`).toMatch(/\b[0-9a-f]{7,40}\b/);
  expect(h, `${file}：元のファイルの道`).toMatch(/apps\/web\/src\/components\/tiptap-ui\/[\w-]+\//);
  expect(h, `${file}：MIT の表示`).toMatch(/MIT/);
  expect(h, `${file}：著作権の表示`).toMatch(/Copyright/i);
}

const MD = "../features/F4/doc/editor/markdown";
const CONTRACTS = "@kaname/contracts";

type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};
type Result = { ok: true; doc: Node } | { ok: false; reason: string };
type Md = { markdownToDoc: (t: string) => Result; looksLikeMarkdown: (t: string) => boolean };
type Contracts = { validateDoc: (d: unknown) => { ok: boolean }; docToText: (d: Node) => string };
const md = async (): Promise<Md> => (await import(/* @vite-ignore */ MD)) as Md;
const contracts = async (): Promise<Contracts> => (await import(/* @vite-ignore */ CONTRACTS)) as Contracts;

async function convert(text: string): Promise<Node> {
  const { markdownToDoc } = await md();
  const { validateDoc } = await contracts();
  const r = markdownToDoc(text);
  if (!r.ok) throw new Error(`変換できない: ${r.reason}`);
  expect(validateDoc(r.doc).ok, "validateDoc を通る").toBe(true);
  return r.doc;
}
const types = (n: Node): string[] => (n.content ?? []).map((c) => c.type);
function walk(n: Node, f: (n: Node) => void): void {
  f(n);
  (n.content ?? []).forEach((c) => walk(c, f));
}
const all = (n: Node, pred: (n: Node) => boolean): Node[] => {
  const r: Node[] = [];
  walk(n, (x) => pred(x) && r.push(x));
  return r;
};

describe("Markdown を貼ったときの変換（K-568）", () => {
  it("K568-UN-001 見出し：# は level 2（見出し 1）・## は level 3（見出し 2）・### 以降は level 4（見出し 3）。素の文字は見出しの字だけ", async () => {
    const doc = await convert("# 目的\n\n## 完了の条件\n\n### 補足\n\n#### さらに下");
    const levels = (doc.content ?? []).map((h) => h.attrs?.["level"]);
    expect(types(doc)).toEqual(["heading", "heading", "heading", "heading"]);
    expect(levels).toEqual([2, 3, 4, 4]);
    const { docToText } = await contracts();
    expect(docToText(doc)).toBe("目的\n完了の条件\n補足\nさらに下");
  });

  it("K568-UN-002 並び：- ・* ・+ の箇条書き（入れ子つき）は bulletList・- [ ] と - [x] はチェック（checked が false／true）・1. の番号つきは orderedList（始まりが 1 なら start を持たず、5. からなら start が 5）", async () => {
    const doc = await convert(
      "- 明細\n  - 入れ子\n* 星\n+ 足す\n\n- [ ] 控える\n- [x] 送った\n\n1. 一つ目\n2. 二つ目\n\n本文\n\n5. 五つ目\n6. 六つ目",
    );
    expect(all(doc, (n) => n.type === "bulletList").length).toBeGreaterThanOrEqual(3);
    const tasks = all(doc, (n) => n.type === "taskItem").map((n) => n.attrs?.["checked"]);
    expect(tasks).toEqual([false, true]);
    const ordered = all(doc, (n) => n.type === "orderedList");
    expect(ordered.length).toBe(2);
    expect(ordered[0]!.attrs?.["start"]).toBeUndefined();
    expect(ordered[1]!.attrs?.["start"]).toBe(5);
    const { docToText } = await contracts();
    const text = docToText(doc);
    for (const line of ["- 一つ目", "- 二つ目", "- 五つ目", "[x] 送った", "[ ] 控える"]) expect(text).toContain(line);
  });

  it("K568-UN-003 表：GFM の表は table。1 行目は tableHeader・次の行は tableCell・セルの字は段落の中・行の数と列の数が合う。揃えの印（:---:）は読み捨てる", async () => {
    const doc = await convert(
      "| 項目 | 数量 | 単価 |\n| :--- | :---: | ---: |\n| 保守 | 1 | 80,000 円 |\n| 追加 | 2 | 15,000 円 |",
    );
    const table = all(doc, (n) => n.type === "table")[0]!;
    expect(table.content!.length).toBe(3);
    expect(table.content![0]!.content!.map((c) => c.type)).toEqual(["tableHeader", "tableHeader", "tableHeader"]);
    expect(table.content![1]!.content!.map((c) => c.type)).toEqual(["tableCell", "tableCell", "tableCell"]);
    const { docToText } = await contracts();
    expect(docToText(doc)).toBe("項目 | 数量 | 単価\n保守 | 1 | 80,000 円\n追加 | 2 | 15,000 円");
    expect(JSON.stringify(doc)).not.toMatch(/align|:---/);
  });

  it("K568-UN-004 字の飾り：**太字**・__太字__ は bold・*斜体*・_斜体_ は italic・[字](https://…) は link・~~消す~~ は strike・インラインのコードは code。字は全部残る", async () => {
    const doc = await convert("**太字**と*斜体*と[資料](https://example.com/a)と`code`と~~消す~~");
    const marks = (text: string) =>
      all(doc, (n) => n.type === "text" && n.text === text).flatMap((n) => (n.marks ?? []).map((m) => m.type));
    expect(marks("太字")).toEqual(["bold"]);
    expect(marks("斜体")).toEqual(["italic"]);
    expect(marks("資料")).toEqual(["link"]);
    const link = all(doc, (n) => !!n.marks?.some((m) => m.type === "link"))[0]!;
    expect(link.marks![0]!.attrs).toEqual({ href: "https://example.com/a" });
    expect(marks("code")).toEqual(["code"]);
    expect(marks("消す")).toEqual(["strike"]);
    const { docToText } = await contracts();
    expect(docToText(doc)).toBe("太字と斜体と資料とcodeと消す");
  });

  it("K568-UN-005 引用・コード・区切りの線・画像：> は blockquote・``` で囲んだ所は codeBlock（中は印の無い字・改行を保つ）・--- は horizontalRule（字を出さない）・![代わりの字](…) は代わりの字の段落（image の節にしない）。置けない場所に書いた Markdown（引用・項目の中の見出し・並び・コード）は置ける所に寄せ、字は残る", async () => {
    const doc = await convert(
      "> 先月と同じ書式で\n\n```ts\na = 1\nb = 2\n```\n\n---\n\n![先月の請求書](https://example.com/x.png)",
    );
    expect(types(doc)).toEqual(["blockquote", "codeBlock", "horizontalRule", "paragraph"]);
    expect(all(doc, (n) => n.type === "image").length).toBe(0);
    expect(JSON.stringify(doc)).not.toMatch(/"language"|example\.com\/x\.png/);
    const { docToText } = await contracts();
    expect(docToText(doc)).toBe("> 先月と同じ書式で\na = 1\nb = 2\n先月の請求書");

    // 置けない場所に書いた Markdown は、断らずに置ける所へ寄せる（K-584 の置ける親：引用・チェックの項目の中は段落だけ／項目の中は段落と並びだけ）
    const LISTS = ["bulletList", "orderedList", "taskList"];
    const inner = (d: Node, holder: string) => all(d, (n) => n.type === holder).flatMap((n) => types(n));
    const quote = await convert("> ## 引用の題\n>\n> - 引用の項目\n>\n> ---\n>\n> > 入れ子の引用\n>\n> 終わり");
    expect(types(quote)).toEqual(["blockquote"]);
    expect(inner(quote, "blockquote").every((t) => t === "paragraph")).toBe(true);
    for (const w of ["引用の題", "引用の項目", "入れ子の引用", "終わり"]) expect(docToText(quote)).toContain(w);
    const task = await convert("- [ ] 箱\n  - 箱の下の項目\n- [x] 済んだ箱");
    expect(all(task, (n) => n.type === "taskItem").length).toBe(2);
    expect(inner(task, "taskItem").every((t) => t === "paragraph")).toBe(true);
    for (const w of ["箱", "箱の下の項目", "済んだ箱"]) expect(docToText(task)).toContain(w);
    const item = await convert("- 項目\n\n  ## 項目の題\n\n  ```\n  a = 1\n  ```\n\n  - 子の項目");
    expect(inner(item, "listItem").every((t) => t === "paragraph" || LISTS.includes(t))).toBe(true);
    for (const w of ["項目", "項目の題", "a = 1", "子の項目"]) expect(docToText(item)).toContain(w);
    const steps = await convert("1. 手順\n\n   手順の説明\n2. 次の手順");
    expect(types(steps)).toEqual(["orderedList"]);
    const first = all(steps, (n) => n.type === "listItem")[0]!;
    expect(types(first)).toEqual(["paragraph", "paragraph"]);
    expect(docToText(steps)).toContain("手順の説明");
  });

  it("K568-UN-006 危ない物：[字](javascript:…)・[字](data:…) は字だけ（リンクにしない）・生の <script>・<img onerror> は HTML として読まず字のまま。結果にリンクと script の節は 1 つも無い", async () => {
    const doc = await convert(
      '[悪い](javascript:alert(1)) と [これも](data:text/html,x) と <script>window.__pwned=1</script> と <img src=x onerror="y()">',
    );
    expect(all(doc, (n) => !!n.marks?.some((m) => m.type === "link")).length).toBe(0);
    expect(JSON.stringify(doc)).not.toMatch(/"href"/);
    const { docToText } = await contracts();
    const text = docToText(doc);
    expect(text).toContain("悪い");
    expect(text).toContain("これも");
    expect(text).toContain("<script>window.__pwned=1</script>");
    expect(all(doc, (n) => !["doc", "paragraph", "text", "hardBreak"].includes(n.type)).length).toBe(0);
  });

  it("K568-UN-007 Markdown らしさの見分けと上限：# ・- ・1. ・> ・``` ・表・**太字**・[字](…) があれば Markdown・普通の文章は違う／入れ子が深さの上限（12）を超える並びは変換せず too_deep・文書が 1 MB を超えるなら too_big を返す", async () => {
    const { looksLikeMarkdown, markdownToDoc } = await md();
    for (const yes of [
      "# 見出し",
      "- 項目",
      "* 項目",
      "1. 項目",
      "> 引用",
      "```\ncode\n```",
      "| a | b |\n| - | - |\n| 1 | 2 |",
      "これは **太字** です",
      "[字](https://example.com)",
      "- [ ] 箱",
      "これは ~~消す~~ です",
    ])
      expect(looksLikeMarkdown(yes), yes).toBe(true);
    for (const no of [
      "普通の文章です。",
      "2026-11-21 の予定",
      "a * b = c",
      "価格は 100 円 - 税込",
      "メールは a_b@example.com まで",
      "",
    ])
      expect(looksLikeMarkdown(no), no).toBe(false);
    const deep = Array.from({ length: 30 }, (_, i) => `${"  ".repeat(i)}- 段 ${i}`).join("\n");
    expect(markdownToDoc(deep)).toEqual({ ok: false, reason: "too_deep" });
    const big = Array.from({ length: 40_000 }, (_, i) => `- 項目 ${i} ${"あ".repeat(30)}`).join("\n");
    expect(markdownToDoc(big)).toEqual({ ok: false, reason: "too_big" });
  });

  it("K568-UN-008 写した部品の関数（use-color-highlight）の頭に、出どころ（リポジトリ・版＝コミット・元のファイルの道）と MIT の許諾の表示が在る。自前で書き直した物は頭の注の行を「自前」で始める", () => {
    expectOrigin("use-color-highlight.ts");
  });
});
