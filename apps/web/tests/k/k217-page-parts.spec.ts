// K-217「ページの型の部品」の画面の試験（実 Chrome・実装より先に積む）。見本の画面 /dev/k/page-parts に部品を並べ、
//   キャンバスの実測（2026-11-15・04_design/canvas の Main・Approvals・TicketDetail）と同じ値かを数で測る（目で見るだけにしない）。
//   見本の画面の形は、今の 4 画面と同じ入れ子（section.k-root.k-page の中に header.k-page-head と本文が並ぶ・実装の役が作る）：
//     section.k-root.k-page
//       header.k-page-head（h1「チケット」・p.k-page-sub「すべてのグループ」・div.k-page-acts に主ボタン）
//       section.k-section × 2（h2「目的」と p・p.k-pre（改行入りと、空白の無い長い字）・ul.k-list・a.k-link・div.k-row にボタン 2 つ）
//       div[data-testid=bare]（クラスの無い h1・h2・h3）
//   本物の画面（/setup/bridge・口は網の手前で差し替える）と入口の枠（/legal/terms）でも測る。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const INK = "rgb(19, 27, 39)";
const MUTED = "rgb(74, 85, 99)";
const LINE = "rgb(221, 226, 233)";
const PRIMARY = "rgb(34, 52, 92)";
const WHITE = "rgb(255, 255, 255)";

