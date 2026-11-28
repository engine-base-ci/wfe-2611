// K-51「登録する」の画面の試験（実 Chrome）：登録の画面（/signup）と、手がかりの無い待つ画面（/verify-email）。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/sign-up.md）＝試験 1 本。名前の頭の行 ID で op_gate.py が証拠を引く。
//   口（API）は網の手前（page.route）で差し替える。口の振る舞いそのものは apps/api/test/features/F1/sign-up.test.ts が本物の DB で持つ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   待つ画面の状態と送り直しは、登録の答えで受け取った申し込みの印（data.signup_token）を頭 x-signup-token に載せて引く。
//   メールでは引かない（D-128.142）。確定は確認のメールのリンクで、待つ画面に 6 けたのコードの欄は無い。
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Page, Request, Route } from "@playwright/test";
import { expect, missingRows, row, rowsOf } from "../../_lib/row";
import { WIDTHS, pwToggle } from "../../_lib/api";

const SPEC = join(dirname(fileURLToPath(import.meta.url)), "../../../../../07_qa/test-specs/k/sign-up.md");
const ROWS = rowsOf(SPEC);
const R = Object.fromEntries(ROWS.map((r) => [r.id, r]));

const EMAIL = "takamoto@example.com";
const PW = "correct-horse-battery-1";
const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const SIGNUP_TOKEN = "st_k51_0123456789abcdefghijklmnopqrstuvwxyz"; // 口が返す申し込みの印（試験の値）
const SIGNUP_TOKEN_HEADER = "x-signup-token";

type Reply = { status: number; body: unknown };
type Handler = (req: Request) => Reply | Promise<Reply>;
interface Mock {
  /** 登録の口（POST /api/v1/auth/sign-up）に届いた要求の中身 */
  creates: Record<string, unknown>[];
  resends: Record<string, unknown>[];
  /** 送り直しの口に届いた申し込みの印（頭 x-signup-token） */
  resendTokens: (string | null)[];
  /** 状態の口に届いた要求の query（メールが載っていないことを見る） */
  statuses: string[];
  /** 状態の口に届いた申し込みの印（頭 x-signup-token） */
  statusTokens: (string | null)[];
  on: { create: Handler; resend: Handler; status: Handler; other: Handler };
}
const expiresIn = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
const created = (email = EMAIL, extra: Record<string, unknown> = {}): Reply => ({
  status: 201,
  body: {
    data: { email, sent: true, mail_error: null, expires_at: expiresIn(30), signup_token: SIGNUP_TOKEN, ...extra },
  },
});

/** 口を網の手前で差し替える。既定はログインしていない人・申し込みは pending */
async function mockApi(page: Page): Promise<Mock> {
  const m: Mock = {
    creates: [],
    resends: [],
    resendTokens: [],
    statuses: [],
    statusTokens: [],
    on: {
      create: (req) => created(String((req.postDataJSON() as { email?: string }).email ?? EMAIL)),
      resend: () => ({ status: 201, body: { data: { email: EMAIL, sent: true, mail_error: null, pending: true } } }),
      status: () => ({ status: 200, body: { data: { state: "pending", email: EMAIL, expires_at: expiresIn(29) } } }),
      other: () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } }),
    },
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    let reply: Reply;
    if (req.method() === "POST" && u.pathname === "/api/v1/auth/sign-up") {
      m.creates.push(req.postDataJSON() as Record<string, unknown>);
      reply = await m.on.create(req);
    } else if (req.method() === "POST" && u.pathname === "/api/v1/auth/sign-up/resend") {
      m.resends.push((req.postDataJSON() as Record<string, unknown> | null) ?? {});
      m.resendTokens.push(req.headers()[SIGNUP_TOKEN_HEADER] ?? null);
      reply = await m.on.resend(req);
    } else if (req.method() === "GET" && u.pathname === "/api/v1/auth/sign-up/status") {
      m.statuses.push(u.search);
      m.statusTokens.push(req.headers()[SIGNUP_TOKEN_HEADER] ?? null);
      reply = await m.on.status(req);
    } else reply = await m.on.other(req);
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return m;
}

