// K-692「上の棚に上げる（頼む小窓・承認待ちの帯・取り下げ・断られた帯）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/kn-raise・kn-raise-waiting・kn-raise-declined（本番と同じ部品 features/F9/knowledge・K-671・代表 OK 2026-11-22）。モックとの比べ方は f9-match.ts の matchF9（見る役は状態ごとに絞る）。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。ナレッジの口は網の手前で差し替える（knowledge-mock.ts）。似たページの口は K-691 の knowledge-must-mock.ts、
//   頼む・取り下げる・帯を消す口は knowledge-raise-mock.ts が足す。答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章と K-687 の md。
//   本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない（口の数と答えを待つ・答えは hold() で止める）。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { F9_WIDTHS, matchF9 } from "./f9-match";
import {
  G_SALES,
  P_INVOICE,
  P_QUOTE,
  err,
  mockKnowledge,
  msg,
  pageExpense,
  pageInvoice,
  uid,
  type KMock,
} from "./knowledge-mock";
import { mockMustSimilar, type SimilarItem, type XMock } from "./knowledge-must-mock";
import {
  P_MINE,
  REQ_ID,
  declinedRequest,
  minePage,
  mockRaise,
  teamPage,
  waitingRequest,
  type RMock,
} from "./knowledge-raise-mock";

const TREE = 'aside[aria-label="ナレッジの木"]';
const CARD = "article.k-f9-card";
const DLG = ".k-dialog";
const BAND = ".k-band";
const F_QUOTE = uid(0xf003);
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const first = (s: string) => s.split("。")[0]!;
const raiseBtn = (p: Page) => p.getByRole("button", { name: "上の棚に上げる", exact: true });
const raiseDlg = (p: Page) =>
  p.locator(DLG).filter({ has: p.getByRole("heading", { name: "上の棚に上げる", exact: true }) });
const simDlg = (p: Page) =>
  p.locator(DLG).filter({ has: p.getByRole("heading", { name: "似たページがあります", exact: true }) });
const submit = (d: Locator) => d.getByRole("button", { name: "上げるのを頼む", exact: true });
const message = (d: Locator) => d.getByLabel("ひとこと", { exact: true });
const MSG = "新しく入った人にも同じ返し方をしてほしいので、営業の棚に上げたいです";
const SIM: SimilarItem[] = [
  {
    id: uid(0xa007),
    title: "値引きの決まり",
    place: "営業 › 見積もり",
    desc: "値引きの上限と、持ち帰って決める範囲。",
  },
];

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

