// K-694「管理 › 承認待ち（一覧・中身を見る・承認する・断る）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/kn-approvals（本番と同じ部品 features/F9/knowledge・K-671・代表 OK 2026-11-22）。モックとの比べ方は f9-match.ts の matchF9（見る役は状態ごとに絞る）。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。ナレッジの口は網の手前で差し替える（knowledge-mock.ts）。承認待ちの口は knowledge-approvals-mock.ts が足す。
//   答えの形は 07_functional/段10-F9/土台-knowledge.md の 3 章と K-688 の md。本人の Bridge（127.0.0.1:38617）は届かせない。
//   固定の待ちは使わない（口の数と答えを待つ・答えは hold() で止める）。テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { A1, A2, A3, mockApprovals, type AMock } from "./knowledge-approvals-mock";
import { F9_WIDTHS, matchF9 } from "./f9-match";
import { err, mockKnowledge, msg, pageInvoice, type KMock } from "./knowledge-mock";

const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const ADMIN = "/knowledge?view=admin&list=approvals";
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const first = (s: string) => s.split("。")[0]!;
const card = (p: Page, title: string) => p.locator("li.k-f9-ap", { hasText: title });
const T1 = "値引きを頼まれたときの返し方";
const T2 = "納品の前の確かめ";
const T3 = "見積もりの出し方（自分のやり方）";
const adminTab = (p: Page) => p.getByRole("tab", { name: /^管理/ });
const pageTab = (p: Page) => p.getByRole("tab", { name: "ページ", exact: true });
const navItem = (p: Page, label: string) => p.locator(".k-f9-adminnav-i", { hasText: label });
// 理由の欄の見出しは「断る理由*」（必須の印 * は読み上げない）。getByLabel の exact は印を含む字で比べて当たらないので、読み上げの名前で探す（K-442 と同じ）
const reason = (c: Locator) => c.getByRole("textbox", { name: "断る理由", exact: true });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