const css = (l: Locator, prop: string) => l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const box = async (l: Locator) => (await l.boundingBox())!;
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto("/dev/k/page-parts");
  expect(res?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

for (const w of [1440, 375]) {
  test(`K217-UI-001 幅 ${w}：見出しの帯は白（--k-card）・下に 1px の線・見出しは帯の左から 24px・上から 12px`, async ({
    page,
  }) => {
    await open(page, w);
    const head = page.locator("header.k-page-head");
    expect(await css(head, "background-color")).toBe(WHITE);
    expect(await css(head, "border-bottom-width")).toBe("1px");
    expect(await css(head, "border-bottom-style")).toBe("solid");
    expect(await css(head, "border-bottom-color")).toBe(LINE);
    const hb = await box(head);
    const tb = await box(head.locator("h1"));
    expect(Math.abs(tb.x - hb.x - 24)).toBeLessThanOrEqual(1);
    expect(Math.abs(tb.y - hb.y - 12)).toBeLessThanOrEqual(1);
  });
}

test("K217-UI-002 見出しの h1 は 18px・700・行の高さ 28.8px・字は #131B27", async ({ page }) => {
  await open(page, 1440);
  const h1 = page.locator("header.k-page-head h1");
  await expect(h1).toHaveText("チケット");
  expect(await css(h1, "font-size")).toBe("18px");
  expect(await css(h1, "font-weight")).toBe("700");
  expect(await css(h1, "line-height")).toBe("28.8px");
  expect(await css(h1, "color")).toBe(INK);
});

test("K217-UI-003 幅 1440：補足は 13px・灰（#4A5563）で、見出しと同じ行（縦の真ん中の差 4px 以内・見出しの右）", async ({
  page,
}) => {
  await open(page, 1440);
  const sub = page.locator("header.k-page-head .k-page-sub");
  await expect(sub).toHaveText("すべてのグループ");
  expect(await css(sub, "font-size")).toBe("13px");
  expect(await css(sub, "color")).toBe(MUTED);
  const s = await box(sub);
  const t = await box(page.locator("header.k-page-head h1"));
  expect(Math.abs(s.y + s.height / 2 - (t.y + t.height / 2))).toBeLessThanOrEqual(4);
  expect(s.x).toBeGreaterThan(t.x + t.width);
});

test("K217-UI-004 幅 1440：操作（主ボタン）は帯の右の端から 24px", async ({ page }) => {
  await open(page, 1440);
  const head = await box(page.locator("header.k-page-head"));
  const acts = await box(page.locator("header.k-page-head .k-page-acts"));
  expect(Math.abs(head.x + head.width - 24 - (acts.x + acts.width))).toBeLessThanOrEqual(1);
});

test("K217-UI-005 幅 375：横に溢れない（scrollWidth − clientWidth が 0）・操作は帯の中に入る", async ({ page }) => {
  await open(page, 375);
  expect(await overflowX(page)).toBe(0);
  const head = await box(page.locator("header.k-page-head"));
  const acts = await box(page.locator("header.k-page-head .k-page-acts"));
  expect(acts.x).toBeGreaterThanOrEqual(head.x);
  expect(acts.x + acts.width).toBeLessThanOrEqual(head.x + head.width);
  expect(acts.y + acts.height).toBeLessThanOrEqual(head.y + head.height);
});

test("K217-UI-006 本文の箱（.k-page）：帯は箱の幅いっぱい（左右の端が箱と同じ）・本文は左右 24px 内側・帯の下から 16px で始まる・下の余白 40px", async ({
  page,
}) => {
  await open(page, 1440);
  const body = page.locator("section.k-page");
  const b = await box(body);
  const h = await box(body.locator("> header.k-page-head"));
  expect(Math.abs(h.x - b.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(h.width - b.width)).toBeLessThanOrEqual(1);
  const sec = await box(body.locator("> section.k-section").first());
  expect(Math.abs(sec.x - b.x - 24)).toBeLessThanOrEqual(1);
  expect(Math.abs(b.x + b.width - 24 - (sec.x + sec.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(sec.y - (h.y + h.height) - 16)).toBeLessThanOrEqual(1);
  expect(await css(body, "padding-bottom")).toBe("40px");
});

test("K217-UI-007 区画の見出し h2 は 16px・700・行の高さ 27.2px・下に 1px の線・下の余白 6px・上 28px・下 8px", async ({
  page,
}) => {
  await open(page, 1440);
  const h2 = page.locator(".k-section h2").first();
  await expect(h2).toHaveText("目的");
  const want: Record<string, string> = {
    "font-size": "16px",
    "font-weight": "700",
    "line-height": "27.2px",
    "padding-bottom": "6px",
    "margin-top": "28px",
    "margin-bottom": "8px",
    "border-bottom-width": "1px",
    "border-bottom-style": "solid",
    "border-bottom-color": LINE,
  };
  for (const [p, v] of Object.entries(want)) expect(await css(h2, p), p).toBe(v);
});

test("K217-UI-008 区画の本文の段落は 13px・行の高さ 22.1px・字は #131B27", async ({ page }) => {
  await open(page, 1440);
  const p = page.locator(".k-section p:not(.k-pre)").first();
  expect(await css(p, "font-size")).toBe("13px");
  expect(await css(p, "line-height")).toBe("22.1px");
  expect(await css(p, "color")).toBe(INK);
});

for (const w of [1440, 375]) {
  test(`K217-UI-009 幅 ${w}：整形済みの文（.k-pre）は改行を残して 2 行に出し、空白の無い長い字も折り返して横に溢れない`, async ({
    page,
  }) => {
    await open(page, w);
    const pres = page.locator(".k-pre");
    expect(await css(pres.first(), "white-space")).toBe("pre-wrap");
    const lh = parseFloat(await css(pres.first(), "line-height"));
    expect((await box(pres.first())).height).toBeGreaterThanOrEqual(lh * 2 - 1);
    const long = await box(pres.nth(1));
    const sec = await box(page.locator(".k-section").first());
    expect(long.x + long.width).toBeLessThanOrEqual(sec.x + sec.width + 1);
    expect(await overflowX(page)).toBe(0);
  });
}

test("K217-UI-010 箇条（.k-list）は左に 20px・黒丸・項目は 13px", async ({ page }) => {
  await open(page, 1440);
  const ul = page.locator("ul.k-list");
  expect(await css(ul, "padding-left")).toBe("20px");
  expect(await css(ul, "list-style-type")).toBe("disc");
  expect(await css(ul.locator("li").first(), "font-size")).toBe("13px");
});

test("K217-UI-011 文字のリンク（.k-link）は紺（#22345C）・下線。キーボードで移ると 2px の紺の輪", async ({ page }) => {
  await open(page, 1440);
  const a = page.locator("a.k-link").first();
  expect(await css(a, "color")).toBe(PRIMARY);
  expect(await css(a, "text-decoration-line")).toBe("underline");
  await a.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(a).toBeFocused();
  expect(await css(a, "outline-width")).toBe("2px");
  expect(await css(a, "outline-color")).toBe(PRIMARY);
});

for (const w of [1440, 375]) {
  test(`K217-UI-012 幅 ${w}：横並び（.k-row）は flex・間 8px・折り返す。中のボタン 2 つの間は 8px（折り返したときは縦に並ぶ）`, async ({
    page,
  }) => {
    await open(page, w);
    const row = page.locator(".k-row").first();
    expect(await css(row, "display")).toBe("flex");
    expect(await css(row, "column-gap")).toBe("8px");
    expect(await css(row, "flex-wrap")).toBe("wrap");
    const [a, b] = [await box(row.locator("> *").nth(0)), await box(row.locator("> *").nth(1))];
    if (Math.abs(a.y - b.y) < 2) expect(Math.round(b.x - (a.x + a.width))).toBe(8);
    else expect(b.y).toBeGreaterThan(a.y);
    expect(await overflowX(page)).toBe(0);
  });
}

test("K217-UI-013 クラスの無い見出し（.k-root の下）は h1 18px・h2 16px・h3 13px で、どれも太さ 700（本文と同じ 13px・400 に戻らない）", async ({
  page,
}) => {
  await open(page, 1440);
  const bare = page.getByTestId("bare");
  for (const [tag, size] of [
    ["h1", "18px"],
    ["h2", "16px"],
    ["h3", "13px"],
  ] as const) {
    const h = bare.locator(tag);
    expect(await css(h, "font-size"), tag).toBe(size);
    expect(await css(h, "font-weight"), tag).toBe("700");
  }
});

test("K217-UI-014 暗いテーマ：帯の地は暗いテーマの --k-card、リンクは暗いテーマの --k-primary（白と紺の決め打ちでない）", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "k-theme", value: "dark", url: baseURL! }]);
  await open(page, 1440);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const tok = (name: string) =>
    page.evaluate((n) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${n})`;
      document.querySelector(".k-root")!.appendChild(probe);
      const v = getComputedStyle(probe).color;
      probe.remove();
      return v;
    }, name);
  const card = await tok("--k-card");
  const primary = await tok("--k-primary");
  expect(card).not.toBe(WHITE);
  expect(await css(page.locator("header.k-page-head"), "background-color")).toBe(card);
  expect(await css(page.locator("a.k-link").first(), "color")).toBe(primary);
});

test("K217-UI-015 台帳（scripts/ci/class_ledger.json）に、この部品が定義した 7 つの名前の undefined の行が残っていない", () => {
  const rows = JSON.parse(readFileSync(join(ROOT, "scripts/ci/class_ledger.json"), "utf8")).entries as {
    kind: string;
    cls: string;
  }[];
  const mine = ["k-page", "k-page-head", "k-row", "k-section", "k-list", "k-link", "k-pre"];
  expect(rows.filter((r) => r.kind === "undefined" && mine.includes(r.cls))).toEqual([]);
});

test("K217-UI-016 文字の段：正本から作ったトークンに「ページの見出し」18px・1.6・700 と「区画の見出し」16px・1.7・700 が在る", () => {
  const t = readFileSync(join(ROOT, "apps/web/styles/k-tokens.css"), "utf8");
  for (const line of [
    "--k-text-page-title: 18px;",
    "--k-lh-page-title: 1.6;",
    "--k-fw-page-title: 700;",
    "--k-text-section-title: 16px;",
    "--k-lh-section-title: 1.7;",
    "--k-fw-section-title: 700;",
  ])
    expect(t, line).toContain(line);
});

/** /setup/bridge を、ログインの印と口の答え（PC は 0 台・接続コード）を網の手前で差し替えて開く（K-57 の画面の試験と同じ形） */
async function openBridge(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "k217-web-token"));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/v1/bridge/devices")
      return route.fulfill({ status: 200, json: { data: [], meta: { limit: 0 } } });
    if (u.pathname === "/api/v1/bridge/pairing-codes")
      return route.fulfill({
        status: 201,
        json: { data: { code: "KQ7MAX", expires_at: new Date(Date.now() + 600_000).toISOString() } },
      });
    return route.fulfill({ status: 404, json: { error: "not_found", code: "NOT_FOUND" } });
  });
  await page.route(/^https?:\/\/127\.0\.0\.1:38617\//, (route) => route.abort());
  await page.goto("/setup/bridge");
  await page.locator("header.k-page-head h1").waitFor({ state: "visible" });
}

for (const w of [1440, 375]) {
  test(`K217-UI-017 本物の画面（/setup/bridge）幅 ${w}：見出しは 18px・700、帯は白で画面の箱の幅いっぱい、見出しは帯の左から 24px`, async ({
    page,
  }) => {
    await openBridge(page, w);
    const root = await box(page.locator(".k-root.k-page").first());
    const head = page.locator(".k-page > header.k-page-head").first();
    const hb = await box(head);
    const h1 = head.locator("h1");
    expect(await css(h1, "font-size")).toBe("18px");
    expect(await css(h1, "font-weight")).toBe("700");
    expect(await css(head, "background-color")).toBe(WHITE);
    expect(Math.abs(hb.x - root.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(hb.width - root.width)).toBeLessThanOrEqual(1);
    expect(Math.abs((await box(h1)).x - hb.x - 24)).toBeLessThanOrEqual(1);
    expect(await overflowX(page)).toBe(0);
  });
}

test("K217-UI-018 入口の枠（/legal/terms）の見出しは変わらない：h1 は 18px・左寄せ、h2 は 15px（.k-legal の決まり）。見出しの土台の決まりは :where(.k-root:not(.k-auth)) で書く", async ({
  page,
}) => {
  const res = await page.goto("/legal/terms");
  expect(res?.status()).toBe(200);
  const h1 = page.locator(".k-legal h1").first();
  expect(await css(h1, "font-size")).toBe("18px");
  expect(await css(h1, "text-align")).toBe("left");
  expect(await css(page.locator(".k-legal h2").first(), "font-size")).toBe("15px");
  const k = readFileSync(join(ROOT, "apps/web/components/k/k.css"), "utf8");
  expect(k).toContain(":where(.k-root:not(.k-auth)) :where(h1");
});
