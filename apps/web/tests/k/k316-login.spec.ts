// K-316「ログインの画面を口につなぐ：パスワード・確認のコード・止め・ロック・送りすぎ」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f1/<状態>（login-n・e・lock・wait・m・m-error・backup・code-lock・tf-expired・suspended-member・suspended-ws）。
//   画面は features/F1/login/views.tsx の LoginMain・LoginCode・LoginBlocked で組み、契約の口だけを呼ぶ：
//     signInWithPassword（POST /api/v1/auth/sign-in）・verifySignInCode（POST /api/v1/auth/two-factor/verify）。前の道すじ /api/auth-ext/* は呼ばない。
//   口の答えの形（K-301・K-302 が契約に書く）：成功 { data: { token, two_factor, pending } }（待ちの印の名前は pending・精査の後の決め 2）・失敗 { code, message, remaining?, retry_after_sec? }。
//   口は網の手前で差し替える（口の振る舞いは K-301〜K-303 の口の試験が本物の DB で持つ）。本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。
//   パスキー・スマホの QR・端末をなくした は K-317 がつないだ（押した後は k317-login-passkey.spec.ts・K221-UI-004／005／008／020 が見る）。K316-UI-018 は K-317 で外した。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const BOX = '[data-part="auth-box"]';
const NEXT = "/legal/terms"; // 入った後の行き先（口を読まない画面にして、入ったことを道で見る）
const EMAIL = "takamoto@engine-base.example"; // モックと同じ値
const PASSWORD = "correct-horse-battery-1";
const SIGN_IN = "/api/v1/auth/sign-in";
const VERIFY = "/api/v1/auth/two-factor/verify";
const MSG = {
  wrong: "メールアドレスかパスワードが違います。あと 4 回で 15 分ロックします",
  lock: "15 分間ロックしました。15 分たってから、もう一度入ってください",
  codeWrong: "コードが違います。認証アプリの時刻が合っているか確かめてください",
  codeLock: "コードを 5 回違えたので 15 分止めました。15 分たってから、もう一度入ってください",
  tfExpired: "時間が過ぎました。最初からログインし直してください",
  member: "このアカウントは、いま止められています。ワークスペースの管理者に聞いてください",
  ws: "このワークスペースは、いま止められています。データは残っています。管理者か運営に連絡してください",
  gone: "このアカウントは、会社の登録が見つからないため使えません。もう一度アカウントを作るか、運営に連絡してください",
  down: "Kaname の調子が悪くなっています。運営が直しています。あなたの操作や PC の問題ではありません",
} as const;

type Reply = { status: number; body: unknown };
interface Mock {
  signIns: Record<string, unknown>[];
  verifies: Record<string, unknown>[];
  old: string[];
  on: { signIn: (b: Record<string, unknown>) => Reply | "abort"; verify: (b: Record<string, unknown>) => Reply };
}
const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}): Reply => ({
  status,
  body: { code, message, ...extra },
});
const ok = (twoFactor: boolean): Reply => ({
  status: 201,
  body: {
    data: twoFactor
      ? { token: null, two_factor: true, pending: "tf-k316" }
      : { token: "tok-k316", two_factor: false, pending: null },
  },
});

