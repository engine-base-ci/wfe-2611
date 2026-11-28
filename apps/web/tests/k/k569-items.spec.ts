// K-569「項目の表（作る面の 2 列の表：用意してある項目と会社が足した項目 7 つの型を同じ並びで・必須・説明・
//   誤りの出し方・種別を変えると入れ替わる）」の試験。詳細で値を直す側は K-1153（tests/k/k1153-item-edit.spec.ts）
//   （実 Chrome・口は網の手前で差し替え：tests/k/items-mock.ts・実装より先に積む）。開く場所は開発用の頁 /dev/f4-items（作る面は
//   K-442 がこの部品を組む。この葉は部品の動きを見る）。モックとの突き合わせは /dev/mock/f4v2 の 3 つの状態（create-custom・create-missing・create-missing-types）。
//   正の絵は K-431 の版（絵は書き換えない・2026-11-24 の PM の決め）。固定の待ちは使わない（要素と口の数を待つ）。
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
  field,
  grid,
  mockFields,
  openHost,
  optId,
  overflowX,
  pairOf,
  sentFields,
  type FieldApi,
} from "./items-mock";
import { matchMock } from "./stage2-match";

const CORE = ["状態", "担当者", "優先度", "節目", "開始日", "期限", "予定時間", "実績時間", "親"];
const CUSTOM = MASTER_ALL.map((f) => f.name);
/** 表の最後はいつも確認項目の行（全幅・中身は K-450 の差し込み口。無ければ 0 件の 1 行の説明） */
const SPECS = "確認項目";
const clean = (t: string): string => t.replace(/[＊\s]/g, "");
const namesOf = async (page: Page): Promise<string[]> =>
  (await grid(page).locator(".k-f4d-name").allTextContents()).map(clean);
