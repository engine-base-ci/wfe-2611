// K-696「管理 › 見直すページ（使われていない・食い違っている・よく破られる）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/kn-review（本番と同じ部品 features/F9/knowledge・K-671・代表 OK 2026-11-22）。モックとの比べ方は f9-match.ts の matchF9（見る役は状態ごとに絞る）。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。ナレッジの口だけ網の手前で差し替える（knowledge-mock.ts）。見直すページの口は knowledge-review-mock.ts が足し、
//   管理の入口の行き来は承認待ちの口（knowledge-approvals-mock.ts・K-694）と一緒に使う。本人の Bridge（127.0.0.1:38617）は届かせない。
//   答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章と K-695 の md。固定の待ちは使わない（口の数と答えを待つ・答えは hold() で止める）。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { mockApprovals } from "./knowledge-approvals-mock";
import { F9_WIDTHS, matchF9 } from "./f9-match";
import {
  err,
  mockKnowledge,
  msg,
  pageInvoice,
  P_INVOICE,
  P_QUOTE,
  type KMock,
  type PageAnswer,
} from "./knowledge-mock";
import {
  B1,
  B2,
  B3,
  U1,
  U2,
  U3,
  U4,
  mockReview,
  pageLower,
  pageReadOnly,
  pageUpper,
  reviewAnswer,
  type RMock,
} from "./knowledge-review-mock";

const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const REVIEW = "/knowledge?view=admin&list=review";
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const first = (s: string) => s.split("。")[0]!;
const adminTab = (p: Page) => p.getByRole("tab", { name: /^管理/ });
const navItem = (p: Page, label: string) => p.locator(".k-f9-adminnav-i", { hasText: label });
const block = (p: Page, id: "rv-unused" | "rv-conflict" | "rv-broken") =>
  p.locator("section.k-f9-rv", { has: p.locator(`#${id}`) });
const rowOf = (b: Locator, text: string) => b.locator("li.k-f9-row", { hasText: text });
const heading = (p: Page) => p.getByRole("heading", { level: 1, name: "見直すページ", exact: true });
const finish = (p: Page) => p.getByRole("button", { name: "書き終える", exact: true });
const UPPER_TEXT = "月末締め・翌月末払い。";
const LOWER_TEXT = "月末締め・翌々月 10 日払い。";

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

const pageAt = (id: string, title: string, acts: string[] = ["must-on", "edit"]): PageAnswer =>
  pageInvoice({ id, title, must: false, acts });