async function mockAuth(page: Page, o: { twoFactor?: boolean } = {}): Promise<Mock> {
  const m: Mock = {
    signIns: [],
    verifies: [],
    old: [],
    on: { signIn: () => ok(!!o.twoFactor), verify: () => ({ status: 201, body: { data: { token: "tok-k316" } } }) },
  };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (p.startsWith("/api/auth-ext/")) m.old.push(`${req.method()} ${p}`);
    let r: Reply = { status: 404, body: { code: "NOT_FOUND", message: "無い" } };
    if (req.method() === "POST" && p === SIGN_IN) {
      const b = (req.postDataJSON() as Record<string, unknown>) ?? {};
      m.signIns.push(b);
      const x = m.on.signIn(b);
      if (x === "abort") return route.abort("failed");
      r = x;
    } else if (req.method() === "POST" && p === VERIFY) {
      const b = (req.postDataJSON() as Record<string, unknown>) ?? {};
      m.verifies.push(b);
      r = m.on.verify(b);
    } else if (p === "/api/auth/get-session") r = { status: 200, body: { session: null, user: null } };
    else if (p === "/api/v1/auth/service-status")
      r = { status: 200, body: { data: { incidents: [], maintenance: null } } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}
async function open(page: Page, width = 1440, q = `?next=${encodeURIComponent(NEXT)}`) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  expect((await page.goto(`/login${q}`))?.status()).toBe(200);
  await expect(page.locator(`${BOX} h1`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const mail = (page: Page) => page.getByRole("textbox", { name: "メールアドレス" });
const pass = (page: Page) => page.getByLabel("パスワード", { exact: true });
const nextBtn = (page: Page) => page.locator(BOX).getByRole("button", { name: "次へ", exact: true });
const enter = (page: Page) => page.locator(BOX).getByRole("button", { name: "入る", exact: true });
const digit = (page: Page, n: number) => page.getByRole("textbox", { name: `確認のコード ${n} けた目` });
const alertBox = (page: Page) => page.locator(BOX).getByRole("alert");
const token = (page: Page) => page.evaluate(() => window.localStorage.getItem("kaname.token"));

async function signIn(page: Page, password = PASSWORD) {
  await mail(page).fill(EMAIL);
  await pass(page).fill(password);
  await nextBtn(page).click();
}
async function toCode(page: Page) {
  await signIn(page);
  await expect(page.locator(`${BOX} h1`)).toHaveText("確認のコード");
}
async function typeCode(page: Page, code: string) {
  await digit(page, 1).click();
  await page.keyboard.type(code, { delay: 20 });
}

test("K316-UI-001 正しい組で「次へ」：契約の口 POST /api/v1/auth/sign-in に打ったメールとパスワードが 1 回だけ届き、前の道すじ /api/auth-ext/* は 0 回。ログインの印が残り、行き先（next）へ移る", async ({
  page,
}) => {
  const m = await mockAuth(page);
  await open(page);
  await signIn(page);
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(m.signIns).toEqual([{ email: EMAIL, password: PASSWORD }]);
  expect(m.old).toEqual([]);
  expect(await token(page)).toBe("tok-k316");
});

test("K316-UI-002 2 段階を付けた人：答えが two_factor なら確認のコード（form の data-state m・h1「確認のコード」・6 つの枠）へ。6 つそろうと POST /api/v1/auth/two-factor/verify に { pending, code } が 1 回届き、trust_device は送らない（D-128.60）。行き先へ移る", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page);
  await toCode(page);
  await expect(page.locator(`${BOX} form[data-state="m"]`)).toBeVisible();
  expect(await token(page), "確かめる前は印を持たない").toBeNull();
  await typeCode(page, "482913");
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(m.verifies).toHaveLength(1);
  expect(m.verifies[0]).toEqual({ pending: "tf-k316", code: "482913" });
  expect(m.old).toEqual([]);
  expect(await token(page)).toBe("tok-k316");
});

test("K316-UI-003 バックアップコード：「認証アプリが使えない」→ 欄に入れて「入る」で { pending, backup_code } が 1 回届く（全角は半角に・前後の空白は落とす）。trust_device は送らない", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  await open(page);
  await toCode(page);
  await page.locator(BOX).getByRole("button", { name: "認証アプリが使えない" }).click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("バックアップコードで入る");
  await page.getByLabel("バックアップコード").fill(" ７KQM-2XPA ");
  await enter(page).click();
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(m.verifies).toEqual([{ pending: "tf-k316", backup_code: "7KQM-2XPA" }]);
});

