// K-708「チケットの設定の「状態」」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/set-stages（本番と同じ部品 features/F9/settings・代表 OK 2026-11-22）。入れ物・タブ・外枠・管理者だけの確かめは K-707。
//   ログイン・外枠・役は本物（signupViaApi・loginAs・viewerViaApi）。設定の口（K-705）と人数の口だけを網の手前で差し替える（settings-mock.ts）。
//   答えの形は 07_functional/段10-F9/土台-settings.md の 3・4 章。本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs, signupViaApi, viewerViaApi } from "../_lib/api";
import { WS_WIDTHS, matchWs } from "./f9-ws-match";
import {
  S_APPR,
  S_CHECK,
  S_DOING,
  S_DONE,
  S_HOLD,
  S_RUN,
  S_TODO,
  S_WAIT,
  err,
  mockSettings,
  msg,
  stagesTaka,
  type SMock,
} from "./settings-mock";

const PATH = "/workspace/ticket-settings";
const LIST = 'ol[aria-label="状態"]';
const DLG = ".k-dialog";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const row = (page: Page, name: string) =>
  page
    .locator(`${LIST} li.k-f9s-stage`)
    .filter({ has: page.locator(".k-f9s-pill", { hasText: new RegExp(`^${name}$`) }) });
const editBtn = (page: Page, name: string) => page.getByRole("button", { name: `${name}を直す`, exact: true });
const delBtn = (page: Page, name: string) => page.getByRole("button", { name: `${name}を消す`, exact: true });
const grip = (page: Page, name: string) => page.getByRole("button", { name: `${name}を並べ替える`, exact: true });
const edit = (page: Page, name: string) => row(page, name).locator(".k-f9s-stage-edit");
const nameBox = (page: Page, name: string) => edit(page, name).getByLabel("名前", { exact: true });
const save = (page: Page, name: string) => edit(page, name).getByRole("button", { name: "保存する", exact: true });
const names = (page: Page) => page.locator(`${LIST} .k-f9s-pill`).allTextContents();

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openStages(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(`${PATH}?tab=stages`);
  await expect(page.locator(LIST)).toBeVisible();
}
async function open(page: Page): Promise<SMock> {
  const mk = await mockSettings(page);
  await openStages(page);
  return mk;
}
/** 先方の返事待ちの「直す」を押して直す欄を開く */
async function openEdit(page: Page, name = "先方の返事待ち"): Promise<void> {
  await editBtn(page, name).click();
  await expect(edit(page, name)).toBeVisible();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
for (const w of WS_WIDTHS) {
  test(`K708-UI-001 set-stages 幅 ${w}：一覧・つまみ・色の札・消せない訳・直す欄（名前・色・やめる・保存する）・「状態を足す」の位置と大きさと字がモックと同じ（matchWs の bad が 0）`, async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const { bad, rows } = await matchWs(browser, "set-stages", w, async (page) => {
      await mockSettings(page);
      await openStages(page, w);
      await openEdit(page);
    });
    expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

// ---------------------------------------------------------------- 開く・読む
test("K708-UI-002 タブ「状態」を押すと ?tab=stages に移って状態の口を 1 回読む（種別の欄は消える）・再読み込みでも同じタブ・種別に戻ると状態の口は増えない", async ({
  page,
}) => {
  const mk = await mockSettings(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto(PATH);
  await expect(page.getByRole("tab", { name: "状態", exact: true })).not.toHaveAttribute("aria-disabled", "true");
  await page.getByRole("tab", { name: "状態", exact: true }).click();
  await expect(page).toHaveURL(/tab=stages/);
  await expect(page.locator(LIST)).toBeVisible();
  expect(mk.count("stages")).toBe(1);
  await page.reload();
  await expect(page.getByRole("tab", { name: "状態", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(LIST)).toBeVisible();
  await page.getByRole("tab", { name: "種別", exact: true }).click();
  await page.getByRole("tab", { name: "状態", exact: true }).click();
  await expect(page.locator(LIST)).toBeVisible();
  expect(mk.count("stages")).toBe(2);
});

test("K708-UI-003 一覧：上から 未着手・作業中・先方の返事待ち・保留・完了（仕組みの状態は出さない）・色の札の色・始めと終わりに消せない訳の字・説明文", async ({
  page,
}) => {
  await open(page);
  expect(await names(page)).toEqual(["未着手", "作業中", "先方の返事待ち", "保留", "完了"]);
  await expect(page.locator(LIST)).not.toContainText("確認中");
  await expect(page.locator(LIST)).not.toContainText("実行中");
  await expect(row(page, "先方の返事待ち").locator(".k-f9s-pill")).toHaveAttribute("data-tone", "amber");
  await expect(row(page, "未着手")).toContainText("始めの状態なので消せません");
  await expect(row(page, "完了")).toContainText("終わりの状態なので消せません");
  await expect(row(page, "保留").locator(".k-f9s-lock")).toHaveCount(0);
  await expect(page.getByText("上から順に、チケットの状態を選ぶ所に並びます", { exact: false })).toBeVisible();
});

test("K708-UI-004 消せない状態（未着手・完了）の「消す」は押せない形（title に訳）で押しても小窓も口も出ない・途中の状態は押せる", async ({
  page,
}) => {
  const mk = await open(page);
  for (const [n, why] of [
    ["未着手", "始めの状態なので消せません"],
    ["完了", "終わりの状態なので消せません"],
  ] as const) {
    await expect(delBtn(page, n)).toHaveAttribute("aria-disabled", "true");
    await expect(delBtn(page, n)).toHaveAttribute("title", why);
    await delBtn(page, n).click({ force: true });
  }
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.count("deleteStage")).toBe(0);
  await expect(delBtn(page, "保留")).not.toHaveAttribute("aria-disabled", "true");
});

// ---------------------------------------------------------------- 直す
test("K708-UI-005 「直す」で行が開き名前の欄（今の名前）・色（今の色が選ばれる）・「やめる」「保存する」が出る・開くのは 1 行だけ・「やめる」は口を呼ばず閉じる", async ({
  page,
}) => {
  const mk = await open(page);
  await openEdit(page);
  await expect(nameBox(page, "先方の返事待ち")).toHaveValue("先方の返事待ち");
  await expect(edit(page, "先方の返事待ち").getByRole("radio", { checked: true })).toHaveCount(1);
  await expect(edit(page, "先方の返事待ち").getByRole("radio", { name: "黄土", exact: true })).toBeChecked();
  await expect(editBtn(page, "先方の返事待ち")).toHaveCount(0);
  await openEdit(page, "保留");
  await expect(page.locator(`${LIST} .k-f9s-stage-edit`)).toHaveCount(1);
  await edit(page, "保留").getByRole("button", { name: "やめる", exact: true }).click();
  await expect(page.locator(`${LIST} .k-f9s-stage-edit`)).toHaveCount(0);
  expect(mk.count("updateStage")).toBe(0);
});

test("K708-UI-006 名前を直して保存：書く口 1 回・体は名前だけ・お知らせ「状態「待ち」を保存しました」・直す欄が閉じ一覧の名前が替わり、状態を読み直す（口 2 回）", async ({
  page,
}) => {
  const mk = await open(page);
  await openEdit(page);
  await nameBox(page, "先方の返事待ち").fill("待ち");
  await save(page, "先方の返事待ち").click();
  await expect(page.locator(".k-toast")).toContainText("状態「待ち」を保存しました");
  expect(mk.last("updateStage")?.id).toBe(S_WAIT);
  expect(mk.last("updateStage")?.body).toEqual({ name: "待ち" });
  await expect(page.locator(`${LIST} .k-f9s-stage-edit`)).toHaveCount(0);
  expect(await names(page)).toContain("待ち");
  expect(mk.count("stages")).toBe(2);
});

test("K708-UI-007 色を替えて保存：体は color_key だけ（鍵の字）・札の色が替わる。何も変えていないと「保存する」は押せない形で口を呼ばない", async ({
  page,
}) => {
  const mk = await open(page);
  await openEdit(page);
  await expect(save(page, "先方の返事待ち")).toBeDisabled();
  await save(page, "先方の返事待ち").click({ force: true });
  expect(mk.count("updateStage")).toBe(0);
  await edit(page, "先方の返事待ち").getByRole("radio", { name: "若草", exact: true }).check();
  await save(page, "先方の返事待ち").click();
  await expect(page.locator(".k-toast")).toContainText("状態「先方の返事待ち」を保存しました");
  expect(mk.last("updateStage")?.body).toEqual({ color_key: "sage" });
  await expect(row(page, "先方の返事待ち").locator(".k-f9s-pill")).toHaveAttribute("data-tone", "sage");
});

test("K708-UI-008 名前の入力：空・全角空白だけ →「名前を入れてください」・21 字 →「名前は 20 字までです」・口を呼ばず aria-invalid・直すと消える（ブラウザ標準の確かめに奪われない）", async ({
  page,
}) => {
  const mk = await open(page);
  await openEdit(page);
  await nameBox(page, "先方の返事待ち").fill("　");
  await save(page, "先方の返事待ち").click();
  await expect(edit(page, "先方の返事待ち").locator(".k-err")).toHaveText("名前を入れてください");
  await expect(nameBox(page, "先方の返事待ち")).toHaveAttribute("aria-invalid", "true");
  await nameBox(page, "先方の返事待ち").fill("あ".repeat(21));
  await save(page, "先方の返事待ち").click();
  await expect(edit(page, "先方の返事待ち").locator(".k-err")).toHaveText("名前は 20 字までです");
  expect(mk.count("updateStage")).toBe(0);
  await nameBox(page, "先方の返事待ち").fill("あ".repeat(20));
  await expect(edit(page, "先方の返事待ち").locator(".k-err")).toHaveCount(0);
});

test("K708-UI-009 口が 409 E-STG-001（同じ名前）：名前の欄の下に正本の文・直す欄は閉じず中身が残る・直して押し直せる", async ({
  page,
}) => {
  const mk = await open(page);
  await openEdit(page);
  mk.script("updateStage", err(409, "E-STG-001"));
  await nameBox(page, "先方の返事待ち").fill("作業中");
  await save(page, "先方の返事待ち").click();
  await expect(edit(page, "先方の返事待ち").locator(".k-err")).toHaveText(msg("E-STG-001"));
  await expect(nameBox(page, "先方の返事待ち")).toHaveValue("作業中");
  await nameBox(page, "先方の返事待ち").fill("待ち");
  await save(page, "先方の返事待ち").click();
  await expect(page.locator(".k-toast")).toContainText("状態「待ち」を保存しました");
  expect(mk.count("updateStage")).toBe(2);
});

test("K708-UI-010 二度押し：答えを待つ間「保存する」は押せず口は 1 回", async ({ page }) => {
  const mk = await open(page);
  await openEdit(page);
  await nameBox(page, "先方の返事待ち").fill("待ち");
  const release = mk.hold("updateStage");
  await save(page, "先方の返事待ち").click();
  await expect(save(page, "先方の返事待ち")).toBeDisabled();
  await save(page, "先方の返事待ち").click({ force: true });
  release();
  await expect(page.locator(".k-toast")).toContainText("保存しました");
  expect(mk.count("updateStage")).toBe(1);
});

test("K708-UI-011 口が 503・網の切れ：赤い箱（role=alert）に正本の文（E-PAGE-003・E-PAGE-007）・中身は残り・押し直すと保存できる（口 3 回）。404（開いている間に消された）は赤い箱に正本の文で状態を読み直して一覧から消える", async ({
  page,
}) => {
  const mk = await open(page);
  await openEdit(page);
  mk.script("updateStage", err(503, "E-PAGE-003"), "network");
  await nameBox(page, "先方の返事待ち").fill("待ち");
  await save(page, "先方の返事待ち").click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-003").split("。")[0]! })).toBeVisible();
  await save(page, "先方の返事待ち").click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-007").split("。")[0]! })).toBeVisible();
  await expect(nameBox(page, "先方の返事待ち")).toHaveValue("待ち");
  await save(page, "先方の返事待ち").click();
  await expect(page.locator(".k-toast")).toContainText("状態「待ち」を保存しました");
  expect(mk.count("updateStage")).toBe(3);
  await openEdit(page, "保留");
  mk.stages = mk.stages.filter((x) => x.id !== S_HOLD);
  await nameBox(page, "保留").fill("止め置き");
  await save(page, "保留").click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-001").split("。")[0]! })).toBeVisible();
  await expect.poll(async () => (await names(page)).includes("保留")).toBe(false);
});

test("K708-UI-012 保存していない変更のまま別のタブ（種別）を押すと小窓「保存していない変更があります」：「戻る」で直す欄に残り中身も残る・「捨てて移る」で移る。変更が無ければ出ない", async ({
  page,
}) => {
  await open(page);
  await openEdit(page);
  await page.getByRole("tab", { name: "種別", exact: true }).click();
  await expect(page).toHaveURL(/tab=kinds/);
  await page.getByRole("tab", { name: "状態", exact: true }).click();
  await openEdit(page);
  await nameBox(page, "先方の返事待ち").fill("待ち");
  await page.getByRole("tab", { name: "種別", exact: true }).click();
  const dlg = page.locator(DLG);
  await expect(dlg.getByRole("heading", { name: "保存していない変更があります" })).toBeVisible();
  await dlg.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(nameBox(page, "先方の返事待ち")).toHaveValue("待ち");
  await page.getByRole("tab", { name: "種別", exact: true }).click();
  await dlg.getByRole("button", { name: "捨てて移る", exact: true }).click();
  await expect(page).toHaveURL(/tab=kinds/);
});

// ---------------------------------------------------------------- 足す・消す
test("K708-UI-013 「状態を足す」の小窓（名前・色）で足す：口 1 回（体は name と color_key）・閉じる・新しい状態が終わりの直前に出る・お知らせ「状態「確認待ち」を足しました」・状態を読み直す", async ({
  page,
}) => {
  const mk = await open(page);
  await page.getByRole("button", { name: "状態を足す", exact: true }).click();
  const dlg = page.locator(DLG);
  await expect(dlg.getByRole("heading", { name: "状態を足す" })).toBeVisible();
  await expect(dlg.getByLabel("名前", { exact: true })).toBeFocused();
  await dlg.getByLabel("名前", { exact: true }).fill("確認待ち");
  await dlg.getByRole("radio", { name: "珊瑚", exact: true }).check();
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg).toHaveCount(0);
  expect(mk.last("createStage")?.body).toEqual({ name: "確認待ち", color_key: "coral" });
  await expect(page.locator(".k-toast")).toContainText("状態「確認待ち」を足しました");
  expect(await names(page)).toEqual(["未着手", "作業中", "先方の返事待ち", "保留", "確認待ち", "完了"]);
  expect(mk.count("stages")).toBe(2);
});

test("K708-UI-014 足す小窓の失敗：空の名前は口を呼ばない・409 E-STG-001・E-STG-002（8 つまで）は小窓の中の赤字で閉じず中身は残る・やめる・Esc は口を呼ばず焦点が「状態を足す」に戻る", async ({
  page,
}) => {
  const mk = await open(page);
  const add = page.getByRole("button", { name: "状態を足す", exact: true });
  await add.click();
  const dlg = page.locator(DLG);
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg.locator(".k-err")).toHaveText("名前を入れてください");
  expect(mk.count("createStage")).toBe(0);
  mk.script("createStage", err(409, "E-STG-001"), err(409, "E-STG-002"));
  await dlg.getByLabel("名前", { exact: true }).fill("保留");
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg.locator(".k-err")).toHaveText(msg("E-STG-001"));
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg.locator(".k-err")).toHaveText(msg("E-STG-002"));
  await expect(dlg.getByLabel("名前", { exact: true })).toHaveValue("保留");
  await dlg.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(add).toBeFocused();
  await add.click();
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  expect(mk.count("createStage")).toBe(2);
});

test("K708-UI-015 「消す」の確かめの小窓（状態の名前・元に戻せない旨）：「やめる」は口を呼ばない・「消す」で口 1 回・一覧から消えお知らせ「状態「保留」を消しました」・状態を読み直す", async ({
  page,
}) => {
  const mk = await open(page);
  await delBtn(page, "保留").click();
  const dlg = page.locator(DLG);
  await expect(dlg).toContainText("状態「保留」を消しますか");
  await dlg.getByRole("button", { name: "やめる", exact: true }).click();
  expect(mk.count("deleteStage")).toBe(0);
  await delBtn(page, "保留").click();
  await dlg.getByRole("button", { name: "消す", exact: true }).click();
  await expect(dlg).toHaveCount(0);
  expect(mk.last("deleteStage")?.id).toBe(S_HOLD);
  await expect(page.locator(".k-toast")).toContainText("状態「保留」を消しました");
  expect(await names(page)).toEqual(["未着手", "作業中", "先方の返事待ち", "完了"]);
  expect(mk.count("stages")).toBe(2);
});

test("K708-UI-016 口が 409：E-STG-005 は帯に正本の文と枚数「（4 枚）」・E-STG-003（仕組みの状態）は帯に正本の文。どちらも一覧に残り、小窓は閉じる", async ({
  page,
}) => {
  const mk = await open(page);
  mk.script("deleteStage", err(409, "E-STG-005", { ticket_count: 4 }), err(409, "E-STG-003"));
  for (const want of [`${msg("E-STG-005")}（4 枚）`, msg("E-STG-003")]) {
    await delBtn(page, "保留").click();
    await page.locator(DLG).getByRole("button", { name: "消す", exact: true }).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: want })).toBeVisible();
    expect(await names(page)).toContain("保留");
  }
  expect(mk.count("deleteStage")).toBe(2);
});