interface Setup {
  mk: KMock;
  rv: RMock;
}
async function setup(page: Page): Promise<Setup> {
  const mk = await mockKnowledge(page, {
    pages: [
      pageUpper(),
      pageLower(),
      pageAt(U1, "年賀状の送り先"),
      pageAt(U2, "旧：見積書のひな形（2024）"),
      pageAt(U3, "展示会の持ち物"),
      pageAt(U4, "名刺の発注のしかた"),
      pageReadOnly(B1),
      pageAt(B2, "外に出す前の確かめ"),
      pageAt(B3, "値引きの決まり"),
    ],
  });
  await mockApprovals(page, mk);
  const rv = await mockReview(page, mk);
  return { mk, rv };
}
async function openReview(page: Page, width = 1440, url = REVIEW): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(url);
  await expect(heading(page)).toBeVisible();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const prop = (role: string, sel: string, props: string[]) => ({ name: role, role, canvas: sel, app: sel, props });
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const PAIRS = [
  prop("rv", ".k-f9-rv", [...BOX, "texts"]),
  prop("rv-h2", ".k-f9-rv-head h2", ["x", "y", ...TEXT]),
  prop("row", ".k-f9-row", ["width", "height", "x", "y", "texts"]),
  prop("row-btn", ".k-f9-row button", CTRL),
  prop("row-point", ".k-f9-row-point", ["x", "font-size", "color", "texts"]),
  prop("nav", ".k-f9-adminnav-i", ["x", "height", "texts"]),
];
for (const w of F9_WIDTHS) {
  test(`K696-UI-001 kn-review 幅 ${w}：見直すページ（使われていない 4・食い違い 1・よく破られる 3）の位置と大きさと字がモックと同じ（matchF9 の bad が 0）`, async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const { bad, rows } = await matchF9(
      browser,
      "kn-review",
      w,
      async (page) => {
        await setup(page);
        await openReview(page, w);
        await expect(block(page, "rv-broken").locator("li.k-f9-row")).toHaveCount(3);
      },
      { pairs: PAIRS },
    );
    expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

// ---------------------------------------------------------------- 入口
test("K696-UI-002 管理の入口の「見直すページ」は押せる：「管理」から承認待ちが開いた後に押すと /knowledge?view=admin&list=review に移り、見直すページの口 1 回・見出し「見直すページ」・入口がいまの一覧（aria-current）。承認待ちの口は増えない", async ({
  page,
}) => {
  const { rv } = await setup(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto("/knowledge");
  await adminTab(page).click();
  await expect(page.getByRole("heading", { level: 1, name: "承認待ち", exact: true })).toBeVisible();
  expect(rv.count("review")).toBe(0);
  const item = navItem(page, "見直すページ");
  await expect(item).not.toHaveAttribute("aria-disabled", "true");
  await item.click();
  await expect(page).toHaveURL(/\/knowledge\?view=admin&list=review$/);
  await expect(heading(page)).toBeVisible();
  await expect(navItem(page, "見直すページ")).toHaveAttribute("aria-current", "page");
  expect(rv.count("review")).toBe(1);
});

test("K696-UI-003 直に開く：/knowledge?view=admin&list=review は木の口 1 回・見直すページの口 1 回で開き、再読み込みでも同じ（各 1 回ずつ増える）。知らない list は承認待ち", async ({
  page,
}) => {
  const { mk, rv } = await setup(page);
  await openReview(page);
  expect(mk.count("tree")).toBe(1);
  expect(rv.count("review")).toBe(1);
  await page.reload();
  await expect(heading(page)).toBeVisible();
  expect(mk.count("tree")).toBe(2);
  expect(rv.count("review")).toBe(2);
  await page.goto("/knowledge?view=admin&list=zzz");
  await expect(page.getByRole("heading", { level: 1, name: "承認待ち", exact: true })).toBeVisible();
});

test("K696-UI-004 見られない人（木の答えの admin_counts が無い）：直に見直すページの道を開くと「見られない」（E-PAGE-002）で、見直すページの口は 0 回・「戻る」で /knowledge に移る", async ({
  page,
}) => {
  const { mk, rv } = await setup(page);
  mk.tree.admin_counts = null;
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto(REVIEW);
  await expect(page.getByText(first(msg("E-PAGE-002")), { exact: false })).toBeVisible();
  expect(rv.count("review")).toBe(0);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
});

// ---------------------------------------------------------------- 3 つの一覧
test("K696-UI-005 3 つの一覧：見出しの数が 4・1・3・行は題名・場所・字（「AI が最後に開いた：2025/12/20」「…1 度も無い」・食い違いの点・「7 回」と「いちばん多い：…」）で、上の棚が左・下の棚が右の組になる", async ({
  page,
}) => {
  await setup(page);
  await openReview(page);
  await expect(block(page, "rv-unused").getByRole("heading", { level: 2 })).toHaveText(/使われていないページ\s*4/);
  await expect(block(page, "rv-conflict").getByRole("heading", { level: 2 })).toHaveText(/食い違っているページ\s*1/);
  await expect(block(page, "rv-broken").getByRole("heading", { level: 2 })).toHaveText(/よく破られる決まり\s*3/);
  const u = block(page, "rv-unused");
  await expect(rowOf(u, "年賀状の送り先")).toContainText("会社 › お客さま対応");
  await expect(rowOf(u, "年賀状の送り先")).toContainText("AI が最後に開いた：2025/12/20");
  await expect(rowOf(u, "旧：見積書のひな形（2024）")).toContainText("AI が最後に開いた：1 度も無い");
  const c = block(page, "rv-conflict").locator("li.k-f9-row");
  await expect(c).toContainText("請求書の送り方");
  await expect(c).toContainText("会社 › 経理");
  await expect(c).toContainText("見積書の出し方");
  await expect(c).toContainText(
    "支払期日：会社は「月末締め・翌月末払い」、営業は「月末締め・翌々月 10 日払い」と書いてあります",
  );
  const b = rowOf(block(page, "rv-broken"), "メールの書き方");
  await expect(b).toContainText("7");
  await expect(b).toContainText("回");
  await expect(b).toContainText("いちばん多い：件名に【 】の種類が入っていない（5 回）");
  await expect(navItem(page, "見直すページ")).toContainText("8");
});

test("K696-UI-006 AI が最後に開いた日は日本時間：UTC で 6/1 の 15:30 は 2026/06/02・null は「1 度も無い」。口が返した場所の字（会社 › お客さま対応）はそのまま出る", async ({
  page,
}) => {
  const { rv } = await setup(page);
  rv.answer.unused = [
    { id: U1, title: "日付をまたぐ", place: "会社 › お客さま対応", last_opened_at: "2026-06-01T15:30:00Z" },
    { id: U2, title: "一度も開かれない", place: "会社", last_opened_at: null },
  ];
  rv.syncCount();
  await openReview(page);
  await expect(rowOf(block(page, "rv-unused"), "日付をまたぐ")).toContainText("AI が最後に開いた：2026/06/02");
  await expect(rowOf(block(page, "rv-unused"), "一度も開かれない")).toContainText("AI が最後に開いた：1 度も無い");
});

// ---------------------------------------------------------------- 開く・書き方を直す
test("K696-UI-007 「開く」：押すとそのページ /knowledge/<id> に移り、ページの口 1 回・題名が見出しに出る（見直すページの口は増えない）", async ({
  page,
}) => {
  const { mk, rv } = await setup(page);
  await openReview(page);
  await rowOf(block(page, "rv-unused"), "年賀状の送り先").getByRole("button", { name: "開く", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${U1}$`));
  await expect(page.getByRole("heading", { level: 1, name: "年賀状の送り先", exact: true })).toBeVisible();
  expect(mk.count("page", U1)).toBe(1);
  expect(rv.count("review")).toBe(1);
});

test("K696-UI-008 「書き方を直す」：押すとそのページが書いている画面で開く（/knowledge/<id>?edit=1 → 道から edit が外れる）。保存・下書きの口は 0 回で、再読み込みすると読む形に戻る", async ({
  page,
}) => {
  const { mk } = await setup(page);
  await openReview(page);
  await rowOf(block(page, "rv-broken"), "外に出す前の確かめ")
    .getByRole("button", { name: "書き方を直す", exact: true })
    .click();
  await expect(finish(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${B2}$`));
  expect(mk.count("save")).toBe(0);
  expect(mk.count("createPage")).toBe(0);
  expect(mk.count("page", B2)).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "外に出す前の確かめ", exact: true })).toBeVisible();
  await expect(finish(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "直す", exact: true })).toBeVisible();
});

