// K-1153「画面：詳細の右のパネルの項目（下絵 detail-views.tsx の ItemsPanel の形：区の見出し＋dl の行・会社の項目の値の見せ方・
//   値の字を押してその場で直す・1 項目ずつ保存・断りの出し分け）」の試験（K-569 から 2026-11-24 に分けた・PM の決め）
//   （実 Chrome・口は網の手前で差し替え：tests/k/items-mock.ts・実装より先に積む）。開く場所は開発用の頁 /dev/f4-items/detail
//   （詳細の面は K-571 がこの部品を組む。この葉は部品の動きを見る）。モックとの突き合わせは /dev/mock/f4v2 の 2 つの状態
//   （detail-item-edit・detail-item-error）。正の絵は K-431 の版（絵は書き換えない）。
//   見ること：直した値は画面だけでなく、頁を読み直した答えにも出る（作った答えだけで合格にしない）。断りは口の番号と正本の文のまま。
//   画面は役の名前で出し分けず、口の答えで出し分ける。固定の待ちは使わない（要素と口の数を待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  MASTER_ALL,
  WIDTHS,
  byName,
  choose,
  conflict,
  failed,
  field,
  forbidden,
  mockFields,
  msg,
  notFound,
  openHost,
  optId,
  overflowX,
  panel,
  toastOf,
  FORBIDDEN_TEXT,
  type FieldApi,
} from "./items-mock";
import { matchMock } from "./stage2-match";

const fid = (name: string, master: FieldApi[] = MASTER_ALL): string => byName(master, name).id;
const ids = { memo: fid("先方の担当者名"), amt: fid("請求額"), due: fid("支払期日"), pj: fid("PJコード") };
const pjF = byName(MASTER_ALL, "PJコード");
const docsF = byName(MASTER_ALL, "送る書類");

/** 区（section・見出し h2） */
const sec = (page: Page, name: string): Locator => panel(page).getByRole("region", { name, exact: true });
/** 1 つの行（dt が名前の .k-detail-field） */
const rowOf = (page: Page, name: string): Locator =>
  panel(page)
    .locator(".k-detail-field")
    .filter({ has: page.locator("dt", { hasText: new RegExp(`^${name}$`) }) });
const valBtn = (page: Page, name: string): Locator =>
  panel(page).getByRole("button", { name: `${name}を直す`, exact: true });
// 必須の項目の見出しは「支払期日*」（印 * は読み上げない）。getByLabel の exact は印を含む字で比べて当たらないので、印のある・無いの両方に当てる
const box = (page: Page, name: string): Locator => panel(page).getByLabel(new RegExp(`^${name}\\*?$`));
const check = (page: Page, label: string): Locator => panel(page).getByRole("checkbox", { name: label, exact: true });
/** 区の中の行の名前の並び */
const namesIn = async (page: Page, s: string): Promise<string[]> =>
  (await sec(page, s).locator(".k-detail-field > dt").allTextContents()).map((t) => t.trim());
/** 値の字を押して入力に替え、字を入れて Enter で決める（文字・数・日付） */
async function edit(page: Page, name: string, text: string): Promise<void> {
  await valBtn(page, name).click();
  const input = box(page, name);
  await input.fill(text);
  await input.press("Enter");
}
const detail = (page: Page, o: { width?: number; slots?: string } = {}): Promise<void> =>
  openHost(page, { mode: "detail", ...(o.width ? { width: o.width } : {}) }).then(async () => {
    if (o.slots) {
      await page.goto(`${page.url()}&slots=${o.slots}`);
      await expect(panel(page)).toBeVisible();
    }
  });

test("K1153-UI-001 パネルの並び：区「担当」（担当者・承認する人・優先度）・「日付と時間」（開始日・期限・予定時間・日付の会社の項目）・「関連」（節目・親・日付でない会社の項目）・「確認項目」が見出し h2 つきで順に並び、状態・実績時間の行は無い", async ({
  page,
}) => {
  await mockFields(page);
  await detail(page);
  await expect(panel(page).locator("section > h2")).toHaveText(["担当", "日付と時間", "関連", "確認項目"]);
  expect(await namesIn(page, "担当")).toEqual(["担当者", "承認する人", "優先度"]);
  expect(await namesIn(page, "日付と時間")).toEqual(["開始日", "期限", "予定時間", "支払期日"]);
  expect(await namesIn(page, "関連")).toEqual([
    "節目",
    "親",
    "PJコード",
    "請求額",
    "先方の担当者名",
    "分類",
    "送る書類",
    "原本の郵送",
    "社内メモ",
  ]);
  await expect(panel(page).locator("dt", { hasText: /^(状態|実績時間)$/ })).toHaveCount(0);
});

