// K-449「画面：版と差分の頁（/tickets/:id/versions・比べる物は本文と項目の変更・版の一覧・差分・本文を版 N に戻す・この差分をコピー）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f4v2/f4v2-versions・f4v2-versions-items（代表が OK を出した下絵 v2・部品 features/F4/doc/detail-views.tsx の VersionsHead・VersionsView）。字・並び・ボタンは下絵が正。
//   外枠と getTicket は前からの土台（approve-complete.harness.ts の mockApi）。版を読む口 listTicketVersions・戻す口 restoreTicketVersion・項目の変更を読む口 listTicketItemChanges は
//   網の手前で差し替える（口の葉 K-433 と同時に書いているため。答えの形は 11_tickets/K-433.md の「実施事項」）。差し替えの道具は versions-mock.ts（この葉が持つ）。
//   固定の待ちは使わない（要素と口の答えを待つ・二度押しは答えを止めて数える）。getByLabel・getByRole・getByText の name は exact。
//   項目の変更を版へ戻す口は別の葉（K-576）。この葉の「項目の変更を版 N に戻す」は在ることだけを見る（押せる形にするのは K-579・K579-UI-001）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  CONFLICT_TEXT,
  L1,
  L2,
  L3,
  L4_NEW,
  L4_OLD,
  L5,
  L6,
  NUMBER,
  TICKET,
  TITLE,
  V1,
  V2,
  V3,
  WIDTHS,
  alertWith,
  conflict,
  copyBtn,
  diffOf,
  failed,
  forbidden,
  fromBox,
  lines,
  mockVersions,
  msg,
  notFound,
  openVersions,
  overflowX,
  pickBtn,
  restoreBtn,
  sideOf,
  toBox,
  verItems,
  type VerRow,
} from "./versions-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const FORBIDDEN_TEXT = "この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください";
const HINT = (n: number): string => `戻すと、いまの版は消えずに新しい版（版 ${n}）ができ、確認の結果が古くなります`;
const ONLY_BODY = "版は 1 つだけです。本文を書き終えるたびに、版が増えます。";
const ONLY_ITEMS = "版は 1 つだけです。項目を変えるたびに、版が増えます。";
const NO_DIFF = "変わった項目はありません";
const TOAST_COPIED = "差分をコピーしました";
const TOAST_COPY_FAILED = "差分をコピーできませんでした";
const toastRestored = (from: number, now: number): string => `本文を版 ${from} の中身に戻しました（新しい版 ${now}）`;
const OPT_FROM = (n: number): string => ({ 1: "版 1 ・ 高本 11/21 09:40", 2: "版 2 ・ 鈴木 11/21 10:05" })[n] as string;
const inert = (b: Locator): Promise<void> => expect(b).toHaveAttribute("aria-disabled", "true");
const live = (b: Locator): Promise<void> => expect(b).not.toHaveAttribute("aria-disabled", "true");
const row = (version: number, text: string, by: string | null, at: string, o: Partial<VerRow> = {}): VerRow => ({
  version,
  text,
  by,
  at,
  ...o,
});
/** 本文の差分が読み終わった（比べる元の選びと差分が出ている） */
async function ready(page: Page): Promise<void> {
  await expect(fromBox(page)).toBeVisible();
  await expect(diffOf(page)).toBeVisible();
}
/** 版 2 → 版 3（既定の本文）の差分 */
const D23 = [`same:${L1}`, `del:${L4_OLD}`, `add:${L2}`, `add:${L3}`, `add:${L4_NEW}`, `add:${L5}`, `add:${L6}`];

// ---------------------------------------------------------------- 入口

