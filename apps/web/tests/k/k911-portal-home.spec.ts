// K-911「画面：ゲストの場所（/portal）の外枠とホームを口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f11/pt-home・pt-home-empty・pt-home-loading・pt-home-failed・pt-home-notice・pt-welcome・pt-session-expired（本番と同じ部品 features/F11/portal/*）。
//   ログインは本物の人（person・loginAs）。画面のログインの解決（/api/auth-ext/me）だけ、ゲスト（役割 requester）の答えにする（形は K-875 に合わせる）。
//   ゲストの場所の口（getPortalHome・listPortalNotices）は網の手前で差し替える。答えの形は 11_tickets/K-911.md の「読む答えの形」。
//   本人の Bridge（127.0.0.1:38617）は 404。固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import { loginAs } from "../_lib/api";
import { err, ok, pair, person, type Reply } from "./credentials-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const GROUP = "セイコー株式会社（ゲスト）";
/** getPortalHome の me（K-906 の確定：鍵は name・initial）。画面は「山田 花子 様」の字にして帯に出す（所属は口が返さないので出さない） */
const ME = { name: "山田 花子", initial: "山" };
const ME_LABEL = "山田 花子 様";
/** 会社の名前は口の tenant_name（会社ごとに違う・K-906 の確定）。画面に直書きしない */
const TENANT = "ENGINE BASE";
const REQS = [
  {
    id: "0193c5a0-0000-7000-8000-0000000a0001",
    title: "12 月分の作業報告書もほしい",
    from_name: "鈴木 健太 様",
    created_at: "2026-11-23T01:20:00Z",
    badge: "返事あり",
  },
  {
    id: "0193c5a0-0000-7000-8000-0000000a0002",
    title: "来年 1 月から請求書の宛先を変えたい",
    from_name: "山田 花子 様",
    created_at: "2026-11-23T02:30:00Z",
    badge: "返事あり",
  },
  {
    id: "0193c5a0-0000-7000-8000-0000000a0003",
    title: "10 月分の請求書の宛名を変えたい",
    from_name: "山田 花子 様",
    created_at: "2026-10-12T01:00:00Z",
    badge: "済み",
  },
];
const TICKETS = [
  { id: "0193c5a0-0000-7000-8000-0000000b0001", title: "11月分の請求書を送る", stage: "確認中" },
  { id: "0193c5a0-0000-7000-8000-0000000b0002", title: "保守更新の見積", stage: "作っている" },
  {
    id: "0193c5a0-0000-7000-8000-0000000b0003",
    title: "10 月分の請求書の宛名を変える",
    stage: "完了",
    from_request: true,
  },
];
const NOTICE = {
  id: "n1",
  title: "メンテナンスのお知らせ",
  body: "11/10 の夜（22:00〜23:00）、この場所を一時的に使えません。",
};

interface World {
  tenant: string;
  requests: typeof REQS;
  tickets: typeof TICKETS;
  first: boolean;
  notices: unknown[];
  once: { home?: Reply; notices?: Reply };
  gate?: Promise<void>;
  calls: string[];
}
const world = (o: Partial<World> = {}): World => ({
  tenant: TENANT,
  requests: REQS,
  tickets: TICKETS,
  first: false,
  notices: [],
  once: {},
  calls: [],
  ...o,
});
const count = (w: World, p: string) => w.calls.filter((c) => c === p).length;
const send = (route: Route, r: Reply) =>
  route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });

