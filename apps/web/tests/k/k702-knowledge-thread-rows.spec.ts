// K-702「やり取りの『このチケットで守る物』『AI が開いたページ』『守れていなかった決まり』の行」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/tk-guard・tk-opened（本番と同じ部品 features/F9/knowledge/ticket-views.tsx・代表 OK 2026-11-22）。字・並びは下絵が正。
//   やり取りの画面は段 7 の道具 thread-mock.ts（mockThread・openThread・change・TAKA_W ほか）で開き、行（kind change・author なし）の changes だけを差し替える。
//   行の形の正は口の葉 K-698（knowledge_open）・K-699（guard_list）・K-700（knowledge_breach）の md。changes の追加の鍵（must・opened・page_id）は口が中身を見ずに返す（K-383）。
//   固定の待ちは使わない。name は exact。純粋な形は apps/web/test/k702-ticket-rows-shape.test.ts（K702-UN-001〜006）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { matchF9 } from "./f9-match";
import {
  TAKA_W,
  change,
  feed,
  mockThread,
  openThread,
  overflowX,
  panel,
  post,
  system,
  type TimelineItem,
} from "./thread-mock";

test.use({ timezoneId: "Asia/Tokyo" });

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const uid = (n: number): string => `0193c5a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const P_INV = uid(0xa001);
const P_MAIL = uid(0xa003);
const P_OUT = uid(0xa004);
const P_SEIKO = uid(0xb001);
const P_PRICE = uid(0xb002);
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const MATCH_WIDTHS = [375, 768, 1440] as const;

interface Ref {
  id: string;
  title: string;
  place: string;
}
const MUST: Ref[] = [
  { id: P_INV, title: "請求書の送り方", place: "会社 › 経理" },
  { id: P_MAIL, title: "メールの書き方", place: "会社" },
  { id: P_OUT, title: "外に出す前の確かめ", place: "会社" },
];
const OPENED: Ref[] = [
  { id: P_SEIKO, title: "セイコー商事との決めごと", place: "グループ：営業" },
  { id: P_PRICE, title: "単価の表", place: "会社 › 経理" },
];
/** 口が書く AI の行（author なし・K-697 の knowledge_ticket_line）。追加の鍵を持てるよう型を緩める */
const kc = (at: string, c: Record<string, unknown>): TimelineItem =>
  ({ ...change(TAKA_W, at, []), actor: null, changes: [c] }) as TimelineItem;
const guard = (at: string, must: unknown = MUST, opened: unknown = OPENED): TimelineItem =>
  kc(at, {
    field: "guard_list",
    from: null,
    to: String(Array.isArray(must) ? must.length : 0),
    note: null,
    must,
    opened,
  });
const opened = (at: string, id: unknown, title: unknown, place: unknown): TimelineItem =>
  kc(at, { field: "knowledge_open", from: null, to: title, note: place, page_id: id });
const breach = (at: string, kind: string, title: string, note: string | null, id: unknown = P_MAIL): TimelineItem =>
  kc(at, { field: "knowledge_breach", from: kind, to: title, note, page_id: id });
const task = (at: string): TimelineItem => system(TAKA_W, at, "高本 がAI に任せた");

const lines = (page: Page) => panel(page).locator(".k-talk-line");
const guardBox = (page: Page) => panel(page).locator(".k-f9-guard");
const norm = (s: string) => s.replace(/\s+/g, "");
const open = async (page: Page, items: TimelineItem[], w = 1440) => {
  const t = await mockThread(page, { items });
  await openThread(page, w);
  return t;
};
const SAMPLE_GUARD = (): TimelineItem[] => [task("2025-11-21 09:00"), guard("2025-11-21 09:00")];
const SAMPLE_OPENED = (): TimelineItem[] => [
  task("2025-11-21 09:00"),
  guard("2025-11-21 09:00"),
  opened("2025-11-21 09:01", P_SEIKO, "セイコー商事との決めごと", "グループ：営業"),
  opened("2025-11-21 09:02", P_PRICE, "単価の表", "会社 › 経理"),
  breach("2025-11-21 09:12", "ai_self_reported", "メールの書き方", "件名に【請求書】が無い"),
];

// ---------------------------------------------------------------- 守る物の一覧

test("K702-UI-001 いちばん新しい行が「守る物」のとき、AI の書き込みとして広げて出る：名前「AI」・時刻・「始める前に、このチケットで守る物を並べました。」・「必ず守る（3）」（「確認項目に入れました」）の 3 ページ・「このチケットのために開いたページ（2）」の 2 ページ。題名の横に場所が出る", async ({
  page,
}) => {
  await open(page, SAMPLE_GUARD());
  const post_ = panel(page).getByRole("article", { name: "AI 09:00", exact: true });
  await expect(post_).toBeVisible();
  const g = guardBox(page);
  await expect(g.getByText("始める前に、このチケットで守る物を並べました。", { exact: true })).toBeVisible();
  const must = g.getByRole("region", { name: "必ず守る", exact: true });
  await expect(must.locator("h4")).toHaveText(/必ず守る（3）\s*確認項目に入れました/);
  await expect(must.locator("li")).toHaveText([
    /請求書の送り方\s*会社 › 経理/,
    /メールの書き方\s*会社/,
    /外に出す前の確かめ\s*会社/,
  ]);
  const op = g.getByRole("region", { name: "このチケットのために開いたページ", exact: true });
  await expect(op.locator("h4")).toHaveText("このチケットのために開いたページ（2）");
  await expect(op.locator("li")).toHaveText([/セイコー商事との決めごと\s*グループ：営業/, /単価の表\s*会社 › 経理/]);
  await expect(lines(page).filter({ hasText: "守る物を並べた" })).toHaveCount(0);
});

test("K702-UI-002 後ろに行が 1 つでもあると 1 行に畳む：「AI が、このチケットで守る物を並べた（必ず守る 3・開いたページ 2）」と時刻。一覧の箱は出ない（下絵 tk-opened）", async ({
  page,
}) => {
  await open(page, SAMPLE_OPENED());
  await expect(guardBox(page)).toHaveCount(0);
  const row = lines(page).filter({ hasText: "守る物を並べた" });
  await expect(row).toHaveCount(1);
  expect(norm(await row.innerText())).toBe(
    norm("AI が、このチケットで守る物を並べた（必ず守る 3・開いたページ 2）09:00"),
  );
});

test("K702-UI-003 守る物の行が 2 つ（もう 1 度任せた）：古い方は 1 行に畳み、いちばん後ろの新しい方だけ広げる。広げた方の中身は新しい行の must・opened", async ({
  page,
}) => {
  const later = [{ id: P_INV, title: "請求書の送り方", place: "会社 › 経理" }];
  await open(page, [
    guard("2025-11-21 09:00"),
    opened("2025-11-21 09:05", P_PRICE, "単価の表", "会社 › 経理"),
    guard("2025-11-21 11:00", later, []),
  ]);
  await expect(lines(page).filter({ hasText: "守る物を並べた" })).toHaveCount(1);
  await expect(guardBox(page)).toHaveCount(1);
  await expect(guardBox(page).locator("li")).toHaveText([/請求書の送り方\s*会社 › 経理/]);
  await expect(guardBox(page).locator("h4").first()).toHaveText(/必ず守る（1）/);
  await expect(guardBox(page).locator("h4").nth(1)).toHaveText("このチケットのために開いたページ（0）");
});

test("K702-UI-004 守る物の題名はページへのリンク：href は /knowledge/<ページの id>・新しいタブで開く（target=_blank・rel に noopener）・場所は小さな字で隣に出る", async ({
  page,
}) => {
  await open(page, SAMPLE_GUARD());
  const link = guardBox(page).getByRole("link", { name: "請求書の送り方", exact: true });
  await expect(link).toHaveAttribute("href", `/knowledge/${P_INV}`);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(guardBox(page).getByRole("link")).toHaveCount(5);
  await expect(guardBox(page).locator("li").first().locator("small")).toHaveText("会社 › 経理");
});

// ---------------------------------------------------------------- 開いたページ・守れていなかった決まり

test("K702-UI-005 AI が開いたページの 1 行：「AI がナレッジの セイコー商事との決めごと（グループ：営業） を開いた」と時刻。題名はリンク（/knowledge/<id>・新しいタブ）・場所は小さな字。開いた順に並ぶ", async ({
  page,
}) => {
  await open(page, SAMPLE_OPENED());
  const rows = lines(page).filter({ hasText: "を開いた" });
  await expect(rows).toHaveCount(2);
  expect(norm(await rows.nth(0).innerText())).toBe(
    norm("AI がナレッジの セイコー商事との決めごと（グループ：営業） を開いた 09:01"),
  );
  expect(norm(await rows.nth(1).innerText())).toBe(norm("AI がナレッジの 単価の表（会社 › 経理） を開いた 09:02"));
  const link = rows.nth(0).getByRole("link", { name: "セイコー商事との決めごと", exact: true });
  await expect(link).toHaveAttribute("href", `/knowledge/${P_SEIKO}`);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(rows.nth(1).locator(".k-f9-inline-place")).toHaveText("（会社 › 経理）");
});

test("K702-UI-006 守れていなかった決まりの行（出来事 3 つ）：AI が直したと知らせた→「守れていなかった決まりが 1 つ：メールの書き方（件名に【請求書】が無い）。AI が直した」／チェックが付いていないのに終わりを知らせた→（AI が終わりを知らせたのに、チェックが付いていなかった）／AI が付けたチェックが外された→（AI が付けたチェックが外された）（後の 2 つの字は仮）", async ({
  page,
}) => {
  await open(page, [
    task("2025-11-21 09:00"),
    breach("2025-11-21 09:12", "ai_self_reported", "メールの書き方", "件名に【請求書】が無い"),
    breach("2025-11-21 09:13", "ai_unchecked", "外に出す前の確かめ", null, P_OUT),
    breach("2025-11-21 09:14", "human_unchecked", "請求書の送り方", null, P_INV),
  ]);
  const rows = lines(page).filter({ hasText: "守れていなかった決まり" });
  await expect(rows).toHaveCount(3);
  expect(norm(await rows.nth(0).innerText())).toBe(
    norm("守れていなかった決まりが 1 つ：メールの書き方（件名に【請求書】が無い）。AI が直した 09:12"),
  );
  expect(norm(await rows.nth(1).innerText())).toBe(
    norm(
      "守れていなかった決まりが 1 つ：外に出す前の確かめ（AI が終わりを知らせたのに、チェックが付いていなかった） 09:13",
    ),
  );
  expect(norm(await rows.nth(2).innerText())).toBe(
    norm("守れていなかった決まりが 1 つ：請求書の送り方（AI が付けたチェックが外された） 09:14"),
  );
  await expect(rows.nth(0).locator("b")).toHaveText(["メールの書き方", "AI"]);
});

// ---------------------------------------------------------------- 守り・壊れた値

test("K702-UI-007 ほかの行は今までのまま：確認項目の行（段 5）の文・段 7 の欄（実績）・知らない欄 knowledge_x（K-574 の決めで「項目を変更しました」・欄の鍵を出さない）が、守る物・開いた・破られたの行に取り違えられない", async ({
  page,
}) => {
  await open(page, [
    change(TAKA_W, "2025-11-21 10:36", [{ field: "test_spec", from: null, to: "承認する人が中身を見る" }]),
    change(TAKA_W, "2025-11-21 10:40", [{ field: "actual_minutes", from: null, to: "30 分" }]),
    kc("2025-11-21 10:41", { field: "knowledge_x", from: null, to: "x", note: null }),
    post(TAKA_W, "2025-11-21 10:45", "先月と同じ書式でお願いします"),
  ]);
  await expect(guardBox(page)).toHaveCount(0);
  const rows = lines(page);
  await expect(rows).toHaveCount(3);
  expect(norm(await rows.nth(0).innerText())).toContain(norm("高本が確認項目を足しました：承認する人が中身を見る"));
  expect(norm(await rows.nth(1).innerText())).toContain(norm("実績を 30 分 に変えた"));
  expect(norm(await rows.nth(2).innerText())).toContain(norm("項目を変更しました"));
  expect(await rows.nth(2).innerText()).not.toContain("knowledge_x");
  await expect(feed(page).getByText("先月と同じ書式でお願いします", { exact: true })).toBeVisible();
});

test("K702-UI-008 口の値が壊れていても落ちない：page_id が無い・uuid でない行は題名を字だけで出す（リンクにしない）・must が配列でない・must の行に題名が無いときはその行だけ捨てる。ほかの行は出る", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, [
    task("2025-11-21 09:00"),
    guard("2025-11-21 09:00", "壊れた", null),
    opened("2025-11-21 09:01", undefined, "ひもの無いページ", "会社"),
    opened("2025-11-21 09:02", "javascript:alert(1)", "怪しいページ", null),
    breach("2025-11-21 09:03", "ai_self_reported", "メールの書き方", null, undefined),
    guard("2025-11-21 09:04", [{ id: P_INV, title: "請求書の送り方", place: "会社" }, { id: P_MAIL }], []),
  ]);
  const rows = lines(page);
  await expect(rows.filter({ hasText: "を開いた" })).toHaveCount(2);
  await expect(rows.filter({ hasText: "を開いた" }).getByRole("link")).toHaveCount(0);
  await expect(rows.filter({ hasText: "ひもの無いページ" })).toContainText("ひもの無いページ");
  await expect(rows.filter({ hasText: "守る物を並べた" })).toHaveText(/必ず守る 0・開いたページ 0/);
  await expect(guardBox(page).locator("li")).toHaveCount(1);
  await expect(rows.filter({ hasText: "守れていなかった決まり" })).toContainText("メールの書き方");
  expect(errors).toEqual([]);
});

test("K702-UI-009 題名・場所・理由に HTML が入っていても字として出て動かない（img・script が作られず、alert も出ない）", async ({
  page,
}) => {
  let dialogs = 0;
  page.on("dialog", (d) => {
    dialogs += 1;
    void d.dismiss();
  });
  const bad = '<img src=x onerror="alert(1)">';
  await open(page, [
    task("2025-11-21 09:00"),
    opened("2025-11-21 09:01", P_PRICE, bad, "<b>場所</b>"),
    breach("2025-11-21 09:02", "ai_self_reported", bad, bad),
    guard("2025-11-21 09:03", [{ id: P_INV, title: bad, place: bad }], [{ id: P_MAIL, title: bad, place: bad }]),
  ]);
  await expect(panel(page).getByText(bad, { exact: false }).first()).toBeVisible();
  await expect(panel(page).locator("img")).toHaveCount(0);
  await expect(panel(page).locator("script")).toHaveCount(0);
  expect(dialogs).toBe(0);
});

test("K702-UI-010 題名を押すとページが新しいタブで開き（道は /knowledge/<ページの id>）、やり取りの画面はそのまま残る（見られない人の「見られない」画面は K-682 の K682-UI-016〜018 が見る）", async ({
  page,
}) => {
  await open(page, SAMPLE_OPENED());
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    lines(page)
      .filter({ hasText: "を開いた" })
      .first()
      .getByRole("link", { name: "セイコー商事との決めごと", exact: true })
      .click(),
  ]);
  await expect(popup).toHaveURL(new RegExp(`/knowledge/${P_SEIKO}$`));
  await popup.close();
  await expect(panel(page).locator(".k-talk-thread").first()).toBeVisible();
  expect(page.url()).not.toContain("/knowledge/");
});

test("K702-UI-011 守る物・開いた・破られたの行は、名前も顔も「AI」の字（actor が空の行・行の顔は CSS で描くので data-glyph で見る＝K392-UI-024）。人が書いた書き込みの顔は呼ばれ方の 1 文字目のまま", async ({
  page,
}) => {
  await open(page, [...SAMPLE_OPENED(), post(TAKA_W, "2025-11-21 09:30", "金額を確認しました")]);
  const avatars = lines(page).locator(".k-talk-avatar");
  expect(await avatars.count()).toBeGreaterThan(0);
  for (const g of await avatars.evaluateAll((els) => els.map((e) => e.getAttribute("data-glyph"))))
    expect(["AI", "高"]).toContain(g);
  await expect(lines(page).filter({ hasText: "を開いた" }).first().locator(".k-talk-avatar")).toHaveAttribute(
    "data-glyph",
    "AI",
  );
  await expect(lines(page).filter({ hasText: "を開いた" }).first().locator("b").first()).toHaveText("AI");
  await expect(
    panel(page)
      .getByRole("article", { name: /^高本 聖斗 09:30/ })
      .locator(".k-talk-avatar"),
  ).toHaveText("高");
});

test("K702-UI-012 「新しい順」にしても、広げるのは時間の上でいちばん後ろの行（見かけの上から 2 番目に出る）。並びを替えて戻すと同じ", async ({
  page,
}) => {
  await open(page, SAMPLE_GUARD());
  await expect(guardBox(page)).toHaveCount(1);
  await panel(page).getByRole("button", { name: /並び/ }).click();
  await page.getByRole("menuitem", { name: "新しい順", exact: true }).click();
  await expect(guardBox(page)).toHaveCount(1);
  await panel(page).getByRole("button", { name: /並び/ }).click();
  await page.getByRole("menuitem", { name: "古い順", exact: true }).click();
  await expect(guardBox(page)).toHaveCount(1);
});

test("K702-UI-013 口の数が増えない：やり取りを読む口 1 回・詳細 1 回。行を出す・畳む・リンクを見ることのために口を呼ばない（ページの口もナレッジの口も 0 回）", async ({
  page,
}) => {
  const knowledge: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/v1\/knowledge/.test(r.url())) knowledge.push(r.url());
  });
  const t = await open(page, SAMPLE_OPENED());
  await expect(lines(page).first()).toBeVisible();
  expect(t.reads).toHaveLength(1);
  expect(knowledge).toEqual([]);
});

test("K702-UI-014 幅 320・375・768・1024・1440 × 長い題名・長い場所・長い理由の行（広げた形と畳んだ形）で横のはみ出しが 0（数値）・折り返す", async ({
  page,
}) => {
  const long = "とても長いページの名前".repeat(12);
  const pages = Array.from({ length: 8 }, (_, i) => ({
    id: uid(0xc000 + i),
    title: `${long}${i}`,
    place: `会社 › ${long}`,
  }));
  for (const w of WIDTHS) {
    await open(
      page,
      [
        task("2025-11-21 09:00"),
        guard("2025-11-21 09:00", pages, pages),
        opened("2025-11-21 09:01", P_PRICE, long, long),
        breach("2025-11-21 09:02", "ai_self_reported", long, long),
        guard("2025-11-21 09:03", pages, pages),
      ],
      w,
    );
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
  }
});

test("K702-UI-015 キーボードだけで：Tab で守る物の題名のリンクへ順に進め、名前は題名・Enter で新しいタブが開く。リンクは button でなく link として読まれる", async ({
  page,
}) => {
  await open(page, SAMPLE_GUARD());
  const first = guardBox(page).getByRole("link", { name: "請求書の送り方", exact: true });
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(guardBox(page).getByRole("link", { name: "メールの書き方", exact: true })).toBeFocused();
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.keyboard.press("Enter")]);
  await expect(popup).toHaveURL(new RegExp(`/knowledge/${P_MAIL}$`));
});

// ---------------------------------------------------------------- 下絵との突き合わせ

const px = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "color", "texts"];
const TK_PAIRS: FidelityPair[] = [
  px("guard", ".k-f9-guard", ["width", "x", "background-color", "texts"]),
  px("guard-lead", ".k-f9-guard-lead", ["x", "height", ...TXT]),
  px("guard-h4", ".k-f9-guard h4", ["x", "height", ...TXT]),
  px("guard-li", ".k-f9-guard li", ["x", "height", ...TXT]),
  px("inline-link", ".k-f9-inline-link", ["x", ...TXT]),
  px("inline-place", ".k-f9-inline-place", TXT),
];
for (const [row, id, items] of [
  ["K702-UI-016", "tk-guard", SAMPLE_GUARD],
  ["K702-UI-017", "tk-opened", SAMPLE_OPENED],
] as const)
  test(`${row} 下絵 ${id} との突き合わせ（幅 375・768・1440）：守る物の箱・見出し・行・開いたページの題名と場所の位置・大きさ・字がモックと同じ（matchF9 の bad が 0）`, async ({
    browser,
  }) => {
    for (const w of MATCH_WIDTHS) {
      const { bad } = await matchF9(
        browser,
        id,
        w,
        async (p) => {
          await mockThread(p, { items: items() });
          await openThread(p, w);
        },
        { pairs: TK_PAIRS },
      );
      expect(bad, `幅 ${w}`).toEqual([]);
    }
  });

// ---------------------------------------------------------------- 部品とモックの置き方

const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("K702-MK-001 下絵の描き手（ticket-mocks.tsx）は、本番と同じ部品（ticket-rows.tsx の GuardPost・BreachText）を読み、守る物の書き込みの組み立てを自分で持たない。AI の名前は「AI」", () => {
  const src = strip(readFileSync(join(WEB, "app/(dev)/dev/mock/f9/ticket-mocks.tsx"), "utf8"));
  expect(src).toMatch(/from "@\/features\/F9\/knowledge\/ticket-rows"/);
  expect(src).toMatch(/GuardPost/);
  expect(src).not.toMatch(/<article className="k-talk-post"/);
  expect(src).not.toMatch(/高本のAI\s*<\/b>\s*が、このチケットで守る物/);
});

test("K702-MK-002 部品（ticket-rows・ticket-rows-shape）は口を呼ばず、HTML を直に差さず、編集の部品を読まない。やり取りの変換（to-items.ts）は ticket-rows の 1 つの関数を呼ぶだけで、views.tsx に足すのは node の 1 種類だけ", () => {
  for (const f of ["ticket-rows.tsx", "ticket-rows-shape.ts"]) {
    const src = strip(readFileSync(join(WEB, "features/F9/knowledge", f), "utf8"));
    expect(src, `${f} が口を呼ぶ`).not.toMatch(/\bfetch\(|apiFetch|\/api\/v1|from "@\/lib\/api/);
    expect(src, `${f} が HTML を差す`).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
    expect(src, `${f} が編集の部品を読む`).not.toMatch(/@tiptap\/|prosemirror-/);
  }
  const conv = strip(readFileSync(join(WEB, "features/F6/thread/to-items.ts"), "utf8"));
  expect(conv).toMatch(/knowledgeRowOf\(/);
  expect(conv).not.toMatch(/guard_list|knowledge_open|knowledge_breach/);
  const views = strip(readFileSync(join(WEB, "features/F6/thread/views.tsx"), "utf8"));
  expect(views).toMatch(/kind: "node"/);
  expect(views).not.toMatch(/guard_list|knowledge_open|knowledge_breach/);
});
