// K-568「本文の道具：色（文字の色・背景の色を自由に）・表（命令を全部）・Markdown を貼ると変換」の試験（実 Chrome・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f4v2-editor/f4v2-editor-more（K-567 の頁と同じ作りで、K-568 が持つ見出し。?doc=empty|plain|full・?mode=edit|read）。
//     頁の出し物は K-567 と同じ（data-testid の doc-json・doc-text・doc-verdict）。貼り付けで文を変えない知らせは role="status"。
//   見ること：色の小さな画面（よく使う色・ほかの色・色を外す）で文字と背景に #rrggbb の色が付く・外れる・表のメニューの命令が全部効く（足す・消す・つなぐ・分ける・見出しの切り替え）・
//     Markdown と見分けた貼り付けだけが変換される・危ない Markdown が落ちる・幅 375／768／1440 のはみ出し 0。
//   画面に出す字と並びは下絵が正。下絵に無い小さな物（色の名前・表のメニューの項目名・貼れなかった知らせ）の字は K-568 の「画面の文」の勧めのとおり。
//   画像のボタンは K-587 が持つ（帯の全体の下絵も K-587）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { matchMock } from "./stage2-match";

type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};
const BASE = "/dev/mock/f4v2-editor/f4v2-editor-more";
const WIDTHS = [375, 768, 1440] as const;
const TEXT_COLORS = [
  ["黒", "#1f2937"],
  ["灰", "#6b7280"],
  ["赤", "#dc2626"],
  ["橙", "#ea580c"],
  ["黄", "#ca8a04"],
  ["緑", "#16a34a"],
  ["青緑", "#0d9488"],
  ["青", "#2563eb"],
  ["紫", "#7c3aed"],
  ["桃", "#db2777"],
] as const;
const BG_COLORS = [
  ["灰", "#e5e7eb"],
  ["赤", "#fecaca"],
  ["橙", "#fed7aa"],
  ["黄", "#fde68a"],
  ["緑", "#bbf7d0"],
  ["青緑", "#99f6e4"],
  ["青", "#bfdbfe"],
  ["紫", "#ddd6fe"],
  ["桃", "#fbcfe8"],
] as const;
const TABLE_ITEMS = [
  "表を入れる（3 行 × 3 列）",
  "行を上に足す",
  "行を下に足す",
  "列を左に足す",
  "列を右に足す",
  "行を消す",
  "列を消す",
  "表を消す",
  "セルをつなぐ",
  "セルを分ける",
  "見出しの行にする",
  "見出しの列にする",
  "見出しのセルにする",
] as const;
const NOTICE = "貼る文が大きすぎるか入れ子が深すぎるため、貼れませんでした";