test("K696-UI-009 書けないページ（acts に edit が無い）で「書き方を直す」：読む形のまま開き、「書き終える」は出ず、保存の口は 0 回", async ({
  page,
}) => {
  const { mk } = await setup(page);
  await openReview(page);
  await rowOf(block(page, "rv-broken"), "メールの書き方")
    .getByRole("button", { name: "書き方を直す", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "メールの書き方", exact: true })).toBeVisible();
  await expect(finish(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "直す", exact: true })).toHaveCount(0);
  expect(mk.count("save")).toBe(0);
});

// ---------------------------------------------------------------- 並べて見る
const compare = (p: Page) => block(p, "rv-conflict").getByRole("button", { name: /並べて見る/ });
const pairRegion = (p: Page) => p.getByRole("region", { name: "2 つのページを並べて見る" });

test("K696-UI-010 「並べて見る」：押すとその行の下で上のページと下のページの本文が並ぶ（ページの口は 2 ページに 1 回ずつ・aria-expanded）。もう一度押すと閉じ、開き直しても読み直さない", async ({
  page,
}) => {
  const { mk } = await setup(page);
  await openReview(page);
  const btn = compare(page);
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  await btn.click();
  await expect(pairRegion(page)).toContainText(UPPER_TEXT);
  await expect(pairRegion(page)).toContainText(LOWER_TEXT);
  await expect(pairRegion(page)).toContainText("請求書の送り方");
  await expect(pairRegion(page)).toContainText("見積書の出し方");
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  expect(mk.count("page", P_INVOICE)).toBe(1);
  expect(mk.count("page", P_QUOTE)).toBe(1);
  await btn.click();
  await expect(pairRegion(page)).toHaveCount(0);
  await btn.click();
  await expect(pairRegion(page)).toContainText(LOWER_TEXT);
  expect(mk.count("page", P_INVOICE)).toBe(1);
  expect(mk.count("page", P_QUOTE)).toBe(1);
});

