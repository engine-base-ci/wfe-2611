// K-315「困ったとき（ログインしていない人・/help）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f1/help-n・help-incident・help-unknown（本番と同じ部品 features/F1/help/help-view.tsx の HelpView）。
//   画面の形（実装の役が作る）：app/(outside)/help/page.tsx が設定の運営の宛先（legalValues().operator.email）を渡し、
//     features/F1/help/help-screen.tsx が getServiceStatus（GET /api/v1/auth/service-status・誰でも読める）を 1 回読んで HelpView に渡す。
//     答えの読み替えは features/F1/service-status/to-incidents.ts（日本時間）。入口の枠の「困ったとき」は /help、期限切れの足元の「いまの様子」は /help#status。
//   稼働状況のメンテナンスは、メンテナンス中（ongoing）だけ出す。予定は出さない（代表の答え answer=88f98638a534）。HelpView の status は 一覧・null（読めない）・"loading"（読み込み中）。
//   モックとの見た目の比べ方は共通の道具 stage2-match.ts の matchMock だけ（精査の後の決め 11）。
//   口は網の手前で差し替える。本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { AUTH_PAIRS, MATCH_WIDTHS, matchMock, type MatchOptions } from "./stage2-match";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const BOX = '[data-part="auth-box"]';
const STATUS_SEC = 'section[aria-labelledby="help-status"]';
const OPS = process.env["OPS_EMAIL"] || "info@engine-base.com";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const LINK_TOKEN = "vt_k315_0123456789abcdefghijklmnopqrstuvwxyz";
const FAIL = "いまは稼働状況を読めません。少したってから開き直してください";

// ブラウザの時間帯は日本でない所にする（日本時間で書いているかを見る）
test.use({ timezoneId: "UTC" });

type Status =
  | {
      kind: "ok";
      incidents?: { state: string; title: string; started_at: string }[];
      maintenance?: { title: string; from: string; to: string; ongoing: boolean } | null;
    }
  | { kind: "fail"; status: number }
  | { kind: "abort" }
  | { kind: "hold" };
interface Mock {
  statusCalls: number;
  /** hold のとき、これを呼ぶと止めていた答え（ふつう）を返す */
  release: () => void;
}
const INCIDENT = { state: "investigating", title: "分身の実行が遅れています", started_at: "2026-11-18T01:20:00Z" };
/** いまメンテナンス中（日本の 11/18 2:00〜11/20 3:00） */
const MAINT = { title: "メンテナンス", from: "2026-11-17T17:00:00Z", to: "2026-11-19T18:00:00Z", ongoing: true };
/** これからのメンテナンス（予定）。出さない */
const PLANNED = { title: "メンテナンス", from: "2026-11-25T17:00:00Z", to: "2026-11-25T18:00:00Z", ongoing: false };