interface Setup {
  mk: KMock;
  ap: AMock;
}
async function setup(page: Page): Promise<Setup> {
  const mk = await mockKnowledge(page, { pages: [pageInvoice()] });
  const ap = await mockApprovals(page, mk);
  return { mk, ap };
}
async function openAdmin(page: Page, width = 1440, url = ADMIN): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "承認待ち", exact: true })).toBeVisible();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const prop = (role: string, sel: string, props: string[]) => ({ name: role, role, canvas: sel, app: sel, props });
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const PAIRS = [
  prop("ap", ".k-f9-ap", [...BOX, "texts"]),
  prop("ap-title", ".k-f9-ap-title", ["x", "y", ...TEXT]),
  prop("ap-btn", ".k-f9-ap button", CTRL),
  prop("ap-field", ".k-f9-ap-decline .k-input", ["width", "height", "x", "font-size", "border-top-color"]),
  prop("nav", ".k-f9-adminnav-i", ["x", "height", "texts"]),
];
for (const w of F9_WIDTHS) {
  test(`K694-UI-001 kn-approvals 幅 ${w}：承認待ちの一覧（3 件・3 件目は断る理由を書いている形）の位置と大きさと字がモックと同じ（matchF9 の bad が 0）`, async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const { bad, rows } = await matchF9(
      browser,
      "kn-approvals",
      w,
      async (page) => {
        await setup(page);
        await openAdmin(page, w);
        const c = card(page, T3);
        await c.getByRole("button", { name: "断る…", exact: true }).click();
        await reason(c).fill(
          "営業 › 見積もり に「見積書の出し方」があります。足りない所は、そのページに足してください。",
        );
      },
      { pairs: PAIRS },
    );
    expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

// ---------------------------------------------------------------- 入口
test("K694-UI-002 管理者・マネージャーの木の上に「ページ｜管理」（管理に数）が出る：「管理」を押すと /knowledge?view=admin&list=approvals に移り、承認待ちの口 1 回・見出し「承認待ち」・左は管理の入口（承認待ち 3・見直すページ 3）。「ページ」を押すと /knowledge に戻り、口は増えない", async ({
  page,
}) => {
  const { mk, ap } = await setup(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto("/knowledge");
  await expect(pageTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(adminTab(page)).toContainText("6");
  expect(ap.count("list")).toBe(0);
  await adminTab(page).click();
  await expect(page).toHaveURL(/\/knowledge\?view=admin&list=approvals$/);
  await expect(page.getByRole("heading", { level: 1, name: "承認待ち", exact: true })).toBeVisible();
  await expect(adminTab(page)).toHaveAttribute("aria-selected", "true");
  await expect(navItem(page, "承認待ち")).toHaveAttribute("aria-current", "page");
  await expect(navItem(page, "承認待ち")).toContainText("3");
  await expect(navItem(page, "見直すページ")).toContainText("3");
  expect(ap.count("list")).toBe(1);
  await pageTab(page).click();
  await expect(page).toHaveURL(/\/knowledge$/);
  await expect(pageTab(page)).toHaveAttribute("aria-selected", "true");
  expect(ap.count("list")).toBe(1);
  expect(mk.count("tree")).toBe(1);
});

test("K694-UI-003 直に開く（お知らせから来た人）：/knowledge?view=admin&list=approvals は木の口 1 回・承認待ちの口 1 回で管理が開き、再読み込みでも同じ。知らない view は木の面・知らない list は承認待ちになる", async ({
  page,
}) => {
  const { mk, ap } = await setup(page);
  await openAdmin(page);
  expect(mk.count("tree")).toBe(1);
  expect(ap.count("list")).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "承認待ち", exact: true })).toBeVisible();
  expect(ap.count("list")).toBe(2);
  await page.goto("/knowledge?view=zzz");
  await expect(pageTab(page)).toHaveAttribute("aria-selected", "true");
  await page.goto("/knowledge?view=admin&list=zzz");
  await expect(page.getByRole("heading", { level: 1, name: "承認待ち", exact: true })).toBeVisible();
  await expect(navItem(page, "承認待ち")).toHaveAttribute("aria-current", "page");
});

test("K694-UI-004 承認できない人（木の答えの admin_counts が無い）：「ページ｜管理」は出ない・直に管理の道を開くと「見られない」（E-PAGE-002）で承認待ちの口は 0 回・「戻る」で /knowledge に移る", async ({
  page,
}) => {
  const { mk, ap } = await setup(page);
  mk.tree.admin_counts = null;
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto("/knowledge");
  await expect(page.getByRole("navigation", { name: "棚とページ" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "ナレッジの面" })).toHaveCount(0);
  await page.goto(ADMIN);
  await expect(page.getByText(first(msg("E-PAGE-002")), { exact: false })).toBeVisible();
  expect(ap.count("list")).toBe(0);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/knowledge$/);
});

// ---------------------------------------------------------------- 一覧
test("K694-UI-005 一覧：頼みが新しい順に 3 件・種類の札（上の棚に上げる／共有）・「鈴木さんの「自分」 → 営業」・「鈴木 一郎 ・ 11/21 16:20」（日本時間）・ひとこと・似たページの注意「営業 › 見積もり の「値引きの決まり」と似ています。先に並べて確かめてください。」・ひとこと無しの頼みにはひとこと欄が無い", async ({
  page,
}) => {
  await setup(page);
  await openAdmin(page);
  await expect(page.locator("li.k-f9-ap")).toHaveCount(3);
  const c1 = card(page, T1);
  await expect(c1).toContainText("上の棚に上げる");
  await expect(c1).toContainText("鈴木さんの「自分」");
  await expect(c1).toContainText("鈴木 一郎 ・ 11/21 16:20");
  await expect(c1).toContainText("ひとこと：新しく入った人にも同じ返し方をしてほしいので、営業の棚に上げたいです");
  await expect(c1).toContainText("営業 › 見積もり の「値引きの決まり」と似ています。先に並べて確かめてください。");
  await expect(card(page, T2)).toContainText("共有");
  await expect(card(page, T2)).toContainText("営業にも見せる");
  await expect(card(page, T3)).not.toContainText("ひとこと：");
  await expect(card(page, T3)).not.toContainText("似ています");
});

