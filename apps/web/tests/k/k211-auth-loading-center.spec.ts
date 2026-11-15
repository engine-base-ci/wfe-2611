// K-211「ログインしていない人の箱（AuthFrame）の中の『…しています…』を、箱の真ん中にそろえる」の画面の試験（実 Chrome・実装より先に積む）。
//   決める人の指摘（2026-11-15・staging の写し）：/verify-email の確定中、見出し「確認しています」は真ん中なのに、回る印と文が箱の左に寄っている。
//   同じ形（AuthFrame の箱の中の読み込み中の表示）は 3 か所：メールの確認の確定中・規約の同意し直しの「確かめています…」「今の版を読んでいます…」。
//   位置は目で見ずに数で測る（getBoundingClientRect と、文の字の範囲＝Range）。口は網の手前（page.route）で答えを返さずに止め、読み込み中のままにする。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { expect, test, type Page, type Request, type Route } from "@playwright/test";

const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const VERIFY_PATH = "/api/v1/auth/sign-up/verify";
const CURRENT_PATH = "/api/v1/auth/terms/current";
const LINK_TOKEN = "k211_link_0123456789abcdefghijklmnopqrstuv"; // 確認のメールのリンクの手がかり（試験の値）
const SESSION = "session-k211"; // ログインの印（試験の値）
const TOL = 2; // そろっていると見なす差（px）
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const LABEL = {
  verify: "登録を確定しています…",
  checking: "確かめています…",
  current: "今の版を読んでいます…",
} as const;

type Reply = { status: number; body: unknown };
const unauth: Reply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
const meOk: Reply = { status: 200, body: { data: { id: "u1", email: "takamoto@example.com", name: "高本" } } };
/** 答えを返さない（読み込み中のままにする）。試験が終わると画面ごと閉じる */
const never = () => new Promise<never>(() => undefined);

/** 口を網の手前で差し替える。hold が真を返した口は答えを返さない。ほかは reply の答え */
async function mockApi(page: Page, hold: (method: string, path: string) => boolean, reply: (path: string) => Reply) {
  await page.route(API_RE, async (route: Route, req: Request) => {
    const path = new URL(req.url()).pathname;
    if (hold(req.method(), path)) return never();
    const r = reply(path);
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
}

/** メールの確認の確定中（確定の口が答えない）を開く */
async function openVerifyChecking(page: Page, width: number) {
  await mockApi(
    page,
    (m, p) => m === "POST" && p === VERIFY_PATH,
    () => unauth,
  );
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto(`/verify-email?token=${encodeURIComponent(LINK_TOKEN)}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "確認しています" })).toBeVisible();
  await expect(page.getByText(LABEL.verify, { exact: true })).toBeVisible();
}

/** 規約の同意し直し（/login?step=terms）を、ログイン中の印つきで開く。今の版の口はいつも止める。which=me なら自分の取得も止める
 *  （今の版の口が答えると「調子が悪い」の知らせが同時に出る形になる・精査の指摘 4） */
async function openTermsLoading(page: Page, width: number, which: "me" | "current") {
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), SESSION);
  await mockApi(
    page,
    (m, p) => m === "GET" && (p === CURRENT_PATH || (which === "me" && /\/me$/.test(p))),
    (p) => (/\/me$/.test(p) ? meOk : unauth),
  );
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto(`/login?step=terms&next=${encodeURIComponent("/tickets")}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /規約/ })).toBeVisible();
  await expect(page.getByText(which === "me" ? LABEL.checking : LABEL.current, { exact: true })).toBeVisible();
}

interface Measure {
  /** 箱（.k-auth-card）の横の中心 */
  card: number;
  /** 箱の中身の左右の端（余白の内側） */
  innerLeft: number;
  innerRight: number;
  /** 見出しの字の範囲の横の中心 */
  heading: number;
  /** 回る印と文の字の範囲を合わせた塊の横の中心 */
  block: number;
  /** 回る印の箱 */
  spin: { left: number; right: number; top: number; bottom: number; width: number; height: number };
  /** 文の字の 1 行ずつの箱 */
  lines: { left: number; right: number; top: number; bottom: number }[];
  /** 文の要素の横の中心 */
  labelBox: number;
  /** 横溢れ（scrollWidth − clientWidth） */
  overflow: number;
}

