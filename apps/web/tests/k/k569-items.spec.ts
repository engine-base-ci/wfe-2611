// K-569「項目の表（作る面の 2 列の表と詳細の右のパネル「項目」：用意してある項目と会社が足した項目 7 つの型を同じ並びで・必須・説明・
//   誤りの出し方・種別を変えると入れ替わる・詳細で値を直す）」の試験
//   （実 Chrome・口は網の手前で差し替え：tests/k/items-mock.ts・実装より先に積む）。開く場所は開発用の頁 /dev/f4-items（作る面と詳細は
//   K-442・K-571 がこの部品を組む。この葉は部品の動きを見る）。モックとの突き合わせは /dev/mock/f4v2 の 5 つの状態（create-custom・create-missing・create-missing-types・detail-item-edit・detail-item-error）。
//   見ること：直した値は画面だけでなく、頁を読み直した答えにも出る（作った答えだけで合格にしない）。断りは口の番号と正本の文のまま。
//   画面は役の名前で出し分けず、口の答えで出し分ける。固定の待ちは使わない（要素と口の数を待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  KIND_A,
  KIND_B,
  MASTER_3,
  MASTER_ALL,
  MASTER_B,
  MASTER_REQ7,
  WIDTHS,
  byName,
  choose,
  conflict,
  failed,
  field,
  forbidden,
  grid,
  mockFields,
  msg,
  notFound,
  openHost,
  optId,
  overflowX,
  pairOf,
  sentFields,
  toastOf,
  FORBIDDEN_TEXT,
  type FieldApi,
  type FieldsMock,
} from "./items-mock";
import { matchMock } from "./stage2-match";

const CORE = ["状態", "担当者", "優先度", "節目", "開始日", "期限", "予定時間", "実績時間", "親"];
const CUSTOM = MASTER_ALL.map((f) => f.name);
const clean = (t: string): string => t.replace(/[＊\s]/g, "");
const namesOf = async (page: Page): Promise<string[]> =>
  (await grid(page).locator(".k-f4d-name").allTextContents()).map(clean);
const make = (page: Page) => page.getByRole("button", { name: "作る", exact: true });
const box = (page: Page, name: string) => grid(page).getByLabel(name, { exact: true });
const editBtn = (page: Page, name: string) => grid(page).getByRole("button", { name: `${name}を直す`, exact: true });
const fid = (name: string, master: FieldApi[] = MASTER_ALL): string => byName(master, name).id;
const ids = { memo: fid("先方の担当者名"), amt: fid("請求額"), due: fid("支払期日") };
/** 値の字を押して入力に替え、字を入れて Enter で決める（文字・数・日付） */
async function edit(page: Page, name: string, text: string): Promise<void> {
  await editBtn(page, name).click();
  const input = box(page, name);
  await input.fill(text);
  await input.press("Enter");
}
const detail = (page: Page, _m: FieldsMock): Promise<void> => openHost(page, { mode: "detail" });

test("K569-UI-001 作る面の表の並び：名前「項目」のグループの中に、用意してある項目（状態・担当者・優先度・節目・開始日・期限・予定時間・実績時間・親）の後ろへ会社の 8 つがマスタの並びで続き、見出しで分かれず、どの行も同じ組の形", async ({
  page,
}) => {
  await mockFields(page);
  await openHost(page, { mode: "create" });
  await expect(grid(page).getByLabel("社内メモ", { exact: true })).toBeVisible();
  expect((await namesOf(page)).slice(0, 17)).toEqual([...CORE, ...CUSTOM]);
  await expect(grid(page).locator("h2, h3")).toHaveCount(0);
  for (const n of [...CORE, ...CUSTOM]) {
    await expect(pairOf(page, n)).toHaveCount(1);
    await expect(pairOf(page, n).locator(".k-f4d-cell")).toHaveCount(1);
  }
});

test("K569-UI-002 必須の印と説明：必須の会社の項目（支払期日・PJコード）と担当者・期限に「＊」・優先度・開始日・予定時間・親・請求額には無い。説明は入力の下に 1 文", async ({
  page,
}) => {
  await mockFields(page);
  await openHost(page, { mode: "create" });
  for (const n of ["担当者", "期限", "支払期日", "PJコード"])
    await expect(pairOf(page, n).locator(".k-f4d-req-mark")).toHaveCount(1);
  for (const n of ["優先度", "開始日", "予定時間", "親", "請求額", "先方の担当者名"])
    await expect(pairOf(page, n).locator(".k-f4d-req-mark")).toHaveCount(0);
  await expect(pairOf(page, "支払期日")).toContainText("請求書に書く支払の期日");
  await expect(pairOf(page, "PJコード")).toContainText("案件ごとのコードを選びます");
  await expect(pairOf(page, "請求額")).toContainText("税込の金額（円）");
});