// ---------------------------------------------------------------- 並べ替え
test("K708-UI-017 キーボードで並べ替え：つまみで Enter（つかむ）→ ↑ → Enter（落とす）で書く口 1 回・体の stage_ids は仕組みの状態も含む全部（仕組みの状態は自分の場所のまま）・一覧が替わる・状態を読み直す。Esc は戻して口を呼ばない", async ({
  page,
}) => {
  const mk = await open(page);
  await grip(page, "保留").focus();
  await page.keyboard.press("Enter");
  await expect(grip(page, "保留")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Escape");
  expect(mk.count("reorderStages")).toBe(0);
  expect(await names(page)).toEqual(["未着手", "作業中", "先方の返事待ち", "保留", "完了"]);
  await grip(page, "保留").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect.poll(() => mk.count("reorderStages")).toBe(1);
  expect(mk.last("reorderStages")?.body).toEqual({
    stage_ids: [S_TODO, S_HOLD, S_CHECK, S_DOING, S_WAIT, S_RUN, S_APPR, S_DONE],
  });
  expect(await names(page)).toEqual(["未着手", "保留", "作業中", "先方の返事待ち", "完了"]);
  expect(mk.count("stages")).toBe(2);
});

test("K708-UI-018 つまみを掴んで落とす（マウス）：保留を作業中の上へ落とすと書く口 1 回・並びが替わる。始めと終わりのつまみは押せない形で、始めの上・終わりの下へは落とせず口を呼ばない", async ({
  page,
}) => {
  const mk = await open(page);
  await expect(grip(page, "未着手")).toHaveAttribute("aria-disabled", "true");
  await expect(grip(page, "完了")).toHaveAttribute("aria-disabled", "true");
  await grip(page, "保留").dragTo(row(page, "作業中"), { targetPosition: { x: 40, y: 4 } });
  await expect.poll(() => mk.count("reorderStages")).toBe(1);
  expect(mk.last("reorderStages")?.body).toEqual({
    stage_ids: [S_TODO, S_HOLD, S_CHECK, S_DOING, S_WAIT, S_RUN, S_APPR, S_DONE],
  });
  await grip(page, "作業中").dragTo(row(page, "未着手"), { targetPosition: { x: 40, y: 4 } });
  await grip(page, "作業中").dragTo(row(page, "完了"), { targetPosition: { x: 40, y: 40 } });
  expect(mk.count("reorderStages")).toBe(1);
});

test("K708-UI-019 並べ替えの失敗：409 E-STG-006（並びが古い）は帯に正本の文・503 は赤い箱。どちらも並びを元に戻して（見える失敗）状態を読み直す。答えを待つ間は並べ替えのつまみが押せず口は 1 回", async ({
  page,
}) => {
  const mk = await open(page);
  mk.script("reorderStages", err(409, "E-STG-006"), err(503, "E-PAGE-003"));
  for (const want of [msg("E-STG-006"), msg("E-PAGE-003").split("。")[0]!]) {
    await grip(page, "保留").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: want })).toBeVisible();
    await expect.poll(async () => names(page)).toEqual(["未着手", "作業中", "先方の返事待ち", "保留", "完了"]);
  }
  expect(mk.count("reorderStages")).toBe(2);
  const release = mk.hold("reorderStages");
  await grip(page, "保留").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(grip(page, "作業中")).toBeDisabled();
  release();
  await expect.poll(() => mk.count("reorderStages")).toBe(3);
});

