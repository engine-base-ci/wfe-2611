// K-693「グループを選んで共有（選ぶ小窓・共有された側の帯）と写して直す（写しの帯）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/kn-share・kn-shared-view・kn-copy（本番と同じ部品 features/F9/knowledge・K-671・代表 OK 2026-11-22）。モックとの比べ方は f9-match.ts の matchF9（見る役は状態ごとに絞る）。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。ナレッジの口は網の手前で差し替える（knowledge-mock.ts）。共有を読む・決める口と写す口は knowledge-share-mock.ts が足す。
//   答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章と K-689・K-690 の md。本人の Bridge（127.0.0.1:38617）は届かせない。
//   固定の待ちは使わない（口の数と答えを待つ・答えは hold() で止める）。テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { F9_WIDTHS, matchF9 } from "./f9-match";
import { G_DEV, P_QUOTE, err, mockKnowledge, msg, pageExpense, pageInvoice, type KMock } from "./knowledge-mock";
import {
  G_KEIRI,
  G_LAW,
  P_COPY,
  copiedFrom,
  mockShare,
  quotePage,
  sharedViewPage,
  type SMock,
} from "./knowledge-share-mock";

const CARD = "article.k-f9-card";
const DLG = ".k-dialog";
const BAND = ".k-band";
const TREE = 'aside[aria-label="ナレッジの木"]';
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const first = (s: string) => s.split("。")[0]!;
const shareBtn = (p: Page) => p.getByRole("button", { name: "グループを選んで共有", exact: true });
const copyBtn = (p: Page) => p.getByRole("button", { name: "写して直す", exact: true });
const shareDlg = (p: Page) =>
  p.locator(DLG).filter({ has: p.getByRole("heading", { name: "グループを選んで共有", exact: true }) });
const row = (d: Locator, name: string) => d.locator("li", { hasText: name });
const box = (d: Locator, name: string) => row(d, name).getByRole("checkbox");
const submit = (d: Locator, label: string) => d.getByRole("button", { name: label, exact: true });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

