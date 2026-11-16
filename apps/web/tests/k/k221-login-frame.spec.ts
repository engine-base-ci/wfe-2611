// K-221「ログインを入口の新しい枠と部品へ（AuthLogin・Auth2FA）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：04_design/canvas/AuthLogin.dc.html・Auth2FA.dc.html。前の外の枠（OutsideLayout・左半分の紺の宣伝の面）と前の部品（components/ui）をやめ、
//   登録と同じ入口の枠（features/F1/sign-up/frame.tsx の AuthFrame・箱 [data-part="auth-box"]）と k の部品（size lg）に載せる。
//   口（/api/auth-ext/sign-in・/two-factor/verify）は網の手前で差し替える。本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。
//   画面の形（実装の役が作る）：
//     h1「ログイン」・主「パスキーで入る」（[data-act="passkey"]・使えない：グレー 0.55・押しても何も起きない）・その下の説明と「スマホで QR を読み取る」（使えない）・
//     区切り「またはメールとパスワード」・目に見える項目名の無い 2 つの欄（placeholder「メール」「パスワード」・読み上げの名前は「メールアドレス」「パスワード」）・
//     従「次へ」（submit・outlined）・「パスワードを忘れた｜端末をなくした（使えない）」・線の下に「はじめての方は アカウントを作る」
//     6 けた：h1「確認のコード」・6 つの枠（1 つめだけ autocomplete="one-time-code"）・6 つそろうと自動で進む・主「入る」・「認証アプリが使えない」でバックアップコードへ
//   期待は決める人の決まり（D-145.9：キャンバスに在る物は機能がまだでも出し、使えない物はグレーで押せない）と、PM の決め（30 日きかないのチェックは出さない・幅 375 の入力欄はキャンバスの側を直す）。
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
const WEB = join(HERE, "../..");
const BOX = '[data-part="auth-box"]';
const PRIMARY = "rgb(34, 52, 92)";
const WHITE = "rgb(255, 255, 255)";
const LINE = "rgb(221, 226, 233)";
const INK = "rgb(19, 27, 39)";
const MUTED = "rgb(74, 85, 99)";
const DISABLED_OPACITY = 0.55; // 本番の組み立てでは ".55" になることがあるので数で比べる
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const NEXT = "/legal/terms"; // 入った後の行き先（口を読まない画面にして、入ったことを道で見る）

type Reply = { status: number; body: unknown; delayMs?: number };
interface Mock {
  signIns: Record<string, unknown>[];
  verifies: Record<string, unknown>[];
  other: string[];
  on: { signIn: (b: Record<string, unknown>) => Reply; verify: (b: Record<string, unknown>) => Reply };
}
const fail = (status: number, code: string, message: string): Reply => ({ status, body: { code, message } });

