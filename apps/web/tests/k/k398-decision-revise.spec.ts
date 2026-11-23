// K-398「書き込みを決定にする・決定を改める・取り消す」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f6/dec-from-message・dec-revise・dec-cancel・dec-conflict（本番と同じ部品 features/F6/decisions/views.tsx・
//     features/F6/thread/views.tsx・K-382 が本線に入れる・下絵 OK answer=fabd031f9b37）。見比べは共通の道具 stage2-match.ts の matchMock だけ。
//   詳細と決定の口・人の一覧の口は K-397 の共通の道具 decisions-mock.ts（読むだけ・替えない）。やり取りの口 listTicketTimeline と
//     「最後に開いた時刻」の口はこの試験で差し替える（形は口の葉 K-383・K-384 の md に合わせる・仮。K-398.md の「画面が読む値」）。
//   期待は代表の答え（⑧ ⑯ ⑰ ⑲ ㉒・answer=eaa451436670・f5cd1647389f）・決定（D-125.63・D-145.9）とモックから書く。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  D0,
  D1,
  D2,
  D3,
  ME,
  MSG_ID,
  MSG_ID2,
  SUZUKI,
  TICKET,
  dec,
  decisionsApi,
  items,
  logSec,
  openDetail,
  type DecMock,
  who,
} from "./decisions-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { SUZU_W, TAKA_W, change, deleted, meta, post as postItem, system, type TimelineItem } from "./thread-mock";

test.use({ timezoneId: "Asia/Tokyo" });

const MSG = {
  fromSub: "書き込みを決定ログに残す。あとから根拠として引ける", // ㉒
  reviseSub: "前の決定は消えず、「改められた」の印が付きます", // ㉒
  cancelDesc: "取り消した印と理由が残ります（消えません）", // モック dec-cancel
  conflict: "この決定は、いま別の人が改めました。読み直してから、もう一度お試しください", // ㉒・E-CONF-031（K-391）
  conflictCancelled: "この決定は、いま別の人が取り消しました。読み直してから、もう一度お試しください", // E-CONF-033（K-391・仮）
  aiInert: "AI が一文にまとめた案 ── AI の案は、自分の AI と話す画面ができてから使えます", // ⑯
  newReq: "決めたことを書いてください", // E-VAL-042（K-390・K-391 の改めるで新しい決定が空のときも同じ番号）
  cancelReq: "取り消す理由を書いてください", // E-VAL-045（K-391・モック dec-cancel と同じ）
  forbidden:
    "この画面を見る権限がありません。見る必要があれば、マネージャーに頼めます。頼んだことは相手に知らせ、記録に残ります", // E-PAGE-002
  gone: "見つかりませんでした。消されたか、見る権限が無いかもしれません", // E-PAGE-001
  maintenance: "いまメンテナンス中です。終わると自動でこの画面が切り替わります。書きかけはこの PC に残っています", // E-PAGE-004
  loadFailed:
    "読み込めませんでした。ネットにつながっていないか、Kaname が混み合っています。書きかけのものはこの PC に残っています", // E-PAGE-007
} as const;
const SUZU_BODY = "10/19 の追加対応は先方の都合で無償にした件、反映が要るかもしれません。";

// ---------------------------------------------------------------- やり取りの口（1 件の形は K-392 の道具 thread-mock.ts の作り方・K-383 の答えの形）
//   詳細の差し替えは decisions-mock.ts（決定ログの区画つき）なので、thread-mock.ts の mockThread（詳細も差し替える）は使わず、1 件の作り方だけを読む
const POST_TAKA = (decided = false) =>
  postItem(TAKA_W, "2026-10-28 14:02", "山田様から、支払期日は月末締め翌月末でよいと返事がありました。", {
    id: MSG_ID2,
    decided,
  });
const POST_SUZU = (decided = false) => postItem(SUZU_W, "2026-11-01 10:20", SUZU_BODY, { id: MSG_ID, decided });
const CHANGE = () => change(TAKA_W, "2026-10-30 17:50", [{ field: "stage", from: "未着手", to: "作業中" }]);
const SYSTEM = () => system(TAKA_W, "2026-10-30 17:44", "高本 がチケットを作った");
const DELETED = () => deleted(TAKA_W, TAKA_W, "2026-11-01 11:09");
/** 決定のやり取りの 1 行（K-390・K-391：kind change・changes の field decision・note add／revise／cancel） */
const decisionLine = (note: string, to: string, from: string | null = null) =>
  change(TAKA_W, "2026-11-01 11:30", [{ field: "decision", from, to, note }]);