const open = async (page: Page, width = 1440) => {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto("/signup");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "アカウントを作る" })).toBeVisible();
  await expect(page.getByLabel("名前", { exact: true }), "K-51 の新しい登録の画面（名前の欄がある）").toBeVisible();
};
const field = (page: Page, label: "メール" | "名前" | "会社・チームの名前" | "パスワード") =>
  page.getByLabel(label, { exact: true });
const next = (page: Page) => page.getByRole("button", { name: "次へ（メールを確かめる）" });
const fill = async (page: Page, v: Partial<Record<"email" | "name" | "company" | "password", string>> = {}) => {
  await field(page, "メール").fill(v.email ?? EMAIL);
  await field(page, "名前").fill(v.name ?? "高本 聖斗");
  await field(page, "会社・チームの名前").fill(v.company ?? "株式会社テスト");
  await field(page, "パスワード").fill(v.password ?? PW);
};
/** 欄の下の理由（欄の aria-describedby が指す文に出る） */
const reasonOf = async (page: Page, label: Parameters<typeof field>[1]) => {
  const ids = (await field(page, label).getAttribute("aria-describedby")) ?? "";
  const texts = await Promise.all(
    ids
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => page.locator(`[id="${id}"]`).innerText()),
  );
  return texts.join(" ");
};
/** 待つ画面の見出し（D-128.142）。送れなかったときはこの見出しを出さない（K51-UI-016） */
const waiting = (page: Page) => page.getByRole("heading", { level: 1, name: "確認メールを送りました" });
const submitToWaiting = async (page: Page, { sent = true } = {}) => {
  await open(page);
  await fill(page);
  await next(page).click();
  await expect(page).toHaveURL(/\/verify-email(?![^#]*token=)/);
  if (sent) await expect(waiting(page)).toBeVisible();
};
/** 状態・送り直しの口は、申し込みの印で引かれ、メールでは引かれていない */
const expectLookedUpByToken = (m: Mock) => {
  for (const q of m.statuses) expect(q, "状態の口の query にメールを載せない").not.toMatch(/email=|%40|@/);
  for (const t of [...m.statusTokens, ...m.resendTokens])
    expect(t, "頭 x-signup-token に申し込みの印").toBe(SIGNUP_TOKEN);
  for (const b of m.resends) expect(b, "送り直しの本文にメールを載せない").not.toHaveProperty("email");
};

// ---- 登録の画面の形 ----
row(R["K51-UI-000"], async (page) => {
  await mockApi(page);
  await open(page);
  expect(await missingRows(page, ROWS)).toEqual([]);
});
row(R["K51-UI-001"], async (page) => {
  await mockApi(page);
  for (const w of WIDTHS) {
    await open(page, w);
    for (const l of ["メール", "名前", "会社・チームの名前", "パスワード"] as const)
      await expect(field(page, l)).toBeVisible();
    await expect(page.getByText(/続けると\s*利用規約\s*と\s*プライバシー\s*に同意したことになる/)).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `幅 ${w} の横溢れ`).toBe(0);
  }
});

// ---- 送る ----
row(R["K51-UI-002"], async (page) => {
  const m = await mockApi(page);
  await submitToWaiting(page);
  expect(m.creates).toHaveLength(1);
  expect(m.creates[0]).toMatchObject({ email: EMAIL, name: "高本 聖斗", company_name: "株式会社テスト", password: PW });
  await expect(page.getByText(EMAIL)).toBeVisible();
  await expect(page.getByText(/30\s*分以内に.*リンクを押/)).toBeVisible();
  // 確定はメールのリンク。6 けたのコードを入れる欄は無い（D-128.142）
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByLabel(/コード/)).toHaveCount(0);
  expectLookedUpByToken(m);
});
row(R["K51-UI-003"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fill(page, { email: "abc@" });
  await next(page).click();
  await expect.poll(() => reasonOf(page, "メール")).toContain("メールアドレスの形式が違います");
  await expect(page).toHaveURL(/\/signup$/);
  expect(m.creates).toHaveLength(0);
});
row(R["K51-UI-004"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fill(page, { name: "" });
  await next(page).click();
  await expect(field(page, "名前")).toHaveAttribute("aria-invalid", "true");
  await expect.poll(() => reasonOf(page, "名前")).toContain("名前を入れてください"); // E-VAL-010
  expect(m.creates).toHaveLength(0);
});
row(R["K51-UI-005"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fill(page, { password: "abcdefgh123" });
  await next(page).click();
  await expect.poll(() => reasonOf(page, "パスワード")).toContain("パスワードは 12 文字以上にしてください");
  expect(m.creates).toHaveLength(0);
});
row(R["K51-UI-006"], async (page) => {
  const m = await mockApi(page);
  m.on.create = () => ({
    status: 422,
    body: {
      error: "validation",
      code: "E-VAL-011",
      message: "漏れたことのあるパスワードです。別のパスワードにしてください",
      details: [{ field: "password", message: "漏れたことのあるパスワードです。別のパスワードにしてください" }],
    },
  });
  await open(page);
  await fill(page);
  await next(page).click();
  await expect
    .poll(() => reasonOf(page, "パスワード"))
    .toContain("漏れたことのあるパスワードです。別のパスワードにしてください");
  await expect(page).toHaveURL(/\/signup$/);
});
row(R["K51-UI-007"], async (page) => {
  await mockApi(page);
  await open(page);
  await field(page, "パスワード").fill(PW);
  await pwToggle(page, "パスワード");
});
row(R["K51-UI-008"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await expect(page.getByText(/空なら、あなたの名前で個人のワークスペースになる/)).toBeVisible();
  await fill(page, { company: "" });
  await next(page).click();
  await expect(waiting(page)).toBeVisible();
  expect(m.creates).toHaveLength(1);
  expect(m.creates[0]!["company_name"] ?? "").toBe("");
});

// ---- 行き先 ----
const consentLink = async (page: Page, name: string, re: RegExp) => {
  await mockApi(page);
  await open(page);
  const l = page.getByText(/続けると/).getByRole("link", { name, exact: true });
  await expect(l).toHaveAttribute("href", re);
  await expect(l).toHaveAttribute("target", "_blank");
};
row(R["K51-UI-009"], (page) => consentLink(page, "利用規約", /terms/));
row(R["K51-UI-010"], (page) => consentLink(page, "プライバシー", /privacy/));
row(R["K51-UI-011"], async (page) => {
  await mockApi(page);
  await open(page);
  await page.getByRole("link", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
row(R["K51-UI-012"], async (page) => {
  await mockApi(page);
  await open(page);
  await expect(page.getByRole("link", { name: "困ったとき", exact: true }).first()).toHaveAttribute("href", /help/);
});

// ---- 利用者の状態 ----
row(R["K51-UI-013"], async (page) => {
  const m = await mockApi(page);
  m.on.other = () => ({ status: 200, body: { data: { id: "u1", email: "now@example.com", name: "いまの人" } } });
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "valid-session"));
  await page.goto("/signup");
  await expect(page).toHaveURL(/\/tickets/);
  expect(m.creates).toHaveLength(0);
});
row(R["K51-UI-014"], async (page) => {
  await mockApi(page); // 既定：口は 401（切れたセッション）
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "expired-session"));
  await open(page);
  await expect(field(page, "メール")).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});