test("K696-UI-011 並べて見るの片方が読めない：下のページが無い（404）ならその列だけ「見られません」（E-PAGE-002）で上は読める。503 なら 1 つの列に E-PAGE-003 の文と「もう一度読む」が出て、押すと読み直して両方の本文が並ぶ", async ({
  page,
}) => {
  const { mk } = await setup(page);
  await openReview(page);
  mk.pages.delete(P_QUOTE);
  await compare(page).click();
  await expect(pairRegion(page)).toContainText(UPPER_TEXT);
  await expect(pairRegion(page).getByText(first(msg("E-PAGE-002")), { exact: false })).toBeVisible();
  await compare(page).click();
  await expect(pairRegion(page)).toHaveCount(0);
  await page.reload();
  await expect(heading(page)).toBeVisible();
  mk.pages.set(P_QUOTE, pageLower());
  mk.script("page", err(503, "E-PAGE-003"));
  const before = mk.count("page");
  await compare(page).click();
  await expect(pairRegion(page).getByText(first(msg("E-PAGE-003")), { exact: false })).toBeVisible();
  await pairRegion(page).getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(pairRegion(page)).toContainText(UPPER_TEXT);
  await expect(pairRegion(page)).toContainText(LOWER_TEXT);
  expect(mk.count("page") - before).toBe(3);
});

test("K696-UI-012 二度押し：答えを止めた間に「並べて見る」を開く・閉じる・開くを続けても、ページの口は 2 ページに 1 回ずつで、答えが来ると両方の本文が出る", async ({
  page,
}) => {
  const { mk } = await setup(page);
  await openReview(page);
  const release = mk.hold("page");
  const btn = compare(page);
  await btn.click();
  await btn.click();
  await btn.click();
  release();
  await expect(pairRegion(page)).toContainText(UPPER_TEXT);
  await expect(pairRegion(page)).toContainText(LOWER_TEXT);
  expect(mk.count("page", P_INVOICE)).toBe(1);
  expect(mk.count("page", P_QUOTE)).toBe(1);
});

// ---------------------------------------------------------------- 読めない・空・50 件
for (const [name, reply, code, retry] of [
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003", true],
  ["網の切れ", "network", "E-PAGE-007", true],
  ["403 権限が外れた", err(403, "FORBIDDEN"), "E-PAGE-002", false],
] as const)
  test(`K696-UI-013 見直すページの口が失敗（${name}）：本文の場所に ${code} の文${retry ? "と「もう一度読む」・押すと読み直して 3 つの一覧が出る（口 2 回）" : "（見られない・口は 1 回）"}。木と管理の入口はそのまま`, async ({
    page,
  }) => {
    const { rv } = await setup(page);
    rv.script(reply);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, owner.token);
    await page.goto(REVIEW);
    await expect(page.getByText(first(msg(code)), { exact: false })).toBeVisible();
    await expect(navItem(page, "見直すページ")).toBeVisible();
    if (!retry) return void expect(rv.count("review")).toBe(1);
    await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
    await expect(block(page, "rv-unused").locator("li.k-f9-row")).toHaveCount(4);
    expect(rv.count("review")).toBe(2);
  });

test("K696-UI-014 何も無い：3 つの一覧にそれぞれ「使われていないページはありません」「食い違っているページはありません」「よく破られる決まりはありません」が出て、見出しの数は 0", async ({
  page,
}) => {
  const { rv } = await setup(page);
  rv.answer = { unused: [], conflicts: [], broken: [] };
  rv.syncCount();
  await openReview(page);
  await expect(page.getByText("使われていないページはありません", { exact: true })).toBeVisible();
  await expect(page.getByText("食い違っているページはありません", { exact: true })).toBeVisible();
  await expect(page.getByText("よく破られる決まりはありません", { exact: true })).toBeVisible();
  await expect(block(page, "rv-unused").getByRole("heading", { level: 2 })).toHaveText(/使われていないページ\s*0/);
  await expect(page.locator("li.k-f9-row")).toHaveCount(0);
});

test("K696-UI-015 50 件ちょうどの一覧にだけ「多い順に 50 件まで出しています。」が出る：使われていないが 50 件なら 1 つ・49 件なら出ない", async ({
  page,
}) => {
  const { rv } = await setup(page);
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `0193c5a0-0000-7000-8000-${String(0xd700 + i).padStart(12, "0")}`,
      title: `ページ ${i + 1}`,
      place: "会社",
      last_opened_at: null,
    }));
  rv.answer.unused = many(50);
  rv.syncCount();
  await openReview(page);
  await expect(page.getByText("多い順に 50 件まで出しています。", { exact: true })).toHaveCount(1);
  rv.answer.unused = many(49);
  await page.reload();
  await expect(block(page, "rv-unused").locator("li.k-f9-row")).toHaveCount(49);
  await expect(page.getByText("多い順に 50 件まで出しています。", { exact: true })).toHaveCount(0);
});

