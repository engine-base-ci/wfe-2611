// K-394「やり取りの書き込みを直す・消す・☆」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f6/talk-edit・talk-delete（本番と同じ部品 features/F6/thread/views.tsx の Post・EditingPost・DeleteMessageConfirm）。
//   「…」はメニューの型 components/k/menu.tsx（K-369・置き場の重なりの順は K-381）。@ の候補は K-393 の部品をそのまま使う。
//   口の入力と答えの形は口の葉 K-386（updateTicketMessage・deleteTicketMessage・starTicketMessage）の md に合わせた。
//   準備はまだ無い口を使わない（書き込みは読む口の答えに置く）。固定の待ちは使わない（答えを hold() で止める）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { CATALOG as ENTRIES } from "../../../../packages/errors/src/catalog";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import {
  CREATED,
  EDIT_PAIRS,
  MOCK_BASE,
  SATO,
  SUZU_W,
  TAKA_W,
  deleted,
  err,
  feed,
  jstAt,
  mockThread,
  openThread,
  overflowX,
  panel,
  post,
  postOf,
} from "./thread-mock";

test.use({ timezoneId: "Asia/Tokyo" });

/** 正本の文（生成物 packages/errors/src/catalog.ts・07_qa/test-specs/errors.json から作る）。試験はファイルを読まずに import する */
const CATALOG: Record<string, string> = Object.fromEntries(Object.values(ENTRIES).map((e) => [e.id, e.message]));
const FAILED = "送れませんでした。もう一度お試しください（書いた字は残っています）";
const MINE_ID = "0193c5a0-0000-7000-8000-0000000f0101";
const OTHER_ID = "0193c5a0-0000-7000-8000-0000000f0102";
const MINE = () =>
  post(TAKA_W, "2025-11-01 11:02", "了解です。10/19 分を外して今日中に送ります", { id: MINE_ID, stars: 0 });
const OTHER = (o: { can_delete?: boolean } = {}) =>
  post(SUZU_W, "2025-11-01 10:20", "10/19 の追加対応は無償にした件", {
    id: OTHER_ID,
    stars: 1,
    can_edit: false,
    can_delete: o.can_delete ?? false,
  });
const more = (page: Page, name: string, time: string) =>
  postOf(page, name, time).getByRole("button", { name: "この書き込みの操作" });
const editBox = (page: Page) => panel(page).getByRole("textbox", { name: "書き込みを直す" });
const dialog = (page: Page) => page.getByRole("alertdialog").or(page.getByRole("dialog"));

