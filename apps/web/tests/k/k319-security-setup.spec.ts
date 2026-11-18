// K-319「ログインと安全の画面を口につなぐ：2 段階認証を付ける・バックアップコード・パスワードを変える／決める・登録の直後の付けるまで進めない」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f1/sec-forced・sec-forced-back（入口の枠）・sec-totp・sec-totp-error・sec-backup・sec-password-change・sec-password-set（外枠の中の小窓）。部品は features/F1/security/views.tsx。
//   モックとの見た目の比べ方は共通の道具 stage2-match.ts の matchMock だけ（精査の後の決め 11）。
//   口（getMySecurity・startTwoFactor（体 { password }・15 分の外は 403）・confirmTwoFactor（201 { backup_codes, token }）・changePassword・
//     setMyPassword（POST /api/v1/me/password・体 { new_password }・201 { ok: true }）・stepUp・signOut・パスキーの部品の口・外枠の口）は網の手前で差し替える。
//   印の立った人のほかの口は 403・code MFA_REQUIRED（K-321 で決まった）。この試験は 403 を差し替えで作って画面の戻しを確かめる（決め 8）。
//   2 段階を付けた後は答えの token で画面の印を差し替える（決め 9）。代表の答え ②（パスキーだけの人もパスワードを決めて 2 段階を付けられる）・③（ログアウト）・⑮（戻された知らせ）。
//   パスキーは CDP の仮の認証器（WebAuthn は IP を RP にできないので localhost の道で開く）。本人の Bridge（127.0.0.1:38617）にも届かせない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { MATCH_WIDTHS, matchMock, type MatchOptions } from "./stage2-match";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
/** 文は番号で引く（精査の後の決め 1）。E-AUTH-017・020 は K-311、E-AUTH-019 は K-321 が足す */
const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;

const WS = "aaaaaaaa-0000-4000-8000-000000000319";
const ME = "11111111-0000-4000-8000-000000000319";
const SEC = 'section[aria-labelledby="security-title"]';
const BOX = '[data-part="auth-box"]';
const ME_SUB = '[aria-label="自分の設定の中"]';
const NOW = "2026-11-18T03:00:00Z";
const PW = "correct-horse-battery-1";
const NEW_PW = "new-horse-battery-22";
const SECRET = "JBSWY3DPEHPK3PXP";
const URI = `otpauth://totp/Kaname:takamoto?secret=${SECRET}&issuer=Kaname`;
const OLD_TOKEN = `tok-${WS}`;
const NEW_TOKEN = "tok-after-2fa-319";
const CODES = [
  "7kqm-2xpa",
  "q9rt-6lmv",
  "h2dw-8nce",
  "p5xb-3jfu",
  "m8zk-1tqs",
  "c4vn-7hry",
  "w6ge-9pld",
  "t3ja-5bxk",
  "r1uf-4mwz",
  "e7lc-2yqn",
];
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const PK_FAIL = "パスキーを付けられませんでした。もう一度試すか、2 段階認証を使ってください";
const CRED_ID = Buffer.from("k319-credential-pk1");

test.use({ timezoneId: "UTC" });

interface Sec {
  passkeys: { id: string; name: string; created_at: string; last_used_at: string | null; synced: boolean }[];
  has_password: boolean;
  two_factor: boolean;
  backup_codes_left: number | null;
  mfa_pending: boolean;
}
const PK = { id: "pk1", name: "Mac（Chrome）", created_at: "2026-09-12T01:00:00Z", last_used_at: null, synced: false };
const PASSWORD_ONLY: Sec = {
  passkeys: [],
  has_password: true,
  two_factor: false,
  backup_codes_left: null,
  mfa_pending: false,
};
const PASSWORD_2FA: Sec = { ...PASSWORD_ONLY, two_factor: true, backup_codes_left: 9 };
const PASSKEY_ONLY: Sec = {
  passkeys: [PK],
  has_password: false,
  two_factor: false,
  backup_codes_left: null,
  mfa_pending: false,
};
const PENDING: Sec = { ...PASSWORD_ONLY, mfa_pending: true };

type Reply = { status: number; body: unknown };
interface Mock {
  sec: Sec;
  reads: number;
  readAuth: (string | undefined)[];
  starts: Record<string, unknown>[];
  confirms: Record<string, unknown>[];
  passwords: Record<string, unknown>[];
  sets: Record<string, unknown>[];
  stepUps: { body: Record<string, unknown>; challenge: string | undefined }[];
  authOptions: number;
  signOuts: number;
  regVerify: number;
  once: Partial<Record<"start" | "confirm" | "password" | "set", Reply>>;
  /** 始める・変える・決めるが取り直しを求める（stepUp が通るまで 403） */
  needStepUp: boolean;
  /** confirmTwoFactor の答えの token（null なら差し替えない） */
  newToken: string | null;
}
const ok = (data: unknown, status = 200): Reply => ({ status, body: { data, meta: {} } });
const err = (status: number, code: string, message?: string): Reply => ({
  status,
  body: { error: code.toLowerCase(), code, message },
});
const fieldErr = (field: string, message: string): Reply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
/** 自分の安全の設定・取り直し・ログアウト・付ける口は印が立っていても開く（K-321 の MFA_OPEN_OPS と同じ） */
const MFA_OPEN = [
  "/api/v1/me/security",
  "/api/v1/auth/step-up",
  "/api/v1/auth/sign-out",
  "/api/v1/me/two-factor/enable",
  "/api/v1/me/two-factor/confirm",
  "/api/auth/passkey/generate-register-options",
  "/api/auth/passkey/verify-registration",
];