// once の網・サーバーの失敗（5xx）は 1 回だけ当てる（使ったら消す。押し直しの 2 回目は普通の答え）。4xx（見られない・期限切れ）は続ける
function takeOnce<K extends keyof World["once"]>(w: World, k: K): World["once"][K] {
  const v = w.once[k];
  if (v && !Array.isArray(v) && (v as { status: number }).status >= 500) delete w.once[k];
  return v;
}
async function mockWorld(page: Page, w: World) {
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route, req) => {
    const p = new URL(req.url()).pathname;
    if (p === "/api/auth-ext/me")
      return send(
        route,
        ok({
          member_id: "11111111-0000-4000-8000-0000000000a1",
          tenant_id: "11111111-0000-4000-8000-0000000000a2",
          display_name: "山田 花子",
          role_id: null,
          role: "requester",
          scope_id: null,
        }),
      );
    if (p === "/api/v1/portal") {
      w.calls.push(p);
      await w.gate;
      return send(
        route,
        takeOnce(w, "home") ??
          ok({
            group_name: GROUP,
            tenant_name: w.tenant,
            me: ME,
            first_visit: w.first,
            requests: w.requests,
            tickets: w.tickets,
          }),
      );
    }
    if (p === "/api/v1/portal/notices") {
      w.calls.push(p);
      return send(route, takeOnce(w, "notices") ?? ok(w.notices));
    }
    return send(route, ok([]));
  });
}
async function open(page: Page, w: World, width = 1440) {
  const u = await person();
  await loginAs(page, u.token);
  await mockWorld(page, w);
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  expect((await page.goto("/portal"))?.status()).toBe(200);
}
const home = (page: Page, tenant = TENANT) =>
  page.getByRole("heading", { name: `${tenant} とのやり取り`, level: 1, exact: true });
