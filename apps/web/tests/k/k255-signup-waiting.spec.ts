// K-255「入口の共通の枠・登録・確認のメールを送った（待つ）をキャンバスに合わせる」の画面の試験（実装より先に積む）。
//   正のモック：04_design/canvas/AuthSignup.dc.html・AuthVerify.dc.html と、絵の無かった状態を起こした AuthChecking・AuthVerifyLoading（K-219・正）。
//   入口の枠（features/F1/sign-up/frame.tsx の AuthFrame）の箱に data-part="auth-box" を付け、余白 26px 28px・段の間 14px・ロゴと箱の間 18px・外の余白 32px 16px にする。
//   ボタンと入力欄と項目名は k の部品の入口の大きさ（size lg・K-218）。口（/api/v1/auth/sign-up・/status・/resend・/me）は網の手前で差し替える。
//   本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。確認のリンク・同意の画面は K-256（k256-verify-consent.spec.ts）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import {
  capture,
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
const WHITE = "rgb(255, 255, 255)";
const LINE = "rgb(221, 226, 233)";
const LINE_SOFT = "rgb(237, 240, 244)";
const INK = "rgb(19, 27, 39)";
const MUTED = "rgb(74, 85, 99)";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const EMAIL = "takamoto@example.com";
const TOKEN = "st_k222_0123456789abcdefghijklmnopqrstuvwxyz";

type Reply = { status: number; body: unknown };
interface Mock {
  creates: Record<string, unknown>[];
  resends: (string | null)[];
  hold: { me: boolean; status: boolean };
}
const never = () => new Promise<never>(() => undefined);

