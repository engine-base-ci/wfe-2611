// K-574「やり取りの更新の行の文（段 5 の分）」の画面の試験（実 Chrome・実装より先に積む）。純粋な文の表は apps/web/test/k574-change-text.test.ts（K574-UN-001〜007）。
//   やり取りの画面は K-392 の道具 thread-mock.ts（mockThread・openThread・change・TAKA_W ほか）で開き、更新の行（kind change）の changes だけを差し替える。
//   正の絵：下絵 v2 /dev/mock/f4v2/f4v2-detail-thread の 4 つの更新の行（部品は下絵用の写し k-f4d-talk-line。本番は段 7 の部品 k-talk-line）。
//   文字は「空白を除いて」下絵と比べる（名前と「が」の間の空白の出し方は段 7 の部品が決める）。会社の項目の名前は詳細の答えの fields から引く。
//   固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import {
  SATO_W,
  TAKA_W,
  change,
  feed,
  mockThread,
  openThread,
  overflowX,
  panel,
  post,
  type TimelineItem,
} from "./thread-mock";

test.use({ timezoneId: "Asia/Tokyo" });

const FID = "6f000000-0000-4000-8000-000000000001";
const FIELDS = [
  {
    id: FID,
    name: "部署",
    field_type: "short_text",
    required: false,
    description: null,
    options: [],
    position: 1,
    value: null,
  },
];
const AI = (c: ReturnType<typeof change>): TimelineItem => ({ ...c, actor: null });
const lines = (page: Page) => panel(page).locator(".k-talk-line");
const norm = (s: string) => s.replace(/\s+/g, "");
const open = async (page: Page, items: TimelineItem[], w = 1440, fields: unknown[] = FIELDS) => {
  const t = await mockThread(page, { items, extra: { fields } });
  await openThread(page, w);
  return t;
};
const SAMPLE = (): TimelineItem[] => [
  post(TAKA_W, "2025-11-21 10:25", "先月と同じ書式でお願いします"),
  change(TAKA_W, "2025-11-21 10:30", [{ field: "assignee", from: "佐藤", to: "高本" }]),
  change(TAKA_W, "2025-11-21 10:36", [{ field: "test_spec", from: null, to: "承認する人が中身を見る" }]),
  AI(
    change(TAKA_W, "2025-11-21 10:41", [
      { field: "test_spec", from: "false", to: "true", note: "PDF の合計が請求額と合う" },
    ]),
  ),
  change(SATO_W, "2025-11-21 10:42", [
    { field: "test_spec", from: "false", to: "true", note: "承認する人が中身を見る" },
  ]),
];

test("K574-UI-001 確認項目の行：足した・チェックを付けた（人）・外した・文を直した・行を外した が、名前（呼ばれ方）・文・時刻つきで流れに並ぶ", async ({
  page,
}) => {
  await open(page, [
    change(TAKA_W, "2025-11-21 10:36", [{ field: "test_spec", from: null, to: "承認する人が中身を見る" }]),
    change(SATO_W, "2025-11-21 10:42", [
      { field: "test_spec", from: "false", to: "true", note: "承認する人が中身を見る" },
    ]),
    change(SATO_W, "2025-11-21 10:43", [
      { field: "test_spec", from: "true", to: "false", note: "承認する人が中身を見る" },
    ]),
    change(TAKA_W, "2025-11-21 10:50", [{ field: "test_spec", from: "宛名を確かめる", to: "請求書の宛名を確かめる" }]),
    change(TAKA_W, "2025-11-21 10:55", [{ field: "test_spec", from: "請求書の宛名を確かめる", to: null }]),
  ]);
  await expect(lines(page)).toHaveText([
    /^\s*高本\s?が確認項目を足しました：承認する人が中身を見る\s*10:36\s*$/,
    /^\s*佐藤\s?が確認項目『承認する人が中身を見る』にチェックを付けました\s*10:42\s*$/,
    /^\s*佐藤\s?が確認項目『承認する人が中身を見る』のチェックを外しました\s*10:43\s*$/,
    /^\s*高本\s?が確認項目『請求書の宛名を確かめる』を直しました\s*10:50\s*$/,
    /^\s*高本\s?が確認項目『請求書の宛名を確かめる』を外しました\s*10:55\s*$/,
  ]);
});

