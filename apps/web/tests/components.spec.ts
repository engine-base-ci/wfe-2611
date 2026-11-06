// 新しい部品の操作（K-24）：キーボードだけで使える・読み上げに名前と状態が出る・暗いテーマで色が替わる。/dev/k が的
import { expect, test, type Page } from "@playwright/test";

const open = async (page: Page, width = 1024) => {
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto("/dev/k");
  expect(res?.status()).toBe(200);
};
const bg = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e) => getComputedStyle(e).backgroundColor);

test("KN104-001 ボタン：押すと処理中（aria-busy）で押し直せない。押せないボタンは disabled", async ({ page }) => {
  await open(page);
  const save = page.getByRole("button", { name: "保存する" });
  await save.click();
  await expect(save).toHaveAttribute("aria-busy", "true");
  await expect(save).toBeDisabled();
  await expect(save).not.toHaveAttribute("aria-busy", "true", { timeout: 5000 });
  await expect(page.getByRole("button", { name: "押せない" })).toBeDisabled();
});

test("KN104-002 入力：見出しで名前が付き、理由は読み上げにつながる（aria-describedby）", async ({ page }) => {
  await open(page);
  const title = page.getByRole("textbox", { name: "件名" });
  await expect(title).toHaveAttribute("aria-required", "true");
  await page.getByRole("button", { name: "確かめる" }).click();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveAccessibleDescription(/件名を入れてください/);
  await title.fill("見積");
  await page.getByRole("button", { name: "確かめる" }).click();
  await expect(title).not.toHaveAttribute("aria-invalid", "true");
  // スマホで拡大されない大きさ（16px 以上）
  expect(await title.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
});

test("KN104-003 選ぶ：キーボードで開いて選べる。使えない項目は選べない", async ({ page }) => {
  await open(page);
  const trigger = page.getByRole("combobox", { name: "種類" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option", { name: "会議" })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("option", { name: "課題" }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(trigger).toHaveText(/課題/);
});

test("KN104-004 表：表の名前・列の見出し（scope=col）がある", async ({ page }) => {
  await open(page);
  const t = page.getByRole("table", { name: "チケット（3 件）" });
  await expect(t).toBeVisible();
  await expect(t.getByRole("columnheader")).toHaveCount(4);
  await expect(t.getByRole("row")).toHaveCount(4);
  await expect(t.getByRole("cell", { name: "止まっている" })).toBeVisible();
});

test("KN104-005 タブ：←→ で移り、選んだタブの中身だけが出る。使えないタブは飛ばす", async ({ page }) => {
  await open(page);
  const list = page.getByRole("tablist", { name: "チケットの中" });
  await list.getByRole("tab", { name: "中身" }).focus();
  await expect(list.getByRole("tab", { name: "中身" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "記録" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "記録" })).toHaveAttribute("aria-selected", "true");
  // 切り替えの動きの間は、前の中身（inert）と新しい中身が一瞬並ぶ（K-113）。選んだタブに結びついた中身（aria-labelledby で名前が付く）だけを見る
  await expect(page.getByRole("tabpanel", { name: "記録", exact: true })).toHaveText("記録のタブ");
  await expect(page.getByRole("tabpanel", { name: "中身", exact: true })).toBeHidden();
  await expect(page.getByRole("tab", { name: "まだ" })).toHaveAttribute("aria-disabled", "true");
});

test("KN104-006 知らせ：帯は role=status／alert。小さな知らせは出て、閉じられる", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("alert").filter({ hasText: "送れませんでした" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "月末の締め" })).toBeVisible();
  await page.getByRole("button", { name: "知らせを出す" }).click();
  await expect(page.getByText("コピーしました")).toBeVisible();
  await page.getByRole("button", { name: "失敗の知らせ" }).click();
  const err = page.locator(".k-toast").filter({ hasText: "保存できませんでした" });
  await expect(err).toBeVisible();
  const region = page.getByRole("region", { name: /^知らせ alt\+T$/ });
  await expect(region).toBeAttached();
  // 閉じるはいつも出ている（マウスでもキーボードでも閉じられる）
  await err.getByRole("button", { name: "閉じる" }).click();
  await expect(err).toBeHidden();
  // キーボード：Alt+T で知らせの束に移り、Tab で閉じるへ、Enter で閉じる
  await page.getByRole("button", { name: "失敗の知らせ" }).click();
  await expect(err).toBeVisible();
  await page.keyboard.press("Alt+T");
  const close = err.getByRole("button", { name: "閉じる" });
  for (let i = 0; i < 3 && !(await close.evaluate((e) => e === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(err).toBeHidden();
});

test("KN104-007 ダイアログ：開くと中に動き、Esc で閉じ、開いたボタンに戻る", async ({ page }) => {
  await open(page);
  const opener = page.getByRole("button", { name: "ダイアログを開く" });
  await opener.click();
  const dlg = page.getByRole("dialog", { name: "共有の相手" });
  await expect(dlg).toBeVisible();
  await expect(dlg).toHaveAccessibleDescription(/見られる人を選びます/);
  expect(await dlg.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
  await expect(opener).toBeFocused();
});

test("KN104-008 取り消せない操作の確かめ：やめると何もしない。消すを押すと消える", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "消す" }).first().click();
  const dlg = page.getByRole("alertdialog", { name: "チケットを消しますか" });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "やめる" }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByText("消しました")).toHaveCount(0);
  await page.getByRole("button", { name: "消す" }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "消す" }).click();
  await expect(page.getByRole("status").filter({ hasText: "消しました" })).toBeVisible();
});

test("KN104-009 見た目：暗いを選ぶと色が替わり、開き直しても残る。システムはシステムに合わせる", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page);
  const light = await bg(page, ".k-root");
  await page.locator(".k-theme label", { hasText: "暗い" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bg(page, ".k-root")).not.toBe(light);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); // サーバーが cookie から付ける
  await expect(page.getByRole("radio", { name: "暗い" })).toBeChecked();
  await page.locator(".k-theme label", { hasText: "システム" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  expect(await bg(page, ".k-root")).toBe(light);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await bg(page, ".k-root")).not.toBe(light);
});

test("KN104-010 375・768・1440 で横にはみ出さない。押せるものは 24px 以上", async ({ page }) => {
  for (const w of [375, 768, 1440]) {
    await open(page, w);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `幅 ${w}`,
    ).toBeLessThanOrEqual(0);
    const small = await page.$$eval("button, [role=combobox], [role=tab], label:has(input[type=radio])", (els) =>
      els
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.width < 24 || r.height < 24);
        })
        .map((e) => e.textContent?.trim() ?? e.tagName),
    );
    expect(small, `幅 ${w} の 24px 未満の的`).toEqual([]);
  }
});

test("KN104-011 書体が本当に読み込まれる（名前の指定だけでなく、実際に Noto Sans JP で描く）", async ({ page }) => {
  await open(page);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, ""));
  });
  expect(loaded).toContain("Noto Sans JP Variable");
});