async function mockAuth(page: Page, o: { twoFactor?: boolean } = {}): Promise<Mock> {
  const m: Mock = {
    signIns: [],
    verifies: [],
    other: [],
    on: {
      signIn: () => ({
        status: 200,
        body: {
          data: o.twoFactor
            ? { token: null, two_factor: true, two_factor_cookie: "tf-k221" }
            : { token: "tok-k221", two_factor: false, two_factor_cookie: null },
        },
      }),
      verify: () => ({ status: 200, body: { data: { token: "tok-k221" } } }),
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    let r: Reply = { status: 404, body: { code: "NOT_FOUND", message: "無い" } };
    if (p === "/api/auth-ext/sign-in") {
      const b = (req.postDataJSON() as Record<string, unknown>) ?? {};
      m.signIns.push(b);
      r = m.on.signIn(b);
    } else if (p === "/api/auth-ext/two-factor/verify") {
      const b = (req.postDataJSON() as Record<string, unknown>) ?? {};
      m.verifies.push(b);
      r = m.on.verify(b);
    } else if (p === "/api/auth/get-session") r = { status: 200, body: { session: null, user: null } };
    else m.other.push(`${req.method()} ${p}`);
    if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}
async function open(page: Page, width = 1440, q = `?next=${encodeURIComponent(NEXT)}`) {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(`/login${q}`);
  expect(res?.status()).toBe(200);
  await expect(page.locator(`${BOX} h1`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const css = (page: Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
const mail = (page: Page) => page.getByRole("textbox", { name: "メールアドレス" });
const pass = (page: Page) => page.getByLabel("パスワード", { exact: true });
const nextBtn = (page: Page) => page.locator(BOX).getByRole("button", { name: "次へ", exact: true });
const digit = (page: Page, n: number) => page.getByRole("textbox", { name: `確認のコード ${n} けた目` });
async function toTwoFactor(page: Page) {
  await mail(page).fill("takamoto@example.com");
  await pass(page).fill("correct-horse-battery-1");
  await nextBtn(page).click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("確認のコード");
}

test("K221-UI-001 幅 1440：左半分の紺の宣伝の面が無く、灰の地の真ん中に白い箱（幅 420・線 #DDE2E9・角丸 12）・上に名前の札・下に行き先 3 つ", async ({
  page,
}) => {
  await mockAuth(page);
  await open(page);
  await expect(page.getByText("自分のAIが先に動いている")).toHaveCount(0);
  const leftBg = await page.evaluate(() => {
    let e: Element | null = document.elementFromPoint(120, 500);
    while (e && getComputedStyle(e).backgroundColor === "rgba(0, 0, 0, 0)") e = e.parentElement;
    return e ? getComputedStyle(e).backgroundColor : "";
  });
  expect(leftBg, "左の端の地はキャンバスの灰（#F2F4F7）・紺の宣伝の面でない").toBe("rgb(242, 244, 247)");
  const b = (await page.locator(BOX).boundingBox())!;
  expect(Math.round(b.width)).toBe(420);
  expect(Math.abs(b.x + b.width / 2 - 720)).toBeLessThanOrEqual(2);
  expect(await css(page, BOX, "background-color")).toBe(WHITE);
  expect(await css(page, BOX, "border-top-color")).toBe(LINE);
  expect(await css(page, BOX, "border-top-left-radius")).toBe("12px");
  await expect(page.locator(".k-auth-logo")).toContainText("Kaname");
  const foot = page.getByRole("navigation", { name: "Kaname について" });
  expect((await foot.getByRole("link").allInnerTexts()).map((x) => x.trim())).toEqual([
    "利用規約",
    "プライバシー",
    "困ったとき",
  ]);
});

test("K221-UI-002 部品の世代：ログインの画面は k の部品と入口の枠を使い、前の外の枠（OutsideLayout）と前の部品（components/ui）を読まない", () => {
  const page = readFileSync(join(WEB, "app/(outside)/login/page.tsx"), "utf8");
  const form = readFileSync(join(WEB, "features/F1/login/login-form.tsx"), "utf8");
  for (const [name, src] of [
    ["page.tsx", page],
    ["login-form.tsx", form],
  ] as const) {
    expect(src, name).not.toMatch(/@\/components\/outside\/outside-layout/);
    expect(src, name).not.toMatch(/@\/components\/ui"/);
  }
  expect(form).toMatch(/AuthFrame/);
});

test("K221-UI-003 見出し：h1「ログイン」は 18px・700・#131B27・真ん中。「毎日ここから。」は無い", async ({ page }) => {
  await mockAuth(page);
  await open(page);
  const h1 = `${BOX} h1`;
  await expect(page.locator(h1)).toHaveText("ログイン");
  expect(await css(page, h1, "font-size")).toBe("18px");
  expect(await css(page, h1, "font-weight")).toBe("700");
  expect(await css(page, h1, "color")).toBe(INK);
  expect(await css(page, h1, "text-align")).toBe("center");
  await expect(page.getByText("毎日ここから。")).toHaveCount(0);
  await expect(page.locator("form[data-state='n']")).toHaveCount(1);
});

test("K221-UI-004 主「パスキーで入る」：見えていて紺・高さ 44・角丸 8・14px・500。使えない（グレー 0.55・disabled・aria-disabled）で、押しても Enter でも口を呼ばない", async ({
  page,
}) => {
  const m = await mockAuth(page);
  await open(page);
  const pk = page.locator(`${BOX} [data-act="passkey"]`);
  await expect(pk).toBeVisible();
  await expect(pk).toHaveAccessibleName("パスキーで入る");
  expect(Math.round((await pk.boundingBox())!.height)).toBe(44);
  expect(await pk.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PRIMARY);
  expect(await pk.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("8px");
  expect(await pk.evaluate((e) => getComputedStyle(e).fontSize)).toBe("14px");
  expect(await pk.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("500");
  expect(Number(await pk.evaluate((e) => getComputedStyle(e).opacity))).toBeCloseTo(DISABLED_OPACITY, 2);
  await expect(pk).toBeDisabled();
  await expect(pk).toHaveAttribute("aria-disabled", "true");
  await pk.click({ force: true });
  await pk.focus();
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-act") ?? "")).not.toBe("passkey");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login/);
  expect(m.signIns).toHaveLength(0);
  expect(m.other).toEqual([]);
  const pkBox = (await pk.boundingBox())!;
  const mailBox = (await mail(page).boundingBox())!;
  expect(pkBox.y, "パスキーが一番上の主ボタン（メールの欄より上）").toBeLessThan(mailBox.y);
});

test("K221-UI-005 パスキーの説明と区切り：「スマホで QR を読み取る」は使えない（グレー・aria-disabled・押しても移らない）。区切り「またはメールとパスワード」が線と一緒に出る", async ({
  page,
}) => {
  await mockAuth(page);
  await open(page);
  const note = page.locator(BOX).getByText(/指・顔・PC のロックで入る/);
  expect(await note.evaluate((e) => getComputedStyle(e).fontSize)).toBe("11px");
  expect(await note.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
  const qr = page.locator(BOX).getByRole("link", { name: "スマホで QR を読み取る" });
  await expect(qr).toHaveAttribute("aria-disabled", "true");
  expect(await qr.getAttribute("href")).toBeNull();
  expect(Number(await qr.evaluate((e) => getComputedStyle(e).opacity))).toBeCloseTo(DISABLED_OPACITY, 2);
  await qr.click({ force: true });
  await expect(page).toHaveURL(/\/login/);
  const sep = page.locator(BOX).getByText("またはメールとパスワード", { exact: true });
  await expect(sep).toBeVisible();
  expect(await sep.evaluate((e) => getComputedStyle(e).fontSize)).toBe("11px");
  // 字の両側に線（#EDF0F4）がある：区切りの行の中に、字の左と右に横の線の要素がある
  const lines = await page.locator(`${BOX} .k-login-sep`).evaluate((row) => {
    const t = [...row.childNodes].find((n) => n.textContent?.includes("またはメールとパスワード"));
    const tr = (t instanceof Element ? t : row).getBoundingClientRect();
    return [...row.querySelectorAll("*")]
      .map((e) => ({ r: e.getBoundingClientRect(), c: getComputedStyle(e) }))
      .filter((x) => x.c.borderTopStyle === "solid" && x.c.borderTopColor === "rgb(237, 240, 244)" && x.r.width > 8)
      .map((x) => (x.r.right <= tr.left + 1 ? "左" : x.r.left >= tr.right - 1 ? "右" : "中"));
  });
  expect(lines.sort()).toEqual(["右", "左"]);
});

test("K221-UI-006 2 つの欄：目に見える項目名は無く、placeholder「メール」「パスワード」。読み上げの名前は「メールアドレス」「パスワード」", async ({
  page,
}) => {
  await mockAuth(page);
  await open(page);
  await expect(mail(page)).toHaveAttribute("placeholder", "メール");
  await expect(pass(page)).toHaveAttribute("placeholder", "パスワード");
  await expect(mail(page)).toHaveAttribute("autocomplete", "email");
  await expect(pass(page)).toHaveAttribute("autocomplete", "current-password");
  const visibleLabels = await page.locator(`${BOX} label, ${BOX} .k-label`).evaluateAll((els) =>
    els
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && getComputedStyle(e).clip !== "rect(0px, 0px, 0px, 0px)";
      })
      .map((e) => e.textContent?.trim()),
  );
  expect(visibleLabels).not.toContain("メールアドレス");
  expect(visibleLabels).not.toContain("パスワード");
});

test("K221-UI-007 従「次へ」：白地・線 1px #DDE2E9・字 #131B27・高さ 44・角丸 8（主従を直す：紺の「ログイン」をやめる）", async ({
  page,
}) => {
  await mockAuth(page);
  await open(page);
  const b = nextBtn(page);
  await expect(b).toHaveAttribute("type", "submit");
  await expect(b).toHaveAttribute("data-variant", "outlined");
  expect(Math.round((await b.boundingBox())!.height)).toBe(44);
  expect(await b.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(WHITE);
  expect(await b.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(LINE);
  expect(await b.evaluate((e) => getComputedStyle(e).color)).toBe(INK);
  expect(await b.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("8px");
  await expect(page.locator(BOX).getByRole("button", { name: "ログイン" })).toHaveCount(0);
});

test("K221-UI-008 下のリンク：「パスワードを忘れた」は /password-reset・「端末をなくした」は使えない（グレー）・線の下に「はじめての方は アカウントを作る」（/signup）", async ({
  page,
}) => {
  await mockAuth(page);
  await open(page);
  await page.locator(BOX).getByRole("link", { name: "パスワードを忘れた" }).click();
  await expect(page).toHaveURL(/\/password-reset$/);
  await open(page);
  const lost = page.locator(BOX).getByRole("link", { name: "端末をなくした" });
  await expect(lost).toHaveAttribute("aria-disabled", "true");
  expect(await lost.getAttribute("href")).toBeNull();
  expect(Number(await lost.evaluate((e) => getComputedStyle(e).opacity))).toBeCloseTo(DISABLED_OPACITY, 2);
  const row = page.locator(`${BOX} .k-login-links`);
  expect(await row.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  expect(await row.evaluate((e) => getComputedStyle(e).justifyContent)).toBe("space-between");
  const alt = page.locator(`${BOX} .k-auth-alt`);
  await expect(alt).toHaveText(/はじめての方は\s*アカウントを作る/);
  expect(await alt.evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe("solid");
  expect(await alt.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("1px");
  expect(await alt.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe("rgb(237, 240, 244)");
  expect(await alt.evaluate((e) => getComputedStyle(e).paddingTop)).toBe("12px");
  expect(await alt.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  await alt.getByRole("link", { name: "アカウントを作る" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByText("お忘れの方")).toHaveCount(0);
});

test("K221-UI-009 正しい組で「次へ」：口に打ったメールとパスワードが 1 回届き、行き先（next）へ移ってログインの印が残る", async ({
  page,
}) => {
  const m = await mockAuth(page);
  await open(page);
  await mail(page).fill("takamoto@example.com");
  await pass(page).fill("correct-horse-battery-1");
  await nextBtn(page).click();
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  expect(m.signIns).toEqual([{ email: "takamoto@example.com", password: "correct-horse-battery-1" }]);
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBe("tok-k221");
});

test("K221-UI-010 違うパスワード：口の文（あと 4 回で 15 分ロックします）が箱の中に出て、ログインの画面のまま（data-state e）", async ({
  page,
}) => {
  const m = await mockAuth(page);
  m.on.signIn = () => fail(401, "E-AUTH-001", "メールアドレスかパスワードが違います。あと 4 回で 15 分ロックします");
  await open(page);
  await mail(page).fill("takamoto@example.com");
  await pass(page).fill("wrong-password-000");
  await nextBtn(page).click();
  await expect(page.locator(`${BOX} form[data-state='e']`)).toContainText("あと 4 回で 15 分ロックします");
  await expect(page.locator(BOX).getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeNull();
});

test("K221-UI-011 空のまま「次へ」：ブラウザの吹き出しで止まらず（form は noValidate）、口の文が画面の箱の中に出る", async ({
  page,
}) => {
  const m = await mockAuth(page);
  m.on.signIn = () => fail(422, "E-VAL-001", "メールアドレスを入れてください");
  await open(page);
  expect(await page.locator(`${BOX} form`).evaluate((f) => (f as HTMLFormElement).noValidate)).toBe(true);
  await nextBtn(page).click();
  await expect(page.locator(BOX).getByText("メールアドレスを入れてください")).toBeVisible();
  expect(m.signIns).toHaveLength(1);
  expect(await mail(page).evaluate((e) => (e as HTMLInputElement).validationMessage)).toBe("");
});

test("K221-UI-012 送っている間：「次へ」に回る印（.k-spin）と aria-busy が付き、押せない。二度押しでも口は 1 回", async ({
  page,
}) => {
  const m = await mockAuth(page);
  m.on.signIn = () => ({
    status: 200,
    body: { data: { token: "tok-k221", two_factor: false, two_factor_cookie: null } },
    delayMs: 800,
  });
  await open(page);
  await mail(page).fill("takamoto@example.com");
  await pass(page).fill("correct-horse-battery-1");
  await nextBtn(page).click();
  const b = nextBtn(page);
  await expect(b).toHaveAttribute("aria-busy", "true");
  await expect(b.locator(".k-spin")).toBeVisible();
  await expect(b).toBeDisabled();
  await b.evaluate((e) => (e as HTMLButtonElement).click());
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  expect(m.signIns).toHaveLength(1);
});

test("K221-UI-013 6 けた：h1「確認のコード」・説明 13px・枠が 6 つ（44×52・線 #DDE2E9・角丸 8・20px・700）。autocomplete one-time-code は 1 つめだけ", async ({
  page,
}) => {
  await mockAuth(page, { twoFactor: true });
  await open(page);
  await toTwoFactor(page);
  await expect(page.locator(`${BOX} form[data-state='m']`)).toHaveCount(1);
  expect(await css(page, `${BOX} .k-auth-lead`, "font-size")).toBe("13px");
  expect(Math.abs(parseFloat(await css(page, `${BOX} .k-auth-lead`, "line-height")) - 22.1)).toBeLessThan(0.5);
  await expect(page.locator(`${BOX} form[data-state='m'] h1`)).toHaveText("確認のコード");
  const hint = page.locator(BOX).getByText("数字は 30 秒ごとに変わる ・ 6 つそろうと自動で進む");
  expect(await hint.evaluate((e) => getComputedStyle(e).fontSize)).toBe("11px");
  const cant = page.locator(BOX).getByRole("button", { name: "認証アプリが使えない" });
  expect(await cant.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  for (let n = 1; n <= 6; n += 1) {
    const d = digit(page, n);
    const r = (await d.boundingBox())!;
    expect(Math.round(r.width), `${n} けた目の幅`).toBe(44);
    expect(Math.round(r.height), `${n} けた目の高さ`).toBe(52);
    expect(await d.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(LINE);
    expect(await d.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("8px");
    expect(await d.evaluate((e) => getComputedStyle(e).fontSize)).toBe("20px");
    expect(await d.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("700");
    expect(await d.evaluate((e) => getComputedStyle(e).backgroundColor), "枠の地は透明（キャンバスの span）").toBe(
      "rgba(0, 0, 0, 0)",
    );
  }
  await page.setViewportSize({ width: 375, height: 1000 });
  expect(await digit(page, 1).evaluate((e) => getComputedStyle(e).fontSize), "幅 375 でも 20px").toBe("20px");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(`${BOX} input[autocomplete="one-time-code"]`)).toHaveCount(1);
  await expect(digit(page, 1)).toHaveAttribute("autocomplete", "one-time-code");
  await expect(page.getByText("6桁を入れてください")).toHaveCount(0);
  await expect(page.locator(BOX).getByRole("button", { name: "入る", exact: true })).toHaveAttribute(
    "data-variant",
    "primary",
  );
});

test("K221-UI-014 6 けた：1 つめから 6 つの数字を打つと次の枠へ進み、6 つそろうと自動で確かめの口へ（code・trust_device）・行き先へ移る", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page);
  await toTwoFactor(page);
  await digit(page, 1).click();
  await page.keyboard.type("482913", { delay: 30 });
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  expect(m.verifies).toHaveLength(1);
  expect(m.verifies[0]).toMatchObject({ two_factor_cookie: "tf-k221", code: "482913", trust_device: true });
});

test("K221-UI-015 6 けた：6 けたを貼り付けると 6 つの枠に 1 字ずつ入る。違うコードの口の文は箱の中に出て、枠は空に戻り 1 つめに戻る", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.verify = () => fail(401, "E-AUTH-004", "コードが違います。もう一度入れてください");
  await open(page);
  await toTwoFactor(page);
  await digit(page, 1).focus();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "123456");
    document.activeElement!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  });
  await expect(page.locator(BOX).getByRole("alert")).toContainText("コードが違います");
  expect(m.verifies).toHaveLength(1);
  expect(m.verifies[0]).toMatchObject({ code: "123456" });
  for (let n = 1; n <= 6; n += 1) await expect(digit(page, n)).toHaveValue("");
  await expect(digit(page, 1)).toBeFocused();
});

test("K221-UI-016 6 けた：主「入る」で送れる（そろう前に押すと口を呼ばず「6 けたを入れてください」）", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page);
  await toTwoFactor(page);
  await page.locator(BOX).getByRole("button", { name: "入る", exact: true }).click();
  await expect(page.locator(BOX).getByRole("alert")).toContainText("6 けたを入れてください");
  expect(m.verifies).toHaveLength(0);
});

test("K221-UI-017 「認証アプリが使えない」：バックアップコードの欄（1 つ・placeholder「例：7KQM-2XPA」）に替わり、「入る」で backup_code が届く。全角は半角に・前後の空白は落とし、大文字と小文字はそのまま送る", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page);
  await toTwoFactor(page);
  await page.locator(BOX).getByRole("button", { name: "認証アプリが使えない" }).click();
  await expect(page.locator(`${BOX} form[data-state='m'] h1`)).toHaveText("バックアップコードで入る");
  const bk = page.getByRole("textbox", { name: "バックアップコード" });
  await expect(bk).toHaveAttribute("placeholder", "例：7KQM-2XPA");
  // 全角の英数字・全角のハイフン・前後の全角の空白を意図して入れる
  await bk.fill("　Ｋ８ｆ２－９Ｘ１ｍ ");
  await page.locator(BOX).getByRole("button", { name: "入る", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  expect(m.verifies[0]).toMatchObject({ two_factor_cookie: "tf-k221", backup_code: "K8f2-9X1m" });
  expect(m.verifies[0]).not.toHaveProperty("code");
});

test("K221-UI-018 「この端末では 30 日間きかない」はキャンバスに無いので出さない（PM の決め）。確かめの口には今の既定どおり trust_device: true を送る", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page);
  await toTwoFactor(page);
  await expect(page.locator(BOX).getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByText(/30\s*日間きかない/)).toHaveCount(0);
  await digit(page, 1).click();
  await page.keyboard.type("482913", { delay: 30 });
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  expect(m.verifies[0]).toMatchObject({ trust_device: true });
});

test("K221-UI-019 入力欄の字：幅 1440 は 14px（キャンバス）・幅 375 は 16px（D-144.7）。どちらも高さ 42・白地・線 #DDE2E9・角丸 8", async ({
  page,
}) => {
  await mockAuth(page);
  for (const [w, size] of [
    [1440, "14px"],
    [375, "16px"],
  ] as const) {
    await open(page, w);
    for (const f of [mail(page), pass(page)]) {
      expect(await f.evaluate((e) => getComputedStyle(e).fontSize), `幅 ${w}`).toBe(size);
      expect(Math.round((await f.boundingBox())!.height), `幅 ${w}`).toBe(42);
      expect(await f.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(WHITE);
      expect(await f.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(LINE);
      expect(await f.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("8px");
    }
  }
});

test("K221-UI-020 キーボード：Tab はメール → パスワード（→ 見る・隠す）→ 次へ と進み、使えないパスキー・QR・端末をなくした には止まらない", async ({
  page,
}) => {
  await mockAuth(page);
  await open(page);
  await mail(page).focus();
  const seen: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    seen.push(
      await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return a?.getAttribute("aria-label") ?? a?.textContent?.trim() ?? "";
      }),
    );
  }
  expect(seen.slice(0, 3).join("|")).toMatch(/^パスワード\|パスワードを表示\|次へ$/);
  for (const s of seen) expect(["パスキーで入る", "スマホで QR を読み取る", "端末をなくした"]).not.toContain(s);
});

test("K221-UI-021 幅 320・375・768・1024・1440：横溢れ 0・見出しの 1 文字目が画面の中（ログインと 6 けた）", async ({
  page,
}) => {
  await mockAuth(page, { twoFactor: true });
  const bad: string[] = [];
  for (const w of WIDTHS) {
    await open(page, w);
    for (const step of ["ログイン", "6 けた"]) {
      if (step === "6 けた") await toTwoFactor(page);
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (o !== 0) bad.push(`${step} 幅 ${w}：横溢れ ${o}px`);
      const left = await page.locator(`${BOX} h1`).evaluate((e) => {
        const r = document.createRange();
        r.setStart(e.firstChild!, 0);
        r.setEnd(e.firstChild!, 1);
        return r.getBoundingClientRect().left;
      });
      if (left < 0) bad.push(`${step} 幅 ${w}：見出しの 1 文字目が左に切れる`);
    }
  }
  expect(bad).toEqual([]);
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

test("K221-UI-022 突き合わせの設定：login・login-2fa が enrolled・持ち主 K-221・login の主ボタンの画面の側はパスキー（submit の「次へ」ではない）・鍵が在る", () => {
  for (const id of ["login", "login-2fa"]) {
    const g = CFG.groups.find((x) => x.id === id);
    expect(g, id).toBeTruthy();
    expect(g!.enrolled, id).toBe(true);
    expect(g!.owner, id).toBe("K-221");
    expect(FIDELITY_STATES[g!.state], id).toBeTruthy();
  }
  const login = CFG.groups.find((x) => x.id === "login")!;
  const primary = login.pairs.find((p) => p.role === "primary")!;
  expect(primary.app).toContain('[data-act="passkey"]');
});

for (const id of ["login", "login-2fa"]) {
  const G = CFG.groups.find((x) => x.id === id);
  for (const w of G?.widths ?? [1440]) {
    test(`K221-UI-023 ${id}（${G?.canvas}）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({ browser }) => {
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

test("K221-UI-024 ログインしたまま同意し直し（?step=terms）の画面は今のまま入口の枠に出る（ログインの枠の載せ替えで壊さない）", async ({
  page,
}) => {
  await mockAuth(page);
  // ログインしたまま：印を置き、本人の口（/me）と今の版の規約の口に答える（印が無いと同意し直しの画面はログインへ移す・K-53）。
  //   あとから足した道が先に当たる（Playwright の route は後に足した物が先）
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "tok-k221"));
  await page.route(/\/api\/v1\/auth\/terms\/current$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "00000000-0000-4000-8000-000000000301",
            kind: "terms",
            version: "第2版",
            url: "/legal/terms?v=2",
            published_at: "2026-11-01T00:00:00.000Z",
          },
          {
            id: "00000000-0000-4000-8000-000000000302",
            kind: "privacy",
            version: "第2版",
            url: "/legal/privacy?v=2",
            published_at: "2026-11-01T00:00:00.000Z",
          },
        ],
      }),
    }),
  );
  await page.route(/\/api\/.*\/me$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { id: "11111111-0000-4000-8000-000000000001", email: "takamoto@example.com", name: "高本" },
      }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/login?step=terms&next=${encodeURIComponent("/tickets")}`);
  // 同意し直しの画面が出きるまで待つ（ログインの画面へ移っていない）
  await expect(page.getByRole("checkbox", { name: "利用規約とプライバシーポリシーに同意します" })).toBeVisible();
  await expect(page).toHaveURL(/\/login\?step=terms/);
  await expect(page.locator(".k-auth-card, [data-part='auth-box']").first()).toBeVisible();
  await expect(page.locator(`${BOX} [data-act="passkey"]`)).toHaveCount(0);
});

// ---- Q の指摘（1・2・4・5）から足した行（025〜031） ----
const codeVals = (page: Page) =>
  page
    .locator(`${BOX} input[aria-label$="けた目"]`)
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));

test("K221-UI-025 6 けた：空の 3 つめで Backspace を押すと 2 つめに戻って空になる。続けて打つと 482913 が 1 回届く", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page);
  await toTwoFactor(page);
  await digit(page, 1).click();
  await page.keyboard.type("47", { delay: 30 });
  await expect(digit(page, 3)).toBeFocused();
  await page.keyboard.press("Backspace");
  await expect(digit(page, 2)).toBeFocused();
  await expect(digit(page, 2)).toHaveValue("");
  expect(await codeVals(page)).toEqual(["4", "", "", "", "", ""]);
  await page.keyboard.type("82913", { delay: 30 });
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  expect(m.verifies).toHaveLength(1);
  expect(m.verifies[0]).toMatchObject({ code: "482913" });
});

test("K221-UI-026 6 けた：全角の「４８２９１３」を打つと各枠は半角の 1 字になり、口に 482913 が 1 回届く", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.verify = () => ({ status: 200, body: { data: { token: "tok-k221" } }, delayMs: 600 });
  await open(page);
  await toTwoFactor(page);
  await digit(page, 1).click();
  await page.keyboard.type("４８２９１３", { delay: 30 });
  await expect.poll(() => codeVals(page)).toEqual(["4", "8", "2", "9", "1", "3"]);
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  expect(m.verifies).toHaveLength(1);
  expect(m.verifies[0]).toMatchObject({ code: "482913" });
});

test("K221-UI-027 6 けた：日本語の変換中に打っても、確定のたびに半角の 1 字だけが入り（二重に入らない）、482913 が 1 回届く", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.verify = () => ({ status: 200, body: { data: { token: "tok-k221" } }, delayMs: 600 });
  await open(page);
  await toTwoFactor(page);
  await digit(page, 1).click();
  const cdp = await page.context().newCDPSession(page);
  const full = ["４", "８", "２", "９", "１", "３"];
  for (let i = 0; i < full.length; i += 1) {
    // 変換の途中（下線つきの文字）。この間は次の枠へ移らない
    await cdp.send("Input.imeSetComposition", { text: full[i]!, selectionStart: 1, selectionEnd: 1 });
    // 変換中の字が枠に届いたのを待ってから、まだ次の枠へ移っていないことを見る
    await expect(digit(page, i + 1)).toHaveValue(full[i]!);
    await expect(digit(page, i + 1)).toBeFocused();
    // 確定
    await cdp.send("Input.insertText", { text: full[i]! });
    if (i < full.length - 1) await expect(digit(page, i + 2)).toBeFocused();
  }
  await expect.poll(() => codeVals(page)).toEqual(["4", "8", "2", "9", "1", "3"]);
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  expect(m.verifies).toHaveLength(1);
  expect(m.verifies[0]).toMatchObject({ code: "482913" });
});

test("K221-UI-028 6 けた：入っている 2 つめをクリックして 7 を打つと 7 に替わって 3 つめへ移る。5 つめから 1・3 を打つと 472913 が 1 回届く", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page);
  await toTwoFactor(page);
  await digit(page, 1).click();
  await page.keyboard.type("4829", { delay: 30 });
  await digit(page, 2).click();
  await page.keyboard.type("7");
  await expect(digit(page, 2)).toHaveValue("7");
  await expect(digit(page, 3)).toBeFocused();
  expect(await codeVals(page)).toEqual(["4", "7", "2", "9", "", ""]);
  expect(m.verifies).toHaveLength(0);
  await digit(page, 5).click();
  await page.keyboard.type("13", { delay: 30 });
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  expect(m.verifies).toHaveLength(1);
  expect(m.verifies[0]).toMatchObject({ code: "472913" });
});

test("K221-UI-029 6 けた：自動入力で 1 つめの枠に 482913 が一度に入ると、6 つの枠に 1 字ずつ配られて 482913 が 1 回届く", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.verify = () => ({ status: 200, body: { data: { token: "tok-k221" } }, delayMs: 600 });
  await open(page);
  await toTwoFactor(page);
  await digit(page, 1).fill("482913");
  await expect.poll(() => codeVals(page)).toEqual(["4", "8", "2", "9", "1", "3"]);
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  expect(m.verifies).toHaveLength(1);
  expect(m.verifies[0]).toMatchObject({ code: "482913" });
});

/** 画面の側で口を呼んだ回数を数える（網の手前の受け手は画面が答えを受け取る前に数えるので、押した直後の回数は画面の側で見る） */
async function countCalls(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __k221: { signIn: number; verify: number } };
    w.__k221 = { signIn: 0, verify: 0 };
    const orig = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (u.includes("/api/auth-ext/sign-in")) w.__k221.signIn += 1;
      if (u.includes("/api/auth-ext/two-factor/verify")) w.__k221.verify += 1;
      return orig(input, init);
    };
  });
  return (key: "signIn" | "verify") =>
    page.evaluate((k) => (window as unknown as { __k221: Record<string, number> }).__k221[k], key);
}
const nextFrame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
/** 行き先の画面の読み込み（文書と、画面の中で移るときの ?_rsc=）を止める。解くのは返した関数 */
async function holdNext(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const held = new Promise<void>((r) => (release = r));
  await page.route(new RegExp(`${NEXT}(\\?|$)`), async (route) => {
    await held;
    await route.continue().catch(() => undefined);
  });
  return release;
}

