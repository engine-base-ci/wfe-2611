// K-52「メールを確かめる」の画面の試験（実 Chrome）：確認のメールのリンクを開いた画面（/verify-email?token=…）。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/verify-email.md）＝試験 1 本。名前の頭の行 ID で op_gate.py が証拠を引く。
//   口（API）は網の手前（page.route）で差し替える。口の振る舞いそのものは apps/api/test/features/F1/verify-email.test.ts が本物の DB で持つ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   確定はリンクを押した時点（D-088）：画面は開いたら自分で契約の口 POST /api/v1/auth/sign-up/verify を 1 回呼ぶ。
//   ログイン中かどうかは自分の取得（GET …/me）で見る。ログインの印はブラウザの localStorage の kaname.token。
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Page, Request, Route } from "@playwright/test";
import { expect, missingRows, row, rowsOf } from "../../_lib/row";
import { WIDTHS } from "../../_lib/api";

const SPEC = join(dirname(fileURLToPath(import.meta.url)), "../../../../../07_qa/test-specs/k/verify-email.md");
const ROWS = rowsOf(SPEC);
const R = Object.fromEntries(ROWS.map((r) => [r.id, r]));

const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const VERIFY_PATH = "/api/v1/auth/sign-up/verify";
const LINK_TOKEN = "k52_link_0123456789abcdefghijklmnopqrstuv"; // 確認のメールのリンクの手がかり（試験の値）
const NEW_TOKEN = "session-of-the-new-account";
const NEW_OLD_LINK = "E-AUTH-008"; // 足すエラー（前のリンク・K-52 が errors.json に足す・D-128.146）
const NEW_OTHER_ACC = "E-AUTH-009"; // 足すエラー（別のアカウントの登録のリンク・K-52 が errors.json に足す・D-128.146）
const MSG = {
  expired: "リンクの期限が切れました。もう一度登録してください",
  oldLink: "このリンクは使えません。新しく届いたメールのリンクを開いてください",
  done: "このメールアドレスの登録は確認まで終わっています。ログインしてください",
  otherNow:
    "登録は確定しました。いまは別のアカウントでログイン中です。新しいアカウントで使うには、ログアウトしてからログインしてください",
  otherDone: "別のアカウントの登録のリンクです",
  gone: "このリンクは使えなくなりました。期限が切れたか、もう使われています",
  down: "Kaname の調子が悪くなっています。運営が直しています。あなたの操作や PC の問題ではありません",
};

type Reply = { status: number; body: unknown };
type Handler = (req: Request) => Reply | Promise<Reply>;
interface Mock {
  /** 確定の口に届いた体 */
  verifies: Record<string, unknown>[];
  /** 確定の口に届いた頭 authorization（ログイン中かを口に伝えているか） */
  verifyAuth: (string | null)[];
  /** 呼ばれた口の道（前の道すじが呼ばれていないことを見る） */
  paths: string[];
  on: { verify: Handler; me: Handler; other: Handler };
}
const ok = (extra: Record<string, unknown> = {}): Reply => ({
  status: 201,
  body: { data: { email: "takamoto@example.com", token: NEW_TOKEN, signed_in: true, ...extra } }, // user_id は返さない（L8）
});
const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}): Reply => ({
  status,
  body: { error: "error", code, message, ...extra },
});

/** 口を網の手前で差し替える。既定はログインしていない人（自分の取得は 401）・確定は 201 */
async function mockApi(page: Page): Promise<Mock> {
  const m: Mock = {
    verifies: [],
    verifyAuth: [],
    paths: [],
    on: {
      verify: () => ok(),
      me: () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } }),
      other: () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } }),
    },
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    m.paths.push(`${req.method()} ${u.pathname}`);
    let reply: Reply;
    if (req.method() === "POST" && u.pathname === VERIFY_PATH) {
      m.verifies.push((req.postDataJSON() as Record<string, unknown> | null) ?? {});
      m.verifyAuth.push(req.headers()["authorization"] ?? null);
      reply = await m.on.verify(req);
    } else if (req.method() === "GET" && /\/me$/.test(u.pathname)) reply = await m.on.me(req);
    else reply = await m.on.other(req);
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return m;
}
/** 別の人（または同じ人）でログイン中にする */
const loggedInAs = async (page: Page, m: Mock, token: string, email: string) => {
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), token);
  m.on.me = () => ({ status: 200, body: { data: { id: `id-${token}`, email, name: "いまの人" } } });
  m.on.other = () => ({ status: 200, body: { data: [] } });
};
const storedToken = (page: Page) => page.evaluate(() => window.localStorage.getItem("kaname.token"));
const openLink = async (page: Page, width = 1440, token = LINK_TOKEN) => {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);
  expect(res?.status()).toBe(200);
};
const done = (page: Page) => page.getByRole("heading", { level: 1, name: "登録できました" });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const link = (page: Page, name: string) => page.getByRole("link", { name, exact: true });
/** 中（初めの設定・チケットの画面）へ行く抜け道が無い（D-088.4） */
const noWayIn = async (page: Page) => {
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  for (const h of hrefs) expect(h, "確認の前に中へ入る行き先").not.toMatch(/^\/(setup|tickets)/);
  await expect(button(page, "続ける")).toHaveCount(0);
};

