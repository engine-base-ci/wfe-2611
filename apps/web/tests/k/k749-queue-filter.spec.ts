// K-749「画面：承認待ちの絞り込みの札と並べ替え（道に残す・0 件のとき・スマホの札）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5/queue-filter-*（代表が OK を出した段 6 の下絵）。字・並びは下絵が正。
//   土台は approve-complete.harness.ts の mockApi。一覧の口 listApprovalQueue（K-748 の kind・sort・counts）は m.on.queue を差し替えて、問い合わせを控える。
//   固定の待ちは使わない。name は exact。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { mockApi, openQueue, qrow, type Mock } from "../features/F5/approve-complete.harness";
import { WIDTHS, layer, noOverflow, type Writes } from "./f5-more-kit";
import { matchMock } from "./stage2-match";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const ART = [
  qrow("0193c5a0-0000-7000-8000-0000000a0201", { title: "見積を出す" }),
  qrow("0193c5a0-0000-7000-8000-0000000a0202", { title: "請求書を送る" }),
];
const HAND = [
  qrow("0193c5a0-0000-7000-8000-0000000a0203", { kind: "handover", title: "渡された行", check_summary: "" }),
];

interface Q {
  m: Mock;
  w: Writes;
  asked: URLSearchParams[];
  counts: Record<string, number>;
  empty: boolean;
  cursor: string | null;
  fail: boolean;
}
async function mockQueue(page: Page, o: Partial<Pick<Q, "counts" | "empty" | "cursor">> = {}): Promise<Q> {
  const m = await mockApi(page);
  const q: Q = {
    m,
    w: undefined as unknown as Writes,
    asked: [],
    counts: o.counts ?? { total: 9, artifact: 6, handover: 3 },
    empty: o.empty ?? false,
    cursor: o.cursor ?? null,
    fail: false,
  };
  m.on.queue = (req) => {
    const sp = new URL(req.url()).searchParams;
    q.asked.push(sp);
    if (q.fail) return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
    const kind = sp.get("kind");
    const rows = q.empty ? [] : kind === "handover" ? HAND : kind === "artifact" ? ART : [...ART, ...HAND];
    const meta: Record<string, unknown> = { limit: 20, counts: q.counts };
    if (q.cursor && !sp.get("cursor")) meta["cursor"] = q.cursor;
    return { status: 200, body: { data: rows, meta } };
  };
  q.w = await layer(page, () => null);
  return q;
}
const chips = (page: Page) =>
  page
    .getByRole("region", { name: "承認待ちの一覧", exact: true })
    .getByRole("group", { name: "絞り込み", exact: true })
    .getByRole("button");
const chip = (page: Page, label: string) => chips(page).filter({ hasText: label });
const sortBtn = (page: Page) => page.getByRole("button", { name: /▾$/ });
const last = (q: Q) => q.asked.at(-1)!;
const qs = (sp: URLSearchParams) => Object.fromEntries([...sp.entries()]);

test("K749-UI-001 入口：承認待ちを開くと札が順に「すべて 9」「AI の成果物 6」「渡された 3」「上位の承認」「判断を仰がれた」。「すべて」が押された形。押せない 2 つは aria-disabled・title「まだ使えません」。「決まりの例外」「やり方を広げる」は無い", async ({
  page,
}) => {
  await mockQueue(page);
  await openQueue(page);
  await expect(chips(page)).toHaveText([
    /^すべて\s*9$/,
    /^AI の成果物\s*6$/,
    /^渡された\s*3$/,
    "上位の承認",
    "判断を仰がれた",
  ]);
  await expect(chip(page, "すべて").locator(".k-more-count")).toHaveText("9");
  await expect(chip(page, "すべて")).toHaveAttribute("aria-pressed", "true");
  // 読み上げの名前は「字 数」（前からの仕様の表の行「すべて 3」と同じ形・K63-UI-000）
  for (const n of ["すべて 9", "AI の成果物 6", "渡された 3"])
    await expect(chips(page).and(page.getByRole("button", { name: n, exact: true }))).toHaveCount(1);
  for (const n of ["上位の承認", "判断を仰がれた"]) {
    await expect(chip(page, n)).toHaveAttribute("aria-disabled", "true");
    await expect(chip(page, n)).toHaveAttribute("title", "まだ使えません");
  }
  await expect(page.getByText(/決まりの例外|やり方を広げる/)).toHaveCount(0);
});

