// K-300「段 2 の部品とモックの画面を本線に入れる」の試験（実 Chrome と、ファイルと検査の道具を読む試験・実装より先に積む）。
//   的：開発用の置き場 /dev/mock/f1（索引）と /dev/mock/f1/<状態>（1 つの状態）。本番と同じ部品（components/k/auth-parts・setting-parts・
//   features/F1/*/views）を、決めた値で並べたモック（代表 OK 2026-11-17・07_functional/段2-F1/機能分解.md）。
//   見ること：51 の状態が全部描ける・幅 375／768／1440 で横のはみ出し 0・見出しが切れない・状態の持ち主が切り方の画面の葉・
//   本番の画面（/login ほか）はまだ段 2 の部品を読まない（動きの無い部品を本番に出さない）・正本の値の検査（design_gate D1〜D8・k218）が緑。
//   口は呼ばない（モックは値を決めて並べるだけ）。本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const MOCKS_SRC = join(WEB, "app/(dev)/dev/mock/f1/mocks.tsx");
const CUT_DOC = join(ROOT, "07_functional/段2-F1/切り方.md");
const SHOTS_SRC = join(ROOT, "07_functional/段2-F1/mock-shots.mjs");
const WIDTHS = [375, 768, 1440] as const;

/** 画面の葉と、その葉が本物にするモックの状態（mocks.tsx の受け持ちと 07_functional/段2-F1/切り方.md の表のとおり・51 個。
 *  代表の答え 2026-11-17（聞くこと-2.md）で login-recover-no-admin・reset-done-other・sec-forced-back・sec-password-set を足した） */
const LEAVES: Record<string, readonly string[]> = {
  "K-316": [
    "login-n",
    "login-e",
    "login-lock",
    "login-wait",
    "login-m",
    "login-m-error",
    "login-backup",
    "login-code-lock",
    "login-tf-expired",
    "login-suspended-member",
    "login-suspended-ws",
  ],
  "K-317": [
    "login-pk-failed",
    "login-pk-unsupported",
    "login-added",
    "login-recover",
    "login-recover-ready",
    "login-recover-sent",
    "login-recover-no-admin",
    "login-recover-failed",
    "login-other-account",
    "login-status-incident",
    "login-status-both",
  ],
  "K-318": [
    "sec-passkey",
    "sec-password",
    "sec-password-2fa",
    "sec-add",
    "sec-add-dup",
    "sec-rename",
    "sec-remove",
    "sec-remove-last",
    "sec-stepup",
  ],
  "K-319": [
    "sec-forced",
    "sec-forced-back",
    "sec-totp",
    "sec-totp-error",
    "sec-backup",
    "sec-password-change",
    "sec-password-set",
  ],
  "K-320": [
    "reset-ask",
    "reset-ask-error",
    "reset-sent",
    "reset-signed-in",
    "reset-new",
    "reset-new-error",
    "reset-done",
    "reset-done-other",
    "reset-dead",
    "reset-invalid",
  ],
  "K-315": ["help-n", "help-incident", "help-unknown"],
};
const ALL = Object.values(LEAVES).flat();
const OWNER = new Map(Object.entries(LEAVES).flatMap(([k, ids]) => ids.map((id) => [id, k] as const)));
/** 小窓を開いた状態（role=dialog に名前があること） */
const DIALOG_STATES = [
  "sec-add",
  "sec-add-dup",
  "sec-rename",
  "sec-remove",
  "sec-remove-last",
  "sec-stepup",
  "sec-totp",
  "sec-totp-error",
  "sec-backup",
  "sec-password-change",
  "sec-password-set",
] as const;