// ---- 形 ----
row(R["K52-UI-000"], async (page) => {
  const m = await mockApi(page);
  await openLink(page);
  await expect(done(page)).toBeVisible();
  expect(await missingRows(page, ROWS), "登録できた").toEqual([]);
  m.on.verify = () => fail(410, "E-AUTH-003", MSG.expired);
  await openLink(page);
  await expect(page.getByText(MSG.expired)).toBeVisible();
  expect(await missingRows(page, ROWS), "期限切れ").toEqual([]);
  m.on.verify = () => fail(410, "E-PAGE-006", MSG.gone);
  await openLink(page);
  await expect(page.getByText(MSG.gone)).toBeVisible();
  expect(await missingRows(page, ROWS), "無い").toEqual([]);
});
row(R["K52-UI-001"], async (page) => {
  const m = await mockApi(page);
  for (const w of WIDTHS) {
    await openLink(page, w);
    await expect(done(page)).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `幅 ${w} の横溢れ`).toBe(0);
  }
  expect(m.verifies, "開くたびに 1 回（押し直させない）").toHaveLength(WIDTHS.length);
  for (const b of m.verifies) expect(b).toEqual({ token: LINK_TOKEN });
});

// ---- 確定する ----
row(R["K52-UI-002"], async (page) => {
  const m = await mockApi(page);
  await openLink(page);
  await expect(done(page)).toBeVisible();
  // 確定した後は新しいアカウントでログイン中。/tickets は本物の画面（K-60）なので、そこで読む口（自分の取得・一覧など）も通す
  m.on.me = () => ({ status: 200, body: { data: { id: "u-new", email: "takamoto@example.com", name: "高本" } } });
  m.on.other = () => ({ status: 200, body: { data: [] } });
  await button(page, "続ける").click();
  await expect(page).toHaveURL(/\/tickets/);
  expect(await storedToken(page)).toBe(NEW_TOKEN);
});
row(R["K52-UI-003"], async (page) => {
  const m = await mockApi(page); // 自分の取得は 401（切れたセッション）
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "expired-session"));
  await openLink(page);
  await expect(done(page)).toBeVisible();
  expect(m.verifies).toHaveLength(1);
  await expect.poll(() => storedToken(page)).toBe(NEW_TOKEN);
});
row(R["K52-UI-004"], async (page) => {
  const m = await mockApi(page);
  await loggedInAs(page, m, "other-session", "other@example.com");
  m.on.verify = () => ok({ token: null, signed_in: false });
  await openLink(page);
  await expect(page.getByText(MSG.otherNow)).toBeVisible();
  expect(await storedToken(page), "勝手に切り替えない").toBe("other-session");
  expect(m.verifyAuth[0], "ログイン中であることを口に伝える").toBe("Bearer other-session");
});