test("K1153-UI-002 値の見せ方：日付「12/15（火）」（1 桁の日は 0 で埋めて「12/01（火）」）・数は 3 桁区切り（「95,000」・小数と負の数は「-1,234.5」）・選ぶ型は選択肢の名前・複数選ぶは選択肢の並びで「請求書、明細」・今の選択肢に無い id は出さない・チェックは箱が付き・値の無い項目は空白", async ({
  page,
}) => {
  const diff = field(10, "差額", "number");
  const day = field(9, "納品日", "date");
  const cls = byName(MASTER_ALL, "分類");
  await mockFields(page, {
    detail: [...MASTER_ALL, diff, day],
    values: {
      [day.id]: "2026-12-01",
      [ids.due]: "2026-12-15",
      [ids.pj]: optId(pjF, "SK-2026-11 セイコー商事 保守"),
      [ids.amt]: 95000,
      [docsF.id]: [optId(docsF, "明細"), "7f000000-0000-4000-9999-000000000099", optId(docsF, "請求書")],
      [fid("原本の郵送")]: true,
      [diff.id]: -1234.5,
      [cls.id]: "7f000000-0000-4000-9999-000000000098",
    },
  });
  await detail(page);
  await expect(valBtn(page, "支払期日")).toHaveText("12/15（火）");
  await expect(valBtn(page, "納品日")).toHaveText("12/01（火）");
  await expect(valBtn(page, "PJコード")).toHaveText("SK-2026-11 セイコー商事 保守");
  await expect(valBtn(page, "請求額")).toHaveText("95,000");
  await expect(valBtn(page, "差額")).toHaveText("-1,234.5");
  await expect(valBtn(page, "送る書類")).toHaveText("請求書、明細");
  await expect(valBtn(page, "分類")).toHaveText("");
  await expect(check(page, "原本を郵送する")).toBeChecked();
  await expect(valBtn(page, "社内メモ")).toHaveText("");
});

test("K1153-UI-003 会社の項目が 0 件（getTicket の fields が空）：会社の項目の行が出ず、用意してある項目の行と確認項目の区は出て、赤い箱は出ない", async ({
  page,
}) => {
  await mockFields(page, { detail: [] });
  await detail(page);
  expect(await namesIn(page, "日付と時間")).toEqual(["開始日", "期限", "予定時間"]);
  expect(await namesIn(page, "関連")).toEqual(["節目", "親"]);
  await expect(sec(page, "確認項目")).toBeVisible();
  await expect(panel(page).getByRole("alert")).toHaveCount(0);
});

test("K1153-UI-004 値を直す（文字・数・日付・選ぶ・複数選ぶの 5 型）：決めると口が 1 回（体は fields にその 1 項目だけ・型ごとの形）・画面の字が替わり・頁を読み直しても同じ", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  await edit(page, "先方の担当者名", " 山田商事 ");
  await expect.poll(() => m.patches.length).toBe(1);
  expect(m.patches[0]).toEqual({ fields: { [ids.memo]: "山田商事" } });
  await edit(page, "請求額", "1200");
  await expect.poll(() => m.patches.length).toBe(2);
  expect(m.patches[1]).toEqual({ fields: { [ids.amt]: 1200 } });
  await edit(page, "支払期日", "2026-12-20");
  await expect.poll(() => m.patches.length).toBe(3);
  expect(m.patches[2]).toEqual({ fields: { [ids.due]: "2026-12-20" } });
  await valBtn(page, "PJコード").click();
  await choose(panel(page), page, "PJコード", "SK-2026-12 セイコー商事 追加開発");
  await expect.poll(() => m.patches.length).toBe(4);
  expect(m.patches[3]).toEqual({ fields: { [ids.pj]: optId(pjF, "SK-2026-12 セイコー商事 追加開発") } });
  await valBtn(page, "送る書類").click();
  const g = panel(page).getByRole("group", { name: "送る書類", exact: true });
  await g.getByRole("checkbox", { name: "納品書", exact: true }).check();
  await g.getByRole("checkbox", { name: "請求書", exact: true }).check();
  await panel(page).getByRole("button", { name: "送る書類を決める", exact: true }).click();
  await expect.poll(() => m.patches.length).toBe(5);
  expect(m.patches[4]).toEqual({ fields: { [docsF.id]: [optId(docsF, "請求書"), optId(docsF, "納品書")] } });
  await expect(valBtn(page, "請求額")).toHaveText("1,200");
  await page.reload();
  await expect(valBtn(page, "先方の担当者名")).toHaveText("山田商事");
  await expect(valBtn(page, "請求額")).toHaveText("1,200");
  await expect(valBtn(page, "支払期日")).toHaveText("12/20（日）");
  await expect(valBtn(page, "PJコード")).toHaveText("SK-2026-12 セイコー商事 追加開発");
  await expect(valBtn(page, "送る書類")).toHaveText("請求書、納品書");
});