async function open(page: Page, doc: string, width = 1440, mode: "edit" | "read" = "edit") {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "部品は口を呼ばない" }));
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`${BASE}?doc=${doc}&mode=${mode}`);
  expect(res?.status(), "頁を開けない").toBe(200);
  await expect(page.locator('[data-mock="f4v2-editor-more"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const body = (page: Page) => page.getByRole("textbox", { name: "本文", exact: true });
const tool = (page: Page, name: string) =>
  page.getByRole("toolbar", { name: "本文の道具", exact: true }).getByRole("button", { name, exact: true });
const tmenu = (page: Page) => page.getByRole("menu", { name: "表", exact: true });
const titem = (page: Page, name: string) => tmenu(page).getByRole("menuitem", { name, exact: true });
/** 表のメニューを開いて項目を押す */
async function table(page: Page, item: string) {
  await tool(page, "表").click();
  await titem(page, item).click();
}
const isOff = async (l: ReturnType<typeof titem>) =>
  (await l.isDisabled()) || (await l.getAttribute("aria-disabled")) === "true";
const cdialog = (page: Page, name: "文字の色" | "背景の色") => page.getByRole("dialog", { name, exact: true });
const outDoc = async (page: Page): Promise<Node> => JSON.parse(await page.getByTestId("doc-json").innerText()) as Node;
const outText = (page: Page) => page.getByTestId("doc-text").innerText();
function walk(n: Node, f: (n: Node) => void): void {
  f(n);
  (n.content ?? []).forEach((c) => walk(c, f));
}
const find = (n: Node, pred: (n: Node) => boolean): Node[] => {
  const r: Node[] = [];
  walk(n, (x) => pred(x) && r.push(x));
  return r;
};
const markOf = (n: Node, mark: "color" | "highlight", text: string): unknown =>
  find(n, (x) => x.type === "text" && x.text === text)[0]?.marks?.find((m) => m.type === mark)?.attrs?.["color"];
const colorOf = (n: Node, text: string): unknown => markOf(n, "color", text);
const cellType = (n: Node, r: number, c: number) => rows(n)[r]?.content?.[c]?.type;
const rows = (n: Node) => find(n, (x) => x.type === "tableRow");
const cols = (n: Node) => find(n, (x) => x.type === "tableRow")[0]?.content?.length ?? 0;

async function typeFresh(page: Page, text: string) {
  await body(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text);
}
const selectAll = async (page: Page) => {
  await body(page).click();
  await page.keyboard.press("ControlOrMeta+a");
};
async function paste(page: Page, data: Record<string, string>) {
  await page.evaluate((d) => {
    const el = document.querySelector('[role="textbox"][aria-label="本文"]');
    if (!el) throw new Error("本文が無い");
    const dt = new DataTransfer();
    for (const [type, value] of Object.entries(d)) dt.setData(type, value);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, data);
}
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function insertTable(page: Page) {
  await typeFresh(page, "");
  await table(page, "表を入れる（3 行 × 3 列）");
  await expect.poll(async () => rows(await outDoc(page)).length).toBeGreaterThan(0);
}

test("K568-UI-001 文字の色：字を選んで『文字の色』を押すと名前『文字の色』の小さな画面が開き、よく使う色 10 個（黒・灰・赤・橙・黄・緑・青緑・青・紫・桃）と『ほかの色』と『色を外す』が並ぶ。色を選ぶと、その字だけに color（#rrggbb）が付き、見た目の色が色なしの字と違う", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "期日");
  await selectAll(page);
  await tool(page, "文字の色").click();
  const dlg = cdialog(page, "文字の色");
  await expect(dlg).toBeVisible();
  await expect(dlg.locator("button[aria-pressed]")).toHaveCount(10);
  expect(
    await dlg.locator("button[aria-pressed]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))),
  ).toEqual(TEXT_COLORS.map(([n]) => n));
  await expect(dlg.getByLabel("ほかの色", { exact: true })).toBeVisible();
  await expect(dlg.getByRole("button", { name: "色を外す", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const plain = await body(page)
    .getByText("期日", { exact: true })
    .evaluate((e) => getComputedStyle(e).color);
  for (const [label, value] of TEXT_COLORS) {
    await typeFresh(page, "期日");
    await selectAll(page);
    await tool(page, "文字の色").click();
    await cdialog(page, "文字の色").getByRole("button", { name: label, exact: true }).click();
    await expect.poll(async () => colorOf(await outDoc(page), "期日"), label).toBe(value);
  }
  await typeFresh(page, "前後");
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+ArrowRight");
  await tool(page, "文字の色").click();
  await cdialog(page, "文字の色").getByRole("button", { name: "赤", exact: true }).click();
  await expect.poll(async () => colorOf(await outDoc(page), "前")).toBe("#dc2626");
  expect(colorOf(await outDoc(page), "後")).toBeUndefined();
  const red = await body(page)
    .getByText("前", { exact: true })
    .evaluate((e) => getComputedStyle(e).color);
  expect(red).not.toBe(plain);
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K568-UI-002 ほかの色：『ほかの色』（ブラウザの色の選び方）で #123abc を選ぶと、選んでいる字に color（#123abc）が付く。同じ色を別の字にも付けられ、付いた字の見た目の色が選んだ色になる", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "自由な色");
  await selectAll(page);
  await tool(page, "文字の色").click();
  await cdialog(page, "文字の色").getByLabel("ほかの色", { exact: true }).fill("#123abc");
  await expect.poll(async () => colorOf(await outDoc(page), "自由な色")).toBe("#123abc");
  const rgb = await body(page)
    .getByText("自由な色", { exact: true })
    .evaluate((e) => getComputedStyle(e).color);
  expect(rgb).toBe("rgb(18, 58, 188)");
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K568-UI-003 色を外す：色の付いた字を選んで『色を外す』を押すと color が消え、字は残る。選んでいない字の色は変わらない。背景の色も同じ", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "前後");
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+ArrowRight");
  await tool(page, "文字の色").click();
  await cdialog(page, "文字の色").getByRole("button", { name: "赤", exact: true }).click();
  await tool(page, "背景の色").click();
  await cdialog(page, "背景の色").getByRole("button", { name: "黄", exact: true }).click();
  await expect.poll(async () => colorOf(await outDoc(page), "前")).toBe("#dc2626");
  await expect.poll(async () => markOf(await outDoc(page), "highlight", "前")).toBe("#fde68a");
  expect(colorOf(await outDoc(page), "後")).toBeUndefined();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+ArrowRight");
  await tool(page, "文字の色").click();
  await cdialog(page, "文字の色").getByRole("button", { name: "色を外す", exact: true }).click();
  await expect.poll(async () => colorOf(await outDoc(page), "前")).toBeUndefined();
  expect(markOf(await outDoc(page), "highlight", "前")).toBe("#fde68a");
  await tool(page, "背景の色").click();
  await cdialog(page, "背景の色").getByRole("button", { name: "色を外す", exact: true }).click();
  await expect.poll(async () => markOf(await outDoc(page), "highlight", "前")).toBeUndefined();
  expect(find(await outDoc(page), (n) => !!n.marks?.length).length).toBe(0);
  expect(await outText(page)).toBe("前後");
});

test("K568-UI-004 背景の色：『背景の色』の小さな画面に、よく使う色 9 個（灰・赤・橙・黄・緑・青緑・青・紫・桃）と『ほかの色』と『色を外す』が並び、選ぶと選んでいる字に highlight（color は #rrggbb）が付き、背景の見た目が変わる。ほかの色も選べる", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "背景");
  await selectAll(page);
  await tool(page, "背景の色").click();
  const dlg = cdialog(page, "背景の色");
  expect(
    await dlg.locator("button[aria-pressed]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))),
  ).toEqual(BG_COLORS.map(([n]) => n));
  await dlg.getByRole("button", { name: "緑", exact: true }).click();
  await expect.poll(async () => markOf(await outDoc(page), "highlight", "背景")).toBe("#bbf7d0");
  expect(
    await body(page)
      .locator("mark")
      .first()
      .evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe("rgb(187, 247, 208)");
  await tool(page, "背景の色").click();
  await cdialog(page, "背景の色").getByLabel("ほかの色", { exact: true }).fill("#abcdef");
  await expect.poll(async () => markOf(await outDoc(page), "highlight", "背景")).toBe("#abcdef");
  expect(find(await outDoc(page), (n) => n.type === "text" && !!n.marks?.some((m) => m.type === "color")).length).toBe(
    0,
  );
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K568-UI-005 色の小さな画面のキーボードと閉じ方：『文字の色』を Enter で開き、Tab で色に移り、Enter で付き、Esc で閉じて『文字の色』に戻る。画面の外を押しても閉じる。いま付いている色は aria-pressed が真", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "確認");
  await selectAll(page);
  await tool(page, "文字の色").focus();
  await page.keyboard.press("Enter");
  const dlg = cdialog(page, "文字の色");
  await expect(dlg).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(dlg.locator("button[aria-pressed]").first()).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect.poll(async () => colorOf(await outDoc(page), "確認")).toBe("#dc2626");
  await tool(page, "文字の色").click();
  await expect(cdialog(page, "文字の色").getByRole("button", { name: "赤", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await expect(tool(page, "文字の色")).toBeFocused();
  await tool(page, "背景の色").click();
  await expect(cdialog(page, "背景の色")).toBeVisible();
  await body(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("K568-UI-006 表のメニュー：『表』を押すと名前『表』のメニューが開き、項目は 表を入れる（3 行 × 3 列）・行を上に足す・行を下に足す・列を左に足す・列を右に足す・行を消す・列を消す・表を消す・セルをつなぐ・セルを分ける・見出しの行にする・見出しの列にする・見出しのセルにする の順。表の外では『表を入れる』以外が押せない", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "表の外");
  await tool(page, "表").click();
  await expect(tmenu(page)).toBeVisible();
  expect(
    await tmenu(page)
      .getByRole("menuitem")
      .evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim())),
  ).toEqual([...TABLE_ITEMS]);
  expect(await isOff(titem(page, TABLE_ITEMS[0]))).toBe(false);
  for (const name of TABLE_ITEMS.slice(1)) expect(await isOff(titem(page, name)), name).toBe(true);
  await page.keyboard.press("Escape");
  await expect(tmenu(page)).toHaveCount(0);
  await expect(tool(page, "表")).toBeFocused();
});

test("K568-UI-007 表を入れる・打つ：『表を入れる』で見出し行 1 つ＋本文の行 2 つ・3 列の表が入り、1 行目は tableHeader・ほかは tableCell で、validateDoc を通る。見出しの字は太い。セルに打て、素の文字は「 | 」でつなぐ行で、Tab で次のセル・Shift+Tab で前のセル・最後のセルの Tab で行が 1 つ増える", async ({
  page,
}) => {
  await open(page, "empty");
  await insertTable(page);
  const d = await outDoc(page);
  expect(rows(d).length).toBe(3);
  expect(cols(d)).toBe(3);
  expect(rows(d)[0]!.content!.every((c) => c.type === "tableHeader")).toBe(true);
  expect(rows(d)[1]!.content!.every((c) => c.type === "tableCell")).toBe(true);
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
  expect(
    await body(page)
      .locator("th")
      .first()
      .evaluate((e) => Number(getComputedStyle(e).fontWeight)),
  ).toBeGreaterThanOrEqual(500);
  await page.keyboard.type("項目");
  await page.keyboard.press("Tab");
  await page.keyboard.type("数量");
  await page.keyboard.press("Tab");
  await page.keyboard.type("単価");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.type("!");
  // 素の文字は行ごと（docToText）：字の無い本文の行 2 つも「 | 」でつなぐ行として出る（行の終わりの空白は落ちる）
  await expect.poll(() => outText(page)).toBe("項目 | 数量! | 単価\n |  |\n |  |");
  const before = rows(await outDoc(page)).length;
  await body(page).locator("td").last().click();
  await page.keyboard.press("Tab");
  await expect.poll(async () => rows(await outDoc(page)).length).toBe(before + 1);
});

test("K568-UI-008 行と列の足し引き：『行を上に足す』『行を下に足す』『列を左に足す』『列を右に足す』で今の位置の前後に行・列が 1 つ増え（全部の行に列が増える）、『行を消す』『列を消す』で今の行・列が消える。列が 1 つだけのとき『列を消す』は押せない", async ({
  page,
}) => {
  await open(page, "empty");
  await insertTable(page);
  await body(page).locator("td").first().click();
  await table(page, "行を下に足す");
  await expect.poll(async () => rows(await outDoc(page)).length).toBe(4);
  await table(page, "行を上に足す");
  await expect.poll(async () => rows(await outDoc(page)).length).toBe(5);
  await table(page, "列を右に足す");
  await expect.poll(async () => cols(await outDoc(page))).toBe(4);
  await table(page, "列を左に足す");
  await expect.poll(async () => cols(await outDoc(page))).toBe(5);
  expect(rows(await outDoc(page)).every((r) => r.content!.length === 5)).toBe(true);
  await table(page, "行を消す");
  await expect.poll(async () => rows(await outDoc(page)).length).toBe(4);
  for (let i = 0; i < 4; i++) {
    await table(page, "列を消す");
    await expect.poll(async () => cols(await outDoc(page))).toBe(4 - i);
  }
  await tool(page, "表").click();
  expect(await isOff(titem(page, "列を消す"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K568-UI-009 セルをつなぐ・分ける：となり合う 2 つのセルを選んで『セルをつなぐ』を押すとセルが 1 つになり colspan が 2 になる（validateDoc を通る）。つないだセルで『セルを分ける』を押すと元の 2 つに戻り colspan は残らない", async ({
  page,
}) => {
  await open(page, "empty");
  await insertTable(page);
  // 表の行は全部 tbody の中で、1 行目は見出しの行（th）。本文の最初の行（2 行目）のセルを選ぶ
  const cells = body(page).locator("tr").nth(1).locator("td");
  await cells.nth(0).dragTo(cells.nth(1));
  await table(page, "セルをつなぐ");
  await expect.poll(async () => rows(await outDoc(page))[1]?.content?.length).toBe(2);
  expect(rows(await outDoc(page))[1]!.content![0]!.attrs?.["colspan"]).toBe(2);
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
  await body(page).locator("tr").nth(1).locator("td").first().click();
  await table(page, "セルを分ける");
  await expect.poll(async () => rows(await outDoc(page))[1]?.content?.length).toBe(3);
  expect(JSON.stringify(await outDoc(page))).not.toMatch(/colspan|colwidth/);
});

test("K568-UI-010 見出しの切り替え：『見出しの行にする』で今の行のセルが全部 tableHeader に・もう一度で tableCell に戻る。『見出しの列にする』で今の列のセルが tableHeader に・『見出しのセルにする』で今のセルだけが替わる。見出しのセルは太く出る", async ({
  page,
}) => {
  await open(page, "empty");
  await insertTable(page);
  await body(page).locator("td").first().click();
  await table(page, "見出しの行にする");
  await expect
    .poll(async () => rows(await outDoc(page))[1]!.content!.every((c) => c.type === "tableHeader"))
    .toBe(true);
  await table(page, "見出しの行にする");
  await expect.poll(async () => rows(await outDoc(page))[1]!.content!.every((c) => c.type === "tableCell")).toBe(true);
  await table(page, "見出しの列にする");
  await expect
    .poll(async () => rows(await outDoc(page)).every((r) => r.content![0]!.type === "tableHeader"))
    .toBe(true);
  await table(page, "見出しの列にする");
  await body(page).locator("td").first().click();
  await table(page, "見出しのセルにする");
  await expect.poll(async () => cellType(await outDoc(page), 1, 0)).toBe("tableHeader");
  expect(cellType(await outDoc(page), 1, 1)).toBe("tableCell");
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K568-UI-011 表を消す：『表を消す』で表ごと消え、前後の段落は残る。Ctrl／⌘+Z で表が戻る。表の外では押せない", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "前");
  await page.keyboard.press("Enter");
  await table(page, "表を入れる（3 行 × 3 列）");
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "table").length).toBe(1);
  await table(page, "表を消す");
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "table").length).toBe(0);
  expect(await outText(page)).toBe("前");
  await tool(page, "表").click();
  expect(await isOff(titem(page, "表を消す"))).toBe(true);
  await page.keyboard.press("Escape");
  // Esc の後の焦点は『表』の道具に在る（K568-UI-006）。編集欄に戻ってから戻す
  await body(page).click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "table").length).toBe(1);
});

test("K568-UI-012 Markdown を貼る：# 見出し（level 2）・## （level 3）・### （level 4）・1. 番号つき・~~取り消し~~・`コード`・---・- 箇条書き・- [ ] チェック・表・**太字**・> 引用・``` コードの段・[字](https://…) を貼ると、見たままの見出し・orderedList・strike・code・horizontalRule・bulletList・taskItem・table・bold・blockquote・codeBlock・リンクに変わり、記号の字は残らない", async ({
  page,
}) => {
  await open(page, "empty");
  await body(page).click();
  await paste(page, {
    "text/plain":
      "# 目的\n\n## 補足\n\n### さらに\n\n1. 一つ目\n2. 二つ目\n\n~~消す~~ と `code` と\n\n---\n\n- 明細を集める\n- [ ] 控える\n- [x] 送った\n\n| 項目 | 数量 |\n| --- | --- |\n| 保守 | 1 |\n\n**期日**は 12/15 [資料](https://example.com/a)\n\n> 先月と同じ書式で\n\n```\na = 1\n```",
  });
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "table").length).toBe(1);
  const d = await outDoc(page);
  expect(find(d, (n) => n.type === "heading").map((n) => n.attrs?.["level"])).toEqual([2, 3, 4]);
  expect(find(d, (n) => n.type === "orderedList").length).toBe(1);
  expect(find(d, (n) => n.type === "horizontalRule").length).toBe(1);
  expect(
    find(d, (n) => n.type === "text" && n.text === "消す" && !!n.marks?.some((m) => m.type === "strike")).length,
  ).toBe(1);
  expect(
    find(d, (n) => n.type === "text" && n.text === "code" && !!n.marks?.some((m) => m.type === "code")).length,
  ).toBe(1);
  expect(find(d, (n) => n.type === "taskItem").map((n) => n.attrs?.["checked"])).toEqual([false, true]);
  expect(find(d, (n) => n.type === "blockquote").length).toBe(1);
  expect(find(d, (n) => n.type === "codeBlock").length).toBe(1);
  expect(
    find(d, (n) => n.type === "text" && !!n.marks?.some((m) => m.type === "bold") && n.text === "期日").length,
  ).toBe(1);
  expect(
    find(d, (n) => !!n.marks?.some((m) => m.type === "link" && m.attrs?.["href"] === "https://example.com/a")).length,
  ).toBe(1);
  // 素の文字（docToText）は引用の行を「> 」で始めるので、「>」は画面の本文の字で見る
  expect(await outText(page)).not.toMatch(/[#*`~]|\| --- \||^---/m);
  expect(await body(page).innerText()).not.toMatch(/[#*`>~]/);
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K568-UI-013 Markdown らしくない普通の文は変換しない：「a * b = c」や「価格は 100 円 - 税込」を貼っても記号は字のまま残り、行ごとの段落になる。表や太字にならない", async ({
  page,
}) => {
  await open(page, "empty");
  await body(page).click();
  await paste(page, { "text/plain": "a * b = c\n価格は 100 円 - 税込\nメールは a_b@example.com まで" });
  await expect.poll(() => outText(page)).toBe("a * b = c\n価格は 100 円 - 税込\nメールは a_b@example.com まで");
  const d = await outDoc(page);
  expect(find(d, (n) => n.type === "paragraph").length).toBe(3);
  expect(find(d, (n) => !!n.marks?.length).length).toBe(0);
});

test("K568-UI-014 text/html を持つ貼り付け（Web ページなどから）は Markdown と読まない：html の中の「**a**」は記号のまま残り、太字にならない。html が無く text/plain だけのときだけ Markdown と見る", async ({
  page,
}) => {
  await open(page, "empty");
  await body(page).click();
  await paste(page, { "text/html": "<p>**a** と # b</p>", "text/plain": "**a** と # b" });
  await expect.poll(() => outText(page)).toBe("**a** と # b");
  expect(find(await outDoc(page), (n) => !!n.marks?.length).length).toBe(0);
  await typeFresh(page, "");
  await paste(page, { "text/plain": "**a** と b" });
  await expect
    .poll(
      async () =>
        find(
          await outDoc(page),
          (n) => n.type === "text" && n.text === "a" && !!n.marks?.some((m) => m.type === "bold"),
        ).length,
    )
    .toBe(1);
});

test("K568-UI-015 貼り付けは 1 回で戻せる：Markdown を貼って Ctrl／⌘+Z を 1 回押すと、貼る前の文書に戻る（変換前の記号の字にもならない）", async ({
  page,
}) => {
  await open(page, "plain");
  const before = JSON.stringify(await outDoc(page));
  await body(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await paste(page, { "text/plain": "# 見出し\n\n- 一つ目\n- 二つ目" });
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "heading").length).toBe(1);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => JSON.stringify(await outDoc(page))).toBe(before);
});

test("K568-UI-016 危ない Markdown：[字](javascript:…) と生の <script>・<img onerror> を貼っても実行されず、リンクにもならず、文書に script の節も入らない（字として残る）", async ({
  page,
}) => {
  await open(page, "empty");
  await body(page).click();
  await paste(page, {
    "text/plain":
      '# 注意\n\n[悪い](javascript:window.__pwned=1) <script>window.__pwned=2</script> <img src=x onerror="window.__pwned=3">',
  });
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "heading").length).toBe(1);
  const d = await outDoc(page);
  expect(find(d, (n) => !!n.marks?.some((m) => m.type === "link")).length).toBe(0);
  expect(JSON.stringify(d)).not.toMatch(/"href"|javascript:/);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  await expect(body(page).locator("script, img")).toHaveCount(0);
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K568-UI-017 上限を超える貼り付け：入れ子が深すぎる Markdown と 1 MB を超える Markdown は、貼らずに『貼る文が大きすぎるか入れ子が深すぎるため、貼れませんでした』と知らせ、書いてある文書は変わらない", async ({
  page,
}) => {
  await open(page, "plain");
  const before = JSON.stringify(await outDoc(page));
  await body(page).click();
  const deep = Array.from({ length: 30 }, (_, i) => `${"  ".repeat(i)}- 段 ${i}`).join("\n");
  await paste(page, { "text/plain": deep });
  await expect(page.getByRole("status")).toHaveText(NOTICE);
  expect(JSON.stringify(await outDoc(page))).toBe(before);
  const big = Array.from({ length: 40_000 }, (_, i) => `- 項目 ${i} ${"あ".repeat(30)}`).join("\n");
  await paste(page, { "text/plain": big });
  await expect(page.getByRole("status")).toHaveText(NOTICE);
  expect(JSON.stringify(await outDoc(page))).toBe(before);
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K568-UI-018 幅 375・768・1440：広い表（列 8）を貼っても頁の横のはみ出しは 0 で、表は本文の中でだけ横に流れる。表のメニュー・文字の色・背景の色の小さな画面も画面の外にはみ出さない", async ({
  page,
}) => {
  const head = Array.from({ length: 8 }, (_, i) => `列の見出し ${i + 1}`);
  const md = `| ${head.join(" | ")} |\n| ${head.map(() => "---").join(" | ")} |\n| ${head.map(() => "とても長いセルの中身です").join(" | ")} |`;
  for (const w of WIDTHS) {
    await open(page, "empty", w);
    await body(page).click();
    await paste(page, { "text/plain": md });
    await expect.poll(async () => find(await outDoc(page), (n) => n.type === "table").length).toBe(1);
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    await body(page).locator("td").first().click();
    await tool(page, "表").scrollIntoViewIfNeeded();
    await tool(page, "表").click();
    const tm = await tmenu(page).boundingBox();
    expect(tm!.x, `幅 ${w} の表のメニュー`).toBeGreaterThanOrEqual(0);
    expect(tm!.x + tm!.width, `幅 ${w} の表のメニュー`).toBeLessThanOrEqual(w);
    await page.keyboard.press("Escape");
    for (const name of ["文字の色", "背景の色"] as const) {
      await tool(page, name).scrollIntoViewIfNeeded();
      await tool(page, name).click();
      const cb = await cdialog(page, name).boundingBox();
      expect(cb!.x, `幅 ${w} の ${name}`).toBeGreaterThanOrEqual(0);
      expect(cb!.x + cb!.width, `幅 ${w} の ${name}`).toBeLessThanOrEqual(w);
      await page.keyboard.press("Escape");
    }
    expect(await overflowX(page), `幅 ${w}：開いた後`).toBe(0);
    const note = page.locator(".k-f4d-md-note");
    await expect(note).toHaveText("Markdown を貼ると変換します");
    expect(
      await note.evaluate((e) => e.scrollWidth - e.clientWidth),
      `幅 ${w}：案内の字が切れない`,
    ).toBeLessThanOrEqual(0);
  }
});

