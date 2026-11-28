// K-587「本文の道具：書式の道具（見出し・並び・引用・コードの囲み・区切りの線・寄せ・上付き／下付き・画像は押せない形）」の試験（実 Chrome・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f4v2-editor/f4v2-editor-format（K-567 の頁と同じ作りで、K-587 が持つ見出し。?doc=empty|plain|full・?mode=edit|read）。
//     頁の出し物は K-567 と同じ（data-testid の doc-json・doc-text・doc-verdict）。口は網の手前で 599 にして、呼ばれないことも見る。
//   見ること：見出しと並びのメニューの名前・項目・押した結果（部品の出す文書の木）・メニューのキーボード・引用／コードの囲み／区切りの線・
//     寄せ 4 つ・上付き／下付き・画像は押せない・帯が狭い幅で帯の中で横に送られる・下絵（帯の全体）との突き合わせ。
//   画面に出す字と並びは下絵（features/F4/doc の DocBar）が正。メニューの項目の名前（見出し 1・2・3・本文／箇条書き・番号つき・チェック）は
//   出来合いの部品の項目を日本語にした名前で、K-587 の「画面の文」の勧めのとおり。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
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
const BASE = "/dev/mock/f4v2-editor/f4v2-editor-format";
const WIDTHS = [375, 768, 1440] as const;

