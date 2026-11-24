// K-579「画面：版と差分の頁で「項目の変更を版 N に戻す」を押せる形にする（戻せた項目と、戻せなかった項目と訳）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f4v2/f4v2-versions-items-restored（戻した後・戻せなかった項目の並び。下絵に足す状態＝この葉の持ち物）。ボタンと注は f4v2-versions-items（K-449）と同じ。
//   頁・外枠・getTicket・版の一覧・項目の変更を読む口は K-449 の道具 versions-mock.ts の mockVersions。その上に、項目を戻す口 restoreTicketItems（口の葉 K-576）だけを
//   網の手前で重ねる（道具 item-restore-mock.ts：K-576 の「前提と制約」と同じ答えの形・既定の動きは K-576 の「断る順」）。
//   K-449 は「項目の変更を版 N に戻す」を押せない形で置いた（K-576 の前）。この葉が押せる形にする。
//   固定の待ちは使わない（要素と口の答えを待つ・二度押しは答えを止めて数える）。getByLabel・getByRole・getByText の name は exact。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { ASSIGNEE_ROW, mockItemRestore } from "./item-restore-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import {
  DEFAULT_DIFFS,
  WIDTHS,
  alertWith,
  conflict,
  copyBtn,
  diffOf,
  failed,
  forbidden,
  fromBox,
  lines,
  msg,
  notFound,
  openVersions,
  overflowX,
  pickBtn,
  restoreBtn,
  sideOf,
  toBox,
  verItems,
  type DiffRow,
  type PointRow,
} from "./versions-mock";

test.use({ timezoneId: "Asia/Tokyo" });

const FORBIDDEN_TEXT = "この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください";
const NO_RESTORE_TITLE = "このチケットを直せる人だけが戻せます";
const HINT = (n: number): string => `戻すと、いまの版は消えずに新しい版（版 ${n}）ができ、確認の結果が古くなります`;
const toastDone = (n: number): string => `項目の変更を版 ${n} の形に戻しました`;
const TOAST_NONE = "戻せる項目がありませんでした";
const ITEMS = "?of=items";
const inert = (b: Locator): Promise<void> => expect(b).toHaveAttribute("aria-disabled", "true");
const live = (b: Locator): Promise<void> => expect(b).not.toHaveAttribute("aria-disabled", "true");
/** 戻せなかった項目の並び（戻した後に出る・名前は下絵 f4v2-versions-items-restored の物） */
const skippedList = (page: Page): Locator => page.getByRole("list", { name: "戻せなかった項目", exact: true });
const skippedTexts = (page: Page): Promise<string[]> =>
  skippedList(page)
    .locator("li")
    .evaluateAll((ls) => ls.map((l) => (l.textContent ?? "").replace(/\s+/g, " ").trim()));
/** 項目の変更の差分が読み終わった（比べる元の選びと差分が出ている） */
async function ready(page: Page): Promise<void> {
  await expect(fromBox(page)).toBeVisible();
  await expect(diffOf(page)).toBeVisible();
}
/** 点 2 → 点 3 の差分（既定）。戻せるのは期限と支払期日・戻せないのは担当者 */
const D23_AFTER = ["del:期限：12/01（火）", "add:期限：11/27（金）", "del:支払期日：12/15（火）"];
const WHY_ASSIGNEE = ASSIGNEE_ROW.why as string;
const SKIPPED_ASSIGNEE = `${ASSIGNEE_ROW.name}：${WHY_ASSIGNEE}`;
const pointOf = (n: number, summary: string): PointRow => ({ n, at: "2026-11-21T02:10:00Z", by: "鈴木", summary });
const EXTRA: DiffRow = { field: "priority", name: "優先度", from: "中", to: "高", restorable: true, why: null };

// ---------------------------------------------------------------- 入口