test("K574-UI-002 機械・AI が書いた行（author が空）：名前は「AI」・顔は「AI」の字。人の行の顔は呼ばれ方の 1 文字目", async ({
  page,
}) => {
  await open(page, [
    AI(
      change(TAKA_W, "2025-11-21 10:41", [
        { field: "test_spec", from: "false", to: "true", note: "PDF の合計が請求額と合う" },
      ]),
    ),
    change(TAKA_W, "2025-11-21 10:45", [{ field: "test_spec", from: null, to: "送り先を確かめる" }]),
  ]);
  const l = lines(page);
  await expect(l.nth(0)).toContainText(/AI\s?が確認項目『PDF の合計が請求額と合う』にチェックを付けました/);
  await expect(l.nth(0).locator(".k-talk-avatar").first()).toHaveText("AI");
  await expect(l.nth(1).locator(".k-talk-avatar").first()).toHaveText("高");
});

test("K574-UI-003 本文の行：直した・版 N に戻した（口の葉 K-432・K-433 が書く changes の形）", async ({ page }) => {
  await open(page, [
    change(TAKA_W, "2025-11-21 11:00", [{ field: "body", from: "1", to: "2" }]),
    change(SATO_W, "2025-11-21 11:05", [{ field: "body", from: "3", to: "4", note: "版 1 に戻した" }]),
  ]);
  await expect(lines(page)).toHaveText([
    /^\s*高本\s?が本文を直しました\s*11:00\s*$/,
    /^\s*佐藤\s?が本文を版 1 に戻しました\s*11:05\s*$/,
  ]);
});

test("K574-UI-004 会社の項目：「部署を 営業 → 開発 に変えました」・前が空は（空）・チェックの字はそのまま・40 字で切って「…」・名前が詳細に無い項目は「会社の項目」", async ({
  page,
}) => {
  const long = "い".repeat(60);
  await open(page, [
    change(TAKA_W, "2025-11-21 12:00", [{ field: `field:${FID}`, from: "営業", to: "開発" }]),
    change(TAKA_W, "2025-11-21 12:01", [{ field: `field:${FID}`, from: null, to: "営業" }]),
    change(TAKA_W, "2025-11-21 12:02", [{ field: `field:${FID}`, from: "チェックなし", to: "チェックあり" }]),
    change(TAKA_W, "2025-11-21 12:03", [{ field: `field:${FID}`, from: null, to: long }]),
    change(TAKA_W, "2025-11-21 12:04", [{ field: "field:6f000000-0000-4000-8000-0000000000ff", from: "a", to: "b" }]),
  ]);
  await expect(lines(page)).toHaveText([
    /部署を 営業 → 開発 に変えました/,
    /部署を （空） → 営業 に変えました/,
    /部署を チェックなし → チェックあり に変えました/,
    new RegExp(`部署を （空） → ${"い".repeat(40)}… に変えました`),
    /会社の項目を a → b に変えました/,
  ]);
});

test("K574-UI-005 固定の欄（担当者・期限・優先度）は書く側が書いた字のまま「〈欄〉を a → b に変えました」", async ({
  page,
}) => {
  await open(page, [
    change(TAKA_W, "2025-11-21 13:00", [{ field: "assignee", from: "佐藤", to: "高本" }]),
    change(TAKA_W, "2025-11-21 13:01", [{ field: "due_on", from: "11/27", to: "12/01" }]),
    change(TAKA_W, "2025-11-21 13:02", [{ field: "priority", from: "中", to: "高" }]),
  ]);
  await expect(lines(page)).toHaveText([
    /担当者を 佐藤 → 高本 に変えました/,
    /期限を 11\/27 → 12\/01 に変えました/,
    /優先度を 中 → 高 に変えました/,
  ]);
});