test("K694-UI-006 「中身を見る」：押すとその場で本文が開き（口は呼ばない）ボタンが「中身を閉じる」になる（aria-expanded）・もう一度で閉じる。フォルダの共有（本文が無い頼み）には「中身を見る」が無い", async ({
  page,
}) => {
  const { ap } = await setup(page);
  ap.rows = ap.rows.map((r) => (r.id === A2 ? { ...r, title: "経理のフォルダ", body: null } : r));
  await openAdmin(page);
  const c = card(page, T1);
  const before = ap.calls.length;
  const open = c.getByRole("button", { name: "中身を見る", exact: true });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await open.click();
  const region = c.getByRole("region", { name: "中身", exact: true });
  await expect(region.getByText("5% までは、その場で「できます」と返してよい。", { exact: true })).toBeVisible();
  await expect(c.getByRole("button", { name: "中身を閉じる", exact: true })).toHaveAttribute("aria-expanded", "true");
  expect(ap.calls.length).toBe(before);
  await c.getByRole("button", { name: "中身を閉じる", exact: true }).click();
  await expect(region).toHaveCount(0);
  await expect(card(page, "経理のフォルダ").getByRole("button", { name: "中身を見る", exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- 承認する
test("K694-UI-007 承認する：「承認する」で口 1 回（POST /knowledge/requests/<id>/approve・体は空・冪等の鍵あり）→ 一覧から消え（読み直さない）・木を読み直して数が 3 → 2（木の上の「管理」と左の「承認待ち」）・お知らせ「「値引きを頼まれたときの返し方」を承認しました。」", async ({
  page,
}) => {
  const { mk, ap } = await setup(page);
  await openAdmin(page);
  await card(page, T1).getByRole("button", { name: "承認する", exact: true }).click();
  await expect(card(page, T1)).toHaveCount(0);
  await expect(page.locator(".k-toast")).toContainText(`「${T1}」を承認しました。`);
  expect(ap.count("approve")).toBe(1);
  expect(ap.calls.find((c) => c.op === "approve")).toMatchObject({ id: A1, body: {} });
  expect(ap.calls.find((c) => c.op === "approve")!.key).toBeTruthy();
  expect(ap.count("list")).toBe(1);
  expect(mk.count("tree")).toBe(2);
  await expect(navItem(page, "承認待ち")).toContainText("2");
  await expect(page.locator("li.k-f9-ap")).toHaveCount(2);
});

for (const [name, reply, code, reread] of [
  ["409 もう決まっている", err(409, "E-KNW-110"), "E-KNW-110", true],
  ["409 頼んだ人がもういない", err(409, "E-KNW-111"), "E-KNW-111", false],
  ["409 フォルダが別の棚になった", err(409, "E-KNW-103"), "E-KNW-103", true],
  ["404 もう無い頼み", err(404, "E-PAGE-001"), "E-PAGE-001", true],
  ["403 権限が外れた", err(403, "FORBIDDEN"), "E-PAGE-002", false],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003", false],
  ["網の切れ", "network", "E-PAGE-008", false],
] as const)
  test(`K694-UI-008 承認する口が失敗（${name}）：お知らせ（失敗）に ${code} の文・${reread ? "一覧を読み直す（口 2 回・決まった頼みは消える）" : "一覧は読み直さず頼みは残る"}`, async ({
    page,
  }) => {
    const { ap } = await setup(page);
    await openAdmin(page);
    ap.script("approve", reply);
    if (reread) ap.rows = ap.rows.filter((r) => r.id !== A1);
    await card(page, T1).getByRole("button", { name: "承認する", exact: true }).click();
    await expect(page.locator(".k-toast-error")).toContainText(first(msg(code)));
    expect(ap.count("list")).toBe(reread ? 2 : 1);
    if (reread) {
      await expect(card(page, T1)).toHaveCount(0);
      return;
    }
    await expect(card(page, T1)).toHaveCount(1);
    await card(page, T1).getByRole("button", { name: "承認する", exact: true }).click();
    await expect(card(page, T1)).toHaveCount(0);
    expect(ap.count("approve")).toBe(2);
  });

// ---------------------------------------------------------------- 断る
test("K694-UI-009 断る：「断る…」で理由の欄（「頼んだ人のページに、この理由が出ます。」）・空白だけは「理由を入れてください」で口 0 回・1,001 字は「理由は 1,000 字までです」・書いて「断る」で口 1 回（体は reason を打ったとおり）→ 一覧から消え・木を読み直す・お知らせ「断りました。理由は頼んだ人のページに出ます。」", async ({
  page,
}) => {
  const { mk, ap } = await setup(page);
  await openAdmin(page);
  const c = card(page, T3);
  await c.getByRole("button", { name: "断る…", exact: true }).click();
  await expect(reason(c)).toBeFocused();
  await expect(c.getByText("頼んだ人のページに、この理由が出ます。", { exact: true })).toBeVisible();
  await reason(c).fill("   ");
  await c.getByRole("button", { name: "断る", exact: true }).click();
  await expect(c.getByText("理由を入れてください", { exact: true })).toBeVisible();
  await reason(c).fill("あ".repeat(1001));
  await c.getByRole("button", { name: "断る", exact: true }).click();
  await expect(c.getByText("理由は 1,000 字までです", { exact: true })).toBeVisible();
  expect(ap.count("decline")).toBe(0);
  await reason(c).fill(" 営業 › 見積もり に「見積書の出し方」があります。 ");
  await c.getByRole("button", { name: "断る", exact: true }).click();
  await expect(card(page, T3)).toHaveCount(0);
  expect(ap.count("decline")).toBe(1);
  expect(ap.calls.find((x) => x.op === "decline")).toMatchObject({
    id: A3,
    body: { reason: " 営業 › 見積もり に「見積書の出し方」があります。 " },
  });
  expect(ap.calls.find((x) => x.op === "decline")!.key).toBeTruthy();
  await expect(page.locator(".k-toast")).toContainText("断りました。理由は頼んだ人のページに出ます。");
  expect(mk.count("tree")).toBe(2);
  expect(ap.count("list")).toBe(1);
});

test("K694-UI-010 断るのをやめる：「やめる」で理由の欄が閉じ（口 0 回）焦点は「断る…」に戻り、開き直すと欄は空", async ({
  page,
}) => {
  const { ap } = await setup(page);
  await openAdmin(page);
  const c = card(page, T1);
  await c.getByRole("button", { name: "断る…", exact: true }).click();
  await reason(c).fill("途中でやめる");
  await c.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(reason(c)).toHaveCount(0);
  await expect(c.getByRole("button", { name: "断る…", exact: true })).toBeFocused();
  await c.getByRole("button", { name: "断る…", exact: true }).click();
  await expect(reason(c)).toHaveValue("");
  expect(ap.count("decline")).toBe(0);
});

for (const [name, reply, code, kind] of [
  ["409 もう決まっている", err(409, "E-KNW-110"), "E-KNW-110", "reread"],
  ["422 理由の形", err(422, "VALIDATION_ERROR", { details: [{ field: "reason" }] }), "", "field"],
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002", "keep"],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003", "keep"],
  ["網の切れ", "network", "E-PAGE-008", "keep"],
] as const)
  test(`K694-UI-011 断る口が失敗（${name}）：${kind === "reread" ? "お知らせ（失敗）・一覧を読み直して頼みは消え欄も閉じる" : kind === "field" ? "欄の下に「理由を入れてください」・欄は閉じず理由は残る" : "お知らせ（失敗）・欄は閉じず理由は残り押し直せる"}`, async ({
    page,
  }) => {
    const { ap } = await setup(page);
    await openAdmin(page);
    ap.script("decline", reply);
    if (kind === "reread") ap.rows = ap.rows.filter((r) => r.id !== A1);
    const c = card(page, T1);
    await c.getByRole("button", { name: "断る…", exact: true }).click();
    await reason(c).fill("似たページがあります");
    await c.getByRole("button", { name: "断る", exact: true }).click();
    if (kind === "reread") {
      await expect(page.locator(".k-toast-error")).toContainText(first(msg(code)));
      await expect(card(page, T1)).toHaveCount(0);
      expect(ap.count("list")).toBe(2);
      return;
    }
    if (kind === "field") await expect(c.getByText("理由を入れてください", { exact: true })).toBeVisible();
    else await expect(page.locator(".k-toast-error")).toContainText(first(msg(code)));
    await expect(reason(c)).toHaveValue("似たページがあります");
    expect(ap.count("list")).toBe(1);
    await c.getByRole("button", { name: "断る", exact: true }).click();
    await expect(card(page, T1)).toHaveCount(0);
    expect(ap.count("decline")).toBe(2);
  });

test("K694-UI-012 二度押し：承認する・断るの答えを止めた間に 2 回押しても口は 1 回・その頼みのボタンは押せず、ほかの頼みのボタンは押せる", async ({
  page,
}) => {
  const { ap } = await setup(page);
  await openAdmin(page);
  const c = card(page, T1);
  const release = ap.hold("approve");
  const approve = c.getByRole("button", { name: "承認する", exact: true });
  await approve.click();
  await expect(approve).toBeDisabled();
  await approve.click({ force: true }).catch(() => undefined);
  await expect(card(page, T2).getByRole("button", { name: "承認する", exact: true })).toBeEnabled();
  expect(ap.count("approve")).toBe(1);
  release();
  await expect(card(page, T1)).toHaveCount(0);
  const c3 = card(page, T3);
  await c3.getByRole("button", { name: "断る…", exact: true }).click();
  await reason(c3).fill("理由");
  const release2 = ap.hold("decline");
  await c3.getByRole("button", { name: "断る", exact: true }).click();
  await expect(c3.getByRole("button", { name: "断る", exact: true })).toBeDisabled();
  await c3
    .getByRole("button", { name: "断る", exact: true })
    .click({ force: true })
    .catch(() => undefined);
  expect(ap.count("decline")).toBe(1);
  release2();
  await expect(card(page, T3)).toHaveCount(0);
  expect(ap.count("approve") + ap.count("decline")).toBe(2);
});

// ---------------------------------------------------------------- 読めない・空・見直す
for (const [name, reply, code, retry] of [
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003", true],
  ["網の切れ", "network", "E-PAGE-007", true],
  ["403 権限が外れた", err(403, "FORBIDDEN"), "E-PAGE-002", false],
] as const)
  test(`K694-UI-013 承認待ちの口が失敗（${name}）：本文の場所に ${code} の文${retry ? "と「もう一度読む」・押すと読み直して一覧が出る（口 2 回）" : "（見られない）・口は 1 回だけ"}・木はそのまま`, async ({
    page,
  }) => {
    const { ap } = await setup(page);
    ap.script("list", reply);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, owner.token);
    await page.goto(ADMIN);
    await expect(page.getByText(first(msg(code)), { exact: false })).toBeVisible();
    await expect(navItem(page, "承認待ち")).toBeVisible();
    if (!retry) return void expect(ap.count("list")).toBe(1);
    await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
    await expect(page.locator("li.k-f9-ap")).toHaveCount(3);
    expect(ap.count("list")).toBe(2);
  });

test("K694-UI-014 承認待ちが 0 件：「承認待ちはありません」が出る。最後の 1 件を承認して 0 件になったときも同じ", async ({
  page,
}) => {
  const { ap } = await setup(page);
  ap.rows = ap.rows.slice(0, 1);
  await openAdmin(page);
  await expect(page.locator("li.k-f9-ap")).toHaveCount(1);
  await card(page, T1).getByRole("button", { name: "承認する", exact: true }).click();
  await expect(page.getByText("承認待ちはありません", { exact: true })).toBeVisible();
  await expect(page.locator("li.k-f9-ap")).toHaveCount(0);
});

test("K694-UI-015 「見直すページ」の入口は登録の有無に依らず数 3 を出し続け、承認待ちの口は 1 回のまま増えない（押せるか・移るかは見ない。押せて移ることは K696-UI-002 が見る）", async ({
  page,
}) => {
  const { ap } = await setup(page);
  await openAdmin(page);
  await expect(navItem(page, "見直すページ")).toContainText("3");
  expect(ap.count("list")).toBe(1);
});

// ---------------------------------------------------------------- 守り・幅・キーボード
test("K694-UI-016 頼んだ人・題名・説明・ひとこと・似たページ・本文・理由に HTML が入っていても、一覧に文字として出て動かない（img も作られない）・送る理由は打ったとおりの字", async ({
  page,
}) => {
  const evil = '<img src=x onerror="window.__x=1">';
  const { ap } = await setup(page);
  ap.rows = ap.rows.map((r) =>
    r.id === A1
      ? {
          ...r,
          from_name: evil,
          from_shelf_name: evil,
          title: evil,
          desc: evil,
          message: evil,
          similar: { page_id: r.similar!.page_id, title: evil, place: evil },
          body: {
            doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: evil }] }] },
            text: evil,
          },
        }
      : r,
  );
  await openAdmin(page);
  const c = card(page, evil);
  await expect(c).toContainText(`${evil} ・`);
  await expect(c).toContainText(`ひとこと：${evil}`);
  await c.getByRole("button", { name: "中身を見る", exact: true }).click();
  await expect(c.getByRole("region", { name: "中身", exact: true })).toContainText(evil);
  await c.getByRole("button", { name: "断る…", exact: true }).click();
  await reason(c).fill("<u>理由</u>");
  await c.getByRole("button", { name: "断る", exact: true }).click();
  await expect(page.locator("li.k-f9-ap")).toHaveCount(2);
  expect(ap.calls.find((x) => x.op === "decline")!.body["reason"]).toBe("<u>理由</u>");
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator("li.k-f9-ap img").count()).toBe(0);
});