test("K316-UI-004 違うパスワード（401・E-AUTH-001）：口の文（あと 4 回で 15 分ロックします）が箱の中の role=alert に出て、form は data-state e・2 つの欄は aria-invalid。ログインの印は無く、画面はログインのまま。入れ直して押すと口はもう 1 回呼ばれる", async ({
  page,
}) => {
  const m = await mockAuth(page);
  m.on.signIn = () => fail(401, "E-AUTH-001", MSG.wrong, { remaining: 4 });
  await open(page);
  await signIn(page, "wrong-password-000");
  await expect(alertBox(page)).toHaveText(MSG.wrong);
  await expect(page.locator(`${BOX} form[data-state="e"]`)).toBeVisible();
  await expect(mail(page)).toHaveAttribute("aria-invalid", "true");
  await expect(pass(page)).toHaveAttribute("aria-invalid", "true");
  expect(await token(page)).toBeNull();
  await expect(page).toHaveURL(/\/login/);
  m.on.signIn = () => ok(false);
  await pass(page).fill(PASSWORD);
  await nextBtn(page).click();
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(m.signIns).toHaveLength(2);
});

test("K316-UI-005 ロック中（429・E-AUTH-002・retry_after_sec 900）：新しい文「15 分間ロックしました。15 分たってから、もう一度入ってください」が出て「次へ」は押せない（disabled）。Enter でも口は増えない。900 秒たつと「次へ」が押せるようになり、文は消える", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-20T00:00:00Z") });
  const m = await mockAuth(page);
  m.on.signIn = () => fail(429, "E-AUTH-002", MSG.lock, { retry_after_sec: 900 });
  await open(page);
  await signIn(page);
  await expect(alertBox(page)).toHaveText(MSG.lock);
  await expect(nextBtn(page)).toBeDisabled();
  await pass(page).press("Enter");
  expect(m.signIns).toHaveLength(1);
  await page.clock.runFor(899_000);
  await expect(nextBtn(page)).toBeDisabled();
  await page.clock.runFor(2_000);
  await expect(nextBtn(page)).toBeEnabled();
  await expect(alertBox(page)).toHaveCount(0);
});

test("K316-UI-006 送りすぎ（429・回数の守り・retry_after_sec 42）：正本 E-LIM-005 の文「送りすぎです。42秒たってから、もう一度お試しください」が出て「次へ」は押せない。42 秒たつと押せる", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-20T00:00:00Z") });
  const m = await mockAuth(page);
  m.on.signIn = () => fail(429, "RATE_LIMITED", "回数の上限です", { retry_after_sec: 42 });
  await open(page);
  await signIn(page);
  await expect(alertBox(page)).toHaveText("送りすぎです。42秒たってから、もう一度お試しください");
  await expect(nextBtn(page)).toBeDisabled();
  await page.clock.runFor(43_000);
  await expect(nextBtn(page)).toBeEnabled();
  expect(m.signIns).toHaveLength(1);
});

test("K316-UI-007 確認のコードが違う（401・E-AUTH-004）：文が箱の中に出て、6 つの枠は空に戻り 1 つめにフォーカス。続けて正しいコードを打つと口は 2 回目が呼ばれて入れる", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.verify = () => fail(401, "E-AUTH-004", MSG.codeWrong);
  await open(page);
  await toCode(page);
  await typeCode(page, "111111");
  await expect(alertBox(page)).toHaveText(MSG.codeWrong);
  for (const n of [1, 2, 3, 4, 5, 6]) await expect(digit(page, n)).toHaveValue("");
  await expect(digit(page, 1)).toBeFocused();
  m.on.verify = () => ({ status: 201, body: { data: { token: "tok-k316" } } });
  await page.keyboard.type("482913", { delay: 20 });
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(m.verifies).toHaveLength(2);
});

test("K316-UI-008 確認のコードを 5 回違えて止め（429・E-AUTH-014）：止めの文が出て「入る」は押せない。枠に 6 つ打っても口は増えない", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.verify = () => fail(429, "E-AUTH-014", MSG.codeLock, { retry_after_sec: 900 });
  await open(page);
  await toCode(page);
  await typeCode(page, "111111");
  await expect(alertBox(page)).toHaveText(MSG.codeLock);
  await expect(enter(page)).toBeDisabled();
  await typeCode(page, "222222");
  expect(m.verifies).toHaveLength(1);
});