// ---- 使えないリンク ----
row(R["K52-UI-005"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => fail(410, "E-AUTH-003", MSG.expired);
  await openLink(page);
  await expect(page.getByText(MSG.expired)).toBeVisible();
  await expect(link(page, "もう一度登録する")).toHaveAttribute("href", /\/signup/);
  expect(await storedToken(page)).toBeNull();
});
row(R["K52-UI-006"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => fail(410, "E-AUTH-003", MSG.expired);
  await openLink(page);
  await link(page, "もう一度登録する").click();
  await expect(page).toHaveURL(/\/signup$/);
});
row(R["K52-UI-007"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => fail(410, NEW_OLD_LINK, MSG.oldLink);
  await openLink(page);
  await expect(page.getByText(MSG.oldLink)).toBeVisible();
  await expect(link(page, "もう一度登録する"), "新しいリンクは使えるので登録し直しへ誘わない").toHaveCount(0);
});
row(R["K52-UI-008"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => fail(409, "E-CONF-011", MSG.done);
  await openLink(page);
  await expect(page.getByText(MSG.done)).toBeVisible();
  await expect(link(page, "ログイン")).toHaveAttribute("href", /\/login/);
  await expect(done(page)).toHaveCount(0);
});
row(R["K52-UI-009"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => fail(409, "E-CONF-011", MSG.done);
  await openLink(page);
  await link(page, "ログイン").click();
  await expect(page).toHaveURL(/\/login/);
});
row(R["K52-UI-010"], async (page) => {
  const m = await mockApi(page);
  await openLink(page);
  await expect(done(page)).toBeVisible();
  // 確定した後：今は同じ人でログイン中。2 回目の口は確定済み（二重に作らない）
  m.on.verify = () => fail(409, "E-CONF-011", MSG.done);
  m.on.me = () => ({ status: 200, body: { data: { id: "u-new", email: "takamoto@example.com", name: "高本" } } });
  m.on.other = () => ({ status: 200, body: { data: [] } });
  await page.reload();
  await expect(page).toHaveURL(/\/tickets/);
  // 戻るで確認のリンクの画面に戻っても、確定済み・ログイン中なのでまたチケットの画面へ
  await page.goto(`/verify-email?token=${encodeURIComponent(LINK_TOKEN)}`);
  await expect(page).toHaveURL(/\/tickets/);
  expect(await storedToken(page)).toBe(NEW_TOKEN);
  await expect(done(page)).toHaveCount(0);
});
row(R["K52-UI-011"], async (page) => {
  const m = await mockApi(page);
  await loggedInAs(page, m, "other-session", "other@example.com");
  m.on.verify = () => fail(409, NEW_OTHER_ACC, MSG.otherDone);
  await openLink(page);
  await expect(page.getByText(MSG.otherDone)).toBeVisible();
  expect(await storedToken(page), "勝手に切り替えない").toBe("other-session");
  await expect(page).toHaveURL(/\/verify-email/);
});
row(R["K52-UI-012"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => fail(410, "E-PAGE-006", MSG.gone);
  await openLink(page, 1440, "old-bookmark-token");
  await expect(page.getByText(MSG.gone)).toBeVisible();
  await expect(link(page, "ログイン")).toHaveAttribute("href", /\/login/);
  await expect(link(page, "もう一度登録する")).toHaveAttribute("href", /\/signup/);
  await expect(page.getByText(/@/)).toHaveCount(0); // メールアドレスは出さない
});

