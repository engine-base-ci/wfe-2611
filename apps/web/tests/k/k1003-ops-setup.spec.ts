// K-1003「運営のパスキーを付ける画面（メールのリンク /ops/setup#token=…）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops-setup の op-setup・op-setup-done・op-setup-invalid・op-setup-failed（この葉が部品 ops-setup.tsx と一緒に運ぶ）。
//   下の字は下絵の字（下絵が正・D-156.18）。つながらなかった字だけは下絵の状態が無いので入れ物の字（部品の alert で出す）。
//   呼ぶ口：startOpsSetup（POST /api/v1/auth/ops-setup・K-945）→ 部品のパスキーを付ける口（/api/auth/passkey/generate-register-options・verify-registration・K-309）
//   → ログアウト（POST /api/v1/auth/sign-out・K-306・付けるだけのセッションを閉じる）。口は網の手前で差し替える。
//   パスキーは Chrome の仮の認証器（CDP WebAuthn）。WebAuthn は IP の宛先で動かないので localhost で開く。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-1003.md の表と 1 対 1
import { randomBytes } from "node:crypto";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { AUTH_PAIRS, MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";

const BOX = '[data-part="auth-box"]';
const TOKEN = "A".repeat(21) + "b".repeat(22); // 43 字の印（形だけ）
const b64u = (b: Buffer) => b.toString("base64url");
const TXT = {
  h1: "パスキーを付ける",
  button: "パスキーを付ける",
  done: "パスキーを付けました。運営のログインから、パスキーで入ってください",
  toLogin: "運営のログインへ",
  invalid: "このリンクは使えなくなりました。期限が切れたか、もう使われています",
  invalidAction: "運営の管理者に、新しいリンクを送ってもらってください",
  failed:
    "パスキーを付けられませんでした。端末でやめたか、時間が切れました。もう一度「パスキーを付ける」を押してください",
  network: "つながりませんでした。通信を確かめて、もう一度押してください",
  // 名前は入るときに本人が付ける（D-156.66）。欄の名前は下絵 op-setup の字
  name: "名前",
  nameEmpty: "名前を書いてください",
} as const;
const MY_NAME = "佐野 美穂";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "set-auth-token",
};
type Reply = { status: number; body: unknown };
interface Mock {
  calls: string[];
  setupBodies: Record<string, unknown>[];
  regAuth: string[];
  on: { setup: () => Reply | "abort"; verifyReg: () => Reply };
}

async function mockApi(page: Page): Promise<Mock> {
  const m: Mock = {
    calls: [],
    setupBodies: [],
    regAuth: [],
    on: {
      setup: () => ({ status: 201, body: { data: { token: "tok-setup" } } }),
      verifyReg: () => ({ status: 200, body: { id: "pk-1" } }),
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
    m.calls.push(`${req.method()} ${p}`);
    let r: Reply = { status: 404, body: { code: "NOT_FOUND" } };
    if (p === "/api/v1/auth/ops-setup") {
      m.setupBodies.push((req.postDataJSON() as Record<string, unknown>) ?? {});
      const x = m.on.setup();
      if (x === "abort") return route.abort("failed");
      r = x;
    } else if (p === "/api/auth/passkey/generate-register-options") {
      m.regAuth.push(req.headers()["authorization"] ?? "");
      r = {
        status: 200,
        body: {
          challenge: b64u(randomBytes(32)),
          challenge_token: "ch-k1003",
          rp: { id: "localhost", name: "Kaname" },
          user: { id: b64u(Buffer.from("u-k1003")), name: "ops@example.test", displayName: "運営" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          timeout: 60_000,
          attestation: "none",
          excludeCredentials: [],
          authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
        },
      };
    } else if (p === "/api/auth/passkey/verify-registration") {
      m.regAuth.push(req.headers()["authorization"] ?? "");
      r = m.on.verifyReg();
    } else if (p === "/api/v1/auth/sign-out") r = { status: 201, body: { data: { signed_out: true } } };
    await route.fulfill({
      status: r.status,
      headers: CORS,
      contentType: "application/json",
      body: JSON.stringify(r.body),
    });
  });
  return m;
}
const local = (baseURL: string | undefined) => String(baseURL).replace("127.0.0.1", "localhost");
async function authenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}
async function openSetup(page: Page, base: string, width = 1440, hash = `#token=${TOKEN}`) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  expect((await page.goto(`${base}/ops/setup${hash}`))?.status()).toBe(200);
  await expect(page.locator(`${BOX} h1`)).toHaveText(TXT.h1);
  await page.evaluate(() => document.fonts.ready);
}
const press = async (page: Page, name: string = MY_NAME) => {
  await page.getByLabel(TXT.name, { exact: true }).fill(name);
  await page.getByRole("button", { name: TXT.button, exact: true }).click();
};

