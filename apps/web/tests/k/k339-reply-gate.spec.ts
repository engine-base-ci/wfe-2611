// K-339「K-319 の画面の試験（k319-security-setup.spec.ts）の揺れをファイル全体でまとめて止める」の画面の試験（実 Chrome）。
//   答えを止める門は reply-gate.ts（K-319 の試験の差し替えも使う）。口は網の手前で差し替える（K-319 の試験と同じ口の形）。
//   本人の Bridge（127.0.0.1:38617）にも届かせない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import { replyGate, type ReplyGate } from "./reply-gate";
import { seedTokenOnce } from "./seed-token";
import { shellData } from "./shell-answer";

const WS = "aaaaaaaa-0000-4000-8000-000000000339";
const ME = "11111111-0000-4000-8000-000000000339";
const TOKEN = `tok-${WS}`;
const PW = "correct-horse-battery-1";
const NOW = "2026-11-18T03:00:00Z";
const SEC = 'section[aria-labelledby="security-title"]';
const URI = "otpauth://totp/Kaname:takamoto?secret=JBSWY3DPEHPK3PXP&issuer=Kaname";
const CODES = Array.from({ length: 10 }, (_, i) => `k339-${String(i).padStart(4, "0")}`);

test.use({ timezoneId: "UTC" });

type Reply = { status: number; body: unknown };
const ok = (data: unknown, status = 200): Reply => ({ status, body: { data, meta: {} } });

/** パスワードだけの人。確かめの口は門が開くまで答えを返さない。確かめの口に来た体を confirms にためる */
async function mockHeld(page: Page, gate: ReplyGate): Promise<{ confirms: unknown[] }> {
  const seen = { confirms: [] as unknown[] };
  await seedTokenOnce(page, TOKEN);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    let r: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    if (p === "/api/v1/me/security")
      r = ok({
        passkeys: [],
        has_password: true,
        two_factor: seen.confirms.length > 0,
        backup_codes_left: seen.confirms.length > 0 ? 10 : null,
        mfa_pending: false,
        two_factor_required: true,
      });
    else if (p === "/api/v1/me/two-factor/enable") r = ok({ otpauth_uri: URI, secret: "JBSWY3DPEHPK3PXP" }, 201);
    else if (p === "/api/v1/me/two-factor/confirm") {
      seen.confirms.push(req.postDataJSON());
      await gate.wait;
      r = ok({ backup_codes: CODES, token: null }, 201);
    } else if (p === "/api/auth-ext/me" || p === "/api/v1/me")
      r = ok({
        member_id: ME,
        tenant_id: WS,
        display_name: "高本",
        role_id: "owner",
        scope_id: null,
        workspace_name: "ENGINE BASE",
      });
    else if (p === "/api/v1/scopes") r = { status: 200, body: { data: [], meta: { limit: 200, writable: [] } } };
    else if (p === "/api/v1/shell")
      r = ok(shellData({ groups: [] })); // 外枠の口 getShell（K-466）
    else if (p === "/api/v1/approvals/queue")
      r = { status: 200, body: { data: [], meta: { limit: 20, counts: { total: 0 }, cursor: null } } };
    else if (p === "/api/v1/bridge/devices") r = ok([]);
    else if (p === "/api/v1/tickets") r = { status: 200, body: { data: [], meta: { limit: 50, cursor: null } } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return seen;
}

test("K339-UI-001 確かめの答えを門で止めている間は答えを待つ形のまま（確かめるは busy・バックアップコードの小窓は出ない）で、その間に 6 けた目を打ち替えて 6 つそろえ直しても確かめは 2 回目を送らず、門を開けると小窓が 1 つ出る", async ({
  page,
}) => {
  const gate = replyGate();
  const seen = await mockHeld(page, gate);
  await page.clock.setFixedTime(new Date(NOW));
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect((await page.goto("/mfa-setup"))?.status()).toBe(200);
  await expect(page.locator(`${SEC} .k-sec-summary`)).toBeVisible();
  await page
    .locator(`${SEC} .k-set-row`, { hasText: "認証アプリ" })
    .first()
    .getByRole("button", { name: "付ける", exact: true })
    .click();
  const check = page.getByRole("dialog", { name: "本人か確かめます" });
  await check.getByLabel("パスワード", { exact: true }).fill(PW);
  await check.getByRole("button", { name: "確かめる" }).click();
  const totp = page.getByRole("dialog", { name: "2 段階認証を付ける" });
  await expect(totp.getByRole("img", { name: "認証アプリで読み取る QR" })).toBeVisible();
  await page.getByLabel("確認のコード 1 けた目").click();
  await page.keyboard.type("123456");
  await expect.poll(() => seen.confirms.length).toBe(1);
  await page.keyboard.press("Enter"); // 6 けたの枠の Enter は何もしない（code-boxes.tsx は Backspace だけを見る）
  // 2 回目を本当に送る道：6 けた目を打ち替えると 6 つそろい直し、画面は確かめを送ろうとする（答えを待つ間の守りが無ければ 2 回目が届く）
  await page.keyboard.type("7");
  await expect(page.getByLabel("確認のコード 6 けた目")).toHaveValue("7");
  // 門を閉じている間：答えを待つ形のまま
  await expect(totp.getByRole("button", { name: "確かめる" })).toHaveAttribute("aria-busy", "true");
  const backup = page.getByRole("dialog", { name: "バックアップコード" });
  await expect(backup).toHaveCount(0);
  expect(seen.confirms).toEqual([{ code: "123456" }]);
  gate.open();
  await expect(backup).toHaveCount(1);
  await expect(backup.locator(".k-backup-code")).toHaveCount(10);
  expect(seen.confirms).toEqual([{ code: "123456" }]);
});