async function open(page: Page, doc: string, width = 1440) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 599, body: "部品は口を呼ばない" }));
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`${BASE}?doc=${doc}`);
  expect(res?.status(), "頁を開けない").toBe(200);
  await expect(page.locator('[data-mock="f4v2-editor-format"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const body = (page: Page) => page.getByRole("textbox", { name: "本文", exact: true });
const bar = (page: Page) => page.getByRole("toolbar", { name: "本文の道具", exact: true });
const tool = (page: Page, name: string) => bar(page).getByRole("button", { name, exact: true });
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
const hasMark = (n: Node, mark: string, text?: string) =>
  find(
    n,
    (x) => x.type === "text" && (text === undefined || x.text === text) && !!x.marks?.some((m) => m.type === mark),
  ).length > 0;
const levels = (n: Node) => find(n, (x) => x.type === "heading").map((h) => h.attrs?.["level"]);

async function typeFresh(page: Page, text: string) {
  await body(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text);
}
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** メニューの道具を押して開き、項目を押す */
async function pick(page: Page, toolName: string, role: "menuitemradio" | "menuitemcheckbox", item: string) {
  await tool(page, toolName).click();
  await page.getByRole("menu", { name: toolName, exact: true }).getByRole(role, { name: item, exact: true }).click();
}

test("K587-UI-001 見出し：『見出し』を押すと名前『見出し』のメニューが開き、項目は 見出し 1・見出し 2・見出し 3・本文 の順。選ぶと level 2・3・4 の見出し・本文で段落に戻る。選んでいる項目は aria-checked が真で、文は消えない", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "目的");
  await tool(page, "見出し").click();
  const menu = page.getByRole("menu", { name: "見出し", exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitemradio")).toHaveText(["見出し 1", "見出し 2", "見出し 3", "本文"]);
  await expect(menu.getByRole("menuitemradio", { name: "本文", exact: true })).toHaveAttribute("aria-checked", "true");
  await menu.getByRole("menuitemradio", { name: "見出し 1", exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect.poll(async () => levels(await outDoc(page))).toEqual([2]);
  for (const [item, level] of [
    ["見出し 2", 3],
    ["見出し 3", 4],
  ] as const) {
    await pick(page, "見出し", "menuitemradio", item);
    await expect.poll(async () => levels(await outDoc(page)), item).toEqual([level]);
  }
  await tool(page, "見出し").click();
  await expect(page.getByRole("menuitemradio", { name: "見出し 3", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("menuitemradio", { name: "本文", exact: true }).click();
  await expect.poll(async () => levels(await outDoc(page))).toEqual([]);
  expect(await outText(page)).toBe("目的");
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K587-UI-002 並び：『並び』のメニューは 箇条書き・番号つき・チェック の順。箇条書きは項目が増え空の項目で Enter を押すと抜ける（素の文字は「- 」の行）・番号つきは orderedList（素の文字は「- 」の行）・チェックは箱が出て押すと checked が真偽に変わる。選んでいる種類をもう一度選ぶと段落に戻り、別の種類を選ぶと並びの種類が変わる", async ({
  page,
}) => {
  await open(page, "empty");
  await pick(page, "並び", "menuitemcheckbox", "箇条書き");
  await page.keyboard.type("明細を集める");
  await page.keyboard.press("Enter");
  await page.keyboard.type("請求書を作る");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("終わり");
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "listItem").length).toBe(2);
  expect(await outText(page)).toBe("- 明細を集める\n- 請求書を作る\n終わり");
  await tool(page, "並び").click();
  const menu = page.getByRole("menu", { name: "並び", exact: true });
  await expect(menu.getByRole("menuitemcheckbox")).toHaveText(["箇条書き", "番号つき", "チェック"]);
  await page.keyboard.press("Escape");

  await typeFresh(page, "");
  await pick(page, "並び", "menuitemcheckbox", "番号つき");
  await page.keyboard.type("一つ目");
  await page.keyboard.press("Enter");
  await page.keyboard.type("二つ目");
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "orderedList").length).toBe(1);
  expect(find(await outDoc(page), (n) => n.type === "listItem").length).toBe(2);
  expect(await outText(page)).toBe("- 一つ目\n- 二つ目");
  await tool(page, "並び").click();
  await expect(page.getByRole("menuitemcheckbox", { name: "番号つき", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("menuitemcheckbox", { name: "箇条書き", exact: true }).click();
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "bulletList").length).toBe(1);
  expect(find(await outDoc(page), (n) => n.type === "orderedList").length).toBe(0);

  await typeFresh(page, "");
  await pick(page, "並び", "menuitemcheckbox", "チェック");
  await page.keyboard.type("送ったあとに控える");
  await expect
    .poll(async () => find(await outDoc(page), (n) => n.type === "taskItem" && n.attrs?.["checked"] === false).length)
    .toBe(1);
  expect(await outText(page)).toBe("[ ] 送ったあとに控える");
  const box = body(page).getByRole("checkbox");
  await box.click();
  await expect
    .poll(async () => find(await outDoc(page), (n) => n.type === "taskItem" && n.attrs?.["checked"] === true).length)
    .toBe(1);
  expect(await outText(page)).toBe("[x] 送ったあとに控える");
  await box.click();
  await expect
    .poll(async () => find(await outDoc(page), (n) => n.type === "taskItem" && n.attrs?.["checked"] === true).length)
    .toBe(0);
  await pick(page, "並び", "menuitemcheckbox", "チェック");
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "taskList").length).toBe(0);
  expect(await outText(page)).toBe("送ったあとに控える");
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K587-UI-003 引用・コードの囲み・区切りの線：『引用』で blockquote（素の文字は「> 」）・『コードの囲み』で codeBlock（中は印の無い字・改行を持てる）・『区切りの線』で horizontalRule が入り、字を出さない。押した道具は aria-pressed が真になり、もう一度押すと外れる", async ({
  page,
}) => {
  await open(page, "empty");
  await tool(page, "引用").click();
  await page.keyboard.type("先月と同じ書式で");
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "blockquote").length).toBe(1);
  expect(await outText(page)).toBe("> 先月と同じ書式で");
  await expect(tool(page, "引用")).toHaveAttribute("aria-pressed", "true");
  await tool(page, "引用").click();
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "blockquote").length).toBe(0);
  await typeFresh(page, "a = 1");
  await tool(page, "コードの囲み").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("b = 2");
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "codeBlock").length).toBe(1);
  expect(await outText(page)).toBe("a = 1\nb = 2");
  expect(
    find(await outDoc(page), (n) => n.type === "codeBlock").every((c) =>
      (c.content ?? []).every((t) => !t.marks?.length),
    ),
  ).toBe(true);
  await typeFresh(page, "上");
  await page.keyboard.press("Enter");
  await tool(page, "区切りの線").click();
  await page.keyboard.type("下");
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "horizontalRule").length).toBe(1);
  expect(await outText(page)).toBe("上\n下");
  await expect(body(page).locator("hr")).toHaveCount(1);
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K587-UI-004 寄せ：『中央』『右寄せ』『両端』を押すと段落と見出しの textAlign が center・right・justify になり、見た目の text-align も同じ。選んでいる寄せは aria-pressed が真で、『左寄せ』で左に戻る（textAlign は無いか left）", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "支払期日");
  for (const [name, value] of [
    ["中央", "center"],
    ["右寄せ", "right"],
    ["両端", "justify"],
  ] as const) {
    await tool(page, name).click();
    await expect
      .poll(async () => find(await outDoc(page), (n) => n.type === "paragraph")[0]?.attrs?.["textAlign"], name)
      .toBe(value);
    await expect(tool(page, name)).toHaveAttribute("aria-pressed", "true");
    expect(
      await body(page)
        .locator("p")
        .first()
        .evaluate((e) => getComputedStyle(e).textAlign),
      name,
    ).toBe(value);
  }
  await tool(page, "左寄せ").click();
  await expect
    .poll(async () =>
      [undefined, "left"].includes(
        find(await outDoc(page), (n) => n.type === "paragraph")[0]?.attrs?.["textAlign"] as string | undefined,
      ),
    )
    .toBe(true);
  await expect(tool(page, "左寄せ")).toHaveAttribute("aria-pressed", "true");
  await pick(page, "見出し", "menuitemradio", "見出し 2");
  await tool(page, "中央").click();
  await expect
    .poll(async () => find(await outDoc(page), (n) => n.type === "heading")[0]?.attrs?.["textAlign"])
    .toBe("center");
  expect(await outText(page)).toBe("支払期日");
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K587-UI-005 上付き・下付き：字を選んで『上付き』を押すと superscript・『下付き』を押すと subscript に替わり（同時には付かない）、もう一度押すと外れる。素の文字は変わらない", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "m2");
  await page.keyboard.press("Shift+ArrowLeft");
  await tool(page, "上付き").click();
  await expect.poll(async () => hasMark(await outDoc(page), "superscript", "2")).toBe(true);
  await expect(tool(page, "上付き")).toHaveAttribute("aria-pressed", "true");
  await tool(page, "下付き").click();
  await expect.poll(async () => hasMark(await outDoc(page), "subscript", "2")).toBe(true);
  expect(hasMark(await outDoc(page), "superscript")).toBe(false);
  await tool(page, "下付き").click();
  await expect.poll(async () => hasMark(await outDoc(page), "subscript")).toBe(false);
  expect(await outText(page)).toBe("m2");
});

