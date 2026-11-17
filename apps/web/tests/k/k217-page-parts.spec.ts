// K-217「ページの型の部品」の画面の試験（実 Chrome・実装より先に積む）。見本の画面 /dev/k/page-parts に部品を並べ、
//   キャンバスの実測（2026-11-15・04_design/canvas の Main・Approvals・TicketDetail）と同じ値かを数で測る（目で見るだけにしない）。
//   見本の画面の形は、今の 4 画面と同じ入れ子（section.k-root.k-page の中に header.k-page-head と本文が並ぶ・実装の役が作る）：
//     section.k-root.k-page
//       header.k-page-head（h1「チケット」・p.k-page-sub「すべてのグループ」・div.k-page-acts に主ボタン）
//       section.k-section × 2（h2「目的」と p・p.k-pre（改行入りと、空白の無い長い字）・ul.k-list・a.k-link・div.k-row にボタン 2 つ）
//       div[data-testid=bare]（クラスの無い h1・h2・h3）
//   本物の画面（/approvals・口は網の手前で差し替える。2026-11-16 に /setup/bridge から移した・K-220）と入口の枠（/legal/terms）でも測る。
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
  const ul = page.locator(".k-section ul.k-list");
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

/** 承認待ち（/approvals）を、ログインの印と口の答え（承認待ちは 0 件）を網の手前で差し替えて開く。
 *  2026-11-16 に測る画面を /setup/bridge から移した（K-220 で PC をつなぐは帯にしない見出しの行になった・PM の決め）。
 *  承認待ちの画面のチケットが承認待ちの形を変えるとき、この行を自分で運んで新しい形に替える */
async function openApprovals(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "k217-web-token"));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/api/v1/approvals/queue")
      return route.fulfill({
        status: 200,
        json: { data: [], meta: { limit: 20, counts: { total: 0 }, cursor: null } },
      });
    if (u.pathname === "/api/v1/bridge/devices")
      return route.fulfill({ status: 200, json: { data: [], meta: { limit: 0 } } });
    return route.fulfill({ status: 404, json: { error: "not_found", code: "NOT_FOUND" } });
  });
  await page.route(/^https?:\/\/127\.0\.0\.1:38617\//, (route) => route.abort());
  await page.goto("/approvals");
  await page.locator("header.k-page-head h1").waitFor({ state: "visible" });
  // 読み終えた形（0 件・空の知らせ）で測る。読み込み中や失敗の形のまま測らない
  await expect(page.locator("header.k-page-head .k63-count")).toHaveText("0 件");
  await expect(page.getByText("いま決めるものはありません")).toBeVisible();
  // 本文の中に失敗の知らせが無い（Next の読み上げの部品 next-route-announcer も role=alert なので、本文の箱に絞る）
  await expect(page.locator(".k-root.k-page").getByRole("alert")).toHaveCount(0);
}

