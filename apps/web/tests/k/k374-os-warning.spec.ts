// K-374「つなぐ小窓の受け取る段に、受け取った後だけ OS の警告の越え方を出す」の画面の試験（実 Chrome・実装より先に積む）。
//   画面：/setup/bridge（K-57 の features/F3/connect-pc）のつなぐ小窓（ConnectDialog）。正のモック：/dev/mock/f3-pc の pc-os-warning・pc-os-warning-mac・pc-os-warning-win
//   （本番と同じ部品 apps/web/features/F3/connect-pc/pc-row-parts.tsx の OsWarning と、connect-dialog.tsx の差す所 takeHelp。K-369 が本線に入れる）。
//   代表の答え answer=7cf148a79dc9（2026-11-19）：前の「PC をつなぐ」画面（K-367 が消す）にあった OS の警告の越え方を、新しい画面の受け取る段に足す。
//   口（listMyDevices・createPairingCode・downloadBridgeRelease）は網の手前（page.route）で差し替える。本人の Bridge（127.0.0.1:38617）には届かせない（接続を断る＝ブラウザで Bridge が無い人）。
//   固定の待ち（waitForTimeout）は使わない。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { MATCH_WIDTHS, matchMock, type MatchOptions } from "./stage2-match";
// 作り物の秘密の値は apps/web/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K374_WEB_TOKEN } from "../../test/_fake/secrets";

const SUMMARY = "「開いていません」「PC が保護されました」と出たとき";
const TAKEN = "ダウンロードを始めました";
const MAC_STEPS = [
  "「完了」を押す（「ゴミ箱に入れる」は押さない）",
  "画面左上のアップルメニュー →「システム設定」→「プライバシーとセキュリティ」",
  "このまま開く",
  "もう一度 Kaname Bridge を開き、出てきた確認で「開く」を押す",
];

interface Mock {
  downloads: string[];
  /** 受け取りの口の答え（既定 200・ファイル） */
  downloadStatus: number;
}

async function mockApi(page: Page, o: Partial<Mock> = {}): Promise<Mock> {
  const m: Mock = { downloads: [], downloadStatus: 200, ...o };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), K374_WEB_TOKEN);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.abort("connectionrefused"));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/api/v1/bridge/devices") return json(200, { data: [], meta: {} });
    if (p === "/api/v1/bridge/pairing-codes" && req.method() === "POST")
      return json(201, {
        data: { code: "KQ7M2X", expires_at: new Date(Date.now() + 600_000).toISOString() },
      });
    const d = /^\/api\/v1\/bridge\/releases\/(\w+)\/file$/.exec(p);
    if (d) {
      m.downloads.push(d[1]!);
      if (m.downloadStatus !== 200)
        return json(m.downloadStatus, {
          error: "connectivity",
          code: m.downloadStatus === 401 ? "UNAUTHENTICATED" : "E-PAGE-007",
        });
      return route.fulfill({ status: 200, contentType: "application/octet-stream", body: "Kaname-Bridge" });
    }
    return json(404, { error: "not_found", code: "NOT_FOUND" });
  });
  return m;
}

const dialog = (page: Page) => page.locator(".k-dialog");
const step1 = (page: Page) => dialog(page).locator(".k-steps > li").first();
const warning = (page: Page) => dialog(page).locator("[data-os-warning]");

/** はじめて開いた人（つないだ PC が無い・ブラウザで Bridge が無い）：小窓が自分で開き、コードが出るまで待つ */
async function open(page: Page, width = 1440, height = 1000) {
  await page.setViewportSize({ width, height });
  const res = await page.goto("/setup/bridge");
  expect(res?.status()).toBe(200);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByTestId("pairing-code")).toHaveText("KQ7M2X");
}
/** 受け取る（字のリンク）を押し、受け取りの結果の知らせが出るまで待つ */
async function take(page: Page, m: Mock, os: "mac" | "win") {
  const before = m.downloads.length;
  await step1(page)
    .getByRole("button", { name: os === "mac" ? "Mac 用を受け取る" : "Windows 用を受け取る" })
    .click();
  await expect.poll(() => m.downloads.length).toBe(before + 1);
  await expect(dialog(page).getByRole("status").filter({ hasText: TAKEN })).toBeVisible();
}
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---------------------------------------------------------------- 受け取る前と後

test("K374-UI-002 受け取る前の小窓：受け取る段に越え方（[data-os-warning]）は無い（キャンバス EdPC の絵のまま）。1 段目の丸は「1」", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await expect(warning(page)).toHaveCount(0);
  await expect(dialog(page).getByText(SUMMARY)).toHaveCount(0);
  await expect(step1(page).locator(".k-step-dot")).toHaveText("1");
  expect(m.downloads).toEqual([]);
});

