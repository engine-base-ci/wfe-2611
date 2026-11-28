// K-373「スマホでは PC をつながない形と、PC の行の Claude Code の区画の見た目の突き合わせ」の画面の試験（実 Chrome）。名前の頭の行 ID（K373-UI-…）は 11_tickets/K-373.md の表に 1 対 1 で結ぶ。
//   K-361 の試験から移した（2026-11-19 PM の決め：K-361 が上限 1 時間を超えたので分けた。元の行 ID は K-373.md の表に書いた）。
//   口の差し替え・開く手順・行と区画の見つけ方は K-361 が持つ共通の道具 ./claude-code-mock.ts を使う（同じ物を 2 つ書かない）。
//   待ちは出来事で決める（固定の待ちは使わない）。台が混んでも落ちないよう、見える・移るの待ちは 15 秒まで。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { canPairHere, type PairDeviceHints } from "../../features/F3/connect-pc/pair-device";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { MATCH_WIDTHS, matchMock, type MatchOptions } from "./stage2-match";
import {
  BODY,
  type Dev,
  fix,
  GOOD,
  H,
  live,
  type Local,
  mock,
  OLD,
  open,
  OTHER,
  row,
  THIS,
  WAIT,
} from "./claude-code-mock";

/** スマホ（Bridge を入れられない端末）と PC の UA（代表の決め 2026-11-19：PC をつなぐのは PC だけ） */
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const PAIR_REASON = "つなぐ PC で、この画面を開いてください";

test.use({ timezoneId: "UTC" });