test("K449-UI-001 入口：頁を直に開く（再読み込み・ブックマーク）と、パンくず「チケット › EG-133 › 版と差分」・「← 詳細に戻る」・番号と題名・見出し「版と差分」が出て、口は getTicket 1 本と版の一覧 1 本だけ（項目の変更は読まない）。「← 詳細に戻る」で詳細へ戻る", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  const crumbs = page.getByRole("navigation", { name: "いまの場所", exact: true });
  await expect(crumbs.getByRole("link", { name: "チケット", exact: true })).toHaveAttribute("href", "/tickets");
  await expect(crumbs.getByText(NUMBER, { exact: true })).toBeVisible();
  await expect(crumbs.getByText("版と差分", { exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "版と差分", exact: true })).toHaveCount(1);
  await expect(page.locator(".k-f4d-vticket")).toHaveText(`${NUMBER} ${TITLE}`);
  const back = page.getByRole("link", { name: "← 詳細に戻る", exact: true });
  await expect(back).toHaveAttribute("href", `/tickets/${TICKET}`);
  expect(m.ticketReads).toBe(1);
  expect(m.lists).toHaveLength(1);
  expect(m.itemLists).toHaveLength(0);
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET}$`));
});

test("K449-UI-002 入口の実在：頁の道 /tickets/:id/versions が道の一覧と頁のファイルに在り、入口の道を作る versionsHref（features/F4/versions/versions-href.ts）がその道を返す", async () => {
  const routes = readFileSync(join(ROOT, "apps/web/lib/built-routes.ts"), "utf8");
  expect(routes, "道の一覧に /tickets/:id/versions が無い").toContain('"/tickets/:id/versions"');
  expect(existsSync(join(ROOT, "apps/web/app/(work)/tickets/[id]/versions/page.tsx")), "頁のファイルが無い").toBe(true);
  const src = readFileSync(join(ROOT, "apps/web/features/F4/versions/versions-href.ts"), "utf8");
  expect(src, "versionsHref が /tickets/<id>/versions を作っていない").toMatch(/\/tickets\/\$\{[^}]+\}\/versions/);
  expect(src).toMatch(/export (function|const) versionsHref/);
});

test("K449-UI-030 入口の張り替え：題の行の「版と差分」の入れ物の先（versions/versions-entry.tsx の VersionsEntryFill）が versionsHref の Link を書き出し、押せない形（aria-disabled・まだ使えません）を持たない", () => {
  const file = join(ROOT, "apps/web/features/F4/versions/versions-entry.tsx");
  expect(existsSync(file), "K-571 が先に置く入れ物の先のファイルが無い").toBe(true);
  const src = readFileSync(file, "utf8").replace(/\/\/[^\n]*/g, "");
  const body = src.slice(src.indexOf("VersionsEntryFill"));
  expect(body, "versionsHref を使っていない").toContain("versionsHref");
  expect(body.slice(0, 800), "Link を書き出していない").toMatch(/<Link\b/);
  expect(body.slice(0, 800), "押せない形のまま").not.toMatch(/aria-disabled|まだ使えません/);
});

// ---------------------------------------------------------------- 本文の版と差分

test("K449-UI-003 対象の状態：版の一覧は新しい順（版 3（いま）・版 2・版 1）で「直した人 ・ 日時（日本時間）・短い説明」。比べる 2 つの版（元＝版 2・先＝版 3）に印。AI が直した版は「AI」・戻した版は「版 1 に戻した」", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  await expect(sideOf(page).getByText("本文の版", { exact: true })).toBeVisible();
  await expect(verItems(page)).toHaveCount(3);
  await expect(verItems(page).nth(0)).toHaveText(/^版 3（いま）/);
  await expect(verItems(page).nth(1)).toHaveText(/^版 2/);
  await expect(verItems(page).nth(2)).toHaveText(/^版 1/);
  await expect(verItems(page).locator("small")).toHaveText([
    "高本 ・ 11/21 10:42 ・ 本文を直した",
    "鈴木 ・ 11/21 10:05 ・ 本文を直した",
    "高本 ・ 11/21 09:40 ・ 作成",
  ]);
  await expect(verItems(page).nth(0)).toHaveAttribute("data-to", "true");
  await expect(verItems(page).nth(1)).toHaveAttribute("data-from", "true");
  m.rows = [
    row(1, V1, "高本", "2026-11-21T00:40:00Z"),
    row(2, V2, null, "2026-11-21T01:05:00Z", { ai: true }),
    row(3, V1, "高本", "2026-11-21T01:42:00Z", { restoredFrom: 1 }),
  ];
  await page.reload();
  await ready(page);
  await expect(verItems(page).locator("small")).toHaveText([
    "高本 ・ 11/21 10:42 ・ 版 1 に戻した",
    "AI ・ 11/21 10:05 ・ 本文を直した",
    "高本 ・ 11/21 09:40 ・ 作成",
  ]);
});

test("K449-UI-004 入力：開いた直後は「本文」が選ばれ、版 2 → 版 3 の差分が出る（同じ 1 行・削除 1 行・追加 5 行。読み上げに「同じ：」「削除：」「追加：」）。比べる元は「版 2 ・ 鈴木 11/21 10:05」・先は「版 3（いま）・ 高本 11/21 10:42」・「本文を版 2 に戻す」と、新しい版（版 4）の注", async ({
  page,
}) => {
  await mockVersions(page);
  await openVersions(page);
  await ready(page);
  await expect(pickBtn(page, "本文")).toHaveAttribute("aria-pressed", "true");
  await expect(pickBtn(page, "項目の変更")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("本文：版 2 → 版 3", { exact: true })).toBeVisible();
  await expect(fromBox(page)).toContainText(OPT_FROM(2));
  await expect(toBox(page)).toContainText("版 3（いま）・ 高本 11/21 10:42");
  expect(await lines(page)).toEqual(D23);
  await expect(diffOf(page).locator("li").nth(1)).toContainText("削除：");
  await expect(diffOf(page).locator("li").nth(2)).toContainText("追加：");
  await expect(restoreBtn(page, "本文", 2)).toBeVisible();
  await expect(page.getByText(HINT(4), { exact: true })).toBeVisible();
});

test("K449-UI-005 入力：比べる元を選び直す。選べるのは先より古い版だけ（版 2・版 1）。版 1 を選ぶと URL に from=1・to=3 が付いて口に 1 回（from=1・to=3）・差分が版 1 → 版 3 に替わり、戻すは「本文を版 1 に戻す」", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  await fromBox(page).click();
  // 選んである選択肢には印 ✓ が中に出る（Base UI の ItemIndicator）ので、字は終わりで見る
  await expect(page.getByRole("option")).toHaveText([/版 2 ・ 鈴木 11\/21 10:05$/, /版 1 ・ 高本 11\/21 09:40$/]);
  await page.getByRole("option", { name: OPT_FROM(1), exact: true }).click();
  await expect(page).toHaveURL(/from=1/);
  await expect(page).toHaveURL(/to=3/);
  await expect(page.getByText("本文：版 1 → 版 3", { exact: true })).toBeVisible();
  await expect.poll(() => m.lists.length).toBe(2);
  expect(m.lists[1]!.get("from")).toBe("1");
  expect(m.lists[1]!.get("to")).toBe("3");
  expect(await lines(page)).toEqual([
    `del:${V1.split("\n")[0]}`,
    `del:${L4_OLD}`,
    `add:${L1}`,
    `add:${L2}`,
    `add:${L3}`,
    `add:${L4_NEW}`,
    `add:${L5}`,
    `add:${L6}`,
  ]);
  await expect(restoreBtn(page, "本文", 1)).toBeVisible();
  await expect(verItems(page).nth(2)).toHaveAttribute("data-from", "true");
});

test("K449-UI-006 入力：比べる先を選び直す。選べるのは元より新しい版だけ。先を版 2 にすると（?from=1&to=2）戻すは「本文を版 1 に戻す」・注は今の版 3 の次の「版 4」のまま。先を版 3 に戻すと口に from=1・to=3", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page, "?from=1&to=2");
  await ready(page);
  await expect(fromBox(page)).toContainText(OPT_FROM(1));
  await expect(toBox(page)).toContainText("版 2");
  await expect(restoreBtn(page, "本文", 1)).toBeVisible();
  await expect(page.getByText(HINT(4), { exact: true })).toBeVisible();
  await toBox(page).click();
  await expect(page.getByRole("option")).toHaveText([
    /版 2 ・ 鈴木 11\/21 10:05$/,
    /版 3（いま）・ 高本 11\/21 10:42$/,
  ]);
  await page.getByRole("option", { name: "版 3（いま）・ 高本 11/21 10:42", exact: true }).click();
  await expect(page).toHaveURL(/to=3/);
  await expect.poll(() => m.lists.length).toBe(2);
  expect(m.lists[1]!.get("from")).toBe("1");
  expect(m.lists[1]!.get("to")).toBe("3");
  await expect(page.getByText("本文：版 1 → 版 3", { exact: true })).toBeVisible();
});

test("K449-UI-007 入力：「項目の変更」に切り替えると URL に of=items が付いて、項目の変更の口が 1 回（比べる点を指さない）・点の一覧・差分（期限・担当者・支払期日）・「項目の変更を版 2 に戻す」が在る（押せるかは K-579 が決める。この行は在ることだけを見る）。「本文」に戻すと本文を読み直す", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  await pickBtn(page, "項目の変更").click();
  await expect(page).toHaveURL(/of=items/);
  await expect(page.getByText("項目の変更：版 2 → 版 3", { exact: true })).toBeVisible();
  await expect.poll(() => m.itemLists.length).toBe(1);
  expect(m.itemLists[0]!.get("from")).toBeNull();
  expect(m.itemLists[0]!.get("to")).toBeNull();
  await expect(pickBtn(page, "項目の変更")).toHaveAttribute("aria-pressed", "true");
  await expect(sideOf(page).getByText("項目の変更の版", { exact: true })).toBeVisible();
  await expect(verItems(page).locator("small")).toHaveText([
    "高本 ・ 11/21 10:42 ・ 期限・担当者・支払期日を変えた",
    "鈴木 ・ 11/21 10:05 ・ 予定時間を変えた",
    "高本 ・ 11/21 09:40 ・ 作成",
  ]);
  expect(await lines(page)).toEqual([
    "del:期限：11/27（金）",
    "add:期限：12/01（火）",
    "del:担当者：鈴木 一郎",
    "add:担当者：高本 聖斗",
    "add:支払期日：12/15（火）",
  ]);
  // 「項目の変更を版 2 に戻す」は在ることだけを見る（押せる形か押せない形かは K-579 の行 K579-UI-001 が見る＝K-579 が入っても赤くならない）
  await expect(restoreBtn(page, "項目の変更", 2)).toHaveCount(1);
  expect(m.itemLists).toHaveLength(1);
  await pickBtn(page, "本文").click();
  await ready(page);
  expect(m.lists).toHaveLength(2);
  expect(await lines(page)).toEqual(D23);
});

test("K449-UI-008 対象の状態：項目の変更で変わった項目が無い（差分が空）と、行は 0・「変わった項目はありません」が出て、戻すは押せない形", async ({
  page,
}) => {
  const m = await mockVersions(page);
  m.diffs = { "2-3": [] };
  await openVersions(page, "?of=items");
  await expect(page.getByText(NO_DIFF, { exact: true })).toBeVisible();
  await expect(diffOf(page).locator("li")).toHaveCount(0);
  await inert(restoreBtn(page, "項目の変更", 2));
});

test("K449-UI-009 対象の状態：版が 1 つだけ（本文）・点が 1 つだけ（項目の変更）のとき、注（本文は「版は 1 つだけです。本文を書き終えるたびに、版が増えます。」・項目の変更は「版は 1 つだけです。項目を変えるたびに、版が増えます。」）が出て、差分の行・「戻す」「この差分をコピー」は出ない", async ({
  page,
}) => {
  const m = await mockVersions(page, {
    rows: [row(1, V1, "高本", "2026-11-21T00:40:00Z")],
    points: [{ n: 1, at: "2026-11-21T00:40:00Z", by: "高本", summary: "作成" }],
  });
  await openVersions(page);
  await expect(page.getByRole("status").filter({ hasText: ONLY_BODY })).toBeVisible();
  await expect(verItems(page)).toHaveCount(1);
  await expect(diffOf(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /に戻す$/ })).toHaveCount(0);
  await expect(copyBtn(page)).toHaveCount(0);
  expect(m.lists[0]!.get("from")).toBeNull();
  await pickBtn(page, "項目の変更").click();
  await expect(page.getByRole("status").filter({ hasText: ONLY_ITEMS })).toBeVisible();
  await expect(diffOf(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /に戻す$/ })).toHaveCount(0);
  await expect(copyBtn(page)).toHaveCount(0);
});

test("K449-UI-010 入力：差分は行どうしの最長共通部分で作る。入れ替わった行（x y z → y z x は 削除 x・同じ y z・追加 x）・空行（a・空・b → a・b は 同じ a・削除 空・同じ b）・同じ行が重なる（a a b → a b は 削除 1・同じ 2・追加 0）", async ({
  page,
}) => {
  const m = await mockVersions(page);
  const at = (h: number): string => `2026-11-21T0${h}:00:00Z`;
  m.rows = [row(1, "x\ny\nz", "高本", at(1)), row(2, "y\nz\nx", "高本", at(2))];
  await openVersions(page, "?from=1&to=2");
  await ready(page);
  expect(await lines(page)).toEqual(["del:x", "same:y", "same:z", "add:x"]);
  m.rows = [row(1, "a\n\nb", "高本", at(1)), row(2, "a\nb", "高本", at(2))];
  await page.reload();
  await ready(page);
  expect(await lines(page)).toEqual(["same:a", "del:", "same:b"]);
  m.rows = [row(1, "a\na\nb", "高本", at(1)), row(2, "a\nb", "高本", at(2))];
  await page.reload();
  await ready(page);
  const kinds = (await lines(page)).map((l) => l.split(":")[0]).sort();
  expect(kinds).toEqual(["del", "same", "same"]);
});

// ---------------------------------------------------------------- 戻す

test("K449-UI-011 入力：「本文を版 2 に戻す」を押すと、口に 1 回（POST /versions/2/restore・体は { current_version: 3 }・Idempotency-Key つき・確かめの小窓は挟まない）。一覧を読み直して（URL から from・to が外れる）新しい版 4（いま）が出て、知らせ「本文を版 2 の中身に戻しました（新しい版 4）」。再読み込み（別の GET）しても版 4 が在る", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  await restoreBtn(page, "本文", 2).click();
  await expect.poll(() => m.restores.length).toBe(1);
  expect(m.restores[0]!.v).toBe("2");
  expect(m.restores[0]!.body).toEqual({ current_version: 3 });
  expect(m.restores[0]!.headers["idempotency-key"]).toBeTruthy();
  await expect(page.getByText(toastRestored(2, 4), { exact: true })).toBeVisible();
  await expect.poll(() => m.lists.length).toBe(2);
  expect(m.lists[1]!.get("from")).toBeNull();
  expect(m.lists[1]!.get("to")).toBeNull();
  await expect(page).not.toHaveURL(/from=/);
  await expect(verItems(page)).toHaveCount(4);
  await expect(verItems(page).nth(0)).toHaveText(/^版 4（いま）/);
  await expect(verItems(page).nth(0).locator("small")).toHaveText("高本 ・ 11/21 11:30 ・ 版 2 に戻した");
  expect(await lines(page)).toEqual([
    `same:${L1}`,
    `del:${L2}`,
    `del:${L3}`,
    `del:${L4_NEW}`,
    `del:${L5}`,
    `del:${L6}`,
    `add:${L4_OLD}`,
  ]);
  await expect(page.getByText(HINT(5), { exact: true })).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(verItems(page)).toHaveCount(4);
});

test("K449-UI-012 失敗：戻す前に別の人が直していて口が 409（E-SEC-004・版 4）：赤い箱に口の文そのまま。一覧を読み直し（注は版 5）、選びは版 2 → 版 3 のまま。もう一度押すと current_version 4 を付けて通り、新しい版 5 ができる", async ({
  page,
}) => {
  const m = await mockVersions(page);
  m.before = (n, mm) => {
    if (n === 1) mm.rows.push(row(4, `${V3}\n追記`, "鈴木", "2026-11-21T02:10:00Z"));
  };
  await openVersions(page);
  await ready(page);
  await restoreBtn(page, "本文", 2).click();
  await expect(alertWith(page, CONFLICT_TEXT)).toBeVisible();
  await expect.poll(() => m.lists.length).toBe(2);
  await expect(verItems(page)).toHaveCount(4);
  await expect(page.getByText(HINT(5), { exact: true })).toBeVisible();
  await expect(fromBox(page)).toContainText(OPT_FROM(2));
  expect(m.restores).toHaveLength(1);
  await restoreBtn(page, "本文", 2).click();
  await expect.poll(() => m.restores.length).toBe(2);
  expect(m.restores[1]!.body).toEqual({ current_version: 4 });
  await expect(page.getByText(toastRestored(2, 5), { exact: true })).toBeVisible();
  await expect(alertWith(page, CONFLICT_TEXT)).toHaveCount(0);
});

test("K449-UI-013 失敗：戻す先が今の本文と同じ中身（口が 409・E-SEC-020）：赤い箱に正本の文。版は増えず、押し直せる", async ({
  page,
}) => {
  const m = await mockVersions(page);
  m.rows = [
    row(1, V1, "高本", "2026-11-21T00:40:00Z"),
    row(2, V3, "鈴木", "2026-11-21T01:05:00Z"),
    row(3, V3, "高本", "2026-11-21T01:42:00Z"),
  ];
  await openVersions(page);
  await ready(page);
  expect((await lines(page)).every((l) => l.startsWith("same:"))).toBe(true);
  await restoreBtn(page, "本文", 2).click();
  await expect(alertWith(page, msg("E-SEC-020"))).toBeVisible();
  expect(m.rows).toHaveLength(3);
  expect(m.restores).toHaveLength(1);
  await live(restoreBtn(page, "本文", 2));
});

test("K449-UI-014 利用者の状態：完了したチケット（getTicket に completed）は、戻すが開いた時から押せない形で口は 0 回、注は正本 E-SEC-005 の文。開いた後に完了された（口が 409・E-SEC-005）ときは赤い箱に同じ文・詳細を読み直して戻すが押せない形に替わる", async ({
  page,
}) => {
  const m = await mockVersions(page, { completed: true });
  await openVersions(page);
  await ready(page);
  const btn = restoreBtn(page, "本文", 2);
  await inert(btn);
  await btn.click({ force: true });
  expect(m.restores).toHaveLength(0);
  await expect(page.getByText(msg("E-SEC-005"), { exact: true })).toBeVisible();
  await expect(page.getByText(HINT(4), { exact: true })).toHaveCount(0);
  const m2 = await mockVersions(page);
  m2.before = (_n, mm) => {
    mm.completed = true;
  };
  m2.next = [conflict("E-SEC-005")];
  await openVersions(page);
  await ready(page);
  await restoreBtn(page, "本文", 2).click();
  await expect(alertWith(page, msg("E-SEC-005"))).toBeVisible();
  await expect.poll(() => m2.ticketReads).toBe(2);
  await inert(restoreBtn(page, "本文", 2));
});

test("K449-UI-015 失敗：戻す口が 403（書けない人）・404（E-PAGE-001／NOT_FOUND）・503（E-PAGE-003）・網が切れた：赤い箱に 403＝「この操作をする権限がありません…」・404＝E-PAGE-001・503＝E-PAGE-003・網切れ＝E-PAGE-008 の文。どれも版は増えず、押し直せる（網切れは押し直すと通る）", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  const cases: [ReturnType<typeof forbidden>, string][] = [
    [forbidden(), FORBIDDEN_TEXT],
    [notFound("E-PAGE-001"), msg("E-PAGE-001")],
    [notFound("NOT_FOUND"), msg("E-PAGE-001")],
    [failed(), msg("E-PAGE-003")],
  ];
  for (const [reply, text] of cases) {
    m.next = [reply];
    await restoreBtn(page, "本文", 2).click();
    await expect(alertWith(page, text)).toBeVisible();
    await live(restoreBtn(page, "本文", 2));
    expect(m.rows).toHaveLength(3);
  }
  m.abort = 1;
  await restoreBtn(page, "本文", 2).click();
  await expect(alertWith(page, msg("E-PAGE-008"))).toBeVisible();
  expect(m.rows).toHaveLength(3);
  await restoreBtn(page, "本文", 2).click();
  await expect(page.getByText(toastRestored(2, 4), { exact: true })).toBeVisible();
  expect(m.restores).toHaveLength(6);
});

test("K449-UI-016 利用者の状態：戻す口が 401（ログインが切れた）なら入り直しへ移る（/login）。戻す口は 1 回・版は増えない", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  m.next = [{ status: 401, body: { error: "unauthorized", code: "E-PAGE-005" } }];
  await restoreBtn(page, "本文", 2).click();
  await expect(page).toHaveURL(/\/login/);
  expect(m.restores).toHaveLength(1);
  expect(m.rows).toHaveLength(3);
});

test("K449-UI-017 操作の揺れ：戻す口の答えを止めた間に続けて 2 回押しても、口は 1 回。送っている間は押せない形。答えが来ると 1 つの新しい版になる", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  const release = m.hold();
  const btn = restoreBtn(page, "本文", 2);
  await btn.click();
  await expect.poll(() => m.restores.length).toBe(1);
  await inert(btn);
  await btn.dispatchEvent("click");
  release();
  await expect(page.getByText(toastRestored(2, 4), { exact: true })).toBeVisible();
  expect(m.restores).toHaveLength(1);
  expect(m.rows).toHaveLength(4);
});

test("K449-UI-018 守り：書けない人（口の meta.can_restore が false）は、「本文を版 2 に戻す」が開いた時から押せない形（薄く・「このチケットを直せる人だけが戻せます」）で口は 0 回。差分の表示とコピーは使える", async ({
  page,
}) => {
  const m = await mockVersions(page, { canRestore: false });
  await openVersions(page);
  await ready(page);
  const btn = restoreBtn(page, "本文", 2);
  await inert(btn);
  await expect(btn).toHaveAttribute("title", "このチケットを直せる人だけが戻せます");
  await btn.click({ force: true });
  await btn.press("Enter");
  expect(m.restores).toHaveLength(0);
  expect(await lines(page)).toEqual(D23);
  await live(copyBtn(page));
});

// ---------------------------------------------------------------- コピー

test("K449-UI-019 入力：「この差分をコピー」で、クリップボードに 1 行目「本文：版 2 → 版 3」と、続けて見えている行を「同じ：」「削除：」「追加：」の頭を付けて 1 行ずつ入れ、知らせ「差分をコピーしました」。項目の変更も同じ形（1 行目は「項目の変更：版 2 → 版 3」）。書く口は 0 回", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  await copyBtn(page).click();
  await expect(page.getByText(TOAST_COPIED, { exact: true })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.split("\n")).toEqual([
    "本文：版 2 → 版 3",
    `同じ：${L1}`,
    `削除：${L4_OLD}`,
    `追加：${L2}`,
    `追加：${L3}`,
    `追加：${L4_NEW}`,
    `追加：${L5}`,
    `追加：${L6}`,
  ]);
  await pickBtn(page, "項目の変更").click();
  await expect(page.getByText("項目の変更：版 2 → 版 3", { exact: true })).toBeVisible();
  await copyBtn(page).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("項目の変更：版 2 → 版 3");
  const items = (await page.evaluate(() => navigator.clipboard.readText())).split("\n");
  expect(items.slice(1)).toEqual([
    "削除：期限：11/27（金）",
    "追加：期限：12/01（火）",
    "削除：担当者：鈴木 一郎",
    "追加：担当者：高本 聖斗",
    "追加：支払期日：12/15（火）",
  ]);
  expect(m.restores).toHaveLength(0);
  expect(m.otherWrites).toEqual([]);
});

test("K449-UI-020 失敗：クリップボードが断る（writeText が拒まれる）と、知らせ「差分をコピーできませんでした」が出て「差分をコピーしました」は出ない。頁は開いたまま・差分もそのまま", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true,
    });
  });
  await mockVersions(page);
  await openVersions(page);
  await ready(page);
  await copyBtn(page).click();
  await expect(page.getByText(TOAST_COPY_FAILED, { exact: true })).toBeVisible();
  await expect(page.getByText(TOAST_COPIED, { exact: true })).toHaveCount(0);
  expect(await lines(page)).toEqual(D23);
});

// ---------------------------------------------------------------- 読む口の失敗

test("K449-UI-021 失敗：版の一覧の口が 503（E-PAGE-003）：赤い箱に正本の文と「もう一度読む」。差分も戻すも出ない。「もう一度読む」で口をもう 1 回読み、一覧と差分が出る", async ({
  page,
}) => {
  const m = await mockVersions(page);
  m.nextList = [failed()];
  await openVersions(page);
  await expect(alertWith(page, msg("E-PAGE-003"))).toBeVisible();
  await expect(diffOf(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /に戻す$/ })).toHaveCount(0);
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await ready(page);
  expect(m.lists).toHaveLength(2);
  expect(await lines(page)).toEqual(D23);
});

test("K449-UI-022 失敗：無い（404）：版の一覧の口が 404（E-PAGE-001）・比べる版の指定が無い版（?from=99）・チケットの読み（getTicket）が 404 のどれも、赤い箱に E-PAGE-001 の正本の文だけ（「もう一度読む」は出ない）。差分は出ない", async ({
  page,
}) => {
  const m = await mockVersions(page);
  m.nextList = [notFound("E-PAGE-001")];
  await openVersions(page);
  await expect(alertWith(page, msg("E-PAGE-001"))).toBeVisible();
  await expect(page.getByRole("button", { name: "もう一度読む", exact: true })).toHaveCount(0);
  await expect(diffOf(page)).toHaveCount(0);
  await openVersions(page, "?from=99");
  await expect(alertWith(page, msg("E-PAGE-001"))).toBeVisible();
  await expect(diffOf(page)).toHaveCount(0);
  m.api.on.ticket = () => ({ status: 404, body: { error: "not_found", code: "E-PAGE-001" } });
  await openVersions(page);
  await expect(alertWith(page, msg("E-PAGE-001"))).toBeVisible();
  await expect(diffOf(page)).toHaveCount(0);
});

test("K449-UI-023 失敗：項目の変更の口が 503：項目の変更の場所に赤い箱（E-PAGE-003）と「もう一度読む」。「もう一度読む」で差分が出る。本文の側は使える", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  m.nextItems = [failed()];
  await pickBtn(page, "項目の変更").click();
  await expect(alertWith(page, msg("E-PAGE-003"))).toBeVisible();
  await expect(diffOf(page)).toHaveCount(0);
  await pickBtn(page, "本文").click();
  await ready(page);
  expect(await lines(page)).toEqual(D23);
  await pickBtn(page, "項目の変更").click();
  await expect(diffOf(page)).toBeVisible();
  expect(m.itemLists).toHaveLength(2);
});

// ---------------------------------------------------------------- 画面

test("K449-UI-024 画面：幅 375・768・1440 のはみ出しが 0（本文・項目の変更とも）。幅 375 は版の一覧を出さず（比べる元・先の選びだけ）、768・1440 は版の一覧が出る。戻す・コピー・比べる物が画面の中", async ({
  page,
}) => {
  await mockVersions(page);
  for (const w of WIDTHS) {
    for (const of of ["", "?of=items"]) {
      await openVersions(page, of, w);
      await expect(fromBox(page)).toBeVisible();
      expect(await overflowX(page), `幅 ${w}${of}`).toBe(0);
      if (w === 375) await expect(sideOf(page).locator("ol")).toBeHidden();
      else await expect(sideOf(page).locator("ol")).toBeVisible();
      for (const b of [pickBtn(page, "本文"), pickBtn(page, "項目の変更"), copyBtn(page)]) {
        const box = await b.boundingBox();
        expect(box, `幅 ${w}${of}：画面の外`).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(w);
      }
    }
  }
});

test("K449-UI-025 画面：キーボードだけで、比べる物（本文・項目の変更）→ 比べる元 → 比べる先 → 戻す → コピーの順に回る。項目の変更で Enter を押すと切り替わり、焦点はそのボタンに残る", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  await pickBtn(page, "本文").focus();
  for (const next of [
    pickBtn(page, "項目の変更"),
    fromBox(page),
    toBox(page),
    restoreBtn(page, "本文", 2),
    copyBtn(page),
  ]) {
    await page.keyboard.press("Tab");
    await expect(next).toBeFocused();
  }
  const items = pickBtn(page, "項目の変更");
  await items.focus();
  await page.keyboard.press("Enter");
  await expect(items).toHaveAttribute("aria-pressed", "true");
  await expect(items).toBeFocused();
  await expect.poll(() => m.itemLists.length).toBe(1);
  expect(m.restores).toHaveLength(0);
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
const V_PAIRS: FidelityPair[] = [
  pair("back", ".k-f4d-back", [...TXT, "x", "texts"]),
  pair("h1", ".k-f4d-vhead h1", [...TXT, "x", "texts"]),
  pair("vticket", ".k-f4d-vticket", [...TXT, "x"]),
  pair("pick", ".k-f4d-pick button", [...CTL, "texts"]),
  pair("vlist-item", ".k-f4d-vlist li", ["width", "height", "x", "border-top-color", "background-color"]),
  pair("vlist-small", ".k-f4d-vlist small", ["font-size", "color"]),
  pair("select", ".k-f4d-items .k-select-trigger", ["width", "height", "x", "font-size", "border-top-color"]),
  pair("diff", ".k-f4d-diff", ["x", "width", "border-top-color", "border-top-left-radius"]),
  pair("add", '.k-f4d-diff li[data-kind="add"]', ["x", "width", "height", "font-size", "color", "background-color"]),
  pair("del", '.k-f4d-diff li[data-kind="del"]', ["x", "width", "height", "font-size", "color", "background-color"]),
  pair("acts", ".k-f4d-ver-acts .k-btn", [...CTL, "texts"]),
  pair("hint", ".k-f4d-hint", [...TXT, "texts"]),
];
for (const [rid, id, query] of [
  ["K449-UI-026", "f4v2-versions", ""],
  ["K449-UI-027", "f4v2-versions-items", "?of=items"],
] as const) {
  test(`${rid} 画面：下絵との突き合わせ（${id}）：幅 375・768・1440 で頭・比べる物・版の一覧・選び・差分（追加・削除の色と幅）・戻す／コピー・注が下絵と同じ（字と位置は番号・題名・説明の違う所を除く）`, async ({
    browser,
  }) => {
    for (const w of MATCH_WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockVersions(page);
          await openVersions(page, query, w);
          await expect(diffOf(page)).toBeVisible();
        },
        { base: "/dev/mock/f4v2", pairs: V_PAIRS, blur: true },
      );
      expect(rows.length, `${id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    }
  });
}