test("K569-UI-003 型 7 つの入力：名前で探せる入力が 7 つ（textbox・複数行の textbox・数字の textbox・日付の欄・選ぶ欄・チェックの並びのグループ・チェックの箱）で、選択肢は答えの並び", async ({
  page,
}) => {
  await mockFields(page);
  await openHost(page, { mode: "create" });
  await expect(grid(page).getByRole("textbox", { name: "先方の担当者名", exact: true })).toBeVisible();
  const memo = grid(page).getByRole("textbox", { name: "社内メモ", exact: true });
  expect(await memo.evaluate((e) => e.tagName)).toBe("TEXTAREA");
  await expect(grid(page).getByRole("textbox", { name: "請求額", exact: true })).toHaveAttribute(
    "inputmode",
    "numeric",
  );
  await expect(box(page, "支払期日")).toHaveAttribute("type", "date");
  await grid(page).getByRole("combobox", { name: "PJコード", exact: true }).click();
  await expect(page.getByRole("option")).toHaveText([
    "SK-2026-11 セイコー商事 保守",
    "SK-2026-12 セイコー商事 追加開発",
  ]);
  await page.keyboard.press("Escape");
  const docs = grid(page).getByRole("group", { name: "送る書類", exact: true });
  await expect(docs.getByRole("checkbox")).toHaveCount(3);
  for (const n of ["請求書", "明細", "納品書"])
    await expect(docs.getByRole("checkbox", { name: n, exact: true })).toBeVisible();
  await expect(grid(page).getByRole("checkbox", { name: "原本の郵送", exact: true })).toBeVisible();
});

test("K569-UI-004 7 つに値を入れて「作る」：送る値の fields が型ごとの形（空白を落とした文字・文字・数（0 も 0）・YYYY-MM-DD・選択肢の id・選択肢の並びの id の並び・true）で、入れなかった分類は鍵ごと無い", async ({
  page,
}) => {
  await mockFields(page);
  await openHost(page, { mode: "create" });
  await box(page, "先方の担当者名").fill("  山田商事  ");
  await box(page, "社内メモ").fill("急ぎではない");
  await box(page, "請求額").fill("0");
  await box(page, "支払期日").fill("2026-12-15");
  await choose(grid(page), page, "PJコード", "SK-2026-12 セイコー商事 追加開発");
  const docs = grid(page).getByRole("group", { name: "送る書類", exact: true });
  await docs.getByRole("checkbox", { name: "納品書", exact: true }).check();
  await docs.getByRole("checkbox", { name: "請求書", exact: true }).check();
  await box(page, "原本の郵送").check();
  await make(page).click();
  await expect.poll(() => sentFields(page)).not.toBeNull();
  const f = byName(MASTER_ALL, "送る書類");
  expect(await sentFields(page)).toEqual({
    [fid("先方の担当者名")]: "山田商事",
    [fid("社内メモ")]: "急ぎではない",
    [fid("請求額")]: 0,
    [fid("支払期日")]: "2026-12-15",
    [fid("PJコード")]: optId(byName(MASTER_ALL, "PJコード"), "SK-2026-12 セイコー商事 追加開発"),
    [f.id]: [optId(f, "請求書"), optId(f, "納品書")],
    [fid("原本の郵送")]: true,
  });
});

test("K569-UI-005 必須が空で「作る」：支払期日「支払期日を選んでください」・PJコード「PJコードを選んでください」が欄の下に出て、送る値は出ず、最初の誤りの欄にキーボードの場所があり、値を入れるとその欄の赤い字が消える", async ({
  page,
}) => {
  const m = await mockFields(page);
  await openHost(page, { mode: "create" });
  await make(page).click();
  await expect(pairOf(page, "支払期日")).toContainText("支払期日を選んでください");
  await expect(pairOf(page, "PJコード")).toContainText("PJコードを選んでください");
  await expect(box(page, "支払期日")).toBeFocused();
  expect(await sentFields(page)).toBeNull();
  expect(m.writes).toEqual([]);
  await box(page, "支払期日").fill("2026-12-01");
  await expect(pairOf(page, "支払期日")).not.toContainText("支払期日を選んでください");
  await expect(pairOf(page, "PJコード")).toContainText("PJコードを選んでください");
});

test("K569-UI-006 必須の型ごとの言い方：7 つの型が全部必須のマスタで、空のまま「作る」と 文字（短い・長い）＝「〜を書いてください」・数＝「〜を入れてください」・日付・1 つ選ぶ・複数選ぶ＝「〜を選んでください」・チェック＝「〜にチェックを付けてください」が欄の下に 7 つ出る", async ({
  page,
}) => {
  await mockFields(page, { masters: { [KIND_A]: MASTER_REQ7 } });
  await openHost(page, { mode: "create" });
  await make(page).click();
  const want: [string, string][] = [
    ["メモ", "メモを書いてください"],
    ["詳しい説明", "詳しい説明を書いてください"],
    ["件数", "件数を入れてください"],
    ["納品日", "納品日を選んでください"],
    ["区分", "区分を選んでください"],
    ["書類", "書類を選んでください"],
    ["確認済み", "確認済みにチェックを付けてください"],
  ];
  for (const [n, t] of want) await expect(pairOf(page, n)).toContainText(t);
  expect(await sentFields(page)).toBeNull();
});