for (const w of [1440, 375]) {
  test(`K217-UI-017 本物の画面（/approvals）幅 ${w}：見出しは 18px・700、帯は白で画面の箱の幅いっぱい、見出しは帯の左から 24px`, async ({
    page,
  }) => {
    await openApprovals(page, w);
    const root = await box(page.locator(".k-root.k-page").first());
    const head = page.locator(".k-page > header.k-page-head").first();
    const hb = await box(head);
    const h1 = head.locator("h1");
    await expect(h1).toHaveText("承認待ち");
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

// ---- レビューの指摘（2026-11-15）で足した行：本文の箱の直下の子の左右の余白・生の値・帯の中の sm のボタン・区画の本文の段 ----
//   見本の画面には、本文の箱の直下に ul.k-list・p.k-pre・段落（クラスの無い p）を 1 つずつ置く（実装の役が作る）。
//   帯の操作（div.k-page-acts）には、既定の主ボタンのほかに sm のボタン（data-size="sm"）を 1 つ置く

/** 本文の箱（.k-page）の直下の子が、箱の左右から 24px 内側か（±1） */
async function insetOf(page: Page, child: Locator) {
  const b = await box(page.locator("section.k-page, main.k-page").first());
  const c = await box(child);
  return { left: c.x - b.x, right: b.x + b.width - (c.x + c.width) };
}

for (const w of [1440, 375]) {
  test(`K217-UI-019 幅 ${w}：本文の箱の直下に置いた箇条（ul.k-list）・整形済みの文（p.k-pre）・段落は、左右とも 24px 内側`, async ({
    page,
  }) => {
    await open(page, w);
    for (const sel of ["> ul.k-list", "> p.k-pre", "> p:not([class])"]) {
      const el = page.locator("section.k-page").locator(sel).first();
      await expect(el, sel).toBeVisible();
      const { left, right } = await insetOf(page, el);
      expect(Math.abs(left - 24), `${sel} 左`).toBeLessThanOrEqual(1);
      expect(Math.abs(right - 24), `${sel} 右`).toBeLessThanOrEqual(1);
    }
    expect(await overflowX(page)).toBe(0);
  });
}

/** チケットの一覧（/tickets）を、ログインの印と口の答え（一覧 3 件）を網の手前で差し替えて開く */
async function openTickets(page: Page, width: number) {
  const WS = "aaaaaaaa-0000-4000-8000-000000000217";
  const ME = "11111111-0000-4000-8000-000000000217";
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "k217-web-token"));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route) => {
    const p = new URL(route.request().url()).pathname;
    const ok = (json: unknown) => route.fulfill({ status: 200, json });
    if (p === "/api/auth/get-session")
      return ok({
        session: { id: "s-k217", userId: ME, token: "t", expiresAt: "2099-01-01T00:00:00Z" },
        user: { id: ME, email: "k217@example.com", name: "人", emailVerified: true },
      });
    if (p === "/api/auth-ext/me")
      return ok({ data: { member_id: ME, tenant_id: WS, display_name: "高本", role_id: "staff" } });
    if (p === "/api/v1/scopes")
      return ok({ data: [{ id: "s1", name: "営業", tenant_id: WS }], meta: { limit: 200, writable: ["s1"] } });
    if (p === "/api/v1/ticket_kinds")
      return ok({ data: [{ id: "k1", name: "タスク", sections: [] }], meta: { limit: 2 } });
    if (p === "/api/v1/members") return ok({ data: [{ id: ME, display_name: "高本" }], meta: { limit: 200 } });
    if (p === "/api/v1/tickets")
      return ok({
        // 一覧の口の答えの形（K-92）。一覧の画面は K-251 で表になった
        data: [
          ["0193c5a0-0000-7000-8000-00000000c217", "EG-133", "11 月分の請求書を送る"],
          ["0193c5a0-0000-7000-8000-00000000c218", "EG-134", "見積を送る"],
        ].map(([id, number, title]) => ({
          id,
          number,
          title,
          kind: { id: "k1", name: "タスク" },
          stage: { id: "st", name: "未着手", key: "todo" },
          assignee: { id: ME, display_name: "高本" },
          delegated_to_clone: false,
          due_on: "2026-12-01",
          overdue: false,
          updated_at: "2026-11-15T00:00:00Z",
          parent_ticket_id: null,
          depth: 1,
        })),
        meta: { next_cursor: null },
      });
    return route.fulfill({ status: 404, json: { error: "not_found", code: "NOT_FOUND" } });
  });
  await page.route(/^https?:\/\/127\.0\.0\.1:38617\//, (route) => route.abort());
  const res = await page.goto("/tickets");
  expect(res?.status()).toBe(200);
  await page.getByRole("table", { name: "チケットの一覧" }).waitFor({ state: "visible" });
}

for (const w of [1440, 375]) {
  // K-251 で一覧の画面は箇条（ul.k-list）から表と右の列に替わった。本文の行（.k-list-body）の中身が、左右とも 24px 内側で帯の見出しと左の縁がそろうことを同じ強さで見る
  test(`K217-UI-020 本物の画面（/tickets）幅 ${w}：一覧の本文（表の列と右の列）は左右とも 24px 内側で、帯の見出しと左の縁がそろう`, async ({
    page,
  }) => {
    await openTickets(page, w);
    const page_ = await box(page.locator(".k-list-page").first());
    const main = await box(page.locator(".k-list-body > .k-list-main").first());
    const side = await box(page.locator(".k-list-body > .k-list-side").first());
    const left = Math.min(main.x, side.x);
    const right = Math.max(main.x + main.width, side.x + side.width);
    expect(Math.abs(left - page_.x - 24)).toBeLessThanOrEqual(1);
    expect(Math.abs(page_.x + page_.width - right - 24)).toBeLessThanOrEqual(1);
    const h1 = await box(page.locator(".k-list-page > header.k-page-head h1").first());
    expect(Math.abs(main.x - h1.x)).toBeLessThanOrEqual(1);
    expect(await overflowX(page)).toBe(0);
  });
}

