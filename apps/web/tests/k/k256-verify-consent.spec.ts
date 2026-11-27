// K-256「確認のリンクを開いた後・規約の同意の細部をキャンバスに合わせる」の画面の試験（実装より先に積む）。
//   正のモック：K-219 が起こした AuthVerifying・AuthVerifyExpired・AuthVerifyUsed・AuthConsent（正）。入口の枠は K-255（k255-signup-waiting.spec.ts）の行が見る。
//   口（/api/v1/auth/sign-up/verify・/terms/current・/terms/consent・/me）は網の手前で差し替える。本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。
//   足元に増えるリンクの操作要素の表の行（K52-UI-020〜022・K53-UI-027）は、前からの試験 verify-email.spec.ts・terms.spec.ts に足した（このチケットの carry）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import {
  compareFonts,
  compareRows,
  loadedFonts,
  mismatches,
  readVals,
  type FidelityPair,
} from "../../../../scripts/ci/fidelity_compare.mjs";
import { FIDELITY_STATES, routeCanvasFonts } from "../_lib/fidelity-states";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const BOX = '[data-part="auth-box"]';
const PRIMARY = "rgb(34, 52, 92)";
const LINE = "rgb(221, 226, 233)";
const LINE_SOFT = "rgb(237, 240, 244)";
const MUTED = "rgb(74, 85, 99)";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const LINK_TOKEN = "k222_link_0123456789abcdefghijklmnopqrstuv";
const SESSION = "session-k222";
const at = new Date(Date.now() - 60_000).toISOString();
const V = [
  {
    id: "00000000-0000-4000-8000-000000000221",
    kind: "terms",
    version: "第2版",
    url: "/legal/terms?v=2",
    published_at: at,
  },
  {
    id: "00000000-0000-4000-8000-000000000222",
    kind: "privacy",
    version: "第2版",
    url: "/legal/privacy?v=2",
    published_at: at,
  },
];

type Reply = { status: number; body: unknown };
type Verify = "hold" | "expired" | "used";
const never = () => new Promise<never>(() => undefined);