const box = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [mock, o] of [
  ["pt-home", {}],
  ["pt-home-empty", { requests: [], tickets: [] }],
  ["pt-welcome", { first: true }],
] as const) {
  for (const width of MATCH_WIDTHS) {
    test(`K911-UI-001 ${mock} 幅 ${width}：本物の画面が下絵と一致する`, async ({ browser }) => {
      const u = await person();
      const { rows, bad } = await matchMock(
        browser,
        mock,
        width,
        async (page) => {
          await loginAs(page, u.token);
          await mockWorld(page, world(o as Partial<World>));
          await page.goto("/portal");
          await expect(page.locator("[data-portal-frame]")).toBeVisible();
          if (mock === "pt-welcome")
            await expect(page.getByRole("button", { name: "やり取りを始める", exact: true })).toBeVisible();
          else await expect(home(page)).toBeVisible();
        },
        {
          base: "/dev/mock/f11",
          pairs: [
            pair("head", ".k-f11p-head", ["x", "y", "height", "texts"]),
            pair("h1", "h1", ["x", "y", "font-size", "texts"]),
          ],
        },
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K911-UI-002 開く：口が 1 回ずつ・2 つの箱だけ", async ({ page }) => {
  const w = world();
  await open(page, w);
  await expect(home(page)).toBeVisible();
  await expect(box(page, "依頼")).toBeVisible();
  await expect(box(page, "見せてもらったチケット")).toBeVisible();
  await expect(page.locator("section.k-f11p-card")).toHaveCount(2);
  await expect(box(page, "依頼").getByText(`・ ${GROUP}の依頼`, { exact: true })).toBeVisible();
  expect(count(w, "/api/v1/portal")).toBe(1);
  expect(count(w, "/api/v1/portal/notices")).toBe(1);
});

test("K911-UI-003 依頼の行：口の数だけ・同じグループの別の人の依頼も出る", async ({ page }) => {
  await open(page, world());
  const rows = box(page, "依頼").locator(".k-f11p-row");
  await expect(rows).toHaveCount(REQS.length);
  for (const r of REQS) await expect(rows.filter({ hasText: r.title })).toContainText(r.badge);
  await expect(rows.filter({ hasText: "鈴木 健太 様" }).first()).toBeVisible();
  await expect(rows.filter({ hasText: "山田 花子 様" }).first()).toBeVisible();
});

test("K911-UI-004 チケットの行：題と段の札だけ・押すと見せてもらったチケットへ", async ({ page }) => {
  await open(page, world());
  const links = box(page, "見せてもらったチケット").getByRole("link");
  await expect(links).toHaveCount(TICKETS.length);
  const text = await box(page, "見せてもらったチケット").innerText();
  expect(text).not.toMatch(/期限|担当/);
  await expect(links.filter({ hasText: "11月分の請求書を送る" })).toContainText("確認中");
  await links.filter({ hasText: "11月分の請求書を送る" }).click();
  await expect(page).toHaveURL(new RegExp(`/portal/tickets/${TICKETS[0]!.id}$`));
});

test("K911-UI-005 2 つの箱が空：空の文 2 つ・「依頼を出す」は押せる", async ({ page }) => {
  await open(page, world({ requests: [], tickets: [] }));
  await expect(
    page.getByText("まだ依頼はありません。お願いしたいことがあれば「依頼を出す」から送れます", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`まだ見せてもらったチケットはありません。${TENANT} が見せると決めたチケットが、ここに出ます`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "＋ 依頼を出す", exact: true })).toBeEnabled();
});

test("K911-UI-006 読み込み中：文が出て 2 つの箱は無い", async ({ page }) => {
  let release!: () => void;
  const w = world({ gate: new Promise<void>((r) => (release = r)) });
  await open(page, w);
  await expect(page.getByText("やり取りを読み込んでいます…", { exact: true })).toBeVisible();
  await expect(page.locator("section.k-f11p-card")).toHaveCount(0);
  release();
  await expect(box(page, "依頼")).toBeVisible();
});

test("K911-UI-007 読めない（503）：もう一度で口をもう 1 回呼んで出る", async ({ page }) => {
  const w = world({ once: { home: err(503, "SERVICE_UNAVAILABLE") } });
  await open(page, w);
  const retry = page.getByRole("button", { name: /もう一度/ });
  await expect(retry.first()).toBeVisible();
  await retry.first().click();
  await expect(box(page, "依頼")).toBeVisible();
  expect(count(w, "/api/v1/portal")).toBe(2);
});

test("K911-UI-008 お知らせあり：見出しの下に囲みと本文が出る", async ({ page }) => {
  await open(page, world({ notices: [NOTICE] }));
  await expect(page.getByText("メンテナンスのお知らせ", { exact: true })).toBeVisible();
  await expect(page.getByText(NOTICE.body, { exact: true })).toBeVisible();
});

test("K911-UI-009 お知らせなし・お知らせの口が 503 でもホームは出る", async ({ page }) => {
  await open(page, world());
  await expect(home(page)).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("のお知らせ");
  const w = world({ once: { notices: err(503, "SERVICE_UNAVAILABLE") } });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockWorld(page, w);
  await page.goto("/portal");
  await expect(box(page, "依頼")).toBeVisible();
});

test("K911-UI-010 ＋ 依頼を出す → /portal/requests/new", async ({ page }) => {
  await open(page, world());
  await page.getByRole("button", { name: "＋ 依頼を出す", exact: true }).click();
  await expect(page).toHaveURL(/\/portal\/requests\/new$/);
});

test("K911-UI-011 依頼の行 → /portal/requests/<id>", async ({ page }) => {
  await open(page, world());
  await box(page, "依頼")
    .getByRole("link", { name: new RegExp(REQS[0]!.title) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/portal/requests/${REQS[0]!.id}$`));
});

test("K911-UI-012 はじめて入った：ようこそ → 始める → ホーム。二度目は出ない", async ({ page }) => {
  const w = world({ first: true });
  await open(page, w);
  await expect(page.getByRole("heading", { name: /ようこそ/ })).toBeVisible();
  await page.getByRole("button", { name: "やり取りを始める", exact: true }).click();
  await expect(home(page)).toBeVisible();
  w.first = false;
  await page.reload();
  await expect(home(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: /ようこそ/ })).toHaveCount(0);
});

test("K911-UI-013 セッション切れ（401）：期限切れの形・ログインへ", async ({ page }) => {
  await open(page, world({ once: { home: err(401, "UNAUTHORIZED") } }));
  await expect(page.getByText("ログインが切れました。", { exact: true })).toBeVisible();
  await expect(page.locator("section.k-f11p-card")).toHaveCount(0);
  await page.getByRole("button", { name: "入り直す", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("K911-UI-014 社内の人（403）：見られない形で、依頼や題は出ない", async ({ page }) => {
  await open(page, world({ once: { home: err(403, "FORBIDDEN") } }));
  await expect(page.getByText("このページは見られません", { exact: true })).toBeVisible();
  const text = await page.locator("main").innerText();
  for (const s of [GROUP, REQS[0]!.title, TICKETS[0]!.title]) expect(text).not.toContain(s);
});

test("K911-UI-015 外枠：社内の Shell は無く、帯に名前・下に一文", async ({ page }) => {
  await open(page, world());
  await expect(page.locator(".k-shell")).toHaveCount(0);
  const head = page.locator(".k-f11p-head");
  await expect(head).toContainText("ENGINE BASE");
  await expect(head).toContainText(GROUP);
  await expect(head).toContainText(ME_LABEL);
  await expect(
    page.getByText("この場所で見えるのは、ENGINE BASE が見せると決めたものだけです", { exact: true }),
  ).toBeVisible();
});

test("K911-UI-016 作らない物の字が無い", async ({ page }) => {
  await open(page, world());
  const text = await page.locator("body").innerText();
  for (const s of ["確認してほしいもの", "検収", "直してほしい", "取引先", "acceptance"]) expect(text).not.toContain(s);
});

for (const width of [375, 768, 1440]) {
  test(`K911-UI-017 幅 ${width}：ホーム・空・ようこそで横のはみ出し 0`, async ({ page }) => {
    const w = world();
    await open(page, w, width);
    await expect(home(page)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    for (const o of [{ requests: [], tickets: [] }, { first: true }]) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await mockWorld(page, world(o as Partial<World>));
      await page.goto("/portal");
      await expect(page.locator("[data-portal-frame] main")).toBeVisible();
      expect(await overflowX(page)).toBeLessThanOrEqual(0);
    }
  });
}

test("K911-UI-018 幅 375：押せる物は 24px 以上", async ({ page }) => {
  await open(page, world(), 375);
  for (const loc of [
    page.getByRole("button", { name: "＋ 依頼を出す", exact: true }),
    box(page, "見せてもらったチケット").getByRole("link").first(),
  ]) {
    const b = (await loc.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(24);
    expect(b.height).toBeGreaterThanOrEqual(24);
  }
});

test("K911-UI-019 開き直すたびに口は 1 回ずつ", async ({ page }) => {
  const w = world();
  await open(page, w);
  await expect(box(page, "依頼")).toBeVisible();
  await page.reload();
  await expect(box(page, "依頼")).toBeVisible();
  expect(count(w, "/api/v1/portal")).toBe(2);
  expect(count(w, "/api/v1/portal/notices")).toBe(2);
});

test("K911-UI-020 暗い設定でもゲストの場所は明るい配色のまま（色の明暗を使わない・K-873）：帯と箱の背景が明るく、文字との比が 4.5:1 以上", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => window.localStorage.setItem("kaname.theme", "dark"));
  await open(page, world());
  await expect(home(page)).toBeVisible();
  const ratio = await page.evaluate(() => {
    const lum = (c: string) => {
      const m = c.match(/\d+(\.\d+)?/g)!.map(Number);
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(m[0]!) + 0.7152 * f(m[1]!) + 0.0722 * f(m[2]!);
    };
    const out: number[] = [];
    const bgs: number[] = [];
    for (const sel of [".k-f11p-head", ".k-f11p-card"]) {
      const el = document.querySelector(sel) as HTMLElement;
      const s = getComputedStyle(el);
      const a = lum(s.color);
      const b = lum(
        s.backgroundColor.startsWith("rgba(0, 0, 0, 0)")
          ? getComputedStyle(document.body).backgroundColor
          : s.backgroundColor,
      );
      out.push((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
      bgs.push(b);
    }
    return { ratio: Math.min(...out), bg: Math.min(...bgs) };
  });
  expect(ratio.ratio).toBeGreaterThanOrEqual(4.5);
  expect(ratio.bg, "暗い設定でも背景は明るいまま").toBeGreaterThanOrEqual(0.5);
});

test("K911-UI-022 会社の名前は口の tenant_name から出る：別の会社のゲストには別の名前（見出し・帯・下の一文に「ENGINE BASE」が出ない）", async ({
  page,
}) => {
  await open(page, world({ tenant: "株式会社ミナト" }));
  await expect(home(page, "株式会社ミナト")).toBeVisible();
  await expect(page.locator(".k-f11p-head")).toContainText("株式会社ミナト");
  await expect(
    page.getByText("この場所で見えるのは、株式会社ミナト が見せると決めたものだけです", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("ENGINE BASE");
});