test.describe("K-1003 パスキーを付ける画面", () => {
  for (const w of MATCH_WIDTHS)
    test(`K1003-UI-001 開いた画面が下絵 op-setup と同じ（幅 ${w}）`, async ({ browser, baseURL }) => {
      const { bad } = await matchMock(
        browser,
        "op-setup",
        w,
        async (page) => {
          await mockApi(page);
          await openSetup(page, local(baseURL), w);
        },
        { base: "/dev/mock/f12-ops-setup", pairs: AUTH_PAIRS },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });

  test("K1003-UI-002 開いただけでは口を呼ばない。印はアドレスの欄から消える（#の後を読んだら履歴を置き換える）", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    await openSetup(page, local(baseURL));
    expect(m.calls).toEqual([]);
    await expect.poll(() => page.url()).not.toContain(TOKEN);
  });

  test("K1003-UI-003 押す：リンクの口に { token, name } を 1 回送り、返った印で付ける口（始め・確かめ）を Bearer で呼ぶ。付けたら下絵 op-setup-done の文と「運営のログインへ」。付けるだけのセッションは閉じる（ログアウトの口を 1 回）", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    await authenticator(page);
    await openSetup(page, local(baseURL));
    await press(page);
    await expect(page.getByText(TXT.done, { exact: true })).toBeVisible();
    expect(m.setupBodies).toEqual([{ token: TOKEN, name: MY_NAME }]);
    expect(m.regAuth).toEqual(["Bearer tok-setup", "Bearer tok-setup"]);
    expect(m.calls.filter((c) => c === "POST /api/v1/auth/sign-out").length).toBe(1);
    await page.getByRole("link", { name: TXT.toLogin, exact: true }).click();
    await page.waitForURL(/\/ops\/login$/);
  });

  for (const w of MATCH_WIDTHS)
    test(`K1003-UI-004 付けた後の画面が下絵 op-setup-done と同じ（幅 ${w}）`, async ({ browser, baseURL }) => {
      const { bad } = await matchMock(
        browser,
        "op-setup-done",
        w,
        async (page) => {
          await mockApi(page);
          await authenticator(page);
          await openSetup(page, local(baseURL), w);
          await press(page);
          await expect(page.getByText(TXT.done, { exact: true })).toBeVisible();
        },
        { base: "/dev/mock/f12-ops-setup", pairs: AUTH_PAIRS },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });

  test("K1003-UI-005 使えないリンク（口が 409 E-PAGE-006）：目録の E-PAGE-006 の文と、運営の管理者に頼む 1 行。付けるボタンは出さない・付ける口は呼ばない", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    m.on.setup = () => ({ status: 409, body: { error: "conflict", code: "E-PAGE-006" } });
    await authenticator(page);
    await openSetup(page, local(baseURL));
    await press(page);
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(TXT.invalid);
    await expect(alert).toContainText(TXT.invalidAction);
    await expect(page.getByRole("button", { name: TXT.button, exact: true })).toHaveCount(0);
    expect(m.regAuth).toEqual([]);
  });

  test("K1003-UI-006 印が無い・形が違う（#なし・#token=短い）：口を呼ばずに使えないリンクの文（E-PAGE-006）", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const hash of ["", "#token=abc"]) {
      await page.goto(`${local(baseURL)}/ops/setup${hash}`);
      await expect(page.getByRole("alert")).toContainText(TXT.invalid);
    }
    expect(m.calls).toEqual([]);
  });

  test("K1003-UI-007 端末でやめた（NotAllowedError）：下絵 op-setup-failed の文。もう一度押すと、リンクの口はもう呼ばず（同じセッションで）付け直せる", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __k1003n: number };
      w.__k1003n = 0;
      const real = navigator.credentials.create.bind(navigator.credentials);
      Object.defineProperty(navigator.credentials, "create", {
        configurable: true,
        value: (o: CredentialCreationOptions) => {
          w.__k1003n += 1;
          return w.__k1003n === 1 ? Promise.reject(new DOMException("やめた", "NotAllowedError")) : real(o);
        },
      });
    });
    await authenticator(page);
    await openSetup(page, local(baseURL));
    await press(page);
    await expect(page.getByRole("alert")).toHaveText(TXT.failed);
    await press(page);
    await expect(page.getByText(TXT.done, { exact: true })).toBeVisible();
    expect(m.setupBodies.length).toBe(1);
  });

  test("K1003-UI-008 リンクの口に届かない（網が切れた）：つながらなかった文（入れ物の字）。ボタンは押せる", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    m.on.setup = () => "abort";
    await openSetup(page, local(baseURL));
    await press(page);
    await expect(page.getByRole("alert")).toHaveText(TXT.network);
    await expect(page.getByRole("button", { name: TXT.button, exact: true })).toBeEnabled();
  });

  test("K1003-UI-012 名前が空・空白だけ：押すと「名前を書いてください」（role alert）・リンクの口も付ける口も呼ばない。書くと送れる（D-156.66）", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    await authenticator(page);
    await openSetup(page, local(baseURL));
    for (const blank of ["", "\u3000 "]) {
      await press(page, blank);
      await expect(page.getByRole("alert")).toHaveText(TXT.nameEmpty);
    }
    expect(m.calls).toEqual([]);
    await press(page);
    await expect(page.getByText(TXT.done, { exact: true })).toBeVisible();
    expect(m.setupBodies).toEqual([{ token: TOKEN, name: MY_NAME }]);
  });

  test("K1003-UI-009 二度押し：リンクの口は 1 回だけ（押している間はボタンを押せない）", async ({ page, baseURL }) => {
    const m = await mockApi(page);
    await authenticator(page);
    await openSetup(page, local(baseURL));
    await page.getByLabel(TXT.name, { exact: true }).fill(MY_NAME);
    const b = page.getByRole("button", { name: TXT.button, exact: true });
    await Promise.all([b.click(), b.click({ force: true }).catch(() => undefined)]);
    await expect(page.getByText(TXT.done, { exact: true })).toBeVisible();
    expect(m.setupBodies.length).toBe(1);
  });

  test("K1003-UI-013 リンクの口が 429（上限）・503 E-PAGE-003（セッションを作れない）・422（画面の確かめをすり抜けた形）：どれもつながらなかった文（role alert）・付ける口は呼ばない・ボタンは押せる", async ({
    page,
    baseURL,
  }) => {
    const m = await mockApi(page);
    await authenticator(page);
    await openSetup(page, local(baseURL));
    for (const r of [
      { status: 429, body: { code: "E-PAGE-004" } },
      { status: 503, body: { code: "E-PAGE-003" } },
      { status: 422, body: { code: "E-PAGE-002", field: "name" } },
    ]) {
      m.on.setup = () => r;
      await press(page);
      await expect(page.getByRole("alert")).toHaveText(TXT.network);
      await expect(page.getByRole("button", { name: TXT.button, exact: true })).toBeEnabled();
    }
    expect(m.setupBodies.length).toBe(3);
    expect(m.regAuth).toEqual([]);
  });

  for (const w of [320, 375, 768, 1024, 1440])
    test(`K1003-UI-010 横にはみ出さない（幅 ${w}）`, async ({ page, baseURL }) => {
      await mockApi(page);
      await openSetup(page, local(baseURL), w);
      expect(await overflowX(page)).toBeLessThanOrEqual(0);
    });

  test("K1003-UI-011 出してはいけない字・内部の ID が無い", async ({ page, baseURL }) => {
    await mockApi(page);
    await openSetup(page, local(baseURL));
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(/\bD-\d|E-PAGE|ops_setup|token/);
  });
});