/** mocks.tsx の状態の一覧（id・画面・持ち主のチケット）。prettier が 1 つの状態を複数の行に折っても読む */
function mockEntries(): { id: string; screen: string; ticket: string }[] {
  const src = readFileSync(MOCKS_SRC, "utf8");
  return [
    ...src.matchAll(/\{\s*id: "([^"]+)",\s*screen: "([^"]+)",\s*label: "[^"]*",\s*ticket: "([^"]+)",?\s*\}/g),
  ].map((m) => ({
    id: m[1]!,
    screen: m[2]!,
    ticket: m[3]!,
  }));
}

/** 切り方.md の表の「モックの状態（画面の葉）」の欄を、葉の番号ごとに読む。2 つめから頭（login- など）を省いた書き方を開く */
function cutDocLeaves(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const PREFIX = /^(login|reset|sec|help)-/;
  for (const line of readFileSync(CUT_DOC, "utf8").split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 9 || !/^K-3\d\d$/.test(cells[1] ?? "")) continue;
    const raw = cells[6] ?? "";
    if (!raw || raw === "—" || !PREFIX.test(raw)) continue;
    const parts = raw.split("・").map((s) => s.trim());
    const head = (parts[0]!.match(PREFIX) ?? [""])[0];
    out[cells[1]!] = parts.map((p) => (PREFIX.test(p) ? p : `${head}${p}`));
  }
  return out;
}

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
}

