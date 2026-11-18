// K-317「ログインの画面を口につなぐ：パスキー・スマホの QR（ブラウザの QR）・この PC にも・端末をなくした・いまの様子の帯・別のアカウント・ログアウトの後」
//   の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f1/<状態>（login-pk-failed・pk-unsupported・added・recover・recover-ready・recover-sent・recover-failed・
//   other-account・status-incident・status-both）。画面は views.tsx の LoginMain・LoginRecover・LoginAdded・AuthPage で組む。
//   呼ぶ口：パスキーは部品の口（/api/auth/passkey/*・K-304）、管理者に頼むは requestAdminRecovery（POST /api/v1/auth/recovery/admin-request・K-305）、
//   ログアウトは signOut（POST /api/v1/auth/sign-out・K-306）、いまの様子は getServiceStatus（GET /api/v1/auth/service-status・K-307）。
//   口は網の手前で差し替える（振る舞いは K-304〜K-307 の口の試験が本物の DB で持つ）。本人の Bridge（127.0.0.1:38617）にも届かせない。
//   パスキーは Chrome の仮の認証器（CDP WebAuthn）で本物のブラウザの手順を通す。WebAuthn は IP の宛先で動かないので、パスキーの行は localhost で開く。
//   スマホの QR はブラウザが出す（answer=fe708d209427：Kaname の QR の画面は作らない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { mockList, open as openList } from "./list-mock";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const BOX = '[data-part="auth-box"]';
const NEXT = "/legal/terms";
const EMAIL = "takamoto@engine-base.example";
const PASSWORD = "correct-horse-battery-1";
const CRED_ID = randomBytes(16);
const b64u = (b: Buffer) => b.toString("base64url");
/** 問いの答えの challenge_token。応答の要求の頭 x-passkey-challenge でこの値を返す（K-304・Cookie は使わない） */
const CHALLENGE_TOKEN = "ch-k317";
/** 帯の時刻の行は時計を決めて流す（日本の 11/20 2:30・メンテナンスの最中）。実行する日に依らない */
const NOW = new Date("2026-11-19T17:30:00Z");
/** メンテナンス中（K-307 の型・ongoing true）。帯はメンテナンス中だけ（answer=88f98638a534） */
const MAINT_NOW = { title: "メンテナンス", from: "2026-11-19T17:00:00Z", to: "2026-11-19T18:00:00Z", ongoing: true };
/** これからのメンテナンス（ongoing false）。ログインの帯には出さない */
const MAINT_LATER = { title: "メンテナンス", from: "2026-11-26T17:00:00Z", to: "2026-11-26T18:00:00Z", ongoing: false };
const MSG = {
  pkFailed: "パスキーで入れませんでした。もう一度か、メールとパスワードで入ってください",
  unsupported: "このブラウザはパスキーに対応していません。メールとパスワードで入ってください",
  sent: "管理者に頼みました。戻してもらったら、もう一度ログインしてください",
  already: "もう頼んであります。管理者が戻すまで、お待ちください",
  noAdmin:
    "頼んだことを記録しました。ほかに管理者がいないので、運営が本人を確かめて戻します。困ったときから運営に連絡してください",
  failed: "送れませんでした。もう一度押してください",
  member: "このアカウントは、いま止められています。ワークスペースの管理者に聞いてください",
  lock: "15 分間ロックしました。15 分たってから、もう一度入ってください",
} as const;

type Reply = { status: number; body: unknown; headers?: Record<string, string> };
interface Mock {
  calls: string[];
  options: number;
  verifies: Record<string, unknown>[];
  /** 応答の要求の頭 x-passkey-challenge（チャレンジの受け渡し・精査の後の決め 5） */
  challengeHeads: string[];
  /** パスキーの問いと応答の要求の頭 authorization（前の人の印を付けて行かない・Q の指摘） */
  passkeyAuths: string[];
  recovers: Record<string, unknown>[];
  statusCalls: number;
  on: {
    signIn: () => Reply;
    passkeyVerify: () => Reply;
    recover: () => Reply;
    status: () => Reply | "abort";
  };
}
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "set-auth-token",
};
const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}): Reply => ({
  status,
  body: { code, message, ...extra },
});
const passkeyOk = (): Reply => ({
  status: 200,
  headers: { "set-auth-token": "tok-k317" },
  body: { session: { token: "tok-k317" }, user: { id: "u-k317", email: EMAIL } },
});

async function mockAuth(page: Page, o: { twoFactor?: boolean } = {}): Promise<Mock> {
  const m: Mock = {
    calls: [],
    options: 0,
    verifies: [],
    challengeHeads: [],
    passkeyAuths: [],
    recovers: [],
    statusCalls: 0,
    on: {
      signIn: () => ({
        status: 201,
        body: {
          data: o.twoFactor
            ? { token: null, two_factor: true, pending: "tf-k317" }
            : { token: "tok-k317", two_factor: false, pending: null },
        },
      }),
      passkeyVerify: passkeyOk,
      recover: () => ({ status: 201, body: { data: { result: "sent" } } }),
      status: () => ({ status: 200, body: { data: { incidents: [], maintenance: null } } }),
    },
  };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
    m.calls.push(`${req.method()} ${p}`);
    let r: Reply = { status: 404, body: { code: "NOT_FOUND", message: "無い" } };
    if (p === "/api/v1/auth/sign-in") r = m.on.signIn();
    else if (p === "/api/v1/auth/two-factor/verify") r = { status: 201, body: { data: { token: "tok-k317" } } };
    else if (/^\/api\/auth\/passkey\/.*authenticate-options/.test(p)) {
      m.options += 1;
      m.passkeyAuths.push(req.headers()["authorization"] ?? "");
      r = {
        status: 200,
        body: {
          challenge: b64u(randomBytes(32)),
          challenge_token: CHALLENGE_TOKEN,
          rpId: "localhost",
          timeout: 60_000,
          allowCredentials: [],
          userVerification: "preferred",
        },
      };
    } else if (/^\/api\/auth\/passkey\/verify-authentication/.test(p)) {
      m.verifies.push((req.postDataJSON() as Record<string, unknown>) ?? {});
      m.challengeHeads.push(req.headers()["x-passkey-challenge"] ?? "");
      m.passkeyAuths.push(req.headers()["authorization"] ?? "");
      r = m.on.passkeyVerify();
    } else if (p === "/api/v1/auth/recovery/admin-request") {
      m.recovers.push((req.postDataJSON() as Record<string, unknown>) ?? {});
      r = m.on.recover();
    } else if (p === "/api/v1/auth/service-status") {
      m.statusCalls += 1;
      const x = m.on.status();
      if (x === "abort") return route.abort("failed");
      r = x;
    } else if (p === "/api/auth/get-session") r = { status: 200, body: { session: null, user: null } };
    await route.fulfill({
      status: r.status,
      headers: { ...CORS, ...(r.headers ?? {}) },
      contentType: "application/json",
      body: JSON.stringify(r.body),
    });
  });
  return m;
}

