// 4 つの状態とエラーの画面（K-26）：/dev/k/states が的。文言は正本（errors.json）の 1 件
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SRC = JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
  errors: { id: string; message: string; action: string; support_code?: string }[];
};
const entry = (id: string) => SRC.errors.find((e) => e.id === id)!;
const PAGES = [
  "E-PAGE-001",
  "E-PAGE-002",
  "E-PAGE-003",
  "E-PAGE-004",
  "E-PAGE-005",
  "E-PAGE-006",
  "E-PAGE-007",
  "E-PAGE-008",
];

test("KN106-001 4 つの状態がそろう（空・読み込み中・失敗・権限が無い）", async ({ page }) => {
  await page.goto("/dev/k/states");
  const empty = page.locator('[data-sample="empty"] [data-state="empty"]');
  await expect(empty.getByRole("heading", { name: "まだチケットがありません" })).toBeVisible();
  await empty.getByRole("button", { name: "チケットを作る" }).click();
  await expect(page.getByRole("status").filter({ hasText: "作る（見本 1）" })).toBeVisible();
  // 読み込み中：すぐには出さず、待ってから「読み込んでいます…」
  const loading = page.locator('[data-sample="loading"] [data-state="loading"]');
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(loading).toHaveText("読み込んでいます…");
  // 失敗：正本の文言と一手・番号
  const err = page.locator('[data-sample="error"] [data-state="error"]');
  await expect(err).toHaveAttribute("data-code", "E-PAGE-007");
  await expect(err.getByRole("heading", { name: "読み込めませんでした。" })).toBeVisible();
  await expect(err.getByText("番号：PAGE-007")).toBeVisible();
  await err.getByRole("button", { name: "もう一度" }).click();
  // 権限が無い：危ない知らせは alert。頼むを押せる
  const no = page.locator('[data-sample="forbidden"] [data-state="error"]');
  await expect(no).toHaveAttribute("role", "alert");
  await no.getByRole("button", { name: "マネージャーに頼む" }).click();
  await expect(page.getByRole("status").filter({ hasText: "頼みました" })).toBeVisible();
});

for (const id of PAGES) {
  test(`KN106-002 ${id}：画面いっぱいのエラーは正本の文言・一手・番号どおり`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`/dev/k/states?page=${id}`);
    const e = entry(id);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(e.message.slice(0, e.message.indexOf("。") + 1));
    await expect(main).toContainText(e.message.slice(e.message.indexOf("。") + 1));
    const acts = e.action.split("／").map((s) => s.trim());
    await expect(main.getByRole("link", { name: acts[0] })).toBeVisible();
    await expect(main.getByText(`番号：${e.support_code}`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(
      0,
    );
  });
}

test("KN106-003 オフラインになると帯が出て、つながると消える", async ({ page, context }) => {
  await page.goto("/dev/k/states");
  const banner = page.getByRole("status").filter({ hasText: "オフラインです。" });
  await expect(banner).toHaveCount(0);
  await context.setOffline(true);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(entry("E-PAGE-008").message.split("。")[1]!);
  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
});

test("KN106-004 描いている途中で落ちても真っ白にしない（正本の「読み込めない」ともう一度）", async ({ page }) => {
  await page.goto("/dev/k/states?boom=1");
  await expect(page.getByRole("heading", { level: 1, name: "読み込めませんでした。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "もう一度" })).toBeVisible();
});

test("KN115-001 根の layout で落ちても真っ白にしない（正本の「読み込めない」・見た目と書体も効いている）", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "k-boom-root", value: "1", url: baseURL ?? "http://127.0.0.1:3123" }]);
  await page.goto("/dev/k");
  await expect(page.getByRole("heading", { level: 1, name: "読み込めませんでした。" })).toBeVisible();
  await expect(page.getByRole("button", { name: "もう一度" })).toBeVisible();
  // 見た目（k-root の地の色）が当たっている
  expect(await page.locator(".k-error-page").evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(
    "rgba(0, 0, 0, 0)",
  );
});