test("K749-UI-002 入力：「渡された」を押すと道が ?kind=handover になり、一覧の口に kind=handover で 1 回（sort は付かない）。「渡された」だけが押された形・表は答えの行・札の数は同じ", async ({
  page,
}) => {
  const q = await mockQueue(page);
  await openQueue(page);
  const n = q.asked.length;
  await chip(page, "渡された").click();
  await expect(page).toHaveURL(/\/approvals\?kind=handover$/);
  await expect.poll(() => q.asked.length).toBe(n + 1);
  expect(qs(last(q))).toEqual({ kind: "handover" });
  await expect(chip(page, "渡された")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "すべて")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("row").filter({ hasText: "渡された行" })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: "見積を出す" })).toHaveCount(0);
  await expect(chip(page, "すべて").locator(".k-more-count")).toHaveText("9");
});

test("K749-UI-003 入力：「すべて」に戻すと道から kind が消え、一覧の口は問い合わせなしで読み直す", async ({ page }) => {
  const q = await mockQueue(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/approvals?kind=handover");
  await expect(chip(page, "渡された")).toHaveAttribute("aria-pressed", "true");
  await chip(page, "すべて").click();
  await expect(page).toHaveURL(/\/approvals$/);
  await expect.poll(() => qs(last(q))).toEqual({});
});

test("K749-UI-004 入口：/approvals?kind=artifact&sort=title を直に開くと「AI の成果物」が押された形・並べ替えは「題名の順 ▾」・一覧の口は kind=artifact と sort=title の 1 回だけ", async ({
  page,
}) => {
  const q = await mockQueue(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/approvals?kind=artifact&sort=title");
  await expect(chip(page, "AI の成果物")).toHaveAttribute("aria-pressed", "true");
  await expect(sortBtn(page)).toHaveText("題名の順 ▾");
  await expect.poll(() => q.asked.length).toBe(1);
  expect(qs(q.asked[0]!)).toEqual({ kind: "artifact", sort: "title" });
});

test("K749-UI-005 入口：並べ替えのボタン「期限の近い順 ▾」を押すと aria-expanded が true になり、listbox「並べ替え」に 3 つの option（期限の近い順が選ばれた形）。口は増えない", async ({
  page,
}) => {
  const q = await mockQueue(page);
  await openQueue(page);
  const n = q.asked.length;
  await expect(sortBtn(page)).toHaveText("期限の近い順 ▾");
  await expect(sortBtn(page)).toHaveAttribute("aria-expanded", "false");
  await sortBtn(page).click();
  await expect(sortBtn(page)).toHaveAttribute("aria-expanded", "true");
  const box = page.getByRole("listbox", { name: "並べ替え", exact: true });
  await expect(box.getByRole("option")).toHaveText(["期限の近い順", "新しく承認待ちになった順", "題名の順"]);
  await expect(box.getByRole("option", { name: "期限の近い順", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(q.asked.length).toBe(n);
});

test("K749-UI-006 入力：「新しく承認待ちになった順」を選ぶと道が ?sort=waiting・一覧の口に sort=waiting で 1 回・箱が閉じ・ボタンが「新しく承認待ちになった順 ▾」", async ({
  page,
}) => {
  const q = await mockQueue(page);
  await openQueue(page);
  await sortBtn(page).click();
  await page.getByRole("option", { name: "新しく承認待ちになった順", exact: true }).click();
  await expect(page).toHaveURL(/\/approvals\?sort=waiting$/);
  await expect.poll(() => qs(last(q))).toEqual({ sort: "waiting" });
  await expect(page.getByRole("listbox", { name: "並べ替え", exact: true })).toHaveCount(0);
  await expect(sortBtn(page)).toHaveText("新しく承認待ちになった順 ▾");
});

test("K749-UI-007 入力：札「渡された」のまま「題名の順」を選ぶと、道にも口にも kind=handover と sort=title の両方", async ({
  page,
}) => {
  const q = await mockQueue(page);
  await openQueue(page);
  await chip(page, "渡された").click();
  await sortBtn(page).click();
  await page.getByRole("option", { name: "題名の順", exact: true }).click();
  await expect(page).toHaveURL(/kind=handover/);
  await expect(page).toHaveURL(/sort=title/);
  await expect.poll(() => qs(last(q))).toEqual({ kind: "handover", sort: "title" });
});

test("K749-UI-008 操作の揺れ：続きがあるとき「もっと見る」の口は今の kind と cursor を両方持ち、札を替えた後の口は cursor を持たない（頭から）", async ({
  page,
}) => {
  const q = await mockQueue(page, { cursor: "bzEy" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/approvals?kind=artifact");
  await page.getByRole("button", { name: "もっと見る", exact: true }).click();
  await expect.poll(() => qs(last(q))).toEqual({ kind: "artifact", cursor: "bzEy" });
  await chip(page, "渡された").click();
  await expect.poll(() => qs(last(q))).toEqual({ kind: "handover" });
});

test("K749-UI-009 対象の状態：「渡された」で 0 件なら、札は残り本文に「「渡された」で決めるものはありません」・「ほかの札には、決めるものが残っています」・［すべてに戻す］。［すべてに戻す］で道から kind が消えて読み直す", async ({
  page,
}) => {
  const q = await mockQueue(page);
  await openQueue(page);
  q.empty = true;
  await chip(page, "渡された").click();
  await expect(page.getByRole("heading", { name: "「渡された」で決めるものはありません" })).toBeVisible();
  await expect(page.getByText("ほかの札には、決めるものが残っています", { exact: true })).toBeVisible();
  await expect(page.getByText("いま決めるものはありません", { exact: true })).toHaveCount(0);
  q.empty = false;
  await page.getByRole("button", { name: "すべてに戻す", exact: true }).click();
  await expect(page).toHaveURL(/\/approvals$/);
  await expect.poll(() => qs(last(q))).toEqual({});
});

test("K749-UI-010 入力：/approvals?kind=foo&sort= を開くと「すべて」が押された形・並べ替えは「期限の近い順 ▾」・一覧の口に kind も sort も付かない", async ({
  page,
}) => {
  const q = await mockQueue(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/approvals?kind=foo&sort=");
  await expect(chip(page, "すべて")).toHaveAttribute("aria-pressed", "true");
  await expect(sortBtn(page)).toHaveText("期限の近い順 ▾");
  await expect.poll(() => q.asked.length).toBe(1);
  expect(q.asked[0]!.get("kind")).toBeNull();
  expect(q.asked[0]!.get("sort")).toBeNull();
});

test("K749-UI-011 入力：前の口の答え（counts が total だけ）なら、札「すべて 3」には数、「AI の成果物」「渡された」は字だけで数の span が無い", async ({
  page,
}) => {
  await mockQueue(page, { counts: { total: 3 } });
  await openQueue(page);
  await expect(chip(page, "すべて").locator(".k-more-count")).toHaveText("3");
  for (const n of ["AI の成果物", "渡された"]) {
    await expect(chip(page, n)).toHaveText(n);
    await expect(chip(page, n).locator(".k-more-count")).toHaveCount(0);
  }
});

test("K749-UI-012 失敗：札を押した後の一覧の口が 503 なら「承認待ちを読み込めませんでした。もう一度お試しください」と［もう一度］。［もう一度］で同じ kind で読み直す", async ({
  page,
}) => {
  const q = await mockQueue(page);
  await openQueue(page);
  q.fail = true;
  await chip(page, "渡された").click();
  await expect(page.getByText("承認待ちを読み込めませんでした。もう一度お試しください", { exact: true })).toBeVisible();
  q.fail = false;
  await page.getByRole("button", { name: "もう一度", exact: true }).click();
  await expect.poll(() => qs(last(q))).toEqual({ kind: "handover" });
  await expect(page.getByRole("row").filter({ hasText: "渡された行" })).toHaveCount(1);
});

test("K749-UI-013 画面：キーボードだけで札を Tab でたどれ（押せない 2 つは飛ばす）Enter で押せる。並べ替えのボタンで Enter → ↓↓ → Enter で「題名の順」。Esc で箱が閉じて焦点はボタンへ", async ({
  page,
}) => {
  const q = await mockQueue(page);
  await openQueue(page);
  await chip(page, "すべて").focus();
  await page.keyboard.press("Tab");
  await expect(chip(page, "AI の成果物")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(chip(page, "渡された")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(chip(page, "上位の承認")).not.toBeFocused();
  await expect(chip(page, "判断を仰がれた")).not.toBeFocused();
  await chip(page, "渡された").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/kind=handover/);
  await sortBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox", { name: "並べ替え", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox", { name: "並べ替え", exact: true })).toHaveCount(0);
  await expect(sortBtn(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect.poll(() => last(q).get("sort")).toBe("title");
});

test("K749-UI-014 画面：幅 375 のスマホのカードの札の組が同じ 5 つで、「渡された」を押すと道と口が ?kind=handover。並べ替えのボタンは出さない。横溢れ 0", async ({
  page,
}) => {
  const q = await mockQueue(page);
  await openQueue(page, 375);
  const m = page
    .getByRole("region", { name: "承認待ちの一覧（スマホ）", exact: true })
    .getByRole("group", { name: "絞り込み", exact: true });
  await expect(m.getByRole("button")).toHaveText([
    /^すべて\s*9$/,
    /^AI の成果物\s*6$/,
    /^渡された\s*3$/,
    "上位の承認",
    "判断を仰がれた",
  ]);
  await m.getByRole("button").filter({ hasText: "渡された" }).click();
  await expect(page).toHaveURL(/kind=handover/);
  await expect.poll(() => qs(last(q))).toEqual({ kind: "handover" });
  await expect(sortBtn(page)).toBeHidden();
  await noOverflow(page, 375);
});

const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "font-weight", "color", "line-height"];
const F_PAIRS: FidelityPair[] = [
  pair("chip", ".k-ap-chip", ["height", "background-color", "border-top-color", "border-top-left-radius", ...TXT]),
  pair("count", ".k-more-count", TXT),
  pair("sortbtn", ".k-more-sortbtn", [...TXT, "height", "border-top-color"]),
  pair("pop", ".k-more-pop", ["width", "background-color", "border-top-color"]),
  pair("empty", '[data-state="empty"]', ["background-color", "border-top-style", "border-top-left-radius"]),
  pair("empty-title", '[data-state="empty"] h2, [data-state="empty"] h3', TXT),
];
test("K749-UI-015 画面：下絵との突き合わせ（queue-filter-all・queue-filter-sort・queue-filter-picked・queue-filter-empty）。幅 375・768・1440 で札・並べ替えのボタンと箱・0 件の空の形が下絵と同じ", async ({
  browser,
}) => {
  const drives: [string, (p: Page) => Promise<void>][] = [
    [
      "queue-filter-all",
      async (p) => {
        await mockQueue(p);
        await openQueue(p, 1440);
      },
    ],
    [
      "queue-filter-sort",
      async (p) => {
        await mockQueue(p);
        await openQueue(p, 1440);
        await sortBtn(p).click();
      },
    ],
    [
      "queue-filter-picked",
      async (p) => {
        await mockQueue(p);
        await p.goto("/approvals?kind=handover");
        await expect(chip(p, "渡された")).toHaveAttribute("aria-pressed", "true");
      },
    ],
    [
      "queue-filter-empty",
      async (p) => {
        await mockQueue(p, { empty: true });
        await p.goto("/approvals?kind=handover");
        await expect(p.getByRole("button", { name: "すべてに戻す", exact: true })).toBeVisible();
      },
    ],
  ];
  for (const [id, drive] of drives) {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (p) => {
          await p.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
          await drive(p);
        },
        { base: "/dev/mock/f5", pairs: F_PAIRS, blur: true },
      );
      expect(rows.length, `${id}・幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, `${id}・幅 ${w}\n${bad.join("\n")}`).toEqual([]);
    }
  }
});

test("K749-UI-016 守り：開くときの一覧の口は 1 本・押せない札を押しても口は増えない・書く口 0", async ({ page }) => {
  const q = await mockQueue(page);
  await openQueue(page);
  expect(q.asked).toHaveLength(1);
  await chip(page, "上位の承認").click({ force: true });
  await chip(page, "判断を仰がれた").click({ force: true });
  await expect(page).toHaveURL(/\/approvals$/);
  expect(q.asked).toHaveLength(1);
  expect(q.w.all).toEqual([]);
});

test("K749-UI-017 入口（ファイルを読む）：先 features/F5/more/fills/queue-tools.tsx が QueueToolsFill・QueueEmptyFill・useQueueQuery を export し、札の字に「決まりの例外」「やり方を広げる」が無い", () => {
  const src = readFileSync(join(WEB, "features/F5/more/fills/queue-tools.tsx"), "utf8");
  for (const n of ["QueueToolsFill", "QueueEmptyFill", "useQueueQuery"])
    expect(src).toMatch(new RegExp(`export function ${n}\\b`));
  const tools = readFileSync(join(WEB, "features/F5/queue-tools/queue-tools.tsx"), "utf8");
  expect(tools).not.toMatch(/決まりの例外|やり方を広げる/);
});