/** パスキーの行は localhost で開く（WebAuthn の宛先は IP にできない） */
const local = (baseURL: string | undefined) => String(baseURL).replace("127.0.0.1", "localhost");
async function open(page: Page, base: string, width = 1440, q = `?next=${encodeURIComponent(NEXT)}`) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  expect((await page.goto(`${base}/login${q}`))?.status()).toBe(200);
  await expect(page.locator(`${BOX} h1`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
/** Chrome の仮の認証器を付ける。transport internal ＝この PC・usb ＝この PC の外（スマホや鍵と同じ cross-platform） */
async function authenticator(page: Page, transport: "internal" | "usb", withCredential = true) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  if (withCredential) {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    await cdp.send("WebAuthn.addCredential", {
      authenticatorId,
      credential: {
        credentialId: CRED_ID.toString("base64"),
        isResidentCredential: true,
        rpId: "localhost",
        privateKey: (privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).toString("base64"),
        userHandle: Buffer.from("u-k317").toString("base64"),
        signCount: 0,
      },
    });
  }
  return { cdp, authenticatorId };
}
/** navigator.credentials.get を数え、本人がやめた（NotAllowedError）で返す */
async function refusePasskey(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __k317get: number };
    w.__k317get = 0;
    Object.defineProperty(navigator.credentials, "get", {
      configurable: true,
      value: () => {
        w.__k317get += 1;
        return Promise.reject(new DOMException("やめた", "NotAllowedError"));
      },
    });
  });
}
const getCalls = (page: Page) => page.evaluate(() => (window as unknown as { __k317get?: number }).__k317get ?? 0);
const passkeyBtn = (page: Page) => page.locator(`${BOX} [data-act="passkey"]`);
const token = (page: Page) => page.evaluate(() => window.localStorage.getItem("kaname.token"));
const mail = (page: Page) => page.getByRole("textbox", { name: "メールアドレス" });
const pass = (page: Page) => page.getByLabel("パスワード", { exact: true });
async function passwordToCode(page: Page) {
  await mail(page).fill(EMAIL);
  await pass(page).fill(PASSWORD);
  await page.locator(BOX).getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("確認のコード");
}
const recoverCard = (page: Page, name: string) => page.locator(`${BOX} .k-auth-choice`, { hasText: name });

// ---- パスキーで入る（K-304 の部品の口） ----

test("K317-UI-001 この PC のパスキー（仮の認証器 internal）：「パスキーで入る」で部品の口から問いを受け、ブラウザの手順（navigator.credentials.get）を通って応答を送り、6 けたを聞かずに入って行き先へ。応答の id は認証器の鍵の id・応答の要求の頭 x-passkey-challenge が問いの答えの challenge_token と同じ（Cookie に頼らない・精査の後の決め 5）", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  await authenticator(page, "internal");
  await open(page, local(baseURL));
  await expect(passkeyBtn(page)).toBeEnabled();
  await passkeyBtn(page).click();
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(m.options).toBe(1);
  expect(m.verifies).toHaveLength(1);
  expect(JSON.stringify(m.verifies[0])).toContain(b64u(CRED_ID));
  expect(m.challengeHeads).toEqual([CHALLENGE_TOKEN]);
  expect(m.calls.filter((c) => c.includes("two-factor"))).toEqual([]);
  expect(await token(page)).toBe("tok-k317");
});

test("K317-UI-002 この PC の外の認証器（スマホ・鍵：仮の認証器 usb）で入った直後：行き先へ移らず「入れました」（✓・この PC にパスキーを付ける・今回はしない）を出す。この時点でログインの印は残っている・応答の要求の頭 x-passkey-challenge が challenge_token", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  await authenticator(page, "usb");
  await open(page, local(baseURL));
  await passkeyBtn(page).click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("入れました");
  expect(m.challengeHeads).toEqual([CHALLENGE_TOKEN]);
  await expect(page.locator(BOX).getByRole("button", { name: "この PC にパスキーを付ける" })).toBeVisible();
  await expect(page.locator(BOX).getByRole("button", { name: "今回はしない" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/login");
  expect(await token(page)).toBe("tok-k317");
});

test("K317-UI-003 「入れました」の 2 つ：「この PC にパスキーを付ける」は /mfa-setup?add=passkey&next=<行き先> へ、「今回はしない」は行き先へ移る（同じ大きさ・高さ 44 の 2 つ）", async ({
  page,
  baseURL,
}) => {
  await mockAuth(page);
  await authenticator(page, "usb");
  await open(page, local(baseURL));
  await passkeyBtn(page).click();
  const add = page.locator(BOX).getByRole("button", { name: "この PC にパスキーを付ける" });
  const skip = page.locator(BOX).getByRole("button", { name: "今回はしない" });
  const [a, s] = [(await add.boundingBox())!, (await skip.boundingBox())!];
  expect(Math.round(a.height)).toBe(44);
  expect(Math.abs(a.width - s.width)).toBeLessThanOrEqual(1);
  await skip.click();
  await page.waitForURL((u) => u.pathname === NEXT);
  await open(page, local(baseURL));
  await passkeyBtn(page).click();
  await page.locator(BOX).getByRole("button", { name: "この PC にパスキーを付ける" }).click();
  await page.waitForURL((u) => u.pathname === "/mfa-setup");
  const u = new URL(page.url());
  expect(u.searchParams.get("add")).toBe("passkey");
  expect(u.searchParams.get("next")).toBe(NEXT);
});

test("K317-UI-004 「スマホで QR を読み取る」：押すと同じパスキーの手順が始まる（部品の口の問いが 1 回・navigator.credentials.get が 1 回）。Kaname の QR の画面は出さない（QR はブラウザが出す・answer=fe708d209427）", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  await refusePasskey(page);
  await open(page, local(baseURL));
  await page.locator(BOX).getByRole("button", { name: "スマホで QR を読み取る" }).click();
  await expect.poll(() => getCalls(page)).toBe(1);
  expect(m.options).toBe(1);
  await expect(page.locator(".k-auth-qr")).toHaveCount(0);
  await expect(page.locator(`${BOX} h1`)).toHaveText("ログイン");
});

test("K317-UI-005 パスキーで入れない（本人がやめた・時間切れ・この端末に無い＝NotAllowedError）：通常の画面のまま「パスキーで入れませんでした。…」が role=alert で出る。応答の口は呼ばず、ログインの印も無い。メールとパスワードで続けて入れる", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  await refusePasskey(page);
  await open(page, local(baseURL));
  await passkeyBtn(page).click();
  await expect(page.locator(BOX).getByRole("alert")).toHaveText(MSG.pkFailed);
  expect(m.verifies).toEqual([]);
  expect(await token(page)).toBeNull();
  await mail(page).fill(EMAIL);
  await pass(page).fill(PASSWORD);
  await page.locator(BOX).getByRole("button", { name: "次へ", exact: true }).click();
  await page.waitForURL((u) => u.pathname === NEXT);
});