row(R["K51-UI-015"], async (page) => {
  const m = await mockApi(page);
  m.on.create = () => ({
    status: 409,
    body: {
      error: "conflict",
      code: "E-CONF-001",
      message: "このメールアドレスは既に登録されています。ログインするか、パスワードを再設定してください",
    },
  });
  await open(page);
  await fill(page);
  await next(page).click();
  await expect(page.getByText("既に登録されています。ログインするか、パスワードを再設定してください")).toBeVisible();
  await expect(page.getByRole("link", { name: "パスワードの再設定" })).toHaveAttribute("href", /\/password-reset/);
  await expect(page.getByRole("link", { name: "ログイン" }).first()).toHaveAttribute("href", /\/login/);
  await expect(page).toHaveURL(/\/signup$/);
});

// ---- 待つ画面 ----
row(R["K51-UI-016"], async (page) => {
  const m = await mockApi(page);
  m.on.create = () => created(EMAIL, { sent: false, mail_error: "daily quota exceeded", mail_error_kind: "provider" });
  await submitToWaiting(page, { sent: false });
  await expect(page.getByText(/送りました/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "送り直す" })).toBeVisible();
  await page.getByRole("button", { name: "送り直す" }).click();
  await expect.poll(() => m.resends.length).toBe(1);
  expectLookedUpByToken(m);
});
row(R["K51-UI-017"], async (page) => {
  const m = await mockApi(page);
  await submitToWaiting(page);
  await page.reload();
  await expect(waiting(page)).toBeVisible();
  await page.goBack();
  await page.goForward();
  await expect(waiting(page)).toBeVisible();
  await page.getByRole("button", { name: "送り直す" }).click();
  await expect.poll(() => m.resends.length).toBe(1);
  expect(m.creates).toHaveLength(1); // 登録の口は最初の 1 回だけ（二重にならない）
  expect(m.statuses.length, "再読み込みで状態の口を引く").toBeGreaterThan(0);
  expectLookedUpByToken(m); // 再読み込みの後も、印で引く（メールでは引かない）
});
row(R["K51-UI-018"], async (page) => {
  await page.clock.install();
  const m = await mockApi(page);
  await submitToWaiting(page);
  await page.clock.fastForward("31:00");
  m.on.status = () => ({ status: 200, body: { data: { state: "expired", email: EMAIL, expires_at: expiresIn(-1) } } });
  await page.reload();
  await expect(page.getByText("期限が切れました。もう一度登録してください")).toBeVisible();
  expectLookedUpByToken(m);
  await expect(page.getByRole("link", { name: /登録/ }).first()).toHaveAttribute("href", /\/signup/);
});
row(R["K51-UI-019"], async (page) => {
  const m = await mockApi(page);
  await submitToWaiting(page);
  m.on.status = () => ({ status: 200, body: { data: { state: "registered", email: EMAIL, expires_at: null } } });
  await page.reload();
  await expect(page.getByText(/登録は確認まで終わっています/)).toBeVisible();
  expectLookedUpByToken(m);
  await expect(page.getByRole("link", { name: /ログイン/ }).first()).toHaveAttribute("href", /\/login/);
});