// ---------------------------------------------------------------- 口の数・守り

test("K449-UI-028 守り：開くだけでは getTicket 1 本・版の一覧 1 本・項目の変更 0 本。項目の変更を開いてはじめて項目の変更の口が 1 本。戻す以外の書く口（POST・PATCH・PUT・DELETE）は 0 本で、本人の Bridge（38617）に飛ばない", async ({
  page,
}) => {
  const bridge: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("127.0.0.1:38617")) bridge.push(r.url());
  });
  const m = await mockVersions(page);
  await openVersions(page);
  await ready(page);
  expect([m.ticketReads, m.lists.length, m.itemLists.length]).toEqual([1, 1, 0]);
  await pickBtn(page, "項目の変更").click();
  await expect(diffOf(page)).toBeVisible();
  expect([m.ticketReads, m.lists.length, m.itemLists.length]).toEqual([1, 1, 1]);
  expect(m.restores).toHaveLength(0);
  expect(m.otherWrites).toEqual([]);
  expect(bridge).toEqual([]);
});

test("K449-UI-029 入口：URL に比べ方を持つ。?of=items&from=1&to=3 を直に開く（再読み込み・別の端末）と「項目の変更」が選ばれ、口に from=1・to=3 が付き、差分は版 1 → 版 3。再読み込みしても同じ", async ({
  page,
}) => {
  const m = await mockVersions(page);
  await openVersions(page, "?of=items&from=1&to=3");
  await expect(page.getByText("項目の変更：版 1 → 版 3", { exact: true })).toBeVisible();
  await expect(pickBtn(page, "項目の変更")).toHaveAttribute("aria-pressed", "true");
  expect(m.itemLists[0]!.get("from")).toBe("1");
  expect(m.itemLists[0]!.get("to")).toBe("3");
  expect((await lines(page)).slice(0, 2)).toEqual(["add:予定時間：2 時間", "del:期限：11/27（金）"]);
  await page.reload();
  await expect(page.getByText("項目の変更：版 1 → 版 3", { exact: true })).toBeVisible();
  expect(m.lists).toHaveLength(0);
});