test("K316-UI-009 待ちの印が切れた（401・E-AUTH-013）：「時間が過ぎました。最初からログインし直してください」と従「最初からログインし直す」が出て「入る」は無い。押すとメールとパスワードの画面（data-state n）に戻り、メールは残り・パスワードは空。もう一度「次へ」で sign-in が呼ばれる（前の待ちの印は送らない）", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.verify = () => fail(401, "E-AUTH-013", MSG.tfExpired);
  await open(page);
  await toCode(page);
  await typeCode(page, "482913");
  await expect(alertBox(page)).toHaveText(MSG.tfExpired);
  await expect(enter(page)).toHaveCount(0);
  await page.locator(BOX).getByRole("button", { name: "最初からログインし直す" }).click();
  await expect(page.locator(`${BOX} form[data-state="n"] h1`)).toHaveText("ログイン");
  await expect(mail(page)).toHaveValue(EMAIL);
  await expect(pass(page)).toHaveValue("");
  await pass(page).fill(PASSWORD);
  await nextBtn(page).click();
  await expect(page.locator(`${BOX} h1`)).toHaveText("確認のコード");
  expect(m.signIns).toHaveLength(2);
  expect(m.signIns[1]).toEqual({ email: EMAIL, password: PASSWORD });
});

for (const [row, code, msg, label] of [
  ["K316-UI-010", "E-AUTH-011", MSG.member, "止められた人"],
  ["K316-UI-011", "E-AUTH-012", MSG.ws, "止められたワークスペース"],
  ["K316-UI-012", "E-AUTH-007", MSG.gone, "会社の人が無い"],
] as const) {
  test(`${row} ${label}（403・${code}）：h1「ログインできません」と赤の箱（role=alert）に口の文。ログインの印は無い。「ログインの画面に戻る」でメールとパスワードの画面へ（メールは残り・パスワードは空）`, async ({
    page,
  }) => {
    const m = await mockAuth(page);
    m.on.signIn = () => fail(403, code, msg);
    await open(page);
    await signIn(page);
    await expect(page.locator(`${BOX} h1`)).toHaveText("ログインできません");
    await expect(page.locator(`${BOX} .k-auth-result[data-tone="bad"]`)).toContainText(msg);
    await expect(page.locator(`${BOX} .k-auth-result[data-tone="bad"]`)).toHaveAttribute("role", "alert");
    expect(await token(page)).toBeNull();
    await expect(page.locator(BOX).getByRole("link", { name: "困ったとき" })).toBeVisible();
    await page.locator(BOX).getByRole("button", { name: "ログインの画面に戻る" }).click();
    await expect(page.locator(`${BOX} h1`)).toHaveText("ログイン");
    await expect(mail(page)).toHaveValue(EMAIL);
    await expect(pass(page)).toHaveValue("");
    expect(m.signIns).toHaveLength(1);
  });
}

test("K316-UI-013 確認のコードを通った後に止めが分かった（verify が 403・E-AUTH-012）：止めの画面（ログインできません）になり、ログインの印は無い", async ({
  page,
}) => {
  const m = await mockAuth(page, { twoFactor: true });
  m.on.verify = () => fail(403, "E-AUTH-012", MSG.ws);
  await open(page);
  await toCode(page);
  await typeCode(page, "482913");
  await expect(page.locator(`${BOX} h1`)).toHaveText("ログインできません");
  await expect(page.locator(`${BOX} .k-auth-result[data-tone="bad"]`)).toContainText(MSG.ws);
  expect(await token(page)).toBeNull();
});

test("K316-UI-014 口が落ちている（500・E-PAGE-003）：文が箱の中に出て画面はログインのまま。網が切れた（要求が届かない）ときも「うまくいきませんでした。もう一度試してください」が出て、もう一度押すと口が呼ばれる", async ({
  page,
}) => {
  const m = await mockAuth(page);
  m.on.signIn = () => fail(500, "E-PAGE-003", MSG.down);
  await open(page);
  await signIn(page);
  await expect(alertBox(page)).toHaveText(MSG.down);
  m.on.signIn = () => "abort";
  await nextBtn(page).click();
  await expect(alertBox(page)).toHaveText("うまくいきませんでした。もう一度試してください");
  await expect(nextBtn(page)).toBeEnabled();
  m.on.signIn = () => ok(false);
  await nextBtn(page).click();
  await page.waitForURL((u) => u.pathname === NEXT);
  expect(m.signIns).toHaveLength(3);
});