test("K1153-UI-005 チェックの型：箱を押すとその場で決まり、付けると true・必須でない箱を外すと false が届き（null でない）・読み直しても同じ", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  await check(page, "原本を郵送する").check();
  await expect.poll(() => m.patches.length).toBe(1);
  expect(m.patches[0]).toEqual({ fields: { [fid("原本の郵送")]: true } });
  await check(page, "原本を郵送する").uncheck();
  await expect.poll(() => m.patches.length).toBe(2);
  expect(m.patches[1]).toEqual({ fields: { [fid("原本の郵送")]: false } });
  await page.reload();
  await expect(check(page, "原本を郵送する")).not.toBeChecked();
});

test("K1153-UI-006 空にする（必須でない数・日付・文字・選ぶ・複数選ぶ）：数・日付は空、文字は空白だけ、選ぶは「選ばない」、複数選ぶは全部外して決めると、体の値が null・画面の値は空白・読み直しても空", async ({
  page,
}) => {
  const day = field(9, "納品日", "date");
  const cls = byName(MASTER_ALL, "分類");
  const m = await mockFields(page, {
    detail: [...MASTER_ALL, day],
    values: {
      [ids.amt]: 5,
      [ids.memo]: "あ",
      [day.id]: "2026-12-01",
      [cls.id]: optId(cls, "請求"),
      [docsF.id]: [optId(docsF, "明細")],
    },
  });
  await detail(page);
  await edit(page, "請求額", "");
  await expect.poll(() => m.patches.length).toBe(1);
  expect(m.patches[0]).toEqual({ fields: { [ids.amt]: null } });
  await edit(page, "納品日", "");
  await expect.poll(() => m.patches.length).toBe(2);
  expect(m.patches[1]).toEqual({ fields: { [day.id]: null } });
  await edit(page, "先方の担当者名", "　 ");
  await expect.poll(() => m.patches.length).toBe(3);
  expect(m.patches[2]).toEqual({ fields: { [ids.memo]: null } });
  await valBtn(page, "分類").click();
  await choose(panel(page), page, "分類", "選ばない");
  await expect.poll(() => m.patches.length).toBe(4);
  expect(m.patches[3]).toEqual({ fields: { [cls.id]: null } });
  await valBtn(page, "送る書類").click();
  await panel(page)
    .getByRole("group", { name: "送る書類", exact: true })
    .getByRole("checkbox", { name: "明細", exact: true })
    .uncheck();
  await panel(page).getByRole("button", { name: "送る書類を決める", exact: true }).click();
  await expect.poll(() => m.patches.length).toBe(5);
  expect(m.patches[4]).toEqual({ fields: { [docsF.id]: null } });
  await page.reload();
  for (const n of ["請求額", "納品日", "先方の担当者名", "分類", "送る書類"])
    await expect(valBtn(page, n)).toHaveText("");
});

