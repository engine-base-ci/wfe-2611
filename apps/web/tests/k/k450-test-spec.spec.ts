// K-450「確認項目の欄（項目の表の中の 1 つの項目：作る面は画面の中に持って作るとき文の並びで送る／詳細のパネルは「N 件・開く」で畳み、
//   開くと読む・チェックを付け外す・文を直す・外す・足す小窓。AI の案は押せない形）」の試験
//   （実 Chrome・口は網の手前で差し替え：tests/k/test-spec-mock.ts・実装より先に積む）。開く場所は開発用の頁 /dev/f4-specs（作る面と詳細は
//   K-442・K-571 がこの部品を組む。この葉は部品の動きを見る）。モックとの突き合わせは /dev/mock/f4v2 の 5 つの状態（specs・spec-add・spec-edit・spec-add-error・create-specs）。
//   見ること：足す・付け外す・直す・外すの結果は、画面だけでなく、頁を読み直して開き直した答えにも出る（作った答えだけで合格にしない）。
//   画面は役の名前で出し分けず、口の答え（meta.can_edit）で出し分ける。固定の待ちは使わない（要素と口の数を待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { countWrites, expectInert } from "./kit";
import { matchMock } from "./stage2-match";
import * as shared from "./test-spec-mock";
import {
  FORBIDDEN_TEXT,
  HERE,
  HINT,
  ROOT,
  TICKET,
  WIDTHS,
  addBtn,
  aiBtn,
  boxOf,
  conflict,
  dialogOf,
  extBtn,
  failed,
  fiveSpecs,
  forbidden,
  invalid,
  lineOf,
  lockedSource,
  mockTestSpecs,
  msg,
  notFound,
  openAdd,
  openBtn,
  openHost,
  openSpecs,
  overflowX,
  rmBtn,
  sentSpecs,
  spec,
  specsOf,
  textBtn,
  toastOf,
} from "./test-spec-mock";

const T = [
  "請求書が宛先に届いている",
  "PDF の合計が請求額と合う",
  "請求額が明細の合計と合っている",
  "承認する人が中身を見る",
  "送る前に文面を目で見る",
];
const lines = (page: Page) => specsOf(page).getByRole("listitem");
/** 小窓（modal）を開いたままの後ろの行（後ろは読み上げから隠れるので、隠れた物も探す） */
const linesBehind = (page: Page) =>
  page
    .getByRole("group", { name: "確認項目の欄", exact: true, includeHidden: true })
    .getByRole("listitem", { includeHidden: true });
const editor = (page: Page) => specsOf(page).getByRole("textbox", { name: "確認項目の文", exact: true });
const reopen = async (page: Page): Promise<void> => {
  await page.reload();
  await expect(specsOf(page)).toBeVisible();
  await openBtn(page).click();
  await expect(openBtn(page)).toHaveCount(0);
};
const note = (page: Page, text: string) => expect(toastOf(page, text).first()).toBeVisible();
const typeInto = async (page: Page, text: string): Promise<void> => {
  const d = await openAdd(page);
  await d.getByRole("textbox", { name: "確かめること", exact: true }).fill(text);
};
const press = (page: Page) => dialogOf(page).getByRole("button", { name: "足す", exact: true });

test("K450-UI-001 詳細・閉じた形（件数 4）：「4 件 ・」の字と「開く」のボタンだけが出て、行も「＋ 確認項目を足す」も出ず、listTestSpecs は 0 回", async ({
  page,
}) => {
  const m = await openSpecs(page, { specs: fiveSpecs().slice(0, 4), closed: true });
  await expect(specsOf(page)).toContainText("4 件");
  await expect(openBtn(page)).toBeVisible();
  await expect(lines(page)).toHaveCount(0);
  await expect(addBtn(page)).toHaveCount(0);
  expect(m.reads).toBe(0);
});

test("K450-UI-002 「開く」を押す（5 件・チェック付き 3・付かない 2）：listTestSpecs が 1 回・行が答えの並びで 5 つ・箱の名前は行の文・付いた行は箱が付き・各行に「〈文〉を外す」・「＋ 確認項目を足す」と aria-disabled の「AI の案を出す」・閉じる道は無い", async ({
  page,
}) => {
  const m = await openSpecs(page);
  expect(m.reads).toBe(1);
  await expect(lines(page)).toHaveCount(5);
  for (const [i, t] of T.entries()) {
    await expect(lines(page).nth(i)).toContainText(t);
    await expect(rmBtn(page, t)).toBeVisible();
  }
  for (const t of [T[0]!, T[1]!, T[3]!]) await expect(boxOf(page, t)).toBeChecked();
  for (const t of [T[2]!, T[4]!]) await expect(boxOf(page, t)).not.toBeChecked();
  await expect(addBtn(page)).toBeVisible();
  await expect(aiBtn(page)).toHaveAttribute("aria-disabled", "true");
  await expect(openBtn(page)).toHaveCount(0);
});

