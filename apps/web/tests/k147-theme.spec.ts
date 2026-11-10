// K-147「見た目の最初を明るいにする」の画面の試験（実 Chrome・実装より先に積む）。決める人の決定 D-129.45：
//   選んでいない人（cookie が無い・知らない値）は、OS が暗くても明るい。「暗い」は暗い・「システム」は OS に合わせる（D-128.55 のまま）
import { expect, test, type Page } from "@playwright/test";

const scheme = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--k-scheme").trim());

test("K147-UI-001 選んでいない・OS は暗い：見本の画面は明るい（data-theme=light・色は明るい・「明るい」が選ばれている）", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const res = await page.goto("/dev/k");
  expect(res?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await scheme(page)).toBe("light");
  await expect(page.getByRole("radio", { name: "明るい" })).toBeChecked();
});

test("K147-UI-002 「暗い」を選ぶ：暗くなり、開き直しても暗い", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/dev/k");
  await page.locator(".k-theme label", { hasText: "暗い" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await scheme(page)).toBe("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await scheme(page)).toBe("dark");
});

test("K147-UI-003 「システム」を選ぶ：OS が暗ければ暗く、明るければ明るい（開き直しても同じ）", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/dev/k");
  await page.locator(".k-theme label", { hasText: "システム" }).click();
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  expect(await scheme(page)).toBe("dark");
  await page.emulateMedia({ colorScheme: "light" });
  expect(await scheme(page)).toBe("light");
});

test("K147-UI-004 ログインの前の画面（登録）も、選んでいない・OS は暗いなら明るい", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/signup");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await scheme(page)).toBe("light");
});

test("K147-UI-005 cookie が知らない値（k-theme=blue）・OS は暗い：明るい", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "k-theme", value: "blue", url: baseURL ?? "http://127.0.0.1:3123" }]);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/dev/k");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await scheme(page)).toBe("light");
});

test("K147-UI-006 根の layout で落ちたときの画面（global-error）も、選んでいない・OS は暗いなら明るい。「暗い」を選んでいれば暗い", async ({
  page,
  context,
  baseURL,
}) => {
  const url = baseURL ?? "http://127.0.0.1:3123";
  await context.addCookies([{ name: "k-boom-root", value: "1", url }]);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/dev/k");
  await expect(page.getByRole("button", { name: "もう一度" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await scheme(page)).toBe("light");
  await context.addCookies([{ name: "k-theme", value: "dark", url }]);
  await page.goto("/dev/k");
  await expect(page.getByRole("button", { name: "もう一度" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await scheme(page)).toBe("dark");
});