test("K569-UI-007 空と 0 とチェックの false：必須の数の 0 は通る・必須のチェックは付けて外すと止まる・必須の文字は空白だけ（全角の空白・タブ）で止まる・必須でない数の欄の「abc」は「請求額は数で入れてください」で止まる", async ({
  page,
}) => {
  const master = [
    byName(MASTER_REQ7, "件数"),
    byName(MASTER_REQ7, "確認済み"),
    byName(MASTER_REQ7, "メモ"),
    byName(MASTER_ALL, "請求額"),
  ];
  await mockFields(page, { masters: { [KIND_A]: master } });
  await openHost(page, { mode: "create" });
  await box(page, "件数").fill("0");
  await box(page, "メモ").fill("　\t　");
  await box(page, "確認済み").check();
  await box(page, "確認済み").uncheck();
  await box(page, "請求額").fill("abc");
  await make(page).click();
  await expect(pairOf(page, "メモ")).toContainText("メモを書いてください");
  await expect(pairOf(page, "確認済み")).toContainText("確認済みにチェックを付けてください");
  await expect(pairOf(page, "請求額")).toContainText("請求額は数で入れてください");
  await expect(pairOf(page, "件数")).not.toContainText("入れてください");
  expect(await sentFields(page)).toBeNull();
  await box(page, "メモ").fill("あ");
  await box(page, "確認済み").check();
  await box(page, "請求額").fill("");
  await make(page).click();
  await expect.poll(() => sentFields(page)).not.toBeNull();
  expect(await sentFields(page)).toEqual({
    [byName(MASTER_REQ7, "件数").id]: 0,
    [byName(MASTER_REQ7, "メモ").id]: "あ",
    [byName(MASTER_REQ7, "確認済み").id]: true,
  });
});

test("K569-UI-008 種別を変える：行が入れ替わるが口は増えず（会社の項目のマスタは種別の口の答えの各種別の fields から読み、listTicketFields は呼ばない）・A に戻すと入れた値が残り・B のとき「作る」の送る値に A だけの項目の鍵は無い", async ({
  page,
}) => {
  const m = await mockFields(page, { masters: { [KIND_A]: MASTER_3, [KIND_B]: MASTER_B } });
  await openHost(page, { mode: "create" });
  await expect(pairOf(page, "請求額")).toBeVisible();
  expect(m.reads, "listTicketFields は呼ばない").toEqual([]);
  expect(m.kindReads).toBe(1);
  await box(page, "支払期日").fill("2026-12-01");
  await box(page, "請求額").fill("100");
  await choose(page.locator("body"), page, "種別", "課題");
  await expect(pairOf(page, "問い合わせ元")).toBeVisible();
  await expect(pairOf(page, "請求額")).toHaveCount(0);
  await expect(box(page, "支払期日")).toHaveValue("2026-12-01");
  expect(m.reads).toEqual([]);
  expect(m.kindReads, "種別を変えても口は増えない").toBe(1);
  await choose(page.locator("body"), page, "種別", "タスク");
  await expect(box(page, "請求額")).toHaveValue("100");
  expect(m.reads).toEqual([]);
  expect(m.kindReads).toBe(1);
  await choose(page.locator("body"), page, "種別", "課題");
  await box(page, "問い合わせ元").fill("電話");
  await make(page).click();
  await expect.poll(() => sentFields(page)).not.toBeNull();
  expect(await sentFields(page)).toEqual({ [fid("支払期日")]: "2026-12-01", [fid("問い合わせ元", MASTER_B)]: "電話" });
});

test("K569-UI-009 会社の項目が 0 件・読めない：0 件は用意してある項目だけで赤い箱なし／種別の口が 503 のときは「会社の項目を読めませんでした」と「読み直す」が出て担当者などは使え、読み直すと種別の口が 1 回で会社の項目が並ぶ（会社の項目のための別の口は無い）", async ({
  page,
}) => {
  const m = await mockFields(page, { masters: { [KIND_A]: [] } });
  await openHost(page, { mode: "create" });
  expect((await namesOf(page)).slice(0, 9)).toEqual(CORE);
  await expect(page.getByText("会社の項目を読めませんでした")).toHaveCount(0);
  expect(await namesOf(page)).toHaveLength(9);
  m.masters[KIND_A] = MASTER_ALL;
  m.kindsStatus = 503;
  await openHost(page, { mode: "create" });
  await expect(page.getByText("会社の項目を読めませんでした")).toBeVisible();
  await expect(grid(page).getByRole("combobox", { name: "担当者", exact: true })).toBeEnabled();
  m.kindsStatus = 200;
  const before = m.kindReads;
  await page.getByRole("button", { name: "読み直す", exact: true }).click();
  await expect(pairOf(page, "社内メモ")).toBeVisible();
  expect(m.kindReads).toBe(before + 1);
  expect(m.reads).toEqual([]);
  await expect(page.getByText("会社の項目を読めませんでした")).toHaveCount(0);
});