test("K587-UI-006 画像のボタンは押せない形：『画像』は薄く、押せず、title に『まだ使えません』。押しても文書は変わらず、ファイルの選びも出ない。画像の置き場を持つ文書は読み込める", async ({
  page,
}) => {
  await open(page, "full");
  const btn = tool(page, "画像");
  await expect(btn).toBeVisible();
  expect((await btn.isDisabled()) || (await btn.getAttribute("aria-disabled")) === "true").toBe(true);
  await expect(btn).toHaveAttribute("title", "まだ使えません");
  const before = JSON.stringify(await outDoc(page));
  let chooser = false;
  page.on("filechooser", () => (chooser = true));
  await btn.click({ force: true });
  expect(JSON.stringify(await outDoc(page))).toBe(before);
  expect(chooser).toBe(false);
  await expect(body(page).getByRole("img", { name: "先月の請求書の見本.png", exact: true })).toBeVisible();
});

test("K587-UI-007 メニューのキーボード：『見出し』を Enter で開き、↓ で次の項目・Enter で選び、閉じて『見出し』に戻る。Esc で閉じて戻り、メニューの外を押しても閉じる。開いている間だけ aria-expanded が真", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "確認");
  await tool(page, "見出し").focus();
  await expect(tool(page, "見出し")).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "見出し", exact: true });
  await expect(menu).toBeVisible();
  await expect(tool(page, "見出し")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(tool(page, "見出し")).toBeFocused();
  await expect.poll(async () => levels(await outDoc(page)).length).toBe(1);
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(tool(page, "見出し")).toBeFocused();
  await tool(page, "並び").click();
  await expect(page.getByRole("menu", { name: "並び", exact: true })).toBeVisible();
  await body(page).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(tool(page, "並び")).toHaveAttribute("aria-expanded", "false");
});