// ---- 下絵 v2 に足された 3 つの状態（文字の色の小さな画面・表のメニュー・Markdown を貼れなかった知らせ）との突き合わせ
const COLOR_PAIRS: FidelityPair[] = [
  {
    name: "pop",
    role: "pop",
    canvas: ".k-f4d-colors",
    app: ".k-f4d-colors",
    props: ["width", "background-color", "border-top-left-radius"],
  },
  {
    name: "title",
    role: "title",
    canvas: ".k-f4d-colors .k-f4d-pop-title",
    app: ".k-f4d-colors .k-f4d-pop-title",
    props: ["font-size", "font-weight", "texts"],
  },
  {
    name: "swatch",
    role: "swatch",
    canvas: ".k-f4d-swatchbtn",
    app: ".k-f4d-swatchbtn",
    props: ["width", "height", "background-color"],
  },
  {
    name: "other",
    role: "other",
    canvas: ".k-f4d-othercolor",
    app: ".k-f4d-othercolor",
    props: ["font-size", "texts"],
  },
  {
    name: "clear",
    role: "clear",
    canvas: ".k-f4d-colors .k-btn",
    app: ".k-f4d-colors .k-btn",
    props: ["height", "font-size", "texts"],
  },
];
const TABLE_PAIRS: FidelityPair[] = [
  {
    name: "menu",
    role: "menu",
    canvas: ".k-f4d-menu",
    app: ".k-f4d-menu",
    props: ["width", "background-color", "border-top-left-radius"],
  },
  {
    name: "item",
    role: "item",
    canvas: ".k-f4d-menu button",
    app: ".k-f4d-menu button",
    props: ["height", "font-size", "color", "texts"],
  },
  {
    name: "group",
    role: "group",
    canvas: ".k-f4d-menu-group + .k-f4d-menu-group",
    app: ".k-f4d-menu-group + .k-f4d-menu-group",
    props: ["border-top-color", "padding-top"],
  },
];
const NOTE_PAIRS: FidelityPair[] = [
  {
    name: "note",
    role: "note",
    canvas: ".k-f4d-editnote",
    app: ".k-f4d-editnote",
    props: ["font-size", "color", "texts"],
  },
];
const MDNOTE_PAIRS: FidelityPair[] = [
  {
    name: "mdnote",
    role: "mdnote",
    canvas: ".k-f4d-md-note",
    app: ".k-f4d-md-note",
    props: ["font-size", "color", "texts"],
  },
];
const STATES: { id: string; what: string; pairs: FidelityPair[]; setup: (page: Page, w: number) => Promise<void> }[] = [
  {
    id: "f4v2-editor-color",
    what: "文字の色の小さな画面（幅・題・色の四角・ほかの色・色を外す）と本文の箱の下の右の案内の字",
    pairs: [...COLOR_PAIRS, ...MDNOTE_PAIRS],
    setup: async (page, w) => {
      await open(page, "plain", w);
      await selectAll(page);
      await tool(page, "文字の色").click();
      await expect(cdialog(page, "文字の色")).toBeVisible();
    },
  },
  {
    id: "f4v2-editor-table",
    what: "表のメニュー（幅・項目の高さと字・グループの区切り）",
    pairs: TABLE_PAIRS,
    setup: async (page, w) => {
      await open(page, "empty", w);
      await insertTable(page);
      await tool(page, "表").click();
      await expect(tmenu(page)).toBeVisible();
    },
  },
  {
    id: "f4v2-editor-paste-fail",
    what: "貼れなかったときの知らせの字",
    pairs: NOTE_PAIRS,
    setup: async (page, w) => {
      await open(page, "plain", w);
      await body(page).click();
      await paste(page, {
        "text/plain": Array.from({ length: 30 }, (_, i) => `${"  ".repeat(i)}- 段 ${i}`).join("\n"),
      });
      await expect(page.getByRole("status")).toHaveText(NOTICE);
    },
  },
];
for (const s of STATES) {
  test(`K568-UI-019 下絵との突き合わせ（${s.id}）：幅 375・768・1440 で ${s.what}が下絵と同じ値`, async ({
    browser,
  }) => {
    for (const w of WIDTHS) {
      const { rows: compared, bad } = await matchMock(browser, s.id, w, (page) => s.setup(page, w), {
        base: "/dev/mock/f4v2",
        pairs: s.pairs,
        blur: true,
      });
      expect(compared.length, `${s.id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    }
  });
}