test("K316-UI-015 確認のコードの画面で再読み込み：待ちの印は画面のメモリだけに持つので、メールとパスワードの画面（data-state n・空の欄）に戻る。localStorage と sessionStorage に待ちの印（tf-k316）が残らない", async ({
  page,
}) => {
  await mockAuth(page, { twoFactor: true });
  await open(page);
  await toCode(page);
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain("tf-k316");
  await page.reload();
  await expect(page.locator(`${BOX} form[data-state="n"] h1`)).toHaveText("ログイン");
  await expect(mail(page)).toHaveValue("");
});

test("K316-UI-016 ログインが切れて /login?next=<元の道> に来た：入ると元の道（/tickets?tab=1）へ移る。2 段階の人も 6 けたの後に同じ道へ移る", async ({
  page,
}) => {
  const m = await mockAuth(page);
  const back = `?next=${encodeURIComponent("/tickets?tab=1")}`;
  await open(page, 1440, back);
  await signIn(page);
  await page.waitForURL((u) => u.pathname === "/tickets" && u.search === "?tab=1");
  await page.evaluate(() => window.localStorage.removeItem("kaname.token"));
  m.on.signIn = () => ok(true);
  await open(page, 1440, back);
  await toCode(page);
  await typeCode(page, "482913");
  await page.waitForURL((u) => u.pathname === "/tickets" && u.search === "?tab=1");
});

test("K316-UI-017 秘密を出さない：入って移るまでの間、ブラウザのコンソールにパスワード・6 けた・待ちの印・メールが出ない。移った先の URL にもメールとパスワードが無い", async ({
  page,
}) => {
  const logs: string[] = [];
  page.on("console", (msg) => logs.push(msg.text()));
  await mockAuth(page, { twoFactor: true });
  await open(page);
  await toCode(page);
  await typeCode(page, "482913");
  await page.waitForURL((u) => u.pathname === NEXT);
  for (const secret of [PASSWORD, "482913", "tf-k316", EMAIL])
    expect(
      logs.filter((l) => l.includes(secret)),
      secret,
    ).toEqual([]);
  expect(page.url()).not.toContain(encodeURIComponent(EMAIL));
  expect(page.url()).not.toContain(PASSWORD);
});