test("K569-UI-010 差し込み口と押せない形：slot=due の頁は期限の行に渡したボタンが出て押すと印が出る・渡さない頁は日付の欄・節目は aria-disabled・押しても Enter でも選択肢も口も出ない", async ({
  page,
}) => {
  const m = await mockFields(page);
  await openHost(page, { mode: "create", slot: "due" });
  await expect(pairOf(page, "期限").getByRole("button", { name: "期限", exact: true })).toBeVisible();
  await pairOf(page, "期限").getByRole("button", { name: "期限", exact: true }).click();
  await expect(page.getByText("期限を渡した", { exact: true })).toBeVisible();
  for (const n of ["節目"]) {
    const c = pairOf(page, n).getByRole("combobox", { name: n, exact: true });
    await expect(c).toHaveAttribute("aria-disabled", "true");
    await c.click({ force: true });
    await c.press("Enter");
    await expect(page.getByRole("option")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  expect(m.writes).toEqual([]);
  await openHost(page, { mode: "create" });
  await expect(pairOf(page, "期限").getByRole("textbox", { name: "期限", exact: true })).toBeVisible();
  await expect(page.getByText("期限を渡した", { exact: true })).toHaveCount(0);
});

test("K569-UI-011 担当者の「私が担当」：最初から自分（高本）が入り・山田を選んだ後「私が担当」で自分に戻り・送る値に担当者は含まれない", async ({
  page,
}) => {
  await mockFields(page, { masters: { [KIND_A]: [] } });
  await openHost(page, { mode: "create" });
  const who = grid(page).getByRole("combobox", { name: "担当者", exact: true });
  await expect(who).toContainText("高本");
  await choose(grid(page), page, "担当者", "山田");
  await expect(who).toContainText("山田");
  await grid(page).getByRole("button", { name: "私が担当", exact: true }).click();
  await expect(who).toContainText("高本");
  await make(page).click();
  await expect.poll(() => sentFields(page)).not.toBeNull();
  expect(await sentFields(page)).toEqual({});
});

test("K569-UI-012 優先度「高」：既定は中で理由の欄なし・高にすると「高にする理由」（＊つき）が出て空のまま「作る」は「優先度を高にする理由を書いてください」で止まり・中に戻すと理由の欄が消える", async ({
  page,
}) => {
  await mockFields(page, { masters: { [KIND_A]: [] } });
  await openHost(page, { mode: "create" });
  await expect(grid(page).getByRole("combobox", { name: "優先度", exact: true })).toContainText("中");
  await expect(grid(page).getByRole("textbox", { name: "高にする理由", exact: true })).toHaveCount(0);
  await choose(grid(page), page, "優先度", "高");
  await expect(pairOf(page, "高にする理由").locator(".k-f4d-req-mark")).toHaveCount(1);
  await make(page).click();
  await expect(pairOf(page, "高にする理由")).toContainText("優先度を高にする理由を書いてください");
  expect(await sentFields(page)).toBeNull();
  await choose(grid(page), page, "優先度", "中");
  await expect(grid(page).getByRole("textbox", { name: "高にする理由", exact: true })).toHaveCount(0);
});

test("K569-UI-013 詳細の値の見せ方：日付「12/15（火）」・選ぶ型は選択肢の名前・複数選ぶは「請求書、明細」・数は「95,000」・チェックは箱が付き・値の無い項目は空白。並びは getTicket の fields の順", async ({
  page,
}) => {
  const docs = byName(MASTER_ALL, "送る書類");
  const m = await mockFields(page, {
    values: {
      [ids.due]: "2026-12-15",
      [fid("PJコード")]: optId(byName(MASTER_ALL, "PJコード"), "SK-2026-11 セイコー商事 保守"),
      [ids.amt]: 95000,
      [docs.id]: [optId(docs, "請求書"), optId(docs, "明細")],
      [fid("原本の郵送")]: true,
    },
  });
  await detail(page, m);
  await expect(editBtn(page, "支払期日")).toHaveText("12/15（火）");
  await expect(editBtn(page, "PJコード")).toHaveText("SK-2026-11 セイコー商事 保守");
  await expect(editBtn(page, "請求額")).toHaveText("95,000");
  await expect(editBtn(page, "送る書類")).toHaveText("請求書、明細");
  await expect(box(page, "原本の郵送")).toBeChecked();
  await expect(editBtn(page, "分類")).toHaveText("");
  await expect(editBtn(page, "社内メモ")).toHaveText("");
  expect((await namesOf(page)).slice(-8)).toEqual(CUSTOM);
});

test("K569-UI-014 会社の項目が 0 件の詳細（getTicket の fields が空）：会社の項目の行が出ず、用意してある項目の行は出て、赤い箱は出ない", async ({
  page,
}) => {
  const m = await mockFields(page, { detail: [] });
  await detail(page, m);
  expect(await namesOf(page)).toEqual(CORE);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("K569-UI-015 値を直す（文字・数・日付・選ぶ・複数選ぶ・チェックの 6 型）：決めると口が 1 回（体は fields にその 1 項目だけ・型ごとの形）・画面の字が替わり・頁を読み直しても同じ", async ({
  page,
}) => {
  const docs = byName(MASTER_ALL, "送る書類");
  const pj = byName(MASTER_ALL, "PJコード");
  const m = await mockFields(page);
  await detail(page, m);
  await edit(page, "先方の担当者名", " 山田商事 ");
  await expect.poll(() => m.patches.length).toBe(1);
  expect(m.patches[0]).toEqual({ fields: { [ids.memo]: "山田商事" } });
  await edit(page, "請求額", "1200");
  await expect.poll(() => m.patches.length).toBe(2);
  expect(m.patches[1]).toEqual({ fields: { [ids.amt]: 1200 } });
  await edit(page, "支払期日", "2026-12-20");
  await expect.poll(() => m.patches.length).toBe(3);
  expect(m.patches[2]).toEqual({ fields: { [ids.due]: "2026-12-20" } });
  await editBtn(page, "PJコード").click();
  await choose(grid(page), page, "PJコード", "SK-2026-12 セイコー商事 追加開発");
  await expect.poll(() => m.patches.length).toBe(4);
  expect(m.patches[3]).toEqual({ fields: { [pj.id]: optId(pj, "SK-2026-12 セイコー商事 追加開発") } });
  await editBtn(page, "送る書類").click();
  const g = grid(page).getByRole("group", { name: "送る書類", exact: true });
  await g.getByRole("checkbox", { name: "請求書", exact: true }).check();
  await g.getByRole("checkbox", { name: "納品書", exact: true }).check();
  await grid(page).getByRole("button", { name: "送る書類を決める", exact: true }).click();
  await expect.poll(() => m.patches.length).toBe(5);
  expect(m.patches[4]).toEqual({ fields: { [docs.id]: [optId(docs, "請求書"), optId(docs, "納品書")] } });
  await box(page, "原本の郵送").check();
  await expect.poll(() => m.patches.length).toBe(6);
  expect(m.patches[5]).toEqual({ fields: { [fid("原本の郵送")]: true } });
  await expect(editBtn(page, "請求額")).toHaveText("1,200");
  await page.reload();
  await expect(editBtn(page, "先方の担当者名")).toHaveText("山田商事");
  await expect(editBtn(page, "請求額")).toHaveText("1,200");
  await expect(editBtn(page, "支払期日")).toHaveText("12/20（日）");
  await expect(editBtn(page, "PJコード")).toHaveText("SK-2026-12 セイコー商事 追加開発");
  await expect(editBtn(page, "送る書類")).toHaveText("請求書、納品書");
  await expect(box(page, "原本の郵送")).toBeChecked();
});

test("K569-UI-016 空にする（必須でない日付・数・文字）：入力を空（文字は空白だけ）にして決めると体の値が null・画面の値は空白・読み直しても空", async ({
  page,
}) => {
  const day = field(9, "納品日", "date");
  const m = await mockFields(page, {
    detail: [...MASTER_ALL, day],
    values: { [ids.amt]: 5, [ids.memo]: "あ", [day.id]: "2026-12-01" },
  });
  await detail(page, m);
  await editBtn(page, "請求額").click();
  await box(page, "請求額").fill("");
  await box(page, "請求額").press("Enter");
  await expect.poll(() => m.patches.length).toBe(1);
  expect(m.patches[0]).toEqual({ fields: { [ids.amt]: null } });
  await edit(page, "納品日", "");
  await expect.poll(() => m.patches.length).toBe(2);
  expect(m.patches[1]).toEqual({ fields: { [day.id]: null } });
  await edit(page, "先方の担当者名", "　 ");
  await expect.poll(() => m.patches.length).toBe(3);
  expect(m.patches[2]).toEqual({ fields: { [ids.memo]: null } });
  await page.reload();
  await expect(editBtn(page, "請求額")).toHaveText("");
  await expect(editBtn(page, "納品日")).toHaveText("");
  await expect(editBtn(page, "先方の担当者名")).toHaveText("");
});

test("K569-UI-017 必須の項目を空にして決める：口を呼ばず欄の下に「支払期日を選んでください」・入力は開いたまま元の値は変わらず・入れ直すと決められる", async ({
  page,
}) => {
  const m = await mockFields(page, { values: { [ids.due]: "2026-12-15" } });
  await detail(page, m);
  await edit(page, "支払期日", "");
  await expect(pairOf(page, "支払期日")).toContainText("支払期日を選んでください");
  await expect(box(page, "支払期日")).toBeVisible();
  expect(m.patches).toEqual([]);
  await page.reload();
  await expect(editBtn(page, "支払期日")).toHaveText("12/15（火）");
  await edit(page, "支払期日", "2026-12-16");
  await expect.poll(() => m.patches.length).toBe(1);
  await expect(editBtn(page, "支払期日")).toHaveText("12/16（水）");
});

test("K569-UI-018 口が 409（E-FLD-001・002・003・004）：どれもその行の欄の下に正本の文がそのまま出て、入力は開いたまま入れた値が残り、読み直しても元のまま、もう一度決めて通ると赤い字が消える", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page, m);
  let n = 0;
  for (const code of ["E-FLD-001", "E-FLD-002", "E-FLD-003", "E-FLD-004"]) {
    n += 1;
    m.next = [conflict(code)];
    await edit(page, "先方の担当者名", `x${n}`);
    await expect.poll(() => m.patches.length).toBe(n * 2 - 1);
    await expect(pairOf(page, "先方の担当者名")).toContainText(msg(code));
    await expect(box(page, "先方の担当者名")).toHaveValue(`x${n}`);
    expect(m.values[ids.memo]).toBe(n === 1 ? undefined : `x${n - 1}`);
    await box(page, "先方の担当者名").press("Enter");
    await expect.poll(() => m.patches.length).toBe(n * 2);
    await expect(pairOf(page, "先方の担当者名")).not.toContainText(msg(code));
    await expect(editBtn(page, "先方の担当者名")).toHaveText(`x${n}`);
  }
  await page.reload();
  await expect(editBtn(page, "先方の担当者名")).toHaveText("x4");
});

test("K569-UI-019 口が 404（E-PAGE-001・項目が消された）：その行の欄の下に正本の文が出て詳細の読み直し（getTicket）が 1 回走り、読み直しの答えに項目が無ければその行は消える", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page, m);
  expect(m.ticketReads).toBe(1);
  m.next = [notFound()];
  m.detail = MASTER_ALL.filter((f) => f.name !== "先方の担当者名");
  await edit(page, "先方の担当者名", "x");
  await expect.poll(() => m.ticketReads).toBe(2);
  await expect(pairOf(page, "先方の担当者名")).toHaveCount(0);
  await expect(pairOf(page, "請求額")).toBeVisible();
});