/** mockApi を呼んだ回数（印を 1 回だけ置く目印を呼ぶごとに分ける） */
let seedRuns = 0;
async function mockApi(page: Page, sec: Sec, o: Partial<Mock> = {}): Promise<Mock> {
  const m: Mock = {
    sec: structuredClone(sec),
    reads: 0,
    readAuth: [],
    starts: [],
    confirms: [],
    passwords: [],
    sets: [],
    stepUps: [],
    authOptions: 0,
    signOuts: 0,
    regVerify: 0,
    once: {},
    needStepUp: false,
    newToken: NEW_TOKEN,
    ...o,
  };
  const take = (k: keyof Mock["once"]): Reply | undefined => {
    const v = m.once[k];
    delete m.once[k];
    return v;
  };
  // 印を置くのは、この mockApi の後の最初の画面で 1 回だけ（K-338）。開くたびに置き直すと、画面が印を消してログインへ移した
  //   （401 の toLogin・ログアウト）後のログインの画面にも印が戻り、その画面の口の 403・MFA_REQUIRED で /mfa-setup へ移り始めて
  //   試験の次の page.goto と先を取り合う（揺れ）。本物ではログインへ移った後は印が無い。mockApi を呼び直すと新しい目印で 1 回置く
  seedRuns += 1;
  await page.addInitScript(
    ([t, key]) => {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
      if (!window.localStorage.getItem("kaname.token")) window.localStorage.setItem("kaname.token", t);
    },
    [OLD_TOKEN, `k338.seeded.${seedRuns}`] as const,
  );
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const method = req.method();
    const body = () => (req.postDataJSON() as Record<string, unknown> | null) ?? {};
    let r: Reply = err(404, "NOT_FOUND");
    if (m.sec.mfa_pending && !MFA_OPEN.includes(p)) {
      // 印の立った人のほかの口（入口の止めは K-321。ここでは差し替えで作る）
      r = err(403, "MFA_REQUIRED", msg("E-AUTH-019"));
    } else if (method === "GET" && p === "/api/v1/me/security") {
      m.reads += 1;
      m.readAuth.push(req.headers()["authorization"]);
      r = ok({ ...m.sec, two_factor_required: m.sec.has_password && m.sec.passkeys.length === 0 });
    } else if (method === "POST" && p === "/api/v1/auth/step-up") {
      m.stepUps.push({ body: body(), challenge: req.headers()["x-passkey-challenge"] });
      m.needStepUp = false;
      r = ok({ step_up_at: NOW }, 201);
    } else if (method === "POST" && p === "/api/v1/auth/sign-out") {
      m.signOuts += 1;
      r = ok({ signed_out: true });
    } else if (method === "POST" && p === "/api/v1/me/two-factor/enable") {
      m.starts.push(body());
      r =
        take("start") ??
        (m.needStepUp
          ? err(403, "STEP_UP_REQUIRED")
          : ok({ otpauth_uri: `${URI}&n=${m.starts.length}`, secret: SECRET }, 201));
    } else if (method === "POST" && p === "/api/v1/me/two-factor/confirm") {
      m.confirms.push(body());
      r = take("confirm") ?? ok({ backup_codes: CODES, token: m.newToken }, 201);
      if (r.status === 201) m.sec = { ...m.sec, two_factor: true, backup_codes_left: 10, mfa_pending: false };
    } else if (method === "PATCH" && p === "/api/v1/me/password") {
      m.passwords.push(body());
      r = take("password") ?? (m.needStepUp ? err(403, "STEP_UP_REQUIRED") : ok({ revoked: 2 }));
    } else if (method === "POST" && p === "/api/v1/me/password") {
      m.sets.push(body());
      r = take("set") ?? (m.needStepUp ? err(403, "STEP_UP_REQUIRED") : ok({ ok: true }, 201));
      if (r.status === 201) m.sec = { ...m.sec, has_password: true };
    } else if (p === "/api/auth/passkey/generate-register-options") {
      r = {
        status: 200,
        body: {
          challenge: b64("k319-challenge"),
          rp: { name: "Kaname", id: new URL(page.url()).hostname },
          user: { id: b64(ME), name: "takamoto@example.com", displayName: "高本" },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          timeout: 60_000,
          attestation: "none",
          excludeCredentials: [],
          authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
          challenge_token: "ctk-reg-319",
        },
      };
    } else if (p === "/api/auth/passkey/generate-authenticate-options") {
      m.authOptions += 1;
      r = {
        status: 200,
        body: {
          challenge: b64(`k319-auth-${m.authOptions}`),
          rpId: new URL(page.url()).hostname,
          allowCredentials: [{ id: b64(CRED_ID), type: "public-key" }],
          userVerification: "preferred",
          timeout: 60_000,
          challenge_token: `ctk-auth-${m.authOptions}`,
        },
      };
    } else if (p === "/api/auth/passkey/verify-registration") {
      m.regVerify += 1;
      m.sec = { ...m.sec, mfa_pending: false, passkeys: [PK] };
      r = { status: 200, body: { id: "pk1" } };
    } else if (p === "/api/auth-ext/me" || p === "/api/v1/me")
      r = ok({
        member_id: ME,
        tenant_id: WS,
        display_name: "高本",
        role_id: "owner",
        scope_id: null,
        workspace_name: "ENGINE BASE",
      });
    else if (p === "/api/v1/scopes") r = { status: 200, body: { data: [], meta: { limit: 200, writable: [] } } };
    else if (p === "/api/v1/approvals/queue")
      r = { status: 200, body: { data: [], meta: { limit: 20, counts: { total: 0 }, cursor: null } } };
    else if (p === "/api/v1/bridge/devices") r = ok([]);
    else if (p === "/api/v1/tickets") r = { status: 200, body: { data: [], meta: { limit: 50, cursor: null } } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}
const localUrl = (path: string): string => {
  const base = String(test.info().project.use.baseURL ?? "http://127.0.0.1:3123");
  return new URL(path, base.replace("127.0.0.1", "localhost")).toString();
};
async function open(page: Page, width = 1440, path = "/mfa-setup", local = false) {
  await page.clock.setFixedTime(new Date(NOW));
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(local ? localUrl(path) : path);
  expect(res?.status()).toBe(200);
}
async function openList(page: Page, width = 1440, local = false) {
  await open(page, width, "/mfa-setup", local);
  await expect(page.locator(`${SEC} .k-sec-summary`)).toBeVisible();
}
async function authenticator(page: Page, opts: { verified?: boolean; withCredential?: boolean } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: opts.verified ?? true,
      automaticPresenceSimulation: true,
    },
  });
  if (opts.verified === false) await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: false });
  if (opts.withCredential) {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    await cdp.send("WebAuthn.addCredential", {
      authenticatorId,
      credential: {
        credentialId: CRED_ID.toString("base64"),
        isResidentCredential: true,
        rpId: "localhost",
        privateKey: (privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).toString("base64"),
        userHandle: Buffer.from(ME).toString("base64"),
        signCount: 0,
      },
    });
  }
}
/** 本番の画面の道の移り（主の枠だけ）を全部ためる。/ に着いてすぐ別の画面へ移っても、/ に着いたことを見られる */
function pathsSeen(page: Page): string[] {
  const seen: string[] = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) seen.push(f.url());
  });
  return seen;
}
const row = (page: Page, text: string) => page.locator(`${SEC} .k-set-row`, { hasText: text }).first();
const totpDialog = (page: Page) => page.getByRole("dialog", { name: "2 段階認証を付ける" });
const backupDialog = (page: Page) => page.getByRole("dialog", { name: "バックアップコード" });
const pwDialog = (page: Page) => page.getByRole("dialog", { name: "パスワードを変える" });
const setDialog = (page: Page) => page.getByRole("dialog", { name: "パスワードを決める" });
const checkDialog = (page: Page) => page.getByRole("dialog", { name: "本人か確かめます" });
const box = (page: Page, i: number) => page.getByLabel(`確認のコード ${i} けた目`);
const choice = (page: Page, text: string) => page.locator(`${BOX} .k-auth-choice`, { hasText: text });
const toTwoFactor = (page: Page) => row(page, "認証アプリ").getByRole("button", { name: "付ける", exact: true });