test("K696-UI-016 題名・場所・点・破られ方・本文に HTML が入っていても、文字として出て動かない（img も作られない）", async ({
  page,
}) => {
  const evil = '<img src=x onerror="window.__x=1">';
  const { rv, mk } = await setup(page);
  rv.answer.unused[0] = { ...rv.answer.unused[0]!, title: evil, place: evil };
  rv.answer.conflicts[0] = {
    ...rv.answer.conflicts[0]!,
    upper: { ...rv.answer.conflicts[0]!.upper, title: evil },
    point: evil,
  };
  rv.answer.broken[0] = { ...rv.answer.broken[0]!, title: evil, how: evil };
  mk.pages.set(P_INVOICE, {
    ...pageUpper(),
    body: {
      doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: evil }] }] },
      text: evil,
    },
  });
  await openReview(page);
  await expect(page.getByText(evil, { exact: false }).first()).toBeVisible();
  await compare(page).click();
  await expect(pairRegion(page)).toContainText(evil);
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator(".k-f9-main img").count()).toBe(0);
});

for (const w of WIDTHS) {
  test(`K696-UI-017 幅 ${w}：長い題名・場所・点・破られ方と、並べて見るを開いた形でも横のはみ出し 0（数値）${w <= 1023 ? "・木の引き出しから「見直すページ」を選ぶと引き出しが閉じる" : ""}`, async ({
    page,
  }) => {
    const long = "とても長い題名のページ".repeat(5);
    const { rv } = await setup(page);
    rv.answer.unused[0] = { ...rv.answer.unused[0]!, title: long, place: long };
    rv.answer.conflicts[0] = { ...rv.answer.conflicts[0]!, point: long.repeat(3) };
    rv.answer.broken[0] = { ...rv.answer.broken[0]!, title: long, how: long.repeat(3) };
    await openReview(page, w);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await compare(page).click();
    await expect(pairRegion(page)).toContainText(UPPER_TEXT);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    if (w <= 1023) {
      await page.getByRole("button", { name: "木を開く", exact: true }).click();
      await expect(page.locator(".k-f9-scrim")).toBeVisible();
      await navItem(page, "見直すページ").click();
      await expect(page.locator(".k-f9-scrim")).toHaveCount(0);
    }
  });
}

test("K696-UI-018 キーボードだけ：見直すページの入口に焦点して Enter で開き、「並べて見る」を Enter で開閉（aria-expanded）、「開く」を Enter でそのページへ移る", async ({
  page,
}) => {
  const { mk } = await setup(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto("/knowledge?view=admin&list=approvals");
  await expect(page.getByRole("heading", { level: 1, name: "承認待ち", exact: true })).toBeVisible();
  await navItem(page, "見直すページ").focus();
  await page.keyboard.press("Enter");
  await expect(heading(page)).toBeVisible();
  const btn = compare(page);
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  const open = rowOf(block(page, "rv-unused"), "名刺の発注のしかた").getByRole("button", { name: "開く", exact: true });
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/knowledge/${U4}$`));
  expect(mk.count("page", U4)).toBe(1);
});

test("K696-UI-019 管理の入口の数と見出しの数：入口の「見直すページ」の数（木の admin_counts.review）が 3 つの見出しの数の合計と同じ（8）。答えを 1 件ずつ減らして読み直すと両方が同じだけ減る", async ({
  page,
}) => {
  const { rv } = await setup(page);
  await openReview(page);
  const total = async () => {
    let n = 0;
    for (const id of ["rv-unused", "rv-conflict", "rv-broken"] as const)
      n += Number((await block(page, id).getByRole("heading", { level: 2 }).textContent())!.replace(/\D/g, ""));
    return n;
  };
  expect(await total()).toBe(8);
  await expect(navItem(page, "見直すページ")).toContainText("8");
  rv.answer = { ...reviewAnswer(), unused: reviewAnswer().unused.slice(0, 2) };
  rv.syncCount();
  await page.reload();
  await expect(block(page, "rv-unused").locator("li.k-f9-row")).toHaveCount(2);
  expect(await total()).toBe(6);
  await expect(navItem(page, "見直すページ")).toContainText("6");
});

test("K696-UI-020 行き来：見直すページ → 承認待ち → 見直すページと戻っても、見直すページの口は 1 回のまま（開いたとき 1 回・窓に戻っても読み直さない）", async ({
  page,
}) => {
  const { rv } = await setup(page);
  await openReview(page);
  expect(rv.count("review")).toBe(1);
  await navItem(page, "承認待ち").click();
  await expect(page.getByRole("heading", { level: 1, name: "承認待ち", exact: true })).toBeVisible();
  await navItem(page, "見直すページ").click();
  await expect(heading(page)).toBeVisible();
  await expect(block(page, "rv-unused").locator("li.k-f9-row")).toHaveCount(4);
  expect(rv.count("review")).toBe(1);
});