test("K569-UI-020 口が 403（書けない人）：5 秒で消える小さな知らせ「この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください」・値は元に戻り入力は閉じ・口は 1 回・読み直しても元の値", async ({
  page,
}) => {
  const m = await mockFields(page, { values: { [ids.memo]: "元" } });
  await detail(page, m);
  m.next = [forbidden()];
  await edit(page, "先方の担当者名", "変えたい");
  await expect(toastOf(page, FORBIDDEN_TEXT)).toBeVisible();
  await expect(box(page, "先方の担当者名")).toHaveCount(0);
  await expect(editBtn(page, "先方の担当者名")).toHaveText("元");
  expect(m.patches).toHaveLength(1);
  await expect(toastOf(page, FORBIDDEN_TEXT)).toBeHidden({ timeout: 9000 });
  await page.reload();
  await expect(editBtn(page, "先方の担当者名")).toHaveText("元");
});

test("K569-UI-021 口が 503（E-PAGE-003）：小さな知らせに正本の文が出て入力は開いたまま入れた値が残り、もう一度決めると通って値が替わる（1 回目は反映されていない）", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page, m);
  m.next = [failed()];
  await edit(page, "先方の担当者名", "あとで");
  await expect(toastOf(page, msg("E-PAGE-003"))).toBeVisible();
  await expect(box(page, "先方の担当者名")).toHaveValue("あとで");
  expect(m.values[ids.memo]).toBeUndefined();
  await box(page, "先方の担当者名").press("Enter");
  await expect.poll(() => m.patches.length).toBe(2);
  await expect(editBtn(page, "先方の担当者名")).toHaveText("あとで");
  await page.reload();
  await expect(editBtn(page, "先方の担当者名")).toHaveText("あとで");
});