// ---------------------------------------------------------------- モックと本番の突き合わせ
const DRIVE: Record<string, (page: Page, w: number) => Promise<void>> = {
  "talk-edit": async (page, w) => {
    const mineEdited = post(TAKA_W, "2025-11-01 11:02", "了解です。10/19 分を外して今日中に送ります", {
      id: MINE_ID,
      edited_at: jstAt("2025-11-01 11:05"),
    });
    const second = post(TAKA_W, "2025-11-01 11:08", "請求書の宛名は経理部 山田様で合っていますか？");
    await mockThread(page, { items: [CREATED(), mineEdited, second] });
    await openThread(page, w);
    await more(page, "高本 聖斗", "11:08").click();
    await page.getByRole("menuitem", { name: "直す" }).click();
    await expect(editBox(page)).toBeVisible();
    await more(page, "高本 聖斗", "11:02").click();
    await expect(page.getByRole("menuitem", { name: "直す" })).toBeVisible();
  },
  "talk-delete": async (page, w) => {
    await mockThread(page, { items: [CREATED(), MINE(), deleted(SUZU_W, SUZU_W, "2025-11-01 11:20")] });
    await openThread(page, w);
    await more(page, "高本 聖斗", "11:02").click();
    await page.getByRole("menuitem", { name: "消す…" }).click();
    await expect(dialog(page)).toBeVisible();
  },
};
for (const [id, drive] of Object.entries(DRIVE)) {
  for (const w of MATCH_WIDTHS) {
    test(`K394-UI-001 ${id} 幅 ${w}：「…」のメニュー・その場で直す欄とボタン・消す確かめの小窓（題・引用・ボタン）の値がモックと同じ`, async ({
      browser,
    }) => {
      const { rows, bad } = await matchMock(browser, id, w, (page) => drive(page, w), {
        pairs: EDIT_PAIRS,
        base: MOCK_BASE,
      });
      expect(rows.length, "比べた役がある").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 「…」のメニュー

test("K394-UI-002 「…」：自分の書き込みは 直す・消す…／マネージャーが見る人の書き込み（can_delete）は 消す… だけ／どちらでもなければ「…」を出さない", async ({
  page,
}) => {
  await mockThread(page, {
    items: [
      MINE(),
      OTHER({ can_delete: true }),
      post(SUZU_W, "2025-11-01 11:30", "別の人の書き込み", { can_edit: false, can_delete: false }),
    ],
  });
  await openThread(page);
  await more(page, "高本 聖斗", "11:02").click();
  await expect(page.getByRole("menuitem")).toHaveText(["直す", "消す…"]);
  await page.keyboard.press("Escape");
  await more(page, "鈴木 一郎", "10:20").click();
  await expect(page.getByRole("menuitem")).toHaveText(["消す…"]);
  await page.keyboard.press("Escape");
  await expect(more(page, "鈴木 一郎", "11:30")).toHaveCount(0);
});

test("K394-UI-003 「…」のキーボードと重なり：Enter で開き ↓ で移り Esc で閉じて「…」に戻る。開いた箱は貼り付く帯やパネルの下に潜らない（項目の真ん中に一番上に在るのが項目）", async ({
  page,
}) => {
  await mockThread(page, { items: [MINE()] });
  await openThread(page);
  const btn = more(page, "高本 聖斗", "11:02");
  await btn.focus();
  await page.keyboard.press("Enter");
  const item = page.getByRole("menuitem", { name: "直す" });
  await expect(item).toBeVisible();
  const top = await item.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
  expect(top, "項目が一番上").toBe(true);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(item).toHaveCount(0);
  await expect(btn).toBeFocused();
});

// ---------------------------------------------------------------- 直す

test("K394-UI-004 手順 S1：直す → その場の欄に今の本文。「やめる」は口を呼ばずに元の形へ。「直す」で PATCH /ticket_messages/:id（本文と @ の人だけ）→ 新しい本文と「直した 11/01 11:05」。読み直さない", async ({
  page,
}) => {
  const t = await mockThread(page, { items: [MINE()] });
  await openThread(page);
  await more(page, "高本 聖斗", "11:02").click();
  await page.getByRole("menuitem", { name: "直す" }).click();
  await expect(editBox(page)).toHaveValue("了解です。10/19 分を外して今日中に送ります");
  await expect(editBox(page)).toBeFocused();
  await panel(page).getByRole("button", { name: "やめる" }).click();
  await expect(editBox(page)).toHaveCount(0);
  expect(t.edits).toHaveLength(0);
  await more(page, "高本 聖斗", "11:02").click();
  await page.getByRole("menuitem", { name: "直す" }).click();
  await editBox(page).fill("了解です。10/19 分を外して明日送ります");
  await panel(page).getByRole("button", { name: "直す", exact: true }).click();
  const p = postOf(page, "高本 聖斗", "11:02");
  await expect(p.locator(".k-talk-body")).toHaveText("了解です。10/19 分を外して明日送ります");
  await expect(p.locator(".k-talk-post-head")).toContainText("直した 11/01 11:05");
  expect(t.edits).toEqual([
    { id: MINE_ID, body: { body: "了解です。10/19 分を外して明日送ります", mention_member_ids: [] } },
  ]);
  expect(t.reads).toHaveLength(1);
});

test("K394-UI-005 直して新しく @：直す欄でも @ の候補（K-393 の部品・見られる人だけ）が出て、選んだ人を @ の人に入れる（新しく呼んだ人への知らせは口が出す）", async ({
  page,
}) => {
  const t = await mockThread(page, { items: [MINE()] });
  await openThread(page);
  await more(page, "高本 聖斗", "11:02").click();
  await page.getByRole("menuitem", { name: "直す" }).click();
  await editBox(page).fill("確認してください @佐");
  await expect(
    panel(page).getByRole("listbox", { name: "呼べる人（このチケットを見られる人だけ）" }).getByRole("option"),
  ).toHaveText([/佐藤 花子/]);
  await editBox(page).press("Enter");
  await expect(editBox(page)).toHaveValue("確認してください @佐藤 ");
  await panel(page).getByRole("button", { name: "直す", exact: true }).click();
  await expect.poll(() => t.edits.length).toBe(1);
  expect(t.edits[0]!.body["mention_member_ids"]).toEqual([SATO]);
});

for (const [label, reply, text] of [
  ["503", err(503, "SERVICE_UNAVAILABLE"), FAILED],
  ["404", err(404, "E-PAGE-001"), CATALOG["E-PAGE-001"]!],
  ["403", err(403, "E-PAGE-002"), CATALOG["E-PAGE-002"]!],
] as const) {
  test(`K394-UI-006 手順 S1 の失敗（${label}）：直す欄の上に知らせ（${text.slice(0, 12)}…）・直した字は残り、欄は開いたまま`, async ({
    page,
  }) => {
    const t = await mockThread(page, { items: [MINE()] });
    t.on.edit = () => reply;
    await openThread(page);
    await more(page, "高本 聖斗", "11:02").click();
    await page.getByRole("menuitem", { name: "直す" }).click();
    await editBox(page).fill("直した字");
    await panel(page).getByRole("button", { name: "直す", exact: true }).click();
    await expect(panel(page).getByRole("alert")).toContainText(text);
    await expect(editBox(page)).toHaveValue("直した字");
  });
}

test("K394-UI-007 直す欄が空白だけなら「直す」を押せない・Esc はやめると同じ（口を呼ばない）", async ({ page }) => {
  const t = await mockThread(page, { items: [MINE()] });
  await openThread(page);
  await more(page, "高本 聖斗", "11:02").click();
  await page.getByRole("menuitem", { name: "直す" }).click();
  await editBox(page).fill("   ");
  await expect(panel(page).getByRole("button", { name: "直す", exact: true })).toBeDisabled();
  await editBox(page).press("Escape");
  await expect(editBox(page)).toHaveCount(0);
  await expect(postOf(page, "高本 聖斗", "11:02").locator(".k-talk-body")).toHaveText(
    "了解です。10/19 分を外して今日中に送ります",
  );
  expect(t.edits).toHaveLength(0);
});

test("K394-UI-008 直すの二度押し：送っている間は押せず、口は 1 回", async ({ page }) => {
  const t = await mockThread(page, { items: [MINE()] });
  await openThread(page);
  await more(page, "高本 聖斗", "11:02").click();
  await page.getByRole("menuitem", { name: "直す" }).click();
  await editBox(page).fill("直した字");
  const open = t.hold();
  const save = panel(page).getByRole("button", { name: "直す", exact: true });
  await save.click();
  await expect(save).toBeDisabled();
  await save.click({ force: true });
  expect(t.edits).toHaveLength(1);
  open();
  await expect(postOf(page, "高本 聖斗", "11:02").locator(".k-talk-body")).toHaveText("直した字");
});

// ---------------------------------------------------------------- 消す

test("K394-UI-009 手順 S2：消す… → 確かめ（題「この書き込みを消しますか？」・「消すと元に戻せません。「高本 が書き込みを消しました」の 1 行が残ります」・本文の引用）。やめるは口を呼ばず「…」に戻る。消すで DELETE → 書き込みが「高本 が書き込みを消しました」の 1 行になり、本文はどこにも残らない", async ({
  page,
}) => {
  const t = await mockThread(page, { items: [MINE()] });
  await openThread(page);
  await more(page, "高本 聖斗", "11:02").click();
  await page.getByRole("menuitem", { name: "消す…" }).click();
  const d = dialog(page);
  await expect(d.getByText("この書き込みを消しますか？")).toBeVisible();
  await expect(d).toContainText("消すと元に戻せません。「高本 が書き込みを消しました」の 1 行が残ります");
  await expect(d.locator(".k-talk-quote")).toHaveText("了解です。10/19 分を外して今日中に送ります");
  await d.getByRole("button", { name: "やめる" }).click();
  await expect(d).toHaveCount(0);
  expect(t.deletes).toHaveLength(0);
  await expect(more(page, "高本 聖斗", "11:02")).toBeFocused();
  await more(page, "高本 聖斗", "11:02").click();
  await page.getByRole("menuitem", { name: "消す…" }).click();
  await dialog(page).getByRole("button", { name: "消す", exact: true }).click();
  await expect(panel(page).locator(".k-talk-line")).toHaveText([/高本 が書き込みを消しました\s*11:09/]);
  await expect(feed(page).getByRole("article")).toHaveCount(0);
  await expect(panel(page)).not.toContainText("今日中に送ります");
  expect(t.deletes).toEqual([MINE_ID]);
});

test("K394-UI-010 マネージャーが人の書き込みを消す：確かめの文は「マネージャーの 高本 が 鈴木 の書き込みを消しました」の 1 行が残る。消した後の 1 行も同じ字", async ({
  page,
}) => {
  const t = await mockThread(page, { items: [OTHER({ can_delete: true })] });
  t.on.del = (id) => ({ status: 200, body: { data: { ...deleted(TAKA_W, SUZU_W, "2025-11-01 11:20", true), id } } });
  await openThread(page);
  await more(page, "鈴木 一郎", "10:20").click();
  await page.getByRole("menuitem", { name: "消す…" }).click();
  await expect(dialog(page)).toContainText("「マネージャーの 高本 が 鈴木 の書き込みを消しました」の 1 行が残ります");
  await dialog(page).getByRole("button", { name: "消す", exact: true }).click();
  await expect(panel(page).locator(".k-talk-line")).toHaveText([
    /マネージャーの 高本 が 鈴木 の書き込みを消しました\s*11:20/,
  ]);
  expect(t.deletes).toEqual([OTHER_ID]);
});

for (const [label, reply, text] of [
  ["503", err(503, "SERVICE_UNAVAILABLE"), CATALOG["E-PAGE-004"] ?? ""],
  ["404", err(404, "E-PAGE-001"), CATALOG["E-PAGE-001"]!],
] as const) {
  test(`K394-UI-011 手順 S2 の失敗（${label}）：小窓の中に知らせを出し、書き込みは消えずに残る`, async ({ page }) => {
    const t = await mockThread(page, { items: [MINE()] });
    t.on.del = () => reply;
    await openThread(page);
    await more(page, "高本 聖斗", "11:02").click();
    await page.getByRole("menuitem", { name: "消す…" }).click();
    await dialog(page).getByRole("button", { name: "消す", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toContainText(text.slice(0, 10));
    await expect(postOf(page, "高本 聖斗", "11:02")).toBeVisible();
  });
}

test("K394-UI-012 消すの二度押し：答えを待つ間は「消す」を押せず、口は 1 回", async ({ page }) => {
  const t = await mockThread(page, { items: [MINE()] });
  await openThread(page);
  await more(page, "高本 聖斗", "11:02").click();
  await page.getByRole("menuitem", { name: "消す…" }).click();
  const open = t.hold();
  const btn = dialog(page).getByRole("button", { name: /^消す/ });
  await btn.click();
  await expect(btn).toBeDisabled();
  await btn.click({ force: true });
  expect(t.deletes).toHaveLength(1);
  open();
  await expect(panel(page).locator(".k-talk-line")).toHaveText([/高本 が書き込みを消しました/]);
  expect(t.deletes).toHaveLength(1);
});

// ---------------------------------------------------------------- ☆

test("K394-UI-013 手順 S3：☆ を押すと POST /ticket_messages/:id/star・押した形と数（☆ 2）は答えを待たずに出る。もう一度押すと外れて ☆ 1（誰にも知らせない＝口の仕事）", async ({
  page,
}) => {
  const t = await mockThread(page, { items: [OTHER()] });
  await openThread(page);
  const star = () => postOf(page, "鈴木 一郎", "10:20").locator(".k-talk-act").first();
  await expect(star()).toHaveText("☆ 1");
  const open = t.hold();
  await star().click();
  await expect(star()).toHaveText("☆ 2");
  await expect(star()).toHaveAttribute("aria-pressed", "true");
  open();
  await expect.poll(() => t.stars.length).toBe(1);
  // 1 回目の答えが画面に着いて押せる形に戻ってから 2 回目を押す（答えを待つ間の押しは捨てる決まり・K394-UI-014）
  await expect(star()).not.toHaveAttribute("aria-disabled", "true");
  await expect(star()).toHaveText("☆ 2");
  t.on.star = (id) => ({ status: 200, body: { data: { id, stars: 1, starred: false } } });
  await star().click();
  await expect(star()).toHaveText("☆ 1");
  await expect(star()).toHaveAttribute("aria-pressed", "false");
  expect(t.stars).toEqual([OTHER_ID, OTHER_ID]);
});

test("K394-UI-014 ☆ の答えを待つ間は押せない（続けて押しても口は 1 回）", async ({ page }) => {
  const t = await mockThread(page, { items: [OTHER()] });
  await openThread(page);
  const star = postOf(page, "鈴木 一郎", "10:20").locator(".k-talk-act").first();
  const open = t.hold();
  await star.click();
  await expect(star).toHaveAttribute("aria-disabled", "true");
  await star.click({ force: true });
  expect(t.stars).toHaveLength(1);
  open();
  await expect(star).not.toHaveAttribute("aria-disabled", "true");
});

for (const [label, kind] of [
  ["503", "503"],
  ["網の切れ", "abort"],
] as const) {
  test(`K394-UI-015 手順 S3 の失敗（${label}）：押した形と数は元（☆ 1）に戻り、パネルに知らせを出す`, async ({
    page,
  }) => {
    const t = await mockThread(page, { items: [OTHER()] });
    if (kind === "abort")
      await page.route(/\/api\/v1\/ticket_messages\/[^/]+\/star$/, (route) => route.abort("failed"));
    else t.on.star = () => err(503, "SERVICE_UNAVAILABLE");
    await openThread(page);
    const star = postOf(page, "鈴木 一郎", "10:20").locator(".k-talk-act").first();
    await star.click();
    await expect(star).toHaveText("☆ 1");
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await expect(panel(page).getByRole("alert")).toBeVisible();
  });
}

for (const w of [320, 375, 768, 1024, 1440]) {
  test(`K394-UI-016 幅 ${w}：その場で直す欄に長い字を入れても・消す確かめの小窓でも横溢れ 0`, async ({ page }) => {
    await mockThread(page, { items: [MINE()] });
    await openThread(page, w);
    await more(page, "高本 聖斗", "11:02").click();
    await page.getByRole("menuitem", { name: "直す" }).click();
    await editBox(page).fill(`https://example.com/${"a".repeat(300)}`);
    expect(await overflowX(page)).toBe(0);
    await panel(page).getByRole("button", { name: "やめる" }).click();
    await more(page, "高本 聖斗", "11:02").click();
    await page.getByRole("menuitem", { name: "消す…" }).click();
    await expect(dialog(page)).toBeVisible();
    expect(await overflowX(page)).toBe(0);
  });
}