test("K1153-UI-007 必須の項目を空にして決める（日付・1 つ選ぶ・複数選ぶ・チェック）：口を呼ばず欄の下に型ごとの言い方が出て、入力は開いたまま元の値は変わらず、必須のチェックは外せず付いたまま", async ({
  page,
}) => {
  const need = [
    byName(MASTER_ALL, "支払期日"),
    pjF,
    field(31, "書類", "multi_select", { required: true, options: docsF.options }),
    field(32, "確認済み", "check", { required: true }),
  ];
  const m = await mockFields(page, {
    detail: need,
    values: {
      [ids.due]: "2026-12-15",
      [ids.pj]: optId(pjF, "SK-2026-11 セイコー商事 保守"),
      [need[2]!.id]: [docsF.options[0]!.id],
      [need[3]!.id]: true,
    },
  });
  await detail(page);
  await edit(page, "支払期日", "");
  await expect(rowOf(page, "支払期日").locator(".k-err")).toHaveText("支払期日を選んでください");
  await expect(box(page, "支払期日")).toBeVisible();
  await valBtn(page, "PJコード").click();
  await panel(page).getByRole("combobox", { name: "PJコード", exact: true }).click();
  // 選んである選択肢には印 ✓ が中に出る（Base UI の ItemIndicator）ので、字は終わりで見る
  await expect(page.getByRole("option")).toHaveText([
    /SK-2026-11 セイコー商事 保守$/,
    /SK-2026-12 セイコー商事 追加開発$/,
  ]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
  await panel(page).getByRole("combobox", { name: "PJコード", exact: true }).press("Escape");
  await expect(valBtn(page, "PJコード")).toBeVisible();
  await valBtn(page, "書類").click();
  await panel(page)
    .getByRole("group", { name: "書類", exact: true })
    .getByRole("checkbox", { name: "請求書", exact: true })
    .uncheck();
  await panel(page).getByRole("button", { name: "書類を決める", exact: true }).click();
  await expect(rowOf(page, "書類").locator(".k-err")).toHaveText("書類を選んでください");
  await check(page, "確認済み").click();
  await expect(rowOf(page, "確認済み").locator(".k-err")).toHaveText("確認済みにチェックを付けてください");
  await expect(check(page, "確認済み")).toBeChecked();
  expect(m.patches).toEqual([]);
  await page.reload();
  await expect(valBtn(page, "支払期日")).toHaveText("12/15（火）");
  await edit(page, "支払期日", "2026-12-16");
  await expect.poll(() => m.patches.length).toBe(1);
  await expect(valBtn(page, "支払期日")).toHaveText("12/16（水）");
});

test("K1153-UI-008 数の字：「abc」は口を呼ばず欄の下に「請求額は数で入れてください」・全角とカンマの「１,２００」は 1200 で届く", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  await edit(page, "請求額", "abc");
  await expect(rowOf(page, "請求額").locator(".k-err")).toHaveText("請求額は数で入れてください");
  expect(m.patches).toEqual([]);
  await box(page, "請求額").fill("１,２００");
  await box(page, "請求額").press("Enter");
  await expect.poll(() => m.patches.length).toBe(1);
  expect(m.patches[0]).toEqual({ fields: { [ids.amt]: 1200 } });
});

test("K1153-UI-009 値を変えずに決める：口を呼ばずに入力が閉じ、元の値の字に戻る", async ({ page }) => {
  const m = await mockFields(page, { values: { [ids.memo]: "元" } });
  await detail(page);
  await edit(page, "先方の担当者名", "元");
  await expect(box(page, "先方の担当者名")).toHaveCount(0);
  await expect(valBtn(page, "先方の担当者名")).toHaveText("元");
  expect(m.patches).toEqual([]);
});

test("K1153-UI-010 口が 409（E-FLD-001・002・003・004）：どれもその行の欄の下に正本の文（答えの体は { error, code } だけ）がそのまま出て、入力は開いたまま入れた値が残り、もう一度決めて通ると赤い字が消える・チェックの箱は元に戻り箱の下に文", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  let n = 0;
  for (const code of ["E-FLD-001", "E-FLD-002", "E-FLD-003", "E-FLD-004"]) {
    n += 1;
    m.next = [conflict(code)];
    await edit(page, "先方の担当者名", `x${n}`);
    await expect.poll(() => m.patches.length).toBe(n * 2 - 1);
    await expect(rowOf(page, "先方の担当者名").locator(".k-err")).toHaveText(msg(code));
    await expect(box(page, "先方の担当者名")).toHaveValue(`x${n}`);
    expect(m.values[ids.memo]).toBe(n === 1 ? undefined : `x${n - 1}`);
    await box(page, "先方の担当者名").press("Enter");
    await expect.poll(() => m.patches.length).toBe(n * 2);
    await expect(rowOf(page, "先方の担当者名").locator(".k-err")).toHaveCount(0);
    await expect(valBtn(page, "先方の担当者名")).toHaveText(`x${n}`);
  }
  // チェックの箱：押した時点で付き、409 なら元に戻って箱の下に正本の文（check() は付いたままを求めるので click で押す）
  m.next = [conflict("E-FLD-003")];
  await check(page, "原本を郵送する").click();
  await expect.poll(() => m.patches.length).toBe(9);
  expect(m.patches[8]).toEqual({ fields: { [fid("原本の郵送")]: true } });
  await expect(rowOf(page, "原本の郵送").locator(".k-err")).toHaveText(msg("E-FLD-003"));
  await expect(check(page, "原本を郵送する")).not.toBeChecked();
  await page.reload();
  await expect(valBtn(page, "先方の担当者名")).toHaveText("x4");
});