test("K450-UI-003 0 件の詳細を開く・AI の案：説明の文が出て行は無く「＋ 確認項目を足す」は押せ・「AI の案を出す」は在る・aria-disabled・薄さ 0.55・押しても Enter でも口が呼ばれず小窓が開かない", async ({
  page,
}) => {
  const w = countWrites(page);
  await openSpecs(page, { specs: [] });
  await expect(specsOf(page)).toContainText(HINT);
  await expect(lines(page)).toHaveCount(0);
  await expect(addBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  await expectInert(page, aiBtn(page), "AI の案を出す", w);
});

test("K450-UI-004 足す（「＋ 確認項目を足す」→ 小窓「確認項目を足す」→ 確かめること → 「足す」）：createTestSpec が 1 回・体は { title } の 1 鍵だけ・小窓が閉じ・行が末尾に増えて箱は付かず・読み直して開き直しても同じ行が末尾にある", async ({
  page,
}) => {
  const m = await openSpecs(page);
  await typeInto(page, "請求書の宛名を確かめる");
  await press(page).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(lines(page)).toHaveCount(6);
  await expect(lines(page).last()).toContainText("請求書の宛名を確かめる");
  await expect(boxOf(page, "請求書の宛名を確かめる")).not.toBeChecked();
  expect(m.adds).toEqual([{ title: "請求書の宛名を確かめる" }]);
  await reopen(page);
  await expect(lines(page)).toHaveCount(6);
  await expect(lines(page).last()).toContainText("請求書の宛名を確かめる");
});

test("K450-UI-005 文の形（画面で先に止める）：空・空白だけ（全角の空白・タブ）は小窓の欄の下に「確かめることを書いてください」・201 字は「確かめることは 200 文字までです」で口は 0 回・小窓は開いたまま／200 字ちょうどと前後に空白のある文は口が 1 回ずつで通り、空白を落とした文が送られる", async ({
  page,
}) => {
  const m = await openSpecs(page, { specs: [] });
  for (const [text, want] of [
    ["", "確かめることを書いてください"],
    ["　\t　", "確かめることを書いてください"],
    ["あ".repeat(201), "確かめることは 200 文字までです"],
  ] as const) {
    await typeInto(page, text);
    await press(page).click();
    await expect(dialogOf(page)).toContainText(want);
    await expect(dialogOf(page)).toBeVisible();
    expect(m.adds).toEqual([]);
    await dialogOf(page).getByRole("button", { name: "やめる", exact: true }).click();
    await expect(dialogOf(page)).toHaveCount(0);
  }
  await typeInto(page, "あ".repeat(200));
  await press(page).click();
  await expect.poll(() => m.adds.length).toBe(1);
  await typeInto(page, "　前後に空白　");
  await press(page).click();
  await expect.poll(() => m.adds.length).toBe(2);
  expect(m.adds[1]).toEqual({ title: "前後に空白" });
});

test("K450-UI-006 口が 422（欄 title・口の文）：小窓の欄の下に口の文が出て、小窓は開いたまま書いた中身が残り、行は増えない", async ({
  page,
}) => {
  const m = await openSpecs(page);
  m.force.add = [invalid("title", "確かめることの形が正しくありません")];
  await typeInto(page, "形の合わない文");
  await press(page).click();
  await expect(dialogOf(page)).toContainText("確かめることの形が正しくありません");
  await expect(dialogOf(page).getByRole("textbox", { name: "確かめること", exact: true })).toHaveValue(
    "形の合わない文",
  );
  await expect(linesBehind(page)).toHaveCount(5);
});

test("K450-UI-007 足すが口に断られる（409 E-SPEC-001・403・404・503 の 4 つ）：どれも小窓の上の赤い箱に正本の文が出て、小窓は開いたまま書いた中身が残り行は増えず、もう一度「足す」で通ると小窓が閉じて行が増える", async ({
  page,
}) => {
  const m = await openSpecs(page);
  await typeInto(page, "断られても残る文");
  for (const [reply, text] of [
    [conflict("E-SPEC-001"), msg("E-SPEC-001")],
    [forbidden(), FORBIDDEN_TEXT],
    [notFound(), msg("E-PAGE-001")],
    [failed(), msg("E-PAGE-003")],
  ] as const) {
    m.force.add = [reply];
    await press(page).click();
    await expect(dialogOf(page).getByRole("alert")).toContainText(text);
    await expect(dialogOf(page).getByRole("textbox", { name: "確かめること", exact: true })).toHaveValue(
      "断られても残る文",
    );
    await expect(linesBehind(page)).toHaveCount(5);
  }
  await press(page).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(lines(page)).toHaveCount(6);
});

test("K450-UI-008 チェックを付ける：箱を押すと updateTestSpec が 1 回・体は { version, checked: true }（version は読んだ行の版）・箱が付く／続けて外すと体の version が 1 つ上がり／読み直して開き直しても外れたまま", async ({
  page,
}) => {
  const m = await openSpecs(page);
  await boxOf(page, T[2]!).check();
  await expect.poll(() => m.updates.length).toBe(1);
  expect(m.updates[0]!.body).toEqual({ version: 1, checked: true });
  await expect(boxOf(page, T[2]!)).toBeChecked();
  await boxOf(page, T[2]!).uncheck();
  await expect.poll(() => m.updates.length).toBe(2);
  expect(m.updates[1]!.body).toEqual({ version: 2, checked: false });
  await boxOf(page, T[2]!).check();
  await expect.poll(() => m.updates.length).toBe(3);
  await reopen(page);
  await expect(boxOf(page, T[2]!)).toBeChecked();
});

test("K450-UI-009 チェックを外す（付いた行の箱を押す）：{ version, checked: false } が 1 回・箱が外れ・読み直しても外れたまま・文のボタンが押せる形に戻る", async ({
  page,
}) => {
  const m = await openSpecs(page);
  await expect(textBtn(page, T[0]!)).toHaveAttribute("aria-disabled", "true");
  await boxOf(page, T[0]!).uncheck();
  await expect.poll(() => m.updates.length).toBe(1);
  expect(m.updates[0]!.body).toEqual({ version: 1, checked: false });
  await expect(boxOf(page, T[0]!)).not.toBeChecked();
  await expect(textBtn(page, T[0]!)).not.toHaveAttribute("aria-disabled", "true");
  await reopen(page);
  await expect(boxOf(page, T[0]!)).not.toBeChecked();
});

test("K450-UI-010 文を直す（チェックが付いていない行の文を押す）：その場で入力（名前「確認項目の文」）に替わり、前後に空白のある文で Enter すると体は { version, title }（空白を落とす）・字が替わり入力は閉じ・読み直しても新しい文／Esc でやめると口は 0 回で元の文／空にして Enter は行の下に「確かめることを書いてください」・口は 0 回・入力は開いたまま", async ({
  page,
}) => {
  const m = await openSpecs(page);
  await textBtn(page, T[4]!).click();
  await editor(page).fill("　新しい文　");
  await editor(page).press("Enter");
  await expect.poll(() => m.updates.length).toBe(1);
  expect(m.updates[0]!.body).toEqual({ version: 1, title: "新しい文" });
  await expect(editor(page)).toHaveCount(0);
  await expect(lines(page).last()).toContainText("新しい文");
  await reopen(page);
  await expect(lines(page).last()).toContainText("新しい文");
  await textBtn(page, "新しい文").click();
  await editor(page).fill("捨てる文");
  await editor(page).press("Escape");
  await expect(editor(page)).toHaveCount(0);
  await expect(lines(page).last()).toContainText("新しい文");
  expect(m.updates).toHaveLength(1);
  await textBtn(page, "新しい文").click();
  await editor(page).fill("");
  await editor(page).press("Enter");
  await expect(lineOf(page, "").last()).toContainText("確かめることを書いてください");
  await expect(editor(page)).toBeVisible();
  expect(m.updates).toHaveLength(1);
});

test("K450-UI-011 チェックが付いた行の文：文のボタンは aria-disabled・薄さ 0.55・title「チェックを外すと直せます」で、押しても入力に替わらず口も呼ばれず、箱を外すと押せて直せる", async ({
  page,
}) => {
  const w = countWrites(page);
  await openSpecs(page);
  await expect(textBtn(page, T[0]!)).toHaveAttribute("title", "チェックを外すと直せます");
  await expectInert(page, textBtn(page, T[0]!), "チェック付きの文", w);
  await expect(editor(page)).toHaveCount(0);
  await boxOf(page, T[0]!).uncheck();
  await expect.poll(() => w.n).toBe(1);
  await textBtn(page, T[0]!).click();
  await expect(editor(page)).toBeVisible();
});

test("K450-UI-012 「外す」を押す（真ん中の行）：deleteTestSpec が 1 回・行が消えて残りは並びのまま・読み直して開き直しても無く・チェックが付いた行も外せる", async ({
  page,
}) => {
  const m = await openSpecs(page);
  await rmBtn(page, T[2]!).click();
  await expect.poll(() => m.deletes.length).toBe(1);
  await expect(lineOf(page, T[2]!)).toHaveCount(0);
  await expect(lines(page)).toHaveCount(4);
  await rmBtn(page, T[0]!).click();
  await expect.poll(() => m.deletes.length).toBe(2);
  await reopen(page);
  await expect(lines(page)).toHaveCount(3);
  await expect(lineOf(page, T[2]!)).toHaveCount(0);
  await expect(lineOf(page, T[0]!)).toHaveCount(0);
});

test("K450-UI-013 先に変えられた（409 E-SPEC-020・チェック／文を直す）：小さな知らせに正本の文が出て、一覧が 1 回読み直されて行が口の最新になり、直していた入力は開いたまま入れた字が残り、もう一度決めて通ると 200", async ({
  page,
}) => {
  const m = await openSpecs(page);
  m.specs = m.specs.map((s) => (s.title === T[2] ? { ...s, version: 2, checked: true } : s));
  await boxOf(page, T[2]!).check();
  await note(page, msg("E-SPEC-020"));
  await expect.poll(() => m.reads).toBe(2);
  await expect(boxOf(page, T[2]!)).toBeChecked();
  m.specs = m.specs.map((s) => (s.title === T[4] ? { ...s, version: 2, title: "別の人の文" } : s));
  await textBtn(page, T[4]!).click();
  await editor(page).fill("自分の文");
  await editor(page).press("Enter");
  await expect.poll(() => m.reads).toBe(3);
  // 入力を開いたままの行は字の代わりに入力が出る。行が口の最新になったことは箱の名前（行の文）で確かめる
  await expect(boxOf(page, "別の人の文")).toHaveCount(1);
  await expect(editor(page)).toHaveValue("自分の文");
  await editor(page).press("Enter");
  await expect.poll(() => m.updates.length).toBe(3);
  expect(m.updates[2]!.body).toEqual({ version: 2, title: "自分の文" });
  await expect(lines(page).last()).toContainText("自分の文");
});

test("K450-UI-014 行の文の直しが口の決まりで断られる（409 E-SPEC-021・E-SPEC-022）：他の人が先にチェックを付けた行は、小さな知らせに正本の文が出て一覧が 1 回読み直され、箱が付いて文のボタンが押せない形になる／出どころ knowledge の行（ナレッジの「必ず守る」から入った行）は、文のボタンと「外す」が aria-disabled・薄さ 0.55・title「必ず守る決まりから入った項目は、直せません・外せません」で口を呼ばず、箱は押せて付け外しの体は { version, checked } で通り、読んだ後に出どころが変わった行は 409 E-SPEC-022 の正本の文が出て一覧が読み直され、その行も押せない形になる", async ({
  page,
}) => {
  const m = await openSpecs(page);
  m.force.update = [conflict("E-SPEC-021")];
  m.specs = m.specs.map((s) => (s.title === T[4] ? { ...s, version: 2, checked: true } : s));
  await textBtn(page, T[4]!).click();
  await editor(page).fill("直したい");
  await editor(page).press("Enter");
  await note(page, msg("E-SPEC-021"));
  await expect.poll(() => m.reads).toBe(2);
  await expect(boxOf(page, T[4]!)).toBeChecked();
  await expect(textBtn(page, T[4]!)).toHaveAttribute("aria-disabled", "true");
  // 出どころ knowledge の行：直す入口と外すが押せない形・箱は押せる
  const k = spec("必ず守る：個人情報を本文に書かない", { source: "knowledge" });
  const m2 = await openSpecs(page, { specs: [...fiveSpecs(), k] });
  const w = countWrites(page);
  const LOCK = "必ず守る決まりから入った項目は、直せません・外せません";
  await expect(textBtn(page, k.title)).toHaveAttribute("title", LOCK);
  await expectInert(page, textBtn(page, k.title), "knowledge の行の文", w);
  await expectInert(page, rmBtn(page, k.title), "knowledge の行の外す", w);
  await expect(editor(page)).toHaveCount(0);
  expect(m2.deletes).toHaveLength(0);
  await boxOf(page, k.title).check();
  await expect.poll(() => m2.updates.length).toBe(1);
  expect(m2.updates[0]!.body).toEqual({ version: 1, checked: true });
  await boxOf(page, k.title).uncheck();
  await expect.poll(() => m2.updates.length).toBe(2);
  expect(m2.updates[1]!.body).toEqual({ version: 2, checked: false });
  // 読んだ後に出どころが変わった（画面は manual のまま文を直そうとする）：409 E-SPEC-022
  const readsBefore = m2.reads;
  m2.specs = m2.specs.map((s) => (s.title === T[2] ? { ...s, version: 2, source: "knowledge" as const } : s));
  m2.force.update = [lockedSource()];
  await textBtn(page, T[2]!).click();
  await editor(page).fill("直したい");
  await editor(page).press("Enter");
  await note(page, msg("E-SPEC-022"));
  await expect.poll(() => m2.reads).toBe(readsBefore + 1);
  await expect(textBtn(page, T[2]!)).toHaveAttribute("aria-disabled", "true");
  await expect(textBtn(page, T[2]!)).toHaveAttribute("title", LOCK);
  await expect(rmBtn(page, T[2]!)).toHaveAttribute("aria-disabled", "true");
});

test("K450-UI-015 完了したチケット（一覧の答えの can_edit が false）：足す・箱・文・外す・「AI の案を出す」が全部 aria-disabled・薄さ 0.55・押しても口も小窓も出ず（書く口は 0 回）、行と箱の状態は読める", async ({
  page,
}) => {
  const w = countWrites(page);
  const m = await openSpecs(page, { canEdit: false });
  await expect(lines(page)).toHaveCount(5);
  await expect(boxOf(page, T[0]!)).toBeChecked();
  await expectInert(page, addBtn(page), "＋ 確認項目を足す", w);
  await expectInert(page, aiBtn(page), "AI の案を出す", w);
  await expectInert(page, boxOf(page, T[2]!), "箱", w);
  await expectInert(page, textBtn(page, T[2]!), "文", w);
  await expectInert(page, rmBtn(page, T[2]!), "外す", w);
  expect([m.adds.length, m.updates.length, m.deletes.length]).toEqual([0, 0, 0]);
  await expect(boxOf(page, T[2]!)).not.toBeChecked();
});

test("K450-UI-016 開いた後に完了が確定した（can_edit は true のまま・口が 409 E-SPEC-001）：付ける・外す・文を直す・外すのどれも小さな知らせに正本の文が出て、行は変わらない", async ({
  page,
}) => {
  const m = await openSpecs(page);
  m.force.update = [conflict("E-SPEC-001")];
  await boxOf(page, T[2]!).check();
  await note(page, msg("E-SPEC-001"));
  await expect(boxOf(page, T[2]!)).not.toBeChecked();
  // 次の操作の知らせを前の知らせと見分けるため、前の知らせ（5 秒で消える）が消えるのを待つ
  await expect(toastOf(page, msg("E-SPEC-001")).first()).toBeHidden({ timeout: 9000 });
  m.force.update = [conflict("E-SPEC-001")];
  await textBtn(page, T[4]!).click();
  await editor(page).fill("直す");
  await editor(page).press("Enter");
  await expect.poll(() => m.updates.length).toBe(2);
  await note(page, msg("E-SPEC-001"));
  // 完了したので直せない：入力は閉じ、行の文は元のまま
  await expect(editor(page)).toHaveCount(0);
  await expect(boxOf(page, T[4]!)).toHaveCount(1);
  expect(m.specs.find((s) => s.title === T[4])).toBeDefined();
  await expect(toastOf(page, msg("E-SPEC-001")).first()).toBeHidden({ timeout: 9000 });
  m.force.remove = [conflict("E-SPEC-001")];
  await rmBtn(page, T[3]!).click();
  await expect.poll(() => m.deletes.length).toBe(1);
  await note(page, msg("E-SPEC-001"));
  await expect(lineOf(page, T[3]!)).toHaveCount(1);
  expect(m.specs).toHaveLength(5);
});

test("K450-UI-017 行の操作が 403（書けない人・can_edit は true）：5 秒で消える小さな知らせ「この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください」・行は変わらず・口は 1 回", async ({
  page,
}) => {
  const m = await openSpecs(page);
  m.force.update = [forbidden()];
  await boxOf(page, T[2]!).check();
  await note(page, FORBIDDEN_TEXT);
  await expect(boxOf(page, T[2]!)).not.toBeChecked();
  expect(m.updates).toHaveLength(1);
  await expect(toastOf(page, FORBIDDEN_TEXT).first()).toBeHidden({ timeout: 9000 });
});

test("K450-UI-018 行が先に外された（404）：小さな知らせに正本の文（E-PAGE-001）が出て、一覧が 1 回読み直され、その行が消える", async ({
  page,
}) => {
  const m = await openSpecs(page);
  m.force.remove = [notFound()];
  m.specs = m.specs.filter((s) => s.title !== T[2]);
  await rmBtn(page, T[2]!).click();
  await note(page, msg("E-PAGE-001"));
  await expect.poll(() => m.reads).toBe(2);
  await expect(lineOf(page, T[2]!)).toHaveCount(0);
  await expect(lines(page)).toHaveCount(4);
});

test("K450-UI-019 行の操作が 503（E-PAGE-003）：小さな知らせに正本の文が出て行は変わらず（口の行も変わっていない）、もう一度操作すると通る", async ({
  page,
}) => {
  const m = await openSpecs(page);
  m.force.update = [failed()];
  await boxOf(page, T[2]!).check();
  await note(page, msg("E-PAGE-003"));
  await expect(boxOf(page, T[2]!)).not.toBeChecked();
  expect(m.specs.find((s) => s.title === T[2])!.checked).toBe(false);
  await boxOf(page, T[2]!).check();
  await expect.poll(() => m.updates.length).toBe(2);
  await expect(boxOf(page, T[2]!)).toBeChecked();
  expect(m.specs.find((s) => s.title === T[2])!.checked).toBe(true);
});

test("K450-UI-020 一覧が読めない（503）：確認項目の場所に赤い箱（E-PAGE-003 の文）と「読み直す」が出て「＋ 確認項目を足す」は aria-disabled・「読み直す」を押すと口が 1 回で、答えが来れば行が並ぶ", async ({
  page,
}) => {
  const m = await openSpecs(page, { readStatus: 503 });
  await expect(specsOf(page).getByRole("alert")).toContainText(msg("E-PAGE-003"));
  await expect(addBtn(page)).toHaveAttribute("aria-disabled", "true");
  m.readStatus = 200;
  const before = m.reads;
  await specsOf(page).getByRole("button", { name: "読み直す", exact: true }).click();
  await expect(lines(page)).toHaveCount(5);
  expect(m.reads).toBe(before + 1);
  await expect(specsOf(page).getByRole("alert")).toHaveCount(0);
});

test("K450-UI-021 足すを二度押し・チェックを二度押し（答えを止めておく）：足す＝小窓の「足す」を続けて 2 回押しても口は 1 回・答えが来ると行は 1 つ／チェック＝箱を続けて 2 回押しても口は 1 回", async ({
  page,
}) => {
  const m = await openSpecs(page);
  await typeInto(page, "二度押しの文");
  let release = m.hold();
  await press(page).dblclick();
  await expect.poll(() => m.adds.length).toBe(1);
  release();
  await expect(lines(page)).toHaveCount(6);
  expect(m.adds).toHaveLength(1);
  release = m.hold();
  await boxOf(page, T[2]!).click();
  await boxOf(page, T[2]!).click({ force: true });
  await expect.poll(() => m.updates.length).toBe(1);
  release();
  await expect(boxOf(page, T[2]!)).toBeChecked();
  expect(m.updates).toHaveLength(1);
});

test("K450-UI-022 作る面（mode=create・0 件から）：0 件の文が出て、「足す」で行が画面の中に増え（口は 0 回）足した順に並び、箱は aria-disabled・薄さ 0.55・title「作ったあとに付けます」・「外す」で消え、送る値の specs は文の並び（足した順・空白を落とした文）", async ({
  page,
}) => {
  const w = countWrites(page);
  const api: string[] = [];
  page.on("request", (r) => {
    if (/\/api\//.test(r.url())) api.push(r.url());
  });
  await mockTestSpecs(page);
  await openHost(page, { mode: "create" });
  await expect(specsOf(page)).toContainText(HINT);
  await typeInto(page, "　最初の確認　");
  await press(page).click();
  await typeInto(page, "二つ目");
  await press(page).click();
  await expect(lines(page)).toHaveCount(2);
  expect(await sentSpecs(page)).toEqual(["最初の確認", "二つ目"]);
  await expect(boxOf(page, "最初の確認")).toHaveAttribute("title", "作ったあとに付けます");
  await expectInert(page, boxOf(page, "最初の確認"), "作る面の箱", w);
  await rmBtn(page, "最初の確認").click();
  await expect(lines(page)).toHaveCount(1);
  expect(await sentSpecs(page)).toEqual(["二つ目"]);
  expect(api).toEqual([]);
});

test("K450-UI-023 作る面の 50 件の上限（n=50）：「＋ 確認項目を足す」が aria-disabled・title「確認項目は 50 件までです」で押しても小窓は開かず、1 件外すと押せて、足すと 50 件に戻り、送る値の specs は 50 個以下", async ({
  page,
}) => {
  const w = countWrites(page);
  await mockTestSpecs(page);
  await openHost(page, { mode: "create", n: 50 });
  await expect(lines(page)).toHaveCount(50);
  await expect(addBtn(page)).toHaveAttribute("title", "確認項目は 50 件までです");
  await expectInert(page, addBtn(page), "＋ 確認項目を足す（50 件）", w);
  await rmBtn(page, "確認項目 50").click();
  await expect(lines(page)).toHaveCount(49);
  await typeInto(page, "五十件目");
  await press(page).click();
  await expect(lines(page)).toHaveCount(50);
  expect((await sentSpecs(page)).length).toBeLessThanOrEqual(50);
});

test("K450-UI-024 キーボードと読み上げ（詳細）：Tab で行ごとに 箱 → 文 → 外す の順に次の行へ回り・箱は Space で付き・足す小窓は入力の名前「確かめること」・Esc で閉じるとキーボードの場所は「＋ 確認項目を足す」に戻る", async ({
  page,
}) => {
  const m = await openSpecs(page);
  await boxOf(page, T[0]!).focus();
  await page.keyboard.press("Tab");
  await expect(textBtn(page, T[0]!)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(rmBtn(page, T[0]!)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(boxOf(page, T[1]!)).toBeFocused();
  await boxOf(page, T[2]!).focus();
  await page.keyboard.press("Space");
  await expect.poll(() => m.updates.length).toBe(1);
  await expect(boxOf(page, T[2]!)).toBeChecked();
  await addBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(dialogOf(page).getByRole("textbox", { name: "確かめること", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(addBtn(page)).toBeFocused();
});

test("K450-UI-025 幅ごとのはみ出し：幅 375・768・1440 の詳細（200 字の長い文の行・開いた形・足す小窓が開いた形）と作る面で scrollWidth - clientWidth が 0・長い文は折り返す", async ({
  page,
}) => {
  const long = "長".repeat(200);
  await mockTestSpecs(page, { specs: [...fiveSpecs(), spec(long, { position: 6 })] });
  for (const w of WIDTHS) {
    await openHost(page, { mode: "detail", width: w, count: 6 });
    await openBtn(page).click();
    await expect(lineOf(page, long)).toBeVisible();
    expect(await overflowX(page), `詳細 幅 ${w}`).toBe(0);
    await openAdd(page);
    expect(await overflowX(page), `足す小窓 幅 ${w}`).toBe(0);
    await page.keyboard.press("Escape");
    await openHost(page, { mode: "create", width: w, n: 3 });
    await expect(lines(page)).toHaveCount(3);
    expect(await overflowX(page), `作る面 幅 ${w}`).toBe(0);
  }
});

// ---------------------------------------------------------------- 下絵との突き合わせ（確認項目の欄の中。位置と行の高さは比べない）
const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "color", "texts"];
const CTRL = ["width", "height", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
const SPEC_PAIRS: FidelityPair[] = [
  pair("li-text", ".k-f4d-specs .k-f4d-spec-text", ["font-size", "color", "line-height", "texts"]),
  pair("box", ".k-f4d-specs .k-f4d-spec-box", ["width", "height"]),
  pair("remove", '.k-f4d-specs .k-f4d-spec-list button[aria-label$="を外す"]', CTRL),
  pair("text-btn", ".k-f4d-specs .k-f4d-spec-btn", [...CTRL, "line-height"]),
  pair("acts", ".k-f4d-specs .k-f4d-spec-acts button", CTRL),
  pair("hint", ".k-f4d-specs .k-f4d-hint", TXT),
];
const DIALOG_PAIRS: FidelityPair[] = [
  pair("dialog", ".k-dialog", ["width", "background-color", "border-top-left-radius"]),
  pair("title", ".k-dialog-title", TXT),
  pair("label", ".k-dialog .k-label", TXT),
  pair("input", ".k-dialog .k-input", ["width", "font-size", "border-top-color"]),
  pair("actions", ".k-dialog-actions button", CTRL),
];
/** 下絵 f4v2-create-specs の行（features/F4/doc/views.tsx の SPEC_LINES と同じ字） */
const CREATE_LINES = [
  "請求書が宛先に届いている",
  "支払期日が 12/15 になっている",
  "請求額が明細の合計と合っている",
  "送る前に文面を目で見る",
];
type MockState = { id: string; what: string; pairs: FidelityPair[]; setup: (page: Page, w: number) => Promise<void> };
const detailOpen = async (page: Page, w: number): Promise<void> => {
  await mockTestSpecs(page, { specs: fiveSpecs() });
  await openHost(page, { mode: "detail", width: w, count: 5 });
  await openBtn(page).click();
  await expect(lines(page)).toHaveCount(5);
};
const STATES: MockState[] = [
  { id: "f4v2-specs", what: "行の字・箱・外すと足すのボタンの値", pairs: SPEC_PAIRS, setup: detailOpen },
  {
    id: "f4v2-spec-add",
    what: "足す小窓の大きさと字",
    pairs: [...SPEC_PAIRS, ...DIALOG_PAIRS],
    setup: async (page, w) => {
      await detailOpen(page, w);
      await openAdd(page);
    },
  },
  {
    id: "f4v2-spec-edit",
    what: "その場で直している行の入力（チェックの付いた行は押せない）",
    pairs: [
      ...SPEC_PAIRS,
      pair("edit", ".k-f4d-specs .k-f4d-spec-edit .k-input", ["width", "height", "font-size", "border-top-color"]),
    ],
    setup: async (page, w) => {
      await detailOpen(page, w);
      await textBtn(page, T[4]!).click();
      await expect(editor(page)).toBeVisible();
    },
  },
  {
    id: "f4v2-spec-add-error",
    what: "足す小窓で書かずに足したときの欄の下の赤い字",
    pairs: [...DIALOG_PAIRS, pair("err", ".k-dialog .k-err", ["font-size", "color", "texts"])],
    setup: async (page, w) => {
      await detailOpen(page, w);
      await openAdd(page);
      await press(page).click();
      await expect(dialogOf(page)).toContainText("確かめることを書いてください");
    },
  },
  {
    id: "f4v2-create-specs",
    what: "作る面の確認項目（チェックの箱は押せない形）の行の字・箱",
    pairs: SPEC_PAIRS,
    setup: async (page, w) => {
      // 下絵 f4v2-create-specs と同じ 4 行（同じ字・同じ並び）を画面の中に足す
      await mockTestSpecs(page);
      await openHost(page, { mode: "create", width: w });
      for (const t of CREATE_LINES) {
        await typeInto(page, t);
        await press(page).click();
        await expect(dialogOf(page)).toHaveCount(0);
      }
      await expect(lines(page)).toHaveCount(CREATE_LINES.length);
    },
  },
];
for (const s of STATES) {
  test(`K450-UI-026 下絵との突き合わせ（${s.id}）：幅 375・768・1440 で ${s.what}が下絵と同じ`, async ({ browser }) => {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(browser, s.id, w, (page) => s.setup(page, w), {
        base: "/dev/mock/f4v2",
        pairs: s.pairs,
        blur: true,
      });
      expect(rows.length, `${s.id} 幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, bad.join("\n")).toEqual([]);
    }
  });
}

// 合図 kaname:f4:open-spec-add（K-573 の「確認項目を足す」が出す）を聞いて、足す小窓を開く（作る面は聞かない）
test("K450-UI-027 合図を聞く：詳細で window に kaname:f4:open-spec-add（detail は { ticketId }）を出すと足す小窓が開く・口は 0 回。別のチケットの id・作る面では開かない", async ({
  page,
}) => {
  const m = await mockTestSpecs(page, { specs: fiveSpecs() });
  await openHost(page, { mode: "detail", count: 5 });
  const reqs = (): number => m.reads + m.adds.length + m.updates.length + m.deletes.length;
  const before = reqs();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("kaname:f4:open-spec-add", { detail: { ticketId: "00000000-0000-4000-8000-0000000000ff" } }),
    ),
  );
  await expect(dialogOf(page)).toHaveCount(0);
  await page.evaluate(
    (id) => window.dispatchEvent(new CustomEvent("kaname:f4:open-spec-add", { detail: { ticketId: id } })),
    TICKET,
  );
  await expect(dialogOf(page)).toBeVisible();
  expect(reqs(), "小窓を開くだけで口は呼ばない").toBe(before);
  const p2 = await page.context().newPage();
  await mockTestSpecs(p2);
  await openHost(p2, { mode: "create" });
  await p2.evaluate(
    (id) => window.dispatchEvent(new CustomEvent("kaname:f4:open-spec-add", { detail: { ticketId: id } })),
    TICKET,
  );
  await expect(dialogOf(p2)).toHaveCount(0);
});

// 足す小窓を外（親）から開ける口：K-571 が詳細の一番上で合図を聞き、パネルが閉じていても・パネルの無い形でも足す小窓を開けるようにする（X7）
test("K450-UI-028 外から開ける：SpecsItem に addOpen を渡すと（親が開閉を持つ）畳んだままでも足す小窓が開き、口は 0 回・自分では合図を聞かない。SpecAddOnly（小窓だけ）は開くと足せて、足すと口が 1 回・小窓が閉じて onOpenChange(false)", async ({
  page,
}) => {
  const m = await mockTestSpecs(page, { specs: fiveSpecs() });
  await openHost(page, { mode: "detail", count: 5, ext: "controlled" });
  const reqs = (): number => m.reads + m.adds.length + m.updates.length + m.deletes.length;
  const before = reqs();
  await extBtn(page).click();
  await expect(dialogOf(page)).toBeVisible();
  expect(reqs(), "外から開いても口は呼ばない（読むのは「開く」を押したときだけ）").toBe(before);
  await page.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await page.evaluate(
    (id) => window.dispatchEvent(new CustomEvent("kaname:f4:open-spec-add", { detail: { ticketId: id } })),
    TICKET,
  );
  await expect(dialogOf(page), "addOpen を渡した親が合図を聞く＝SpecsItem は自分では聞かない").toHaveCount(0);
  const p2 = await page.context().newPage();
  const m2 = await mockTestSpecs(p2, { specs: fiveSpecs() });
  await openHost(p2, { mode: "detail", count: 5, ext: "only" });
  await extBtn(p2).click();
  await expect(dialogOf(p2)).toBeVisible();
  await dialogOf(p2).getByRole("textbox", { name: "確かめること", exact: true }).fill("請求書の宛先が合っている");
  await press(p2).click();
  await expect.poll(() => m2.adds.length).toBe(1);
  await expect(dialogOf(p2)).toHaveCount(0);
  await expect(specsOf(p2)).toHaveCount(0);
});

test("K450-MK-001 共有の名前：test-spec-mock.ts が K-452 の links-mock.ts の import している名前と k452-links.spec.ts の toastOf を全部持っている", () => {
  const names = (file: string): string[] => {
    const m = readFileSync(join(HERE, file), "utf8").match(/import\s*\{([^}]+)\}\s*from\s*"\.\/test-spec-mock"/);
    expect(m, `${file} に test-spec-mock の import が無い`).not.toBeNull();
    return m![1]!
      .split(",")
      .map((s) => s.trim().replace(/^type\s+/, ""))
      .filter(Boolean);
  };
  const want = [...names("links-mock.ts"), ...names("k452-links.spec.ts")];
  expect(want.length).toBeGreaterThanOrEqual(7);
  for (const n of want)
    expect((shared as Record<string, unknown>)[n], `test-spec-mock.ts に ${n} が無い`).toBeDefined();
});

test("K450-MK-002 前の版の物が無い：features/F4/specs/・app/(dev)/dev/f4-specs/・test-spec-mock.ts に、check_kind・judge_type・off_reason・judge_types・lintTestSpecs・「抜けを点検」・「判定のしかた」が 1 つも無い", () => {
  const files = [
    ...readdirSync(join(ROOT, "apps/web/features/F4/specs")).map((f) => join(ROOT, "apps/web/features/F4/specs", f)),
    join(ROOT, "apps/web/app/(dev)/dev/f4-specs/page.tsx"),
    join(HERE, "test-spec-mock.ts"),
  ];
  expect(files.length).toBeGreaterThanOrEqual(7);
  const old = /check_kind|judge_type|off_reason|judge_types|lintTestSpecs|抜けを点検|判定のしかた/;
  for (const f of files) expect(readFileSync(f, "utf8"), `${f} に前の版の言葉が残っている`).not.toMatch(old);
});