test.describe("K-373 スマホでは PC をつながない", () => {
  test("K373-UI-001 守り：スマホ（iPhone の UA・この端末に Bridge は無い）で開く（PC 0 台）：「＋ PC をつなぐ」は見えて押せず、すぐ下に理由の 1 行。押しても接続のコードの口を呼ばず、つなぐ小窓も開かない", async ({
    browser,
  }) => {
    const ctx: BrowserContext = await (browser as Browser).newContext({
      userAgent: IPHONE_UA,
      hasTouch: true,
      timezoneId: "UTC",
    });
    try {
      const page = await ctx.newPage();
      const m = await mock(page, [], { on: false });
      await page.setViewportSize({ width: 375, height: 812 });
      expect((await page.goto("/setup/bridge"))?.status()).toBe(200);
      const add = page.locator(`${BODY} [data-act="add-pc"]`);
      await expect(add).toHaveText("＋ PC をつなぐ", WAIT);
      await expect(add).toBeDisabled();
      await expect(add).toHaveAttribute("aria-describedby", "pc-add-reason");
      await expect(page.locator(`${BODY} #pc-add-reason`)).toHaveText(PAIR_REASON);
      await expect(page.locator(`${BODY} .k-pc-empty`)).toBeVisible(WAIT);
      // 押した後に「少し待って」も 0 のままかを見る：一覧の読み直し（5 秒ごと）が押した後にもう 1 回来るまで待つ（固定の待ちは使わない）。
      //   それまでに、開いた最初の 1 回のつなぐ小窓と接続のコードの口が動く間は過ぎている
      const reads = () => m.apiSent.filter((u) => u.includes("/api/v1/bridge/devices")).length;
      const readsBefore = reads();
      await add.click({ force: true });
      await expect.poll(reads, WAIT).toBeGreaterThan(readsBefore);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(m.pairings).toBe(0);
      await expect(page.locator(`${BODY} .k-pc-empty`)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("K373-UI-002 入力：Bridge を入れられる端末かの見分け（canPairHere）は画面の幅でなく OS で決める。スマホ・タブレット（iPhone・Android・Mac を名乗る iPad・userAgentData の mobile／platform）は false、Mac・Windows・Bridge の窓は true", () => {
    const cases: [string, PairDeviceHints, boolean][] = [
      ["iPhone", { userAgent: IPHONE_UA }, false],
      [
        "Android のスマホ",
        { userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130.0 Mobile Safari/537.36" },
        false,
      ],
      [
        "Android のタブレット",
        { userAgent: "Mozilla/5.0 (Linux; Android 15; SM-X910) Chrome/130.0 Safari/537.36" },
        false,
      ],
      [
        "Mac を名乗る iPad（触れる点 5）",
        {
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15",
          maxTouchPoints: 5,
        },
        false,
      ],
      ["userAgentData の mobile が true", { userAgent: MAC_UA, mobile: true }, false],
      [
        "userAgentData の platform が Android",
        { userAgent: "Mozilla/5.0 (X11; Linux x86_64)", mobile: false, platform: "Android" },
        false,
      ],
      ["Mac の Chrome（触れる点 0）", { userAgent: MAC_UA, mobile: false, platform: "macOS", maxTouchPoints: 0 }, true],
      [
        "Windows の触れる PC（触れる点 10）",
        {
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36",
          mobile: false,
          platform: "Windows",
          maxTouchPoints: 10,
        },
        true,
      ],
      ["Bridge の窓", { userAgent: `${MAC_UA} KanameBridge/1.5.0` }, true],
    ];
    const bad = cases.filter(([, h, want]) => canPairHere(h) !== want).map(([name, , want]) => `${name}：正は ${want}`);
    expect(bad, bad.join("\n")).toEqual([]);
  });

  test("K373-UI-003 PC（Mac の UA）で開く（つながっている PC が 1 台・この PC に Bridge は無い）：「＋ PC をつなぐ」は今のまま押せて理由の行は出ない。押すと接続のコードの口を 1 回呼び、つなぐ小窓が開く", async ({
    browser,
  }) => {
    const ctx: BrowserContext = await (browser as Browser).newContext({ userAgent: MAC_UA, timezoneId: "UTC" });
    try {
      const page = await ctx.newPage();
      const m = await mock(page, [live(OTHER, "事務所の Mac mini", H.ok)], { on: false });
      await open(page);
      const add = page.locator(`${BODY} [data-act="add-pc"]`);
      await expect(add).toBeEnabled(WAIT);
      await expect(page.locator(`${BODY} [data-pair-reason]`)).toHaveCount(0);
      await add.click();
      await expect(page.getByRole("dialog")).toBeVisible(WAIT);
      await expect.poll(() => m.pairings, WAIT).toBe(1);
    } finally {
      await ctx.close();
    }
  });
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock・置き場は /dev/mock/f3-pc・K-369 が本線に入れる）
//   正の絵：/dev/mock/f3-pc の pc-claude-* の 9 つと pc-asleep・pc-phone の 11 個（代表の OK 2026-11-19・会話で・PC の行の下絵と A の 1〜8 は勧めの形のまま）。
//   比べるのは Claude Code の区画（箱・題・説明・開く場所・ボタン・ログインの入口とコードの欄・行の中の知らせ）だけ。
//   行の字（名前・つないだ日・版）は一覧の値で変わるので比べず、縦の位置（y）も比べない（行の上の見出しの行の形は K-369・K-363 の物）

const MATCH_BOX = ["width", "height", "x", "background-color", "border-top-color", "border-top-left-radius"];
const MATCH_TXT = ["x", "font-size", "font-weight", "color", "line-height", "texts"];
const MATCH_CTRL = ["width", "height", "x", "font-size", "color", "background-color", "opacity", "texts"];
const FIX = '[data-part="claude-fix"]';
const pairOf = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const MATCH_PAIRS: FidelityPair[] = [
  pairOf("fix", FIX, MATCH_BOX),
  pairOf("fix-title", `${FIX} .k-pc-part-title`, MATCH_TXT),
  pairOf("fix-text", `${FIX} .k-pc-part-text`, MATCH_TXT),
  pairOf("fix-meta", `${FIX} .k-pc-part-meta`, MATCH_TXT),
  pairOf("fix-btn", `${FIX} .k-pc-part-acts button`, MATCH_CTRL),
  pairOf("login-step", "[data-login-step]", ["width", "height", "x", "texts"]),
  pairOf("login-link", "[data-login-step] a", ["x", "font-size", "color", "texts"]),
  pairOf("login-input", "[data-login-step] input", ["width", "height", "x", "font-size", "border-top-color"]),
  pairOf("login-btn", "[data-login-step] button", MATCH_CTRL),
  pairOf("note", ".k-pc-row .k-pc-part-note", ["width", "background-color", ...MATCH_TXT]),
];

const CODE_FIELD = "ブラウザに出たコード";
const toLogin = async (p: Page) => {
  await fix(p, THIS).locator("[data-login-claude]").click();
  await expect(fix(p, THIS).locator("[data-login-step]")).toBeVisible(WAIT);
};
const sendCode = async (p: Page, code: string) => {
  await toLogin(p);
  const step = fix(p, THIS).locator("[data-login-step]");
  await step.getByLabel(CODE_FIELD).fill(code);
  await step.getByRole("button", { name: "決定" }).click();
};
interface MatchDrive {
  devs: () => Dev[];
  local: Partial<Local>;
  act: (p: Page) => Promise<void>;
  /** この状態だけで足して比べる役（スマホの見出しの行の「＋ PC をつなぐ」と理由） */
  pairs?: FidelityPair[];
  /** 開く前にこの端末の見分けの値を差し替える（スマホ） */
  before?: (p: Page) => Promise<void>;
}
/** スマホ（iPhone）として開く：見分けの関数が読む navigator の値だけを差し替える（matchMock の頁は UA を選べないので） */
const asPhone = async (p: Page) => {
  await p.addInitScript((ua) => {
    Object.defineProperty(Navigator.prototype, "userAgent", { get: () => ua });
    Object.defineProperty(Navigator.prototype, "maxTouchPoints", { get: () => 5 });
    Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => ({ mobile: true, platform: "iOS" }) });
  }, IPHONE_UA);
};
const MATCH_DRIVE: Record<string, MatchDrive> = {
  "pc-claude-missing": {
    devs: () => [live(THIS, "高本の MacBook", H.install)],
    local: { checks: H.install },
    act: (p) => expect(fix(p, THIS).locator("[data-install-claude]")).toBeEnabled(WAIT),
  },
  "pc-claude-installing": {
    devs: () => [live(THIS, "高本の MacBook", H.install)],
    local: { checks: H.install, hold: true },
    act: async (p) => {
      await fix(p, THIS).locator("[data-install-claude]").click();
      await expect(fix(p, THIS).getByRole("status")).toHaveText("Claude Code を入れています（1〜2 分）", WAIT);
    },
  },
  "pc-claude-install-error": {
    devs: () => [live(THIS, "高本の MacBook", H.install)],
    local: { checks: H.install, installReply: "abort" },
    act: async (p) => {
      await fix(p, THIS).locator("[data-install-claude]").click();
      await expect(fix(p, THIS).getByRole("alert")).toBeVisible(WAIT);
      await expect(fix(p, THIS).locator("[data-install-claude]")).toBeEnabled(WAIT);
    },
  },
  "pc-claude-broken": {
    devs: () => [live(THIS, "高本の MacBook", H.repair)],
    local: { checks: H.repair },
    act: (p) => expect(fix(p, THIS).locator("[data-install-claude]")).toBeEnabled(WAIT),
  },
  "pc-claude-login": {
    devs: () => [live(THIS, "高本の MacBook", H.login)],
    local: { checks: H.login },
    act: (p) => expect(fix(p, THIS).locator("[data-login-claude]")).toBeEnabled(WAIT),
  },
  "pc-claude-code": {
    devs: () => [live(THIS, "高本の MacBook", H.login)],
    local: { checks: H.login },
    act: toLogin,
  },
  "pc-claude-code-error": {
    devs: () => [live(THIS, "高本の MacBook", H.login)],
    local: { checks: H.login },
    act: async (p) => {
      await sendCode(p, "K373-BAD-CODE");
      await expect(fix(p, THIS).getByRole("alert")).toBeVisible(WAIT);
    },
  },
  "pc-claude-done": {
    devs: () => [live(THIS, "高本の MacBook", H.login)],
    local: { checks: H.login },
    act: async (p) => {
      await sendCode(p, GOOD);
      // 生きている行は読み上げ用の status（札の字）も持つので、知らせの字で 1 つに絞る（K-361 の K361-UI-009 と同じ見つけ方）
      await expect(
        row(p, THIS).getByRole("status").filter({ hasText: "ログインできました。これで仕事を渡せます" }),
      ).toBeVisible(WAIT);
      await expect(fix(p, THIS)).toHaveCount(0, WAIT);
    },
  },
  "pc-claude-other-device": {
    devs: () => [live(THIS, "高本の MacBook", H.ok), live(OTHER, "事務所の Mac mini", H.install)],
    local: { checks: H.ok },
    act: (p) => expect(fix(p, OTHER)).toBeVisible(WAIT),
  },
  // 眠っている PC の古い報告（K-361 の K361-UI-012 の見た目）：ほかの PC の行に「11/15 09:00 の報告」と開く場所
  "pc-asleep": {
    devs: () => [
      live(THIS, "高本の MacBook", H.ok),
      { ...live(OTHER, "事務所の Mac mini", H.install, OLD), state: "asleep" },
    ],
    local: { checks: H.ok },
    act: (p) => expect(fix(p, OTHER)).toContainText("11/15 09:00 の報告", WAIT),
  },
  // スマホで開いた画面（K373-UI-001 の見た目）：押せない「＋ PC をつなぐ」と理由の 1 行・ほかの端末の行のログインしていない区画。
  //   モックの 2 行目も本番も生きている行（今の報告なので報告の時刻は出さない）。行の字と縦の位置は比べない
  "pc-phone": {
    devs: () => [live(THIS, "高本の MacBook", H.ok), live(OTHER, "事務所の Mac mini", H.login)],
    local: { on: false },
    before: asPhone,
    act: async (p) => {
      await expect(p.locator(`${BODY} [data-act="add-pc"]`)).toBeDisabled(WAIT);
      await expect(fix(p, OTHER)).toBeVisible(WAIT);
    },
    pairs: [
      pairOf("add-pc", `${BODY} [data-act="add-pc"]`, MATCH_CTRL),
      pairOf("add-reason", `${BODY} #pc-add-reason`, ["width", ...MATCH_TXT]),
    ],
  },
};
for (const [id, c] of Object.entries(MATCH_DRIVE)) {
  for (const w of MATCH_WIDTHS) {
    test(`K373-UI-004 ${id} 幅 ${w}：Claude Code の区画（箱・題・説明・開く場所・ボタン・ログインの入口とコードの欄・行の中の知らせ）の値がモック /dev/mock/f3-pc/${id} と同じ（共通の道具 matchMock）`, async ({
      browser,
    }) => {
      const opts = {
        pairs: [...MATCH_PAIRS, ...(c.pairs ?? [])],
        base: "/dev/mock/f3-pc",
        blur: true,
      } as MatchOptions & {
        base: string;
      };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await c.before?.(page);
          await mock(page, c.devs(), c.local);
          await open(page, w);
          await c.act(page);
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        opts,
      );
      const parts = new Set(rows.map((r) => r.part));
      expect(parts.has("fix") || parts.has("note"), "Claude Code の区画か行の中の知らせで比べた").toBe(true);
      expect(bad).toEqual([]);
    });
  }
}