test("K1153-UI-011 口が 404（E-PAGE-001）：その行の欄の下に正本の文が出て詳細の読み直し（getTicket）が 1 回走り、読み直しの答えに項目が無ければその行は消え、在れば文が欄の下に残り入力は開いたまま", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  expect(m.ticketReads).toBe(1);
  m.next = [notFound()];
  await edit(page, "請求額", "9");
  await expect.poll(() => m.ticketReads).toBe(2);
  await expect(rowOf(page, "請求額").locator(".k-err")).toHaveText(msg("E-PAGE-001"));
  await expect(box(page, "請求額")).toHaveValue("9");
  // 読み直し自体が失敗（getTicket が 503）しても、その行・文・入力の値は今のまま（失敗した読み直しが 1 回走ったことも数える）
  let failedReads = 0;
  await page.route(/\/api\/v1\/tickets\/[^/]+$/, (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    failedReads++;
    return r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "server_error", code: "E-PAGE-003" }),
    });
  });
  m.next = [notFound()];
  await box(page, "請求額").fill("10");
  await box(page, "請求額").press("Enter");
  await expect.poll(() => m.patches.length).toBe(2);
  await expect.poll(() => failedReads).toBe(1);
  await expect(rowOf(page, "請求額").locator(".k-err")).toHaveText(msg("E-PAGE-001"));
  await expect(box(page, "請求額")).toHaveValue("10");
  await page.unroute(/\/api\/v1\/tickets\/[^/]+$/);
  m.next = [notFound()];
  m.detail = MASTER_ALL.filter((f) => f.name !== "先方の担当者名");
  await edit(page, "先方の担当者名", "x");
  await expect.poll(() => m.ticketReads).toBe(3);
  await expect(rowOf(page, "先方の担当者名")).toHaveCount(0);
  await expect(rowOf(page, "請求額")).toBeVisible();
});

test("K1153-UI-012 口が 403（書けない人）：5 秒で消える小さな知らせ「この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください」・値は元に戻り入力は閉じ・口は 1 回・読み直しても元の値", async ({
  page,
}) => {
  const m = await mockFields(page, { values: { [ids.memo]: "元" } });
  await detail(page);
  m.next = [forbidden()];
  await edit(page, "先方の担当者名", "変えたい");
  await expect(toastOf(page, FORBIDDEN_TEXT)).toBeVisible();
  await expect(box(page, "先方の担当者名")).toHaveCount(0);
  await expect(valBtn(page, "先方の担当者名")).toHaveText("元");
  expect(m.patches).toHaveLength(1);
  await expect(toastOf(page, FORBIDDEN_TEXT)).toBeHidden({ timeout: 9000 });
  await page.reload();
  await expect(valBtn(page, "先方の担当者名")).toHaveText("元");
});

test("K1153-UI-013 口が 503（E-PAGE-003）：5 秒で消える小さな知らせに正本の文が出て入力は開いたまま入れた値が残り、もう一度決めると通って値が替わる（1 回目は反映されていない）", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  m.next = [failed()];
  await edit(page, "先方の担当者名", "あとで");
  await expect(toastOf(page, msg("E-PAGE-003"))).toBeVisible();
  await expect(box(page, "先方の担当者名")).toHaveValue("あとで");
  expect(m.values[ids.memo]).toBeUndefined();
  await expect(toastOf(page, msg("E-PAGE-003"))).toBeHidden({ timeout: 9000 });
  await box(page, "先方の担当者名").press("Enter");
  await expect.poll(() => m.patches.length).toBe(2);
  await expect(valBtn(page, "先方の担当者名")).toHaveText("あとで");
  await page.reload();
  await expect(valBtn(page, "先方の担当者名")).toHaveText("あとで");
});