interface Setup {
  mk: KMock;
  x: XMock;
  r: RMock;
}
async function setup(page: Page, mine = minePage(), team = teamPage({ id: P_QUOTE })): Promise<Setup> {
  const mk = await mockKnowledge(page, { pages: [pageInvoice(), pageExpense(), mine, team] });
  mk.tree.my_nodes.push({ kind: "page", id: mine.id, title: mine.title });
  const x = await mockMustSimilar(page, mk);
  const r = await mockRaise(page, mk);
  return { mk, x, r };
}
// 幅 1023 以下の木は本文の上に重なる引き出し（K-682）。本文の操作を押す状態は開かない（useTree=false・下絵も木を出さない）
async function openAt(page: Page, id: string, width = 1440, useTree = true): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(`/knowledge/${id}`);
  await expect(page.locator(CARD).getByRole("heading", { level: 1 })).toBeVisible();
  if (width <= 1023 && useTree)
    await page
      .getByRole("button", { name: "木を開く", exact: true })
      .click()
      .catch(() => undefined);
}
async function openRaise(page: Page): Promise<Locator> {
  await raiseBtn(page).click();
  const d = raiseDlg(page);
  await expect(d).toBeVisible();
  return d;
}
async function choose(page: Page, d: Locator, label: string, option: string): Promise<void> {
  await d.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
const waitingPage = (over: Record<string, unknown> = {}) =>
  minePage({ acts: ["must-on", "edit"], raise_to: null, request: waitingRequest(over) });
const declinedPage = () => minePage({ request: declinedRequest() });

// ---------------------------------------------------------------- モックと本番の突き合わせ
const prop = (role: string, sel: string, props: string[]) => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
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
const DLG_PAIRS = [
  prop("dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]),
  prop("dialog-title", ".k-dialog h2", ["x", "y", "font-size", "font-weight", "color", "line-height", "texts"]),
  prop("dialog-label", ".k-dialog .k-label", ["font-size", "font-weight", "color", "line-height", "texts"]),
  prop("dialog-btn", ".k-dialog button[data-variant]", CTRL),
];
const BAND_PAIRS = [
  prop("band", ".k-band", [...BOX, "texts"]),
  prop("band-btn", ".k-band button", CTRL),
  prop("acts", ".k-f9-acts button", CTRL),
];
const STATES: Record<string, { pairs: ReturnType<typeof prop>[]; drive: (page: Page, w: number) => Promise<void> }> = {
  "kn-raise": {
    pairs: DLG_PAIRS,
    drive: async (page, w) => {
      await setup(page);
      await openAt(page, P_MINE, w, false);
      const d = await openRaise(page);
      await choose(page, d, "入れるフォルダ", "見積もり");
      await message(d).fill(MSG);
    },
  },
  "kn-raise-waiting": {
    pairs: BAND_PAIRS,
    drive: async (page, w) => {
      await setup(page, waitingPage());
      await openAt(page, P_MINE, w);
      await expect(page.locator(BAND)).toBeVisible();
    },
  },
  "kn-raise-declined": {
    pairs: BAND_PAIRS,
    drive: async (page, w) => {
      await setup(page, declinedPage());
      await openAt(page, P_MINE, w);
      await expect(page.locator(BAND)).toBeVisible();
    },
  },
};
for (const [id, s] of Object.entries(STATES)) {
  for (const w of F9_WIDTHS) {
    test(`K692-UI-001 ${id} 幅 ${w}：小窓・帯の位置と大きさと字がモックと同じ（matchF9 の bad が 0）`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const { bad, rows } = await matchF9(
        browser,
        id,
        w,
        async (page) => {
          await s.drive(page, w);
        },
        { pairs: s.pairs },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 頼む小窓
test("K692-UI-002 「上の棚に上げる」は口の acts に raise があるページにだけ出て押せる形：押すと小窓（口 0 回）に 上げる先「営業の棚」・承認する人「佐藤 花子さん（営業のマネージャー）」・入れるフォルダ（既定は「営業（いちばん上）」）・ひとこと（空）。会社の棚のページ・承認待ちのページには出ない", async ({
  page,
}) => {
  const { mk, x, r } = await setup(page);
  mk.pages.set(P_INVOICE, pageInvoice({ acts: ["must-off", "edit"], raise_to: null }));
  await openAt(page, P_MINE);
  await expect(raiseBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  const before = mk.calls.length;
  const d = await openRaise(page);
  await expect(d.getByText("営業の棚", { exact: true })).toBeVisible();
  await expect(d.getByText("佐藤 花子さん（営業のマネージャー）", { exact: true })).toBeVisible();
  await expect(d.getByRole("combobox", { name: "入れるフォルダ", exact: true })).toContainText("営業（いちばん上）");
  await expect(message(d)).toHaveValue("");
  expect(mk.calls.length).toBe(before);
  expect(x.count("similar") + r.count("raise")).toBe(0);
  await page.keyboard.press("Escape");
  await page.goto(`/knowledge/${P_INVOICE}`);
  await expect(page.locator(CARD)).toBeVisible();
  await expect(raiseBtn(page)).toHaveCount(0);
  mk.pages.set(P_MINE, waitingPage());
  await page.goto(`/knowledge/${P_MINE}`);
  await expect(page.locator(BAND)).toBeVisible();
  await expect(raiseBtn(page)).toHaveCount(0);
});

test("K692-UI-003 頼む：フォルダとひとことを選んで「上げるのを頼む」→ 似たページを探す口 1 回（exclude_page_id はこのページ・空）→ 頼む口 1 回（体は group_id・folder_id・message・冪等の鍵あり）→ 小窓が閉じ、ページと木を読み直して「営業の棚に上げるのを頼んでいます」の帯・木の「承認待ち」の印・「上の棚に上げる」が消える・お知らせ", async ({
  page,
}) => {
  const { mk, x, r } = await setup(page);
  await openAt(page, P_MINE);
  const d = await openRaise(page);
  await choose(page, d, "入れるフォルダ", "見積もり");
  await message(d).fill(MSG);
  await submit(d).click();
  await expect(page.locator(BAND)).toContainText("営業の棚に上げるのを頼んでいます");
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(x.count("similar")).toBe(1);
  expect(x.calls[0]!.body["exclude_page_id"]).toBe(P_MINE);
  expect(r.count("raise")).toBe(1);
  expect(r.calls[0]!.id).toBe(P_MINE);
  expect(r.calls[0]!.body).toEqual({ group_id: G_SALES, folder_id: F_QUOTE, message: MSG });
  expect(r.calls[0]!.key).toBeTruthy();
  expect(mk.count("page", P_MINE)).toBe(2);
  expect(mk.count("tree")).toBe(2);
  await expect(raiseBtn(page)).toHaveCount(0);
  await expect(page.locator(`${TREE} [data-mark="waiting"]`)).toHaveCount(1);
  await expect(page.locator(".k-toast")).toContainText("上げるのを頼みました。承認されるとページが移ります");
});

test("K692-UI-004 頼む体：棚の直下・ひとこと空なら folder_id と message を送らない（自分の棚のページは group_id だけ）・グループの棚のページを会社へ上げるときは group_id も送らず、上げる先は「会社の棚」・承認する人は「高本 聖斗さん（管理者）」", async ({
  page,
}) => {
  const { r } = await setup(page);
  await openAt(page, P_MINE);
  let d = await openRaise(page);
  await submit(d).click();
  await expect(page.locator(BAND)).toBeVisible();
  expect(r.calls[0]!.body).toEqual({ group_id: G_SALES });
  await page.goto(`/knowledge/${P_QUOTE}`);
  await expect(page.locator(CARD)).toBeVisible();
  d = await openRaise(page);
  await expect(d.getByText("会社の棚", { exact: true })).toBeVisible();
  await expect(d.getByText("高本 聖斗さん（管理者）", { exact: true })).toBeVisible();
  await submit(d).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(r.count("raise")).toBe(2);
  expect(r.calls[1]!.body).toEqual({});
});

test("K692-UI-005 似たページがあるとき：頼む口の前に小窓「似たページがあります」（このまま頼む・戻って直す）・頼む小窓は隠れ・頼む口は 0 回。「戻って直す」で頼む小窓に戻り（ひとこと・フォルダは残る）、「このまま頼む」で頼む口 1 回", async ({
  page,
}) => {
  const { x, r } = await setup(page);
  x.similar = SIM;
  await openAt(page, P_MINE);
  const d = await openRaise(page);
  await choose(page, d, "入れるフォルダ", "見積もり");
  await message(d).fill(MSG);
  await submit(d).click();
  const s = simDlg(page);
  await expect(s).toBeVisible();
  await expect(raiseDlg(page)).toHaveCount(0);
  await expect(s.getByRole("button", { name: "このまま頼む", exact: true })).toBeVisible();
  await expect(s.getByLabel("似たページ", { exact: true })).toContainText("営業 › 見積もり");
  expect(r.count("raise")).toBe(0);
  await s.getByRole("button", { name: "戻って直す", exact: true }).click();
  await expect(simDlg(page)).toHaveCount(0);
  await expect(message(raiseDlg(page))).toHaveValue(MSG);
  await expect(raiseDlg(page).getByRole("combobox", { name: "入れるフォルダ", exact: true })).toContainText("見積もり");
  await submit(raiseDlg(page)).click();
  await simDlg(page).getByRole("button", { name: "このまま頼む", exact: true }).click();
  await expect(page.locator(BAND)).toContainText("頼んでいます");
  expect(r.count("raise")).toBe(1);
  expect(x.count("similar")).toBe(2);
});

test("K692-UI-006 似たページを探す口が失敗：止めずにお知らせ「似たページを探せませんでした。このまま頼みます。」（仮）を出して頼む口 1 回へ進む", async ({
  page,
}) => {
  const { x, r } = await setup(page);
  x.script("similar", err(503, "E-PAGE-003"));
  await openAt(page, P_MINE);
  const d = await openRaise(page);
  await submit(d).click();
  await expect(page.locator(BAND)).toBeVisible();
  // 知らせの置き場は外枠の 1 か所（K-466）。頼んだ知らせと並んで出るので、文で探す
  await expect(
    page.locator(".k-toast").filter({ hasText: "似たページを探せませんでした。このまま頼みます。" }),
  ).toBeVisible();
  expect(r.count("raise")).toBe(1);
});

test("K692-UI-007 ひとこと：1,001 字だと欄の下に「ひとことは 1,000 字までです」（仮）が出て口は 1 回も呼ばない・1,000 字なら通る", async ({
  page,
}) => {
  const { x, r } = await setup(page);
  await openAt(page, P_MINE);
  const d = await openRaise(page);
  await message(d).fill("あ".repeat(1001));
  await submit(d).click();
  await expect(d.locator(".k-err")).toHaveText("ひとことは 1,000 字までです");
  expect(x.count("similar") + r.count("raise")).toBe(0);
  await message(d).fill("あ".repeat(1000));
  await submit(d).click();
  await expect(page.locator(BAND)).toBeVisible();
  expect(String(r.calls[0]!.body["message"]).length).toBe(1000);
});

test("K692-UI-008 すぐ移ったとき（承認する人が頼んだ人・口の答えの state が approved）：小窓が閉じ、ページと木を読み直して新しい棚（「グループ：営業」）で開き直し・承認待ちの帯は出ない・お知らせ「ページを営業の棚に上げました」", async ({
  page,
}) => {
  const { mk, r } = await setup(page);
  r.immediate = true;
  await openAt(page, P_MINE);
  const d = await openRaise(page);
  await submit(d).click();
  await expect(page.locator(".k-toast")).toContainText("ページを営業の棚に上げました");
  await expect(page.locator(".k-f9-place")).toContainText("グループ：営業");
  await expect(page.locator(BAND)).toHaveCount(0);
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.count("page", P_MINE)).toBe(2);
});

test("K692-UI-009 口が 409 E-KNW-103（入れるフォルダが上げる先の棚でない）：入れるフォルダの欄の下に正本の文・小窓は閉じず選びとひとことは残る・選び直して押し直すと通る（口 2 回）", async ({
  page,
}) => {
  const { r } = await setup(page);
  r.script("raise", err(409, "E-KNW-103"));
  await openAt(page, P_MINE);
  const d = await openRaise(page);
  await choose(page, d, "入れるフォルダ", "見積もり");
  await message(d).fill(MSG);
  await submit(d).click();
  await expect(d.locator(".k-err")).toHaveText(msg("E-KNW-103"));
  await expect(message(d)).toHaveValue(MSG);
  await choose(page, d, "入れるフォルダ", "営業（いちばん上）");
  await submit(d).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(r.count("raise")).toBe(2);
});

for (const [name, reply, code] of [
  ["409 先のグループが決まらない", err(409, "E-KNW-101"), "E-KNW-101"],
  ["409 承認する人がいない", err(409, "E-KNW-102"), "E-KNW-102"],
  ["409 会社の棚のページ", err(409, "E-KNW-100"), "E-KNW-100"],
  ["409 共有しているページ", err(409, "E-KNW-106"), "E-KNW-106"],
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002"],
  ["404", err(404, "E-PAGE-001"), "E-PAGE-001"],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003"],
  ["網の切れ", "network", "E-PAGE-008"],
] as const)
  test(`K692-UI-010 頼む口が失敗（${name}）：小窓の上の赤い箱に ${code} の文・ひとことと選びは残り押し直せる・通れば閉じる`, async ({
    page,
  }) => {
    const { r } = await setup(page);
    r.script("raise", reply);
    await openAt(page, P_MINE);
    const d = await openRaise(page);
    await message(d).fill(MSG);
    await submit(d).click();
    await expect(d.getByRole("alert")).toContainText(first(msg(code)));
    await expect(message(d)).toHaveValue(MSG);
    await submit(d).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    expect(r.count("raise")).toBe(2);
  });

test("K692-UI-011 口が 409 E-KNW-011（別のタブで先に頼んでいた）：小窓を閉じ、ページを読み直して（口 2 回）お知らせ（失敗）に正本の文を出す・頼む口は 1 回だけ", async ({
  page,
}) => {
  const { mk, r } = await setup(page);
  r.script("raise", err(409, "E-KNW-011"));
  await openAt(page, P_MINE);
  const d = await openRaise(page);
  await submit(d).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(page.locator(".k-toast-error")).toContainText(first(msg("E-KNW-011")));
  expect(mk.count("page", P_MINE)).toBe(2);
  expect(r.count("raise")).toBe(1);
});

test("K692-UI-012 二度押し：頼む口の答えを止めた間に「上げるのを頼む」を 2 回押しても、探す口も頼む口も 1 回・ボタンは押せない", async ({
  page,
}) => {
  const { x, r } = await setup(page);
  await openAt(page, P_MINE);
  const d = await openRaise(page);
  const release = r.hold("raise");
  await submit(d).click();
  await expect(submit(d)).toBeDisabled();
  await submit(d)
    .click({ force: true })
    .catch(() => undefined);
  expect(r.count("raise")).toBe(1);
  release();
  await expect(page.locator(BAND)).toBeVisible();
  expect(r.count("raise")).toBe(1);
  expect(x.count("similar")).toBe(1);
});

test("K692-UI-013 やめる・Esc・右上の×：口を呼ばず閉じ、焦点は「上の棚に上げる」に戻り、開き直すと小窓は初めの形（ひとこと空・フォルダは棚の直下）", async ({
  page,
}) => {
  const { x, r } = await setup(page);
  await openAt(page, P_MINE);
  for (const how of ["やめる", "Escape", "閉じる"]) {
    const d = await openRaise(page);
    await message(d).fill("途中でやめる");
    await choose(page, d, "入れるフォルダ", "見積もり");
    if (how === "Escape") await page.keyboard.press("Escape");
    else await d.getByRole("button", { name: how, exact: true }).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect(raiseBtn(page)).toBeFocused();
  }
  const again = await openRaise(page);
  await expect(message(again)).toHaveValue("");
  await expect(again.getByRole("combobox", { name: "入れるフォルダ", exact: true })).toContainText(
    "営業（いちばん上）",
  );
  expect(x.count("similar") + r.count("raise")).toBe(0);
});

// ---------------------------------------------------------------- 承認待ちの帯・取り下げ
test("K692-UI-014 承認待ちの帯：「営業の棚に上げるのを頼んでいます」・「佐藤 花子さん（営業のマネージャー）の承認を待っています ・ 11/21 16:20 に頼んだ」・頼んだ人には「取り下げる」・頼んだ人でない人（can_withdraw が false）には無い", async ({
  page,
}) => {
  const { mk } = await setup(page, waitingPage());
  await openAt(page, P_MINE);
  const b = page.locator(BAND);
  await expect(b).toContainText("営業の棚に上げるのを頼んでいます");
  await expect(b).toContainText("佐藤 花子さん（営業のマネージャー）の承認を待っています ・ 11/21 16:20 に頼んだ");
  await expect(b.getByRole("button", { name: "取り下げる", exact: true })).toBeVisible();
  mk.pages.set(P_MINE, waitingPage({ can_withdraw: false }));
  await page.reload();
  await expect(page.locator(BAND)).toContainText("頼んでいます");
  await expect(page.getByRole("button", { name: "取り下げる", exact: true })).toHaveCount(0);
});

test("K692-UI-015 取り下げる：口 1 回（DELETE /knowledge/requests/<頼みの id>）→ ページと木を読み直して帯が消え「上の棚に上げる」が戻る・お知らせ「取り下げました」（仮）。答えを止めた間の二度押しでも口は 1 回", async ({
  page,
}) => {
  const { mk, r } = await setup(page, waitingPage());
  await openAt(page, P_MINE);
  const btn = page.getByRole("button", { name: "取り下げる", exact: true });
  const release = r.hold("withdraw");
  await btn.click();
  await btn.click({ force: true }).catch(() => undefined);
  expect(r.count("withdraw")).toBe(1);
  release();
  await expect(page.locator(BAND)).toHaveCount(0);
  await expect(raiseBtn(page)).toBeVisible();
  expect(r.calls[0]!.id).toBe(REQ_ID);
  expect(mk.count("page", P_MINE)).toBe(2);
  expect(mk.count("tree")).toBe(2);
  await expect(page.locator(".k-toast")).toContainText("取り下げました");
});

for (const [name, reply, code, reread] of [
  ["409 もう決まっている", err(409, "E-KNW-104"), "E-KNW-104", true],
  ["404", err(404, "E-PAGE-001"), "E-PAGE-001", true],
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002", false],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003", false],
  ["網の切れ", "network", "E-PAGE-008", false],
] as const)
  test(`K692-UI-016 取り下げる口が失敗（${name}）：お知らせ（失敗）に ${code} の文・${reread ? "ページを読み直す" : "読み直さない"}・帯の「取り下げる」は残り押し直せる`, async ({
    page,
  }) => {
    const { mk, r } = await setup(page, waitingPage());
    r.script("withdraw", reply);
    await openAt(page, P_MINE);
    await page.getByRole("button", { name: "取り下げる", exact: true }).click();
    await expect(page.locator(".k-toast-error")).toContainText(first(msg(code)));
    expect(mk.count("page", P_MINE)).toBe(reread ? 2 : 1);
    await expect(page.getByRole("button", { name: "取り下げる", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "取り下げる", exact: true }).click();
    await expect(page.locator(BAND)).toHaveCount(0);
    expect(r.count("withdraw")).toBe(2);
  });

// ---------------------------------------------------------------- 断られた帯
test("K692-UI-017 断られた帯：「営業の棚に上げるのを断られました」・「佐藤 花子さん（営業のマネージャー） ・ 11/22 09:10」・理由が見え・「このお知らせを消す」「直してもう一度頼む」・帯の外の「上の棚に上げる」も出る・木に「断られた」の印", async ({
  page,
}) => {
  const { mk } = await setup(page, declinedPage());
  mk.tree.my_nodes.find((n) => n.id === P_MINE)!.mark = "declined";
  await openAt(page, P_MINE);
  const b = page.locator(BAND);
  await expect(b).toContainText("営業の棚に上げるのを断られました");
  await expect(b).toContainText("佐藤 花子さん（営業のマネージャー） ・ 11/22 09:10");
  await expect(b).toContainText("「5% まで」の所だけ、そのページに足してください。");
  await expect(b.getByRole("button", { name: "このお知らせを消す", exact: true })).toBeVisible();
  await expect(b.getByRole("button", { name: "直してもう一度頼む", exact: true })).toBeVisible();
  await expect(raiseBtn(page)).toBeVisible();
  await expect(page.locator(`${TREE} [data-mark="declined"]`)).toHaveCount(1);
});

test("K692-UI-018 「このお知らせを消す」：口 1 回（POST /knowledge/requests/<id>/dismiss・体は空）→ ページと木を読み直して帯と木の印が消える・お知らせ「お知らせを消しました」（仮）", async ({
  page,
}) => {
  const { mk, r } = await setup(page, declinedPage());
  await openAt(page, P_MINE);
  await page.getByRole("button", { name: "このお知らせを消す", exact: true }).click();
  await expect(page.locator(BAND)).toHaveCount(0);
  expect(r.count("dismiss")).toBe(1);
  expect(r.calls[0]).toMatchObject({ id: REQ_ID, body: {} });
  expect(r.calls[0]!.key).toBeTruthy();
  expect(mk.count("page", P_MINE)).toBe(2);
  expect(mk.count("tree")).toBe(2);
  await expect(page.locator(".k-toast")).toContainText("お知らせを消しました");
});

for (const [name, reply, code, reread] of [
  ["409 断られた頼みでない", err(409, "E-KNW-105"), "E-KNW-105", true],
  ["404", err(404, "E-PAGE-001"), "E-PAGE-001", true],
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002", false],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003", false],
  ["網の切れ", "network", "E-PAGE-008", false],
] as const)
  test(`K692-UI-019 帯を消す口が失敗（${name}）：お知らせ（失敗）に ${code} の文・${reread ? "ページを読み直す" : "読み直さない"}・帯は残り押し直せる`, async ({
    page,
  }) => {
    const { mk, r } = await setup(page, declinedPage());
    r.script("dismiss", reply);
    await openAt(page, P_MINE);
    await page.getByRole("button", { name: "このお知らせを消す", exact: true }).click();
    await expect(page.locator(".k-toast-error")).toContainText(first(msg(code)));
    expect(mk.count("page", P_MINE)).toBe(reread ? 2 : 1);
    await page.getByRole("button", { name: "このお知らせを消す", exact: true }).click();
    await expect(page.locator(BAND)).toHaveCount(0);
    expect(r.count("dismiss")).toBe(2);
  });

test("K692-UI-020 「直してもう一度頼む」：頼む小窓が開き（口 0 回）、頼むと断られた帯が承認待ちの帯に替わる（断られた帯は無くなる）", async ({
  page,
}) => {
  const { x, r } = await setup(page, declinedPage());
  await openAt(page, P_MINE);
  await page.locator(BAND).getByRole("button", { name: "直してもう一度頼む", exact: true }).click();
  const d = raiseDlg(page);
  await expect(d).toBeVisible();
  expect(x.count("similar") + r.count("raise")).toBe(0);
  await message(d).fill("理由のとおり直しました");
  await submit(d).click();
  await expect(page.locator(BAND)).toContainText("営業の棚に上げるのを頼んでいます");
  await expect(page.locator(BAND)).not.toContainText("断られました");
  expect(r.calls[0]!.body["message"]).toBe("理由のとおり直しました");
});

// ---------------------------------------------------------------- 守り・幅・キーボード
test("K692-UI-021 承認する人・フォルダ名・理由・相手の名前・ひとことに HTML が入っていても、小窓・帯に文字として出て動かない（img も作られない）・送るひとことは打ったとおりの字", async ({
  page,
}) => {
  const evil = '<img src=x onerror="window.__x=1">';
  const mine = minePage({
    raise_to: { shelf: "group", shelf_name: "営業", group_id: G_SALES, approver_names: [evil] },
  });
  const { mk, r } = await setup(page, mine);
  mk.tree.groups[0]!.nodes = [{ kind: "folder", id: F_QUOTE, name: "<b>見積もり</b>", children: [] }];
  await openAt(page, P_MINE);
  const d = await openRaise(page);
  await expect(d.getByText(`${evil}さん（営業のマネージャー）`, { exact: true })).toBeVisible();
  await choose(page, d, "入れるフォルダ", "<b>見積もり</b>");
  await message(d).fill("<u>お願い</u>");
  await submit(d).click();
  expect(r.calls[0]!.body["message"]).toBe("<u>お願い</u>");
  mk.pages.set(P_MINE, minePage({ request: declinedRequest({ who_name: evil, reason: "<i>理由</i>" }) }));
  await page.reload();
  await expect(page.locator(BAND)).toContainText("<i>理由</i>");
  await expect(page.locator(BAND)).toContainText(`${evil}さん`);
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator(".k-dialog img, .k-band img").count()).toBe(0);
});

for (const w of WIDTHS) {
  test(`K692-UI-022 幅 ${w}：頼む小窓（長いフォルダ名・長い承認する人の名前）・承認待ちの帯・断られた帯（長い理由）を開いても横のはみ出し 0（数値）・小窓が画面の中に収まる`, async ({
    page,
  }) => {
    const long = "とても長いフォルダの名前".repeat(4);
    const mine = minePage({
      raise_to: { shelf: "group", shelf_name: "営業", group_id: G_SALES, approver_names: ["佐藤 花子".repeat(6)] },
    });
    const { mk } = await setup(page, mine);
    mk.tree.groups[0]!.nodes = [{ kind: "folder", id: F_QUOTE, name: long, children: [] }];
    await openAt(page, P_MINE, w, false);
    const d = await openRaise(page);
    await choose(page, d, "入れるフォルダ", long);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    const box = (await d.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w);
    await page.keyboard.press("Escape");
    mk.pages.set(P_MINE, waitingPage());
    await page.reload();
    await expect(page.locator(BAND)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    mk.pages.set(P_MINE, minePage({ request: declinedRequest({ reason: "理由が長い".repeat(40) }) }));
    await page.reload();
    await expect(page.locator(BAND)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
}

test("K692-UI-023 キーボードだけ：「上の棚に上げる」に焦点して Enter で小窓・Tab を 20 回押しても外へ出ず・Esc で閉じて焦点が戻る。帯の「取り下げる」に Tab で届き Enter で取り下げられる", async ({
  page,
}) => {
  const { mk, r } = await setup(page);
  await openAt(page, P_MINE);
  await raiseBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(raiseDlg(page)).toBeVisible();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".k-dialog"))), `Tab ${i + 1} 回目`).toBe(
      true,
    );
  }
  await page.keyboard.press("Escape");
  await expect(raiseBtn(page)).toBeFocused();
  mk.pages.set(P_MINE, waitingPage());
  await page.reload();
  await page.getByRole("button", { name: "取り下げる", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(BAND)).toHaveCount(0);
  expect(r.count("withdraw")).toBe(1);
});

test("K692-UI-024 入れるフォルダの選び：上げる先の棚のフォルダだけ（営業へ上げるなら「営業（いちばん上）」と「見積もり」・会社へ上げるなら「会社（いちばん上）」「経理」「お客さま対応」）・別の棚のフォルダは出ない", async ({
  page,
}) => {
  await setup(page);
  await openAt(page, P_MINE);
  let d = await openRaise(page);
  await d.getByRole("combobox", { name: "入れるフォルダ", exact: true }).click();
  expect(await page.getByRole("option").allInnerTexts()).toEqual(["営業（いちばん上）", "見積もり"]);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.goto(`/knowledge/${P_QUOTE}`);
  await expect(page.locator(CARD)).toBeVisible();
  d = await openRaise(page);
  await d.getByRole("combobox", { name: "入れるフォルダ", exact: true }).click();
  expect(await page.getByRole("option").allInnerTexts()).toEqual(["会社（いちばん上）", "経理", "お客さま対応"]);
});