/** 2 段階の「付ける」→ 本人確認のパスワード → QR まで */
async function startTotp(page: Page, password = PW) {
  await toTwoFactor(page).click();
  await confirmWith(page, password);
  await expect(totpDialog(page)).toBeVisible();
}
async function confirmWith(page: Page, password = PW) {
  await expect(checkDialog(page)).toContainText("2 段階認証を付ける前に、本人か確かめます");
  await checkDialog(page).getByLabel("パスワード", { exact: true }).fill(password);
  await checkDialog(page).getByRole("button", { name: "確かめる" }).click();
}
async function typeCode(page: Page, code: string) {
  await box(page, 1).click();
  await page.keyboard.type(code);
}
async function openPw(page: Page) {
  await row(page, "使うなら 12 文字以上").getByRole("button", { name: "変える", exact: true }).click();
  await expect(pwDialog(page)).toBeVisible();
}
async function fillPw(page: Page, cur: string, next: string, again: string) {
  await pwDialog(page).getByLabel("今のパスワード", { exact: true }).fill(cur);
  await pwDialog(page).getByLabel("新しいパスワード", { exact: true }).fill(next);
  await pwDialog(page).getByLabel("もう一度", { exact: true }).fill(again);
}
async function fillSet(page: Page, pw = NEW_PW) {
  await setDialog(page).getByLabel("新しいパスワード", { exact: true }).fill(pw);
  await setDialog(page).getByLabel("もう一度", { exact: true }).fill(pw);
  await setDialog(page).getByRole("button", { name: "決める", exact: true }).click();
}

// ---------------------------------------------------------------- 2 段階認証を付ける

test("K319-UI-001 パスワードのある人が「付ける」→ 本人確認のパスワード：startTwoFactor が 1 回（{ password }）・小窓の題・本人確認が済み・QR・鍵の字は 4 字ずつ・最初の枠に焦点", async ({
  page,
}) => {
  const m = await mockApi(page, PASSWORD_ONLY);
  await openList(page);
  await startTotp(page);
  expect(m.starts).toEqual([{ password: PW }]);
  const d = totpDialog(page);
  await expect(d.locator(".k-set-step-title").first()).toHaveText("本人確認");
  await expect(d.locator('.k-set-step-dot[data-state="done"]').first()).toBeVisible();
  await expect(d.getByRole("img", { name: "認証アプリで読み取る QR" })).toBeVisible();
  await expect(d.locator(".k-auth-secret")).toHaveText("JBSW Y3DP EHPK 3PXP");
  await expect(box(page, 1)).toBeFocused();
});

test("K319-UI-002 6 けた目を打つ：確かめが 1 回・コード 10 個・答えの token に印を差し替えてから読み直す（Authorization が新しい印）・「付けている」「残り 10 個」・再読み込みでコードは 0 個", async ({
  page,
}) => {
  const m = await mockApi(page, PASSWORD_ONLY);
  await openList(page);
  await startTotp(page);
  await typeCode(page, "123456");
  await expect(backupDialog(page).locator(".k-backup-code")).toHaveCount(10);
  await expect(totpDialog(page)).toHaveCount(0);
  expect(m.confirms).toEqual([{ code: "123456" }]);
  await backupDialog(page).getByRole("button", { name: "保存したので閉じる" }).click();
  await expect(row(page, "認証アプリ").locator(".k-set-pill")).toHaveText("付けている");
  await expect(row(page, "認証アプリ")).toContainText("残り 10 個");
  expect(m.reads).toBe(2);
  expect(m.readAuth[1]).toBe(`Bearer ${NEW_TOKEN}`);
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBe(NEW_TOKEN);
  await page.reload();
  await expect(page.locator(`${SEC} .k-sec-summary`)).toBeVisible();
  await expect(page.locator(".k-backup-code")).toHaveCount(0);
  await expect(row(page, "認証アプリ")).toContainText("残り 10 個");
});

test("K319-UI-003 全角の数字を打つ・空白入りを貼る：どちらも確かめの口の code は半角の 6 けた", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const m = await mockApi(page, PASSWORD_ONLY);
  await openList(page);
  await startTotp(page);
  await box(page, 1).click();
  await page.keyboard.insertText("１２３４５６");
  await expect.poll(() => m.confirms.length).toBe(1);
  await backupDialog(page).getByRole("button", { name: "保存したので閉じる" }).click();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const m2 = await mockApi(page, PASSWORD_ONLY);
  await openList(page);
  await startTotp(page);
  await box(page, 1).click();
  await page.evaluate(() => navigator.clipboard.writeText(" 123 456 "));
  await page.keyboard.press("ControlOrMeta+V");
  await expect.poll(() => m2.confirms.length).toBe(1);
  expect(m.confirms[0]).toEqual({ code: "123456" });
  expect(m2.confirms[0]).toEqual({ code: "123456" });
});