const make = (page: Page) => page.getByRole("button", { name: "作る", exact: true });
// 必須の欄の名前（label）は「支払期日*」（印 * は読み上げない・components/k の Field）。getByLabel は印を含む字で比べるので、印の有無を許す
const labelRe = (name: string): RegExp => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*?$`);
const box = (page: Page, name: string) => grid(page).getByLabel(labelRe(name));
const fid = (name: string, master: FieldApi[] = MASTER_ALL): string => byName(master, name).id;
/** チェックの型の箱：名前は説明の字（下絵の「原本を郵送する」）。説明が無ければ項目の名前 */
const check = (page: Page, label: string) => grid(page).getByRole("checkbox", { name: label, exact: true });

test("K569-UI-001 作る面の表の並び：名前「項目」のグループの中に、用意してある項目（状態・担当者・優先度・節目・開始日・期限・予定時間・実績時間・親）の後ろへ会社の 8 つがマスタの並びで続き、最後に全幅の確認項目の行・見出しで分かれず、どの行も同じ組の形", async ({
  page,
}) => {
  await mockFields(page);
  await openHost(page, { mode: "create" });
  await expect(grid(page).getByLabel("社内メモ", { exact: true })).toBeVisible();
  expect(await namesOf(page)).toEqual([...CORE, ...CUSTOM, SPECS]);
  await expect(grid(page).locator("h2, h3")).toHaveCount(0);
  await expect(pairOf(page, SPECS)).toHaveAttribute("data-full", "true");
  for (const n of [...CORE, ...CUSTOM, SPECS]) {
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

test("K569-UI-003 型 7 つの入力：名前で探せる入力が 7 つ（textbox・全幅の行の複数行の textbox・数字の textbox・日付の欄・選ぶ欄・チェックの並びのグループ・説明の字を名前に持つチェックの箱）で、選択肢は答えの並び", async ({
  page,
}) => {
  await mockFields(page);
  await openHost(page, { mode: "create" });
  await expect(grid(page).getByRole("textbox", { name: "先方の担当者名", exact: true })).toBeVisible();
  const memo = grid(page).getByRole("textbox", { name: "社内メモ", exact: true });
  expect(await memo.evaluate((e) => e.tagName)).toBe("TEXTAREA");
  await expect(pairOf(page, "社内メモ")).toHaveAttribute("data-full", "true");
  await expect(pairOf(page, "請求額")).toHaveAttribute("data-full", "false");
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
  await expect(check(page, "原本を郵送する")).toBeVisible();
  await expect(pairOf(page, "原本の郵送").locator(".k-f4d-hint, .k-desc")).toHaveCount(0);
  await expect(docs.locator(".k-f4d-hint")).toHaveText("送るものをすべて選びます");
});

test("K569-UI-004 7 つに値を入れて「作る」：送る値の fields が型ごとの形（空白を落とした文字・文字・数（0 も 0）・YYYY-MM-DD・選択肢の id・選択肢の並びの id の並び・true）で、入れなかった分類は鍵ごと無く、付けていない必須でないチェックも鍵ごと無い", async ({
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
  await check(page, "原本を郵送する").check();
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
  await check(page, "原本を郵送する").uncheck();
  await make(page).click();
  await expect
    .poll(async () => fid("原本の郵送") in ((await sentFields(page)) ?? { [fid("原本の郵送")]: 1 }))
    .toBe(false);
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
    ["先方の担当者名", "先方の担当者名を書いてください"],
    ["社内メモ", "社内メモを書いてください"],
    ["請求額", "請求額を入れてください"],
    ["支払期日", "支払期日を選んでください"],
    ["分類", "分類を選んでください"],
    ["送る書類", "送る書類を選んでください"],
    ["原本の郵送", "原本の郵送にチェックを付けてください"],
  ];
  for (const [n, t] of want) await expect(pairOf(page, n).locator(".k-err")).toHaveText(t);
  // 複数選ぶ・チェックは誤りの字が説明の字の代わりに出る（下絵 RequiredTypes と同じ）
  await expect(pairOf(page, "送る書類").locator(".k-f4d-hint")).toHaveCount(0);
  expect(await sentFields(page)).toBeNull();
});

test("K569-UI-007 空と 0 とチェックの false と数の字：必須の数の 0 は通る・必須のチェックは付けて外すと止まる・必須の文字は空白だけ（全角の空白・タブ）で止まる・必須でない数の「abc」「1-2」は「件数は数で入れてください」で止まり・全角の数字とカンマと前後の空白（「 １,２００ 」）は 1200・小数と負の数はそのまま数", async ({
  page,
}) => {
  const amt = byName(MASTER_REQ7, "請求額");
  const mail = byName(MASTER_REQ7, "原本の郵送");
  const memo = byName(MASTER_REQ7, "先方の担当者名");
  const count = field(9, "件数", "number");
  await mockFields(page, { masters: { [KIND_A]: [amt, mail, memo, count] } });
  await openHost(page, { mode: "create" });
  await box(page, "請求額").fill("0");
  await box(page, "先方の担当者名").fill("　\t　");
  await check(page, "原本を郵送する").check();
  await check(page, "原本を郵送する").uncheck();
  await box(page, "件数").fill("abc");
  await make(page).click();
  await expect(pairOf(page, "先方の担当者名")).toContainText("先方の担当者名を書いてください");
  await expect(pairOf(page, "原本の郵送")).toContainText("原本の郵送にチェックを付けてください");
  await expect(pairOf(page, "件数")).toContainText("件数は数で入れてください");
  await expect(pairOf(page, "請求額").locator(".k-err")).toHaveCount(0);
  expect(await sentFields(page)).toBeNull();
  await box(page, "件数").fill("1-2");
  await make(page).click();
  await expect(pairOf(page, "件数")).toContainText("件数は数で入れてください");
  await box(page, "先方の担当者名").fill("あ");
  await check(page, "原本を郵送する").check();
  await box(page, "件数").fill(" １,２００ ");
  await make(page).click();
  await expect.poll(() => sentFields(page)).not.toBeNull();
  expect(await sentFields(page)).toEqual({ [amt.id]: 0, [memo.id]: "あ", [mail.id]: true, [count.id]: 1200 });
  await box(page, "件数").fill("-2.5");
  await make(page).click();
  await expect.poll(async () => (await sentFields(page))?.[count.id]).toBe(-2.5);
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
  // 種別の口の答えを受けた後に見る（読み中は表が aria-busy=true で会社の項目の行を出さない）
  await expect.poll(() => m.kindReads).toBe(1);
  await expect(grid(page)).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("combobox", { name: "種別", exact: true })).toContainText("タスク");
  expect(await namesOf(page)).toEqual([...CORE, SPECS]);
  await expect(page.getByText("会社の項目を読めませんでした")).toHaveCount(0);
  await expect(grid(page).getByRole("alert")).toHaveCount(0);
  m.masters[KIND_A] = MASTER_ALL;
  m.kindsStatus = 503;
  await openHost(page, { mode: "create" });
  await expect(grid(page).getByRole("alert")).toContainText("会社の項目を読めませんでした");
  await expect(grid(page).getByRole("combobox", { name: "担当者", exact: true })).toBeEnabled();
  // 赤い箱は用意してある項目の行の直ぐ後・確認項目の前（表の形をずらさない）
  expect(await namesOf(page)).toEqual([...CORE, "会社の項目", SPECS]);
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
  const names = await namesOf(page);
  expect(names[names.indexOf("優先度") + 1], "高にする理由は優先度の直ぐ後の行").toBe("高にする理由");
  await make(page).click();
  await expect(pairOf(page, "高にする理由")).toContainText("優先度を高にする理由を書いてください");
  expect(await sentFields(page)).toBeNull();
  await choose(grid(page), page, "優先度", "中");
  await expect(grid(page).getByRole("textbox", { name: "高にする理由", exact: true })).toHaveCount(0);
});

test("K569-UI-013 用意してある行の既定の中身：状態は選ぶ欄（未着手・作業中・既定は未着手）・開始日は日付の欄・予定時間と実績時間は説明つき（実績時間は読むだけで空）・親は親を決める入口・節目は title「まだ使えません」。状態・開始日・予定時間を変えても送る値は会社の項目の分だけ・予定時間の「abc」は「予定時間は数で入れてください」で止まる", async ({
  page,
}) => {
  await mockFields(page, { masters: { [KIND_A]: [] } });
  await openHost(page, { mode: "create" });
  const stage = grid(page).getByRole("combobox", { name: "状態", exact: true });
  await expect(stage).toContainText("未着手");
  await stage.click();
  // 選んである選択肢には印 ✓ が中に出る（Base UI の ItemIndicator）ので、字は含むかで見る
  await expect(page.getByRole("option")).toHaveText([/未着手$/, /作業中$/]);
  await page.getByRole("option", { name: "作業中", exact: true }).click();
  await expect(box(page, "開始日")).toHaveAttribute("type", "date");
  await expect(pairOf(page, "予定時間").locator(".k-desc")).toHaveText(
    "このチケットにかかる見込みの時間です。例：1、0.25、36",
  );
  const actual = grid(page).getByRole("textbox", { name: "実績時間", exact: true });
  await expect(actual).toHaveAttribute("readonly", "");
  await expect(actual).toHaveValue("");
  await expect(pairOf(page, "実績時間").locator(".k-desc")).toHaveText("かかった作業時間です");
  await expect(pairOf(page, "親").getByRole("button")).toHaveCount(1);
  await expect(grid(page).getByRole("combobox", { name: "節目", exact: true })).toHaveAttribute(
    "title",
    "まだ使えません",
  );
  await box(page, "開始日").fill("2026-12-01");
  await box(page, "予定時間").fill("abc");
  await make(page).click();
  await expect(pairOf(page, "予定時間").locator(".k-err")).toHaveText("予定時間は数で入れてください");
  expect(await sentFields(page)).toBeNull();
  await box(page, "予定時間").fill("1.5");
  await make(page).click();
  await expect.poll(() => sentFields(page)).toEqual({});
});

test("K569-UI-014 説明の無い項目：説明が null のチェックは箱の名前が項目の名前・複数選ぶは説明の字（.k-f4d-hint）を出さず・文字の欄は .k-desc を出さない", async ({
  page,
}) => {
  const bare = [
    field(41, "確認済み", "check"),
    field(42, "書類", "multi_select", { options: byName(MASTER_ALL, "送る書類").options }),
    field(43, "メモ", "short_text"),
  ];
  await mockFields(page, { masters: { [KIND_A]: bare } });
  await openHost(page, { mode: "create" });
  await expect(check(page, "確認済み")).toBeVisible();
  await expect(pairOf(page, "書類").locator(".k-f4d-hint")).toHaveCount(0);
  await expect(grid(page).getByRole("group", { name: "書類", exact: true }).getByRole("checkbox")).toHaveCount(3);
  await expect(pairOf(page, "メモ").locator(".k-desc")).toHaveCount(0);
});

test("K569-UI-025 幅ごとのはみ出し：幅 375・768・1440 の作る面（会社の項目 8 つ・誤りが全部出た形）で scrollWidth - clientWidth が 0・どの幅でも名前の列と入力の列が 2 列のまま重ならない", async ({
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
      expect(name.x + name.width <= cell.x + 1, `幅 ${w}・${n}：名前が入力に重なっている（2 列でない）`).toBe(true);
    }
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
  // 選びの箱が閉じ終わり、焦点が「分類」へ戻ってから Tab を押す（戻る前の Tab は箱の中から次へ動き、送る書類に乗らない）
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(grid(page).getByRole("combobox", { name: "分類", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const docs = grid(page).getByRole("group", { name: "送る書類", exact: true });
  await expect(docs.getByRole("checkbox", { name: "請求書", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(docs.getByRole("checkbox", { name: "請求書", exact: true })).toBeChecked();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(check(page, "原本を郵送する")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(check(page, "原本を郵送する")).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(grid(page).getByRole("textbox", { name: "社内メモ", exact: true })).toBeFocused();
});

// ---------------------------------------------------------------- 下絵との突き合わせ（会社の項目の行＝表の 10 番目から n 行。位置は比べない）
//   表の直の子は 用意してある 9 行 → 会社の項目の n 行 → 確認項目の行。R は会社の項目の行だけ（create-missing の 3 つなら 10〜12）
const R = (n: number): string => `.k-f4d-grid > .k-f4d-pair:nth-child(n+10):nth-child(-n+${9 + n})`;
const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["width", "height", "font-size", "border-top-color"];
const customPairs = (n: number): FidelityPair[] => [
  pair("name", `${R(n)} .k-f4d-name`, TXT),
  pair("req", `${R(n)} .k-f4d-req-mark`, ["color", "texts"]),
  pair("input", `${R(n)} .k-input`, CTRL),
  pair("trigger", `${R(n)} .k-select-trigger`, CTRL),
  pair("desc", `${R(n)} .k-desc`, ["font-size", "color", "texts"]),
  pair("multi", `${R(n)} .k-f4d-multi label`, ["font-size", "color", "texts"]),
  pair("check", `${R(n)} .k-f4d-check`, ["font-size", "color", "texts"]),
  pair("hint", `${R(n)} .k-f4d-hint`, ["font-size", "color", "texts"]),
  pair("err", `${R(n)} .k-err`, ["font-size", "color", "texts"]),
];
/** 比べた役ごとの「当たった数」の行（下絵の側の数）。的が両方 0 個で緑になっていないかを見る */
const hits = (rows: { part: string; prop: string; canvas: unknown }[], part: string): number =>
  Number(rows.find((r) => r.part === part && r.prop === "当たった数")?.canvas ?? 0);
for (const [row, id, master, press, must] of [
  [
    "K569-UI-027",
    "f4v2-create-custom",
    MASTER_ALL,
    false,
    ["name", "req", "input", "trigger", "desc", "multi", "check", "hint"],
  ],
  ["K569-UI-028", "f4v2-create-missing", MASTER_3, true, ["name", "req", "input", "trigger", "desc", "err"]],
] as const) {
  test(`${row} 下絵との突き合わせ（${id}）：幅 375・768・1440 で会社の項目の名前の字・必須の印・入力の幅と高さと枠の色・説明の字・${press ? "欄の下の赤い字" : "複数選ぶとチェックの字"}が下絵と同じ`, async ({
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
        { base: "/dev/mock/f4v2", pairs: customPairs(master.length), blur: true },
      );
      for (const part of must) expect(hits(rows, part), `${id} 幅 ${w}：${part} の的が下絵に 0 個`).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    }
  });
}

test("K569-UI-029 口の数：作る面は会社の項目のための口を足さず（種別の口 1 本の答えから読む・listTicketFields は呼ばない）・種別を変えても値を入れても「作る」を押しても書く口が無く・本人の Bridge（38617）に飛ばない", async ({
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
  await choose(page.locator("body"), page, "種別", "課題");
  await box(page, "支払期日").fill("2026-12-01");
  await make(page).click();
  await expect.poll(() => sentFields(page)).not.toBeNull();
  expect(m.reads).toEqual([]);
  expect(m.kindReads).toBe(1);
  expect(m.ticketReads).toBe(0);
  expect(m.patches).toEqual([]);
  expect(m.writes).toEqual([]);
  expect(bridge).toEqual([]);
});

// ---------------------------------------------------------------- 下絵に足された状態（必須が空の型ごとの誤りの文）。詳細の 2 つは K-1153
const MISSING_PAIRS: FidelityPair[] = [
  pair("name", ".k-f4d-grid > .k-f4d-pair .k-f4d-name", TXT),
  pair("err", ".k-f4d-grid > .k-f4d-pair .k-err", ["font-size", "color", "texts"]),
];
test("K569-UI-030 下絵との突き合わせ（f4v2-create-missing-types）：幅 375・768・1440 で、表の全部の名前の字（用意してある項目・会社の 7 つ・確認項目）と必須が空の型ごとの誤りの文 7 つ（字・色・字の大きさ）が下絵と同じ", async ({
  browser,
}) => {
  for (const w of WIDTHS) {
    const { rows, bad } = await matchMock(
      browser,
      "f4v2-create-missing-types",
      w,
      async (page) => {
        await mockFields(page, { masters: { [KIND_A]: MASTER_REQ7 } });
        await openHost(page, { mode: "create", width: w });
        await make(page).click();
        await expect(pairOf(page, "原本の郵送")).toContainText("原本の郵送にチェックを付けてください");
      },
      { base: "/dev/mock/f4v2", pairs: MISSING_PAIRS, blur: true },
    );
    for (const part of ["name", "err"])
      expect(hits(rows, part), `幅 ${w}：${part} の的が下絵に 0 個`).toBeGreaterThan(0);
    expect(bad, bad.join("\n")).toEqual([]);
  }
});