async function mockApi(page: Page): Promise<Mock> {
  const m: Mock = { creates: [], resends: [], hold: { me: false, status: false } };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    let r: Reply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
    if (req.method() === "POST" && p === "/api/v1/auth/sign-up") {
      m.creates.push((req.postDataJSON() as Record<string, unknown>) ?? {});
      r = {
        status: 201,
        body: {
          data: {
            email: EMAIL,
            sent: true,
            mail_error: null,
            expires_at: new Date(Date.now() + 1_800_000).toISOString(),
            signup_token: TOKEN,
          },
        },
      };
    } else if (req.method() === "GET" && p === "/api/v1/auth/sign-up/status") {
      if (m.hold.status) return never();
      r = { status: 200, body: { data: { state: "pending", email: EMAIL } } };
    } else if (req.method() === "POST" && p === "/api/v1/auth/sign-up/resend") {
      m.resends.push(req.headers()["x-signup-token"] ?? null);
      r = { status: 201, body: { data: { email: EMAIL, sent: true, mail_error: null, pending: true } } };
    } else if (req.method() === "GET" && /\/me$/.test(p) && m.hold.me) return never();
    else if (p === "/api/v1/auth/terms/current") r = { status: 200, body: { data: [] } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}
async function openSignup(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto("/signup");
  expect(res?.status()).toBe(200);
  await expect(page.getByLabel("名前", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
/** 申し込みの印をこのタブに置いて待つ画面を開く（登録の答えで受け取った物と同じ形・features/F1/sign-up/store.ts） */
async function openWaiting(page: Page, width = 1440, wait = true) {
  await page.addInitScript(
    ([t, e]) =>
      window.sessionStorage.setItem(
        "kaname.signup",
        JSON.stringify({ token: t, email: e, sent: true, mailError: null }),
      ),
    [TOKEN, EMAIL] as const,
  );
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/verify-email");
  if (wait) await expect(page.getByRole("button", { name: "送り直す" })).toBeVisible();
}
const css = (page: Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
const rect = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
/** 時計を止める（実時間で進まない）。部品の時計は止めた時刻から runFor で進めた分だけ進む */
async function freeze(page: Page) {
  await page.clock.install({ time: new Date("2026-11-16T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-16T00:00:01Z"));
}

test("K255-UI-001 入口の枠の箱（幅 1440・登録）：幅 440・真ん中・余白 26px 28px・段の間 14px・白・線 #DDE2E9・角丸 12", async ({
  page,
}) => {
  await mockApi(page);
  await openSignup(page);
  const b = await rect(page, BOX);
  expect(Math.round(b.width)).toBe(440);
  expect(Math.abs(b.x + b.width / 2 - 720)).toBeLessThanOrEqual(2);
  expect(await css(page, BOX, "padding-top")).toBe("26px");
  expect(await css(page, BOX, "padding-left")).toBe("28px");
  expect(await css(page, BOX, "row-gap")).toBe("14px");
  expect(await css(page, BOX, "background-color")).toBe(WHITE);
  expect(await css(page, BOX, "border-top-color")).toBe(LINE);
  expect(await css(page, BOX, "border-top-left-radius")).toBe("12px");
  await expect(page.locator(BOX)).toHaveCount(1);
});

test("K255-UI-002 ロゴと箱の間は 18px（±2）・外の余白は上 32px・左右 16px・足元は 11px・間 12px", async ({ page }) => {
  await mockApi(page);
  await openSignup(page);
  const logo = await rect(page, ".k-auth-logo");
  const b = await rect(page, BOX);
  expect(Math.abs(b.y - (logo.y + logo.height) - 18)).toBeLessThanOrEqual(2);
  expect(await css(page, ".k-auth", "padding-left")).toBe("16px");
  expect(await css(page, ".k-auth", "padding-top")).toBe("32px");
  const foot = page.getByRole("navigation", { name: "Kaname について" });
  expect(await foot.evaluate((e) => getComputedStyle(e).fontSize)).toBe("11px");
  expect(await foot.evaluate((e) => getComputedStyle(e).columnGap)).toBe("12px");
});

test("K255-UI-003 主「次へ（メールを確かめる）」：入口の大きさ（高さ 44・角丸 8・14px・500・紺）で箱の幅いっぱい", async ({
  page,
}) => {
  await mockApi(page);
  await openSignup(page);
  const btn = page.getByRole("button", { name: "次へ（メールを確かめる）" });
  await expect(btn).toHaveAttribute("data-size", "lg");
  expect(Math.round((await btn.boundingBox())!.height)).toBe(44);
  expect(await btn.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("8px");
  expect(await btn.evaluate((e) => getComputedStyle(e).fontSize)).toBe("14px");
  expect(await btn.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("500");
  expect(await btn.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PRIMARY);
  const b = await rect(page, BOX);
  expect(Math.round((await btn.boundingBox())!.width)).toBe(Math.round(b.width - 56 - 2)); // 箱の幅は線 1px ずつを含む
});

test("K255-UI-004 入力欄：白地・線 1px #DDE2E9・角丸 8・高さ 42。字は幅 1440・768 で 14px、幅 767・375 で 16px（D-144.7 の境）", async ({
  page,
}) => {
  await mockApi(page);
  for (const [w, size] of [
    [1440, "14px"],
    [768, "14px"],
    [767, "16px"],
    [375, "16px"],
  ] as const) {
    await openSignup(page, w);
    for (const l of ["メール", "名前", "会社・チームの名前", "パスワード"]) {
      const f = field(page, l);
      expect(await f.evaluate((e) => getComputedStyle(e).backgroundColor), l).toBe(WHITE);
      expect(await f.evaluate((e) => getComputedStyle(e).borderTopColor), l).toBe(LINE);
      expect(await f.evaluate((e) => getComputedStyle(e).borderTopWidth), l).toBe("1px");
      expect(await f.evaluate((e) => getComputedStyle(e).borderTopLeftRadius), l).toBe("8px");
      expect(Math.round((await f.boundingBox())!.height), l).toBe(42);
      expect(await f.evaluate((e) => getComputedStyle(e).fontSize), `${l} 幅 ${w}`).toBe(size);
    }
  }
});

test("K255-UI-005 項目名：12px・500・#131B27。項目名の下の端と欄の上の端の間は 6px（±1）", async ({ page }) => {
  await mockApi(page);
  await openSignup(page);
  const label = page.locator(`${BOX} .k-label`, { hasText: "名前" }).first();
  expect(await label.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  expect(await label.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("500");
  expect(await label.evaluate((e) => getComputedStyle(e).color)).toBe(INK);
  const l = (await label.boundingBox())!;
  const f = (await field(page, "名前").boundingBox())!;
  expect(Math.abs(f.y - (l.y + l.height) - 6)).toBeLessThanOrEqual(1);
});

test("K255-UI-006 補足：会社・チームの名前とパスワードの補足は項目名に続く括弧書き（400・灰）。1 行目は項目名と同じ行で項目名より右から、折れた行は箱の左から（キャンバスどおり）。欄の下の別の行に出ない・読み上げの名前は項目名のまま", async ({
  page,
}) => {
  await mockApi(page);
  await openSignup(page);
  for (const [l, hint] of [
    ["会社・チームの名前", "（空なら、あなたの名前で個人のワークスペースになる。あとで人を招ける）"],
    ["パスワード", "（12 文字以上。漏れたことのあるパスワードは使えない）"],
  ] as const) {
    const h = page.locator(BOX).getByText(hint, { exact: true });
    await expect(h, l).toBeVisible();
    expect(await h.evaluate((e) => getComputedStyle(e).fontWeight), l).toBe("400");
    expect(await h.evaluate((e) => getComputedStyle(e).color), l).toBe(MUTED);
    const hb = (await h.boundingBox())!;
    const f = (await field(page, l).boundingBox())!;
    expect(hb.y + hb.height, `${l} の補足は欄より上`).toBeLessThanOrEqual(f.y + 1);
    const lb = (await page.locator(`${BOX} .k-label`, { hasText: l }).first().boundingBox())!;
    // 補足の字の行ごとの箱（折れた行は 1 行ずつ別の箱）
    const lines = await h.evaluate((e) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      // 縦に重なる箱は同じ行にまとめる（上の端の丸めに頼らない）
      const rows: { left: number; top: number; bottom: number; right: number }[] = [];
      for (const b of r.getClientRects()) {
        if (b.width === 0) continue;
        const row = rows.find((x) => b.top < x.bottom && b.bottom > x.top);
        if (row) {
          row.left = Math.min(row.left, b.left);
          row.right = Math.max(row.right, b.right);
        } else rows.push({ left: b.left, top: b.top, bottom: b.bottom, right: b.right });
      }
      return rows.sort((x, y) => x.top - y.top);
    });
    const box = await rect(page, BOX);
    for (const ln of lines)
      expect(ln.right, `${l} の補足は箱の中身の右からはみ出さない`).toBeLessThanOrEqual(box.x + box.width - 28 + 1);
    if (l === "会社・チームの名前")
      expect(lines.length, `${l} の補足は幅 1440 で折れる（キャンバスも 2 行）`).toBeGreaterThanOrEqual(2);
    expect(lines.length, `${l} の補足の行`).toBeGreaterThanOrEqual(1);
    expect(Math.abs(lines[0]!.top - lb.y), `${l} の補足の 1 行目は項目名と同じ行（上の端が ±2）`).toBeLessThanOrEqual(
      2,
    );
    expect(lines[0]!.left, `${l} の補足の 1 行目は項目名の右から`).toBeGreaterThanOrEqual(lb.x + lb.width);
    for (const [i, ln] of lines.slice(1).entries())
      expect(Math.abs(ln.left - lb.x), `${l} の補足の ${i + 2} 行目は箱の左（項目名の左の端）から`).toBeLessThanOrEqual(
        2,
      );
    await expect(field(page, l), l).toHaveCount(1); // exact の項目名で 1 つ当たる（補足が名前に混ざらない）
    const described = (await field(page, l).getAttribute("aria-describedby")) ?? "";
    const texts = await Promise.all(
      described
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => page.locator(`[id="${id}"]`).innerText()),
    );
    expect(texts.join(" "), `${l} の補足は説明として読み上げる`).toContain(hint.slice(1, 8));
  }
});

test("K255-UI-007 見出しと説明の間は 8px（段の間 14 から −6）。説明は 12px・灰・真ん中", async ({ page }) => {
  await mockApi(page);
  await openSignup(page);
  const h = await rect(page, `${BOX} h1`);
  const lead = page.locator(`${BOX} .k-auth-lead`).first();
  const l = (await lead.boundingBox())!;
  expect(Math.abs(l.y - (h.y + h.height) - 8)).toBeLessThanOrEqual(1);
  expect(await lead.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  expect(await lead.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
  expect(await lead.evaluate((e) => getComputedStyle(e).textAlign)).toBe("center");
});

test("K255-UI-008 「アカウントがある方は ログイン」の行：上に線 1px #EDF0F4・線と字の間 12px", async ({ page }) => {
  await mockApi(page);
  await openSignup(page);
  const alt = page.locator(`${BOX} .k-auth-alt`);
  await expect(alt).toHaveText(/アカウントがある方は\s*ログイン/);
  expect(await alt.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(LINE_SOFT);
  expect(await alt.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("1px");
  expect(await alt.evaluate((e) => getComputedStyle(e).paddingTop)).toBe("12px");
});

test("K255-UI-009 ログイン中か確かめている間（D-144.8）：枠と見出し「アカウントを作る」がすぐ出る。欄は出ず、「確かめています…」は 2.9 秒では出ず 3 秒を過ぎて出る", async ({
  page,
}) => {
  const m = await mockApi(page);
  m.hold.me = true;
  await freeze(page);
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "tok-k222"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const asked = page.waitForRequest((r) => /\/me$/.test(new URL(r.url()).pathname)); // 部品が動き出した印
  await page.goto("/signup");
  await asked;
  await expect(page.locator(`${BOX} h1`)).toHaveText("アカウントを作る");
  await expect(field(page, "名前")).toHaveCount(0);
  await page.clock.runFor(2900);
  await expect(page.getByText("確かめています")).toHaveCount(0);
  await page.clock.runFor(200);
  const st = page.locator(BOX).getByRole("status");
  await expect(st).toContainText("確かめています…");
  expect(await st.evaluate((e) => getComputedStyle(e).fontSize)).toBe("13px");
  expect(await st.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
  expect(Math.round((await st.locator(".k-spin").boundingBox())!.width)).toBe(16);
});

test("K255-UI-010 空のまま「次へ」：ブラウザの吹き出しで止まらず（form は noValidate）、自前の理由が欄の下に出て、登録の口は呼ばない", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openSignup(page);
  expect(await page.locator(`${BOX} form`).evaluate((f) => (f as HTMLFormElement).noValidate)).toBe(true);
  await page.getByRole("button", { name: "次へ（メールを確かめる）" }).click();
  for (const l of ["メール", "名前", "パスワード"]) {
    await expect(field(page, l), l).toHaveAttribute("aria-invalid", "true");
    expect(await field(page, l).evaluate((e) => (e as HTMLInputElement).validationMessage), l).toBe("");
  }
  await expect(page.locator(`${BOX} .k-err`).first()).toBeVisible();
  expect(m.creates).toHaveLength(0);
});

test("K255-UI-011 幅 375：箱は左右 16px 内側（幅 343）で、余白は 26px 28px のまま", async ({ page }) => {
  await mockApi(page);
  await openSignup(page, 375);
  const b = await rect(page, BOX);
  expect(Math.round(b.x)).toBe(16);
  expect(Math.round(b.width)).toBe(343);
  expect(await css(page, BOX, "padding-left")).toBe("28px");
});

test("K255-UI-012 待つ：箱の最初に「← 戻る」（12px）。押すと登録の画面（/signup）", async ({ page }) => {
  await mockApi(page);
  await openWaiting(page);
  const back = page.locator(BOX).getByRole("link", { name: "← 戻る" });
  await expect(back).toBeVisible();
  expect(await back.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  const first = await page
    .locator(`${BOX} > *`)
    .first()
    .evaluate((e) => e.textContent?.trim());
  expect(first).toBe("← 戻る");
  await back.click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("K255-UI-013 待つ：見出しの上に ✉ の札（44×44・紺・角丸 8・真ん中）", async ({ page }) => {
  await mockApi(page);
  await openWaiting(page);
  const badge = page.locator(`${BOX} .k-auth-badge`);
  await expect(badge).toHaveText("✉");
  const r = (await badge.boundingBox())!;
  expect(Math.round(r.width)).toBe(44);
  expect(Math.round(r.height)).toBe(44);
  expect(await badge.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PRIMARY);
  expect(await badge.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("8px");
  expect(await badge.evaluate((e) => getComputedStyle(e).fontSize)).toBe("18px");
  expect(await badge.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("700");
  expect(await badge.evaluate((e) => getComputedStyle(e).color)).toBe(WHITE);
  const b = await rect(page, BOX);
  expect(Math.abs(r.x + r.width / 2 - (b.x + b.width / 2))).toBeLessThanOrEqual(2);
  const h = await rect(page, `${BOX} h1`);
  expect(r.y + r.height).toBeLessThanOrEqual(h.y);
});

test("K255-UI-014 待つ：説明は 13px・行の高さ 1.7（22.1px）。メールアドレスは太字で #131B27", async ({ page }) => {
  await mockApi(page);
  await openWaiting(page);
  const lead = page.locator(`${BOX} .k-auth-lead`).first();
  expect(await lead.evaluate((e) => getComputedStyle(e).fontSize)).toBe("13px");
  expect(parseFloat(await lead.evaluate((e) => getComputedStyle(e).lineHeight))).toBeCloseTo(22.1, 0);
  const mail = page.locator(`${BOX} .k-auth-mail`);
  await expect(mail).toHaveText(EMAIL);
  expect(await mail.evaluate((e) => getComputedStyle(e).color)).toBe(INK);
  expect(await mail.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("700");
});

test("K255-UI-015 待つ：「送り直す」は灰の線（1px #DDE2E9）・白地・黒字・高さ 44。押すと申し込みの印つきで送り直しの口を 1 回呼び、「もう一度送りました」", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openWaiting(page);
  const btn = page.getByRole("button", { name: "送り直す" });
  expect(Math.round((await btn.boundingBox())!.height)).toBe(44);
  expect(await btn.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(WHITE);
  expect(await btn.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(LINE);
  expect(await btn.evaluate((e) => getComputedStyle(e).color)).toBe(INK);
  await btn.click();
  await expect(page.getByText("もう一度送りました")).toBeVisible();
  expect(m.resends).toEqual([TOKEN]);
});

test("K255-UI-016 待つの読み込み（D-144.8）：枠と見出し「確認メールを送りました」が先に出て、「読み込んでいます…」は 2.9 秒では出ず 3 秒を過ぎて出る（真っ白・空の箱にしない）", async ({
  page,
}) => {
  const m = await mockApi(page);
  m.hold.status = true;
  await freeze(page);
  const asked = page.waitForRequest((r) => new URL(r.url()).pathname === "/api/v1/auth/sign-up/status");
  await openWaiting(page, 1440, false);
  await asked;
  await expect(page.locator(`${BOX} h1`)).toHaveText("確認メールを送りました");
  await page.clock.runFor(2900);
  await expect(page.getByText("読み込んでいます")).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(page.locator(BOX).getByRole("status")).toContainText("読み込んでいます…");
  await expect(page.getByRole("button", { name: "送り直す" })).toHaveCount(0);
});

test("K255-UI-017 待つの注：「届かないときは…」は 11px・灰・真ん中で、「入力し直す」のリンクは無い（戻るは箱の頭）", async ({
  page,
}) => {
  await mockApi(page);
  await openWaiting(page);
  const note = page.locator(`${BOX} .k-auth-note`, { hasText: "届かないときは" });
  expect(await note.evaluate((e) => getComputedStyle(e).fontSize)).toBe("11px");
  expect(await note.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
  expect(await note.evaluate((e) => getComputedStyle(e).textAlign)).toBe("center");
  await expect(page.getByRole("link", { name: "入力し直す" })).toHaveCount(0);
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
const MINE = ["signup", "signup-waiting", "signup-checking", "signup-waiting-loading"];

test("K255-UI-018 突き合わせの設定：signup・signup-waiting・signup-checking・signup-waiting-loading が enrolled・持ち主 K-255・待つの主ボタンは「送り直す」だけに当たる・鍵が在る", () => {
  for (const id of MINE) {
    const g = CFG.groups.find((x) => x.id === id);
    expect(g, id).toBeTruthy();
    expect(g!.enrolled, id).toBe(true);
    expect(g!.owner, id).toBe("K-255");
    expect(FIDELITY_STATES[g!.state], id).toBeTruthy();
  }
  const waiting = CFG.groups.find((x) => x.id === "signup-waiting")!;
  const primary = waiting.pairs.find((p) => p.role === "primary")!;
  expect(primary.app, "戻る・ログインのリンクに当たらない形").not.toMatch(/:is\(a, button\)/);
});

for (const id of MINE) {
  const G = CFG.groups.find((x) => x.id === id);
  for (const w of G?.widths ?? [1440]) {
    test(`K255-UI-019 ${id}（${G?.canvas}）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({ browser }) => {
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

/** 道具の試験用の頁（data:） */
const dataPage = (html: string) =>
  `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><body>${html}</body>`)}`;
const vPair: FidelityPair = { name: ".v", role: "v", canvas: ".v", app: ".v", props: ["width"] };

test("K255-UI-021 突き合わせの道具：読み込み中の組の印（busy: true）があれば、aria-busy が残っていても状態の文（role=status）が出て値が揃えば読む", async ({
  page,
}) => {
  await page.goto(
    dataPage(`<main><div role="status" aria-busy="true"></div><div class="v" style="width:10px;height:10px"></div></main>
      <script>setTimeout(() => { document.querySelector('[role="status"]').textContent = "読み込んでいます…"; document.querySelector(".v").style.width = "50px"; }, 300);</script>`),
  );
  const { vals } = await capture(page, [vPair], "app", { busy: true, timeout: 5_000 });
  expect(vals[0]?.width).toBe("50px");
  // 文が出るのと同じ時に幅が 10px → 50px になる。50px なら文が出てから読んだ（文が出る前に読めば 10px）
});

test("K255-UI-022 突き合わせの道具：印のある組でも、状態の文が上限の時間までに出なければ「状態の文が出ない」を出して投げる（空の箱で比べない）", async ({
  page,
}) => {
  await page.goto(
    dataPage(
      `<main><div role="status" aria-busy="true"></div><div class="v" style="width:50px;height:10px"></div></main>`,
    ),
  );
  await expect(capture(page, [vPair], "app", { busy: true, timeout: 2_000 })).rejects.toThrow(/状態の文が出ない/);
});

test("K255-UI-023 突き合わせの道具：印の無い組は今までどおり aria-busy が消えるまで待ち、消えなければ「aria-busy」を出して投げる（文が出ていても読まない）", async ({
  page,
}) => {
  await page.goto(
    dataPage(
      `<main><div role="status" aria-busy="true">読み込んでいます…</div><div class="v" style="width:50px;height:10px"></div></main>`,
    ),
  );
  await expect(capture(page, [vPair], "app", { timeout: 2_000 })).rejects.toThrow(/aria-busy/);
});

test("K255-UI-024 突き合わせの設定：読み込み中の 2 組（signup-checking・signup-waiting-loading）は印 busy: true を持ち、ほかの K-255 の組は持たない。全体の突き合わせ（fidelity.spec.ts）は組の印を道具に渡す", () => {
  for (const id of MINE) {
    const g = CFG.groups.find((x) => x.id === id) as (Group & { busy?: boolean }) | undefined;
    expect(g?.busy === true, id).toBe(id === "signup-checking" || id === "signup-waiting-loading");
  }
  const spec = readFileSync(join(ROOT, "apps/web/tests/fidelity/fidelity.spec.ts"), "utf8");
  expect(spec, "画面の側の読み取りに組の印を渡す").toMatch(
    /capture\(appPage, g\.pairs, "app", \{[\s\S]{0,200}?busy: g\.busy/,
  );
});

test("K255-UI-020 幅 320・375・768・1024・1440（登録・待つ）：横溢れ 0・見出しの 1 文字目が画面の中", async ({
  page,
}) => {
  await mockApi(page);
  const bad: string[] = [];
  for (const w of WIDTHS) {
    for (const which of ["登録", "待つ"]) {
      if (which === "登録") await openSignup(page, w);
      else await openWaiting(page, w);
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (o !== 0) bad.push(`${which} 幅 ${w}：横溢れ ${o}px`);
      const left = await page.locator(`${BOX} h1`).evaluate((e) => {
        const r = document.createRange();
        r.setStart(e.firstChild!, 0);
        r.setEnd(e.firstChild!, 1);
        return r.getBoundingClientRect().left;
      });
      if (left < 0) bad.push(`${which} 幅 ${w}：見出しの 1 文字目が左に切れる`);
    }
  }
  expect(bad).toEqual([]);
});