test("K708-UI-025 足す・消す・並べ替えの口が失敗：並べ替えが網の切れ・403 なら並びを元に戻して赤い箱・404 なら読み直して一覧から消える／足すが 403・503・網の切れなら小窓の上の赤い箱で閉じず中身は残り／消すが 403・503・網の切れなら帯の赤い箱で状態は一覧に残り、404 なら帯に正本の文で読み直して一覧から消える", async ({
  page,
}) => {
  const mk = await open(page);
  const original = ["未着手", "作業中", "先方の返事待ち", "保留", "完了"];
  const moveHold = async () => {
    await grip(page, "保留").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
  };
  mk.script("reorderStages", "network", err(403, "E-PAGE-002"), err(404, "E-PAGE-001"));
  for (const code of ["E-PAGE-007", "E-PAGE-002"]) {
    await moveHold();
    await expect(page.getByRole("alert").filter({ hasText: msg(code).split("。")[0]! })).toBeVisible();
    await expect.poll(async () => names(page)).toEqual(original);
  }
  mk.stages = mk.stages.filter((x) => x.id !== S_HOLD);
  await moveHold();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-001").split("。")[0]! })).toBeVisible();
  await expect.poll(async () => names(page)).toEqual(["未着手", "作業中", "先方の返事待ち", "完了"]);
  expect(mk.count("reorderStages")).toBe(3);
  await page.getByRole("button", { name: "状態を足す", exact: true }).click();
  const dlg = page.locator(DLG);
  await dlg.getByLabel("名前", { exact: true }).fill("確認待ち");
  mk.script("createStage", err(503, "E-PAGE-003"), "network", err(403, "E-PAGE-002"));
  for (const code of ["E-PAGE-003", "E-PAGE-007", "E-PAGE-002"]) {
    await dlg.getByRole("button", { name: "足す", exact: true }).click();
    await expect(dlg.getByRole("alert").filter({ hasText: msg(code).split("。")[0]! })).toBeVisible();
    await expect(dlg.getByLabel("名前", { exact: true })).toHaveValue("確認待ち");
  }
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg).toHaveCount(0);
  expect(mk.count("createStage")).toBe(4);
  mk.script("deleteStage", err(503, "E-PAGE-003"), "network", err(403, "E-PAGE-002"), err(404, "E-PAGE-001"));
  for (const code of ["E-PAGE-003", "E-PAGE-007", "E-PAGE-002"]) {
    await delBtn(page, "先方の返事待ち").click();
    await page.locator(DLG).getByRole("button", { name: "消す", exact: true }).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: msg(code).split("。")[0]! })).toBeVisible();
    expect(await names(page)).toContain("先方の返事待ち");
  }
  mk.stages = mk.stages.filter((x) => x.id !== S_WAIT);
  await delBtn(page, "先方の返事待ち").click();
  await page.locator(DLG).getByRole("button", { name: "消す", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-001").split("。")[0]! })).toBeVisible();
  await expect.poll(async () => names(page)).not.toContain("先方の返事待ち");
  expect(mk.count("deleteStage")).toBe(4);
});