async function mockApi(page: Page, status: Status = { kind: "ok" }, verify: "expired" | null = null): Promise<Mock> {
  let go: (() => void) | null = null;
  const held = new Promise<void>((resolve) => {
    go = resolve;
  });
  const m: Mock = { statusCalls: 0, release: () => go?.() };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (req.method() === "GET" && p === "/api/v1/auth/service-status") {
      m.statusCalls += 1;
      if (status.kind === "hold") {
        await held;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { incidents: [], maintenance: null } }),
        });
      }
      if (status.kind === "abort") return route.abort("internetdisconnected");
      if (status.kind === "fail")
        return route.fulfill({
          status: status.status,
          contentType: "application/json",
          body: JSON.stringify({ error: "x", code: status.status === 401 ? "UNAUTHENTICATED" : "E-PAGE-003" }),
        });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { incidents: status.incidents ?? [], maintenance: status.maintenance ?? null } }),
      });
    }
    if (verify === "expired" && req.method() === "POST" && p === "/api/v1/auth/sign-up/verify")
      return route.fulfill({
        status: 410,
        contentType: "application/json",
        body: JSON.stringify({ code: "E-AUTH-003", message: "リンクの期限が切れました。もう一度登録してください" }),
      });
    if (req.method() === "GET" && p === "/api/v1/auth/terms/current")
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) });
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "unauthenticated", code: "UNAUTHENTICATED" }),
    });
  });
  return m;
}
async function openHelp(page: Page, width = 1440, hash = "") {
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto(`/help${hash}`);
  expect(res?.status()).toBe(200);
  await expect(page.locator(`${BOX} h1`)).toHaveText("困ったとき");
}
const card = (page: Page, name: string) => page.locator(`${BOX} .k-auth-choice`, { hasText: name });
async function freeze(page: Page) {
  await page.clock.install({ time: new Date("2026-11-18T03:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-18T03:00:01Z"));
}

// ---------------------------------------------------------------- モックと本番の突き合わせ（共通の道具 matchMock・決め 11）
//   入口の箱の役（AUTH_PAIRS）に、困ったときの区画の役を足して opts.pairs で渡す（K-316 に頼む・K-318 の申し送り）。
//   渡した役で比べたことを返った行の役の名で確かめる（道具が pairs を読まないと赤で分かる）
const HELP_EXTRA: FidelityPair[] = (
  [
    ["help-back", `${BOX} .k-login-back`, ["x", "y", "font-size", "color", "texts"]],
    ["help-h2", `${BOX} .k-help-sec h2`, ["x", "y", "font-size", "font-weight", "color", "texts"]],
    ["help-row", `${BOX} .k-help-row`, ["width", "height", "x", "y", "padding-top", "border-top-color", "texts"]],
    ["help-pill", `${BOX} .k-set-pill`, ["height", "font-size", "color", "background-color", "texts"]],
    ["help-mail", `${BOX} a[href^="mailto:"]`, ["x", "y", "font-size", "color"]],
  ] as const
).map(([name, sel, props]) => ({ name, role: name, canvas: sel, app: sel, props: [...props] }));
type PairsOptions = MatchOptions & { pairs: FidelityPair[] };

// ---------------------------------------------------------------- 行

test("K315-UI-001 ログインしていない人が /help を開く：入口の枠・h1「困ったとき」・戻る・区画 3 つ・困りごとの札 4 つ・足元 3 つ", async ({
  page,
}) => {
  await mockApi(page);
  await openHelp(page);
  await expect(page.locator(".k-shell, [data-shell]")).toHaveCount(0);
  await expect(page.locator(`${BOX} .k-login-back`)).toHaveText("← ログインに戻る");
  expect((await page.locator(`${BOX} h2`).allInnerTexts()).map((x) => x.trim())).toEqual([
    "よくある困りごと",
    "いまの稼働状況",
    "運営に聞く",
  ]);
  for (const name of [
    "パスワードを忘れた",
    "パスキーの端末や認証アプリをなくした",
    "確認のメールが届かない",
    "ログインできない（ロックされた）",
  ])
    await expect(card(page, name)).toHaveCount(1);
  const foot = page.getByRole("navigation", { name: "Kaname について" });
  expect((await foot.getByRole("link").allInnerTexts()).map((x) => x.trim())).toEqual([
    "利用規約",
    "プライバシー",
    "困ったとき",
  ]);
});

test("K315-UI-002 札「パスワードを忘れた」「ログインできない（ロックされた）」を押すと /password-reset へ移る", async ({
  page,
}) => {
  await mockApi(page);
  for (const name of ["パスワードを忘れた", "ログインできない（ロックされた）"]) {
    await openHelp(page);
    await card(page, name).click();
    await expect(page).toHaveURL(/\/password-reset$/);
  }
});

test("K315-UI-003 札「パスキーの端末や認証アプリをなくした」を押すと /login?step=recover へ移る", async ({ page }) => {
  await mockApi(page);
  await openHelp(page);
  await card(page, "パスキーの端末や認証アプリをなくした").click();
  await expect(page).toHaveURL(/\/login\?step=recover$/);
});

test("K315-UI-004 札「確認のメールが届かない」は /signup、「← ログインに戻る」は /login へ移る", async ({ page }) => {
  await mockApi(page);
  await openHelp(page);
  await card(page, "確認のメールが届かない").click();
  await expect(page).toHaveURL(/\/signup$/);
  await openHelp(page);
  await page.locator(`${BOX} .k-login-back`).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("K315-UI-005 稼働状況がふつう：口は 1 回・「Kaname」と札「ふつう」・障害の行は無い", async ({ page }) => {
  const m = await mockApi(page, { kind: "ok" });
  await openHelp(page);
  const sec = page.locator(STATUS_SEC);
  await expect(sec.locator(".k-help-row")).toHaveCount(1);
  await expect(sec.locator(".k-help-row")).toContainText("Kaname");
  await expect(sec.locator(".k-set-pill")).toHaveText("ふつう");
  await expect(sec.locator(".k-set-pill")).toHaveAttribute("data-tone", "success");
  expect(m.statusCalls).toBe(1);
});

test("K315-UI-006 障害とメンテナンス中：日本時間で「11/18 10:20 から」と「メンテナンス中です。この間は使えません」「11/20 3:00 まで」・札「障害」「メンテナンス」。予定のメンテナンスは出さない", async ({
  page,
}) => {
  await mockApi(page, { kind: "ok", incidents: [INCIDENT], maintenance: MAINT });
  await openHelp(page);
  const rows = page.locator(`${STATUS_SEC} .k-help-row`);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("分身の実行が遅れています");
  await expect(rows.nth(0)).toContainText("11/18 10:20 から");
  await expect(rows.nth(0).locator(".k-set-pill")).toHaveText("障害");
  await expect(rows.nth(1)).toContainText("メンテナンス中です。この間は使えません");
  await expect(rows.nth(1)).toContainText("11/20 3:00 まで");
  await expect(rows.nth(1).locator(".k-set-pill")).toHaveText("メンテナンス");
  for (const i of [0, 1]) await expect(rows.nth(i).locator(".k-set-pill")).toHaveAttribute("data-tone", "warning");

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockApi(page, { kind: "ok", maintenance: PLANNED });
  await openHelp(page);
  await expect(page.locator(`${STATUS_SEC} .k-help-row`)).toHaveCount(1);
  await expect(page.locator(`${STATUS_SEC} .k-set-pill`)).toHaveText("ふつう");
  await expect(page.locator(STATUS_SEC).getByText("メンテナンス")).toHaveCount(0);
});

test("K315-UI-007 稼働状況の口が 500・網が切れる：その区画だけ読めないと出し、ほかは出たまま。「ふつう」は出ない", async ({
  page,
}) => {
  for (const st of [{ kind: "fail", status: 500 } as const, { kind: "abort" } as const]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockApi(page, st);
    await openHelp(page);
    await expect(page.locator(STATUS_SEC)).toContainText(FAIL);
    await expect(page.locator(STATUS_SEC).getByText("ふつう")).toHaveCount(0);
    await expect(page.locator(`${BOX} .k-auth-choice`)).toHaveCount(4);
    await expect(page.locator('section[aria-labelledby="help-ask"]')).toContainText(OPS);
  }
});

test("K315-UI-008 稼働状況の答えを待つ間：区画は読み込み中の形で、2.9 秒では文も「ふつう」も「読めません」も無く、3 秒を過ぎて「読み込んでいます…」・答えが来ると「ふつう」", async ({
  page,
}) => {
  const m = await mockApi(page, { kind: "hold" });
  await freeze(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const statusReq = page.waitForRequest((r) => r.url().includes("/api/v1/auth/service-status"));
  await page.goto("/help");
  await statusReq;
  await expect(page.locator(`${BOX} h1`)).toHaveText("困ったとき");
  await page.clock.runFor(2_900);
  const sec = page.locator(STATUS_SEC);
  await expect(sec.getByText("読み込んでいます…")).toHaveCount(0);
  await expect(sec.getByText("ふつう")).toHaveCount(0);
  await expect(sec.getByText(FAIL)).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(sec.locator('[role="status"]')).toContainText("読み込んでいます…");
  m.release();
  await expect(sec.locator(".k-set-pill")).toHaveText("ふつう");
  await expect(sec.getByText("読み込んでいます…")).toHaveCount(0);
});

test("K315-UI-009 稼働状況の口が 401：ログインへ移らず /help のまま・区画は読めないと出す", async ({ page }) => {
  await mockApi(page, { kind: "fail", status: 401 });
  await openHelp(page);
  await expect(page.locator(STATUS_SEC)).toContainText(FAIL);
  await expect(page).toHaveURL(/\/help$/);
});

test("K315-UI-010 運営に聞く：mailto の宛先は設定の運営の宛先・字も宛先・コードを書かない注", async ({ page }) => {
  await mockApi(page);
  await openHelp(page);
  const ask = page.locator('section[aria-labelledby="help-ask"]');
  const mail = ask.getByRole("link", { name: OPS });
  await expect(mail).toHaveAttribute("href", `mailto:${OPS}`);
  await expect(ask).toContainText("パスワードやコードは書かないでください");
});

test("K315-UI-011 /help#status を開くと、区画「いまの稼働状況」（id=status）の上の端が画面の中に来る", async ({
  page,
}) => {
  await mockApi(page);
  await openHelp(page, 375, "#status");
  await expect(page.locator("#status")).toHaveAttribute("aria-labelledby", "help-status");
  const top = await page.locator("#status").evaluate((e) => e.getBoundingClientRect().top);
  const h = await page.evaluate(() => window.innerHeight);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(h);
});

test("K315-UI-012 登録の画面の足元の「困ったとき」は /help を指し、押すと /help が開く", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/signup");
  const help = page
    .getByRole("navigation", { name: "Kaname について" })
    .getByRole("link", { name: "困ったとき", exact: true });
  await expect(help).toHaveAttribute("href", "/help");
  await help.click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.locator(`${BOX} h1`)).toHaveText("困ったとき");
});

test("K315-UI-013 確認のリンクの期限切れの足元の「いまの様子」は /help#status を指し、押せて、押すと /help#status", async ({
  page,
}) => {
  await mockApi(page, { kind: "ok" }, "expired");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/verify-email?token=${encodeURIComponent(LINK_TOKEN)}`);
  await expect(page.getByText("リンクの期限が切れました").first()).toBeVisible();
  const status = page
    .getByRole("navigation", { name: "Kaname について" })
    .getByRole("link", { name: "いまの様子", exact: true });
  await expect(status).toHaveAttribute("href", "/help#status");
  expect(await status.getAttribute("aria-disabled")).toBeNull();
  await status.click();
  await expect(page).toHaveURL(/\/help#status$/);
  await expect(page.locator(`${BOX} h1`)).toHaveText("困ったとき");
});

test("K315-UI-014 ログイン中の人が /help を開いても、ログインや外枠へ移さず同じ困ったとき（入口の枠）を出す", async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "tok-k315"));
  await openHelp(page);
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.locator(`${BOX} .k-auth-choice`)).toHaveCount(4);
  await expect(page.locator(".k-shell")).toHaveCount(0);
  await expect(page.locator('[aria-label="自分の設定の中"]')).toHaveCount(0);
});

test("K315-UI-015 キーボードだけ：戻る → 札 4 つ → 運営のメール → 足元の順に焦点が移り、焦点の輪が見える", async ({
  page,
}) => {
  await mockApi(page);
  await openHelp(page);
  await page.locator("body").focus();
  const seen: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      // 最後の要素の後は焦点が頁の外（ブラウザの側）へ出て body になる。頁の中の要素だけを数える
      if (!a || a === document.body) return null;
      const cs = getComputedStyle(a);
      return {
        text: (a.innerText ?? "").trim().split("\n")[0] ?? "",
        ring: cs.outlineStyle !== "none" || cs.boxShadow !== "none",
      };
    });
    if (!f || !f.text) continue;
    expect(f.ring, `焦点の輪が見えない：${f.text}`).toBe(true);
    seen.push(f.text);
  }
  const order = [
    "← ログインに戻る",
    "パスワードを忘れた",
    "パスキーの端末や認証アプリをなくした",
    "確認のメールが届かない",
    "ログインできない（ロックされた）",
    OPS,
    "利用規約",
  ];
  let at = -1;
  for (const want of order) {
    const i = seen.findIndex((s, k) => k > at && s.startsWith(want));
    expect(i, `${want} に焦点が来ない（来た順：${seen.join(" → ")}）`).toBeGreaterThan(at);
    at = i;
  }
});

const HELP_PROD: Record<string, Status> = {
  "help-n": { kind: "ok" },
  "help-incident": { kind: "ok", incidents: [INCIDENT], maintenance: MAINT },
  "help-unknown": { kind: "fail", status: 500 },
};
for (const [id, st] of Object.entries(HELP_PROD)) {
  for (const w of MATCH_WIDTHS) {
    test(`K315-UI-016 ${id} 幅 ${w}：入口の箱・見出し・戻る・区画の見出し・札・稼働状況の行と札・注の箱・メールの値がモックと同じ（共通の道具 matchMock）`, async ({
      browser,
    }) => {
      const opts: PairsOptions = { pairs: [...AUTH_PAIRS, ...HELP_EXTRA] };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockApi(page, st);
          await openHelp(page, w);
          if (st.kind === "fail") await expect(page.locator(STATUS_SEC)).toContainText(FAIL);
          else await expect(page.locator(`${STATUS_SEC} .k-help-row`).first()).toBeVisible();
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "困ったときの役で比べた").toContain("help-h2");
      expect(bad).toEqual([]);
    });
  }
}

test("K315-UI-017 幅 320〜1440（ふつう・障害とメンテナンス）：横溢れ 0・h1 の 1 文字目が画面の中", async ({ page }) => {
  for (const st of [{ kind: "ok" } as Status, { kind: "ok", incidents: [INCIDENT], maintenance: MAINT } as Status]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockApi(page, st);
    for (const w of WIDTHS) {
      await openHelp(page, w);
      await expect(page.locator(`${STATUS_SEC} .k-help-row`).first()).toBeVisible();
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(over, `幅 ${w} の横溢れ`).toBe(0);
      const x = await page.locator(`${BOX} h1`).evaluate((e) => {
        const r = document.createRange();
        r.setStart(e.firstChild ?? e, 0);
        r.setEnd(e.firstChild ?? e, 1);
        return r.getBoundingClientRect().left;
      });
      expect(x, `幅 ${w} の h1 の 1 文字目`).toBeGreaterThanOrEqual(0);
    }
  }
});

test("K315-UI-018 流れの照らし合わせ：画面 help と行為 A135 が flow.json・flows.json にあり、flow_gate・flow_db_gate・trace_gate が通り、built-routes に /help", async () => {
  const flow = JSON.parse(readFileSync(join(ROOT, "05_flow/flow.json"), "utf8")) as {
    screens: { id: string; route?: string; needs_login?: boolean; acts: string[]; purpose?: string }[];
    act_to_screen: Record<string, string[]>;
    blueprint: Record<string, unknown>;
    backbone: { acts: { id: string; source?: string[] }[] }[];
  };
  const help = flow.screens.find((s) => s.id === "help");
  expect(help, "画面 help").toBeDefined();
  expect(help!.route).toBe("/help");
  expect(help!.needs_login).toBe(false);
  expect(help!.acts).toEqual(["A135"]);
  expect((help!.purpose ?? "").length).toBeGreaterThanOrEqual(15);
  expect(flow.act_to_screen["A135"]).toEqual(["help"]);
  expect(flow.blueprint["A135"]).toBeDefined();
  const act = flow.backbone.flatMap((p) => p.acts).find((a) => a.id === "A135");
  expect(act?.source?.length ?? 0).toBeGreaterThan(0);
  const flows = JSON.parse(readFileSync(join(ROOT, "05_flow/flows.json"), "utf8")) as {
    flows: { id: string; acts: string[] }[];
  };
  expect(flows.flows.find((f) => f.id === "F1")?.acts).toContain("A135");
  const run = (args: string[]) => execFileSync("python3", args, { cwd: ROOT, encoding: "utf8" });
  run(["scripts/ci/flow_gate.py", "--flow", "05_flow/flow.json", "--choke", "03_architecture/choke-points.json"]);
  run(["scripts/ci/flow_db_gate.py"]);
  run(["scripts/ci/trace_gate.py"]);
  expect(readFileSync(join(WEB, "lib/built-routes.ts"), "utf8")).toContain('"/help"');
});

test("K315-UI-019 入口の枠の行き先：pendingRoute の /help が無く、登録・ログイン・期限切れの足元の「困ったとき」がどれも /help", async ({
  page,
}) => {
  const frame = readFileSync(join(WEB, "features/F1/sign-up/frame.tsx"), "utf8");
  expect(frame).not.toContain('pendingRoute("/help"');
  await mockApi(page, { kind: "ok" }, "expired");
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ["/signup", "/login", `/verify-email?token=${encodeURIComponent(LINK_TOKEN)}`]) {
    await page.goto(path);
    const help = page
      .getByRole("navigation", { name: "Kaname について" })
      .getByRole("link", { name: "困ったとき", exact: true });
    await expect(help, path).toHaveAttribute("href", "/help");
  }
});

test("K315-UI-020 ブラウザが UTC でも、日本の 0 時台に始まった障害は「11/18 0:05 から」（日本の日付と時刻）", async ({
  page,
}) => {
  await mockApi(page, {
    kind: "ok",
    incidents: [{ state: "investigating", title: "ログインが遅れています", started_at: "2026-11-17T15:05:00Z" }],
  });
  await openHelp(page);
  const row = page.locator(`${STATUS_SEC} .k-help-row`).first();
  await expect(row).toContainText("ログインが遅れています");
  await expect(row).toContainText("11/18 0:05 から");
});