test("K1153-UI-014 口が 422（契約の形の誤り・欄 fields）：その行の欄の下に E-FLD-003 の正本の文が出て入力は開いたまま", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  m.next = [
    { status: 422, body: { error: "validation_error", code: "VALIDATION_ERROR", fields: { fields: "invalid" } } },
  ];
  await edit(page, "先方の担当者名", "y");
  await expect.poll(() => m.patches.length).toBe(1);
  await expect(rowOf(page, "先方の担当者名").locator(".k-err")).toHaveText(msg("E-FLD-003"));
  await expect(box(page, "先方の担当者名")).toHaveValue("y");
});

test("K1153-UI-015 決めるを二度押し（Enter を続けて 2 回・答えを止めておく）：口は 1 回・送っている間は入力が押せず・答えが来ると 1 つの値になる", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  const release = m.hold();
  await valBtn(page, "先方の担当者名").click();
  await box(page, "先方の担当者名").fill("z");
  // 2 回の Enter を、画面が描き直す前に続けて送る（1 回目で無効になる前に 2 回目が届く）
  await box(page, "先方の担当者名").evaluate((el) => {
    for (let i = 0; i < 2; i++) el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await expect.poll(() => m.patches.length).toBe(1);
  await expect(box(page, "先方の担当者名")).toBeDisabled();
  release();
  await expect(valBtn(page, "先方の担当者名")).toHaveText("z");
  expect(m.patches).toHaveLength(1);
});

test("K1153-UI-016 別の項目を続けて直す・途中でやめる：2 つ続けて直すと口は 2 回で体の鍵はそれぞれ 1 項目だけ・Esc でやめると口は 0 回で元の値が出て打った字は捨てられる", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  await edit(page, "先方の担当者名", "a");
  await expect.poll(() => m.patches.length).toBe(1);
  await edit(page, "請求額", "5");
  await expect.poll(() => m.patches.length).toBe(2);
  expect(m.patches.map((p) => Object.keys(p.fields))).toEqual([[ids.memo], [ids.amt]]);
  await valBtn(page, "社内メモ").click();
  await box(page, "社内メモ").fill("消える");
  await box(page, "社内メモ").press("Escape");
  await expect(valBtn(page, "社内メモ")).toHaveText("");
  expect(m.patches).toHaveLength(2);
  await valBtn(page, "社内メモ").click();
  await expect(box(page, "社内メモ")).toHaveValue("");
});

test("K1153-UI-017 2 つの行を同時に開く（下絵 detail-item-error の形）：支払期日と PJコードを両方開き、それぞれの欄の下に別々の誤りが出て、PJコードを選び直すと口は PJコードの 1 項目だけで 1 回", async ({
  page,
}) => {
  const m = await mockFields(page, {
    values: { [ids.due]: "2026-12-15", [ids.pj]: optId(pjF, "SK-2026-11 セイコー商事 保守") },
  });
  await detail(page);
  await edit(page, "支払期日", "");
  await valBtn(page, "PJコード").click();
  m.next = [conflict("E-FLD-002")];
  await choose(panel(page), page, "PJコード", "SK-2026-12 セイコー商事 追加開発");
  await expect.poll(() => m.patches.length).toBe(1);
  expect(m.patches[0]).toEqual({ fields: { [ids.pj]: optId(pjF, "SK-2026-12 セイコー商事 追加開発") } });
  await expect(rowOf(page, "支払期日").locator(".k-err")).toHaveText("支払期日を選んでください");
  await expect(rowOf(page, "PJコード").locator(".k-err")).toHaveText(msg("E-FLD-002"));
  await expect(box(page, "支払期日")).toBeVisible();
});

test("K1153-UI-018 完了したチケットの値（getTicket の completed が入っている）：会社の項目は直せて（口が 200 を返し画面が替わる）、「完了したので直せません」の押せない形は出ない", async ({
  page,
}) => {
  const m = await mockFields(page, { completed: true });
  await detail(page);
  await expect(valBtn(page, "請求額")).toBeEnabled();
  await edit(page, "請求額", "7");
  await expect.poll(() => m.patches.length).toBe(1);
  await expect(valBtn(page, "請求額")).toHaveText("7");
  await expect(page.getByText(/完了したので/)).toHaveCount(0);
});