// ---------------------------------------------------------------- 権限・読み込み・幅
test("K708-UI-020 管理者でない人（閲覧のみ）が ?tab=stages を直に開くと「この画面を見る権限がありません」・状態の口は 0 回", async ({
  page,
}) => {
  const v = await viewerViaApi();
  const mk = await mockSettings(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, v.token);
  await page.goto(`${PATH}?tab=stages`);
  await expect(page.locator('[data-code="E-PAGE-002"]')).toBeVisible();
  await expect(page.locator(LIST)).toHaveCount(0);
  expect(mk.count("stages")).toBe(0);
});

test("K708-UI-021 読み込み中は「読み込んでいます…」・状態が 503 のときは読めなかった旨と「もう一度読む」で読み直して一覧が出る（口 2 回）", async ({
  page,
}) => {
  const mk = await mockSettings(page);
  const release = mk.hold("stages");
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto(`${PATH}?tab=stages`);
  await expect(page.getByRole("status", { name: "読み込んでいます…" })).toBeVisible();
  mk.script("stages", err(503, "E-PAGE-003"));
  release();
  await expect(page.locator('[data-state="error"]')).toBeVisible();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(page.locator(LIST)).toBeVisible();
  expect(mk.count("stages")).toBe(2);
});

test("K708-UI-022 状態の名前に HTML が入っていても文字として出て動かない（img も作られない）", async ({ page }) => {
  const stages = stagesTaka();
  stages.find((x) => x.id === S_DOING)!.name = '<img src=x onerror="window.__x=1">作業中';
  await mockSettings(page, { stages });
  await openStages(page);
  await expect(page.locator(`${LIST} .k-f9s-pill`).nth(1)).toHaveText('<img src=x onerror="window.__x=1">作業中');
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator(`${LIST} img`).count()).toBe(0);
});

for (const w of WIDTHS) {
  test(`K708-UI-023 幅 ${w}：横のはみ出し 0（数値）・直す欄・足す小窓を開いても 0`, async ({ page }) => {
    await mockSettings(page);
    await openStages(page, w);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await openEdit(page);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "状態を足す", exact: true }).click();
    await expect(page.locator(DLG)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
}

test("K708-UI-024 キーボードだけ：つまみ・直す・消すに Tab で届き、直す欄を開いて Tab を 20 回押しても焦点が小窓や画面の外へ出ない（足す小窓の中では外へ出ない）", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "状態を足す", exact: true }).click();
  for (let i = 0; i < 20; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".k-dialog")))).toBe(true);
  await page.keyboard.press("Escape");
  await editBtn(page, "保留").focus();
  await page.keyboard.press("Enter");
  await expect(edit(page, "保留")).toBeVisible();
  await expect(nameBox(page, "保留")).toBeVisible();
});