test("K587-UI-008 幅 375・768・1440：幅 768 以上は帯が折り返して全部の道具が見え（帯の scrollWidth - clientWidth が 0）、幅 375 は帯の中で横に送って『画像』まで届く。見出し・並びのメニューは画面の外にはみ出さない。頁の横のはみ出しは 0", async ({
  page,
}) => {
  for (const w of WIDTHS) {
    await open(page, "full", w);
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    const last = tool(page, "画像");
    if (w >= 768) {
      const gap = await bar(page).evaluate((e) => e.scrollWidth - e.clientWidth);
      expect(gap, `幅 ${w}：折り返して全部見える`).toBe(0);
    }
    await last.scrollIntoViewIfNeeded();
    const lb = await last.boundingBox();
    const bb = await bar(page).boundingBox();
    expect(lb!.x + lb!.width, `幅 ${w}：画像のボタンが帯の中に届く`).toBeLessThanOrEqual(bb!.x + bb!.width + 1);
    expect(await overflowX(page), `幅 ${w}：帯を送った後`).toBe(0);
    for (const name of ["見出し", "並び"]) {
      await tool(page, name).scrollIntoViewIfNeeded();
      await tool(page, name).click();
      const mb = await page.getByRole("menu", { name, exact: true }).boundingBox();
      expect(mb!.x, `幅 ${w} の ${name} のメニュー`).toBeGreaterThanOrEqual(0);
      expect(mb!.x + mb!.width, `幅 ${w} の ${name} のメニュー`).toBeLessThanOrEqual(w);
      await page.keyboard.press("Escape");
    }
    expect(await overflowX(page), `幅 ${w}：メニューを開いた後`).toBe(0);
  }
});