test("K1153-UI-019 差し込み口（slots=approver,group の頁）：承認する人の行に渡した字「高本 聖斗」・関連の先頭にグループの行「営業（EG）」が出て、渡さない頁ではグループの行が無い", async ({
  page,
}) => {
  await mockFields(page);
  await detail(page, { slots: "approver,group" });
  await expect(rowOf(page, "承認する人").locator("dd")).toHaveText("高本 聖斗");
  expect((await namesIn(page, "関連")).slice(0, 3)).toEqual(["グループ", "節目", "親"]);
  await expect(rowOf(page, "グループ").locator("dd")).toHaveText("営業（EG）");
  await detail(page);
  await expect(rowOf(page, "グループ")).toHaveCount(0);
});

test("K1153-UI-020 幅ごとのはみ出し：幅 375・768・1440 の詳細（値あり・1 行を開いて誤りが出た形）で scrollWidth - clientWidth が 0", async ({
  page,
}) => {
  const m = await mockFields(page, { values: { [ids.due]: "2026-12-15" } });
  for (const w of WIDTHS) {
    await detail(page, { width: w });
    await edit(page, "支払期日", "");
    await expect(rowOf(page, "支払期日").locator(".k-err")).toBeVisible();
    expect(await overflowX(page), `詳細 幅 ${w}`).toBe(0);
  }
  expect(m.patches).toEqual([]);
});

test("K1153-UI-021 キーボード：値のボタンで Enter を押すと入力に替わってキーボードの場所が入力に移り、Tab で入力から外れても決めず（口は 0 回・入力は開いたまま）、戻って Esc でやめるとボタンに戻る", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  await valBtn(page, "請求額").focus();
  await page.keyboard.press("Enter");
  await expect(box(page, "請求額")).toBeFocused();
  await box(page, "請求額").fill("8");
  await page.keyboard.press("Tab");
  await expect(box(page, "請求額")).not.toBeFocused();
  await expect(box(page, "請求額")).toHaveValue("8");
  expect(m.patches).toEqual([]);
  await box(page, "請求額").focus();
  await page.keyboard.press("Escape");
  await expect(valBtn(page, "請求額")).toBeFocused();
  expect(m.patches).toEqual([]);
});

// ---------------------------------------------------------------- 下絵との突き合わせ（位置は比べない）
const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const CTRL = ["width", "height", "font-size", "border-top-color"];
const EDIT_PAIRS: FidelityPair[] = [
  pair("input", ".k-detail-panel .k-f4d-editcell .k-input", CTRL),
  pair("trigger", ".k-detail-panel .k-f4d-editcell .k-select-trigger", CTRL),
  pair("err", ".k-detail-panel .k-f4d-editcell .k-err", ["font-size", "color", "texts"]),
  pair("val", ".k-detail-panel .k-f4d-valbtn", ["font-size", "color"]),
];
const hits = (rows: { part: string; prop: string; canvas: unknown }[], part: string): number =>
  Number(rows.find((r) => r.part === part && r.prop === "当たった数")?.canvas ?? 0);

test("K1153-UI-022 下絵との突き合わせ（f4v2-detail-item-edit）：幅 375・768・1440 で、請求額をその場で直している入力の幅と高さと枠の色・値の字のボタンの字が下絵と同じ", async ({
  browser,
}) => {
  for (const w of WIDTHS) {
    const { rows, bad } = await matchMock(
      browser,
      "f4v2-detail-item-edit",
      w,
      async (page) => {
        await mockFields(page, {
          detail: [byName(MASTER_ALL, "支払期日"), pjF, byName(MASTER_ALL, "請求額"), byName(MASTER_ALL, "分類")],
          values: {
            [ids.due]: "2026-12-15",
            [ids.pj]: optId(pjF, "SK-2026-11 セイコー商事 保守"),
            [ids.amt]: 95000,
            [fid("分類")]: optId(byName(MASTER_ALL, "分類"), "請求"),
          },
        });
        await detail(page, { width: w });
        await valBtn(page, "請求額").click();
        await expect(box(page, "請求額")).toBeVisible();
      },
      { base: "/dev/mock/f4v2", pairs: EDIT_PAIRS, blur: true },
    );
    for (const part of ["input", "val"])
      expect(hits(rows, part), `幅 ${w}：${part} の的が下絵に 0 個`).toBeGreaterThan(0);
    expect(bad, bad.join("\n")).toEqual([]);
  }
});