test("K374-UI-003 Mac 用を受け取る：口 downloadBridgeRelease（mac）を 1 回。受け取る段（1 段目）の中、受け取るの字のリンクの下に、閉じた形の越え方（見出し「「開いていません」「PC が保護されました」と出たとき」）が 1 つ。中は Mac の分だけで Windows の分は無い", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await take(page, m, "mac");
  expect(m.downloads).toEqual(["mac"]);
  const w = step1(page).locator("[data-os-warning]");
  await expect(w).toHaveCount(1);
  await expect(warning(page)).toHaveCount(1);
  await expect(w.locator("summary")).toHaveText(SUMMARY);
  expect(await w.evaluate((d) => (d as HTMLDetailsElement).open), "閉じた形で出す").toBe(false);
  await expect(w.locator('[data-os-warning-os="mac"]')).toHaveCount(1);
  await expect(w.locator('[data-os-warning-os="win"]')).toHaveCount(0);
  const below = await step1(page).evaluate((li) => {
    const link = li.querySelector(".k-pc-take:last-of-type");
    const det = li.querySelector("[data-os-warning]");
    return !!link && !!det && (link.compareDocumentPosition(det) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(below, "越え方は受け取るの字のリンクの後").toBe(true);
});

test("K374-UI-004 Mac の越え方を開く：前置き（署名の手続き中・中身の問題ではない・1 回越えれば次からは出ない）と Mac の 4 つの手順（「完了」→ システム設定 → プライバシーとセキュリティ →「このまま開く」→ もう一度開く）。コマンド・右クリックの案内は出さない", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await take(page, m, "mac");
  const w = warning(page);
  await w.locator("summary").click();
  expect(await w.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
  await expect(w).toContainText("署名の手続き中");
  await expect(w).toContainText("中身の問題ではありません");
  await expect(w).toContainText("1 回越えれば次からは出ません");
  await expect(w.locator('[data-os-warning-os="mac"]')).toContainText('Mac（「"Kaname Bridge" は開いていません」）');
  const items = w.locator('[data-os-warning-os="mac"] li');
  await expect(items).toHaveCount(4);
  for (const [i, t] of MAC_STEPS.entries()) await expect(items.nth(i)).toContainText(t);
  const text = (await w.innerText()).toLowerCase();
  for (const bad of ["xattr", "sudo", "ターミナル", "コマンド", "右クリック"])
    expect(text, `「${bad}」を案内しない`).not.toContain(bad);
});

test("K374-UI-005 Windows 用を受け取る：口（win）を 1 回。開くと Windows の 2 つの手順（「詳細情報」→「実行」）だけで、Mac の分は無い", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await take(page, m, "win");
  expect(m.downloads).toEqual(["win"]);
  const w = warning(page);
  await w.locator("summary").click();
  await expect(w.locator('[data-os-warning-os="win"]')).toContainText(
    "Windows（「Windows によって PC が保護されました」）",
  );
  await expect(w.locator('[data-os-warning-os="win"] li')).toHaveText(["「詳細情報」を押す", "「実行」を押す"]);
  await expect(w.locator('[data-os-warning-os="mac"]')).toHaveCount(0);
});

test("K374-UI-006 Mac 用の後に Windows 用を受け取る：越え方は 1 つのまま、中は後で受け取った Windows の分に替わる", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await take(page, m, "mac");
  await take(page, m, "win");
  expect(m.downloads).toEqual(["mac", "win"]);
  await expect(warning(page)).toHaveCount(1);
  await expect(warning(page).locator('[data-os-warning-os="win"]')).toHaveCount(1);
  await expect(warning(page).locator('[data-os-warning-os="mac"]')).toHaveCount(0);
});

test("K374-UI-007 受け取りに失敗（口が 503・E-PAGE-007）：越え方は出ない。小窓に「読み込めませんでした」、1 段目の丸は「1」のまま", async ({
  page,
}) => {
  const m = await mockApi(page, { downloadStatus: 503 });
  await open(page);
  await step1(page).getByRole("button", { name: "Mac 用を受け取る" }).click();
  await expect.poll(() => m.downloads).toEqual(["mac"]);
  await expect(dialog(page).getByText(/読み込めませんでした/)).toBeVisible();
  await expect(warning(page)).toHaveCount(0);
  await expect(step1(page).locator(".k-step-dot")).toHaveText("1");
});