// ---- 下絵 v2 の帯の全体（f4v2-editor-image-off）との突き合わせ
const BAR_PAIRS: FidelityPair[] = [
  {
    name: "bar",
    role: "bar",
    canvas: ".k-f4d-bar",
    app: ".k-f4d-bar",
    props: ["height", "background-color", "border-bottom-color"],
  },
  {
    name: "btn",
    role: "btn",
    canvas: ".k-f4d-bar button",
    app: ".k-f4d-bar button",
    props: ["height", "font-size", "color", "texts"],
  },
  {
    name: "group",
    role: "group",
    canvas: ".k-f4d-bar-group + .k-f4d-bar-group",
    app: ".k-f4d-bar-group + .k-f4d-bar-group",
    props: ["border-left-color", "padding-left"],
  },
  {
    name: "image",
    role: "image",
    canvas: '.k-f4d-bar button[aria-label="画像"]',
    app: '.k-f4d-bar button[aria-label="画像"]',
    props: ["height", "opacity"],
  },
];
test("K587-UI-009 下絵との突き合わせ（f4v2-editor-image-off）：幅 375・768・1440 で帯の高さと色・23 個のボタンの高さと字・グループの区切り・薄い画像のボタンが下絵と同じ値", async ({
  browser,
}) => {
  for (const w of WIDTHS) {
    const { rows, bad } = await matchMock(
      browser,
      "f4v2-editor-image-off",
      w,
      async (page) => {
        await open(page, "plain", w);
        await expect(bar(page).getByRole("button")).toHaveCount(23);
      },
      { base: "/dev/mock/f4v2", pairs: BAR_PAIRS, blur: true },
    );
    expect(rows.length, `幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
    expect(bad, bad.join("\n")).toEqual([]);
  }
});

const isOff = async (loc: ReturnType<Page["locator"]>) => (await loc.getAttribute("aria-disabled")) === "true";
/** メニューを開き、項目 1 つの押せない形を読んで Esc で閉じる */
async function itemOff(page: Page, toolName: string, role: "menuitemradio" | "menuitemcheckbox", item: string) {
  await tool(page, toolName).click();
  const off = await isOff(
    page.getByRole("menu", { name: toolName, exact: true }).getByRole(role, { name: item, exact: true }),
  );
  await page.keyboard.press("Escape");
  return off;
}
const CELL_AND_QUOTE_AND_ITEM = [
  ["表のセル", (page: Page) => body(page).locator("td").first()],
  ["引用", (page: Page) => body(page).locator("blockquote p").first()],
  ["箇条書きの項目", (page: Page) => body(page).getByText("明細を集める", { exact: true })],
  ["チェックの項目", (page: Page) => body(page).getByText("送った", { exact: true })],
] as const;
const IN_LIST = new Set(["箇条書きの項目", "チェックの項目"]);

test("K587-UI-010 置けない場所では押せない形：表のセル・引用の中にカーソルを置くと『区切りの線』が aria-disabled・『見出し』のメニューの見出し 1・2・3 と『並び』のメニューの番号つきの項目が aria-disabled（本文は押せる）で、押しても文書は変わらない。箇条書きの項目・チェックの項目の中では『区切りの線』と見出し 1・2・3 が押せない形で番号つきは押せ、チェックの項目の中で番号つきを押すと並びの種類が番号つきに替わって文書は通る（置ける場所は K-584 と同じ）", async ({
  page,
}) => {
  await open(page, "full");
  for (const [name, where] of CELL_AND_QUOTE_AND_ITEM) {
    await where(page).click();
    await expect(tool(page, "区切りの線"), name).toHaveAttribute("aria-disabled", "true");
    const before = JSON.stringify(await outDoc(page));
    await tool(page, "区切りの線").click({ force: true });
    expect(JSON.stringify(await outDoc(page)), `${name}：押しても変わらない`).toBe(before);
    for (const h of ["見出し 1", "見出し 2", "見出し 3"])
      expect(await itemOff(page, "見出し", "menuitemradio", h), `${name}：${h}`).toBe(true);
    expect(await itemOff(page, "見出し", "menuitemradio", "本文"), `${name}：本文`).toBe(false);
    expect(await itemOff(page, "並び", "menuitemcheckbox", "番号つき"), `${name}：番号つき`).toBe(!IN_LIST.has(name));
    await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
  }
  await body(page).locator("td").first().click();
  const cellBefore = JSON.stringify(await outDoc(page));
  await tool(page, "並び").click();
  await page.getByRole("menuitemcheckbox", { name: "番号つき", exact: true }).click({ force: true });
  expect(JSON.stringify(await outDoc(page))).toBe(cellBefore);
  // チェックの項目の中で『番号つき』：入れ子にせず、並びの種類を付け替える（taskItem の中に並びは置けない）
  await body(page).getByText("送った", { exact: true }).click();
  await tool(page, "並び").click();
  await page.getByRole("menuitemcheckbox", { name: "番号つき", exact: true }).click();
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "taskItem").length).toBe(0);
  const after = await outDoc(page);
  expect(
    find(after, (n) => n.type === "orderedList").some((l) => JSON.stringify(l).includes("送った")),
    "チェックの項目だった字が番号つきの並びの中に在る",
  ).toBe(true);
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
});

test("K587-UI-011 置ける場所に戻すと押せる：引用を段落に戻す（引用の道具をもう一度押す）と『区切りの線』と見出し 1・2・3・番号つきが押せる形に戻り、押すと文書は validateDoc を通る形のまま。コードの囲みの中では『左寄せ』『中央』『右寄せ』『両端』が押せない形で、段落に戻すと押せる", async ({
  page,
}) => {
  await open(page, "empty");
  await typeFresh(page, "先月と同じ");
  await tool(page, "引用").click();
  await expect(tool(page, "区切りの線")).toHaveAttribute("aria-disabled", "true");
  await tool(page, "引用").click();
  await expect(tool(page, "区切りの線")).not.toHaveAttribute("aria-disabled", "true");
  expect(await itemOff(page, "見出し", "menuitemradio", "見出し 1")).toBe(false);
  expect(await itemOff(page, "並び", "menuitemcheckbox", "番号つき")).toBe(false);
  await tool(page, "区切りの線").click();
  await expect.poll(async () => find(await outDoc(page), (n) => n.type === "horizontalRule").length).toBe(1);
  await expect(page.getByTestId("doc-verdict")).toHaveText("ok");
  await typeFresh(page, "a = 1");
  await tool(page, "コードの囲み").click();
  for (const name of ["左寄せ", "中央", "右寄せ", "両端"])
    await expect(tool(page, name), `コードの中：${name}`).toHaveAttribute("aria-disabled", "true");
  await tool(page, "コードの囲み").click();
  for (const name of ["左寄せ", "中央", "右寄せ", "両端"])
    await expect(tool(page, name), `段落：${name}`).not.toHaveAttribute("aria-disabled", "true");
});