test("K316-UI-019 部品の世代：login-form.tsx は views の LoginMain・LoginCode・LoginBlocked で組み、口は call の signInWithPassword・verifySignInCode だけ。lib/auth/ext の signIn・verifyTwoFactor と trust_device を使わない", () => {
  const src = readFileSync(join(WEB, "features/F1/login/login-form.tsx"), "utf8");
  for (const name of ["LoginMain", "LoginCode", "LoginBlocked"]) expect(src, name).toMatch(new RegExp(`\\b${name}\\b`));
  expect(src).toMatch(/["']signInWithPassword["']/);
  expect(src).toMatch(/["']verifySignInCode["']/);
  expect(src).not.toMatch(/lib\/auth\/ext/);
  expect(src).not.toMatch(/trust_device/);
  expect(src).not.toMatch(/\bAuthFrame\b/); // 入口の枠は views が持つ（見た目を login-form に書かない）
});

test("K316-UI-020 幅 320・375・768・1024・1440：ロック・止め・確認のコードの止め・待ちの印が切れた の 4 つの状態で、横のはみ出し 0・h1 の 1 文字目が画面の中", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const bad: string[] = [];
  for (const w of [320, 375, 768, 1024, 1440]) {
    for (const st of ["lock", "blocked", "code-lock", "tf-expired"] as const) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      const m = await mockAuth(page, { twoFactor: st === "code-lock" || st === "tf-expired" });
      if (st === "lock") m.on.signIn = () => fail(429, "E-AUTH-002", MSG.lock, { retry_after_sec: 900 });
      if (st === "blocked") m.on.signIn = () => fail(403, "E-AUTH-011", MSG.member);
      if (st === "code-lock") m.on.verify = () => fail(429, "E-AUTH-014", MSG.codeLock, { retry_after_sec: 900 });
      if (st === "tf-expired") m.on.verify = () => fail(401, "E-AUTH-013", MSG.tfExpired);
      await open(page, w);
      if (st === "code-lock" || st === "tf-expired") {
        await toCode(page);
        await typeCode(page, "482913");
      } else await signIn(page);
      await expect(
        alertBox(page)
          .or(page.locator(`${BOX} .k-auth-result`))
          .first(),
      ).toBeVisible();
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      const left = await page.locator(`${BOX} h1`).evaluate((h) => {
        const t = document.createTreeWalker(h, NodeFilter.SHOW_TEXT).nextNode()!;
        const r = document.createRange();
        r.setStart(t, 0);
        r.setEnd(t, 1);
        return r.getBoundingClientRect().left;
      });
      if (over !== 0) bad.push(`${st} 幅 ${w}：横に ${over}px`);
      if (left < 0) bad.push(`${st} 幅 ${w}：h1 の 1 文字目が左の外`);
    }
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K316-UI-022 前の道すじを消した（精査の後の決め 3）：本物の口に POST /api/auth-ext/sign-in と /api/auth-ext/two-factor/verify を送ると 404。契約の口 /api/v1/auth/sign-in は在る（空の体で 422・E-VAL-008）", async ({
  request,
}) => {
  const api = process.env["API_BASE"] ?? "http://127.0.0.1:3011";
  for (const p of ["/api/auth-ext/sign-in", "/api/auth-ext/two-factor/verify"]) {
    const r = await request.post(`${api}${p}`, { data: { email: EMAIL, password: PASSWORD } });
    expect(r.status(), p).toBe(404);
  }
  const c = await request.post(`${api}${SIGN_IN}`, { data: {} });
  expect(c.status()).toBe(422);
  expect(((await c.json()) as { code?: string }).code).toBe("E-VAL-008");
});

test("K316-UI-023 「パスワードを忘れた」でメールを再設定へ引き継ぐ（K-320 の頼み）：メールの欄に入っていれば sessionStorage の kaname.reset-email に前後の空白を落として置き、/password-reset へ移る（URL にメールが無い）。欄が空なら置かない", async ({
  page,
}) => {
  await mockAuth(page);
  // 再設定の画面（K-320）は読んだら消すので、置いた瞬間の値を写しに取って見る（写しは localStorage の k316-reset-email-copy）
  await page.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
      if (this === window.sessionStorage && k === "kaname.reset-email")
        orig.call(window.localStorage, "k316-reset-email-copy", v);
      return orig.call(this, k, v);
    };
  });
  await open(page);
  await mail(page).fill(`  ${EMAIL} `);
  await page.locator(BOX).getByRole("link", { name: "パスワードを忘れた" }).click();
  await page.waitForURL((u) => u.pathname === "/password-reset");
  expect(page.url()).not.toContain(encodeURIComponent(EMAIL));
  expect(page.url()).not.toContain(EMAIL);
  expect(await page.evaluate(() => window.localStorage.getItem("k316-reset-email-copy"))).toBe(EMAIL);
  await page.evaluate(() => {
    window.localStorage.removeItem("k316-reset-email-copy");
    window.sessionStorage.removeItem("kaname.reset-email");
  });
  await open(page);
  await page.locator(BOX).getByRole("link", { name: "パスワードを忘れた" }).click();
  await page.waitForURL((u) => u.pathname === "/password-reset");
  expect(await page.evaluate(() => window.localStorage.getItem("k316-reset-email-copy"))).toBeNull();
});

