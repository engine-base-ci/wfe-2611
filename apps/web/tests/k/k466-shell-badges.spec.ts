// K-466「外枠を getShell 1 本につなぎ替える（左の数・グループの件数・ベルの数・役と名前・会社名・PC の印）」の画面の試験（実 Chrome・実装より先に積む）。
//   外枠（TicketShell）は前は me・listScopes・listApprovalQueue・listMyDevices の 4 本を読んでいた。getShell 1 本（GET /api/v1/shell・K-465）に替える（D-151.7・P8）。
//   正のモック：/dev/mock/f7 の f7-shell-badges（承認待ち 9・グループごとの数 18／42／9・ベルの数 3。下絵を見た会話で代表が OK）。
//   口は網の手前で差し替える（土台は tests/k/list-mock.ts か tests/features/F5/approve-complete.harness.ts の上に tests/k/f7-shell-mock.ts の mockShell）。
//   getShell の形は K-465 の試験（apps/api/test/features/F7/shell.test.ts）のとおり（tests/k/shell-answer.ts）。
//   外枠を持つ画面は 1 画面ではない（/tickets・/tickets/:id・/approvals・/tickets?new=1）ので、共通の外枠の振る舞いは全部の画面で見る（G-05）。
//   障害の帯（banner）は読むだけで描かない（F12 が描く・決定）。ベルの押し方は K-467・探す欄は K-471（この葉では今のまま押せない形）。
//   固定の待ちは使わない（要素と答えを待つ）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { openQueue, openTicket, mockApi } from "../features/F5/approve-complete.harness";
import { mockShell, pathsOf, type ShellMock } from "./f7-shell-mock";
import { items, mockList, open } from "./list-mock";
import { ACCT, DEV, SALES, type ShellGroup, type ShellOpts } from "./shell-answer";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const src = (rel: string) => readFileSync(join(WEB, rel), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const G3: ShellGroup[] = [
  { id: SALES, name: "営業", ticket_prefix: "EG", writable: true, open_count: 18 },
  { id: DEV, name: "受託開発", ticket_prefix: "JD", writable: true, open_count: 42 },
  { id: ACCT, name: "経理", ticket_prefix: "KR", writable: false, open_count: 9 },
];
/** モック f7-shell-badges と同じ数（承認待ち 9・ベル 3・グループ 18／42／9） */
const BADGES: ShellOpts = { approvals: 9, unread: 3, groups: G3, pcConnected: true };

const leftNav = (p: Page) => p.getByRole("navigation", { name: "メニュー", exact: true });
const bar = (p: Page) => p.locator("header.k-bar");
const bell = (p: Page) => bar(p).locator(".k-bell");
const groupRows = (p: Page) => leftNav(p).locator(".k-nav-item:has(.k-group-mark)");
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** 外枠を持つ 3 つの画面。どれも getShell を答える口を差した上で開く */
type Screen = "list" | "detail" | "queue";
const SCREENS: Screen[] = ["list", "detail", "queue"];
async function openScreen(page: Page, s: Screen, o: ShellOpts, w = 1440, over: Parameters<typeof mockShell>[2] = {}) {
  if (s === "list")
    await mockList(page, { list: () => ({ status: 200, body: { data: items(3), meta: { next_cursor: null } } }) });
  else await mockApi(page);
  const m = await mockShell(page, o, over);
  if (s === "list") {
    await open(page, "/tickets", w);
    await expect(page.getByRole("table", { name: "チケットの一覧" }).locator("tbody tr[data-ticket]")).toHaveCount(3);
  } else if (s === "detail") await openTicket(page, w);
  else await openQueue(page, w);
  await expect(page.locator("#k-main h1").first()).toBeVisible();
  return m;
}
const count = (m: ShellMock, path: string) => pathsOf(m).filter((p) => p === path).length;

// ---- ファイルを読む（ブラウザ不要） ----

test('K466-SL-001 外枠は getShell を 1 本読む：ticket-shell.tsx が call("getShell") を持ち、listScopes・listApprovalQueue・listMyDevices・me を外枠のために呼ばない。SCOPES_KEY は SHELL_KEY と同じ問い合わせ（グループの口を 2 つにしない）', () => {
  const c = code(src("features/F4/create-ticket/ticket-shell.tsx"));
  expect(c).toMatch(/call\(\s*"getShell"/);
  expect(c).not.toMatch(/call\(\s*"listScopes"/);
  expect(c).not.toMatch(/call\(\s*"listMyDevices"/);
  expect(c).not.toMatch(/queryFn:\s*me\b/);
  expect(c).toMatch(/export const SHELL_KEY\b/);
  expect(c).toMatch(/export const SCOPES_KEY\s*=\s*SHELL_KEY/);
  // 一覧の右の列だけが承認待ちの行を読む（外枠は数を getShell から）
  expect(c).toMatch(/export async function readApprovals\b/);
  expect(c).not.toMatch(/useQuery\(\{[^}]*queryKey:\s*APPROVALS_KEY/);
});

test("K466-SL-002 ベルの数は 99 を超えたら「99+」：components/k/shell.tsx の BellButton が 99+ を出し、読み上げは「お知らせ（99 件以上）」。障害の帯 banner は ticket-shell.tsx が読むだけで描かない", () => {
  const shell = code(src("components/k/shell.tsx"));
  expect(shell).toContain("99+");
  expect(shell).toContain("99 件以上");
  const ts = code(src("features/F4/create-ticket/ticket-shell.tsx"));
  expect(ts).not.toMatch(/banner\.incidents|maintenance/);
});

test("K466-SL-003 小さなお知らせの置き場（Toaster）は TicketShell に 1 つだけ：ticket-shell.tsx が Toaster を components/k から読んで Shell を包み、security-screen.tsx は Toaster を自分で包まない（同じ id の置き場が 2 つあると同じお知らせが 2 回出る）", () => {
  const ts = code(src("features/F4/create-ticket/ticket-shell.tsx"));
  expect(ts).toMatch(/import\s*\{[^}]*\bToaster\b[^}]*\}\s*from\s*"@\/components\/k"/);
  expect(ts).toMatch(/<Toaster>[\s\S]*<Shell\b[\s\S]*<\/Shell>[\s\S]*<\/Toaster>/);
  expect(code(src("features/F1/security/security-screen.tsx"))).not.toMatch(/<Toaster\b/);
});

test("K466-LG-001 速さの台帳（scripts/ci/perf_budget.json）の画面の行が締まる：/tickets は 7 以下・/tickets?new=1 は 8 以下・/tickets/:id は 6 以下（段 7 の K-392 のやり取り・K-397 の決定の一覧を含む）・/approvals は 2 以下。どの行にも /api/v1/shell が calls と marks に在り、/api/v1/scopes と /api/v1/bridge/devices は無い。/tickets/:id の calls に timeline と decisions が在り、api にその 2 行が在る。api の /api/v1/shell は台帳の数え方で文 9・取引 1（口の中の文 4＋入口の 5 文）", () => {
  const d = JSON.parse(readFileSync(join(ROOT, "scripts/ci/perf_budget.json"), "utf8")) as {
    screens: { path: string; marks: string[]; calls: string[]; max_calls: number; max_stages: number }[];
    api: { path: string; max_statements: number; max_begins: number }[];
  };
  const by = new Map(d.screens.map((s) => [s.path, s]));
  const want: [string, number][] = [
    ["/tickets", 7],
    ["/tickets?new=1", 8],
    ["/tickets/:id", 6],
    ["/approvals", 2],
  ];
  for (const [path, max] of want) {
    const s = by.get(path);
    expect(s, `台帳に ${path} が無い`).toBeTruthy();
    expect(s!.max_calls, path).toBeLessThanOrEqual(max);
    expect(s!.max_stages, path).toBe(1);
    expect(s!.calls, path).toContain("/api/v1/shell");
    expect(s!.marks, path).toContain("GET /api/v1/shell");
    expect(s!.calls, path).not.toContain("/api/v1/bridge/devices");
    expect(s!.calls, path).not.toContain("/api/v1/scopes");
  }
  const detail = by.get("/tickets/:id")!;
  expect(detail.calls).toContain("/api/v1/tickets/:id/timeline");
  expect(detail.calls).toContain("/api/v1/tickets/:id/decisions");
  expect(detail.marks).toContain("GET /api/v1/tickets/:id/decisions");
  const apis = new Map(d.api.map((a) => [a.path, a]));
  for (const path of ["/api/v1/tickets/:id/timeline?limit=20", "/api/v1/tickets/:id/decisions", "/api/v1/shell"])
    expect(apis.get(path), `台帳の api に ${path} が無い`).toBeTruthy();
  // getShell は 1 取引・口の中の文 4（本人と数と帯・グループと件数・未読・保存した条件）に入口の 5 文を足した台帳の数え方で 9。台帳は目標と同じ 9・1（緩めない・締めすぎて K-465 を赤にしない）
  expect(apis.get("/api/v1/shell")).toMatchObject({ max_statements: 9, max_begins: 1 });
});

// ---- 外枠の数と印（全部の画面） ----

for (const s of SCREENS) {
  test(`K466-UI-001 ${s}：外枠の口は getShell を 1 回だけ読み、グループの口（scopes）・PC の口（bridge/devices）は呼ばない。時計を 60 秒進めても窓に戻っても増えない`, async ({
    page,
  }) => {
    await page.clock.install();
    const m = await openScreen(page, s, BADGES);
    await expect(leftNav(page).locator(".k-pc")).toHaveText("PC つながっている");
    expect(count(m, "/api/v1/shell")).toBe(1);
    expect(count(m, "/api/v1/scopes")).toBe(0);
    expect(count(m, "/api/v1/bridge/devices")).toBe(0);
    await page.clock.runFor(60_000);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
    await page.clock.runFor(10_000);
    expect(count(m, "/api/v1/shell")).toBe(1);
    // 承認待ちの行を読むのは、行を出す画面（一覧の右の列・承認待ちの本文）だけ。外枠の数は getShell から
    expect(count(m, "/api/v1/approvals/queue")).toBe(s === "detail" ? 0 : 1);
    // 役のための口 me を外枠は読まない（読むのは本文が名前を要る画面だけ）
    expect(count(m, "/api/auth-ext/me")).toBe(s === "queue" ? 0 : 1);
  });
}

for (const s of SCREENS) {
  test(`K466-UI-002 ${s}：左のメニューの承認待ちの数は getShell の approvals_waiting（9 件）。0 のときは数の印を出さない`, async ({
    page,
  }) => {
    await openScreen(page, s, { ...BADGES, approvals: 9 });
    const badge = leftNav(page)
      .getByRole("link", { name: /^承認待ち/ })
      .locator(".k-nav-badge");
    // 承認待ちの画面は本文が読んだ自分の数（土台の答えは 3 件）を外枠に渡す（口を二重に読まない・K138-SH-027）。それ以外は getShell の 9
    const n = s === "queue" ? "3" : "9";
    await expect(badge).toHaveText(n);
    await expect(badge).toHaveAttribute("aria-label", `${n} 件`);
  });
}

test("K466-UI-003 承認待ちの数が 0：/tickets と /tickets/:id で、承認待ちの項目に数の印（.k-nav-badge）が無い", async ({
  page,
}) => {
  for (const s of ["list", "detail"] as const) {
    await openScreen(page, s, { ...BADGES, approvals: 0 });
    await expect(leftNav(page).getByRole("link", { name: /^承認待ち/ })).toBeVisible();
    await expect(
      leftNav(page)
        .getByRole("link", { name: /^承認待ち/ })
        .locator(".k-nav-badge"),
      s,
    ).toHaveCount(0);
  }
});

for (const s of SCREENS) {
  test(`K466-UI-004 ${s}：グループは getShell の groups 3 行（営業 EG 18・受託開発 JD 42・経理 KR 9）。件数は open_count・札は番号の頭・行は、概要がまだ無い間（K-480 の区画が準備中）はグレーで押せない形、概要ができた後（K-480 が区画を本物にしたとき・K-599 の groupHref）は概要へのリンク（D-145.18）`, async ({
    page,
  }) => {
    await openScreen(page, s, BADGES);
    await expect(groupRows(page)).toHaveCount(3);
    await expect(groupRows(page).locator(".k-nav-label").first()).toHaveText("営業");
    await expect(groupRows(page).locator(".k-group-mark")).toHaveText(["EG", "JD", "KR"]);
    await expect(groupRows(page).locator(".k-nav-count")).toHaveText(["18", "42", "9"]);
    for (let i = 0; i < 3; i++) {
      const g = groupRows(page).nth(i);
      const href = await g.getAttribute("href");
      if (href === null) {
        // 概要がまだ無い間：グレーで押せない形（href なし・押しても URL が変わらない）
        await expect(g).toHaveAttribute("aria-disabled", "true");
        const before = page.url();
        await g.click({ force: true });
        expect(page.url()).toBe(before);
      } else {
        // 概要ができた後（K-480）：概要へのリンク（その行のグループ）。押せない印は付かない
        expect(href).toBe(`/tickets?view=overview&scope=${[SALES, DEV, ACCT][i]}`);
        await expect(g).not.toHaveAttribute("aria-disabled", "true");
      }
    }
  });
}

test("K466-UI-005 グループの件数 0 は数を出さない（D-144.3・K-465 の申し送り）。番号の頭が無いグループの札は名前の頭 1 字。グループが 1 つも無い人は見出し「グループ」も出さない", async ({
  page,
}) => {
  await openScreen(page, "list", {
    ...BADGES,
    groups: [
      { id: SALES, name: "営業", ticket_prefix: null, writable: true, open_count: 0 },
      { id: DEV, name: "受託開発", ticket_prefix: "JD", writable: true, open_count: 5 },
    ],
  });
  await expect(groupRows(page)).toHaveCount(2);
  await expect(groupRows(page).locator(".k-group-mark")).toHaveText(["営", "JD"]);
  await expect(groupRows(page).nth(0).locator(".k-nav-count")).toHaveCount(0);
  await expect(groupRows(page).nth(1).locator(".k-nav-count")).toHaveText("5");
  await openScreen(page, "list", { ...BADGES, groups: [] });
  await expect(groupRows(page)).toHaveCount(0);
  await expect(leftNav(page).locator(".k-nav-sec")).toHaveCount(0);
});

test("K466-UI-006 ベルの数：未読 3 は「3」（読み上げ「お知らせ（3 件）」）・0 は数の字も件数の読み上げも無い・100 は「99+」（読み上げ「お知らせ（99 件以上）」）。この葉ではベルは押せない形のまま", async ({
  page,
}) => {
  for (const [unread, text, label] of [
    [3, "3", "お知らせ（3 件）"],
    [0, "", "お知らせ"],
    [99, "99", "お知らせ（99 件）"],
    [100, "99+", "お知らせ（99 件以上）"],
  ] as const) {
    await openScreen(page, "list", { ...BADGES, unread });
    await expect(bell(page)).toHaveCount(1);
    await expect(bell(page)).toHaveAttribute("aria-label", label);
    expect((await bell(page).innerText()).trim(), `未読 ${unread}`).toBe(text);
    if (unread > 0) {
      // 数の箱から字がはみ出さず、箱が帯の外に出ない（3 字の「99+」でも）
      const fit = await bell(page)
        .locator("b")
        .evaluate((b) => {
          const r = b.getBoundingClientRect();
          return { over: b.scrollWidth - b.clientWidth, left: r.left, right: r.right, vw: window.innerWidth };
        });
      expect(fit.over, `未読 ${unread}・字が箱からはみ出す`).toBeLessThanOrEqual(0);
      expect(fit.left, `未読 ${unread}`).toBeGreaterThanOrEqual(0);
      expect(fit.right, `未読 ${unread}`).toBeLessThanOrEqual(fit.vw);
    }
  }
});

test("K466-UI-007 役と名前と会社：role_id owner で R1 の左のメニュー・名前「高本」が自分のメニューに出る・会社名の頭文字と名前。名前が null なら名前を出さない・会社名が null なら頭文字も名前も出さない。知らない役は左のメニューに役の項目を出さず本文は出る", async ({
  page,
}) => {
  await openScreen(page, "list", { ...BADGES, roleId: "owner" });
  await expect(leftNav(page).getByRole("link", { name: /^チケット/ })).toBeVisible();
  await expect(leftNav(page).locator(".k-ws-name")).toContainText("ENGINE BASE");
  await expect(leftNav(page).locator(".k-ws-mark")).toHaveText("E");
  await bar(page).getByRole("button", { name: "自分のメニュー", exact: true }).click();
  await expect(page.locator(".k-menu-head")).toHaveText("高本");
  await page.keyboard.press("Escape");
  await openScreen(page, "list", { ...BADGES, name: null, company: null });
  await expect(leftNav(page).locator(".k-ws-mark")).toHaveText("");
  await bar(page).getByRole("button", { name: "自分のメニュー", exact: true }).click();
  await expect(page.locator(".k-menu-head")).toHaveText("");
  await page.keyboard.press("Escape");
  await openScreen(page, "list", { ...BADGES, roleId: "wizard" });
  await expect(leftNav(page).getByRole("link", { name: /^チケット/ })).toHaveCount(0);
  await expect(page.locator("#k-main h1").first()).toBeVisible();
});

test("K466-UI-008 PC の印：pc.connected true は「PC つながっている」・false は「PC をつないでいない」", async ({
  page,
}) => {
  await openScreen(page, "detail", { ...BADGES, pcConnected: true });
  await expect(leftNav(page).locator(".k-pc")).toHaveText("PC つながっている");
  await openScreen(page, "detail", { ...BADGES, pcConnected: false });
  await expect(leftNav(page).locator(".k-pc")).toHaveText("PC をつないでいない");
});

test("K466-UI-009 作るボタン：書けるグループが 1 つでもあれば左のメニューに「チケットを作る」が出て、1 つも無ければ出ない（writable は getShell の groups）。グループの口 /api/v1/scopes は呼ばない", async ({
  page,
}) => {
  const m = await openScreen(page, "list", { ...BADGES, groups: G3 });
  await expect(leftNav(page).getByRole("button", { name: "チケットを作る", exact: true })).toBeVisible();
  const none = await openScreen(page, "list", { ...BADGES, groups: G3.map((g) => ({ ...g, writable: false })) });
  await expect(leftNav(page).getByRole("button", { name: "チケットを作る", exact: true })).toHaveCount(0);
  expect(count(m, "/api/v1/scopes") + count(none, "/api/v1/scopes")).toBe(0);
});

test("K466-UI-010 グループの一覧（/tickets?scope=<id>）：見出しは getShell の groups の名前と番号の頭（営業（EG））。groups に無い id は「見つかりませんでした」。グループの口は呼ばない", async ({
  page,
}) => {
  await mockList(page, { list: () => ({ status: 200, body: { data: items(2), meta: { next_cursor: null } } }) });
  const m = await mockShell(page, BADGES);
  await open(page, `/tickets?scope=${SALES}`, 1440);
  await expect(page.locator("#tickets-title")).toHaveText("営業");
  await expect(page.locator(".k-list-head-row .k-list-dim")).toHaveText("（EG）");
  await open(page, "/tickets?scope=22222222-0000-4000-8000-0000000000ff", 1440);
  await expect(
    page
      .locator("#k-main")
      .getByText(/見つかりませんでした/)
      .first(),
  ).toBeVisible();
  expect(count(m, "/api/v1/scopes")).toBe(0);
});

test("K466-UI-011 障害の帯：getShell の banner に障害（title）と保守があっても、外枠は帯を出さず（F12 が描く）、タイトルの字は画面に出ない・横溢れ 0", async ({
  page,
}) => {
  await openScreen(page, "list", {
    ...BADGES,
    incidents: [{ state: "investigating", title: "分身の実行が遅れています", started_at: "2026-11-02T00:40:00Z" }],
    maintenance: { title: "11/10 2:00〜3:00 メンテナンス", from: "2026-11-09T17:00:00Z", to: "2026-11-09T18:00:00Z" },
  });
  await expect(page.getByText("分身の実行が遅れています")).toHaveCount(0);
  await expect(page.getByText("メンテナンス")).toHaveCount(0);
  expect(await overflowX(page)).toBe(0);
});

test("K466-UI-015 小さなお知らせの置き場：一覧・詳細・承認待ちの 3 画面で、置き場（section の aria-label が「お知らせ」で始まる）がちょうど 1 つ（0 個で緑にしない・ログインと安全の包みを外したことは K466-SL-003 が読む）", async ({
  page,
}) => {
  const toasters = (p: Page) => p.locator('section[aria-label^="お知らせ "]');
  for (const s of SCREENS) {
    await openScreen(page, s, BADGES);
    await expect(toasters(page), s).toHaveCount(1);
  }
});

test("K466-UI-016 getShell の答えの任意の鍵 saved_views：配列がある・配列でない・鍵が無い、のどれでも外枠の答え全体は「形が違う」にならず、左のメニューの項目・数・グループ・PC の印は同じに出る。口は 1 回・pageerror 0（読むのは K-479。この葉は通すだけ）", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const views = [{ id: "33333333-0000-4000-8000-000000000001", name: "今週の提案", scope_id: SALES }];
  for (const [label, o] of [
    ["配列", { savedViews: views }],
    ["配列でない", { savedViews: "壊れた答え" }],
    ["鍵が無い（8 鍵の答え）", {}],
  ] as const) {
    const m = await openScreen(page, "list", { ...BADGES, ...o });
    await expect(leftNav(page).getByRole("link", { name: /^チケット/ }), label).toBeVisible();
    await expect(groupRows(page), label).toHaveCount(3);
    await expect(groupRows(page).locator(".k-nav-count"), label).toHaveText(["18", "42", "9"]);
    await expect(leftNav(page).locator(".k-pc"), label).toHaveText("PC つながっている");
    expect(count(m, "/api/v1/shell"), label).toBe(1);
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

// ---- 失敗 ----

for (const [label, over] of [
  ["500", { status: 500 }],
  ["答えの形が違う（配列）", { raw: { data: [], meta: {} } }],
  ["鍵が欠けている（member が無い）", { raw: { data: { approvals_waiting: 3 }, meta: {} } }],
] as const) {
  test(`K466-UI-012 getShell が ${label}：左のメニューの項目も数もグループも PC の印も出さず（嘘の値を出さない）、本文は出る。口は 1 回だけ（自分で読み直さない）・pageerror 0`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const m = await openScreen(page, "list", BADGES, 1440, over);
    await expect(leftNav(page).getByRole("link", { name: /^チケット/ })).toHaveCount(0);
    await expect(leftNav(page).locator(".k-nav-badge")).toHaveCount(0);
    await expect(groupRows(page)).toHaveCount(0);
    await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ");
    expect(count(m, "/api/v1/shell")).toBe(1);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

// ---- 幅・見た目 ----

for (const w of [320, 375, 768, 1440] as const) {
  test(`K466-UI-013 幅 ${w}：ベルが 100 件（99+）・承認待ち 9・グループの件数 2 桁でも、全部の画面で横溢れ 0。帯と左のメニューの押せる物は 24px 以上`, async ({
    page,
  }) => {
    for (const s of SCREENS) {
      await openScreen(page, s, { ...BADGES, unread: 100 }, w);
      expect(await overflowX(page), `${s} 幅 ${w}`).toBe(0);
      const small = await bar(page)
        .locator("a, button")
        .evaluateAll(
          (els) =>
            els
              .filter((e) => (e as HTMLElement).offsetParent !== null)
              .map((e) => e.getBoundingClientRect())
              .filter((r) => r.width < 24 || r.height < 24).length,
        );
      expect(small, `${s} 幅 ${w}・帯の小さい物`).toBe(0);
    }
  });
}

const PAIRS: FidelityPair[] = [
  ["bell", "header.k-bar .k-bell", ["x", "y", "width", "height", "texts"]],
  ["bell-count", "header.k-bar .k-bell b", ["width", "height", "font-size", "texts"]],
  ["nav-badge", ".k-nav .k-nav-badge", ["width", "height", "font-size", "texts"]],
  ["tab-badge", ".k-tabs .k-nav-badge", ["width", "height", "texts"]],
  ["group-count", ".k-nav .k-nav-count", ["x", "width", "font-size", "texts"]],
  ["group-mark", ".k-nav .k-group-mark", ["width", "height", "texts"]],
].map(([role, sel, props]) => ({
  name: String(role),
  role: String(role),
  canvas: String(sel),
  app: String(sel),
  props: props as string[],
}));

for (const w of [375, 1440] as const) {
  test(`K466-UI-014 モック f7-shell-badges と本番の外枠（/tickets）の突き合わせ・幅 ${w}：ベル・承認待ちの数・グループの件数と札の大きさと字が同じ（同じ数 9・3・18／42／9 を答える）`, async ({
    browser,
  }) => {
    expect(MATCH_WIDTHS).toContain(w);
    const { bad } = await matchMock(
      browser,
      "f7-shell-badges",
      w,
      async (page) => {
        await mockList(page, { list: () => ({ status: 200, body: { data: items(3), meta: { next_cursor: null } } }) });
        await mockShell(page, BADGES);
        await open(page, "/tickets", w);
        await expect(page.locator("header.k-bar .k-bell")).toBeVisible();
        await expect(page.locator(".k-nav .k-nav-count").first()).toHaveText("18");
      },
      { pairs: PAIRS, base: "/dev/mock/f7" },
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });
}