test("K569-UI-022 決めるを二度押し（Enter を続けて 2 回・答えを止めておく）：口は 1 回・送っている間は入力が押せず・答えが来ると 1 つの値になる", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page, m);
  const release = m.hold();
  await editBtn(page, "先方の担当者名").click();
  await box(page, "先方の担当者名").fill("z");
  await box(page, "先方の担当者名").press("Enter");
  await expect.poll(() => m.patches.length).toBe(1);
  await expect(box(page, "先方の担当者名")).toBeDisabled();
  await page.keyboard.press("Enter");
  release();
  await expect(editBtn(page, "先方の担当者名")).toHaveText("z");
  expect(m.patches).toHaveLength(1);
});

test("K569-UI-023 別の項目を続けて直す・途中でやめる：2 つ続けて直すと口は 2 回で体の鍵はそれぞれ 1 項目だけ・Esc でやめると口は 0 回で元の値が出て打った字は捨てられる", async ({
  page,
}) => {
  const m = await mockFields(page);
  await detail(page, m);
  await edit(page, "先方の担当者名", "a");
  await expect.poll(() => m.patches.length).toBe(1);
  await edit(page, "請求額", "5");
  await expect.poll(() => m.patches.length).toBe(2);
  expect(m.patches.map((p) => Object.keys(p.fields))).toEqual([[ids.memo], [ids.amt]]);
  await editBtn(page, "社内メモ").click();
  await box(page, "社内メモ").fill("消える");
  await box(page, "社内メモ").press("Escape");
  await expect(editBtn(page, "社内メモ")).toHaveText("");
  expect(m.patches).toHaveLength(2);
  await editBtn(page, "社内メモ").click();
  await expect(box(page, "社内メモ")).toHaveValue("");
});