test("K317-UI-006 パスキーに対応していないブラウザ（PublicKeyCredential が無い）：「パスキーで入る」は出すがグレー（0.55・disabled）で押しても口を呼ばない。下の文は「このブラウザはパスキーに対応していません。…」で、QR の字のボタンは無い", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  await page.addInitScript(() => {
    delete (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  });
  await open(page, local(baseURL));
  await expect(passkeyBtn(page)).toBeVisible();
  await expect(passkeyBtn(page)).toBeDisabled();
  expect(Number.parseFloat(await passkeyBtn(page).evaluate((e) => getComputedStyle(e).opacity))).toBeCloseTo(0.55, 2);
  await passkeyBtn(page).click({ force: true });
  await expect(page.locator(`${BOX} .k-login-pk-note`)).toHaveText(MSG.unsupported);
  await expect(page.locator(BOX).getByRole("button", { name: "スマホで QR を読み取る" })).toHaveCount(0);
  expect(m.options).toBe(0);
});

test("K317-UI-007 パスキーで入ったが止められた人（応答の口が 403・E-AUTH-011）：止めの画面（h1「ログインできません」・赤の箱に口の文）。ログインの印は無い。チャレンジは頭で返している", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  m.on.passkeyVerify = () => fail(403, "E-AUTH-011", MSG.member);
  await authenticator(page, "internal");
  await open(page, local(baseURL));
  await passkeyBtn(page).click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("ログインできません");
  await expect(page.locator(`${BOX} .k-auth-result[data-tone="bad"]`)).toContainText(MSG.member);
  expect(m.challengeHeads).toEqual([CHALLENGE_TOKEN]);
  expect(await token(page)).toBeNull();
});

test("K317-UI-008 パスワードがロック中（429・E-AUTH-002）でも、パスキーはロックの外：「次へ」は押せないままで、「パスキーで入る」は押せて入れる", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  m.on.signIn = () => fail(429, "E-AUTH-002", MSG.lock, { retry_after_sec: 900 });
  await authenticator(page, "internal");
  await open(page, local(baseURL));
  await mail(page).fill(EMAIL);
  await pass(page).fill(PASSWORD);
  await page.locator(BOX).getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.locator(BOX).getByRole("alert")).toHaveText(MSG.lock);
  await expect(passkeyBtn(page)).toBeEnabled();
  await passkeyBtn(page).click();
  await page.waitForURL((u) => u.pathname === NEXT);
});

test("K317-UI-009 「パスキーで入る」を続けて 2 回押す：問いの口は 1 回だけ（手順の間はボタンが回る印で押せない）", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.credentials, "get", {
      configurable: true,
      value: () => new Promise((_, no) => setTimeout(() => no(new DOMException("やめた", "NotAllowedError")), 1500)),
    });
  });
  await open(page, local(baseURL));
  await passkeyBtn(page).click();
  await passkeyBtn(page).click({ force: true });
  await expect(page.locator(BOX).getByRole("alert")).toHaveText(MSG.pkFailed);
  expect(m.options).toBe(1);
});

// ---- 端末をなくした（K-305） ----

test("K317-UI-010 パスワードの前に「端末をなくした」：h1「端末をなくしたとき」と 2 つのカード。管理者に頼むは出すがグレーで押せず「先にメールとパスワードで入ってから頼めます」。バックアップコードのカードはメールとパスワードの画面に戻してメールの欄にフォーカス。「← ログインに戻る」も戻る", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  await open(page, local(baseURL));
  await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("端末をなくしたとき");
  const ask = recoverCard(page, "ワークスペースの管理者に再設定を頼む");
  await expect(ask).toContainText("先にメールとパスワードで入ってから頼めます");
  await expect(ask).toBeDisabled();
  await ask.click({ force: true });
  expect(m.recovers).toEqual([]);
  await recoverCard(page, "バックアップコードで入る").click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("ログイン");
  await expect(mail(page)).toBeFocused();
  await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).click();
  await page.locator(BOX).getByRole("button", { name: "← ログインに戻る" }).click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("ログイン");
});