async function mockApi(page: Page, verify: Verify = "hold") {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    let r: Reply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
    if (req.method() === "POST" && p === "/api/v1/auth/sign-up/verify") {
      if (verify === "hold") return never();
      r =
        verify === "expired"
          ? { status: 410, body: { code: "E-AUTH-003", message: "リンクの期限が切れました。もう一度登録してください" } }
          : {
              status: 409,
              body: {
                code: "E-CONF-011",
                message: "このメールアドレスの登録は確認まで終わっています。ログインしてください",
              },
            };
    } else if (req.method() === "GET" && p === "/api/v1/auth/terms/current") r = { status: 200, body: { data: V } };
    else if (req.method() === "GET" && /\/me$/.test(p))
      r = { status: 200, body: { data: { id: "u1", email: "takamoto@example.com", name: "高本" } } };
    else if (req.method() === "POST" && p === "/api/v1/auth/terms/consent")
      r = { status: 201, body: { data: { consented: true } } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
}
async function openLink(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/verify-email?token=${encodeURIComponent(LINK_TOKEN)}`);
  await expect(page.locator(`${BOX} h1`)).toBeVisible();
}
async function openConsent(page: Page, width = 1440) {
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), SESSION);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`/login?step=terms&next=${encodeURIComponent("/legal/terms")}`);
  await expect(page.getByRole("checkbox", { name: "利用規約とプライバシーポリシーに同意します" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const css = (page: Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
const h1 = (page: Page) => page.locator(`${BOX} h1`);
/** 時計を止める（実時間で進まない）。部品の時計は止めた時刻から runFor で進めた分だけ進む */
async function freeze(page: Page) {
  await page.clock.install({ time: new Date("2026-11-16T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-16T00:00:01Z"));
}
test("K256-UI-001 確定中（D-144.8）：見出し「確認しています」はすぐ出て、回る印と「登録を確定しています…」は 2.9 秒では出ず 3 秒を過ぎて出る（空の箱にしない・言うことは見出しと文の 2 つだけ）", async ({
  page,
}) => {
  await mockApi(page, "hold");
  await freeze(page);
  const asked = page.waitForRequest((r) => new URL(r.url()).pathname === "/api/v1/auth/sign-up/verify");
  await openLink(page);
  await asked;
  await expect(h1(page)).toHaveText("確認しています");
  await page.clock.runFor(2900);
  await expect(page.getByText("登録を確定しています")).toHaveCount(0);
  await page.clock.runFor(200);
  const status = page.locator(BOX).getByRole("status");
  await expect(status).toHaveText("登録を確定しています…");
  await expect(status.locator(".k-spin")).toHaveCount(1);
  expect(await status.evaluate((e) => getComputedStyle(e).fontSize)).toBe("13px");
  expect(await status.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
  expect(Math.round((await status.locator(".k-spin").boundingBox())!.width)).toBe(16);
  const texts = (await page.locator(BOX).innerText()).split("\n").filter((x) => x.trim());
  expect(texts).toEqual(["確認しています", "登録を確定しています…"]);
});

test("K256-UI-002 期限切れ：44px の札（橙・角丸 8・真ん中）・見出し 18px 真ん中・淡い橙の箱（#FFF8EE・線 #F3D3A7・12px・#7A4A05）・主「もう一度登録する」（44・紺）で /signup へ", async ({
  page,
}) => {
  await mockApi(page, "expired");
  await openLink(page);
  await expect(h1(page)).toHaveText("リンクの期限が切れました");
  expect(await css(page, `${BOX} h1`, "font-size")).toBe("18px");
  expect(await css(page, `${BOX} h1`, "text-align")).toBe("center");
  const badge = page.locator(`${BOX} .k-auth-badge`);
  expect(Math.round((await badge.boundingBox())!.width)).toBe(44);
  expect(await badge.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(180, 83, 9)");
  const warn = page.locator(BOX).getByText("リンクの期限が切れました。もう一度登録してください", { exact: true });
  const tone = warn.locator("xpath=ancestor-or-self::*[contains(@class,'k-callout')][1]");
  expect(await tone.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(255, 248, 238)");
  expect(await tone.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe("rgb(243, 211, 167)");
  expect(await tone.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  expect(await tone.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(122, 74, 5)");
  expect(await tone.evaluate((e) => getComputedStyle(e).paddingTop)).toBe("8px");
  expect(await tone.evaluate((e) => getComputedStyle(e).paddingLeft)).toBe("10px");
  expect(Math.abs(parseFloat(await tone.evaluate((e) => getComputedStyle(e).lineHeight)) - 20.4)).toBeLessThan(0.5);
  expect(await badge.evaluate((e) => getComputedStyle(e).fontSize)).toBe("18px");
  const again = page.locator(BOX).getByRole("link", { name: "もう一度登録する" });
  expect(Math.round((await again.boundingBox())!.height)).toBe(44);
  expect(await again.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PRIMARY);
  await again.click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("K256-UI-003 登録は終わっている（E-CONF-011）：✓ の札（緑 #166534）・灰の箱（#F7F8FA・12px・#4A5563）・主「ログイン」（44・紺）で /login へ", async ({
  page,
}) => {
  await mockApi(page, "used");
  await openLink(page);
  await expect(h1(page)).toHaveText("登録は終わっています");
  const badge = page.locator(`${BOX} .k-auth-badge`);
  await expect(badge).toHaveText("✓");
  expect(await badge.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(22, 101, 52)");
  const note = page.locator(BOX).getByText(/確認まで終わっています/);
  const tone = note.locator("xpath=ancestor-or-self::*[contains(@class,'k-callout')][1]");
  expect(await tone.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(247, 248, 250)");
  expect(await tone.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  expect(await tone.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
  expect(await tone.evaluate((e) => getComputedStyle(e).borderTopWidth), "灰の箱は線なし").toBe("0px");
  expect(await tone.evaluate((e) => getComputedStyle(e).paddingTop)).toBe("8px");
  const login = page.locator(BOX).getByRole("link", { name: "ログイン", exact: true });
  expect(Math.round((await login.boundingBox())!.height)).toBe(44);
  expect(await login.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PRIMARY);
  await login.click();
  await expect(page).toHaveURL(/\/login$/);
});

test("K256-UI-005 同意の形：見出し 18px 真ん中・説明 13px 真ん中・版の一覧は線 1px #DDE2E9・角丸 8 の箱で、行の間に線 #EDF0F4・版の字は 12px・灰", async ({
  page,
}) => {
  await mockApi(page);
  await openConsent(page);
  await expect(h1(page)).toHaveText("利用規約とプライバシーポリシーが新しくなりました");
  expect(await css(page, `${BOX} h1`, "font-size")).toBe("18px");
  expect(await css(page, `${BOX} .k-auth-lead`, "font-size")).toBe("13px");
  expect(await css(page, `${BOX} .k-auth-lead`, "text-align")).toBe("center");
  const list = page.locator(`${BOX} .k-terms-list`);
  expect(await list.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(LINE);
  expect(await list.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("8px");
  const rows = list.locator("li");
  await expect(rows).toHaveCount(2);
  expect(await rows.nth(0).evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("0px");
  expect(await rows.nth(1).evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(LINE_SOFT);
  expect(await rows.nth(1).evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("1px");
  expect(await css(page, `${BOX} .k-terms-version`, "font-size")).toBe("12px");
  expect(await css(page, `${BOX} .k-terms-version`, "color")).toBe(MUTED);
});

test("K256-UI-006 同意のチェック：label（13px）がチェックを包み、間は gap 8px とチェックの既定の右の余白で、見える間は 11px（±1・キャンバスと同じ）。字を押すとチェックが入り、外れる", async ({
  page,
}) => {
  await mockApi(page);
  await openConsent(page);
  const box = page.getByRole("checkbox", { name: "利用規約とプライバシーポリシーに同意します" });
  const label = page.locator(`${BOX} label`, { hasText: "利用規約とプライバシーポリシーに同意します" });
  expect(await label.evaluate((e) => getComputedStyle(e).fontSize)).toBe("13px");
  expect(await label.evaluate((e) => getComputedStyle(e).columnGap)).toBe("8px");
  expect(await label.evaluate((e) => e.contains(e.querySelector('input[type="checkbox"]')))).toBe(true);
  const b = (await box.boundingBox())!;
  const t = await label.evaluate((e) => {
    const r = document.createRange();
    // 字は label の中の最初の見えている字（K-642 の部品では字の span の中・直の子とは限らない）
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    let text = walker.nextNode();
    while (text && !text.textContent?.trim()) text = walker.nextNode();
    r.selectNodeContents(text!);
    return r.getBoundingClientRect().left;
  });
  expect(Math.abs(t - (b.x + b.width) - 11), `見える間 ${t - (b.x + b.width)}`).toBeLessThanOrEqual(1);
  await label.click();
  await expect(box).toBeChecked();
  await label.click();
  await expect(box).not.toBeChecked();
});

test("K256-UI-007 同意のボタン：主「同意して続ける」は高さ 44・紺。「ログアウト」は地なし・13px・灰（#4A5563）・高さ 36", async ({
  page,
}) => {
  await mockApi(page);
  await openConsent(page);
  const go = page.getByRole("button", { name: "同意して続ける" });
  expect(Math.round((await go.boundingBox())!.height)).toBe(44);
  expect(await go.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PRIMARY);
  const out = page.getByRole("button", { name: "ログアウト" });
  expect(Math.round((await out.boundingBox())!.height)).toBe(36);
  expect(await out.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  expect(await out.evaluate((e) => getComputedStyle(e).fontSize)).toBe("13px");
  expect(await out.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
});

const footLinks = async (page: Page) =>
  (await page.getByRole("navigation", { name: "Kaname について" }).getByRole("link").allInnerTexts()).map((x) =>
    x.trim(),
  );

test("K256-UI-004 期限切れの足元：いまの様子・困ったとき の順。いまの様子は /help#status へ（href・aria-disabled なし・押すと /help#status）", async ({
  page,
}) => {
  await mockApi(page, "expired");
  await openLink(page);
  await expect(h1(page)).toHaveText("リンクの期限が切れました");
  expect(await footLinks(page)).toEqual(["いまの様子", "困ったとき"]);
  const status = page.getByRole("navigation", { name: "Kaname について" }).getByRole("link", { name: "いまの様子" });
  await expect(status).toHaveAttribute("href", "/help#status");
  expect(await status.getAttribute("aria-disabled")).toBeNull();
  const foot = page.getByRole("navigation", { name: "Kaname について" });
  expect((await foot.innerText()).replace(/\s+/g, " ").trim()).toBe("いまの様子 ・ 困ったとき");
  await status.click();
  await expect(page).toHaveURL(/\/help#status$/);
});

test("K256-UI-008 同意の足元：利用規約・プライバシー・困ったとき の 3 つ（「困ったとき」だけにしない）", async ({
  page,
}) => {
  await mockApi(page);
  await openConsent(page);
  expect(await footLinks(page)).toEqual(["利用規約", "プライバシー", "困ったとき"]);
});

test("K256-UI-012 確定中・登録は終わっているの足元：利用規約・プライバシー・困ったとき の 3 つ", async ({ page }) => {
  await mockApi(page, "hold");
  await openLink(page);
  await expect(h1(page)).toHaveText("確認しています");
  expect(await footLinks(page)).toEqual(["利用規約", "プライバシー", "困ったとき"]);
  const used = await page.context().newPage();
  await mockApi(used, "used");
  await openLink(used);
  await expect(h1(used)).toHaveText("登録は終わっています");
  expect(await footLinks(used)).toEqual(["利用規約", "プライバシー", "困ったとき"]);
  await used.close();
});

interface Group {
  id: string;
  canvas: string;
  app: string;
  state: string;
  widths: number[];
  pairs: FidelityPair[];
  owner: string;
  enrolled: boolean;
}
const CFG = JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: Group[] };
const MINE = ["verify-confirming", "verify-expired", "verify-used", "consent-terms"];

test("K256-UI-009 突き合わせの設定：verify-confirming・verify-expired・verify-used・consent-terms が enrolled・持ち主 K-256・主ボタンの画面の側は主の 1 つだけに当たる形（:is(a, button) で全部に当てない）・鍵が在る", () => {
  for (const id of MINE) {
    const g = CFG.groups.find((x) => x.id === id);
    expect(g, id).toBeTruthy();
    expect(g!.enrolled, id).toBe(true);
    expect(g!.owner, id).toBe("K-256");
    expect(FIDELITY_STATES[g!.state], id).toBeTruthy();
    const primary = g!.pairs.find((p) => p.role === "primary");
    if (primary) expect(primary.app, `${id} の主ボタン`).not.toMatch(/:is\(a, button\)/);
  }
});

for (const id of MINE) {
  const G = CFG.groups.find((x) => x.id === id);
  for (const w of G?.widths ?? [1440]) {
    test(`K256-UI-010 ${id}（${G?.canvas}）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({ browser }) => {
      expect(G).toBeTruthy();
      const canvasPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await routeCanvasFonts(canvasPage);
      await canvasPage.goto(pathToFileURL(join(ROOT, `04_design/canvas/${G!.canvas}.dc.html`)).href);
      for (const p of G!.pairs) await canvasPage.locator(p.canvas).first().waitFor({ state: "visible" });
      await canvasPage.evaluate(() => document.fonts.ready);
      const canvasVals = await readVals(canvasPage, G!.pairs, "canvas");
      const canvasFonts = await loadedFonts(canvasPage);
      await canvasPage.close();

      const appPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await appPage.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
      await FIDELITY_STATES[G!.state]!(appPage, G!.app);
      for (const p of G!.pairs) await appPage.locator(p.app).first().waitFor({ state: "visible" });
      await appPage.evaluate(() => document.fonts.ready);
      const appVals = await readVals(appPage, G!.pairs, "app");
      const appFonts = await loadedFonts(appPage);
      await appPage.close();

      const rows = [...compareRows(G!.pairs, canvasVals, appVals), compareFonts(canvasFonts, appFonts)];
      const bad = rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 画面 ${r.app}`);
      expect(mismatches(rows), bad.join("\n")).toBe(0);
    });
  }
}

test("K256-UI-011 幅 320・375・768・1024・1440（期限切れ・同意）：横溢れ 0・見出しの 1 文字目が画面の中", async ({
  page,
}) => {
  const bad: string[] = [];
  await mockApi(page, "expired");
  const measure = async (which: string, w: number) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o !== 0) bad.push(`${which} 幅 ${w}：横溢れ ${o}px`);
    const left = await h1(page).evaluate((e) => {
      const r = document.createRange();
      r.setStart(e.firstChild!, 0);
      r.setEnd(e.firstChild!, 1);
      return r.getBoundingClientRect().left;
    });
    if (left < 0) bad.push(`${which} 幅 ${w}：見出しの 1 文字目が左に切れる`);
  };
  for (const w of WIDTHS) {
    await openLink(page, w);
    await expect(h1(page)).toHaveText("リンクの期限が切れました");
    await measure("期限切れ", w);
  }
  for (const w of WIDTHS) {
    await openConsent(page, w);
    await measure("同意", w);
  }
  expect(bad).toEqual([]);
});

test('K256-UI-013 /verify-email を手がかり無しで開く：開いた最初の HTML の時点で入口の箱（[data-part="auth-box"]）が在り、手がかりを読む間も消えない（真っ白にしない・#18）', async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __k256Blank: number; __k256Seen: boolean; __k256AtDom: boolean | null };
    w.__k256Blank = 0;
    w.__k256Seen = false;
    w.__k256AtDom = null;
    // 開いた最初の HTML（画面の JS が動く前）に箱が在るか。手元の next dev でも本番の形でも同じに見る
    document.addEventListener("DOMContentLoaded", () => {
      w.__k256AtDom = document.querySelector('[data-part="auth-box"]') !== null;
    });
    new MutationObserver(() => {
      const has = document.querySelector('[data-part="auth-box"]') !== null;
      if (has) w.__k256Seen = true;
      else if (w.__k256Seen) w.__k256Blank += 1;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/verify-email");
  await expect(h1(page)).toBeVisible();
  await expect(page.locator(BOX)).toHaveCount(1);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __k256Blank: number; __k256Seen: boolean; __k256AtDom: boolean | null };
    return { blank: w.__k256Blank, seen: w.__k256Seen, atDom: w.__k256AtDom };
  });
  expect(r.atDom, "開いた最初の HTML に入口の箱").toBe(true);
  expect(r.seen).toBe(true);
  expect(r.blank, "箱が消えた回数").toBe(0);
});