test("K569-UI-024 完了したチケットの値（getTicket の completed が入っている）：会社の項目は直せて（口が 200 を返し画面が替わる）、「完了したので直せません」の押せない形は出ない", async ({
  page,
}) => {
  const m = await mockFields(page, { completed: true });
  await detail(page, m);
  await expect(editBtn(page, "請求額")).toBeEnabled();
  await edit(page, "請求額", "7");
  await expect.poll(() => m.patches.length).toBe(1);
  await expect(editBtn(page, "請求額")).toHaveText("7");
  await expect(page.getByText(/完了したので/)).toHaveCount(0);
});

test("K569-UI-025 幅ごとのはみ出し：幅 375・768・1440 の作る面（会社の項目 8 つ・誤りが全部出た形）と詳細で scrollWidth - clientWidth が 0・名前の列が入力に重ならない", async ({
  page,
}) => {
  await mockFields(page);
  for (const w of WIDTHS) {
    await openHost(page, { mode: "create", width: w });
    await make(page).click();
    await expect(pairOf(page, "PJコード")).toContainText("PJコードを選んでください");
    expect(await overflowX(page), `作る面 幅 ${w}`).toBe(0);
    for (const n of ["支払期日", "請求額", "社内メモ"]) {
      const name = (await pairOf(page, n).locator(".k-f4d-name").boundingBox())!;
      const cell = (await pairOf(page, n).locator(".k-f4d-cell").boundingBox())!;
      const apart = name.x + name.width <= cell.x + 1 || name.y + name.height <= cell.y + 1;
      expect(apart, `幅 ${w}・${n}：名前が入力に重なっている`).toBe(true);
    }
    await openHost(page, { mode: "detail", width: w });
    await expect(editBtn(page, "支払期日")).toBeVisible();
    expect(await overflowX(page), `詳細 幅 ${w}`).toBe(0);
  }
});