test("K1153-UI-023 下絵との突き合わせ（f4v2-detail-item-error）：幅 375・768・1440 で、支払期日を空にして決めた欄と PJコードを選び直して断られた欄の入力・選ぶ欄・欄の下の赤い字 2 つ（字・色・字の大きさ）が下絵と同じ", async ({
  browser,
}) => {
  for (const w of WIDTHS) {
    const { rows, bad } = await matchMock(
      browser,
      "f4v2-detail-item-error",
      w,
      async (page) => {
        const m = await mockFields(page, {
          detail: [byName(MASTER_ALL, "支払期日"), pjF, byName(MASTER_ALL, "請求額"), byName(MASTER_ALL, "分類")],
          values: {
            [ids.due]: "2026-12-15",
            [ids.pj]: optId(pjF, "SK-2026-11 セイコー商事 保守"),
            [ids.amt]: 95000,
            [fid("分類")]: optId(byName(MASTER_ALL, "分類"), "請求"),
          },
        });
        await detail(page, { width: w });
        await edit(page, "支払期日", "");
        await valBtn(page, "PJコード").click();
        m.next = [conflict("E-FLD-002")];
        await choose(panel(page), page, "PJコード", "SK-2026-12 セイコー商事 追加開発");
        await expect(rowOf(page, "PJコード").locator(".k-err")).toHaveText(msg("E-FLD-002"));
      },
      { base: "/dev/mock/f4v2", pairs: EDIT_PAIRS, blur: true },
    );
    for (const part of ["input", "trigger", "err"])
      expect(hits(rows, part), `幅 ${w}：${part} の的が下絵に 0 個`).toBeGreaterThan(0);
    expect(bad, bad.join("\n")).toEqual([]);
  }
});

test("K1153-UI-024 口の数：詳細は getTicket の 1 本のまま（listTicketFields・種別の口を呼ばない）・直すときの PATCH 以外に書く口が無く・本人の Bridge（38617）に飛ばない", async ({
  page,
}) => {
  const bridge: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("127.0.0.1:38617")) bridge.push(r.url());
  });
  const m = await mockFields(page);
  await detail(page);
  await expect(valBtn(page, "請求額")).toBeVisible();
  expect(m.reads).toEqual([]);
  expect(m.kindReads).toBe(0);
  expect(m.ticketReads).toBe(1);
  await edit(page, "請求額", "3");
  await expect.poll(() => m.patches.length).toBe(1);
  expect(m.ticketReads).toBe(1);
  expect(m.writes).toEqual([]);
  expect(bridge).toEqual([]);
});

test("K1153-UI-025 長い文章（社内メモ）：Enter は改行で口を呼ばず、「社内メモを決める」で改行ごと 1 回届き、読み直しても同じ字", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page);
  await valBtn(page, "社内メモ").click();
  await box(page, "社内メモ").fill("一行目");
  await box(page, "社内メモ").press("Enter");
  await box(page, "社内メモ").pressSequentially("二行目");
  expect(m.patches).toEqual([]);
  await panel(page).getByRole("button", { name: "社内メモを決める", exact: true }).click();
  await expect.poll(() => m.patches.length).toBe(1);
  expect(m.patches[0]).toEqual({ fields: { [fid("社内メモ")]: "一行目\n二行目" } });
  await page.reload();
  await expect(valBtn(page, "社内メモ")).toHaveText("一行目\n二行目", { useInnerText: false });
});

test("K1153-UI-026 差し込み口（slots=actual の頁）：日付と時間の区で予定時間の次に実績時間の行が出て渡した字「2 時間 30 分」、渡さない頁では実績時間の行が無い", async ({
  page,
}) => {
  await mockFields(page);
  await detail(page, { slots: "actual" });
  expect(await namesIn(page, "日付と時間")).toEqual(["開始日", "期限", "予定時間", "実績時間", "支払期日"]);
  await expect(rowOf(page, "実績時間").locator("dd")).toHaveText("2 時間 30 分");
  await detail(page);
  await expect(rowOf(page, "実績時間")).toHaveCount(0);
});