test("K221-UI-030 成功の直後（行き先へ移る途中）：「次へ」も「入る」も回る印のまま押せず、もう一度押しても口は 1 回", async ({
  page,
}) => {
  const calls = await countCalls(page);
  const release = await holdNext(page);
  try {
    await mockAuth(page);
    await open(page);
    await mail(page).fill("takamoto@example.com");
    await pass(page).fill("correct-horse-battery-1");
    // 移る途中に入ったこと＝行き先の読み込みが出たこと（router.push の後）を待つ
    const moving = page.waitForRequest(new RegExp(`${NEXT}(\\?|$)`));
    await nextBtn(page).click();
    await moving;
    await nextFrame(page);
    const b = nextBtn(page);
    await expect(b).toHaveAttribute("aria-busy", "true");
    await expect(b).toBeDisabled();
    await expect(b.locator(".k-spin")).toBeVisible();
    await b.evaluate((e) => (e as HTMLButtonElement).click());
    await page.locator(`${BOX} form`).evaluate((f) => (f as HTMLFormElement).requestSubmit());
    expect(await calls("signIn")).toBe(1);
  } finally {
    release();
  }
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));

  // 6 けたの確かめが成功した後も同じ
  const page2 = await page.context().newPage();
  const calls2 = await countCalls(page2);
  const release2 = await holdNext(page2);
  try {
    await mockAuth(page2, { twoFactor: true });
    await open(page2);
    await toTwoFactor(page2);
    await digit(page2, 1).click();
    const moving2 = page2.waitForRequest(new RegExp(`${NEXT}(\\?|$)`));
    await page2.keyboard.type("482913", { delay: 30 });
    await moving2;
    await nextFrame(page2);
    const enter = page2.locator(BOX).getByRole("button", { name: "入る", exact: true });
    await expect(enter).toHaveAttribute("aria-busy", "true");
    await expect(enter).toBeDisabled();
    await expect(enter.locator(".k-spin")).toBeVisible();
    await enter.evaluate((e) => (e as HTMLButtonElement).click());
    await page2.locator(`${BOX} form`).evaluate((f) => (f as HTMLFormElement).requestSubmit());
    expect(await calls2("verify")).toBe(1);
    await expect(page2.locator(BOX).getByRole("alert")).toHaveCount(0);
  } finally {
    release2();
  }
  await expect(page2).toHaveURL(new RegExp(`${NEXT}$`));
});