interface Setup {
  mk: KMock;
  s: SMock;
}
async function setup(page: Page, answer = quotePage()): Promise<Setup> {
  const mk = await mockKnowledge(page, { pages: [pageInvoice(), pageExpense(), answer] });
  const s = await mockShare(page, mk);
  return { mk, s };
}
async function openAt(page: Page, id: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(`/knowledge/${id}`);
  await expect(page.locator(CARD).getByRole("heading", { level: 1 })).toBeVisible();
  if (width <= 1023)
    await page
      .getByRole("button", { name: "木を開く", exact: true })
      .click()
      .catch(() => undefined);
}
async function openShare(page: Page): Promise<Locator> {
  await shareBtn(page).click();
  const d = shareDlg(page);
  await expect(d).toBeVisible();
  await expect(row(d, "受託開発")).toBeVisible();
  return d;
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
const DLG_PAIRS = [
  prop("dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]),
  prop("dialog-title", ".k-dialog h2", ["x", "y", "font-size", "font-weight", "color", "line-height", "texts"]),
  prop("dialog-row", ".k-dialog .k-f9-pick-row", ["x", "height", "texts"]),
  prop("dialog-btn", ".k-dialog button[data-variant]", CTRL),
];
const BAND_PAIRS = [
  prop("band", ".k-band", [...BOX, "texts"]),
  prop("band-btn", ".k-band button", CTRL),
  prop("acts", ".k-f9-acts button", CTRL),
];
const STATES: Record<string, { pairs: ReturnType<typeof prop>[]; drive: (page: Page, w: number) => Promise<void> }> = {
  "kn-share": {
    pairs: DLG_PAIRS,
    drive: async (page, w) => {
      await setup(page);
      await openAt(page, P_QUOTE, w);
      const d = await openShare(page);
      await box(d, "受託開発").check();
    },
  },
  "kn-shared-view": {
    pairs: BAND_PAIRS,
    drive: async (page, w) => {
      await setup(page, sharedViewPage());
      await openAt(page, P_QUOTE, w);
      await expect(page.locator(BAND)).toBeVisible();
    },
  },
  "kn-copy": {
    pairs: BAND_PAIRS,
    drive: async (page, w) => {
      const { mk } = await setup(page, sharedViewPage());
      mk.pages.set(
        P_COPY,
        pageInvoice({ id: P_COPY, acts: ["must-off", "edit"], copied_from: copiedFrom({ must: true }) }),
      );
      await openAt(page, P_COPY, w);
      await expect(page.locator(BAND)).toBeVisible();
    },
  },
};
for (const [id, st] of Object.entries(STATES)) {
  for (const w of F9_WIDTHS) {
    test(`K693-UI-001 ${id} 幅 ${w}：小窓・帯の位置と大きさと字がモックと同じ（matchF9 の bad が 0）`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const { bad, rows } = await matchF9(
        browser,
        id,
        w,
        async (page) => {
          await st.drive(page, w);
        },
        { pairs: st.pairs },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 選ぶ小窓
test("K693-UI-002 「グループを選んで共有」は口の acts に share があるページにだけ出る：押すと小窓が開き、共有を読む口を 1 回（page_id だけの問い合わせ）呼び、ほかのグループが並ぶ（受託開発・経理・法務・人事）。法務は「共有している」でチェック済み・承認する人の名前（田中 美咲さん）が出る", async ({
  page,
}) => {
  const { mk, s } = await setup(page, quotePage({ acts: ["must-on", "edit"] }));
  await openAt(page, P_QUOTE);
  await expect(shareBtn(page)).toHaveCount(0);
  mk.pages.set(P_QUOTE, quotePage());
  await page.goto(`/knowledge/${P_QUOTE}`);
  await expect(page.locator(CARD)).toBeVisible();
  expect(s.count("shares")).toBe(0);
  const d = await openShare(page);
  expect(s.count("shares")).toBe(1);
  expect(s.calls.find((c) => c.op === "shares")!.query).toEqual({ page_id: P_QUOTE });
  await expect(d.locator("li")).toHaveCount(4);
  await expect(row(d, "受託開発")).toContainText("承認する人：田中 美咲さん");
  await expect(row(d, "法務")).toContainText("共有している");
  await expect(box(d, "法務")).toBeChecked();
  await expect(box(d, "受託開発")).not.toBeChecked();
  await expect(submit(d, "共有を頼む")).toBeDisabled();
});

test("K693-UI-003 グループごとの状態：承認待ちは「承認待ち」でチェック済み・断られたは「断られた」で外れていて選び直せる・マネージャーのいないグループ（人事）は「承認する人：まだいません」で選べない", async ({
  page,
}) => {
  const { s } = await setup(page);
  s.groups = s.groups.map((g) =>
    g.group_id === G_KEIRI
      ? { ...g, checked: true, state: "waiting" as const }
      : g.group_id === G_DEV
        ? { ...g, checked: false, state: "declined" as const }
        : g,
  );
  await openAt(page, P_QUOTE);
  const d = await openShare(page);
  await expect(row(d, "経理")).toContainText("承認待ち");
  await expect(box(d, "経理")).toBeChecked();
  await expect(box(d, "経理")).toBeEnabled();
  await expect(row(d, "受託開発")).toContainText("断られた");
  await expect(box(d, "受託開発")).not.toBeChecked();
  await box(d, "受託開発").check();
  await expect(submit(d, "1 つのグループに共有を頼む")).toBeEnabled();
  await expect(row(d, "人事")).toContainText("承認する人：まだいません");
  await expect(box(d, "人事")).toBeDisabled();
});

test("K693-UI-004 足す：受託開発にチェックを付けると「1 つのグループに共有を頼む」→ 押すと共有を決める口が 1 回（体は page_id と、チェックが付いた全部の group_ids〔受託開発・法務〕・冪等の鍵あり）→ 小窓が閉じ、ページと木を読み直し（各 2 回）・お知らせ「共有を頼みました（受託開発）。」", async ({
  page,
}) => {
  const { mk, s } = await setup(page);
  await openAt(page, P_QUOTE);
  const d = await openShare(page);
  await box(d, "受託開発").check();
  await submit(d, "1 つのグループに共有を頼む").click();
  await expect(page.locator(".k-toast")).toContainText("共有を頼みました（受託開発）。");
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(s.count("setShares")).toBe(1);
  expect(s.calls.find((c) => c.op === "setShares")!.body).toEqual({ page_id: P_QUOTE, group_ids: [G_DEV, G_LAW] });
  expect(s.calls.find((c) => c.op === "setShares")!.key).toBeTruthy();
  expect(mk.count("page", P_QUOTE)).toBe(2);
  expect(mk.count("tree")).toBe(2);
});

test("K693-UI-005 外す（共有をやめる・頼みを取り下げる）：法務（共有中）と経理（承認待ち）のチェックを外すと、ボタンは「共有を変える」・小窓に「外すと、法務・経理への共有をやめます（承認待ちの頼みは取り下げます）。」→ 押すと口 1 回（体の group_ids に二つとも入らない）・お知らせ「共有をやめました（法務）。頼みを取り下げました（経理）。」", async ({
  page,
}) => {
  const { s } = await setup(page);
  s.groups = s.groups.map((g) => (g.group_id === G_KEIRI ? { ...g, checked: true, state: "waiting" as const } : g));
  await openAt(page, P_QUOTE);
  const d = await openShare(page);
  await box(d, "法務").uncheck();
  await box(d, "経理").uncheck();
  await expect(
    d.getByText("外すと、法務・経理への共有をやめます（承認待ちの頼みは取り下げます）。", { exact: true }),
  ).toBeVisible();
  await submit(d, "共有を変える").click();
  await expect(page.locator(".k-toast")).toContainText("共有をやめました（法務）。頼みを取り下げました（経理）。");
  expect(s.calls.find((c) => c.op === "setShares")!.body).toEqual({ page_id: P_QUOTE, group_ids: [] });
});

test("K693-UI-006 変えていないときは送れない：開いた直後・足してから戻した後は「共有を頼む」が押せず口 0 回。足して外した分があるときは足す数がボタンの字になる", async ({
  page,
}) => {
  const { s } = await setup(page);
  await openAt(page, P_QUOTE);
  const d = await openShare(page);
  await expect(submit(d, "共有を頼む")).toBeDisabled();
  await box(d, "経理").check();
  await expect(submit(d, "1 つのグループに共有を頼む")).toBeEnabled();
  await box(d, "経理").uncheck();
  await expect(submit(d, "共有を頼む")).toBeDisabled();
  await box(d, "経理").check();
  await box(d, "受託開発").check();
  await box(d, "法務").uncheck();
  await expect(submit(d, "2 つのグループに共有を頼む")).toBeEnabled();
  expect(s.count("setShares")).toBe(0);
});

test("K693-UI-007 呼んだ人が相手のマネージャーでもあるとき（口の答えが先から「共有している」）：お知らせは「共有しました（受託開発）。」", async ({
  page,
}) => {
  const { s } = await setup(page);
  s.immediate.add(G_DEV);
  await openAt(page, P_QUOTE);
  const d = await openShare(page);
  await box(d, "受託開発").check();
  await submit(d, "1 つのグループに共有を頼む").click();
  await expect(page.locator(".k-toast")).toContainText("共有しました（受託開発）。");
  await expect(page.locator(DLG)).toHaveCount(0);
});

for (const [name, reply, code] of [
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002"],
  ["404", err(404, "E-PAGE-001"), "E-PAGE-001"],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003"],
  ["網の切れ", "network", "E-PAGE-008"],
] as const)
  test(`K693-UI-008 共有を読む口が失敗（${name}）：小窓の赤い箱に ${code} の文・グループの一覧は出ず「共有を頼む」は押せない・「やめる」で閉じ、開き直すと読み直す（口 2 回）`, async ({
    page,
  }) => {
    const { s } = await setup(page);
    s.script("shares", reply);
    await openAt(page, P_QUOTE);
    await shareBtn(page).click();
    const d = shareDlg(page);
    await expect(d.getByRole("alert")).toContainText(first(msg(code)));
    await expect(d.locator("li")).toHaveCount(0);
    await expect(submit(d, "共有を頼む")).toBeDisabled();
    await d.getByRole("button", { name: "やめる", exact: true }).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await shareBtn(page).click();
    await expect(row(shareDlg(page), "受託開発")).toBeVisible();
    expect(s.count("shares")).toBe(2);
  });

for (const [name, reply, code] of [
  ["409 マネージャーのいないグループ", err(409, "E-KNW-122"), "E-KNW-122"],
  ["409 グループの棚でない", err(409, "E-KNW-121"), "E-KNW-121"],
  ["409 元のグループ", err(409, "E-KNW-120"), "E-KNW-120"],
  ["409 書き終えていない", err(409, "E-KNW-010"), "E-KNW-010"],
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002"],
  ["404", err(404, "E-PAGE-001"), "E-PAGE-001"],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003"],
  ["網の切れ", "network", "E-PAGE-008"],
] as const)
  test(`K693-UI-009 決める口が失敗（${name}）：小窓の上の赤い箱に ${code} の文・チェックの選びは残り押し直せる・通れば閉じる`, async ({
    page,
  }) => {
    const { s } = await setup(page);
    s.script("setShares", reply);
    await openAt(page, P_QUOTE);
    const d = await openShare(page);
    await box(d, "経理").check();
    await submit(d, "1 つのグループに共有を頼む").click();
    await expect(d.getByRole("alert")).toContainText(first(msg(code)));
    await expect(box(d, "経理")).toBeChecked();
    await submit(d, "1 つのグループに共有を頼む").click();
    await expect(page.locator(DLG)).toHaveCount(0);
    expect(s.count("setShares")).toBe(2);
  });

test("K693-UI-010 口が 409 E-KNW-011（別のタブで先に上げるのを頼んでいた）：小窓を閉じ、ページを読み直して（口 2 回）お知らせ（失敗）に正本の文・決める口は 1 回だけ", async ({
  page,
}) => {
  const { mk, s } = await setup(page);
  s.script("setShares", err(409, "E-KNW-011"));
  await openAt(page, P_QUOTE);
  const d = await openShare(page);
  await box(d, "経理").check();
  await submit(d, "1 つのグループに共有を頼む").click();
  await expect(page.locator(DLG)).toHaveCount(0);
  await expect(page.locator(".k-toast-error")).toContainText(first(msg("E-KNW-011")));
  expect(mk.count("page", P_QUOTE)).toBe(2);
  expect(s.count("setShares")).toBe(1);
});

test("K693-UI-011 二度押し：決める口の答えを止めた間に 2 回押しても口は 1 回・ボタンとチェックは押せない", async ({
  page,
}) => {
  const { s } = await setup(page);
  await openAt(page, P_QUOTE);
  const d = await openShare(page);
  await box(d, "経理").check();
  const release = s.hold("setShares");
  await submit(d, "1 つのグループに共有を頼む").click();
  await expect(submit(d, "1 つのグループに共有を頼む")).toBeDisabled();
  await expect(box(d, "受託開発")).toBeDisabled();
  await submit(d, "1 つのグループに共有を頼む")
    .click({ force: true })
    .catch(() => undefined);
  expect(s.count("setShares")).toBe(1);
  release();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(s.count("setShares")).toBe(1);
});

test("K693-UI-012 やめる・Esc・右上の×：口を呼ばず閉じ、焦点は「グループを選んで共有」に戻る。途中の選びは捨てられ、開き直すと共有を読み直して初めの形（口 +1 回）", async ({
  page,
}) => {
  const { s } = await setup(page);
  await openAt(page, P_QUOTE);
  let reads = 0;
  for (const how of ["やめる", "Escape", "閉じる"]) {
    const d = await openShare(page);
    reads += 1;
    await box(d, "経理").check();
    if (how === "Escape") await page.keyboard.press("Escape");
    else await d.getByRole("button", { name: how, exact: true }).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect(shareBtn(page)).toBeFocused();
    expect(s.count("shares")).toBe(reads);
  }
  const again = await openShare(page);
  await expect(box(again, "経理")).not.toBeChecked();
  expect(s.count("setShares")).toBe(0);
});

// ---------------------------------------------------------------- 共有された側
test("K693-UI-013 共有された側（口の shared_from）：帯「営業から共有されたページです」・「元は 1 つです。…直せるのは営業のマネージャー（佐藤 花子さん）です。」・主のボタンは「写して直す」だけで「直す」「上の棚に上げる」「グループを選んで共有」は無く、共有を読む口は呼ばない", async ({
  page,
}) => {
  const { s } = await setup(page, sharedViewPage());
  await openAt(page, P_QUOTE);
  const band = page.locator(BAND);
  await expect(band.getByRole("heading", { name: "営業から共有されたページです", exact: true })).toBeVisible();
  await expect(band).toContainText("直せるのは営業のマネージャー（佐藤 花子さん）です");
  await expect(copyBtn(page)).toHaveAttribute("data-variant", "primary");
  for (const n of ["直す", "上の棚に上げる", "グループを選んで共有"])
    await expect(page.getByRole("button", { name: n, exact: true })).toHaveCount(0);
  expect(s.count("shares")).toBe(0);
});

// ---------------------------------------------------------------- 写して直す
test("K693-UI-014 写す：「写して直す」を押すと写す口が 1 回（POST・体は空・冪等の鍵あり・フォルダは選ばせない）→ 木を読み直し、自分の棚の写しのページ（/knowledge/<写しの id>）に移る・帯「営業 › 見積もり の「見積書の出し方」の写しです」・お知らせ「自分の棚に写しました。「直す」で自分用に直せます。」", async ({
  page,
}) => {
  const { mk, s } = await setup(page, sharedViewPage());
  await openAt(page, P_QUOTE);
  await copyBtn(page).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_COPY}$`));
  await expect(
    page.locator(BAND).getByRole("heading", { name: "営業 › 見積もり の「見積書の出し方」の写しです", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".k-toast")).toContainText("自分の棚に写しました。「直す」で自分用に直せます。");
  expect(s.count("copy")).toBe(1);
  expect(s.calls.find((c) => c.op === "copy")!.id).toBe(P_QUOTE);
  expect(s.calls.find((c) => c.op === "copy")!.body).toEqual({});
  expect(s.calls.find((c) => c.op === "copy")!.key).toBeTruthy();
  expect(mk.count("tree")).toBe(2);
  expect(mk.count("page", P_COPY)).toBe(1);
  await expect(page.locator(`${TREE} [data-mark="copy"]`)).toHaveCount(1);
  await expect(page.getByRole("button", { name: "直す", exact: true })).toBeVisible();
});

test("K693-UI-015 写すの二度押し：口の答えを止めた間に 2 回押しても写す口は 1 回（写しは 1 つ）・ボタンは押せない", async ({
  page,
}) => {
  const { s } = await setup(page, sharedViewPage());
  await openAt(page, P_QUOTE);
  const release = s.hold("copy");
  await copyBtn(page).click();
  await expect(copyBtn(page)).toHaveAttribute("aria-disabled", "true");
  await copyBtn(page)
    .click({ force: true })
    .catch(() => undefined);
  expect(s.count("copy")).toBe(1);
  release();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_COPY}$`));
  expect(s.count("copy")).toBe(1);
});

for (const [name, reply, code, reread] of [
  ["409 自分の棚のページ", err(409, "E-KNW-080"), "E-KNW-080", true],
  ["409 書き終えていない", err(409, "E-KNW-010"), "E-KNW-010", true],
  ["404", err(404, "E-PAGE-001"), "E-PAGE-001", true],
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002", false],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003", false],
  ["網の切れ", "network", "E-PAGE-008", false],
] as const)
  test(`K693-UI-016 写す口が失敗（${name}）：お知らせ（失敗）に ${code} の文・${reread ? "ページを読み直す" : "読み直さない"}・道は変わらず、ボタンは押し直せる`, async ({
    page,
  }) => {
    const { mk, s } = await setup(page, sharedViewPage());
    s.script("copy", reply);
    await openAt(page, P_QUOTE);
    await copyBtn(page).click();
    await expect(page.locator(".k-toast-error")).toContainText(first(msg(code)));
    expect(mk.count("page", P_QUOTE)).toBe(reread ? 2 : 1);
    await expect(page).toHaveURL(new RegExp(`/knowledge/${P_QUOTE}$`));
    await copyBtn(page).click();
    await expect(page).toHaveURL(new RegExp(`/knowledge/${P_COPY}$`));
    expect(s.count("copy")).toBe(2);
  });

test("K693-UI-017 写しの帯：元が「必ず守る」なら「上が効きます」「…食い違う所は、営業のページが効きます。」・「元のページを開く」で /knowledge/<元の id> に移る（元が会社の棚なら「会社のページ」）。元が消えたとき（gone）は「元のページは消えました」で「元のページを開く」は無い", async ({
  page,
}) => {
  const { mk } = await setup(page, sharedViewPage());
  const mine = (over: Record<string, unknown>) =>
    pageInvoice({
      id: P_COPY,
      title: "見積書の出し方（自分用）",
      acts: ["must-on", "edit"],
      place: { shelf: "me", shelf_name: "自分", group_id: null, folder_id: null, folders: [] },
      copied_from: copiedFrom(over),
    });
  mk.pages.set(P_COPY, mine({ must: true }));
  await openAt(page, P_COPY);
  const band = page.locator(BAND);
  await expect(band).toContainText("上が効きます");
  await expect(band).toContainText("この写しと食い違う所は、営業のページが効きます。");
  await band.getByRole("button", { name: "元のページを開く", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_QUOTE}$`));
  mk.pages.set(P_COPY, mine({ page_id: null, title: "", shelf_name: "", folders: [], must: false, gone: true }));
  await page.goto(`/knowledge/${P_COPY}`);
  await expect(page.locator(BAND).getByRole("heading", { name: "元のページは消えました", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "元のページを開く", exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- 守り・幅・キーボード
test("K693-UI-018 グループ名・マネージャーの名前・フォルダ名・題名に HTML が入っていても、小窓・帯に文字として出て動かない（img も作られない）", async ({
  page,
}) => {
  const evil = '<img src=x onerror="window.__x=1">';
  const { mk, s } = await setup(
    page,
    sharedViewPage({ shared_from: { group_name: evil, writable: false, manager_names: [evil] } }),
  );
  mk.pages.set(
    P_COPY,
    pageInvoice({ id: P_COPY, copied_from: copiedFrom({ shelf_name: evil, folders: [evil], title: evil }) }),
  );
  s.groups = s.groups.map((g, i) => (i === 0 ? { ...g, name: evil, manager_name: evil } : g));
  await openAt(page, P_QUOTE);
  await expect(page.locator(BAND)).toContainText(`${evil}から共有されたページです`);
  await page.goto(`/knowledge/${P_COPY}`);
  await expect(page.locator(BAND)).toContainText(evil);
  mk.pages.set(P_QUOTE, quotePage());
  await page.goto(`/knowledge/${P_QUOTE}`);
  await shareBtn(page).click();
  const d = shareDlg(page);
  await expect(d.locator("li")).toHaveCount(4);
  await expect(d).toContainText(`${evil}さん`);
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator(".k-dialog img, .k-band img").count()).toBe(0);
});

for (const w of WIDTHS) {
  test(`K693-UI-019 幅 ${w}：共有の小窓（長いグループ名・長い名前の 12 グループ）・共有された側の帯・写しの帯（長い名前）を開いても横のはみ出し 0（数値）・小窓が画面の中に収まる`, async ({
    page,
  }) => {
    const long = "とても長いグループの名前".repeat(4);
    const { mk, s } = await setup(page);
    s.groups = Array.from({ length: 12 }, (_, i) => ({
      group_id: `0193c5a0-0000-7000-8000-00000000f${String(i).padStart(3, "0")}`,
      name: `${long}${i}`,
      manager_name: "田中 美咲".repeat(5),
      checked: false,
      state: null,
    }));
    await openAt(page, P_QUOTE, w);
    await shareBtn(page).click();
    const d = shareDlg(page);
    await expect(d.locator("li")).toHaveCount(12);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    const b = (await d.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(w);
    await page.keyboard.press("Escape");
    mk.pages.set(
      P_QUOTE,
      sharedViewPage({ shared_from: { group_name: long, writable: false, manager_names: [long] } }),
    );
    await page.reload();
    await expect(page.locator(BAND)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    mk.pages.set(
      P_COPY,
      pageInvoice({ id: P_COPY, copied_from: copiedFrom({ shelf_name: long, title: long, must: true }) }),
    );
    await page.goto(`/knowledge/${P_COPY}`);
    await expect(page.locator(BAND)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
}

test("K693-UI-020 キーボードだけ：「グループを選んで共有」で Enter → 小窓・Tab を 20 回押しても外へ出ず・Space でチェックの付け外し・Esc で閉じて焦点が戻る。「写して直す」にも焦点して Enter で写せる", async ({
  page,
}) => {
  const { mk, s } = await setup(page);
  await openAt(page, P_QUOTE);
  await shareBtn(page).focus();
  await page.keyboard.press("Enter");
  const d = shareDlg(page);
  await expect(row(d, "受託開発")).toBeVisible();
  await box(d, "受託開発").focus();
  await page.keyboard.press("Space");
  await expect(box(d, "受託開発")).toBeChecked();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".k-dialog"))), `Tab ${i + 1} 回目`).toBe(
      true,
    );
  }
  await page.keyboard.press("Escape");
  await expect(shareBtn(page)).toBeFocused();
  mk.pages.set(P_QUOTE, sharedViewPage());
  await page.goto(`/knowledge/${P_QUOTE}`);
  await expect(page.locator(BAND)).toBeVisible();
  await copyBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/knowledge/${P_COPY}$`));
  expect(s.count("copy")).toBe(1);
});