// ---- 操作の揺れ ----
row(R["K51-UI-020"], async (page) => {
  const m = await mockApi(page);
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  m.on.create = async () => {
    await held; // 答えを返す前にもう一度押させる
    return created();
  };
  await open(page);
  await fill(page);
  await next(page).click();
  await next(page)
    .click({ force: true, timeout: 2_000 })
    .catch(() => undefined); // 押せない形になっていてもよい
  release();
  await expect(waiting(page)).toBeVisible();
  expect(m.creates).toHaveLength(1);
});
row(R["K51-UI-021"], async (page) => {
  const m = await mockApi(page);
  m.on.create = () => new Promise<Reply>(() => undefined); // 答えが返らないうちに再読み込みする
  await open(page);
  await fill(page);
  await next(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  m.on.create = () => created();
  await page.reload();
  await expect(field(page, "メール")).toHaveValue(EMAIL);
  await expect(field(page, "名前")).toHaveValue("高本 聖斗");
  await expect(field(page, "会社・チームの名前")).toHaveValue("株式会社テスト");
  await expect(field(page, "パスワード")).toHaveValue(""); // パスワードは残さない
  expect(m.creates).toHaveLength(1); // 勝手に送り直さない
});

// ---- 守り・失敗 ----
row(R["K51-UI-022"], async (page) => {
  const m = await mockApi(page);
  m.on.create = () => ({ status: 429, body: { error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 42 } });
  await open(page);
  await fill(page);
  await next(page).click();
  await expect(page.getByText(/42\s*秒/)).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});
row(R["K51-UI-023"], async (page) => {
  const m = await mockApi(page);
  let dialog = false;
  page.on("dialog", (d) => {
    dialog = true;
    void d.dismiss();
  });
  await open(page);
  const evil = "<img src=x onerror=alert(1)>";
  await fill(page, { name: evil });
  await next(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["name"]).toBe(evil);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(dialog).toBe(false);
});
row(R["K51-UI-024"], async (page) => {
  const m = await mockApi(page);
  m.on.create = () => ({ status: 500, body: { error: "internal", code: null, message: null, action: null } });
  await open(page);
  await fill(page);
  await next(page).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(field(page, "メール")).toHaveValue(EMAIL);
});
row(R["K51-UI-025"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fill(page, { email: "　ＡＢＣ＠Example.COM " });
  await next(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(String(m.creates[0]!["email"]).normalize("NFKC").trim().toLowerCase()).toBe("abc@example.com");
  await expect(waiting(page)).toBeVisible();
});