/** 箱の中の読み込み中の表示を数で測る。文は字の範囲（Range）で測る（要素の幅が広がっても字の位置で見る） */
async function measure(page: Page, label: string): Promise<Measure> {
  return page.evaluate((text) => {
    const card = document.querySelector(".k-auth-card");
    const h1 = card?.querySelector("h1");
    const box = card?.querySelector('[data-state="loading"]');
    const spin = box?.querySelector(".k-spin");
    const span = [...(box?.querySelectorAll("span") ?? [])].find((s) => s.textContent === text);
    if (!card || !h1 || !box || !spin || !span)
      throw new Error("箱・見出し・読み込み中の表示・回る印・文のどれかが無い");
    const rangeOf = (el: Element) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r;
    };
    const c = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const innerLeft = c.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const innerRight = c.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    const h = rangeOf(h1).getBoundingClientRect();
    const s = spin.getBoundingClientRect();
    const t = rangeOf(span).getBoundingClientRect();
    const lines = [...rangeOf(span).getClientRects()]
      .filter((r) => r.width > 0)
      .map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }));
    const sb = span.getBoundingClientRect();
    return {
      card: (c.left + c.right) / 2,
      innerLeft,
      innerRight,
      heading: (h.left + h.right) / 2,
      block: (Math.min(s.left, t.left) + Math.max(s.right, t.right)) / 2,
      spin: { left: s.left, right: s.right, top: s.top, bottom: s.bottom, width: s.width, height: s.height },
      lines,
      labelBox: (sb.left + sb.right) / 2,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, label);
}

/** 1 行に収まっているときの決まり：塊の中心が箱の中心とも見出しの中心とも TOL 以内。横溢れ 0 */
function expectCentered(m: Measure, where: string) {
  expect(Math.abs(m.block - m.card), `${where}：塊の中心 ${m.block} と箱の中心 ${m.card} の差`).toBeLessThanOrEqual(
    TOL,
  );
  expect(
    Math.abs(m.block - m.heading),
    `${where}：塊の中心 ${m.block} と見出しの中心 ${m.heading} の差`,
  ).toBeLessThanOrEqual(TOL);
  expect(m.overflow, `${where}：横溢れ`).toBe(0);
}

test("K211-UI-001 /verify-email の確定中（1440）：回る印と「登録を確定しています…」の塊の中心が、箱の中心と横に 2px 以内", async ({
  page,
}) => {
  await openVerifyChecking(page, 1440);
  const m = await measure(page, LABEL.verify);
  expect(Math.abs(m.block - m.card)).toBeLessThanOrEqual(TOL);
});

test("K211-UI-002 /verify-email の確定中（1440）：塊の中心が、見出し「確認しています」の字の中心と横に 2px 以内。見出しの中心も箱の中心と 2px 以内（見出しは動かない）", async ({
  page,
}) => {
  await openVerifyChecking(page, 1440);
  const m = await measure(page, LABEL.verify);
  expect(Math.abs(m.block - m.heading)).toBeLessThanOrEqual(TOL);
  expect(Math.abs(m.heading - m.card)).toBeLessThanOrEqual(TOL);
});

test("K211-UI-003 /verify-email の確定中を幅 320・375・768・1024・1440 で開く：どの幅でも塊の中心が箱の中心・見出しの中心と 2px 以内で、横溢れ 0", async ({
  page,
}) => {
  for (const width of WIDTHS) {
    await openVerifyChecking(page, width);
    expectCentered(await measure(page, LABEL.verify), `幅 ${width}`);
  }
});

test("K211-UI-004 /verify-email の確定中（375・1440）：回る印は文の左にあり、文の 1 行目と縦に重なる（印と文を 1 つの塊のまま並べる）", async ({
  page,
}) => {
  for (const width of [375, 1440]) {
    await openVerifyChecking(page, width);
    const m = await measure(page, LABEL.verify);
    const first = m.lines[0]!;
    expect(m.lines.length, `幅 ${width}：文は 1 行`).toBe(1);
    expect(m.spin.right, `幅 ${width}：印は文の左`).toBeLessThanOrEqual(first.left + TOL);
    expect(first.left - m.spin.right, `幅 ${width}：印と文の間`).toBeLessThanOrEqual(16);
    const spinMid = (m.spin.top + m.spin.bottom) / 2;
    expect(spinMid, `幅 ${width}：印は文の行の高さの中`).toBeGreaterThanOrEqual(first.top);
    expect(spinMid, `幅 ${width}：印は文の行の高さの中`).toBeLessThanOrEqual(first.bottom);
  }
});

