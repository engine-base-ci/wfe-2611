// K-480「概要：グループの状態の内訳・最近の更新・節目（0 件）・空の枠（残りの量・分類ごと）を口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f7 の f7-overview（本番と同じ部品 features/F7/overview・代表 OK 待ち）。
//   口：getScopeOverview（GET /api/v1/scopes/:id/overview・K-477）。答えは 4 つの鍵 { by_stage, milestones, recent, total }：
//     by_stage の 1 件は { stage: { id, key, name }, count }・recent の 1 件は { ticket: { id, number, title }, at, by: { id, display_name } | null, kind（post・change・system）, text, count }・
//     milestones はいつも空・404 は E-PAGE-001。一覧の口（listTickets）は概要では呼ばない。
//   外枠・一覧・口は前からの土台 list-mock.ts と K-478 の f7-list-mock.ts（mockMine）。固定の待ちは使わない。時計は page.clock で固定する。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import { countWrites, expectInert, overflowX, WIDTHS } from "./kit";
import { gate, idOf, open } from "./list-mock";
import { SALES, SUZUKI, mockMine, type Reply } from "./f7-list-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const NOW = "2026-11-02T10:00:00+09:00"; // 月曜
const PATH = `/tickets?view=overview&scope=${SALES}`;
const TEXT = {
  notFound: "見つかりませんでした。消されたか、見る権限が無いかもしれません",
  loadFailed: "読み込めませんでした。",
} as const;

const STAGES: [string, string, number][] = [
  ["未着手", "todo", 6],
  ["作業中", "doing", 7],
  ["確認中", "checking", 4],
  ["承認待ち", "awaiting_approval", 4],
  ["実行中", "running", 3],
  ["渡し中", "handing", 3],
  ["完了", "done", 45],
];
const stage = ([name, key, count]: [string, string, number], i: number) => ({
  stage: { id: idOf(700 + i), key, name },
  count,
});
const ev = (
  i: number,
  number: string,
  title: string,
  at: string,
  by: string | null,
  kind: "post" | "change" | "system",
  text: string,
  count = 1,
) => ({
  ticket: { id: idOf(i), number, title },
  at,
  by: by ? { id: SUZUKI, display_name: by } : null,
  kind,
  text,
  count,
});
const RECENT = [
  ev(
    128,
    "EG-128",
    "セイコー様へ 11月分の請求書を送る",
    "2026-11-01T21:00:00Z",
    null,
    "system",
    "成果物を作成 → 確認 ① 2 件確実",
  ),
  ev(
    119,
    "EG-119",
    "問い合わせ（山田様）に一次返信する",
    "2026-11-02T00:00:00Z",
    "佐藤",
    "change",
    "担当者：佐藤 → 高本",
  ),
  ev(
    124,
    "EG-124",
    "セイコー様 保守契約の更新",
    "2026-11-01T23:00:00Z",
    "鈴木",
    "post",
    "更新の条件、先方から月額据え置きで了承をもらいました",
    3,
  ),
  ev(
    204,
    "JD-204",
    "京蟻 追加開発の見積を出す",
    "2026-11-01T22:00:00Z",
    "高本",
    "post",
    "見積は 1,826,000 円で出すことにしました",
  ),
  ev(117, "EG-117", "新規 3 社にお礼のメール", "2026-11-01T03:00:00Z", "田中", "change", "完了の条件を満たした"),
  ev(110, "EG-110", "請求書の期限を直す", "2026-11-01T05:00:00Z", "高本", "change", "期限：10/31 → 11/01"),
];
// 6 件（11月2日 4 件・11月1日 2 件）。モックの見本の件数と同じにして突き合わせの「当たった数」（更新の 1 件・札・丸い印）をそろえる。同じチケットは 1 行なので 6 件とも別のチケット
const overview = (o: Record<string, unknown> = {}) => ({
  by_stage: STAGES.map(stage),
  milestones: [],
  recent: RECENT,
  total: 72,
  ...o,
});