interface Tl {
  items: TimelineItem[];
  reads: number;
}
async function timelineApi(page: Page, init?: TimelineItem[]): Promise<Tl> {
  const t: Tl = { items: init ?? [SYSTEM(), POST_TAKA(true), CHANGE(), POST_SUZU()], reads: 0 };
  await page.route(new RegExp(`/api/v1/tickets/${TICKET}/timeline/seen$`), (route: Route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { ticket_id: TICKET, seen_at: new Date().toISOString() } }),
    }),
  );
  await page.route(new RegExp(`/api/v1/tickets/${TICKET}/timeline(\\?|$)`), (route: Route) => {
    t.reads++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: t.items,
        meta: meta({ post_count: t.items.filter((x) => x.kind === "post").length }),
      }),
    });
  });
  return t;
}
/** 決定の口とやり取りの口を差し替え、書いた後のやり取りの答えを口の葉と同じにする（元の書き込みに decided・決定の 1 行・⑲ は口の葉がする） */
async function ready(
  page: Page,
  list = [D2, D1, D0],
  tl?: TimelineItem[],
  canWrite = true,
): Promise<{ d: DecMock; t: Tl }> {
  const d = await decisionsApi(page, { list, canWrite });
  const t = await timelineApi(page, tl);
  let posts = 0;
  d.afterWrite = (x) => {
    const added = x.posts.length > posts;
    posts = x.posts.length;
    const last = x.patches.at(-1);
    const note = added ? "add" : String(last?.body["action"]);
    const src = added ? (x.posts.at(-1)!["source_message_id"] as string | undefined) : undefined;
    t.items = [
      ...t.items.map((it) =>
        src && it.id === src && it.message ? { ...it, message: { ...it.message, decided: true } } : it,
      ),
      decisionLine(note, x.list[0]!.id, added ? null : (last?.id ?? null)),
    ];
  };
  return { d, t };
}

const panel = (page: Page) => page.getByRole("complementary", { name: "チケットのパネル" });
const openTalk = async (page: Page) => {
  await panel(page)
    .getByRole("navigation", { name: "パネルのタブ" })
    .getByRole("button", { name: /^やり取り/ })
    .click();
  await expect(panel(page).locator("article.k-talk-post").first()).toBeVisible();
};
const post = (page: Page, name: string) => panel(page).getByRole("article", { name: new RegExp(`^${name} `) });
const fromDialog = (page: Page) => page.getByRole("dialog", { name: "決定にする" });
const reviseDialog = (page: Page) => page.getByRole("dialog", { name: "決定を改める" });
const cancelDialog = (page: Page) => page.getByRole("alertdialog", { name: "この決定を取り消しますか？" });
const decideOn = async (page: Page, name: string) => {
  await post(page, name).getByRole("button", { name: "決定にする" }).click();
  await expect(fromDialog(page)).toBeVisible();
};
const liveItem = (page: Page, text: string) =>
  items(page).filter({ has: page.locator(".k-dec-text", { hasText: text }) });
const openRevise = async (page: Page, text: string) => {
  await liveItem(page, text).getByRole("button", { name: "改める" }).click();
  await expect(reviseDialog(page)).toBeVisible();
};
const openCancel = async (page: Page, text: string) => {
  await liveItem(page, text).getByRole("button", { name: "取り消す" }).click();
  await expect(cancelDialog(page)).toBeVisible();
};
const over = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---------------------------------------------------------------- モックと本番の突き合わせ
const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const DLG_PAIRS: FidelityPair[] = (
  [
    ["dialog", ".k-dialog .k-dialog-head", BOX],
    ["dialog-title", ".k-dialog .k-dialog-title", ["x", "y", ...TEXT]],
    ["dialog-sub", ".k-dialog .k-dialog-sub", ["x", "y", ...TEXT]],
    ["dialog-desc", ".k-dialog .k-dialog-desc", ["x", "y", ...TEXT]],
    ["dialog-source", ".k-dialog .k-dec-source", [...BOX, ...TEXT]],
    ["dialog-label", ".k-dialog .k-label", ["x", "y", ...TEXT]],
    ["dialog-input", ".k-dialog .k-input", BOX],
    ["dialog-err", ".k-dialog .k-err", ["x", "y", ...TEXT]],
    ["dialog-inert", ".k-dialog .k-dec-inert", [...BOX, ...TEXT]],
    ["dialog-callout", ".k-dialog .k-callout", [...BOX, ...TEXT]],
    ["dialog-btn", ".k-dialog .k-dialog-actions button", [...BOX, "font-size", "color", "texts"]],
  ] as [string, string, string[]][]
).map(([role, sel, props]) => ({ name: role, role, canvas: sel, app: sel, props }));