test("K211-UI-005 文字を大きくした人（文が 2 行に折れる）・幅 320：文のどの行も文の中で真ん中にそろい（行の中心と文の中心が 2px 以内）、箱の中身の左右からはみ出さず、回る印は丸のまま（幅と高さの差 1px 以内）、横溢れ 0", async ({
  page,
}) => {
  await openVerifyChecking(page, 320);
  // 利用者が文字を大きくしている形を、試験の中だけで作る（製品のコードは変えない）。字が大きいと 1 行に収まらない
  await page.addStyleTag({ content: '.k-auth-card [data-state="loading"] span:not(.k-spin) { font-size: 34px; }' });
  const m = await measure(page, LABEL.verify);
  expect(m.lines.length, "文が 2 行以上に折れている").toBeGreaterThanOrEqual(2);
  for (const [i, ln] of m.lines.entries()) {
    expect(Math.abs((ln.left + ln.right) / 2 - m.labelBox), `${i + 1} 行目の中心と文の中心の差`).toBeLessThanOrEqual(
      TOL,
    );
    expect(ln.left, `${i + 1} 行目が箱の中身の左からはみ出さない`).toBeGreaterThanOrEqual(m.innerLeft - TOL);
    expect(ln.right, `${i + 1} 行目が箱の中身の右からはみ出さない`).toBeLessThanOrEqual(m.innerRight + TOL);
  }
  expect(m.spin.left, "回る印も箱の中身の中").toBeGreaterThanOrEqual(m.innerLeft - TOL);
  // 回る印は縮まない（文が長くても丸のまま・精査の指摘 3）
  expect(
    Math.abs(m.spin.width - m.spin.height),
    `回る印の幅 ${m.spin.width} と高さ ${m.spin.height} の差`,
  ).toBeLessThanOrEqual(1);
  expect(m.overflow).toBe(0);
});

test("K211-UI-006 動きを減らす設定（reduced-motion: reduce）・幅 375 と 1440：塊の中心が箱の中心・見出しの中心と 2px 以内（位置は動きの設定で変わらない）", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [375, 1440]) {
    await openVerifyChecking(page, width);
    expectCentered(await measure(page, LABEL.verify), `reduce・幅 ${width}`);
  }
});

test("K211-UI-007 同じ形：規約の同意し直し（/login?step=terms）の「確かめています…」（自分の取得が答えない）・幅 320 と 1440：塊の中心が箱の中心・見出しの中心と 2px 以内で、横溢れ 0", async ({
  page,
}) => {
  for (const width of [320, 1440]) {
    await openTermsLoading(page, width, "me");
    expectCentered(await measure(page, LABEL.checking), `確かめています・幅 ${width}`);
  }
});

test("K211-UI-008 同じ形：規約の同意し直しの「今の版を読んでいます…」（ログイン中・今の版の口が答えない）・幅 320 と 1440：塊の中心が箱の中心・見出しの中心と 2px 以内で、横溢れ 0", async ({
  page,
}) => {
  for (const width of [320, 1440]) {
    await openTermsLoading(page, width, "current");
    expectCentered(await measure(page, LABEL.current), `今の版を読んでいます・幅 ${width}`);
  }
});

test("K211-UI-009 箱の外の読み込み中は今のまま（部品の既定は変えない）：見本の画面（/dev/k/states）の「読み込んでいます…」は、回る印の左端が見本の枠の左端と 2px 以内", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const res = await page.goto("/dev/k/states");
  expect(res?.status()).toBe(200);
  // 回る印は回っている途中だと傾いた四角の外枠で測られる（左端が最大 2.7px ずれる）。試験の中だけ動きを止めて測る（製品は変えない）
  await page.addStyleTag({ content: ".k-spin { animation: none !important; }" });
  const sample = page.locator('[data-sample="loading"]');
  await expect(sample.getByText("読み込んでいます…", { exact: true })).toBeVisible();
  const gap = await sample.evaluate((el) => {
    const spin = el.querySelector(".k-spin");
    if (!spin) throw new Error("回る印が無い");
    return spin.getBoundingClientRect().left - el.getBoundingClientRect().left;
  });
  expect(Math.abs(gap)).toBeLessThanOrEqual(TOL);
});