test("K579-UI-001 入口：「項目の変更」を開くと「項目の変更を版 2 に戻す」が押せる形（aria-disabled でなく・title も付かない）。注「戻すと、いまの版は消えずに新しい版（版 4）ができ…」が出る。本文の側の「本文を版 2 に戻す」も押せる形のまま。開いただけでは戻す口は 0 回", async ({
  page,
}) => {
  const { m, r } = await mockItemRestore(page);
  await openVersions(page, ITEMS);
  await ready(page);
  const btn = restoreBtn(page, "項目の変更", 2);
  await live(btn);
  await expect(btn).not.toHaveAttribute("title", /./);
  await expect(page.getByText(HINT(4), { exact: true })).toBeVisible();
  expect(r.calls).toHaveLength(0);
  expect(m.itemLists).toHaveLength(1);
  await pickBtn(page, "本文").click();
  await expect(fromBox(page)).toBeVisible();
  await live(restoreBtn(page, "本文", 2));
  expect(r.calls).toHaveLength(0);
});

// ---------------------------------------------------------------- 戻す

test("K579-UI-002 入力：「項目の変更を版 2 に戻す」を押すと、確かめの小窓を挟まず口に 1 回（POST /item-changes/restore・体はちょうど { from: 2, to: 3 }・Idempotency-Key つき）。小窓（dialog）は出ない", async ({
  page,
}) => {
  const { r } = await mockItemRestore(page);
  await openVersions(page, ITEMS);
  await ready(page);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect.poll(() => r.calls.length).toBe(1);
  expect(r.calls[0]!.body).toEqual({ from: 2, to: 3 });
  expect(r.calls[0]!.headers["idempotency-key"]).toBeTruthy();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("K579-UI-003 結果：戻せた物が在る（期限・支払期日が戻り、担当者は戻せない）と、知らせ「項目の変更を版 2 の形に戻しました」が出る。項目の変更を読み直し（口 2 回目・from と to を付けない）、URL から from・to が外れて、新しい版 4（いま）が先頭・差分は版 3 → 版 4 で、戻った項目が逆向きに出る。再読み込み（別の GET）しても版 4 が在る", async ({
  page,
}) => {
  const { m, r } = await mockItemRestore(page);
  await openVersions(page, `${ITEMS}&from=2&to=3`);
  await ready(page);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(page.getByText(toastDone(2), { exact: true })).toBeVisible();
  await expect.poll(() => m.itemLists.length).toBe(2);
  expect(m.itemLists[1]!.get("from")).toBeNull();
  expect(m.itemLists[1]!.get("to")).toBeNull();
  await expect(page).not.toHaveURL(/from=/);
  await expect(verItems(page)).toHaveCount(4);
  await expect(verItems(page).nth(0)).toHaveText(/^版 4（いま）/);
  expect(await lines(page)).toEqual(D23_AFTER);
  await expect(page.getByText(HINT(5), { exact: true })).toBeVisible();
  expect(r.calls).toHaveLength(1);
  await page.reload();
  await ready(page);
  await expect(verItems(page)).toHaveCount(4);
  expect(await lines(page)).toEqual(D23_AFTER);
});

test("K579-UI-004 結果：戻せなかった項目は、頁の中の並び（名前「戻せなかった項目」）に「項目名：訳」で出る（担当者：口の答えの訳そのまま）。戻せた項目（期限・支払期日）は並びに出ない。比べる物を「本文」に切り替えると並びは消える", async ({
  page,
}) => {
  await mockItemRestore(page);
  await openVersions(page, ITEMS);
  await ready(page);
  await expect(skippedList(page)).toHaveCount(0);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(skippedList(page)).toBeVisible();
  expect(await skippedTexts(page)).toEqual([SKIPPED_ASSIGNEE]);
  await pickBtn(page, "本文").click();
  await expect(fromBox(page)).toBeVisible();
  await expect(skippedList(page)).toHaveCount(0);
});

test("K579-UI-005 失敗：戻せる項目が 1 つも無い（差分が担当者だけ・口が 200 で changed が false）と、知らせ「戻せる項目がありませんでした」と戻せなかった項目の並びだけが出て、版は増えず、項目の変更は読み直さない（口は 1 回のまま）。押し直せる", async ({
  page,
}) => {
  const { m, r } = await mockItemRestore(page, { diffs: { ...DEFAULT_DIFFS(), "2-3": [ASSIGNEE_ROW] } });
  await openVersions(page, ITEMS);
  await ready(page);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(page.getByText(TOAST_NONE, { exact: true })).toBeVisible();
  expect(await skippedTexts(page)).toEqual([SKIPPED_ASSIGNEE]);
  await expect(verItems(page)).toHaveCount(3);
  expect(m.itemLists).toHaveLength(1);
  expect(m.points).toHaveLength(3);
  await live(restoreBtn(page, "項目の変更", 2));
  expect(r.calls).toHaveLength(1);
});

// ---------------------------------------------------------------- 失敗

test("K579-UI-006 失敗：戻す前に別の人が項目を変えていて口が 409（E-ITM-002）：赤い箱に正本の文（「先に項目が変えられました。読み直してから、もう一度戻してください」）。項目の変更を読み直し（版 4 が出る）、選びは版 2 のまま。もう一度押すと、いまの最新（to＝4）を付けて通り、新しい版 5 ができる", async ({
  page,
}) => {
  const { m, r } = await mockItemRestore(page);
  r.before = (n, mm) => {
    if (n !== 1) return;
    mm.points.push(pointOf(4, "優先度を変えた"));
    mm.diffs["3-4"] = [EXTRA];
    mm.diffs["2-4"] = [EXTRA];
  };
  await openVersions(page, ITEMS);
  await ready(page);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(alertWith(page, msg("E-ITM-002"))).toBeVisible();
  await expect.poll(() => m.itemLists.length).toBe(2);
  await expect(verItems(page)).toHaveCount(4);
  await expect(fromBox(page)).toContainText("版 2");
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(page.getByText(toastDone(2), { exact: true })).toBeVisible();
  expect(r.calls.map((c) => c.body)).toEqual([
    { from: 2, to: 3 },
    { from: 2, to: 4 },
  ]);
  await expect(verItems(page)).toHaveCount(5);
  await expect(alertWith(page, msg("E-ITM-002"))).toHaveCount(0);
});

test("K579-UI-007 失敗：開いた後に完了された（口が 409・E-ITM-001）：赤い箱に正本の文（「完了したチケットの項目は、戻せません」）。getTicket を読み直し（2 回目）、戻すが押せない形になる。口は 1 回", async ({
  page,
}) => {
  const { m, r } = await mockItemRestore(page);
  r.before = (_n, mm) => {
    mm.completed = true;
  };
  await openVersions(page, ITEMS);
  await ready(page);
  expect(m.ticketReads).toBe(1);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(alertWith(page, msg("E-ITM-001"))).toBeVisible();
  await expect.poll(() => m.ticketReads).toBe(2);
  await inert(restoreBtn(page, "項目の変更", 2));
  expect(r.calls).toHaveLength(1);
});

test("K579-UI-008 失敗：戻す物が無い（口が 409・E-ITM-003）：赤い箱に正本の文（「戻す項目がありません」）。版は増えず、押し直せる。比べる元を版 1 に替えると差分が替わり、そこから戻すと { from: 1, to: 3 } で通る", async ({
  page,
}) => {
  const { r } = await mockItemRestore(page);
  r.next = [conflict("E-ITM-003")];
  await openVersions(page, ITEMS);
  await ready(page);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(alertWith(page, msg("E-ITM-003"))).toBeVisible();
  await live(restoreBtn(page, "項目の変更", 2));
  await fromBox(page).click();
  await page.getByRole("option", { name: /^版 1 ・/ }).click();
  await expect(page).toHaveURL(/from=1/);
  await restoreBtn(page, "項目の変更", 1).click();
  await expect(page.getByText(toastDone(1), { exact: true })).toBeVisible();
  expect(r.calls.map((c) => c.body)).toEqual([
    { from: 2, to: 3 },
    { from: 1, to: 3 },
  ]);
});

test("K579-UI-009 失敗 S1 項目を戻す口が失敗：戻す口が 403（書けない人）・404（E-PAGE-001／NOT_FOUND）・503（E-PAGE-003）・網が切れた：赤い箱に 403＝「この操作をする権限がありません…」・404＝E-PAGE-001・503＝E-PAGE-003・網切れ＝E-PAGE-008 の文。どれも版は増えず、押し直せる（網切れは押し直すと通る）", async ({
  page,
}) => {
  const { m, r } = await mockItemRestore(page);
  await openVersions(page, ITEMS);
  await ready(page);
  const cases: [ReturnType<typeof forbidden>, string][] = [
    [forbidden(), FORBIDDEN_TEXT],
    [notFound("E-PAGE-001"), msg("E-PAGE-001")],
    [notFound("NOT_FOUND"), msg("E-PAGE-001")],
    [failed(), msg("E-PAGE-003")],
  ];
  for (const [reply, text] of cases) {
    r.next = [reply];
    await restoreBtn(page, "項目の変更", 2).click();
    await expect(alertWith(page, text)).toBeVisible();
    await live(restoreBtn(page, "項目の変更", 2));
    expect(m.points).toHaveLength(3);
  }
  r.abort = 1;
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(alertWith(page, msg("E-PAGE-008"))).toBeVisible();
  expect(m.points).toHaveLength(3);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(page.getByText(toastDone(2), { exact: true })).toBeVisible();
  expect(r.calls).toHaveLength(6);
});

test("K579-UI-010 利用者の状態：戻す口が 401（ログインが切れた）なら入り直しへ移る（/login）。戻す口は 1 回・版は増えない", async ({
  page,
}) => {
  const { m, r } = await mockItemRestore(page);
  await openVersions(page, ITEMS);
  await ready(page);
  r.next = [{ status: 401, body: { error: "unauthorized", code: "E-PAGE-005" } }];
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(page).toHaveURL(/\/login/);
  expect(r.calls).toHaveLength(1);
  expect(m.points).toHaveLength(3);
});

test("K579-UI-011 操作の揺れ：戻す口の答えを止めた間に続けて 2 回押しても、口は 1 回。送っている間は押せない形。答えが来ると 1 つの新しい版になる", async ({
  page,
}) => {
  const { m, r } = await mockItemRestore(page);
  await openVersions(page, ITEMS);
  await ready(page);
  const release = r.hold();
  const btn = restoreBtn(page, "項目の変更", 2);
  await btn.click();
  await expect.poll(() => r.calls.length).toBe(1);
  await inert(btn);
  await btn.dispatchEvent("click");
  release();
  await expect(page.getByText(toastDone(2), { exact: true })).toBeVisible();
  expect(r.calls).toHaveLength(1);
  expect(m.points).toHaveLength(4);
});

// ---------------------------------------------------------------- 押せない形

test("K579-UI-012 守り：完了したチケットは、開いた時から「項目の変更を版 2 に戻す」が押せない形（title は付けない）・口 0 回。注の場所には「戻すと…」でなく正本 E-ITM-001 の文が出る。差分の表示とコピーは使える", async ({
  page,
}) => {
  const { r } = await mockItemRestore(page, { completed: true });
  await openVersions(page, ITEMS);
  await ready(page);
  const btn = restoreBtn(page, "項目の変更", 2);
  await inert(btn);
  await expect(btn).not.toHaveAttribute("title", /./);
  await btn.click({ force: true });
  await btn.press("Enter");
  expect(r.calls).toHaveLength(0);
  await expect(page.getByText(msg("E-ITM-001"), { exact: true })).toBeVisible();
  await expect(page.getByText(HINT(4), { exact: true })).toHaveCount(0);
  await live(copyBtn(page));
  expect(await lines(page)).toContain("add:支払期日：12/15（火）");
});

test("K579-UI-013 守り：書けない人（口の meta.can_restore が false）は、開いた時から「項目の変更を版 2 に戻す」が押せない形（title「このチケットを直せる人だけが戻せます」）で口は 0 回。差分の表示とコピーは使える", async ({
  page,
}) => {
  const { r } = await mockItemRestore(page, { canRestore: false });
  await openVersions(page, ITEMS);
  await ready(page);
  const btn = restoreBtn(page, "項目の変更", 2);
  await inert(btn);
  await expect(btn).toHaveAttribute("title", NO_RESTORE_TITLE);
  await btn.click({ force: true });
  await btn.press("Enter");
  expect(r.calls).toHaveLength(0);
  await live(copyBtn(page));
  expect((await lines(page)).length).toBeGreaterThan(0);
});

test("K579-UI-014 入力：比べる点が最新でない（?of=items&from=1&to=2）でも、戻すは「版 1 に戻す」で、体は { from: 1, to: 3 }（to は一覧の先頭＝いまの最新の点）。戻せた物（予定時間・期限・支払期日）が戻り、担当者が戻せなかった項目として出る", async ({
  page,
}) => {
  const { r } = await mockItemRestore(page);
  await openVersions(page, `${ITEMS}&from=1&to=2`);
  await ready(page);
  await restoreBtn(page, "項目の変更", 1).click();
  await expect(page.getByText(toastDone(1), { exact: true })).toBeVisible();
  expect(r.calls[0]!.body).toEqual({ from: 1, to: 3 });
  expect(await skippedTexts(page)).toEqual([SKIPPED_ASSIGNEE]);
  await expect(verItems(page)).toHaveCount(4);
});

// ---------------------------------------------------------------- 戻した後の読み直しが落ちる

test("K579-UI-015 失敗 S2 戻した後の項目の変更の読み直しが失敗：読み直しが 503（E-PAGE-003）でも、知らせと戻せなかった項目の並びは残り、差分の場所に赤い箱（正本の文）と「もう一度読む」が出る。「もう一度読む」で新しい差分（版 3 → 版 4）が出る", async ({
  page,
}) => {
  const { m, r } = await mockItemRestore(page);
  m.nextItems = [null, failed()];
  await openVersions(page, ITEMS);
  await ready(page);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(page.getByText(toastDone(2), { exact: true })).toBeVisible();
  await expect(alertWith(page, msg("E-PAGE-003"))).toBeVisible();
  expect(await skippedTexts(page)).toEqual([SKIPPED_ASSIGNEE]);
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(diffOf(page)).toBeVisible();
  expect(await lines(page)).toEqual(D23_AFTER);
  expect(m.itemLists).toHaveLength(3);
  expect(r.calls).toHaveLength(1);
});

// ---------------------------------------------------------------- 画面

test("K579-UI-016 画面：戻した後（戻せなかった項目の並びが出ている）も、幅 375・768・1440 のはみ出しが 0。並びと戻す・コピーが画面の中", async ({
  page,
}) => {
  await mockItemRestore(page);
  for (const w of WIDTHS) {
    await openVersions(page, ITEMS, w);
    await ready(page);
    await restoreBtn(page, "項目の変更", 2).click();
    await expect(skippedList(page)).toBeVisible();
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    for (const b of [skippedList(page), copyBtn(page)]) {
      const box = await b.boundingBox();
      expect(box, `幅 ${w}：画面の外`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(w);
    }
    if (w !== 375) await expect(sideOf(page).locator("ol")).toBeVisible();
  }
});

test("K579-UI-017 画面：キーボードだけで、比べる物 → 比べる元 → 比べる先 → 「項目の変更を版 2 に戻す」→ コピーの順に Tab で回り、戻すで Enter を押すと口に 1 回届く。戻した後も焦点は戻すボタンに残る", async ({
  page,
}) => {
  const { r } = await mockItemRestore(page);
  await openVersions(page, ITEMS);
  await ready(page);
  await pickBtn(page, "項目の変更").focus();
  for (const next of [fromBox(page), toBox(page), restoreBtn(page, "項目の変更", 2), copyBtn(page)]) {
    await page.keyboard.press("Tab");
    await expect(next).toBeFocused();
  }
  await restoreBtn(page, "項目の変更", 2).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => r.calls.length).toBe(1);
  await expect(page.getByText(toastDone(2), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^項目の変更を版 \d に戻す$/ })).toBeFocused();
});

// ---------------------------------------------------------------- 下絵との突き合わせ

const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "font-weight", "color", "line-height"];
const CTL = ["width", "height", "x", "font-size", "color", "background-color", "border-top-color"];
const R_PAIRS: FidelityPair[] = [
  pair("pick", ".k-f4d-pick button", [...CTL, "texts"]),
  pair("diff", ".k-f4d-diff", ["x", "width", "border-top-color", "border-top-left-radius"]),
  pair("acts", ".k-f4d-ver-acts .k-btn", [...CTL, "texts"]),
  pair("hint", ".k-f4d-hint", [...TXT, "texts"]),
  pair("skipped", ".k-f4d-skipped", ["x", "width", "border-top-color", "border-top-left-radius", "background-color"]),
  pair("skipped-item", ".k-f4d-skipped li", ["x", "width", "height", ...TXT, "texts"]),
];
for (const w of MATCH_WIDTHS) {
  test(`K579-UI-018 画面：下絵との突き合わせ（f4v2-versions-items-restored）幅 ${w}：戻した後の戻す／コピー・注・戻せなかった項目の並び（箱・行の字と高さ）が下絵と同じ`, async ({
    browser,
  }) => {
    const { rows, bad } = await matchMock(
      browser,
      "f4v2-versions-items-restored",
      w,
      async (page) => {
        await mockItemRestore(page);
        await openVersions(page, ITEMS, w);
        await ready(page);
        await restoreBtn(page, "項目の変更", 2).click();
        await expect(skippedList(page)).toBeVisible();
        await expect(diffOf(page)).toBeVisible();
      },
      { base: "/dev/mock/f4v2", pairs: R_PAIRS, blur: true },
    );
    expect(rows.length, `幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

// ---------------------------------------------------------------- 口の数・守り

test("K579-UI-019 守り：開くだけでは getTicket 1 本・版の一覧 1 本・項目の変更 0 本。項目の変更を開くと項目の変更が 1 本。戻すと戻す口 1 本＋項目の変更の読み直し 1 本（getTicket・版の一覧は増えない）。戻す口以外の書く口は 0 本で、本人の Bridge（38617）に飛ばない", async ({
  page,
}) => {
  const bridge: string[] = [];
  page.on("request", (rq) => {
    if (rq.url().includes("127.0.0.1:38617")) bridge.push(rq.url());
  });
  const { m, r } = await mockItemRestore(page);
  await openVersions(page);
  await expect(fromBox(page)).toBeVisible();
  expect([m.ticketReads, m.lists.length, m.itemLists.length]).toEqual([1, 1, 0]);
  await pickBtn(page, "項目の変更").click();
  await ready(page);
  expect([m.ticketReads, m.lists.length, m.itemLists.length, r.calls.length]).toEqual([1, 1, 1, 0]);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect(page.getByText(toastDone(2), { exact: true })).toBeVisible();
  await expect.poll(() => m.itemLists.length).toBe(2);
  expect([m.ticketReads, m.lists.length, r.calls.length]).toEqual([1, 1, 1]);
  expect(m.restores).toHaveLength(0);
  expect(m.otherWrites).toEqual([]);
  expect(bridge).toEqual([]);
});

test("K579-UI-020 入力：本文の戻す（K-449）と取り違えない。「本文を版 2 に戻す」は本文の口（POST /versions/2/restore・{ current_version }）だけを呼び、項目を戻す口は 0 回。「項目の変更を版 2 に戻す」は項目を戻す口だけを呼び、本文の戻す口は 0 回", async ({
  page,
}) => {
  const { m, r } = await mockItemRestore(page);
  await openVersions(page);
  await expect(fromBox(page)).toBeVisible();
  await restoreBtn(page, "本文", 2).click();
  await expect.poll(() => m.restores.length).toBe(1);
  expect(r.calls).toHaveLength(0);
  await pickBtn(page, "項目の変更").click();
  await ready(page);
  await restoreBtn(page, "項目の変更", 2).click();
  await expect.poll(() => r.calls.length).toBe(1);
  expect(m.restores).toHaveLength(1);
  expect(r.calls[0]!.body).toEqual({ from: 2, to: 3 });
});
