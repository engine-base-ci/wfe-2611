// K-338「試験の差し替えが印を置き直してログインの画面が /mfa-setup へ移り始める揺れ（K319-UI-026）を止める」の画面の試験（実 Chrome）。
//   印を置く関数は seed-token.ts（K-319 の試験の差し替えも使う）。口は網の手前で差し替える（K-319 の試験と同じ口の形・印の立った人のほかの口は 403・MFA_REQUIRED）。
//   本人の Bridge（127.0.0.1:38617）にも届かせない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import { seedTokenOnce, TOKEN_KEY } from "./seed-token";

const WS = "aaaaaaaa-0000-4000-8000-000000000338";
const TOKEN = `tok-${WS}`;
const PW = "correct-horse-battery-1";
const NOW = "2026-11-18T03:00:00Z";
const BOX = '[data-part="auth-box"]';
/** 印が立っていても開く口（K-321 の MFA_OPEN_OPS と同じ） */
const MFA_OPEN = [
  "/api/v1/me/security",
  "/api/v1/auth/step-up",
  "/api/v1/auth/sign-out",
  "/api/v1/me/two-factor/enable",
  "/api/v1/me/two-factor/confirm",
  "/api/auth/passkey/generate-register-options",
  "/api/auth/passkey/verify-registration",
];

test.use({ timezoneId: "UTC" });

type Reply = { status: number; body: unknown };
const ok = (data: unknown): Reply => ({ status: 200, body: { data, meta: {} } });
const err = (status: number, code: string): Reply => ({ status, body: { error: code.toLowerCase(), code } });

/** 印の立った人（パスワードだけ）。付けるの口は 401（ログインが切れた） */
async function mockPending(page: Page): Promise<void> {
  await seedTokenOnce(page, TOKEN);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route) => {
    const p = new URL(route.request().url()).pathname;
    let r: Reply;
    if (!MFA_OPEN.includes(p)) r = err(403, "MFA_REQUIRED");
    else if (p === "/api/v1/me/security")
      r = ok({
        passkeys: [],
        has_password: true,
        two_factor: false,
        backup_codes_left: null,
        mfa_pending: true,
        two_factor_required: true,
      });
    else if (p === "/api/v1/me/two-factor/enable") r = err(401, "UNAUTHENTICATED");
    else r = err(404, "NOT_FOUND");
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
}

test("K338-UI-001 401 で画面が印を消してログインへ移った後、差し替えは印を置き直さない（ログインの画面は /mfa-setup へ移り始めない）", async ({
  page,
}) => {
  await mockPending(page);
  const moves: string[] = [];
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) moves.push(r.url());
  });
  await page.clock.setFixedTime(new Date(NOW));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const res = await page.goto("/mfa-setup");
  expect(res?.status()).toBe(200);
  expect(await page.evaluate((k) => window.localStorage.getItem(k), TOKEN_KEY)).toBe(TOKEN);
  await page.locator(`${BOX} .k-auth-choice`, { hasText: "2 段階認証を付ける" }).click();
  const check = page.getByRole("dialog", { name: "本人か確かめます" });
  await check.getByLabel("パスワード", { exact: true }).fill(PW);
  await check.getByRole("button", { name: "確かめる" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fmfa-setup$/);
  await page.waitForLoadState("networkidle"); // ログインの画面の口が全部返り終わるまで待つ（移り始めるならこの間に始まる）
  expect(await page.evaluate((k) => window.localStorage.getItem(k), TOKEN_KEY)).toBeNull();
  await expect(page).toHaveURL(/\/login\?next=%2Fmfa-setup$/);
  expect(moves.filter((u) => new URL(u).pathname === "/mfa-setup" && new URL(u).searchParams.has("back"))).toEqual([]);
});
