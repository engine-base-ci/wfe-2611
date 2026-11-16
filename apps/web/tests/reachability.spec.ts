// 到達性（G-04）：ナビ・カード・ボタンの href 集合 ⇔ 実在ルート集合。全画面共通ヘッダのナビが 404、を機械で捕まえる
import { expect, test } from "@playwright/test";
import { collectInternalHrefs, existingPageRoutes, hrefViolations, unimplementedFlowRoutes } from "./_lib/browser";
import { bridgeRow, loginAs, setupDone, signupViaApi, viewerViaApi } from "./_lib/api";

test("GET / が 200 で、土台（html・body・h1）が描かれる", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();
});

test("USH-00-002 / の内部リンクは全部 実在ルート（page.tsx）を指す", async ({ page }) => {
  await page.goto("/");
  const hrefs = await collectInternalHrefs(page);
  const existing = existingPageRoutes();
  expect(
    hrefViolations(hrefs, existing),
    `404 になる href: ${JSON.stringify(hrefViolations(hrefs, existing))}`,
  ).toEqual([]);
});

test("検査そのものが赤になれる（無いルートを指す href を 1 つ入れると違反として出る）", () => {
  const existing = existingPageRoutes();
  expect(existing).toContain("/");
  expect(hrefViolations(["/", "/no-such-route"], existing)).toEqual(["/no-such-route"]);
  expect(hrefViolations(["/goals/abc"], ["/goals/:id"])).toEqual([]);
});

test("flow の route のうち page.tsx が無いものを数で報告する（T-U-* の残り。0 になるまで画面は完了でない）", async () => {
  const left = unimplementedFlowRoutes(existingPageRoutes());
  test.info().annotations.push({
    type: "未実装の route",
    description: `${left.length} 件：${left.slice(0, 8).join(" ")}${left.length > 8 ? " …" : ""}`,
  });
  expect(Array.isArray(left)).toBe(true);
});

// 入口と行き先の規則（D-086）。画面ではなく規則なので、画面の導出（G1〜G10）では守れない
test("USH-00-012 入っていない人が / を開くと 入る画面（/login）へ送られる", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/\/login$/, { timeout: 30_000 });
  await expect(page.locator("form[data-state='n'] h1")).toHaveText("ログイン");
});
test("USH-00-013 入っている人（PC 未接続）が / を開くと 自分のPCをつなぐ へ送られる", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/");
  await page.waitForURL(/\/setup\/bridge$/, { timeout: 30_000 });
  // /setup/bridge の見出しは K-220 から「PC と使った量」。PC が無いときは K-230 のつなぐ小窓の題「PC をつなぐ」が読み上げの h1
  await expect(page.getByRole("heading", { level: 1, name: /^(PC と使った量|PC をつなぐ)$/ })).toBeVisible();
});
test("USH-00-014 入っている人（PC 接続済み）が / を開くと 今日 へ送られる", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  await setupDone(u); // 今日 が行き先になるのは はじめの設定を通し終わった人（D-089）
  await page.goto("/");
  // 今日（T-U-13）がまだ無い間は、ある画面へ送る。入口が 404 に送ると行き止まりの輪になる（D-086.6）
  const { isBuilt } = await import("../lib/built-routes");
  const want = isBuilt("/today") ? /\/today$/ : /\/ai\/chat$/;
  await page.waitForURL(want, { timeout: 20_000 });
  expect(page.url()).toMatch(want);
  const again = await page.reload(); // 行き先は本当に開く（404 の中身でない）。状態は 200 で見る（描画待ちに頼らない）
  expect(again?.status()).toBe(200);
});
test("USH-00-015 無いパスは「この画面はありません」と戻る導線（素の 404 にしない）", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.locator("[data-state='not-found'] h1")).toHaveText("この画面はありません");
  await page.getByRole("link", { name: "ログインへ戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/no-such-page");
  await page.getByRole("link", { name: "入口へ戻る" }).click();
  await page.waitForURL(/\/setup\/bridge$/, { timeout: 30_000 });
});
test("USH-00-016 その権限で見えない画面は「この権限では見えない」と導線（無言の空画面にしない）", async ({ page }) => {
  const v = await viewerViaApi();
  await loginAs(page, v.token);
  await page.goto("/settings/credentials");
  await expect(page.locator("[data-state='forbidden'] h1")).toHaveText("この権限では見えない");
  await expect(page.getByRole("link", { name: "見える画面へ" })).toBeVisible();
});

// まだ作っていない画面への行き止まり（G-04）。ナビは設計（flow.json）から生成されるので、まだ無い画面も指す。
// 隠すのは嘘（設計にはある）。押せない印を出し、URL を直接開いたときは名前つきで「まだありません」と言う。
test("USH-00-028 もうある画面の一覧（built-routes）が実ファイルと一致する", async () => {
  const { BUILT_ROUTES } = await import("../lib/built-routes");
  const real = existingPageRoutes();
  expect([...BUILT_ROUTES].sort(), "差分があれば python3 scripts/ci/gen_built_routes.py で作り直す").toEqual(
    real.sort(),
  );
});

test("USH-00-027 アプリの枠のナビに、まだ作っていない画面へのリンクが 1 本も無い（準備中で出る）", async ({ page }) => {
  const u = await signupViaApi();
  await setupDone(u);
  await loginAs(page, u.token);
  await page.goto("/ai/chat");
  await page.waitForSelector("aside.side");
  // 折り畳みの中も DOM にはある（hidden）。開かずに全部読む（開く操作は USH-00-005 で押している）
  const hrefs = (await page
    .locator("aside.side a[href^='/']")
    .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""))) as string[];
  expect(hrefViolations(hrefs, existingPageRoutes()), "ナビから押せる先は全部実在する").toEqual([]);
  expect(await page.locator("aside.side [data-soon]").count(), "まだ無い画面は準備中として出る").toBeGreaterThan(0);
});

test("USH-00-029 まだ作っていない画面の URL を直接開くと、名前つきで「まだありません」と戻る導線が出る", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u);
  await loginAs(page, u.token);
  const res = await page.goto("/today"); // 設計にある（今日）・まだ作っていない
  expect(res?.status()).toBe(404);
  await expect(page.locator('[data-state="not-built"] h1')).toContainText("「今日」はまだありません");
  await page.locator("a:has(button)").click(); // 戻る導線
  // 入口は「まだ無い画面」へ送り返さない（送り返すと 404 → 入口 → 404 の輪になる）
  await page.waitForURL((u) => !u.pathname.endsWith("/today"), { timeout: 30_000 });
  const after = await page.reload();
  expect(after?.status(), "戻った先は本当に開く").toBe(200);
});