interface Ov {
  reads: number;
  next: (n: number) => Reply | undefined | Promise<Reply | undefined>;
}
/** 概要の口の差し替え（mockMine の後。後から足した道すじが先に当たる） */
async function mockOverview(
  page: Page,
  data: unknown = overview(),
): Promise<{ ov: Ov; m: Awaited<ReturnType<typeof mockMine>> }> {
  const m = await mockMine(page);
  const ov: Ov = { reads: 0, next: () => undefined };
  await page.route(/\/api\/v1\/scopes\/[^/]+\/overview(\?|$)/, async (route: Route) => {
    ov.reads += 1;
    const own = await ov.next(ov.reads);
    const r: Reply = own ?? { status: 200, body: { data } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  await page.clock.setFixedTime(new Date(NOW));
  return { ov, m };
}
const fail = (status: number, code: string): Reply => ({ status, body: { error: "error", code } });
const openOverview = async (page: Page, width = 1440, path = PATH) => {
  await open(page, path, width);
  await expect(page.getByRole("region", { name: "最近の更新" }).or(page.getByRole("alert")).first()).toBeVisible();
};

const feed = (p: Page) => p.getByRole("region", { name: "最近の更新", exact: true });
const filter = (p: Page, name: string) =>
  p.getByRole("group", { name: "更新の種類", exact: true }).getByRole("button", { name, exact: true });
const side = (p: Page) => p.getByRole("complementary", { name: "概要の右の列", exact: true });
const events = (p: Page) => feed(p).getByRole("listitem");

test("K480-UI-001 開く：/tickets?view=overview&scope=営業 で、見え方のタブ「概要」が今いる（aria-current=page）・見出しは「営業」。概要の口は 1 回（/scopes/営業/overview）で、一覧の口（listTickets）は 0 回・書く口は 0 回", async ({
  page,
}) => {
  const { ov, m } = await mockOverview(page);
  const writes = countWrites(page);
  await openOverview(page);
  await expect(page.getByRole("link", { name: "概要", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "営業" })).toBeVisible();
  expect(ov.reads).toBe(1);
  expect(m.listCalls).toHaveLength(0);
  expect(writes.n).toBe(0);
});

test("K480-UI-002 状態の内訳：右の列の「状態」の箱に、棒（role=img「状態の内訳」）と状態ごとの件数（未着手 6・作業中 7・確認中 4・承認待ち 4・実行中 3・渡し中 3・完了 45）、見出しの横に「62% 完了（72 件中 45）」（完了の割合は切り捨て）", async ({
  page,
}) => {
  await mockOverview(page);
  await openOverview(page);
  const box = side(page).getByRole("region", { name: /^状態/ });
  await expect(box).toContainText("62% 完了（72 件中 45）");
  await expect(box.getByRole("img", { name: "状態の内訳", exact: true })).toBeVisible();
  const dl = box.locator("dl");
  for (const [name, , n] of STAGES)
    await expect(dl.locator("div", { has: page.getByText(name, { exact: true }) })).toContainText(String(n));
});

test("K480-UI-003 件数が 0 の状態も並び（0 と書く）、棒には幅が付かない。チケットが 1 件も無いグループ（total 0）は「チケットはまだありません」・最近の更新は「最近の更新はありません」", async ({
  page,
}) => {
  await mockOverview(page, overview({ by_stage: STAGES.map(([n, k]) => stage([n, k, 0], 0)), recent: [], total: 0 }));
  await openOverview(page);
  const box = side(page).getByRole("region", { name: /^状態/ });
  await expect(box).toContainText("チケットはまだありません");
  await expect(box.locator("dl div")).toHaveCount(STAGES.length);
  await expect(box.locator("dd", { hasText: /^0$/ })).toHaveCount(STAGES.length);
  await expect(feed(page)).toContainText("最近の更新はありません");
});

test("K480-UI-004 最近の更新：日ごとの見出し（11月2日（月）・11月1日（日））の下に 1 件 3 行（誰が・種類の札・いつ／番号の字のリンクと題名／変更の 1 行）。番号は /tickets/<id> へのリンク。同じチケットはまとめて 1 行で、2 件以上は「ほか N 件」が付く", async ({
  page,
}) => {
  await mockOverview(page);
  await openOverview(page);
  await expect(feed(page).getByRole("heading", { level: 3 })).toHaveText(["11月2日（月）", "11月1日（日）"]);
  await expect(events(page)).toHaveCount(6);
  const e124 = events(page).filter({ hasText: "EG-124" });
  await expect(e124).toContainText("鈴木");
  await expect(e124).toContainText("書き込み");
  await expect(e124).toContainText("更新の条件、先方から月額据え置きで了承をもらいました");
  await expect(e124).toContainText("ほか 2 件");
  await expect(e124.getByRole("link", { name: "EG-124", exact: true })).toHaveAttribute(
    "href",
    `/tickets/${idOf(124)}`,
  );
  const e119 = events(page).filter({ hasText: "EG-119" });
  await expect(e119).toContainText("変更");
  await expect(e119).toContainText("担当者：佐藤 → 高本");
  await expect(e119).not.toContainText("ほか");
});

test("K480-UI-005 時刻の出し方（日本時間・時計は 11/02 10:00 に固定）：1 時間前・2 時間前・4 時間前、前の日は「昨日」。仕組みの 1 行（書いた人が null）は「仕組み」の名前で出る", async ({
  page,
}) => {
  await mockOverview(page);
  await openOverview(page);
  await expect(events(page).filter({ hasText: "EG-119" })).toContainText("1時間前");
  await expect(events(page).filter({ hasText: "EG-124" })).toContainText("2時間前");
  const sys = events(page).filter({ hasText: "EG-128" });
  await expect(sys).toContainText("4時間前");
  await expect(sys).toContainText("仕組み");
  await expect(events(page).filter({ hasText: "EG-117" })).toContainText("昨日");
});

test("K480-UI-006 更新の種類の札：「人」は書いた人がいる行だけ・「AI の実行」は仕組みの行だけ・「すべて」で戻る（口は呼び直さない）。「決定」は口に種類が無いので押せない形（aria-disabled・薄さ 0.55・行は変わらない）", async ({
  page,
}) => {
  const { ov } = await mockOverview(page);
  const writes = countWrites(page);
  await openOverview(page);
  await expect(filter(page, "すべて")).toHaveAttribute("aria-pressed", "true");
  await filter(page, "人").click();
  await expect(events(page)).toHaveCount(5);
  await expect(events(page).filter({ hasText: "EG-128" })).toHaveCount(0);
  await filter(page, "AI の実行").click();
  await expect(events(page)).toHaveCount(1);
  await expect(events(page)).toContainText("EG-128");
  await expectInert(page, filter(page, "決定"), "決定", writes);
  await expect(events(page)).toHaveCount(1);
  await filter(page, "すべて").click();
  await expect(events(page)).toHaveCount(6);
  expect(ov.reads).toBe(1);
});

test("K480-UI-007 節目と空の枠：節目は 0 件なので「節目はまだありません」。「残りの量」「分類ごと」は空の枠のグレー（aria-disabled・title に準備中・押しても口を呼ばない）。メンバーの顔・メンバー数・AI の数は出さない（口に値が無い・D-144.3）", async ({
  page,
}) => {
  await mockOverview(page);
  const writes = countWrites(page);
  await openOverview(page);
  await expect(side(page).getByRole("region", { name: "節目", exact: true })).toContainText("節目はまだありません");
  for (const name of ["残りの量", "分類ごと"]) {
    const box = side(page).locator('section[aria-disabled="true"]', {
      has: page.getByRole("heading", { name, exact: true }),
    });
    await expectInert(page, box, name, writes);
    await expect(box).toHaveAttribute("title", `${name}（準備中）`);
  }
  await expect(page.locator(".k-f7-overview-faces")).toHaveCount(0);
});

test("K480-UI-008 グループを選んでいない概要（/tickets?view=overview）：口を呼ばず、「グループを選ぶと、概要が見られます」を出す。左のメニューのグループへ移れる", async ({
  page,
}) => {
  const { ov } = await mockOverview(page);
  await open(page, "/tickets?view=overview");
  await expect(page.getByText("グループを選ぶと、概要が見られます", { exact: true })).toBeVisible();
  expect(ov.reads).toBe(0);
  await expect(
    page.getByRole("navigation", { name: "メニュー", exact: true }).getByRole("link", { name: "営業" }).first(),
  ).toBeVisible();
});

test("K480-UI-016 左のメニューのグループの行：概要へのリンク（a・href は /tickets?view=overview&scope=営業の id・押せない印が無く title は名前だけ）。押すと概要が開き（URL に view=overview と scope）、概要の口は 1 回・一覧の口は 0 回", async ({
  page,
}) => {
  const { ov, m } = await mockOverview(page);
  await open(page, "/tickets?view=overview");
  const row = page.getByRole("navigation", { name: "メニュー", exact: true }).locator('a[data-group="営業"]');
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("href", `/tickets?view=overview&scope=${SALES}`);
  await expect(row).not.toHaveAttribute("aria-disabled", "true");
  await expect(row).toHaveAttribute("title", "営業");
  expect(ov.reads).toBe(0);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`view=overview.*scope=${SALES}`));
  await expect(feed(page)).toBeVisible();
  expect(ov.reads).toBe(1);
  expect(m.listCalls).toHaveLength(0);
});

test("K480-UI-009 概要の口が 404（見えない・無いグループ）：正本 E-PAGE-001 の文「見つかりませんでした。消されたか、見る権限が無いかもしれません」と番号 E-PAGE-001、一手「自分に関わるものへ戻る」（/tickets）。最近の更新・状態の箱は出ない", async ({
  page,
}) => {
  const { ov } = await mockOverview(page);
  ov.next = () => fail(404, "E-PAGE-001");
  await open(page, PATH);
  // 正本の文は見出しと本文の 2 つの要素に分かれて出るので、文は含むかで照らし、番号を data-code で確かめる（E-VWS-004 と取り違えない）
  await expect(page.getByText(TEXT.notFound)).toBeVisible();
  await expect(page.locator('[data-state="error"][data-code="E-PAGE-001"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "自分に関わるものへ戻る", exact: true })).toHaveAttribute(
    "href",
    "/tickets",
  );
  await expect(feed(page)).toHaveCount(0);
  await expect(side(page)).toHaveCount(0);
});

test("K480-UI-010 概要の口が 500：正本 E-PAGE-007 の文と「もう一度」。押すと同じ口を読み直し（計 2 回）、概要が出る", async ({
  page,
}) => {
  const { ov } = await mockOverview(page);
  ov.next = (n) => (n === 1 ? fail(500, "INTERNAL") : undefined);
  await open(page, PATH);
  await expect(page.getByText(TEXT.loadFailed)).toBeVisible();
  await page.getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(feed(page)).toBeVisible();
  expect(ov.reads).toBe(2);
});

test("K480-UI-011 読み込み中（答えを止めた間）：箱はまだ出ず、見出しとタブは出ている。答えが届くと概要が出る", async ({
  page,
}) => {
  const { ov } = await mockOverview(page);
  const hold = gate();
  ov.next = async (n) => {
    if (n === 1) await hold.wait;
    return undefined;
  };
  await open(page, PATH);
  await expect(page.getByRole("heading", { level: 1, name: "営業" })).toBeVisible();
  await expect(feed(page)).toHaveCount(0);
  hold.open();
  await expect(feed(page)).toBeVisible();
  await expect(events(page)).toHaveCount(6);
});

test("K480-UI-012 見え方のタブ：概要のタブは押せるリンク（/tickets?view=overview&scope=…）になり、自分に関わるものの画面から押すと概要に移る。カレンダー・ガントのタブはこの葉ではまだ押せない形のまま（K-481・K-482 が 1 つずつ押せるようにする）", async ({
  page,
}) => {
  await mockOverview(page);
  await open(page, `/tickets?view=all&scope=${SALES}`);
  const tab = page
    .getByRole("navigation", { name: "チケットの見え方" })
    .getByRole("link", { name: "概要", exact: true });
  await expect(tab).toHaveAttribute("href", new RegExp(`view=overview.*scope=${SALES}|scope=${SALES}.*view=overview`));
  await tab.click();
  await expect(feed(page)).toBeVisible();
  await expect(page).toHaveURL(/view=overview/);
});

test("K480-UI-013 幅 320・375・768・1024・1440：横溢れ 0。768 以下は 最近の更新の下に右の列（状態・残りの量・節目・分類ごと）が縦に並ぶ（列が 1 つ）。1440 は 2 列", async ({
  page,
}) => {
  await mockOverview(page);
  for (const w of WIDTHS) {
    await openOverview(page, w);
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    const f = (await feed(page).boundingBox())!;
    const s = (await side(page).boundingBox())!;
    if (w >= 1440) expect(s.x, `幅 ${w} は 2 列`).toBeGreaterThan(f.x + f.width - 1);
    else if (w <= 768) expect(s.y, `幅 ${w} は 1 列`).toBeGreaterThanOrEqual(f.y + f.height - 1);
  }
});

test("K480-UI-014 キーボード：更新の種類の札と番号のリンクに Tab で届き、札は Space・Enter で押せる。口は呼び直さない", async ({
  page,
}) => {
  const { ov } = await mockOverview(page);
  await openOverview(page);
  await filter(page, "人").focus();
  await page.keyboard.press("Space");
  await expect(filter(page, "人")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await expect(filter(page, "AI の実行")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(events(page)).toHaveCount(1);
  await events(page).first().getByRole("link", { name: "EG-128", exact: true }).focus();
  await expect(events(page).first().getByRole("link", { name: "EG-128", exact: true })).toBeFocused();
  expect(ov.reads).toBe(1);
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock・base は /dev/mock/f7）
const BOXP = ["width", "x", "background-color", "border-top-color", "border-top-left-radius"];
const TEXTP = ["font-size", "font-weight", "color", "line-height"];
const pair = (role: string, sel: string, props: string[]) => ({ name: role, role, canvas: sel, app: sel, props });
const OV_PAIRS = [
  pair("feed", ".k-list-main .k-f7-overview-box", BOXP),
  pair("event", ".k-f7-overview-event", ["x", "width"]),
  pair("event-tag", ".k-f7-overview-tag", [...TEXTP, "background-color"]),
  pair("avatar", ".k-f7-overview-avatar", ["width", "height", "background-color"]),
  pair("side", ".k-list-side", ["width"]),
  pair("status", '[aria-labelledby="k-f7-overview-status"]', BOXP),
  pair("bar", ".k-f7-overview-bar", ["width", "height", "border-top-left-radius"]),
  pair("empty-box", '.k-f7-overview-box[data-empty="true"]', [...BOXP, "opacity"]),
];

for (const w of MATCH_WIDTHS.filter((x) => x !== 768)) {
  test(`K480-UI-015 モック f7-overview 幅 ${w}：最近の更新の箱・1 件の位置・札・丸い印・右の列・状態の棒・空の枠の値（位置・大きさ・色・角丸。字と数は見本の値なので比べない）が本番と同じ。見出しの横のメンバーの顔は本番に出さないので比べない`, async ({
    browser,
  }) => {
    const r = await matchMock(
      browser,
      "f7-overview",
      w,
      async (p) => {
        await mockOverview(p);
        await openOverview(p, w);
        await expect(events(p)).toHaveCount(6);
      },
      { pairs: OV_PAIRS, base: "/dev/mock/f7", skip: ["feed:width", "event:width", "side:width"] },
    );
    expect(r.bad, r.bad.join("\n")).toEqual([]);
  });
}