test("K319-UI-004 違う 6 けた（422・E-AUTH-004）：小窓の中に文・6 つの枠は空・最初の枠に焦点・小窓は閉じない", async ({
  page,
}) => {
  await mockApi(page, PASSWORD_ONLY, { once: { confirm: err(422, "E-AUTH-004", msg("E-AUTH-004")) } });
  await openList(page);
  await startTotp(page);
  await typeCode(page, "000000");
  await expect(totpDialog(page).locator('[role="alert"]')).toHaveText(msg("E-AUTH-004"));
  for (let i = 1; i <= 6; i += 1) await expect(box(page, i)).toHaveValue("");
  await expect(box(page, 1)).toBeFocused();
  await expect(totpDialog(page)).toBeVisible();
});

test("K319-UI-005 二度送り：6 けた目の直後に Enter でも確かめは 1 回／「変える」を 2 回続けて押しても変えるの口は 1 回", async ({
  page,
}) => {
  const m = await mockApi(page, PASSWORD_ONLY);
  await openList(page);
  await startTotp(page);
  await typeCode(page, "123456");
  await page.keyboard.press("Enter");
  await expect(backupDialog(page)).toHaveCount(1);
  expect(m.confirms).toHaveLength(1);
  await backupDialog(page).getByRole("button", { name: "保存したので閉じる" }).click();
  await openPw(page);
  await fillPw(page, PW, NEW_PW, NEW_PW);
  await pwDialog(page).getByRole("button", { name: "変える", exact: true }).dblclick();
  await expect(pwDialog(page)).toHaveCount(0);
  expect(m.passwords).toHaveLength(1);
});

test("K319-UI-006 パスワードの無い人が「付ける」：先にパスワードを決める → 本人確認は決めたパスワード → startTwoFactor 1 回 → QR", async ({
  page,
}) => {
  const m = await mockApi(page, PASSKEY_ONLY);
  await openList(page);
  await toTwoFactor(page).click();
  await expect(setDialog(page)).toBeVisible();
  await fillSet(page);
  await expect(setDialog(page)).toHaveCount(0);
  expect(m.sets).toEqual([{ new_password: NEW_PW }]);
  await confirmWith(page, NEW_PW);
  await expect(totpDialog(page).getByRole("img", { name: "認証アプリで読み取る QR" })).toBeVisible();
  expect(m.starts).toEqual([{ password: NEW_PW }]);
});

test("K319-UI-007 別のタブで先に付けた（409・E-AUTH-017）：小窓が閉じ、知らせに文・読み直して「付けている」", async ({
  page,
}) => {
  const m = await mockApi(page, PASSWORD_ONLY, { once: { start: err(409, "E-AUTH-017", msg("E-AUTH-017")) } });
  await openList(page);
  m.sec = { ...m.sec, two_factor: true, backup_codes_left: 10 };
  await toTwoFactor(page).click();
  await confirmWith(page);
  await expect(page.getByText(msg("E-AUTH-017")).first()).toBeVisible();
  await expect(totpDialog(page)).toHaveCount(0);
  await expect(row(page, "認証アプリ").locator(".k-set-pill")).toHaveText("付けている");
});

test("K319-UI-008 本人確認：違うパスワード（422・欄 password）は欄の下に口の文で留まる／15 分の外（403）は取り直しの後に始めるをもう 1 回だけ送り QR", async ({
  page,
}) => {
  const wrong = "パスワードが違います";
  await mockApi(page, PASSWORD_ONLY, { once: { start: fieldErr("password", wrong) } });
  await openList(page);
  await toTwoFactor(page).click();
  await confirmWith(page, "wrong-password-000");
  await expect(checkDialog(page)).toContainText(wrong);
  await expect(checkDialog(page)).toBeVisible();
  await expect(totpDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/mfa-setup$/);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  const m = await mockApi(page, PASSWORD_ONLY, { needStepUp: true });
  await openList(page);
  await toTwoFactor(page).click();
  await confirmWith(page);
  const again = checkDialog(page);
  await expect(again).toContainText("2 段階認証を付ける前に、本人か確かめます");
  await again.getByLabel("パスワード", { exact: true }).fill(PW);
  await again.getByRole("button", { name: "確かめる" }).click();
  await expect(totpDialog(page).getByRole("img", { name: "認証アプリで読み取る QR" })).toBeVisible();
  expect(m.stepUps.map((s) => s.body)).toEqual([{ password: PW }]);
  expect(m.starts).toEqual([{ password: PW }, { password: PW }]);
});

test("K319-UI-009 一覧が古く、始めるが 409・E-AUTH-020（パスワードがまだ無い）：小窓「パスワードを決める」に E-AUTH-020 の文・QR は出ない", async ({
  page,
}) => {
  const m = await mockApi(page, PASSWORD_ONLY, { once: { start: err(409, "E-AUTH-020", msg("E-AUTH-020")) } });
  await openList(page);
  await toTwoFactor(page).click();
  await confirmWith(page);
  await expect(setDialog(page)).toBeVisible();
  await expect(setDialog(page)).toContainText(msg("E-AUTH-020"));
  await expect(totpDialog(page)).toHaveCount(0);
  expect(m.starts).toHaveLength(1);
});

test("K319-UI-010 ダウンロード・写す・印刷：ファイル名と中身 10 行／clipboard に 10 行／print が 1 回。口は呼ばない", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => {
      (window as unknown as { __prints: number }).__prints += 1;
    };
  });
  const m = await mockApi(page, PASSWORD_ONLY);
  await openList(page);
  await startTotp(page);
  await typeCode(page, "123456");
  const d = backupDialog(page);
  const before = { reads: m.reads, confirms: m.confirms.length, starts: m.starts.length };
  const dl = page.waitForEvent("download");
  await d.getByRole("button", { name: "ダウンロード（.txt）" }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe("kaname-backup-codes.txt");
  const text = readFileSync((await file.path())!, "utf8");
  for (const c of CODES) expect(text).toContain(c);
  await d.getByRole("button", { name: "写す" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip.split("\n").filter(Boolean)).toEqual(CODES);
  await d.getByRole("button", { name: "印刷" }).click();
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
  expect({ reads: m.reads, confirms: m.confirms.length, starts: m.starts.length }).toEqual(before);
});