// ---- モックの写しと本番の写しを同じ幅で比べる（正の絵＝モック /dev/mock/f1/<状態>） ----
//   パスキー・QR・端末をなくした は K-317 までグレー（モックは使える形）なので、その薄さだけは比べない（primary:opacity）
type Drive = (page: Page) => Promise<void>;
const withCode =
  (verify?: Reply): Drive =>
  async (page) => {
    const m = await mockAuth(page, { twoFactor: true });
    if (verify) m.on.verify = () => verify;
    await open(page, page.viewportSize()!.width);
    await toCode(page);
  };
const STATES: [string, Drive, string[]][] = [
  [
    "login-n",
    async (page) => void (await mockAuth(page), await open(page, page.viewportSize()!.width)),
    ["primary:opacity"],
  ],
  [
    "login-e",
    async (page) => {
      const m = await mockAuth(page);
      m.on.signIn = () => fail(401, "E-AUTH-001", MSG.wrong, { remaining: 4 });
      await open(page, page.viewportSize()!.width);
      await signIn(page, "wrongpassword");
    },
    ["primary:opacity"],
  ],
  [
    "login-lock",
    async (page) => {
      const m = await mockAuth(page);
      m.on.signIn = () => fail(429, "E-AUTH-002", MSG.lock, { retry_after_sec: 900 });
      await open(page, page.viewportSize()!.width);
      await signIn(page);
    },
    ["primary:opacity"],
  ],
  [
    "login-wait",
    async (page) => {
      await page.clock.install({ time: new Date("2026-11-20T00:00:00Z") });
      await page.clock.pauseAt(new Date("2026-11-20T00:00:01Z"));
      const m = await mockAuth(page);
      m.on.signIn = () => fail(429, "RATE_LIMITED", "回数の上限です", { retry_after_sec: 42 });
      await open(page, page.viewportSize()!.width);
      await signIn(page);
    },
    ["primary:opacity"],
  ],
  [
    "login-m",
    async (page) => {
      await withCode()(page);
      await typeCode(page, "4829");
    },
    [],
  ],
  [
    "login-m-error",
    async (page) => {
      await withCode(fail(401, "E-AUTH-004", MSG.codeWrong))(page);
      await typeCode(page, "111111");
      await expect(alertBox(page)).toBeVisible();
    },
    [],
  ],
  [
    "login-backup",
    async (page) => {
      await withCode()(page);
      await page.locator(BOX).getByRole("button", { name: "認証アプリが使えない" }).click();
      await page.getByLabel("バックアップコード").fill("7KQM-2XPA");
    },
    [],
  ],
  [
    "login-code-lock",
    async (page) => {
      await withCode(fail(429, "E-AUTH-014", MSG.codeLock, { retry_after_sec: 900 }))(page);
      await typeCode(page, "111111");
      await expect(alertBox(page)).toBeVisible();
    },
    [],
  ],
  [
    "login-tf-expired",
    async (page) => {
      await withCode(fail(401, "E-AUTH-013", MSG.tfExpired))(page);
      await typeCode(page, "482913");
      await expect(alertBox(page)).toBeVisible();
    },
    [],
  ],
  [
    "login-suspended-member",
    async (page) => {
      const m = await mockAuth(page);
      m.on.signIn = () => fail(403, "E-AUTH-011", MSG.member);
      await open(page, page.viewportSize()!.width);
      await signIn(page);
      await expect(page.locator(`${BOX} h1`)).toHaveText("ログインできません");
    },
    [],
  ],
  [
    "login-suspended-ws",
    async (page) => {
      const m = await mockAuth(page);
      m.on.signIn = () => fail(403, "E-AUTH-012", MSG.ws);
      await open(page, page.viewportSize()!.width);
      await signIn(page);
      await expect(page.locator(`${BOX} h1`)).toHaveText("ログインできません");
    },
    [],
  ],
];

for (const [id, drive, skip] of STATES) {
  for (const w of MATCH_WIDTHS) {
    test(`K316-UI-021 ${id} 幅 ${w}：本番の画面の値（箱・見出し・文・欄・ボタン・知らせ）と読み込んだ書体が、モック /dev/mock/f1/${id} と同じ`, async ({
      browser,
    }) => {
      const { bad } = await matchMock(browser, id, w, drive, { skip, blur: true });
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}