// ---- 守り・失敗・揺れ ----
row(R["K52-UI-013"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => ({ status: 429, body: { error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 42 } });
  await openLink(page);
  await expect(page.getByText(/42\s*秒/)).toBeVisible();
});
row(R["K52-UI-014"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => fail(500, "E-PAGE-003", MSG.down);
  await openLink(page);
  await expect(page.getByRole("alert").filter({ hasText: MSG.down })).toBeVisible();
  await expect(done(page)).toHaveCount(0);
});
row(R["K52-UI-015"], async (page) => {
  // 閉じるのは別に開いたタブ（first）。row() が最後に証拠を撮る page は閉じずに残し、開き直した側として使う
  const first = await page.context().newPage();
  const m = await mockApi(first);
  m.on.verify = () => new Promise<Reply>(() => undefined); // 答えが返る前に閉じる
  await openLink(first);
  await expect.poll(() => m.verifies.length).toBe(1);
  await first.close();
  const m2 = await mockApi(page);
  m2.on.verify = () => fail(409, "E-CONF-011", MSG.done);
  await openLink(page);
  await expect(page.getByText(MSG.done)).toBeVisible();
  await expect(link(page, "ログイン")).toBeVisible();
  expect(m2.verifies, "開き直しても呼ぶのは 1 回").toHaveLength(1);
});
row(R["K52-UI-016"], async (page) => {
  const m = await mockApi(page);
  for (const [why, reply] of [
    ["期限切れ", fail(410, "E-AUTH-003", MSG.expired)],
    ["前のリンク", fail(410, NEW_OLD_LINK, MSG.oldLink)],
    ["無い", fail(410, "E-PAGE-006", MSG.gone)],
    ["確定済み", fail(409, "E-CONF-011", MSG.done)],
  ] as const) {
    m.on.verify = () => reply;
    await openLink(page);
    await expect(page.getByRole("heading", { level: 1 }), why).toBeVisible();
    await noWayIn(page);
  }
});
row(R["K52-UI-017"], async (page) => {
  const m = await mockApi(page);
  await openLink(page);
  await expect(done(page)).toBeVisible();
  expect(m.paths.filter((p) => p.includes("/api/auth-ext/verify-signup"))).toEqual([]);
  expect(m.paths.filter((p) => p.startsWith("POST ") && p.includes("verify"))).toEqual([`POST ${VERIFY_PATH}`]);
});
row(R["K52-UI-018"], async (page) => {
  await mockApi(page);
  await openLink(page);
  await expect(done(page)).toBeVisible();
  await expect(link(page, "困ったとき").first()).toHaveAttribute("href", /help/);
});
row(R["K52-UI-020"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => fail(410, "E-AUTH-003", MSG.expired);
  await openLink(page);
  await expect(page.getByText(MSG.expired).first()).toBeVisible();
  const foot = page.getByRole("navigation", { name: "Kaname について" });
  expect((await foot.getByRole("link").allInnerTexts()).map((x) => x.trim())).toEqual(["いまの様子", "困ったとき"]);
  const status = foot.getByRole("link", { name: "いまの様子", exact: true });
  // いまの様子は困ったとき（/help）の稼働状況へ移る（K-315 で画面ができた）
  await expect(status).toHaveAttribute("href", "/help#status");
  expect(await status.getAttribute("aria-disabled")).toBeNull();
  await status.click();
  await expect(page).toHaveURL(/\/help#status$/);
});
row(R["K52-UI-021"], async (page) => {
  await mockApi(page);
  await openLink(page);
  await expect(done(page)).toBeVisible();
  const foot = page.getByRole("navigation", { name: "Kaname について" });
  expect((await foot.getByRole("link").allInnerTexts()).map((x) => x.trim())).toEqual([
    "利用規約",
    "プライバシー",
    "困ったとき",
  ]);
  await expect(foot.getByRole("link", { name: "利用規約", exact: true })).toHaveAttribute("href", /terms/);
});
row(R["K52-UI-022"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => fail(409, "E-CONF-011", "このメールアドレスの登録は確認まで終わっています。ログインしてください");
  await openLink(page);
  await expect(page.getByRole("heading", { level: 1, name: "登録は終わっています" })).toBeVisible();
  const foot = page.getByRole("navigation", { name: "Kaname について" });
  expect((await foot.getByRole("link").allInnerTexts()).map((x) => x.trim())).toEqual([
    "利用規約",
    "プライバシー",
    "困ったとき",
  ]);
  await expect(foot.getByRole("link", { name: "プライバシー", exact: true })).toHaveAttribute("href", /privacy/);
});

// ---- 手がかりをタブに覚えるのは確定できたときだけ（K-52 の 2 回目のレビュー HIGH-3） ----
row(R["K52-UI-019"], async (page) => {
  const m = await mockApi(page);
  m.on.verify = () => fail(410, "E-AUTH-003", MSG.expired);
  // 登録の口（K-51）も網の手前で演じる（後から足した route が先に当たる）
  await page.route(/\/api\/v1\/auth\/sign-up(\/status)?(\?.*)?$/, async (route, req) => {
    const u = new URL(req.url());
    if (req.method() === "POST" && u.pathname === "/api/v1/auth/sign-up")
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            email: "again@example.com",
            sent: true,
            mail_error: null,
            expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
            signup_token: "st_k52_again_0123456789abcdefghijklmnopqrstuv",
          },
        }),
      });
    if (req.method() === "GET" && u.pathname === "/api/v1/auth/sign-up/status")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            state: "pending",
            email: "again@example.com",
            expires_at: new Date(Date.now() + 29 * 60_000).toISOString(),
          },
        }),
      });
    return route.fallback();
  });
  await openLink(page);
  await expect(page.getByText(MSG.expired)).toBeVisible();
  await link(page, "もう一度登録する").click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByLabel("メール", { exact: true }).fill("again@example.com");
  await page.getByLabel("名前", { exact: true }).fill("高本 聖斗");
  await page.getByLabel("会社・チームの名前", { exact: true }).fill("株式会社テスト");
  await page.getByLabel("パスワード", { exact: true }).fill("correct-horse-battery-1");
  await page.getByRole("button", { name: "次へ（メールを確かめる）" }).click();
  // 期限切れのリンクの手がかりをタブに覚えていると、ここで確定の口をもう一度呼んで「期限が切れました」に戻ってしまう
  await expect(page.getByRole("heading", { level: 1, name: "確認メールを送りました" })).toBeVisible();
  expect(m.verifies, "確定の口は最初の 1 回だけ（覚えた手がかりで呼び直さない）").toHaveLength(1);
  expect(
    await page.evaluate(() => JSON.stringify(Object.keys(window.sessionStorage))),
    "期限切れの手がかりはタブに残さない",
  ).not.toMatch(/verify|token/i);
});