async function openState(page: Page, id: string, width: number) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`/dev/mock/f1/${id}`);
  expect(res?.status(), `${id} を開けない`).toBe(200);
  await expect(page.locator(`[data-mock="${id}"]`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const runPy = (args: string[]) =>
  execFileSync("python3", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300_000 });

// ---- ファイルの突き合わせ（ブラウザ不要） ----

test("K300-MK-001 モックの状態は 51 個で、切り方の画面の葉 6 本（K-315〜K-320）が持つ状態の和とちょうど同じ（余りも欠けも重なりも 0）", () => {
  const ids = mockEntries().map((e) => e.id);
  expect(ids.length).toBe(51);
  expect(new Set(ids).size, "同じ id が 2 つある").toBe(ids.length);
  expect([...ids].sort()).toEqual([...ALL].sort());
});

test("K300-MK-002 各状態の持ち主（mocks.tsx の ticket）は、その状態を本物にする画面の葉。口の葉（K-301〜K-314）と欠番の K-310 を指さない", () => {
  const bad = mockEntries()
    .filter((e) => OWNER.get(e.id) !== e.ticket)
    .map((e) => `${e.id}：${e.ticket}（正は ${OWNER.get(e.id) ?? "無い"}）`);
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K300-MK-003 切り方.md の表の画面の葉のモックの欄を開くと、この試験の葉の表（LEAVES）と同じ（正本とずれていない）", () => {
  const doc = cutDocLeaves();
  expect(Object.keys(doc).sort()).toEqual(Object.keys(LEAVES).sort());
  for (const [k, ids] of Object.entries(LEAVES)) expect([...(doc[k] ?? [])].sort(), k).toEqual([...ids].sort());
});

test("K300-MK-004 本番の画面の入れ物（/login・/password-reset の page.tsx と index。login-form は K-316・/mfa-setup は K-318 がつないだ）は、まだ段 2 の部品（views・auth-parts・setting-parts）を読まない（動きはつなぐ葉 K-316〜K-320 が入れる）", () => {
  const pages = [
    "app/(outside)/login/page.tsx",
    "app/(outside)/password-reset/page.tsx",
    "features/F1/login/index.ts",
  ].map((p) => [p, readFileSync(join(WEB, p), "utf8")] as const);
  for (const [p, src] of pages) {
    expect(src, p).not.toMatch(/features\/F1\/(login\/views|password-reset\/views|security|help)|\.\/views["']/);
    expect(src, p).not.toMatch(/components\/k\/(auth-parts|setting-parts)/);
  }
});

test("K300-MK-005 写しを撮る台本（mock-shots.mjs）は mocks.tsx の状態を全部（51 個・複数の行に折った状態も）、幅 375・768・1440 で撮る", () => {
  const src = readFileSync(SHOTS_SRC, "utf8");
  expect(src).toContain("app/(dev)/dev/mock/f1/mocks.tsx");
  expect(src).toMatch(/for \(const w of \[375, 768, 1440\]\)/);
  // 台本の中の id の取り出し方（matchAll の正規表現）をそのまま mocks.tsx に当てると、mocks.tsx の状態と同じ 51 個になる
  const lit = src.match(/matchAll\((\/.+\/[a-z]*)\)/)?.[1];
  expect(lit, "台本に matchAll の正規表現が無い").toBeTruthy();
  const body = lit!.slice(1, lit!.lastIndexOf("/"));
  const flags = lit!.slice(lit!.lastIndexOf("/") + 1);
  const ids = [
    ...readFileSync(MOCKS_SRC, "utf8").matchAll(new RegExp(body, flags.includes("g") ? flags : `${flags}g`)),
  ].map((m) => m[1]);
  expect([...ids].sort()).toEqual([...ALL].sort());
});

// ---- 正本の値の検査（CI の static の段と同じ命令） ----

test("K300-DS-001 正本と作り手の写しが同じ：gen_tokens.py --web --check と gen_preview.py --check が 0 で終わる（本線の部品と段 2 の部品の和から作り直した）", () => {
  runPy(["04_design/gen_tokens.py", "--web", "--check"]);
  runPy(["04_design/gen_preview.py", "--check"]);
});

test("K300-DS-002 design_gate の D1〜D7（--part --scales --usage）が緑：段 2 の部品の色・書体・角丸・字・部品の契約・未使用が正本どおり", () => {
  const out = runPy([
    "scripts/ci/design_gate.py",
    "--design",
    "04_design/DESIGN-kaname.md",
    "--mocks",
    "apps/web/components/k",
    "apps/web/features",
    "--css",
    "apps/web/styles/k-tokens.css",
    "--part",
    "--scales",
    "--usage",
    "apps/web",
    "apps/bridge/src",
  ]);
  expect(out).not.toMatch(/\bFAIL\b/);
});

test("K300-DS-003 k218 の試験（正本とキャンバスの部品の値・scripts/ci/k218_design_canvas_test.py）が緑", () => {
  runPy(["scripts/ci/k218_design_canvas_test.py"]);
});

test("K300-DS-004 design-gate.json の component_selectors に段 2 の 17 部品があり、どれも正本 DESIGN-kaname.md の components に在る", () => {
  const gate = JSON.parse(readFileSync(join(ROOT, "design-gate.json"), "utf8")) as {
    component_selectors: Record<string, unknown>;
  };
  const design = readFileSync(join(ROOT, "04_design/DESIGN-kaname.md"), "utf8");
  const parts = [
    "auth-choice",
    "auth-choice-title",
    "auth-choice-desc",
    "auth-icon",
    "auth-note-box",
    "auth-ok-box",
    "auth-bad-box",
    "auth-ok-icon",
    "status-strip",
    "status-strip-maint",
    "auth-status-page",
    "auth-qr",
    "auth-secret",
    "backup-codes",
    "backup-code",
    "sec-summary",
    "sec-summary-warn",
  ];
  for (const p of parts) {
    expect(gate.component_selectors[p], `design-gate.json に ${p} が無い`).toBeTruthy();
    expect(design, `正本に ${p} が無い`).toMatch(new RegExp(`^  ${p}:`, "m"));
  }
});

// ---- 実ブラウザ：全部の状態が描ける ----

test("K300-UI-001 索引 /dev/mock/f1：4 つの画面（login・password-reset・mfa-setup・help）の見出しと 51 のリンクが出て、各リンクの先は /dev/mock/f1/<状態>", async ({
  page,
}) => {
  await guard(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/dev/mock/f1"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["login", "password-reset", "mfa-setup", "help"]);
  const hrefs = await page.locator("main a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect([...hrefs].sort()).toEqual(ALL.map((id) => `/dev/mock/f1/${id}`).sort());
});

for (const [row, w] of [
  ["K300-UI-002", 375],
  ["K300-UI-003", 768],
  ["K300-UI-004", 1440],
] as const) {
  test(`${row} 幅 ${w}：51 の状態が全部開け（200）、「この状態はありません」が出ず、h1 が 1 つ以上・横のはみ出し 0`, async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await guard(page);
    const bad: string[] = [];
    for (const id of ALL) {
      await openState(page, id, w);
      if ((await page.getByText("この状態はありません").count()) > 0) bad.push(`${id}：無い状態`);
      if ((await page.locator("h1").count()) < 1) bad.push(`${id}：h1 が無い`);
      const over = await overflowX(page);
      if (over !== 0) bad.push(`${id}：横に ${over}px はみ出す`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test("K300-UI-005 幅 375：どの状態も、見える h1 の 1 文字目と、開いた小窓の箱の左の端が画面の中（左へはみ出さない）", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await guard(page);
  const bad: string[] = [];
  for (const id of ALL) {
    await openState(page, id, 375);
    const lefts = await page.evaluate(() => {
      const seen = (e: Element) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
      };
      const out: { what: string; left: number; right: number }[] = [];
      for (const h of [...document.querySelectorAll("h1")].filter(seen)) {
        const t = document.createTreeWalker(h, NodeFilter.SHOW_TEXT).nextNode();
        if (!t) continue;
        const r = document.createRange();
        r.setStart(t, 0);
        r.setEnd(t, 1);
        const b = r.getBoundingClientRect();
        out.push({ what: `h1「${h.textContent?.trim()}」`, left: b.left, right: b.right });
      }
      for (const d of [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(seen)) {
        const b = d.getBoundingClientRect();
        out.push({ what: "小窓", left: b.left, right: b.right });
      }
      return out;
    });
    for (const l of lefts)
      if (l.left < 0 || l.right > 375) bad.push(`${id}：${l.what} が画面の外（左 ${l.left}・右 ${l.right}）`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K300-UI-006 幅 1440：51 の状態を開いても、ページのエラー（pageerror）と描き直しの食い違い（hydration）の知らせが 0", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await guard(page);
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(`pageerror：${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && /hydrat|did not match|Minified React error/i.test(m.text())) errs.push(m.text());
  });
  for (const id of ALL) await openState(page, id, 1440);
  expect(errs, errs.join("\n")).toEqual([]);
});

test("K300-UI-007 安全の設定：ふだんの状態（sec-passkey など）は外枠の中（.k-shell と第 2 ナビ）、登録の直後（sec-forced・sec-forced-back）は外枠なしの入口の枠（[data-part=auth-box]・聞くこと 3 の答え (a)）", async ({
  page,
}) => {
  await guard(page);
  for (const id of LEAVES["K-318"]!) {
    await openState(page, id, 1440);
    await expect(page.locator(".k-shell"), id).toHaveCount(1);
    await expect(page.locator('[data-part="auth-box"]'), id).toHaveCount(0);
  }
  for (const id of ["sec-forced", "sec-forced-back"]) {
    await openState(page, id, 1440);
    await expect(page.locator(".k-shell"), id).toHaveCount(0);
    await expect(page.locator('[data-part="auth-box"]'), id).toHaveCount(1);
  }
});

test("K300-UI-008 小窓の状態（11 個）：開いた小窓は role=dialog か alertdialog で、読み上げの名前（題）がある", async ({
  page,
}) => {
  await guard(page);
  for (const id of DIALOG_STATES) {
    await openState(page, id, 1440);
    const d = page.locator('[role="dialog"], [role="alertdialog"]').first();
    await expect(d, id).toBeVisible();
    const name = await d.evaluate((e) => {
      const by = e.getAttribute("aria-labelledby");
      return (by ? document.getElementById(by)?.textContent : e.getAttribute("aria-label"))?.trim() ?? "";
    });
    expect(name.length, `${id} の小窓に名前が無い`).toBeGreaterThan(0);
  }
});

test("K300-UI-009 キャンバスに在って機能がまだの物は隠さずグレー（D-145.9）：安全の設定の「入っている端末の一覧」「安全の記録」は薄く出て押せない・パスキーに対応していないブラウザの「パスキーで入る」は 0.55 で disabled", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "sec-passkey", 1440);
  for (const name of ["入っている端末の一覧", "安全の記録"]) {
    const row = page.locator(".k-set-row", { hasText: name });
    await expect(row, name).toBeVisible();
    await expect(row, name).toHaveAttribute("data-off", "");
  }
  await openState(page, "login-pk-unsupported", 1440);
  const pk = page.locator('[data-act="passkey"]');
  await expect(pk).toBeVisible();
  await expect(pk).toBeDisabled();
  expect(Number.parseFloat(await pk.evaluate((e) => getComputedStyle(e).opacity))).toBeCloseTo(0.55, 2);
});

test("K300-UI-010 1 画面 1 主アクション：どの状態も、見えている主ボタン（data-variant=primary・小窓が開いていれば小窓の中だけ数える）は 1 つまで", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await guard(page);
  const bad: string[] = [];
  for (const id of ALL) {
    await openState(page, id, 1440);
    const n = await page.evaluate(() => {
      const scope =
        [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].find(
          (d) => d.getBoundingClientRect().width > 0,
        ) ?? document;
      return [...scope.querySelectorAll('button[data-variant="primary"]')].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length;
    });
    if (n > 1) bad.push(`${id}：主ボタンが ${n} 個`);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});

test("K300-UI-011 2 段階を付ける（sec-totp）：QR は読み上げの名前つきの絵（role=img）で中に svg、読み取れないとき用の鍵の文字（JBSW Y3DP EHPK 3PXP）が字で出る", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "sec-totp", 1440);
  const qr = page.locator(".k-auth-qr");
  await expect(qr).toHaveAttribute("role", "img");
  expect(((await qr.getAttribute("aria-label")) ?? "").length).toBeGreaterThan(0);
  await expect(qr.locator("svg")).toHaveCount(1);
  await expect(page.locator(".k-auth-secret")).toHaveText("JBSW Y3DP EHPK 3PXP");
});

test("K300-UI-012 いまの様子の帯（login-status-both・help-incident）：帯は画面の幅いっぱいで入口の箱より上、障害とメンテナンスの 2 本が role=status で出る。帯の無い状態（login-n）には帯が無い", async ({
  page,
}) => {
  await guard(page);
  await openState(page, "login-status-both", 1440);
  const strips = page.locator(".k-status-strip");
  await expect(strips).toHaveCount(2);
  await expect(strips.nth(0)).toHaveAttribute("data-kind", "incident");
  await expect(strips.nth(1)).toHaveAttribute("data-kind", "maintenance");
  for (const i of [0, 1]) await expect(strips.nth(i)).toHaveAttribute("role", "status");
  const sb = (await strips.nth(0).boundingBox())!;
  expect(Math.round(sb.width)).toBe(1440);
  const bb = (await page.locator('[data-part="auth-box"]').boundingBox())!;
  expect(sb.y + sb.height).toBeLessThanOrEqual(bb.y);
  await openState(page, "login-n", 1440);
  await expect(page.locator(".k-status-strip")).toHaveCount(0);
});

test("K300-UI-013 暗いテーマ（Cookie）：外枠の中の安全の設定（sec-passkey・sec-backup）も横のはみ出し 0 で、外枠が暗いテーマの印を持つ", async ({
  page,
  context,
  baseURL,
}) => {
  await guard(page);
  // 印の名前は lib/theme の THEME_COOKIE。値は dark
  const theme = readFileSync(join(WEB, "lib/theme.ts"), "utf8").match(/THEME_COOKIE\s*=\s*"([^"]+)"/)?.[1];
  expect(theme, "lib/theme.ts の THEME_COOKIE").toBeTruthy();
  await context.addCookies([{ name: theme!, value: "dark", url: String(baseURL) }]);
  for (const id of ["sec-passkey", "sec-backup"]) {
    for (const w of WIDTHS) {
      await openState(page, id, w);
      expect(await overflowX(page), `${id} 幅 ${w}`).toBe(0);
    }
    const dark = await page.evaluate(
      () =>
        document.documentElement.dataset["theme"] === "dark" ||
        document.querySelector('[data-theme="dark"]') !== null ||
        document.documentElement.classList.contains("dark"),
    );
    expect(dark, `${id} が暗いテーマの印を持たない`).toBe(true);
  }
});

test("K300-UI-014 メンテナンスの帯はメンテナンス中だけ（answer=88f98638a534）：login-status-both と help-incident の見本は「メンテナンス中です。この間は使えません」「11/20 3:00 まで」。予定の形（「2:00〜3:00 メンテナンス」・曜日つき）は出ない", async ({
  page,
}) => {
  await guard(page);
  for (const id of ["login-status-both", "help-incident"]) {
    await openState(page, id, 1440);
    await expect(page.getByText("メンテナンス中です。この間は使えません").first(), id).toBeVisible();
    await expect(page.getByText("11/20 3:00 まで").first(), id).toBeVisible();
    await expect(page.getByText(/2:00〜3:00 メンテナンス|11\/20（[月火水木金土日]）/), id).toHaveCount(0);
  }
});