for (const w of WIDTHS) {
  test(`K694-UI-017 幅 ${w}：長い名前・長い題名・ひとことの頼みと、断る理由を開いた形でも横のはみ出し 0（数値）${w <= 1023 ? "・木の引き出しから「承認待ち」を選ぶと引き出しが閉じる" : ""}`, async ({
    page,
  }) => {
    const long = "とても長い名前の人".repeat(5);
    const { ap } = await setup(page);
    ap.rows = ap.rows.map((r) =>
      r.id === A1
        ? { ...r, from_name: long, title: long, desc: long.repeat(3), message: long.repeat(4), from_shelf_name: long }
        : r,
    );
    await openAdmin(page, w);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    const c = card(page, long).first();
    await c.getByRole("button", { name: "断る…", exact: true }).click();
    await reason(c).fill("理由が長い".repeat(40));
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    if (w <= 1023) {
      await page.getByRole("button", { name: "木を開く", exact: true }).click();
      await expect(page.locator(".k-f9-scrim")).toBeVisible();
      await navItem(page, "承認待ち").click();
      await expect(page.locator(".k-f9-scrim")).toHaveCount(0);
    }
  });
}

test("K694-UI-018 キーボードだけ：「管理」に焦点して Enter で管理が開く・「中身を見る」を Enter で開閉（aria-expanded）・「断る…」を Enter で理由の欄に焦点が移り、「やめる」で焦点が戻る・「承認する」を Enter で承認できる", async ({
  page,
}) => {
  const { ap } = await setup(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto("/knowledge");
  await adminTab(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "承認待ち", exact: true })).toBeVisible();
  const c = card(page, T1);
  const view = c.getByRole("button", { name: "中身を見る", exact: true });
  await view.focus();
  await page.keyboard.press("Enter");
  await expect(c.getByRole("button", { name: "中身を閉じる", exact: true })).toHaveAttribute("aria-expanded", "true");
  const decline = c.getByRole("button", { name: "断る…", exact: true });
  await decline.focus();
  await page.keyboard.press("Enter");
  await expect(reason(c)).toBeFocused();
  await c.getByRole("button", { name: "やめる", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(decline).toBeFocused();
  await c.getByRole("button", { name: "承認する", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(card(page, T1)).toHaveCount(0);
  expect(ap.count("approve")).toBe(1);
});