test("K317-UI-011 パスワードを通った直後（確認のコードの画面）に「端末をなくした」：頼める形の「端末をなくしたとき」（確認のコードの画面の「認証アプリが使えない」の下の「端末をなくした」から・代表の答え ④ answer=9177d9dbe0d9）。管理者のカードが押せ、説明は「管理者が本人であることを確かめて…」。バックアップコードのカードはバックアップコードの欄へ", async ({
  page,
  baseURL,
}) => {
  await mockAuth(page, { twoFactor: true });
  await open(page, local(baseURL));
  await passwordToCode(page);
  const lost = page.locator(`${BOX} .k-login-alt-col`).getByRole("button", { name: "端末をなくした" });
  const cant = page.locator(`${BOX} .k-login-alt-col`).getByRole("button", { name: "認証アプリが使えない" });
  expect((await lost.boundingBox())!.y).toBeGreaterThan((await cant.boundingBox())!.y);
  await lost.click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("端末をなくしたとき");
  const ask = recoverCard(page, "ワークスペースの管理者に再設定を頼む");
  await expect(ask).toContainText("管理者が本人であることを確かめて");
  await expect(ask).toBeEnabled();
  await recoverCard(page, "バックアップコードで入る").click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("バックアップコードで入る");
});

test("K317-UI-012 管理者に頼む：POST /api/v1/auth/recovery/admin-request に { pending } が 1 回（答え result: sent）。淡い紺の箱（role=status）に「管理者に頼みました。…」が出て、カードは押せなくなる（もう一度押しても口は増えない）", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page, local(baseURL));
  await passwordToCode(page);
  await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).click();
  const ask = recoverCard(page, "ワークスペースの管理者に再設定を頼む");
  await ask.click();
  await expect(page.locator(`${BOX} .k-auth-result[data-tone="ok"]`)).toHaveText(new RegExp(MSG.sent));
  await expect(page.locator(`${BOX} .k-auth-result[data-tone="ok"]`)).toHaveAttribute("role", "status");
  expect(m.recovers).toEqual([{ pending: "tf-k317" }]);
  await expect(ask).toBeDisabled();
  await ask.click({ force: true });
  expect(m.recovers).toHaveLength(1);
});

test("K317-UI-013 もう頼んである（答えが result: already）：「もう頼んであります。管理者が戻すまで、お待ちください」が出て、カードは押せない", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.recover = () => ({ status: 201, body: { data: { result: "already" } } });
  await open(page, local(baseURL));
  await passwordToCode(page);
  await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).click();
  await recoverCard(page, "ワークスペースの管理者に再設定を頼む").click();
  await expect(page.locator(`${BOX} .k-auth-result[data-tone="ok"]`)).toHaveText(new RegExp(MSG.already));
  await expect(recoverCard(page, "ワークスペースの管理者に再設定を頼む")).toBeDisabled();
});

test("K317-UI-014 管理者への知らせが送れない（201・result: failed・記録は残る／口そのものが 500）：どちらも赤の箱（role=alert）に「送れませんでした。もう一度押してください」。カードは押せたままで、もう一度押すと口が呼ばれ、届けば「頼みました」に替わる（送れたとは言わない）", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.recover = () => ({ status: 201, body: { data: { result: "failed" } } });
  await open(page, local(baseURL));
  await passwordToCode(page);
  await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).click();
  const ask = recoverCard(page, "ワークスペースの管理者に再設定を頼む");
  await ask.click();
  await expect(page.locator(`${BOX} .k-auth-result[data-tone="bad"]`)).toHaveText(new RegExp(MSG.failed));
  await expect(page.locator(`${BOX} .k-auth-result[data-tone="ok"]`)).toHaveCount(0);
  await expect(ask).toBeEnabled();
  m.on.recover = () => fail(500, "E-PAGE-003", "落ちています");
  await ask.click();
  await expect(page.locator(`${BOX} .k-auth-result[data-tone="bad"]`)).toHaveText(new RegExp(MSG.failed));
  m.on.recover = () => ({ status: 201, body: { data: { result: "sent" } } });
  await ask.click();
  await expect(page.locator(`${BOX} .k-auth-result[data-tone="ok"]`)).toHaveText(new RegExp(MSG.sent));
  expect(m.recovers).toHaveLength(3);
});

// ---- いまの様子の帯（K-307） ----

test("K317-UI-015 障害が直っていない：ログインの画面を開くと GET /api/v1/auth/service-status が 1 回呼ばれ、いちばん上に帯「障害 分身の実行が遅れています 11/18 10:20 から」（日本の時刻）。ログインはふつうにできる", async ({
  page,
  baseURL,
}) => {
  await page.clock.install({ time: NOW });
  const m = await mockAuth(page);
  m.on.status = () => ({
    status: 200,
    body: {
      data: {
        incidents: [{ state: "investigating", title: "分身の実行が遅れています", started_at: "2026-11-18T01:20:00Z" }],
        maintenance: null,
      },
    },
  });
  await open(page, local(baseURL));
  const strip = page.locator(".k-status-strip");
  await expect(strip).toHaveCount(1);
  await expect(strip).toHaveAttribute("data-kind", "incident");
  await expect(strip).toHaveText(/障害\s*分身の実行が遅れています\s*11\/18 10:20 から/);
  expect(m.statusCalls).toBe(1);
  await mail(page).fill(EMAIL);
  await pass(page).fill(PASSWORD);
  await page.locator(BOX).getByRole("button", { name: "次へ", exact: true }).click();
  await page.waitForURL((u) => u.pathname === NEXT);
});

test("K317-UI-016 メンテナンスの帯はメンテナンス中だけ（answer=88f98638a534）：ongoing true なら帯 2 本（障害が上・メンテナンスが下）で「メンテナンス中です。この間は使えません」「11/20 3:00 まで」（日本の時刻）。ongoing false（これからの予定）なら帯は障害の 1 本だけ", async ({
  page,
  baseURL,
}) => {
  await page.clock.install({ time: NOW });
  const m = await mockAuth(page);
  let maint: typeof MAINT_NOW | typeof MAINT_LATER = MAINT_NOW;
  m.on.status = () => ({
    status: 200,
    body: {
      data: {
        incidents: [{ state: "investigating", title: "分身の実行が遅れています", started_at: "2026-11-18T01:20:00Z" }],
        maintenance: maint,
      },
    },
  });
  await open(page, local(baseURL));
  const strips = page.locator(".k-status-strip");
  await expect(strips).toHaveCount(2);
  await expect(strips.nth(0)).toHaveAttribute("data-kind", "incident");
  await expect(strips.nth(1)).toHaveAttribute("data-kind", "maintenance");
  await expect(strips.nth(1)).toHaveText(/メンテナンス\s*メンテナンス中です。この間は使えません\s*11\/20 3:00 まで/);
  maint = MAINT_LATER;
  await open(page, local(baseURL));
  await expect(strips).toHaveCount(1);
  await expect(strips.nth(0)).toHaveAttribute("data-kind", "incident");
});