test("K569-UI-026 キーボード：先方の担当者名から Tab で 分類（Enter で開く）→ 送る書類の 3 つのチェック → 原本の郵送 → 社内メモの順に回り、チェックは Space で付き、左の薄い名前は読み上げから外れている", async ({
  page,
}) => {
  await mockFields(page);
  await openHost(page, { mode: "create" });
  await expect(pairOf(page, "請求額").locator(".k-f4d-name")).toHaveAttribute("aria-hidden", "true");
  await grid(page).getByRole("textbox", { name: "先方の担当者名", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(grid(page).getByRole("combobox", { name: "分類", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  const docs = grid(page).getByRole("group", { name: "送る書類", exact: true });
  await expect(docs.getByRole("checkbox", { name: "請求書", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(docs.getByRole("checkbox", { name: "請求書", exact: true })).toBeChecked();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(box(page, "原本の郵送")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(box(page, "原本の郵送")).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(grid(page).getByRole("textbox", { name: "社内メモ", exact: true })).toBeFocused();
});

// ---------------------------------------------------------------- 下絵との突き合わせ（会社の項目の行＝表の 10 番目から。位置は比べない）
const R = ".k-f4d-grid > .k-f4d-pair:nth-child(n+10):nth-child(-n+17)";
const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["width", "height", "font-size", "border-top-color"];
const CUSTOM_PAIRS: FidelityPair[] = [
  pair("name", `${R} .k-f4d-name`, TXT),
  pair("req", `${R} .k-f4d-req-mark`, ["color", "texts"]),
  pair("input", `${R} .k-input`, CTRL),
  pair("trigger", `${R} .k-select-trigger`, CTRL),
  pair("multi", `${R} .k-f4d-multi label`, ["font-size", "color", "texts"]),
  pair("hint", `${R} .k-f4d-hint`, ["font-size", "color", "texts"]),
  pair("err", `${R} .k-err`, ["font-size", "color", "texts"]),
];
for (const [row, id, master, press] of [
  ["K569-UI-027", "f4v2-create-custom", MASTER_ALL, false],
  ["K569-UI-028", "f4v2-create-missing", MASTER_3, true],
] as const) {
  test(`${row} 下絵との突き合わせ（${id}）：幅 375・768・1440 で会社の項目の名前の字・必須の印・入力の幅と高さと枠の色・${press ? "欄の下の赤い字" : "説明の字"}が下絵と同じ`, async ({
    browser,
  }) => {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await mockFields(page, { masters: { [KIND_A]: [...master] } });
          await openHost(page, { mode: "create", width: w });
          await expect(pairOf(page, "請求額")).toBeVisible();
          if (press) {
            await make(page).click();
            await expect(pairOf(page, "PJコード")).toContainText("PJコードを選んでください");
          }
        },
        { base: "/dev/mock/f4v2", pairs: CUSTOM_PAIRS, blur: true },
      );
      expect(rows.length, `${id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    }
  });
}

test("K569-UI-029 口の数：作る面は会社の項目のための口を足さず（種別の口 1 本の答えから読む・listTicketFields は呼ばない）・詳細は getTicket の 1 本のまま・直すときの PATCH 以外に書く口が無く・本人の Bridge（38617）に飛ばない", async ({
  page,
}) => {
  const bridge: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("127.0.0.1:38617")) bridge.push(r.url());
  });
  const m = await mockFields(page);
  await openHost(page, { mode: "create" });
  await expect(pairOf(page, "請求額")).toBeVisible();
  expect(m.reads).toEqual([]);
  expect(m.kindReads).toBe(1);
  await openHost(page, { mode: "detail" });
  await expect(editBtn(page, "請求額")).toBeVisible();
  expect(m.reads).toEqual([]);
  expect(m.ticketReads).toBe(1);
  await edit(page, "請求額", "3");
  await expect.poll(() => m.patches.length).toBe(1);
  expect(m.writes).toEqual([]);
  expect(bridge).toEqual([]);
});

// ---------------------------------------------------------------- 下絵に足された 3 つの状態（誤りの型ごとの文・詳細でその場で直す・直して断られた）
const MISSING_PAIRS: FidelityPair[] = [
  pair("name", ".k-f4d-grid > .k-f4d-pair .k-f4d-name", TXT),
  pair("err", ".k-f4d-grid > .k-f4d-pair .k-err", ["font-size", "color", "texts"]),
];
const EDIT_PAIRS: FidelityPair[] = [
  pair("input", ".k-f4d-grid .k-input", CTRL),
  pair("err", ".k-f4d-grid .k-err", ["font-size", "color", "texts"]),
];
test("K569-UI-030 下絵との突き合わせ（f4v2-create-missing-types・f4v2-detail-item-edit・f4v2-detail-item-error）：幅 375・768・1440 で誤りの文 7 つ・その場で直している入力・断られた欄の下の赤い字が下絵と同じ値", async ({
  browser,
}) => {
  const states = [
    {
      id: "f4v2-create-missing-types",
      pairs: MISSING_PAIRS,
      setup: async (page: Page, w: number) => {
        await mockFields(page, { masters: { [KIND_A]: MASTER_REQ7 } });
        await openHost(page, { mode: "create", width: w });
        await make(page).click();
        await expect(pairOf(page, "確認済み")).toContainText("確認済みにチェックを付けてください");
      },
    },
    {
      id: "f4v2-detail-item-edit",
      pairs: EDIT_PAIRS,
      setup: async (page: Page, w: number) => {
        await mockFields(page);
        await openHost(page, { mode: "detail", width: w });
        await editBtn(page, "先方の担当者名").click();
        await expect(box(page, "先方の担当者名")).toBeVisible();
      },
    },
    {
      id: "f4v2-detail-item-error",
      pairs: EDIT_PAIRS,
      setup: async (page: Page, w: number) => {
        const m = await mockFields(page);
        await openHost(page, { mode: "detail", width: w });
        m.next = [conflict("E-FLD-004")];
        await edit(page, "先方の担当者名", "x");
        await expect(pairOf(page, "先方の担当者名")).toContainText(msg("E-FLD-004"));
      },
    },
  ];
  for (const s of states) {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(browser, s.id, w, (page) => s.setup(page, w), {
        base: "/dev/mock/f4v2",
        pairs: s.pairs,
        blur: true,
      });
      expect(rows.length, `${s.id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    }
  }
});