test("K374-UI-012 Mac 用を受け取れた後に Windows 用の受け取りが失敗（口が 503・E-PAGE-007）：越え方は前に受け取れた Mac の分のまま 1 つ・1 段目の丸は ✓ のまま・小窓に「読み込めませんでした」", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await take(page, m, "mac");
  m.downloadStatus = 503;
  await step1(page).getByRole("button", { name: "Windows 用を受け取る" }).click();
  await expect.poll(() => m.downloads).toEqual(["mac", "win"]);
  await expect(dialog(page).getByText(/読み込めませんでした/)).toBeVisible();
  await expect(step1(page).locator(".k-step-dot")).toHaveText("✓");
  await expect(warning(page)).toHaveCount(1);
  await expect(warning(page).locator('[data-os-warning-os="mac"]')).toHaveCount(1);
  await expect(warning(page).locator('[data-os-warning-os="win"]')).toHaveCount(0);
});

test("K374-UI-008 キーボード：受け取るの字のリンクに焦点 → Enter で受け取り、越え方の見出しに Tab で焦点 → Enter で開き、もう一度 Enter で閉じる", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await step1(page).getByRole("button", { name: "Mac 用を受け取る" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => m.downloads).toEqual(["mac"]);
  const summary = warning(page).locator("summary");
  await expect(summary).toBeVisible();
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => warning(page).evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
  await page.keyboard.press("Enter");
  await expect.poll(() => warning(page).evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
});

test("K374-UI-009 途中でやめて戻る：受け取った後に「あとで」で閉じ、「＋ PC をつなぐ」で開き直すと、1 段目は ✓ のまま越え方も閉じた形で残る（受け取った事実は消さない）", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await take(page, m, "mac");
  await dialog(page).locator(".k-dialog-actions").getByRole("button", { name: "あとで" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.locator(".k-pc-card-head").getByRole("button", { name: "＋ PC をつなぐ" }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(step1(page).locator(".k-step-dot")).toHaveText("✓");
  await expect(warning(page)).toHaveCount(1);
  expect(await warning(page).evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
  await expect(warning(page).locator('[data-os-warning-os="mac"]')).toHaveCount(1);
});

test("K374-UI-011 受け取った後に画面を読み込み直す：小窓は開き直すが受け取る前の形に戻る（越え方は 0・1 段目の丸は「1」）。読み込み直しでは受け取りの口を呼ばない", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await take(page, m, "mac");
  await expect(warning(page)).toHaveCount(1);
  await page.reload();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByTestId("pairing-code")).toHaveText("KQ7M2X");
  await expect(warning(page)).toHaveCount(0);
  await expect(step1(page).locator(".k-step-dot")).toHaveText("1");
  expect(m.downloads).toEqual(["mac"]);
});

test("K374-UI-010 幅 320・375・768・1024・1440（高さ 812 と 560）で越え方を開いた小窓：横のはみ出し 0、小窓の頭と足（ボタン）は画面の中（中身だけがスクロールする）", async ({
  page,
}) => {
  test.setTimeout(180_000); // 幅 5 つ × 高さ 2 つで 10 回開き直す（台が混んでも時間切れで落とさない）
  const m = await mockApi(page);
  const bad: string[] = [];
  for (const width of [320, 375, 768, 1024, 1440]) {
    for (const height of [812, 560]) {
      await open(page, width, height);
      await take(page, m, "mac");
      await warning(page).locator("summary").click();
      await expect.poll(() => warning(page).evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true);
      const o = await overflowX(page);
      if (o !== 0) bad.push(`幅 ${width}×${height}：横のはみ出し ${o}`);
      const r = await dialog(page).evaluate((d) => {
        const head = d.querySelector(".k-dialog-head")!.getBoundingClientRect();
        const act = d.querySelector(".k-dialog-actions")!.getBoundingClientRect();
        return { head: head.top, actTop: act.top, actBottom: act.bottom, inner: window.innerHeight };
      });
      if (r.head < 0 || r.actTop < 0 || r.actBottom > r.inner)
        bad.push(`幅 ${width}×${height}：頭 ${r.head}・足 ${r.actTop}〜${r.actBottom}（画面 ${r.inner}）`);
    }
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

// ---------------------------------------------------------------- 待っている印の置き場（代表の答え answer=8d3ada64dcbd・2026-11-20）
const WAIT = "アプリからの返事を待っています…";
const step2 = (page: Page) => dialog(page).locator(".k-steps > li").nth(1);
const foot = (page: Page) => dialog(page).locator(".k-dialog-actions");

test("K374-UI-013 受け取る前の小窓：待っている字と橙の点は 2 段目（コードの段）の「新しいコード」の下に 1 つ。足の帯はボタン「あとで」だけ", async ({
  page,
}) => {
  await mockApi(page);
  await open(page);
  await expect(dialog(page).getByText(WAIT)).toHaveCount(1);
  const wait = step2(page).getByText(WAIT);
  await expect(wait).toBeVisible();
  const dot = step2(page).locator(".k-wait-dot");
  await expect(dot).toHaveCount(1);
  expect(Math.round((await dot.boundingBox())!.width)).toBe(8);
  expect(await dot.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(180, 83, 9)");
  const again = (await step2(page).getByRole("button", { name: "新しいコード" }).boundingBox())!;
  expect((await wait.boundingBox())!.y, "待っている字は「新しいコード」より下").toBeGreaterThanOrEqual(
    again.y + again.height,
  );
  await expect(foot(page).getByText(WAIT)).toHaveCount(0);
  await expect(foot(page).locator(".k-wait-dot")).toHaveCount(0);
  await expect(foot(page).getByRole("button")).toHaveCount(1);
  await expect(foot(page).getByRole("button", { name: "あとで" })).toBeVisible();
});

test("K374-UI-014 Mac 用を受け取って越え方が出た後も、待っている字は 2 段目の中に 1 つ（越え方は 1 段目の中）。足の帯に待っている字は無い", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  await take(page, m, "mac");
  await expect(step1(page).locator("[data-os-warning]")).toHaveCount(1);
  await expect(dialog(page).getByText(WAIT)).toHaveCount(1);
  await expect(step2(page).getByText(WAIT)).toBeVisible();
  await expect(foot(page).getByText(WAIT)).toHaveCount(0);
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock・置き場は /dev/mock/f3-pc・K-369 が本線に入れる）
//   小窓の 1 段目の丸と、越え方の箱・見出し・OS の名前・手順・受け取りの知らせを、手順の並び（.k-steps）の上端からの y で比べる。
//   接続コードの字は試験とモックで違うので比べない（小窓の形は K-230 の K230-UI-019 がキャンバス EdPC と比べる）

const TXT = ["font-size", "font-weight", "color", "line-height", "texts"];
function pairs(): FidelityPair[] {
  const S = ".k-dialog .k-steps";
  const yFrom = {
    max_width: 1440,
    canvas: S,
    app: S,
    why: "小窓の上端は外枠の帯の有無で幅ごとに違う。受け取る段の中の並びだけを手順の並びの上端から比べる（K-374）",
  };
  const p = (name: string, sel: string, props: string[]): FidelityPair =>
    ({ name, role: name, canvas: sel, app: sel, props: [...props, "y"], y_from: yFrom }) as FidelityPair;
  return [
    p("step1-dot", `${S} > li:first-child .k-step-dot`, ["x", "width", "height", "background-color", "texts"]),
    p("os-warning", `${S} [data-os-warning]`, ["x", "width", "height", "texts"]),
    p("os-summary", `${S} [data-os-warning] > summary`, ["x", ...TXT]),
    p("os-name", `${S} .k-pc-os-warning-os`, ["x", ...TXT]),
    p("os-step", `${S} .k-pc-os-warning-body li`, ["x", "width", ...TXT]),
    p("take-note", ".k-dialog .k-pc-dialog-note", ["x", ...TXT]),
  ];
}
const DRIVE: Record<string, (p: Page, m: Mock) => Promise<void>> = {
  "pc-os-warning": (p, m) => take(p, m, "mac"),
  "pc-os-warning-mac": async (p, m) => {
    await take(p, m, "mac");
    await warning(p).locator("summary").click();
  },
  "pc-os-warning-win": async (p, m) => {
    await take(p, m, "win");
    await warning(p).locator("summary").click();
  },
};
for (const [id, act] of Object.entries(DRIVE)) {
  for (const w of MATCH_WIDTHS) {
    test(`K374-UI-001 ${id} 幅 ${w}：受け取る段の丸・越え方（箱・見出し・OS の名前・手順）・受け取りの知らせの値がモック /dev/mock/f3-pc/${id} と同じ（共通の道具 matchMock）`, async ({
      browser,
    }) => {
      const opts = { pairs: pairs(), base: "/dev/mock/f3-pc", blur: true } as MatchOptions & { base: string };
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          const m = await mockApi(page);
          await open(page, w, w === 375 ? 812 : 900);
          await act(page, m);
        },
        opts,
      );
      expect(new Set(rows.map((r) => r.part)), "越え方を比べた").toContain("os-warning");
      expect(bad).toEqual([]);
    });
  }
}