test("K574-UI-006 1 つの行に変更が 2 つ以上：名前は頭に 1 回・欄ごとの字を「・」でつなぐ（段 5 の欄どうしも・段 7 の欄とも）", async ({
  page,
}) => {
  await open(page, [
    change(TAKA_W, "2025-11-21 14:00", [
      { field: `field:${FID}`, from: "営業", to: "開発" },
      { field: "due_on", from: "11/27", to: "12/01" },
    ]),
    change(SATO_W, "2025-11-21 14:05", [
      { field: "test_spec", from: null, to: "送り先を確かめる" },
      { field: "actual_minutes", from: null, to: "1 時間" },
    ]),
  ]);
  await expect(lines(page)).toHaveText([
    /^\s*高本\s?が部署を 営業 → 開発 に変えました・期限を 11\/27 → 12\/01 に変えました\s*14:00\s*$/,
    /^\s*佐藤\s?が確認項目を足しました：送り先を確かめる・実績を 1 時間 に変えた\s*14:05\s*$/,
  ]);
});

test("K574-UI-007 段 7 の欄（実績・保留）は前のままの字・知らない欄は「項目を変更しました」（欄の鍵を出さない・answer=b810843ec17b）（段 5 の差し込みが段 7 の字を奪わない）", async ({
  page,
}) => {
  await open(page, [
    change(SATO_W, "2025-11-21 15:00", [{ field: "actual_minutes", from: null, to: "1 時間" }]),
    change(TAKA_W, "2025-11-21 15:05", [{ field: "zzz_new_field", from: "a", to: "b" }]),
  ]);
  await expect(lines(page)).toHaveText([
    /佐藤\s?が実績を 1 時間 に変えた/,
    /^\s*高本\s?が項目を変更しました\s*15:05\s*$/,
  ]);
  await expect(page.getByText("zzz_new_field")).toHaveCount(0);
});

test("K574-UI-008 口の数：更新の行の文を作るために口は増えない（やり取りを読む口 1 回・詳細 1 回・先読みの二重なし）。文は画面が changes と詳細の fields から作る", async ({
  page,
}) => {
  const seen: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (/\/api\/v1\//.test(u.pathname) && r.method() === "GET") seen.push(u.pathname);
  });
  const t = await open(page, SAMPLE());
  await expect(lines(page)).toHaveCount(4);
  expect(t.reads).toHaveLength(1);
  expect(seen.filter((p) => p.endsWith("/timeline"))).toHaveLength(1);
  expect(seen.filter((p) => /\/ticket-fields|\/versions|\/item-changes/.test(p))).toEqual([]);
});

test("K574-UI-009 幅 375・768・1440：長い値（40 字）の行・複数の変更の行でも横溢れ 0・文が折り返して画面の幅の中", async ({
  page,
}) => {
  const long = "う".repeat(60);
  for (const w of [375, 768, 1440]) {
    await open(
      page,
      [
        change(TAKA_W, "2025-11-21 16:00", [
          { field: `field:${FID}`, from: null, to: long },
          { field: "due_on", from: "11/27", to: "12/01" },
        ]),
        change(TAKA_W, "2025-11-21 16:05", [{ field: "test_spec", from: null, to: long }]),
      ],
      w,
    );
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    for (const i of [0, 1]) {
      const b = (await lines(page).nth(i).boundingBox())!;
      expect(b.x + b.width, `幅 ${w}・行 ${i}`).toBeLessThanOrEqual(w + 1);
    }
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("K574-UI-010 下絵との突き合わせ（f4v2-detail-thread × 幅 375・768・1440）：4 つの更新の行（担当者・確認項目を足した・AI がチェック・人がチェック）の文字と時刻が、空白を除いて下絵と同じ", async ({
  browser,
}) => {
  for (const w of [375, 768, 1440] as const) {
    const vp = { width: w, height: w === 375 ? 812 : 900 };
    const mock = await browser.newPage({ viewport: vp });
    await mock.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
    expect((await mock.goto("/dev/mock/f4v2/f4v2-detail-thread"))?.status()).toBe(200);
    await expect(mock.locator(".k-f4d-talk-line").first()).toBeVisible();
    const want = (await mock.locator(".k-f4d-talk-line").allTextContents()).map(norm);
    await mock.close();
    expect(want).toHaveLength(4);
    const app = await browser.newPage({ viewport: vp });
    await mockThread(app, { items: SAMPLE(), extra: { fields: FIELDS } });
    await openThread(app, w);
    await expect(feed(app).locator(".k-talk-line")).toHaveCount(4);
    const got = (await feed(app).locator(".k-talk-line").allTextContents()).map(norm);
    expect(got, `幅 ${w}`).toEqual(want);
    await app.close();
  }
});