/** CSS の中の生の値（K217-UI-021）。var(--k-…) を除いた残りの字を 1 つずつ見る。
 *  許すのは 0・auto などの言葉（WORDS）と、線の太さの指定（border・border-<辺>・…-width）の 1px だけ。
 *  負の値・単位つきの数・色の名前（一覧に無い言葉）・色の関数・# の色は赤 */
const WORDS = new Set(
  "none auto inherit initial unset solid dashed transparent currentColor flex inline-flex block inline flow-root grid wrap nowrap center start end flex-start flex-end baseline stretch disc pre-wrap anywhere break-word underline normal".split(
    " ",
  ),
);
const BORDER_WIDTH = /^border(-(top|right|bottom|left))?(-width)?$/;
function rawIn(css: string): string[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const bad: string[] = [];
  for (const m of src.matchAll(/([\w-]+)\s*:\s*([^;{}]+)(?:;|(?=\}))/g)) {
    const [prop, value] = [m[1]!, m[2]!.trim()];
    if (prop.startsWith("--")) continue;
    const rest = value.replace(/var\(--k-[\w-]+\)/g, " ");
    for (const tok of rest.split(/[\s,/]+/).filter(Boolean)) {
      const num = /^[-+]?\d*\.?\d+[a-z%]*$/i.test(tok);
      const ok = num ? tok === "0" || (tok === "1px" && BORDER_WIDTH.test(prop)) : WORDS.has(tok) && !/^#|\(/.test(tok);
      if (!ok) bad.push(`${prop}: ${value}（${tok}）`);
    }
  }
  return bad;
}

test("K217-UI-021 page.css に生の値が無い：大きさ・余白・高さ・色は全部 var(--k-…)（許すのは 0・言葉の一覧・線の太さの 1px だけ）。見張り自身が負の値・最後の指定・色の名前・広すぎる 1px を拾う", () => {
  expect(rawIn(readFileSync(join(ROOT, "apps/web/components/k/page.css"), "utf8"))).toEqual([]);
  // 見張りが働いている（作りもの：どれも 1 つずつ赤になる）
  for (const fake of [
    ".a{margin-top:-6px}",
    ".a{margin-top:-0.5em;}",
    ".a{padding:12px}",
    ".a{color:red}",
    ".a{border-bottom:1px solid red}",
    ".a{background:white;}",
    ".a{color:color-mix(in srgb, var(--k-primary) 50%, transparent)}",
    ".a{color:hwb(0 0% 0%)}",
    ".a{color:#22345C}",
    ".a{border-radius:1px}",
    ".a{border-spacing:1px}",
    ".a{line-height:1.7}",
  ])
    expect(rawIn(fake).length, fake).toBeGreaterThan(0);
  // 許す形（作りもの）：0・言葉・線の太さの 1px・var(--k-…)
  expect(
    rawIn(
      ".a{margin:0;display:flex;border-bottom:1px solid var(--k-line);border-top-width:1px;padding:var(--k-s-sm) 0}",
    ),
  ).toEqual([]);
});

test("K217-UI-022 帯の中の sm のボタン（data-size=sm）は sm の高さ 28px のまま（帯の決まりが sm を上書きしない）", async ({
  page,
}) => {
  await open(page, 1440);
  const sm = page.locator('header.k-page-head .k-btn[data-size="sm"]').first();
  await expect(sm).toBeVisible();
  expect(await css(sm, "min-height")).toBe("28px");
  expect(Math.abs((await box(sm)).height - 28)).toBeLessThanOrEqual(1);
});

test("K217-UI-023 区画の本文の段：正本の部品 section-body から作ったトークンに行の高さ 1.7 が在り、区画の段落と箇条の項目はそれを読む（見出しの段 section-title を流用しない）", () => {
  const t = readFileSync(join(ROOT, "apps/web/styles/k-tokens.css"), "utf8");
  expect(t).toContain("--k-c-section-body-text: var(--k-text-body);");
  expect(t).toContain("--k-c-section-body-lh: 1.7;");
  const src = readFileSync(join(ROOT, "apps/web/components/k/page.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const sel of [".k-section p", ".k-list > li"]) {
    const rule = [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1]!.split(",").some((x) => x.trim() === sel));
    expect(rule, sel).toBeTruthy();
    expect(rule![2], sel).toContain("line-height: var(--k-c-section-body-lh)");
    expect(rule![2], sel).not.toContain("--k-lh-section-title");
  }
});