test("K319-UI-011 確かめは通ったが答えにコードが無い：バックアップコードの小窓は出ず、知らせ・札は「付けている」", async ({
  page,
}) => {
  await mockApi(page, PASSWORD_ONLY, { once: { confirm: ok({ backup_codes: null, token: null }, 201) } });
  await openList(page);
  await startTotp(page);
  await typeCode(page, "123456");
  await expect(page.getByText("付きました。バックアップコードを作り直してください").first()).toBeVisible();
  await expect(backupDialog(page)).toHaveCount(0);
  await expect(row(page, "認証アプリ").locator(".k-set-pill")).toHaveText("付けている");
});

test("K319-UI-012 「やめる」→ もう一度「付ける」：確かめの口は 0 回・札はそのまま・付けるの口は 2 回目", async ({
  page,
}) => {
  const m = await mockApi(page, PASSWORD_ONLY);
  await openList(page);
  await startTotp(page);
  await totpDialog(page).getByRole("button", { name: "やめる" }).click();
  await expect(totpDialog(page)).toHaveCount(0);
  await expect(row(page, "認証アプリ").locator(".k-set-pill")).toHaveText("必須・付けていない");
  await startTotp(page);
  expect(m.confirms).toHaveLength(0);
  expect(m.starts).toHaveLength(2);
});

// ---------------------------------------------------------------- パスワードを変える・決める

test("K319-UI-013 パスワードを変えるの 3 つの欄：既定は隠す・見る隠すで切り替わる", async ({ page }) => {
  await mockApi(page, PASSWORD_2FA);
  await openList(page);
  await openPw(page);
  for (const label of ["今のパスワード", "新しいパスワード", "もう一度"]) {
    const f = pwDialog(page).getByLabel(label, { exact: true });
    await expect(f).toHaveAttribute("type", "password");
    const toggle = f.locator("xpath=ancestor::*[contains(@class,'k-field')][1]").getByRole("button");
    await toggle.click();
    await expect(f).toHaveAttribute("type", "text");
    await toggle.click();
    await expect(f).toHaveAttribute("type", "password");
  }
});

test("K319-UI-014 変える：口が 1 回・閉じて知らせ・この画面に残る", async ({ page }) => {
  const m = await mockApi(page, PASSWORD_2FA);
  await openList(page);
  await openPw(page);
  await fillPw(page, PW, NEW_PW, NEW_PW);
  await pwDialog(page).getByRole("button", { name: "変える", exact: true }).click();
  await expect(pwDialog(page)).toHaveCount(0);
  await expect(page.getByText("パスワードを変えました。ほかの端末と PC は入り直しになります").first()).toBeVisible();
  await expect(page).toHaveURL(/\/mfa-setup$/);
  expect(m.passwords).toEqual([{ current_password: PW, new_password: NEW_PW }]);
});

test("K319-UI-015 変えるの入力：11 文字は E-VAL-005・2 つが違うと文（口は 0 回）／今のパスワード違い・漏れたパスワード（422 と欄）はその欄の下に口の文・値は残る・ログインへ移らない", async ({
  page,
}) => {
  const wrong = "今のパスワードが違います";
  const leaked = "このパスワードは漏れたことがあるので使えません";
  const m = await mockApi(page, PASSWORD_2FA);
  await openList(page);
  await openPw(page);
  await fillPw(page, PW, "a".repeat(11), "a".repeat(11));
  await pwDialog(page).getByRole("button", { name: "変える", exact: true }).click();
  await expect(pwDialog(page)).toContainText(msg("E-VAL-005"));
  await fillPw(page, PW, NEW_PW, `${NEW_PW}x`);
  await pwDialog(page).getByRole("button", { name: "変える", exact: true }).click();
  await expect(pwDialog(page)).toContainText("2 つのパスワードが違います");
  expect(m.passwords).toHaveLength(0);
  m.once.password = fieldErr("current_password", wrong);
  await fillPw(page, "wrong-password-000", NEW_PW, NEW_PW);
  await pwDialog(page).getByRole("button", { name: "変える", exact: true }).click();
  await expect(pwDialog(page)).toContainText(wrong);
  await expect(pwDialog(page).getByLabel("新しいパスワード", { exact: true })).toHaveValue(NEW_PW);
  m.once.password = fieldErr("new_password", leaked);
  await pwDialog(page).getByRole("button", { name: "変える", exact: true }).click();
  await expect(pwDialog(page)).toContainText(leaked);
  await expect(pwDialog(page)).toBeVisible();
  await expect(page).toHaveURL(/\/mfa-setup$/);
});

test("K319-UI-016 別のタブで先に決めた（決めるが 409・CONFLICT）：小窓を閉じ、知らせに口の文・読み直して札「使っている」・ボタン「変える」", async ({
  page,
}) => {
  const already = "パスワードはもう決まっています。変えるときは「変える」から";
  const m = await mockApi(page, PASSKEY_ONLY, { once: { set: err(409, "CONFLICT", already) } });
  await openList(page);
  m.sec = { ...m.sec, has_password: true };
  await row(page, "使うなら 12 文字以上").getByRole("button", { name: "決める", exact: true }).click();
  await fillSet(page);
  await expect(setDialog(page)).toHaveCount(0);
  await expect(page.getByText(already).first()).toBeVisible();
  await expect(row(page, "使うなら 12 文字以上").locator(".k-set-pill")).toHaveText("使っている");
  await expect(row(page, "使うなら 12 文字以上").getByRole("button", { name: "変える", exact: true })).toBeVisible();
});

test("K319-UI-017 変えるが 403（取り直し）：小窓の字・stepUp の後に変えるの口がもう 1 回だけ", async ({ page }) => {
  const m = await mockApi(page, PASSWORD_2FA, { needStepUp: true });
  await openList(page);
  await openPw(page);
  await fillPw(page, PW, NEW_PW, NEW_PW);
  await pwDialog(page).getByRole("button", { name: "変える", exact: true }).click();
  const d = checkDialog(page);
  await expect(d).toContainText("パスワードを変える前に、本人か確かめます");
  await d.getByLabel("パスワード", { exact: true }).fill(PW);
  await d.getByLabel("確認のコード 1 けた目").fill("123456");
  await d.getByRole("button", { name: "確かめる" }).click();
  await expect(page.getByText("パスワードを変えました。ほかの端末と PC は入り直しになります").first()).toBeVisible();
  expect(m.passwords).toHaveLength(2);
});