test("K317-UI-017 いまの様子が読めない（500・網が切れた）：帯を出さず、ログインの画面はふつうに使える（エラーの文も出さない）", async ({
  page,
  baseURL,
}) => {
  for (const how of ["500", "abort"] as const) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const m = await mockAuth(page);
    m.on.status = () => (how === "abort" ? "abort" : fail(500, "E-PAGE-003", "落ちています"));
    await open(page, local(baseURL));
    await expect.poll(() => m.statusCalls, how).toBe(1);
    await expect(page.locator(".k-status-strip"), how).toHaveCount(0);
    await expect(page.locator(BOX).getByRole("alert"), how).toHaveCount(0);
    await expect(page.locator(BOX).getByRole("button", { name: "次へ", exact: true }), how).toBeEnabled();
  }
});

// ---- ログイン中に開いた・ログアウト（K-306） ----

async function signedIn(page: Page, email: string) {
  await page.addInitScript(() => window.localStorage.setItem("kaname.token", "tok-other"));
  await page.route(/\/api\/auth\/get-session$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({
        session: { id: "s-other", userId: "u-other", token: "tok-other", expiresAt: "2099-01-01T00:00:00Z" },
        user: { id: "u-other", email, name: "木村", emailVerified: true },
      }),
    }),
  );
}

test("K317-UI-018 別のアカウントでログイン中に招待やメールのリンクから /login?next=… を開く：灰の箱に「いまは kimura@engine-base.example でログイン中です。別のアカウントで入ると、今のログインは閉じます」（代表の答え ⑤ answer=75dc21e85b2e）。欄と「次へ」とパスキーは使える。開いただけでは今のログインの印はそのまま", async ({
  page,
  baseURL,
}) => {
  await mockAuth(page);
  await signedIn(page, "kimura@engine-base.example");
  await open(page, local(baseURL), 1440, `?next=${encodeURIComponent("/invite/abc")}`);
  await expect(page.locator(`${BOX} .k-auth-note-box`)).toHaveText(
    "いまは kimura@engine-base.example でログイン中です。別のアカウントで入ると、今のログインは閉じます",
  );
  await expect(mail(page)).toBeEditable();
  await expect(page.locator(BOX).getByRole("button", { name: "次へ", exact: true })).toBeEnabled();
  await expect(passkeyBtn(page)).toBeEnabled();
  expect(await token(page)).toBe("tok-other");
});