const D2_PREV: typeof D2 = {
  ...D2,
  id: D1.id,
  text: "支払期日は月末締め翌々月 10 日",
  decided_at: "2026-10-20T01:00:00Z",
  revises_id: null,
  source: null,
};
const DRIVE: Record<string, (page: Page) => Promise<void>> = {
  "dec-from-message": async (page) => {
    await ready(page, [D2]);
    await openDetail(page, page.viewportSize()!.width);
    await openTalk(page);
    await decideOn(page, "鈴木 一郎");
    await fromDialog(page)
      .getByRole("textbox", { name: /決めたこと/ })
      .fill("10/19 の追加対応は無償。11 月分の請求から外す");
    await fromDialog(page).getByRole("combobox", { name: "決めた人" }).click();
    await page.getByRole("option", { name: "鈴木 一郎" }).click();
    await fromDialog(page).getByRole("textbox", { name: "ひとこと" }).fill("先方と合意");
    await fromDialog(page).getByRole("textbox", { name: "理由", exact: true }).fill("先方の都合による作業のため");
  },
  "dec-revise": async (page) => {
    await ready(page, [D2_PREV]);
    await openDetail(page, page.viewportSize()!.width);
    await openRevise(page, "支払期日は月末締め翌々月 10 日");
    await reviseDialog(page)
      .getByRole("textbox", { name: /新しい決定/ })
      .fill("支払期日は月末締め翌月末");
    await reviseDialog(page).getByRole("textbox", { name: "改める理由" }).fill("山田様から了承");
  },
  "dec-cancel": async (page) => {
    await ready(page, [{ ...D0, cancelled: null }]);
    await openDetail(page, page.viewportSize()!.width);
    await openCancel(page, "請求書は郵送もする");
    await cancelDialog(page).getByRole("button", { name: "取り消す" }).click();
    await expect(cancelDialog(page)).toContainText(MSG.cancelReq);
  },
  "dec-conflict": async (page) => {
    const { d } = await ready(page, [D2_PREV]);
    await openDetail(page, page.viewportSize()!.width);
    await openRevise(page, "支払期日は月末締め翌々月 10 日");
    await reviseDialog(page)
      .getByRole("textbox", { name: /新しい決定/ })
      .fill("支払期日は月末締め翌月末");
    await reviseDialog(page).getByRole("textbox", { name: "改める理由" }).fill("山田様から了承");
    d.failWrite.push({ status: 409, body: { error: "conflict", code: "E-CONF-031" } });
    await reviseDialog(page).getByRole("button", { name: "改める" }).click();
    await expect(reviseDialog(page)).toContainText(MSG.conflict);
  },
};
for (const [id, go] of Object.entries(DRIVE)) {
  for (const w of MATCH_WIDTHS) {
    test(`K398-UI-001 ${id} 幅 ${w}：小窓（題・説明・元の箱・前の決定・欄・グレーの箱・知らせ・ボタン・欄の下の文）の値がモックと同じ`, async ({
      browser,
    }) => {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
          await go(page);
        },
        { pairs: DLG_PAIRS, base: "/dev/mock/f6" },
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の頭で比べた").toContain("dialog");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 書き込みを決定にする

test("K398-UI-002 鈴木の書き込みの「決定にする」：小窓の題・説明・元の箱（名前と時刻と本文）・決めたことは本文で始まる・グレーの箱 2 つ・取引先の選び肢は無い", async ({
  page,
}) => {
  await ready(page, [D2]);
  await openDetail(page);
  await openTalk(page);
  await decideOn(page, "鈴木 一郎");
  const dlg = fromDialog(page);
  await expect(dlg.locator(".k-dialog-sub")).toHaveText(MSG.fromSub);
  const src = dlg.locator(".k-dec-source");
  await expect(src).toContainText("鈴木 一郎");
  await expect(src).toContainText("11/01 10:20");
  await expect(src).toContainText(SUZU_BODY);
  await expect(dlg.getByRole("textbox", { name: /決めたこと/ })).toHaveValue(SUZU_BODY);
  const inert = dlg.locator(".k-dec-inert");
  await expect(inert).toHaveCount(2);
  await expect(inert.first()).toHaveText(MSG.aiInert);
  for (const i of await inert.all()) await expect(i).toHaveAttribute("aria-disabled", "true");
  // 取引先を持たない（answer=4961f0280e9a）：「取引先」の選び肢は無い
  await expect(dlg.getByRole("radio", { name: /取引先/ })).toHaveCount(0);
});

test("K398-UI-003 決定にする：体（source_message_id つき・promoted_to なし）で 1 回・小窓が閉じ、決定の一覧とやり取りを 1 回ずつ読み直す。書き込みに「✓ 決定にした」・区画の 1 件目に元のリンク", async ({
  page,
}) => {
  const { d, t } = await ready(page, [D2]);
  await openDetail(page);
  await openTalk(page);
  const [r0, t0] = [d.reads, t.reads];
  await decideOn(page, "鈴木 一郎");
  const dlg = fromDialog(page);
  await dlg.getByRole("textbox", { name: /決めたこと/ }).fill("10/19 の追加対応は無償。11 月分の請求から外す");
  await dlg.getByRole("combobox", { name: "決めた人" }).click();
  await page.getByRole("option", { name: "鈴木 一郎" }).click();
  await dlg.getByRole("textbox", { name: "ひとこと" }).fill("先方と合意");
  await dlg.getByRole("textbox", { name: "理由", exact: true }).fill("先方の都合による作業のため");
  await dlg.getByRole("button", { name: "決定にする" }).click();
  await expect(fromDialog(page)).toHaveCount(0);
  expect(d.posts).toEqual([
    {
      text: "10/19 の追加対応は無償。11 月分の請求から外す",
      reason: "先方の都合による作業のため",
      decided_by_member_id: SUZUKI,
      decided_note: "先方と合意",
      source_message_id: MSG_ID,
    },
  ]);
  await expect(post(page, "鈴木 一郎")).toContainText("✓ 決定にした");
  await expect(post(page, "鈴木 一郎").getByRole("button", { name: "決定にする" })).toHaveCount(0);
  await expect(
    items(page)
      .first()
      .getByRole("link", { name: /元：やり取り 11\/01 10:20/ }),
  ).toBeVisible();
  await expect.poll(() => [d.reads - r0, t.reads - t0]).toEqual([1, 1]);
});

test("K398-UI-004 書き込みの印はやり取りの口の答え（message.decided）のとおり：true は「✓ 決定にした」で「決定にする」が無い・false は「決定にする」（取り消した決定の元は口が false を返す・K-383）", async ({
  page,
}) => {
  const cancelled = { ...D3, cancelled: { at: "2026-11-02T01:00:00Z", by: who(ME), reason: "間違い" } };
  await ready(page, [D2, cancelled], [SYSTEM(), POST_TAKA(true), POST_SUZU(false)]);
  await openDetail(page);
  await openTalk(page);
  await expect(post(page, "高本 聖斗")).toContainText("✓ 決定にした");
  await expect(post(page, "高本 聖斗").getByRole("button", { name: "決定にする" })).toHaveCount(0);
  await expect(post(page, "鈴木 一郎").getByRole("button", { name: "決定にする" })).toBeVisible();
  await expect(post(page, "鈴木 一郎")).not.toContainText("✓ 決定にした");
});

test("K398-UI-005 閲覧のみ：書き込みに「決定にする」0 個・「✓ 決定にした」は出る・区画に「改める」「取り消す」0 個", async ({
  page,
}) => {
  await ready(page, [D2], undefined, false);
  await openDetail(page);
  await openTalk(page);
  await expect(panel(page).getByRole("button", { name: "決定にする" })).toHaveCount(0);
  await expect(post(page, "高本 聖斗")).toContainText("✓ 決定にした");
  await expect(logSec(page).getByRole("button", { name: "改める" })).toHaveCount(0);
  await expect(logSec(page).getByRole("button", { name: "取り消す" })).toHaveCount(0);
});

test("K398-UI-006 変更の 1 行・仕組みの 1 行・消した跡の 1 行には「決定にする」が無い（人の書き込みだけ）", async ({
  page,
}) => {
  await ready(page, [], [SYSTEM(), CHANGE(), DELETED(), POST_SUZU()]);
  await openDetail(page);
  await openTalk(page);
  await expect(panel(page).getByRole("button", { name: "決定にする" })).toHaveCount(1);
  await expect(post(page, "鈴木 一郎").getByRole("button", { name: "決定にする" })).toBeVisible();
});

// ---------------------------------------------------------------- 改める・取り消す

test("K398-UI-007 10/28 の決定を改める：小窓の形・体で 1 回・古い方に「改められた」と新しい決定の字、新しい方に「改めた」・見出しの数は同じ。HTML は字のまま", async ({
  page,
}) => {
  const { d } = await ready(page, [D2]);
  await openDetail(page);
  await expect(logSec(page).locator("#sec-decisions")).toHaveText("決定ログ（1）");
  await openRevise(page, D2.text);
  const dlg = reviseDialog(page);
  await expect(dlg.locator(".k-dialog-sub")).toHaveText(MSG.reviseSub);
  await expect(dlg.locator(".k-dec-source")).toContainText("前の決定（10/28 高本）");
  await expect(dlg.locator(".k-dec-source")).toContainText(D2.text);
  await expect(dlg.getByRole("textbox", { name: /新しい決定/ })).toHaveValue("");
  await dlg.getByRole("textbox", { name: /新しい決定/ }).fill("支払期日は月末締め翌月末 25 日");
  await dlg.getByRole("textbox", { name: "改める理由" }).fill("山田様から再連絡");
  await dlg.getByRole("button", { name: "改める" }).click();
  await expect(reviseDialog(page)).toHaveCount(0);
  expect(d.patches).toEqual([
    { id: D2.id, body: { action: "revise", text: "支払期日は月末締め翌月末 25 日", reason: "山田様から再連絡" } },
  ]);
  const oldOne = liveItem(page, D2.text).filter({ hasText: "改められた" });
  await expect(oldOne).toContainText("新しい決定：支払期日は月末締め翌月末 25 日 ↑");
  await expect(items(page).first().locator(".k-dec-tag")).toHaveText("改めた");
  await expect(logSec(page).locator("#sec-decisions")).toHaveText("決定ログ（1）");
  // HTML やスクリプト（TP-XSS-L01）
  const evil = "<img src=x onerror=alert(1)>";
  await items(page).first().getByRole("button", { name: "改める" }).click();
  await reviseDialog(page)
    .getByRole("textbox", { name: /新しい決定/ })
    .fill(evil);
  await reviseDialog(page).getByRole("button", { name: "改める" }).click();
  await expect(items(page).first().locator(".k-dec-text")).toHaveText(evil);
  await expect(logSec(page).locator("img")).toHaveCount(0);
  expect(d.patches.at(-1)!.body).toEqual({ action: "revise", text: evil, reason: null });
});

test("K398-UI-008 新しい決定が空・空白だけは口 0 回で欄の下に文（仮）。理由が空なら reason: null で送れる", async ({
  page,
}) => {
  const { d } = await ready(page, [D2]);
  await openDetail(page);
  await openRevise(page, D2.text);
  const dlg = reviseDialog(page);
  await dlg.getByRole("button", { name: "改める" }).click();
  await expect(dlg).toContainText(MSG.newReq);
  await dlg.getByRole("textbox", { name: /新しい決定/ }).fill(" 　 ");
  await dlg.getByRole("button", { name: "改める" }).click();
  await expect(dlg).toContainText(MSG.newReq);
  expect(d.patches).toEqual([]);
  await dlg.getByRole("textbox", { name: /新しい決定/ }).fill("月末締め翌月末");
  await dlg.getByRole("button", { name: "改める" }).click();
  await expect(reviseDialog(page)).toHaveCount(0);
  expect(d.patches[0]!.body).toEqual({ action: "revise", text: "月末締め翌月末", reason: null });
});

test("K398-UI-009 10/28 の決定を取り消す：確かめの形・体で 1 回・一覧の下に札「取り消した」・線・「取り消し MM/DD 高本：理由」・見出しの数が 1 減る", async ({
  page,
}) => {
  const { d } = await ready(page, [D3, D2]);
  await openDetail(page);
  await expect(logSec(page).locator("#sec-decisions")).toHaveText("決定ログ（2）");
  await openCancel(page, D2.text);
  const dlg = cancelDialog(page);
  await expect(dlg).toContainText(MSG.cancelDesc);
  await expect(dlg.locator(".k-dec-source")).toHaveText(D2.text);
  await dlg.getByRole("textbox", { name: /取り消す理由/ }).fill("先方が取り下げた");
  await dlg.getByRole("button", { name: "取り消す" }).click();
  await expect(cancelDialog(page)).toHaveCount(0);
  expect(d.patches).toEqual([{ id: D2.id, body: { action: "cancel", reason: "先方が取り下げた" } }]);
  const last = items(page).last();
  await expect(last.locator(".k-dec-text")).toHaveText(D2.text);
  await expect(last.locator(".k-dec-tag")).toHaveText("取り消した");
  await expect(last.locator(".k-dec-sub")).toContainText(/取り消し \d\d\/\d\d 高本：先方が取り下げた/);
  expect(await last.locator(".k-dec-text").evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain(
    "line-through",
  );
  await expect(logSec(page).locator("#sec-decisions")).toHaveText("決定ログ（1）");
});

test("K398-UI-010 取り消す理由が空・空白だけは口 0 回で欄の下に文・確かめは開いたまま。「やめる」で閉じ、決定は生きているまま", async ({
  page,
}) => {
  const { d } = await ready(page, [D2]);
  await openDetail(page);
  await openCancel(page, D2.text);
  const dlg = cancelDialog(page);
  await dlg.getByRole("button", { name: "取り消す" }).click();
  await expect(dlg).toContainText(MSG.cancelReq);
  await dlg.getByRole("textbox", { name: /取り消す理由/ }).fill("　");
  await dlg.getByRole("button", { name: "取り消す" }).click();
  await expect(dlg).toContainText(MSG.cancelReq);
  await dlg.getByRole("button", { name: "やめる" }).click();
  await expect(cancelDialog(page)).toHaveCount(0);
  await expect(liveItem(page, D2.text).getByRole("button", { name: "取り消す" })).toBeVisible();
  expect(d.patches).toEqual([]);
});

test("K398-UI-011 改めるで 409（同時にほかの人が改めた）：小窓の中に赤の箱の文・ボタンは「閉じて読み直す」だけ・字は残る。押すと閉じて読み直し、ほかの人の決定が出る", async ({
  page,
}) => {
  const { d } = await ready(page, [D2]);
  await openDetail(page);
  await openRevise(page, D2.text);
  const dlg = reviseDialog(page);
  await dlg.getByRole("textbox", { name: /新しい決定/ }).fill("月末締め翌月 20 日");
  d.failWrite.push({ status: 409, body: { error: "conflict", code: "E-CONF-031" } });
  await dlg.getByRole("button", { name: "改める" }).click();
  await expect(dlg).toContainText(MSG.conflict);
  await expect(dlg.locator(".k-dialog-actions button")).toHaveText(["閉じて読み直す"]);
  await expect(dlg.getByRole("textbox", { name: /新しい決定/ })).toHaveValue("月末締め翌月 20 日");
  const other = dec({
    id: "0193c5a0-0000-7000-8000-0000000d0077",
    text: "支払期日は月末締め翌月 15 日",
    revises_id: D2.id,
    decided_by: who(SUZUKI),
  });
  d.list = [other, { ...D2, superseded_by_id: other.id }];
  const before = d.reads;
  await dlg.getByRole("button", { name: "閉じて読み直す" }).click();
  await expect(reviseDialog(page)).toHaveCount(0);
  await expect(items(page).first().locator(".k-dec-text")).toHaveText(other.text);
  expect(d.reads - before).toBe(1);
  expect(d.patches).toHaveLength(1);
});

test("K398-UI-012 取り消すで 409：確かめは閉じ、区画の中の頭の知らせに同じ文・一覧を読み直す", async ({ page }) => {
  const { d } = await ready(page, [D2]);
  await openDetail(page);
  await openCancel(page, D2.text);
  await cancelDialog(page)
    .getByRole("textbox", { name: /取り消す理由/ })
    .fill("先方が取り下げた");
  d.failWrite.push({ status: 409, body: { error: "conflict", code: "E-CONF-031" } });
  const before = d.reads;
  await cancelDialog(page).getByRole("button", { name: "取り消す" }).click();
  await expect(cancelDialog(page)).toHaveCount(0);
  await expect(logSec(page).locator('[role="alert"]')).toHaveText(MSG.conflict);
  await expect.poll(() => d.reads - before).toBe(1);
});

test("K398-UI-020 改める・取り消すで 409 E-CONF-033（開いている間にほかの人がその決定を取り消した）：改めるは小窓の中の赤の箱に E-CONF-033 の文（改めましたの字ではない）・ボタンは「閉じて読み直す」だけ・字は残る。取り消すは確かめを閉じて区画の中の頭の知らせに同じ文・一覧を読み直す", async ({
  page,
}) => {
  const { d } = await ready(page, [D2]);
  await openDetail(page);
  // 改める
  await openRevise(page, D2.text);
  const dlg = reviseDialog(page);
  await dlg.getByRole("textbox", { name: /新しい決定/ }).fill("月末締め翌月 20 日");
  d.failWrite.push({ status: 409, body: { error: "conflict", code: "E-CONF-033", message: MSG.conflictCancelled } });
  await dlg.getByRole("button", { name: "改める" }).click();
  await expect(dlg).toContainText(MSG.conflictCancelled);
  await expect(dlg).not.toContainText(MSG.conflict);
  await expect(dlg.locator(".k-dialog-actions button")).toHaveText(["閉じて読み直す"]);
  await expect(dlg.getByRole("textbox", { name: /新しい決定/ })).toHaveValue("月末締め翌月 20 日");
  const before = d.reads;
  await dlg.getByRole("button", { name: "閉じて読み直す" }).click();
  await expect(reviseDialog(page)).toHaveCount(0);
  await expect.poll(() => d.reads - before).toBe(1);
  // 取り消す
  await openCancel(page, D2.text);
  await cancelDialog(page)
    .getByRole("textbox", { name: /取り消す理由/ })
    .fill("先方が取り下げた");
  d.failWrite.push({ status: 409, body: { error: "conflict", code: "E-CONF-033", message: MSG.conflictCancelled } });
  const before2 = d.reads;
  await cancelDialog(page).getByRole("button", { name: "取り消す" }).click();
  await expect(cancelDialog(page)).toHaveCount(0);
  await expect(logSec(page).locator('[role="alert"]')).toHaveText(MSG.conflictCancelled);
  await expect.poll(() => d.reads - before2).toBe(1);
  expect(d.patches).toHaveLength(2);
});

test("K398-UI-013 決定にする小窓に「どこまで効かせる」の欄は無い：ラジオが 0 個・「取引先」の字も無く、体に promoted_to が無い", async ({
  page,
}) => {
  const { d } = await ready(page, [D2]);
  await openDetail(page);
  await openTalk(page);
  await decideOn(page, "鈴木 一郎");
  await expect(fromDialog(page).getByRole("radio")).toHaveCount(0);
  await expect(fromDialog(page)).not.toContainText("どこまで効かせる");
  await expect(fromDialog(page)).not.toContainText("取引先");
  await fromDialog(page).getByRole("button", { name: "決定にする" }).click();
  await expect(fromDialog(page)).toHaveCount(0);
  expect(Object.keys(d.posts[0]!)).not.toContain("promoted_to");
});

test("K398-UI-014 答えを止めたまま「決定にする」「改める」「取り消す」を 2 回押す：どれも口はちょうど 1 回・送っている間は押せない", async ({
  page,
}) => {
  const { d } = await ready(page, [D2]);
  await openDetail(page);
  await openTalk(page);
  // 決定にする
  let open = d.hold();
  await decideOn(page, "鈴木 一郎");
  const send = fromDialog(page).getByRole("button", { name: "決定にする" });
  await send.click();
  await send.click({ force: true });
  await expect(send).toBeDisabled();
  open();
  await expect(fromDialog(page)).toHaveCount(0);
  expect(d.posts).toHaveLength(1);
  // 改める
  open = d.hold();
  await openRevise(page, D2.text);
  await reviseDialog(page)
    .getByRole("textbox", { name: /新しい決定/ })
    .fill("月末締め翌月末");
  const rev = reviseDialog(page).getByRole("button", { name: "改める" });
  await rev.click();
  await rev.click({ force: true });
  await expect(rev).toBeDisabled();
  open();
  await expect(reviseDialog(page)).toHaveCount(0);
  // 取り消す
  open = d.hold();
  await openCancel(page, "月末締め翌月末");
  await cancelDialog(page)
    .getByRole("textbox", { name: /取り消す理由/ })
    .fill("やめた");
  const can = cancelDialog(page).getByRole("button", { name: "取り消す" });
  await can.click();
  await can.click({ force: true });
  open();
  await expect(cancelDialog(page)).toHaveCount(0);
  expect(d.patches).toHaveLength(2);
});

test("K398-UI-015 手順 S1〜S3 の失敗：403・404 は閉じて知らせ・読み直す。503・網の切れは開いたまま字が残り知らせ・もう一度押すと送れる。401 は /login?next=…", async ({
  page,
}) => {
  const { d } = await ready(page, [D2, D1]);
  await openDetail(page);
  await openTalk(page);
  // S1：503 → 送れる
  await decideOn(page, "鈴木 一郎");
  d.failWrite.push({ status: 503, body: { error: "unavailable", code: "SERVICE_UNAVAILABLE" } });
  await fromDialog(page).getByRole("button", { name: "決定にする" }).click();
  await expect(fromDialog(page)).toContainText(MSG.maintenance);
  await expect(fromDialog(page).getByRole("textbox", { name: /決めたこと/ })).toHaveValue(SUZU_BODY);
  await fromDialog(page).getByRole("button", { name: "決定にする" }).click();
  await expect(fromDialog(page)).toHaveCount(0);
  // S2：網の切れ → 送れる
  await openRevise(page, D2.text);
  await reviseDialog(page)
    .getByRole("textbox", { name: /新しい決定/ })
    .fill("月末締め翌月末");
  d.failWrite.push("abort");
  await reviseDialog(page).getByRole("button", { name: "改める" }).click();
  await expect(reviseDialog(page)).toContainText(MSG.loadFailed);
  await expect(reviseDialog(page).getByRole("textbox", { name: /新しい決定/ })).toHaveValue("月末締め翌月末");
  await reviseDialog(page).getByRole("button", { name: "閉じる" }).click();
  // S2：403
  await openRevise(page, D2.text);
  await reviseDialog(page)
    .getByRole("textbox", { name: /新しい決定/ })
    .fill("月末締め翌月末");
  d.failWrite.push({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
  await reviseDialog(page).getByRole("button", { name: "改める" }).click();
  await expect(reviseDialog(page)).toHaveCount(0);
  await expect(logSec(page).locator('[role="alert"]')).toHaveText(MSG.forbidden);
  // S3：404
  await openCancel(page, D2.text);
  await cancelDialog(page)
    .getByRole("textbox", { name: /取り消す理由/ })
    .fill("やめた");
  d.failWrite.push({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
  await cancelDialog(page).getByRole("button", { name: "取り消す" }).click();
  await expect(cancelDialog(page)).toHaveCount(0);
  await expect(logSec(page).locator('[role="alert"]')).toHaveText(MSG.gone);
  // S3：401
  await openCancel(page, D2.text);
  await cancelDialog(page)
    .getByRole("textbox", { name: /取り消す理由/ })
    .fill("やめた");
  d.failWrite.push({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
  await cancelDialog(page).getByRole("button", { name: "取り消す" }).click();
  await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Ftickets%2F${TICKET}$`));
});

test("K398-UI-016 区画の「元：やり取り 11/01 10:20 →」を押す：やり取りのタブが開き、その書き込みが見える所にあり、焦点が移る", async ({
  page,
}) => {
  await ready(page, [D3, D2]);
  await openDetail(page);
  await items(page)
    .first()
    .getByRole("link", { name: /元：やり取り 11\/01 10:20/ })
    .click();
  await expect(
    panel(page)
      .getByRole("navigation", { name: "パネルのタブ" })
      .getByRole("button", { name: /^やり取り/ }),
  ).toHaveAttribute("aria-current", "page");
  const target = panel(page).locator(`[id="msg-${MSG_ID}"]`);
  await expect(target).toBeInViewport();
  await expect(target).toBeFocused();
});

test("K398-UI-017 決定にした・改めた・取り消した後のやり取り：読み直しで 1 行「高本 が決定を足した」「…改めた」「…取り消した」が出る", async ({
  page,
}) => {
  const { t } = await ready(page, [D2]);
  await openDetail(page);
  await openTalk(page);
  await decideOn(page, "鈴木 一郎");
  await fromDialog(page).getByRole("button", { name: "決定にする" }).click();
  await expect(panel(page)).toContainText("高本 が決定を足した");
  await openRevise(page, D2.text);
  await reviseDialog(page)
    .getByRole("textbox", { name: /新しい決定/ })
    .fill("月末締め翌月末");
  await reviseDialog(page).getByRole("button", { name: "改める" }).click();
  await expect(panel(page)).toContainText("高本 が決定を改めた");
  await openCancel(page, "月末締め翌月末");
  await cancelDialog(page)
    .getByRole("textbox", { name: /取り消す理由/ })
    .fill("やめた");
  await cancelDialog(page).getByRole("button", { name: "取り消す" }).click();
  await expect(panel(page)).toContainText("高本 が決定を取り消した");
  expect(t.items.filter((x) => x.changes?.[0]?.field === "decision")).toHaveLength(3);
});

test("K398-UI-018 幅 320・375・768・1024・1440 で 3 つの小窓：横溢れ 0・ボタンは見える所", async ({ page }) => {
  await ready(page, [D2]);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openDetail(page, w);
    await openTalk(page);
    await decideOn(page, "鈴木 一郎");
    expect(await over(page), `決定にする 幅 ${w}`).toBe(0);
    await expect(fromDialog(page).getByRole("button", { name: "決定にする" })).toBeInViewport();
    await fromDialog(page).getByRole("button", { name: "やめる" }).click();
    await openRevise(page, D2.text);
    expect(await over(page), `改める 幅 ${w}`).toBe(0);
    await expect(reviseDialog(page).getByRole("button", { name: "改める" })).toBeInViewport();
    await reviseDialog(page).getByRole("button", { name: "やめる" }).click();
    await openCancel(page, D2.text);
    expect(await over(page), `取り消す 幅 ${w}`).toBe(0);
    await expect(cancelDialog(page).getByRole("button", { name: "取り消す" })).toBeInViewport();
    await cancelDialog(page).getByRole("button", { name: "やめる" }).click();
  }
});

test("K398-UI-019 キーボード：開くと焦点は最初の欄（取り消すの確かめは前からの決まりで「やめる」）・Esc で閉じて焦点は押したボタンへ戻る", async ({
  page,
}) => {
  await ready(page, [D2]);
  await openDetail(page);
  await openTalk(page);
  const decide = post(page, "鈴木 一郎").getByRole("button", { name: "決定にする" });
  await decide.focus();
  await page.keyboard.press("Enter");
  await expect(fromDialog(page).getByRole("textbox", { name: /決めたこと/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(fromDialog(page)).toHaveCount(0);
  await expect(decide).toBeFocused();
  const rev = liveItem(page, D2.text).getByRole("button", { name: "改める" });
  await rev.focus();
  await page.keyboard.press("Enter");
  await expect(reviseDialog(page).getByRole("textbox", { name: /新しい決定/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(rev).toBeFocused();
  const can = liveItem(page, D2.text).getByRole("button", { name: "取り消す" });
  await can.focus();
  await page.keyboard.press("Enter");
  await expect(cancelDialog(page).getByRole("button", { name: "やめる" })).toBeFocused(); // 取り消せない確かめは開いたとき「やめる」に動く（K-229）
  await page.keyboard.press("Escape");
  await expect(can).toBeFocused();
});