test("K319-UI-018 パスワードの無い人が「決める」：今の欄が無い・決める口が 1 回・札「使っている」・ボタン「変える」・2 段階は押せる・「要りません」が無い", async ({
  page,
}) => {
  const m = await mockApi(page, PASSKEY_ONLY);
  await openList(page);
  await expect(page.locator(SEC).getByText("要りません")).toHaveCount(0);
  await expect(toTwoFactor(page)).toBeEnabled();
  await row(page, "使うなら 12 文字以上").getByRole("button", { name: "決める", exact: true }).click();
  const d = setDialog(page);
  await expect(d.locator(".k-dialog-title")).toHaveText("パスワードを決める");
  await expect(d.getByLabel("今のパスワード", { exact: true })).toHaveCount(0);
  await fillSet(page);
  await expect(d).toHaveCount(0);
  expect(m.sets).toEqual([{ new_password: NEW_PW }]);
  expect(m.passwords).toHaveLength(0);
  await expect(row(page, "使うなら 12 文字以上").locator(".k-set-pill")).toHaveText("使っている");
  await expect(row(page, "使うなら 12 文字以上").getByRole("button", { name: "変える", exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- 付けるまで進めない

test("K319-UI-019 印の立った人：外枠（.k-shell）と第 2 ナビ（aside）が無く、入口の枠に h1・札 2 つ・注・ログアウト・足元は困ったとき・戻された知らせは無い", async ({
  page,
}) => {
  await mockApi(page, PENDING);
  await open(page);
  await expect(page.locator(`${BOX} h1`)).toHaveText("入り方を 1 つ足してください");
  await expect(page.locator(".k-shell")).toHaveCount(0);
  await expect(page.locator(ME_SUB)).toHaveCount(0);
  await expect(page.locator(SEC)).toHaveCount(0);
  expect((await page.locator(`${BOX} .k-auth-choice`).allInnerTexts()).map((t) => t.split("\n")[0]!.trim())).toEqual([
    "パスキーを付ける（おすすめ）",
    "2 段階認証を付ける",
  ]);
  await expect(page.locator(`${BOX} .k-auth-note-box`).last()).toContainText(
    "付け終わるまで、ほかの画面には進めません。",
  );
  await expect(page.locator(BOX).getByRole("button", { name: "ログアウト", exact: true })).toBeVisible();
  await expect(page.locator(BOX).getByText(msg("E-AUTH-019"))).toHaveCount(0);
  const foot = page.getByRole("navigation", { name: "Kaname について" });
  expect((await foot.getByRole("link").allInnerTexts()).map((x) => x.trim())).toEqual(["困ったとき"]);
});

test("K319-UI-020 印の立った人が /tickets・/approvals を開く（ほかの口が 403・MFA_REQUIRED）：/mfa-setup?next=…&back=1 へ移り、戻された知らせ（E-AUTH-019）が出る", async ({
  page,
}) => {
  await mockApi(page, PENDING);
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [path, enc] of [
    ["/tickets", "%2Ftickets"],
    ["/approvals", "%2Fapprovals"],
  ] as const) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/mfa-setup\\?next=${enc}&back=1$`));
    await expect(page.locator(`${BOX} h1`)).toHaveText("入り方を 1 つ足してください");
    await expect(page.locator(BOX).getByText(msg("E-AUTH-019"))).toBeVisible();
  }
});

test("K319-UI-021 付けるまで進めない → パスキー／2 段階で付け終わる：印が下りて next（/tickets）へ。next が無ければ / へ移る（/ に着いたことを移りの記録で見る）・2 段階の後は新しい印", async ({
  page,
}) => {
  const m = await mockApi(page, PENDING);
  await page.goto(localUrl("/login"));
  await authenticator(page);
  await open(page, 1440, `/mfa-setup?next=${encodeURIComponent("/tickets")}`, true);
  await choice(page, "パスキーを付ける").click();
  await page.getByRole("dialog", { name: "パスキーを足す" }).getByRole("button", { name: "足す", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  expect(m.regVerify).toBe(1);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.evaluate(() => window.localStorage.removeItem("kaname.token"));
  await mockApi(page, PENDING);
  await open(page, 1440, "/mfa-setup");
  const seen = pathsSeen(page);
  await choice(page, "2 段階認証を付ける").click();
  await confirmWith(page);
  await typeCode(page, "123456");
  await backupDialog(page).getByRole("button", { name: "保存したので閉じる" }).click();
  await expect.poll(() => seen.some((u) => new URL(u).pathname === "/")).toBe(true);
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBe(NEW_TOKEN);
});

test("K319-UI-022 パスキーだけの人の「決める」が 403（取り直し）：パスキーで確かめる（始めの口の challenge_token を頭で返す）→ 決めるをもう 1 回だけ", async ({
  page,
}) => {
  const m = await mockApi(page, PASSKEY_ONLY, { needStepUp: true });
  await openList(page, 1440, true);
  await authenticator(page, { withCredential: true });
  await row(page, "使うなら 12 文字以上").getByRole("button", { name: "決める", exact: true }).click();
  await fillSet(page);
  const d = checkDialog(page);
  await expect(d.getByLabel("パスワード", { exact: true })).toHaveCount(0);
  await d.getByRole("button", { name: "パスキーで確かめる" }).click();
  await expect(row(page, "使うなら 12 文字以上").locator(".k-set-pill")).toHaveText("使っている");
  expect(m.authOptions).toBe(1);
  expect(m.stepUps).toHaveLength(1);
  expect(Object.keys(m.stepUps[0]!.body)).toEqual(["passkey"]);
  expect(m.stepUps[0]!.challenge).toBe("ctk-auth-1");
  expect(m.sets).toEqual([{ new_password: NEW_PW }, { new_password: NEW_PW }]);
});

test("K319-UI-023 付けるまで進めない × 端末がやめた／パスキーに対応していないブラウザ", async ({ page, browser }) => {
  const m = await mockApi(page, PENDING);
  await page.goto(localUrl("/login"));
  await authenticator(page, { verified: false });
  await open(page, 1440, "/mfa-setup", true);
  await choice(page, "パスキーを付ける").click();
  await page.getByRole("dialog", { name: "パスキーを足す" }).getByRole("button", { name: "足す", exact: true }).click();
  await expect(page.getByText(PK_FAIL).first()).toBeVisible();
  await expect(page).toHaveURL(/\/mfa-setup/);
  expect(m.regVerify).toBe(0);

  const ctx = await browser.newContext({ timezoneId: "UTC" });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    // @ts-expect-error 試験のために WebAuthn を消す
    delete window.PublicKeyCredential;
  });
  await mockApi(p, PENDING);
  await open(p);
  const pk = choice(p, "パスキーを付ける");
  await expect(pk).toContainText("このブラウザはパスキーに対応していません。2 段階認証を使ってください");
  await expect(pk).toHaveAttribute("aria-disabled", "true");
  await choice(p, "2 段階認証を付ける").click();
  await expect(checkDialog(p)).toBeVisible();
  await ctx.close();
});

test("K319-UI-024 付けるまで進めないの「ログアウト」：signOut が 1 回・/login へ・ほかの口は呼ばない", async ({
  page,
}) => {
  const m = await mockApi(page, PENDING);
  await open(page);
  await expect(page.locator(`${BOX} h1`)).toHaveText("入り方を 1 つ足してください");
  const reads = m.reads;
  await page.locator(BOX).getByRole("button", { name: "ログアウト", exact: true }).click();
  await expect(page).toHaveURL(/\/login(\?|$)/);
  expect(m.signOuts).toBe(1);
  expect(m.reads).toBe(reads);
  expect(m.starts).toHaveLength(0);
});

test("K319-UI-025 付けるまで進めない × next が外の道：付け終わっても外へ出ず / へ移る（移りの記録で見る）", async ({
  page,
}) => {
  await mockApi(page, PENDING);
  await open(page, 1440, `/mfa-setup?next=${encodeURIComponent("https://evil.example/x")}`);
  const seen = pathsSeen(page);
  await choice(page, "2 段階認証を付ける").click();
  await confirmWith(page);
  await typeCode(page, "123456");
  await backupDialog(page).getByRole("button", { name: "保存したので閉じる" }).click();
  await expect.poll(() => seen.some((u) => new URL(u).pathname === "/")).toBe(true);
  expect(seen.filter((u) => new URL(u).hostname === "evil.example")).toEqual([]);
});

test("K319-UI-026 付けるまで進めないの途中でログインが切れた（401）→ 入り直して開くと付けるまで進めないから続く", async ({
  page,
}) => {
  const m = await mockApi(page, PENDING, { once: { start: err(401, "UNAUTHENTICATED") } });
  await open(page);
  await choice(page, "2 段階認証を付ける").click();
  await confirmWith(page);
  await expect(page).toHaveURL(/\/login\?next=%2Fmfa-setup/);
  // 401 で画面が印を消したことを見る（ログインの画面に印は戻らない）
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeNull();
  // 入り直す：試験が自分で印を置いてから開く（次の /mfa-setup の画面の最初に 1 回だけ置く。ログインの画面には置かない）
  await page.addInitScript((t) => {
    if (window.location.pathname !== "/mfa-setup" || window.sessionStorage.getItem("k338.relogin")) return;
    window.sessionStorage.setItem("k338.relogin", "1");
    window.localStorage.setItem("kaname.token", t);
  }, OLD_TOKEN);
  await open(page);
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBe(OLD_TOKEN);
  await expect(page.locator(`${BOX} h1`)).toHaveText("入り方を 1 つ足してください");
  await choice(page, "2 段階認証を付ける").click();
  await confirmWith(page);
  await expect(totpDialog(page).getByRole("img", { name: "認証アプリで読み取る QR" })).toBeVisible();
  expect(m.starts).toHaveLength(2);
});

test("K338-UI-001 試験の差し替えの作り（K-338）：401 で画面が印を消してログインへ移った後、差し替えは印を置き直さない（ログインの画面は /mfa-setup へ移り始めない）", async ({
  page,
}) => {
  await mockApi(page, PENDING, { once: { start: err(401, "UNAUTHENTICATED") } });
  const moves: string[] = [];
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) moves.push(r.url());
  });
  await open(page);
  await choice(page, "2 段階認証を付ける").click();
  await confirmWith(page);
  await expect(page).toHaveURL(/\/login\?next=%2Fmfa-setup$/);
  await page.waitForLoadState("networkidle"); // ログインの画面の口が全部返り終わるまで待つ（移り始めるならこの間に始まる）
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeNull();
  await expect(page).toHaveURL(/\/login\?next=%2Fmfa-setup$/);
  expect(moves.filter((u) => new URL(u).pathname === "/mfa-setup" && new URL(u).searchParams.has("back"))).toEqual([]);
});

// ---------------------------------------------------------------- モックと本番の突き合わせ（共通の道具 matchMock・決め 11）

const FORCED_PROD: Record<string, string> = {
  "sec-forced": "/mfa-setup",
  "sec-forced-back": `/mfa-setup?next=${encodeURIComponent("/tickets")}&back=1`,
};
for (const [id, path] of Object.entries(FORCED_PROD)) {
  for (const w of MATCH_WIDTHS) {
    test(`K319-UI-027 ${id} 幅 ${w}：付けるまで進めない（入口の箱・見出し・知らせ・説明・札・注の箱・ログアウト）の値がモックと同じ（共通の道具 matchMock）`, async ({
      browser,
    }) => {
      const { rows, bad } = await matchMock(browser, id, w, async (page) => {
        await mockApi(page, PENDING);
        // 入口の箱は縦の真ん中に置くので、matchMock が開いた高さのまま開く（open は高さ 1000 にする）
        await page.clock.setFixedTime(new Date(NOW));
        expect((await page.goto(path))?.status()).toBe(200);
        await expect(page.locator(`${BOX} h1`)).toHaveText("入り方を 1 つ足してください");
      });
      expect(rows.length, "比べた行がある").toBeGreaterThan(3);
      expect(bad).toEqual([]);
    });
  }
}

//   小窓の役は入口の箱に当たらないので opts.pairs で渡す（K-316 に頼む・K-318 の申し送り）。渡した役で比べたことを返った行で確かめる
const BOXP = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const DLG = ".k-dialog";
const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const DIALOG_PAIRS: FidelityPair[] = [
  pair("dlg", DLG, [...BOXP, "padding-top"]),
  pair("dlg-title", `${DLG} .k-dialog-title`, ["x", "y", ...TXT]),
  pair("dlg-sub", `${DLG} .k-dialog-sub`, ["x", "y", ...TXT]),
  pair("dlg-step-title", `${DLG} .k-set-step-title`, ["x", "y", ...TXT]),
  pair("dlg-step-dot", `${DLG} .k-set-step-dot`, BOXP),
  pair("dlg-qr", `${DLG} .k-auth-qr`, ["width", "height", "x", "y"]),
  pair("dlg-secret", `${DLG} .k-auth-secret`, ["font-size", "font-family", "background-color"]),
  pair("dlg-code-box", `${DLG} .k-login-code-box`, ["width", "height", "x", "y", "font-size"]),
  pair("dlg-alert", `${DLG} [role="alert"]`, ["x", "y", ...TXT]),
  pair("dlg-codes", `${DLG} .k-backup-codes`, ["width", "height", "x", "y", "column-gap", "row-gap"]),
  pair("dlg-code", `${DLG} .k-backup-code`, ["width", "height", "x", "y", "font-size", "font-family"]),
  pair("dlg-label", `${DLG} label`, ["x", "y", ...TXT]),
  pair("dlg-input", `${DLG} input:not(.k-login-code-box)`, [...BOXP, "font-size"]),
  pair("dlg-note-box", `${DLG} .k-auth-note-box`, [...BOXP, "font-size", "texts"]),
  pair("dlg-btn", `${DLG} .k-dialog-actions button`, [...BOXP, "font-size", "color", "texts"]),
];
type PairsOptions = MatchOptions & { pairs: FidelityPair[] };
const DIALOG_PROD: Record<string, { sec: Sec; o?: Partial<Mock>; act: (p: Page) => Promise<void> }> = {
  "sec-totp": {
    sec: PASSWORD_ONLY,
    act: async (p) => {
      await startTotp(p);
      await box(p, 1).click();
      await p.keyboard.type("51");
    },
  },
  "sec-totp-error": {
    sec: PASSWORD_ONLY,
    o: { once: { confirm: err(422, "E-AUTH-004", msg("E-AUTH-004")) } },
    act: async (p) => {
      await startTotp(p);
      await typeCode(p, "000000");
      await expect(totpDialog(p).locator('[role="alert"]')).toBeVisible();
    },
  },
  "sec-backup": {
    sec: PASSWORD_ONLY,
    act: async (p) => {
      await startTotp(p);
      await typeCode(p, "123456");
      await expect(backupDialog(p)).toBeVisible();
    },
  },
  "sec-password-change": { sec: PASSWORD_2FA, act: (p) => openPw(p) },
  "sec-password-set": {
    sec: PASSKEY_ONLY,
    act: (p) => row(p, "使うなら 12 文字以上").getByRole("button", { name: "決める", exact: true }).click(),
  },
};
for (const [id, c] of Object.entries(DIALOG_PROD)) {
  for (const w of MATCH_WIDTHS) {
    test(`K319-UI-028 ${id} 幅 ${w}：小窓（箱・題・補足・段・QR の箱・鍵の字の箱・6 けたの枠・コードの並び・欄・注の箱・ボタン）の値がモックと同じ（共通の道具 matchMock・QR と鍵とコードの字は比べない）`, async ({
      browser,
    }) => {
      const opts: PairsOptions = { pairs: DIALOG_PAIRS, blur: true };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockApi(page, c.sec, structuredClone(c.o)); // once は使うと消えるので、幅ごとに写して渡す
          await openList(page, w);
          await c.act(page);
          await expect(page.locator(DLG).last()).toBeVisible();
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の役で比べた").toContain("dlg-title");
      expect(bad).toEqual([]);
    });
  }
}

test("K319-UI-029 幅 320〜1440：付けるまで進めない・2 段階・バックアップコード・パスワードを変えるで横溢れ 0・小窓が画面の中", async ({
  page,
}) => {
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const inView = async () => {
    const b = await page.locator(".k-dialog").last().boundingBox();
    const w = await page.evaluate(() => window.innerWidth);
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(w + 0.5);
  };
  for (const w of WIDTHS) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.evaluate(() => window.localStorage.removeItem("kaname.token")).catch(() => undefined);
    await mockApi(page, PENDING);
    await open(page, w);
    expect(await over(), `幅 ${w} 付けるまで進めない`).toBe(0);
    await choice(page, "2 段階認証を付ける").click();
    await confirmWith(page);
    await expect(totpDialog(page)).toBeVisible(); // 本人確認の小窓が閉じきってから 2 段階の小窓を測る
    await inView();
    expect(await over(), `幅 ${w} 2 段階`).toBe(0);
    await typeCode(page, "123456");
    await expect(backupDialog(page)).toBeVisible();
    await inView();
    const codes = await page
      .locator(".k-backup-code")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
    expect(Math.max(...codes)).toBeLessThanOrEqual(w + 0.5);
    expect(await over(), `幅 ${w} バックアップコード`).toBe(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockApi(page, PASSWORD_2FA);
    await openList(page, w);
    await openPw(page);
    await inView();
    expect(await over(), `幅 ${w} パスワードを変える`).toBe(0);
  }
});

test("K319-UI-030 確かめの口が 503（E-PAGE-003）：小窓の中に文・枠は空・閉じない・札はそのまま", async ({ page }) => {
  await mockApi(page, PASSWORD_ONLY, { once: { confirm: err(503, "E-PAGE-003", msg("E-PAGE-003")) } });
  await openList(page);
  await startTotp(page);
  await typeCode(page, "123456");
  await expect(totpDialog(page)).toContainText(msg("E-PAGE-003"));
  for (let i = 1; i <= 6; i += 1) await expect(box(page, i)).toHaveValue("");
  await totpDialog(page).getByRole("button", { name: "やめる" }).click();
  await expect(row(page, "認証アプリ").locator(".k-set-pill")).toHaveText("必須・付けていない");
});