test("K317-UI-019 ログイン中に next 無しで /login を開く：入らせ直さず、入口の振り分け（/）へ移る。ログインの印はそのまま", async ({
  page,
  baseURL,
}) => {
  await mockAuth(page);
  await signedIn(page, "takamoto@engine-base.example");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${local(baseURL)}/login`);
  await page.waitForURL((u) => u.pathname === "/");
  expect(await token(page)).toBe("tok-other");
});

test("K317-UI-027 別のアカウントでログイン中に入る：新しいアカウントで入れたら、前のログインを契約の口 POST /api/v1/auth/sign-out（前の印 Bearer tok-other つき）で 1 回閉じ、印は新しい tok-k317 に替わって行き先へ。入るのに失敗したら前のログインは閉じない。6 けたの道（6 けたで入れた後）とパスキーの道でも同じく 1 回ずつ閉じる（代表の答え ⑤）", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  const order: string[] = [];
  const outs: string[] = [];
  page.on("request", (r) => {
    const p = new URL(r.url()).pathname;
    if (r.method() === "POST" && (p === "/api/v1/auth/sign-in" || p === "/api/v1/auth/sign-out")) order.push(p);
  });
  await signedIn(page, "kimura@engine-base.example");
  await page.route(/\/api\/v1\/auth\/sign-out$/, async (route, req) => {
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
    outs.push(req.headers()["authorization"] ?? "");
    await route.fulfill({
      status: 201,
      headers: CORS,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });
  await open(page, local(baseURL), 1440, `?next=${encodeURIComponent(NEXT)}`);
  m.on.signIn = () =>
    fail(401, "E-AUTH-001", "メールアドレスかパスワードが違います。あと 4 回で 15 分ロックします", { remaining: 4 });
  await mail(page).fill(EMAIL);
  await pass(page).fill("wrong-password-000");
  await page.locator(BOX).getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.locator(BOX).getByRole("alert")).toBeVisible();
  expect(outs, "失敗では前のログインを閉じない").toEqual([]);
  expect(await token(page)).toBe("tok-other");
  m.on.signIn = () => ({
    status: 201,
    body: { data: { token: "tok-k317", two_factor: false, pending: null } },
  });
  await pass(page).fill(PASSWORD);
  await page.locator(BOX).getByRole("button", { name: "次へ", exact: true }).click();
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(outs).toEqual(["Bearer tok-other"]);
  expect(order.lastIndexOf("/api/v1/auth/sign-in")).toBeLessThan(order.indexOf("/api/v1/auth/sign-out"));
  expect(await token(page)).toBe("tok-k317");

  // 6 けたの道：パスワードを通った時点では閉じず、6 けたで入れた後に前のログインを閉じる
  m.on.signIn = () => ({ status: 201, body: { data: { token: null, two_factor: true, pending: "tf-k317" } } });
  await open(page, local(baseURL), 1440, `?next=${encodeURIComponent(NEXT)}`);
  await passwordToCode(page);
  expect(outs, "パスワードを通っただけでは閉じない").toHaveLength(1);
  await page.getByRole("textbox", { name: "確認のコード 1 けた目" }).click();
  await page.keyboard.type("482913", { delay: 20 });
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(outs).toEqual(["Bearer tok-other", "Bearer tok-other"]);

  // パスキーの道：パスキーで入れた後に前のログインを閉じる
  await authenticator(page, "internal");
  await open(page, local(baseURL), 1440, `?next=${encodeURIComponent(NEXT)}`);
  await passkeyBtn(page).click();
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(outs).toEqual(["Bearer tok-other", "Bearer tok-other", "Bearer tok-other"]);
  expect(await token(page)).toBe("tok-k317");
});

test("K317-UI-028 ほかに管理者がいない（答えが result: no_admin）：淡い紺の箱に「頼んだことを記録しました。ほかに管理者がいないので、運営が本人を確かめて戻します。困ったときから運営に連絡してください」・カードは押せない（代表の答え ⑥ answer=75dc21e85b2e）", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.recover = () => ({ status: 201, body: { data: { result: "no_admin" } } });
  await open(page, local(baseURL));
  await passwordToCode(page);
  await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).click();
  const ask = recoverCard(page, "ワークスペースの管理者に再設定を頼む");
  await ask.click();
  await expect(page.locator(`${BOX} .k-auth-result[data-tone="ok"]`)).toHaveText(new RegExp(MSG.noAdmin));
  await expect(ask).toBeDisabled();
  await ask.click({ force: true });
  expect(m.recovers).toHaveLength(1);
});

test("K317-UI-030 別のアカウントでログイン中にパスキーで入る：パスキーの問いと応答の要求に前の人の印（Authorization）を付けない（部品が選べるパスキーを前の人の物に絞らない・代表の答え ⑤・Q の指摘）。入れたら前のログインを前の印で 1 回閉じる", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page);
  const outs: string[] = [];
  await signedIn(page, "kimura@engine-base.example");
  await page.route(/\/api\/v1\/auth\/sign-out$/, async (route, req) => {
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
    outs.push(req.headers()["authorization"] ?? "");
    await route.fulfill({
      status: 201,
      headers: CORS,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });
  await authenticator(page, "internal");
  await open(page, local(baseURL), 1440, `?next=${encodeURIComponent(NEXT)}`);
  await passkeyBtn(page).click();
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(m.options).toBe(1);
  expect(m.verifies).toHaveLength(1);
  expect(m.passkeyAuths).toEqual(["", ""]);
  expect(outs).toEqual(["Bearer tok-other"]);
  expect(await token(page)).toBe("tok-k317");
});

test("K317-UI-031 確認のコードの画面で待ちの印が切れた（401・E-AUTH-013）後に「端末をなくした」→「バックアップコードで入る」：ログインの画面はまっさら（赤の文なし・メールは残りパスワードは空・メールにフォーカス）。パスワードを入れ直すと確認のコードの画面がふつうに使え、6 けたで入れる（Q の指摘）", async ({
  page,
  baseURL,
}) => {
  await mockAuth(page, { twoFactor: true });
  let expired = true;
  let verifies = 0;
  await page.route(/\/api\/v1\/auth\/two-factor\/verify$/, async (route, req) => {
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
    verifies += 1;
    await route.fulfill({
      status: expired ? 401 : 201,
      headers: CORS,
      contentType: "application/json",
      body: JSON.stringify(
        expired
          ? { code: "E-AUTH-013", message: "確認の時間が切れました。もう一度ログインしてください" }
          : { data: { token: "tok-k317" } },
      ),
    });
  });
  await open(page, local(baseURL));
  await passwordToCode(page);
  await page.getByRole("textbox", { name: "確認のコード 1 けた目" }).click();
  await page.keyboard.type("482913", { delay: 20 });
  await expect(page.locator(BOX).getByRole("alert")).toBeVisible();
  expect(verifies).toBe(1);
  await page.locator(`${BOX} .k-login-alt-col`).getByRole("button", { name: "端末をなくした" }).click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("端末をなくしたとき");
  await expect(recoverCard(page, "ワークスペースの管理者に再設定を頼む")).toBeDisabled();
  await recoverCard(page, "バックアップコードで入る").click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("ログイン");
  await expect(page.locator(BOX).getByRole("alert")).toHaveCount(0);
  await expect(mail(page)).toHaveValue(EMAIL);
  await expect(pass(page)).toHaveValue("");
  await expect(mail(page)).toBeFocused();
  expired = false;
  await pass(page).fill(PASSWORD);
  await page.locator(BOX).getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("確認のコード");
  await expect(page.locator(BOX).getByRole("button", { name: "入る", exact: true })).toBeEnabled();
  await page.getByRole("textbox", { name: "確認のコード 1 けた目" }).click();
  await page.keyboard.type("482913", { delay: 20 });
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(verifies).toBe(2);
});

test("K317-UI-032 管理者に頼む口が「待ちの印が切れた」（401・E-AUTH-013）を返す：送れなかったとは出さず、管理者のカードは押せない形（「先にメールとパスワードで入ってから頼めます」）に戻る。もう一度押しても口は増えない（Q の指摘）", async ({
  page,
  baseURL,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.recover = () => fail(401, "E-AUTH-013", "確認の時間が切れました。もう一度ログインしてください");
  await open(page, local(baseURL));
  await passwordToCode(page);
  await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).click();
  const ask = recoverCard(page, "ワークスペースの管理者に再設定を頼む");
  await ask.click();
  await expect(ask).toBeDisabled();
  await expect(ask).toContainText("先にメールとパスワードで入ってから頼めます");
  await expect(page.locator(`${BOX} .k-auth-result`)).toHaveCount(0);
  await ask.click({ force: true });
  expect(m.recovers).toHaveLength(1);
});

/** チケットの一覧（外枠つき）を開き、ログアウトの口を差し替える（list-mock の上に足す。後から足した道が先に当たる） */
async function shellWithSignOut(page: Page, reply: Reply) {
  await mockList(page);
  const out = { contract: [] as string[], part: 0 };
  // list-mock は毎回の読み込みで印を置くので、ログアウトした後は置き直させない（ログアウトで消えた印を見る）
  await page.addInitScript(() => {
    // 画面が消した鍵を写しに残す（localStorage の k317-removed・この試験が消した分は数えない）
    const orig = Storage.prototype.removeItem;
    (window as unknown as { __k317rm: Storage["removeItem"] }).__k317rm = orig;
    Storage.prototype.removeItem = function (this: Storage, k: string) {
      if (k !== "k317-removed") {
        const log = JSON.parse(window.localStorage.getItem("k317-removed") ?? "[]") as string[];
        Storage.prototype.setItem.call(window.localStorage, "k317-removed", JSON.stringify([...log, k]));
      }
      return orig.call(this, k);
    };
  });
  await page.addInitScript(() => {
    // ログアウトの後は、list-mock が読み込みのたびに置き直す印を外す（写しに残さない元の removeItem で。画面が消したかは k317-removed で見る）
    if (window.sessionStorage.getItem("k317-out") === "1")
      (window as unknown as { __k317rm: Storage["removeItem"] }).__k317rm.call(window.localStorage, "kaname.token");
  });
  await page.route(/\/api\/v1\/auth\/sign-out$/, async (route, req) => {
    out.contract.push(req.headers()["authorization"] ?? "");
    await page.evaluate(() => window.sessionStorage.setItem("k317-out", "1")).catch(() => undefined);
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  await page.route(/\/api\/auth\/sign-out$/, async (route) => {
    out.part += 1;
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  // 書きかけの写しはログアウトの前だけ置く（ログアウトの後に残っていなければ、画面が消した）
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("k317-out") !== "1")
      window.localStorage.setItem("kaname.ticket-draft:k317", "書きかけ");
  });
  await openList(page, "/tickets");
  return out;
}
async function pressSignOut(page: Page) {
  await page.getByRole("button", { name: "自分のメニュー" }).click();
  await page.getByRole("menuitem", { name: "ログアウト" }).click();
}

test("K317-UI-020 ログアウト：外枠のメニューの「ログアウト」で契約の口 POST /api/v1/auth/sign-out が今の印（Bearer）つきで 1 回。部品の口 /api/auth/sign-out は 0 回。ログインの画面へ移り、ログインの印とこの PC の書きかけの写しが消える", async ({
  page,
}) => {
  const out = await shellWithSignOut(page, { status: 201, body: { data: { signed_out: true } } });
  await pressSignOut(page);
  await page.waitForURL((u) => u.pathname === "/login");
  expect(out.contract).toHaveLength(1);
  expect(out.contract[0]).toMatch(/^Bearer tok-/);
  expect(out.part).toBe(0);
  const left = await page.evaluate(() => ({
    removed: JSON.parse(window.localStorage.getItem("k317-removed") ?? "[]") as string[],
    draft: window.localStorage.getItem("kaname.ticket-draft:k317"),
  }));
  expect(left.removed).toContain("kaname.token");
  expect(left.removed).toContain("kaname.ticket-draft:k317");
  expect(left.draft).toBeNull();
});

test("K317-UI-021 ログアウトの口が失敗（500）しても：この PC のログインの印は消し、ログインの画面へ移る（手元に印を残さない）", async ({
  page,
}) => {
  const out = await shellWithSignOut(page, fail(500, "E-PAGE-003", "落ちています"));
  await pressSignOut(page);
  await page.waitForURL((u) => u.pathname === "/login");
  expect(out.contract).toHaveLength(1);
  expect(await token(page)).toBeNull();
});

test("K317-UI-022 ログアウトした後にブラウザの戻る：中の画面は見えず、ログインの画面（/login?next=/tickets）へ移る", async ({
  page,
}) => {
  await shellWithSignOut(page, { status: 201, body: { data: { signed_out: true } } });
  await page.route(/\/api\/auth\/get-session$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session: null, user: null }),
    }),
  );
  await pressSignOut(page);
  await page.waitForURL((u) => u.pathname === "/login");
  await page.goBack();
  await page.waitForURL((u) => u.pathname === "/login" && u.searchParams.get("next") === "/tickets");
  await expect(page.getByRole("table", { name: "チケットの一覧" })).toHaveCount(0);
});

test("K317-UI-029 部品のログアウトの道を閉じた（精査の後の決め 4）：本物の口に POST /api/auth/sign-out を送ると 404（sessions を閉じない道を残さない）。契約の口 /api/v1/auth/sign-out は印なしで 401", async ({
  request,
}) => {
  const api = process.env["API_BASE"] ?? "http://127.0.0.1:3011";
  expect((await request.post(`${api}/api/auth/sign-out`, { data: {} })).status()).toBe(404);
  expect((await request.post(`${api}/api/v1/auth/sign-out`, { data: {} })).status()).toBe(401);
});

// ---- 形と並び ----

test("K317-UI-023 部品の世代：ログアウトは契約の口（call の signOut）で、authClient.signOut を呼ばない。画面の client は passkeyClient を持つ。login-form に押せない仮の印（k-login-off・Unbuilt）が残らない", () => {
  const session = readFileSync(join(WEB, "lib/auth/session.tsx"), "utf8");
  expect(session).toMatch(/["']signOut["']/);
  expect(session).not.toMatch(/authClient\.signOut/);
  expect(readFileSync(join(WEB, "lib/auth/client.ts"), "utf8")).toMatch(/passkeyClient\(\)/);
  const form = readFileSync(join(WEB, "features/F1/login/login-form.tsx"), "utf8");
  expect(form).not.toMatch(/k-login-off|Unbuilt/);
});

test("K317-UI-024 キーボード：Tab は パスキーで入る → スマホで QR を読み取る → メール → パスワード（→ 見る・隠す）→ 次へ → パスワードを忘れた → 端末をなくした → アカウントを作る の順。Enter で「端末をなくした」を押すと端末をなくしたときへ", async ({
  page,
  baseURL,
}) => {
  await mockAuth(page);
  await open(page, local(baseURL));
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  const seen: string[] = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || !e.closest('[data-part="auth-box"]')) return "";
      return (e.getAttribute("aria-label") ?? e.textContent ?? "").trim();
    });
    if (name && !seen.includes(name)) seen.push(name);
  }
  const want = [
    "パスキーで入る",
    "スマホで QR を読み取る",
    "メールアドレス",
    "パスワード",
    "次へ",
    "パスワードを忘れた",
    "端末をなくした",
    "アカウントを作る",
  ];
  expect(seen.filter((s) => want.includes(s))).toEqual(want);
  await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(`${BOX} h1`)).toHaveText("端末をなくしたとき");
});

test("K317-UI-025 幅 320・375・768・1024・1440：端末をなくしたとき・入れました・帯 2 本 の 3 つで、横のはみ出し 0・h1 の 1 文字目が画面の中・帯は画面の幅いっぱい", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240_000);
  await page.clock.install({ time: NOW });
  const bad: string[] = [];
  for (const w of [320, 375, 768, 1024, 1440]) {
    for (const st of ["recover", "added", "status"] as const) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      const m = await mockAuth(page);
      if (st === "status")
        m.on.status = () => ({
          status: 200,
          body: {
            data: {
              incidents: [
                { state: "investigating", title: "分身の実行が遅れています", started_at: "2026-11-18T01:20:00Z" },
              ],
              maintenance: MAINT_NOW,
            },
          },
        });
      if (st === "added") await authenticator(page, "usb");
      await open(page, local(baseURL), w);
      if (st === "recover") await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).click();
      if (st === "added") {
        await passkeyBtn(page).click();
        await expect(page.locator(`${BOX} h1`)).toHaveText("入れました");
      }
      const r = await page.evaluate(() => {
        const h = document.querySelector('[data-part="auth-box"] h1')!;
        const t = document.createTreeWalker(h, NodeFilter.SHOW_TEXT).nextNode()!;
        const rg = document.createRange();
        rg.setStart(t, 0);
        rg.setEnd(t, 1);
        const strip = document.querySelector(".k-status-strip");
        return {
          over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          left: rg.getBoundingClientRect().left,
          strip: strip ? Math.round(strip.getBoundingClientRect().width) : null,
        };
      });
      if (r.over !== 0) bad.push(`${st} 幅 ${w}：横に ${r.over}px`);
      if (r.left < 0) bad.push(`${st} 幅 ${w}：h1 の 1 文字目が左の外`);
      if (st === "status" && r.strip !== w) bad.push(`${st} 幅 ${w}：帯の幅 ${r.strip}`);
    }
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

// ---- モックの写しと本番の写しを同じ幅で比べる（正の絵＝モック /dev/mock/f1/<状態>） ----
type Drive = (page: Page) => Promise<void>;
const base = () => local(process.env["BASE_URL"] ?? "http://127.0.0.1:3123");
const atLogin =
  (prep?: (m: Mock, page: Page) => Promise<void> | void, q?: string): Drive =>
  async (page) => {
    await page.clock.install({ time: NOW });
    const m = await mockAuth(page, { twoFactor: true });
    if (prep) await prep(m, page);
    await open(page, base(), page.viewportSize()!.width, q);
  };
const STATUS_BOTH = {
  status: 200,
  body: {
    data: {
      incidents: [{ state: "investigating", title: "分身の実行が遅れています", started_at: "2026-11-18T01:20:00Z" }],
      maintenance: MAINT_NOW,
    },
  },
};
const toRecover =
  (ask?: Reply): Drive =>
  async (page) => {
    const m = await mockAuth(page, { twoFactor: true });
    if (ask) m.on.recover = () => ask;
    await open(page, base(), page.viewportSize()!.width);
    await passwordToCode(page);
    await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).click();
    if (ask) {
      await recoverCard(page, "ワークスペースの管理者に再設定を頼む").click();
      await expect(page.locator(`${BOX} .k-auth-result`)).toBeVisible();
    }
  };
const STATES: [string, Drive][] = [
  [
    "login-pk-failed",
    async (page) => {
      await refusePasskey(page);
      await atLogin()(page);
      await passkeyBtn(page).click();
      await expect(page.locator(BOX).getByRole("alert")).toBeVisible();
    },
  ],
  [
    "login-pk-unsupported",
    atLogin(async (_, page) => {
      await page.addInitScript(() => {
        delete (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential;
      });
    }),
  ],
  [
    "login-added",
    async (page) => {
      await authenticator(page, "usb");
      await atLogin()(page);
      await passkeyBtn(page).click();
      await expect(page.locator(`${BOX} h1`)).toHaveText("入れました");
    },
  ],
  [
    "login-recover",
    async (page) => {
      await atLogin()(page);
      await page.locator(BOX).getByRole("button", { name: "端末をなくした" }).click();
    },
  ],
  ["login-recover-ready", toRecover()],
  ["login-recover-sent", toRecover({ status: 201, body: { data: { result: "sent" } } })],
  ["login-recover-no-admin", toRecover({ status: 201, body: { data: { result: "no_admin" } } })],
  ["login-recover-failed", toRecover({ status: 201, body: { data: { result: "failed" } } })],
  [
    "login-other-account",
    async (page) => {
      await mockAuth(page);
      await signedIn(page, "kimura@engine-base.example");
      await open(page, base(), page.viewportSize()!.width, `?next=${encodeURIComponent("/invite/abc")}`);
    },
  ],
  [
    "login-status-incident",
    atLogin((m) => {
      m.on.status = () => ({ ...STATUS_BOTH, body: { data: { ...STATUS_BOTH.body.data, maintenance: null } } });
    }),
  ],
  [
    "login-status-both",
    atLogin((m) => {
      m.on.status = () => STATUS_BOTH;
    }),
  ],
];

for (const [id, drive] of STATES) {
  for (const w of MATCH_WIDTHS) {
    test(`K317-UI-026 ${id} 幅 ${w}：本番の画面の値（箱・見出し・文・カード・知らせ・帯・ボタン）と読み込んだ書体が、モック /dev/mock/f1/${id} と同じ`, async ({
      browser,
    }) => {
      const { bad } = await matchMock(browser, id, w, drive, { blur: true });
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}