test("K221-UI-031 空のバックアップコードで「入る」：口を呼ばず、箱の中に正本の文（コードを入れてください）が出る", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page);
  await toTwoFactor(page);
  await page.locator(BOX).getByRole("button", { name: "認証アプリが使えない" }).click();
  await page.getByRole("textbox", { name: "バックアップコード" }).fill("　 ");
  await page.locator(BOX).getByRole("button", { name: "入る", exact: true }).click();
  await expect(page.locator(BOX).getByRole("alert")).toHaveText("コードを入れてください");
  expect(m.verifies).toHaveLength(0);
});

test("K221-UI-032 6 けた：入っている枠で数字でない字（a）を打つと、枠は元の数字のままで次へ移らず、口も呼ばない", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page);
  await toTwoFactor(page);
  await digit(page, 1).click();
  await page.keyboard.type("48", { delay: 30 });
  await digit(page, 2).click();
  await page.keyboard.type("a");
  await expect(digit(page, 2)).toHaveValue("8");
  await expect(digit(page, 2)).toBeFocused();
  expect(await codeVals(page)).toEqual(["4", "8", "", "", "", ""]);
  // カーソルが字の前にあっても、打った字は前の値との違いで決める（7 を打つと 7 になる）
  await digit(page, 2).evaluate((e) => (e as HTMLInputElement).setSelectionRange(0, 0));
  await page.keyboard.type("7");
  await expect(digit(page, 2)).toHaveValue("7");
  expect(m.verifies).toHaveLength(0);
});

test("K221-UI-033 行き先が今のログインの画面（next=/login）でも、成功したら入口（/）へ移り、回ったまま止まらない", async ({
  page,
}) => {
  await mockAuth(page);
  await open(page, 1440, `?next=${encodeURIComponent("/login")}`);
  await mail(page).fill("takamoto@example.com");
  await pass(page).fill("correct-horse-battery-1");
  const toEntrance = page.waitForRequest((r) => new URL(r.url()).pathname === "/" && r.method() === "GET");
  await nextBtn(page).click();
  await toEntrance;
});
