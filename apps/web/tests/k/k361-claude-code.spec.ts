// K-361「PC の行に Claude Code の足りない物と直し方を出す」の画面の試験（実 Chrome）。名前の頭の行 ID（K361-UI-…）は 11_tickets/K-361.md の表に 1 対 1 で結ぶ。
//   口の差し替え・開く手順・行と区画の見つけ方は共通の道具 ./claude-code-mock.ts（この葉が持ち、K-373 も使う）。
//   スマホでつながない 3 行と見た目の突き合わせは K-373（k373-pc-row-phone-match.spec.ts）に移した（2026-11-19 PM の決め）。
//   待ちは出来事で決める（固定の待ちは使わない）。台が混んでも落ちないよう、見える・移るの待ちは 15 秒まで。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { BODY, fix, GOOD, H, LG, live, LOGIN_URL, mock, OLD, open, OTHER, row, THIS, WAIT } from "./claude-code-mock";

/** ログインの入口をこの画面のセッションの保存に持つ鍵（実施事項 ⑥・10 分） */
const LOGIN_KEY = "kaname.claude-login";

test.use({ timezoneId: "UTC" });

test.describe("K-361 PC の行の Claude Code", () => {
  test("K361-UI-001 この PC（/ping の device_id＝行の id）が install：行の中に見出し「Claude Code が入っていません」と「Claude Code を入れる」だけ（ログインは出さない）", async ({
    page,
  }) => {
    await mock(page, [live(THIS, "高本の MacBook", H.install)], { checks: H.install });
    await open(page);
    const f = fix(page, THIS);
    await expect(f).toBeVisible(WAIT);
    await expect(f).toHaveAttribute("data-fix", "install");
    await expect(f.getByText("Claude Code が入っていません")).toBeVisible();
    await expect(f.getByText("自分のAIもAI社員も、あなたのサブスクの Claude Code で動きます。")).toBeVisible();
    await expect(f.locator("[data-install-claude]")).toHaveText("Claude Code を入れる");
    await expect(f.locator("[data-login-claude]")).toHaveCount(0);
    await expect(page.locator(`${BODY} [data-part="claude-fix"]`)).toHaveCount(1);
  });

  test("K361-UI-002 「入れる」を 2 回押しても入れる口は 1 回。途中の行が出て、入ったら「ログインする」に変わる", async ({
    page,
  }) => {
    const m = await mock(page, [live(THIS, "高本の MacBook", H.install)], { checks: H.install, hold: true });
    await open(page);
    const btn = fix(page, THIS).locator("[data-install-claude]");
    await btn.dblclick();
    await expect(fix(page, THIS).getByRole("status")).toContainText("Claude Code を入れています（1〜2 分）", WAIT);
    await expect(btn).toBeDisabled();
    m.local.release();
    await expect(fix(page, THIS)).toHaveAttribute("data-fix", "login", WAIT);
    await expect(fix(page, THIS).locator("[data-login-claude]")).toHaveText("ログインする");
    await expect(fix(page, THIS).locator("[data-install-claude]")).toHaveCount(0);
    expect(m.local.installs).toBe(1);
  });

  test("K361-UI-003 この PC が repair：見出しは E-CONN-011 の文、ボタンは「Claude Code を取り直す」", async ({
    page,
  }) => {
    await mock(page, [live(THIS, "高本の MacBook", H.repair)], { checks: H.repair });
    await open(page);
    const f = fix(page, THIS);
    await expect(f).toHaveAttribute("data-fix", "repair", WAIT);
    await expect(
      f.getByText("Claude Code は入っていますが、本体が落ちてきていないので動きません。下のボタンで取り直せば直ります"),
    ).toBeVisible();
    await expect(f.locator("[data-install-claude]")).toHaveText("Claude Code を取り直す");
  });

  test("K361-UI-004 入れられなかった（Bridge が 409）：Bridge の文を赤で出し、ボタンはもう一度押せる", async ({
    page,
  }) => {
    const m = await mock(page, [live(THIS, "高本の MacBook", H.install)], {
      checks: H.install,
      installReply: { status: 409, body: { ok: false, message: "入れられませんでした（npm ERR! code EACCES）" } },
    });
    await open(page);
    const f = fix(page, THIS);
    await f.locator("[data-install-claude]").click();
    await expect(f.getByRole("alert")).toHaveText("入れられませんでした（npm ERR! code EACCES）", WAIT);
    await expect(f.locator("[data-install-claude]")).toBeEnabled();
    await expect(f).toHaveAttribute("data-fix", "install");
    expect(m.local.installs).toBe(1);
  });

  test("K361-UI-005 この PC が login：「ログインする」を押すと入口のリンク（https・新しいタブ）とコードの欄。空・空白だけでは「決定」を押せない", async ({
    page,
  }) => {
    const m = await mock(page, [live(THIS, "高本の MacBook", H.login)], { checks: H.login });
    await open(page);
    const f = fix(page, THIS);
    await expect(f.locator("[data-install-claude]")).toHaveCount(0, WAIT);
    await f.locator("[data-login-claude]").click();
    const step = f.locator("[data-login-step]");
    await expect(step).toBeVisible(WAIT);
    const link = step.getByRole("link", { name: "この入口" });
    await expect(link).toHaveAttribute("href", LOGIN_URL);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    const field = step.getByLabel("ブラウザに出たコード");
    const ok = step.getByRole("button", { name: "決定" });
    await expect(ok).toBeDisabled();
    await field.fill("   ");
    await expect(ok).toBeDisabled();
    expect(m.local.logins).toBe(1);
    expect(m.local.codes).toEqual([]);
  });

  test("K361-UI-006 正しいコード（前後に空白）を 2 回押し：Bridge に 1 回だけ切って渡し、「ログインできました」が出て区画が消える", async ({
    page,
  }) => {
    const m = await mock(page, [live(THIS, "高本の MacBook", H.login)], { checks: H.login });
    await open(page);
    const f = fix(page, THIS);
    await f.locator("[data-login-claude]").click();
    const step = f.locator("[data-login-step]");
    await step.getByLabel("ブラウザに出たコード").fill(`  ${GOOD} \n`);
    await step.getByRole("button", { name: "決定" }).dblclick();
    await expect(
      row(page, THIS).getByRole("status").filter({ hasText: "ログインできました。これで仕事を渡せます" }),
    ).toBeVisible(WAIT);
    await expect(fix(page, THIS)).toHaveCount(0, WAIT);
    expect(m.local.codes).toEqual([GOOD]);
  });

  test("K361-UI-007 違うコード：Bridge の文を赤で出し、区画とコードの欄は残る", async ({ page }) => {
    const m = await mock(page, [live(THIS, "高本の MacBook", H.login)], { checks: H.login });
    await open(page);
    const f = fix(page, THIS);
    await f.locator("[data-login-claude]").click();
    const field = f.locator("[data-login-step]").getByLabel("ブラウザに出たコード");
    await field.fill("K361-WRONG");
    await f.locator("[data-login-step]").getByRole("button", { name: "決定" }).click();
    await expect(f.getByRole("alert")).toHaveText(
      "ログインできませんでした（OAuth error）。コードを貼り直してください",
      WAIT,
    );
    await expect(f).toHaveAttribute("data-fix", "login");
    await expect(field).toBeVisible();
    expect(m.local.codes).toEqual(["K361-WRONG"]);
  });

  test("K361-UI-008 ログインの途中で読み込み直す：入口とコードの欄を出し直し、ログインを止めない（/login-cancel を送らない）", async ({
    page,
  }) => {
    const m = await mock(page, [live(THIS, "高本の MacBook", H.login)], { checks: H.login });
    await open(page);
    await fix(page, THIS).locator("[data-login-claude]").click();
    await expect(fix(page, THIS).locator("[data-login-step]")).toBeVisible(WAIT);
    await page.reload();
    await expect(page.locator(`${BODY} .k-pc-list`)).toBeVisible(WAIT);
    const step = fix(page, THIS).locator("[data-login-step]");
    await expect(step).toBeVisible(WAIT);
    await expect(step.getByRole("link", { name: "この入口" })).toHaveAttribute("href", LOGIN_URL);
    await expect(step.getByLabel("ブラウザに出たコード")).toBeVisible();
    expect(m.local.cancels).toBe(0);
    expect(m.local.logins).toBe(1);
  });

  test("K361-UI-025 ログインの途中で読み込み直す・入口を持ってから 10 分を過ぎている：入口とコードの欄は出さず「ログインする」をまた押せる。読み込み直しただけではログインの口も止める口も呼ばない", async ({
    page,
  }) => {
    const m = await mock(page, [live(THIS, "高本の MacBook", H.login)], { checks: H.login });
    await open(page);
    await fix(page, THIS).locator("[data-login-claude]").click();
    await expect(fix(page, THIS).locator("[data-login-step]")).toBeVisible(WAIT);
    // 入口を持った時刻（at）を 10 分と 1 秒前にずらす（保存の形はチケットの実施事項 ⑥：kaname.claude-login に { device_id, url, at }）
    const moved = await page.evaluate((key) => {
      const v = window.sessionStorage.getItem(key);
      if (!v) return false;
      const o = JSON.parse(v) as { at: number };
      window.sessionStorage.setItem(key, JSON.stringify({ ...o, at: Date.now() - 601_000 }));
      return true;
    }, LOGIN_KEY);
    expect(moved, "入口がこの画面のセッションの保存に在る").toBe(true);
    await page.reload();
    await expect(page.locator(`${BODY} .k-pc-list`)).toBeVisible(WAIT);
    await expect(fix(page, THIS).locator("[data-login-claude]")).toBeEnabled(WAIT);
    await expect(fix(page, THIS).locator("[data-login-step]")).toHaveCount(0);
    expect(m.local.logins).toBe(1);
    expect(m.local.cancels).toBe(0);
  });

  test("K361-UI-026 入れている途中（この PC の口の /install-progress が running）に読み込み直す：「入れる」は押せず途中の行を出し、入れる口は呼び直さない。終わったら /check を読み直してログインに替わる", async ({
    page,
  }) => {
    const m = await mock(page, [live(THIS, "高本の MacBook", H.install)], {
      checks: H.install,
      progress: { running: true, steps: [{ text: "Claude Code を入れています（1〜2 分）", state: "doing" }] },
    });
    await open(page);
    const f = fix(page, THIS);
    await expect(f.getByRole("status")).toHaveText("Claude Code を入れています（1〜2 分）", WAIT);
    await expect(f.locator("[data-install-claude]")).toBeDisabled();
    m.local.progress = { running: false, steps: [{ text: "入りました", state: "done" }] };
    m.local.checks = H.login;
    await expect(f).toHaveAttribute("data-fix", "login", WAIT);
    await expect(f.locator("[data-login-claude]")).toBeEnabled();
    expect(m.local.installs).toBe(0);
  });

  test("K361-UI-009 入っていてログイン済み（2 行とも ok）・自己診断がまだ無い・知らない直し方・並びでない：どの行にも区画が出ない", async ({
    page,
  }) => {
    await mock(
      page,
      [
        live(THIS, "高本の MacBook", H.ok),
        live(OTHER, "事務所の Windows", [], null),
        live("d2222222-0000-4000-8000-000000000361", "家の Mac", [
          { name: LG, ok: false, detail: "x", fix: "explode" },
        ]),
        live("d3333333-0000-4000-8000-000000000361", "古い Mac", "壊れた"),
      ],
      { checks: H.ok },
    );
    await open(page);
    await expect(page.locator(`${BODY} .k-pc-row`)).toHaveCount(4, WAIT);
    await expect(page.locator(`${BODY} [data-part="claude-fix"]`)).toHaveCount(0);
  });

  test("K361-UI-010 ほかの PC の行（/ping の device_id と違う）が install：理由と「Bridge が入っている PC でこの画面を開いてください」だけ。押せるボタンは無い", async ({
    page,
  }) => {
    await mock(page, [live(THIS, "高本の MacBook", H.ok), live(OTHER, "事務所の Windows", H.install)], {
      checks: H.ok,
    });
    await open(page);
    const f = fix(page, OTHER);
    await expect(f).toBeVisible(WAIT);
    await expect(f.getByText("Claude Code が入っていません")).toBeVisible();
    await expect(f.getByText("Bridge が入っている PC でこの画面を開いてください")).toBeVisible();
    await expect(f.locator("button")).toHaveCount(0);
    await expect(fix(page, THIS)).toHaveCount(0);
  });

  test("K361-UI-011 この PC に Bridge が無い（スマホ・別の端末）で login の行：題はボタンを言わない文（E-CONN-017）、理由と開く場所だけ。押せるボタンは無い", async ({
    page,
  }) => {
    await mock(page, [live(THIS, "高本の MacBook", H.login)], { on: false });
    await open(page);
    const f = fix(page, THIS);
    await expect(f).toHaveAttribute("data-fix", "login", WAIT);
    // 題は目録 E-CONN-017 の文（07_qa/test-specs/errors.json）。E-CONN-016 の「下の『ログインする』を押して…」は、ボタンの無い行では出さない
    await expect(f.locator(".k-pc-part-title")).toHaveText("この PC の Claude Code にログインできていません");
    await expect(f).not.toContainText("ログインする");
    await expect(f.getByText("Bridge が入っている PC でこの画面を開いてください")).toBeVisible();
    await expect(f.locator("button")).toHaveCount(0);
  });

  test("K361-UI-012 眠っている PC の古い報告（install）：「11/15 09:00 の報告」と添え、押せるボタンは無い", async ({
    page,
  }) => {
    await mock(page, [{ ...live(OTHER, "事務所の Windows", H.install, OLD), state: "asleep" }], { on: false });
    await open(page);
    const f = fix(page, OTHER);
    await expect(f).toContainText("11/15 09:00 の報告", WAIT);
    await expect(f.locator("button")).toHaveCount(0);
  });

  test("K361-UI-013 PC が 2 台（この PC は install・ほかはできる）：区画はこの PC の行の下にだけ", async ({ page }) => {
    await mock(page, [live(THIS, "高本の MacBook", H.install), live(OTHER, "事務所の Windows", H.ok)], {
      checks: H.install,
    });
    await open(page);
    await expect(fix(page, THIS)).toBeVisible(WAIT);
    await expect(fix(page, OTHER)).toHaveCount(0);
    await expect(page.locator(`${BODY} [data-part="claude-fix"]`)).toHaveCount(1);
  });

  test("K361-UI-014 古い Bridge（/ping に device_id が無い）の PC で開く：どの行が自分か分からないので、押せるボタンは出さず、開く場所の文を出す", async ({
    page,
  }) => {
    await mock(page, [live(THIS, "高本の MacBook", H.install)], { checks: H.install, deviceId: undefined });
    await open(page);
    const f = fix(page, THIS);
    await expect(f).toBeVisible(WAIT);
    await expect(f.locator("button")).toHaveCount(0);
    await expect(f.getByText("Bridge が入っている PC でこの画面を開いてください")).toBeVisible();
  });

  test("K361-UI-015 守り：ログインのコードと入口の URL は Kaname の口に送らない（この PC の口にだけ）", async ({
    page,
  }) => {
    const m = await mock(page, [live(THIS, "高本の MacBook", H.login)], { checks: H.login });
    await open(page);
    await fix(page, THIS).locator("[data-login-claude]").click();
    const step = fix(page, THIS).locator("[data-login-step]");
    await step.getByLabel("ブラウザに出たコード").fill(GOOD);
    await step.getByRole("button", { name: "決定" }).click();
    await expect(fix(page, THIS)).toHaveCount(0, WAIT);
    expect(m.local.codes).toEqual([GOOD]);
    const sent = m.apiSent.join("\n");
    expect(sent).not.toContain(GOOD);
    expect(sent).not.toContain("K361STATE");
  });

  test("K361-UI-016 入口：ログインの途中を 375・768・1024・1440 の幅で開く：どの幅でも横に溢れない（scrollWidth − clientWidth が 0）", async ({
    page,
  }) => {
    await mock(page, [live(THIS, "高本の MacBook", H.login), live(OTHER, "事務所の Windows", H.install)], {
      checks: H.login,
    });
    await open(page);
    await fix(page, THIS).locator("[data-login-claude]").click();
    await expect(fix(page, THIS).locator("[data-login-step]")).toBeVisible(WAIT);
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(fix(page, THIS).locator("[data-login-step]")).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
          message: `幅 ${width}`,
          ...WAIT,
        })
        .toBe(0);
    }
  });

  test("K361-UI-017 失敗：押したときにこの PC の Bridge が答えない：赤で「この PC の Bridge に届きませんでした…」。ボタンはもう一度押せる", async ({
    page,
  }) => {
    await mock(page, [live(THIS, "高本の MacBook", H.install)], { checks: H.install, installReply: "abort" });
    await open(page);
    const f = fix(page, THIS);
    await f.locator("[data-install-claude]").click();
    await expect(f.getByRole("alert")).toHaveText(
      "この PC の Bridge に届きませんでした。Bridge が開いているか確かめてから、もう一度押してください",
      WAIT,
    );
    await expect(f.locator("[data-install-claude]")).toBeEnabled();
  });

  test("K361-UI-018 Bridge の窓の中（UA に KanameBridge）：同じ区画とボタンが出て、入れる口を呼べる", async ({
    browser,
  }) => {
    const ctx: BrowserContext = await (browser as Browser).newContext({
      userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36 KanameBridge/1.5.0",
      timezoneId: "UTC",
    });
    try {
      const page = await ctx.newPage();
      const m = await mock(page, [live(THIS, "高本の MacBook", H.install)], { checks: H.install });
      await open(page);
      await fix(page, THIS).locator("[data-install-claude]").click();
      await expect(fix(page, THIS)).toHaveAttribute("data-fix", "login", WAIT);
      expect(m.local.installs).toBe(1);
    } finally {
      await ctx.close();
    }
  });

  test("K361-UI-019 この PC の行は、この PC の口の新しい自己診断を先に使う（一覧の報告が login でも、この PC が install ならボタンは「入れる」）", async ({
    page,
  }) => {
    await mock(page, [live(THIS, "高本の MacBook", H.login)], { checks: H.install });
    await open(page);
    await expect(fix(page, THIS)).toHaveAttribute("data-fix", "install", WAIT);
    await expect(fix(page, THIS).locator("[data-install-claude]")).toBeVisible();
    await expect(fix(page, THIS).locator("[data-login-claude]")).toHaveCount(0);
  });

  test("K361-UI-020 手順 2 の失敗：ログインを始める口が 409：Bridge の文を赤で出し、入口とコードの欄は出さず、「ログインする」はまた押せる", async ({
    page,
  }) => {
    const m = await mock(page, [live(THIS, "高本の MacBook", H.login)], {
      checks: H.login,
      loginReply: {
        status: 409,
        body: { ok: false, message: "ログインの入口を開けませんでした。もう一度お試しください" },
      },
    });
    await open(page);
    const f = fix(page, THIS);
    await f.locator("[data-login-claude]").click();
    await expect(f.getByRole("alert")).toHaveText("ログインの入口を開けませんでした。もう一度お試しください", WAIT);
    await expect(f.locator("[data-login-step]")).toHaveCount(0);
    await expect(f.locator("[data-login-claude]")).toBeEnabled();
    expect(m.local.logins).toBe(1);
  });
});
