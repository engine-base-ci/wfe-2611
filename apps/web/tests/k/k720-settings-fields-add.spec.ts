// K-720「項目を足す・消す（小窓つき）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/set-field-add・set-field-delete（下絵 v2 に無かった物をこの葉が足した・本番と同じ部品 features/F9/settings/field-dialogs.tsx・
//   代表がまだ見ていない絵＝字は仮）。モックとの比べ方は f9-ws-match.ts の matchWs。入れ物・タブ・外枠・読む・直すは K-707・K-709。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。設定の口（K-706 の足す・K-717 の消す）と種別の口・人数の口だけ網の手前で差し替える（settings-mock.ts）。
//   答えの形は 07_functional/段10-F9/土台-settings.md の 3・4 章。本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { WS_WIDTHS, matchWs } from "./f9-ws-match";
import {
  F_AMOUNT,
  F_NEW,
  F_PJ,
  K_ASK,
  K_BILL,
  K_BUG,
  K_MTG,
  K_TASK,
  err,
  fieldsTaka,
  kindsTaka,
  mockSettings,
  msg,
  type SMock,
} from "./settings-mock";

const PATH = "/workspace/ticket-settings";
const LIST = 'ul[aria-label="会社が足した項目"]';
const FORM = (name: string) => `form[aria-label="項目「${name}」を直す"]`;
const DLG = ".k-dialog";
const TOAST = ".k-toast";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const first = (s: string) => s.split("。")[0]!;
const addBtn = (p: Page) => p.getByRole("button", { name: "項目を足す", exact: true });
const delBtn = (p: Page) => p.getByRole("button", { name: "この項目を消す…", exact: true });
const addDlg = (p: Page) => p.locator(DLG).filter({ has: p.getByRole("heading", { name: "項目を足す", exact: true }) });
const delDlg = (p: Page, name: string) =>
  p.getByRole("alertdialog", { name: `項目「${name}」を消しますか`, exact: true });
const nameOf = (d: Locator) => d.getByRole("textbox", { name: "名前", exact: true });
const goBtn = (d: Locator) => d.getByRole("button", { name: "足す", exact: true });
const optBoxes = (d: Locator) => d.getByRole("textbox", { name: /^選ぶ物 \d+$/ });
const kindsOf = (p: Page, d: Locator) =>
  d.locator("fieldset", { has: p.getByText("どの種別で出すか", { exact: true }) });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openField(page: Page, id = F_PJ, name = "PJコード", width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(`${PATH}?tab=fields&id=${id}`);
  await expect(page.locator(FORM(name))).toBeVisible();
}
async function open(page: Page, id = F_PJ, name = "PJコード"): Promise<SMock> {
  const mk = await mockSettings(page);
  await openField(page, id, name);
  return mk;
}
async function openAdd(page: Page): Promise<Locator> {
  await addBtn(page).click();
  const d = addDlg(page);
  await expect(d).toBeVisible();
  return d;
}
async function chooseType(page: Page, d: Locator, label: string): Promise<void> {
  await d.getByRole("combobox", { name: "型", exact: true }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const STATES: Record<string, (page: Page, w: number) => Promise<void>> = {
  "set-field-add": async (page, w) => {
    await mockSettings(page);
    await openField(page, F_PJ, "PJコード", w);
    const d = await openAdd(page);
    await nameOf(d).fill("取引先の区分");
    await chooseType(page, d, "1 つ選ぶ");
    await optBoxes(d).first().fill("既存");
    await d.getByRole("button", { name: "選ぶ物を足す", exact: true }).click();
    await optBoxes(d).last().fill("新規");
    const ks = kindsOf(page, d);
    for (const k of ["タスク", "不具合", "打ち合わせ"])
      await ks.getByRole("checkbox", { name: k, exact: true }).uncheck();
  },
  "set-field-delete": async (page, w) => {
    await mockSettings(page);
    await openField(page, F_PJ, "PJコード", w);
    await delBtn(page).click();
    await expect(delDlg(page, "PJコード")).toBeVisible();
    // 幅 375・768 は「この項目を消す…」が画面の下で、押すと画面が下へ動く（モックは動かない）。比べる前に上へ戻す
    await page.evaluate(() => window.scrollTo(0, 0));
  },
};
// 小窓の後ろの項目の欄は K-709 の K709-UI-001 と同じ訳で options・acts の縦の位置を比べない（型の固定の文がモックに無い・K-709 の決め fc191f63ed）
const UI001_SKIP = ["options:y", "acts:y"] as const;
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of WS_WIDTHS) {
    test(`K720-UI-001 ${id} 幅 ${w}：小窓の位置と大きさと字がモックと同じ（matchWs の bad が 0）`, async ({
      browser,
    }) => {
      const { bad, rows } = await matchWs(
        browser,
        id,
        w,
        async (page) => {
          await drive(page, w);
        },
        { skip: UI001_SKIP },
      );
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 項目を足す
test("K720-UI-002 「項目を足す」「この項目を消す…」が押せる形になり（aria-disabled が無い）、押すと小窓が開く：口は 1 回も呼ばない・項目の読みも増えない", async ({
  page,
}) => {
  const mk = await open(page);
  await expect(addBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(delBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  const before = mk.calls.length;
  await openAdd(page);
  await page.keyboard.press("Escape");
  await delBtn(page).click();
  await expect(delDlg(page, "PJコード")).toBeVisible();
  expect(mk.calls.length).toBe(before);
});

test("K720-UI-003 足す小窓の初めの形：名前の欄に焦点・型は「1 行」・選ぶ物の欄は無い・必須は外れ・説明は空・どの種別で出すかは今ある 5 つ全部にチェック", async ({
  page,
}) => {
  await open(page);
  const d = await openAdd(page);
  await expect(nameOf(d)).toBeFocused();
  await expect(d.getByRole("combobox", { name: "型", exact: true })).toContainText("1 行");
  await expect(d.getByText("選ぶ物", { exact: true })).toHaveCount(0);
  await expect(
    d.getByRole("checkbox", { name: "必須にする（入れないとチケットを作れません）", exact: true }),
  ).not.toBeChecked();
  await expect(d.getByLabel("説明", { exact: true })).toHaveValue("");
  await expect(kindsOf(page, d).getByRole("checkbox", { checked: true })).toHaveCount(5);
});

test("K720-UI-004 型を「1 つ選ぶ」「複数選ぶ」にすると選ぶ物の欄が空の 1 行つきで出る・「選ぶ物を足す」で増え「外す」で減る・ほかの型にすると欄が消える", async ({
  page,
}) => {
  await open(page);
  const d = await openAdd(page);
  await chooseType(page, d, "1 つ選ぶ");
  await expect(optBoxes(d)).toHaveCount(1);
  await d.getByRole("button", { name: "選ぶ物を足す", exact: true }).click();
  await expect(optBoxes(d)).toHaveCount(2);
  await expect(optBoxes(d).last()).toBeFocused();
  await d.getByRole("button", { name: "選ぶ物 1を外す", exact: true }).click();
  await expect(optBoxes(d)).toHaveCount(1);
  await chooseType(page, d, "複数選ぶ");
  await expect(optBoxes(d)).toHaveCount(1);
  await chooseType(page, d, "日付");
  await expect(optBoxes(d)).toHaveCount(0);
});

test("K720-UI-005 足す（1 行の型）：名前だけ入れて「足す」→ 口 1 回（体は name・field_type・全部の種別の並びの kind_ids・required=false だけ・説明と選ぶ物は無い・冪等の鍵あり）", async ({
  page,
}) => {
  const mk = await open(page);
  const d = await openAdd(page);
  await nameOf(d).fill("　取引先の区分　");
  await goBtn(d).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.count("createField")).toBe(1);
  const c = mk.last("createField")!;
  expect(c.body).toEqual({
    name: "取引先の区分",
    field_type: "short_text",
    kind_ids: kindsTaka().map((k) => k.id),
    required: false,
  });
  expect(c.key).toBeTruthy();
});

test("K720-UI-006 足す（1 つ選ぶ・必須・説明・種別を絞る）：体は選ぶ物を並びの順に名前だけ（id なし）・必須 true・説明・選んだ種別だけを全部の並びの順で送る", async ({
  page,
}) => {
  const mk = await open(page);
  const d = await openAdd(page);
  await nameOf(d).fill("取引先の区分");
  await chooseType(page, d, "1 つ選ぶ");
  await optBoxes(d).first().fill("既存");
  await d.getByRole("button", { name: "選ぶ物を足す", exact: true }).click();
  await optBoxes(d).last().fill(" 新規 ");
  await d.getByRole("checkbox", { name: "必須にする（入れないとチケットを作れません）", exact: true }).check();
  await d.getByLabel("説明", { exact: true }).fill("営業が見立てを選びます");
  const ks = kindsOf(page, d);
  for (const k of ["タスク", "不具合", "打ち合わせ"])
    await ks.getByRole("checkbox", { name: k, exact: true }).uncheck();
  await goBtn(d).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.last("createField")?.body).toEqual({
    name: "取引先の区分",
    field_type: "select",
    kind_ids: [K_BILL, K_ASK],
    required: true,
    description: "営業が見立てを選びます",
    options: [{ name: "既存" }, { name: "新規" }],
  });
});

test("K720-UI-007 足したあと：小窓が閉じ・お知らせ「項目「取引先の区分」を足しました」（仮）・項目を読み直して（口 2 回・種別は読み直さない）新しい項目が一覧に出て選ばれ（?id=）、右の欄に出る", async ({
  page,
}) => {
  const mk = await open(page);
  const d = await openAdd(page);
  await nameOf(d).fill("取引先の区分");
  await goBtn(d).click();
  await expect(page.locator(TOAST)).toContainText("項目「取引先の区分」を足しました");
  await expect(page).toHaveURL(new RegExp(`id=${F_NEW}`));
  await expect(page.locator(LIST).getByRole("link", { name: /^取引先の区分/ })).toHaveAttribute("aria-current", "true");
  await expect(page.locator(FORM("取引先の区分"))).toBeVisible();
  await expect(page.getByRole("button", { name: "保存する", exact: true })).toBeDisabled();
  expect(mk.count("fields")).toBe(2);
  expect(mk.count("kinds")).toBe(1);
  expect(mk.fields.some((f) => f.id === F_NEW)).toBe(true);
});

test("K720-UI-008 入力の確かめ（JS が先に働く・口を呼ばない）：名前が空・41 字・選ぶ物が空の名前・同じ名前・種別が 0 の文がその欄の下に出る（aria-invalid）・直すと消える・小窓は閉じない", async ({
  page,
}) => {
  const mk = await open(page);
  const d = await openAdd(page);
  await goBtn(d).click();
  await expect(d.locator(".k-err")).toHaveText("名前を入れてください");
  await expect(nameOf(d)).toHaveAttribute("aria-invalid", "true");
  await nameOf(d).fill("あ".repeat(41));
  await goBtn(d).click();
  await expect(d.locator(".k-err")).toHaveText("名前は 40 字までです");
  await nameOf(d).fill("取引先の区分");
  await expect(d.locator(".k-err")).toHaveCount(0);
  await chooseType(page, d, "1 つ選ぶ");
  await goBtn(d).click();
  await expect(d.locator(".k-err")).toHaveText("選ぶ物の名前を入れてください");
  await optBoxes(d).first().fill("既存");
  await d.getByRole("button", { name: "選ぶ物を足す", exact: true }).click();
  await optBoxes(d).last().fill("既存");
  await goBtn(d).click();
  await expect(d.locator(".k-err")).toHaveText("同じ名前の選ぶ物があります");
  await optBoxes(d).last().fill("新規");
  const ks = kindsOf(page, d);
  for (const k of ["タスク", "請求", "問い合わせ", "不具合", "打ち合わせ"])
    await ks.getByRole("checkbox", { name: k, exact: true }).uncheck();
  await goBtn(d).click();
  await expect(ks.locator(".k-err")).toHaveText("出す種別を 1 つ以上選んでください");
  expect(mk.count("createField")).toBe(0);
  await expect(addDlg(page)).toBeVisible();
  await ks.getByRole("checkbox", { name: "請求", exact: true }).check();
  await expect(ks.locator(".k-err")).toHaveCount(0);
});

test("K720-UI-009 口が 409 E-FMS-001（同じ名前）：名前の欄の下に正本の文・小窓は閉じず中身は残る・直して押し直すと通る（口 2 回）", async ({
  page,
}) => {
  const mk = await open(page);
  mk.script("createField", err(409, "E-FMS-001"));
  const d = await openAdd(page);
  await nameOf(d).fill("備考");
  await goBtn(d).click();
  await expect(d.locator(".k-err")).toHaveText(msg("E-FMS-001"));
  await expect(nameOf(d)).toHaveValue("備考");
  await nameOf(d).fill("備考 2");
  await goBtn(d).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.count("createField")).toBe(2);
});

test("K720-UI-010 口が 409 E-FMS-004（同じ名前の選ぶ物）：選ぶ物の欄の下に正本の文・選ぶ物は残る", async ({ page }) => {
  const mk = await open(page);
  mk.script("createField", err(409, "E-FMS-004"));
  const d = await openAdd(page);
  await nameOf(d).fill("取引先の区分");
  await chooseType(page, d, "複数選ぶ");
  await optBoxes(d).first().fill("既存");
  await goBtn(d).click();
  await expect(d.locator("fieldset .k-err").first()).toHaveText(msg("E-FMS-004"));
  await expect(optBoxes(d).first()).toHaveValue("既存");
  expect(mk.count("createField")).toBe(1);
});

test("K720-UI-011 口が 404（開いている間に種別が消された）：小窓の赤い箱に E-PAGE-001 の文・種別を読み直して消えた種別のチェックが無くなる・中身は残り、押し直すと残った種別だけで通る", async ({
  page,
}) => {
  const mk = await open(page);
  const d = await openAdd(page);
  await nameOf(d).fill("取引先の区分");
  mk.kinds = mk.kinds.filter((k) => k.id !== K_MTG);
  mk.script("createField", err(404, "E-PAGE-001"));
  await goBtn(d).click();
  await expect(d.getByRole("alert")).toContainText(first(msg("E-PAGE-001")));
  await expect(kindsOf(page, d).getByRole("checkbox", { name: "打ち合わせ", exact: true })).toHaveCount(0);
  expect(mk.count("kinds")).toBe(2);
  await expect(nameOf(d)).toHaveValue("取引先の区分");
  await goBtn(d).click();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.count("createField")).toBe(2);
  expect(mk.last("createField")?.body["kind_ids"]).toEqual([K_TASK, K_BILL, K_ASK, K_BUG]);
});

for (const [name, reply, code] of [
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002"],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003"],
  ["網の切れ", "network", "E-PAGE-007"],
] as const)
  test(`K720-UI-012 足す口が失敗（${name}）：小窓の赤い箱に ${code} の文・書いた中身は残り押し直せる・通れば閉じる`, async ({
    page,
  }) => {
    const mk = await open(page);
    mk.script("createField", reply);
    const d = await openAdd(page);
    await nameOf(d).fill("失敗のあとで足す");
    await goBtn(d).click();
    await expect(d.getByRole("alert")).toContainText(first(msg(code)));
    await expect(nameOf(d)).toHaveValue("失敗のあとで足す");
    await goBtn(d).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    expect(mk.count("createField")).toBe(2);
  });

test("K720-UI-013 二度押し：足す口の答えを止めた間に「足す」を 2 回押しても口は 1 回・ボタンは押せない（項目は 1 つしかできない）", async ({
  page,
}) => {
  const mk = await open(page);
  const d = await openAdd(page);
  await nameOf(d).fill("二度押し");
  const release = mk.hold("createField");
  await goBtn(d).click();
  await expect(goBtn(d)).toBeDisabled();
  await goBtn(d)
    .click({ force: true })
    .catch(() => undefined);
  expect(mk.count("createField")).toBe(1);
  release();
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.count("createField")).toBe(1);
});

test("K720-UI-014 やめる・Esc・右上の×：どれも口を呼ばず閉じ、焦点は「項目を足す」に戻り、開き直すと小窓は空（入れた字は捨てる）", async ({
  page,
}) => {
  const mk = await open(page);
  for (const how of ["やめる", "Escape", "閉じる"]) {
    const d = await openAdd(page);
    await nameOf(d).fill("途中でやめる");
    if (how === "Escape") await page.keyboard.press("Escape");
    else await d.getByRole("button", { name: how, exact: true }).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect(addBtn(page)).toBeFocused();
  }
  const again = await openAdd(page);
  await expect(nameOf(again)).toHaveValue("");
  expect(mk.count("createField")).toBe(0);
});

test("K720-UI-015 直している途中で足したとき：足したあとの移りで「保存していない変更があります」が出て、「戻る」なら今の項目の直しが残る・足した項目は一覧にある", async ({
  page,
}) => {
  await open(page, F_AMOUNT, "請求額");
  await page.locator(FORM("請求額")).getByRole("textbox", { name: "名前", exact: true }).fill("請求の額");
  const d = await openAdd(page);
  await nameOf(d).fill("取引先の区分");
  await goBtn(d).click();
  const guard = page
    .locator(DLG)
    .filter({ has: page.getByRole("heading", { name: "保存していない変更があります", exact: true }) });
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.locator(FORM("請求額")).getByRole("textbox", { name: "名前", exact: true })).toHaveValue(
    "請求の額",
  );
  await expect(page.locator(LIST).getByRole("link", { name: /^取引先の区分/ })).toBeVisible();
});

test("K720-UI-016 項目が 0 件の会社：「会社が足した項目はまだありません」の下から「項目を足す」で足せて、足すと右の欄が出る（押せる形）", async ({
  page,
}) => {
  const mk = await mockSettings(page, { fields: [] });
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto(`${PATH}?tab=fields`);
  await expect(page.getByText("会社が足した項目はまだありません", { exact: true })).toBeVisible();
  const d = await openAdd(page);
  await nameOf(d).fill("最初の項目");
  await goBtn(d).click();
  await expect(page.locator(FORM("最初の項目"))).toBeVisible();
  expect(mk.count("createField")).toBe(1);
});

// ---------------------------------------------------------------- 項目を消す
test("K720-UI-017 「この項目を消す…」：確かめの小窓（焦点は「やめる」）に「N 件のチケットに入っている値が見えなくなります。」と「消すと元に戻せません。」・値が 0 件の項目には前の 1 行が無い・口は呼ばない", async ({
  page,
}) => {
  const mk = await open(page);
  await delBtn(page).click();
  const a = delDlg(page, "PJコード");
  await expect(a).toContainText("3 件のチケットに入っている値が見えなくなります。");
  await expect(a).toContainText("消すと元に戻せません。");
  await expect(a.getByRole("button", { name: "やめる", exact: true })).toBeFocused();
  await a.getByRole("button", { name: "やめる", exact: true }).click();
  await page
    .locator(LIST)
    .getByRole("link", { name: /^請求額/ })
    .click();
  await delBtn(page).click();
  const b = delDlg(page, "請求額");
  await expect(b).toContainText("消すと元に戻せません。");
  await expect(b).not.toContainText("見えなくなります");
  expect(mk.count("deleteField")).toBe(0);
});

test("K720-UI-018 消す確かめを「やめる」・Esc で閉じる：口は呼ばず、焦点は「この項目を消す…」に戻り、項目は一覧に残る", async ({
  page,
}) => {
  const mk = await open(page);
  await delBtn(page).click();
  await delDlg(page, "PJコード").getByRole("button", { name: "やめる", exact: true }).click();
  await expect(delBtn(page)).toBeFocused();
  await delBtn(page).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(delBtn(page)).toBeFocused();
  expect(mk.count("deleteField")).toBe(0);
  await expect(page.locator(LIST).getByRole("link")).toHaveCount(5);
});

test("K720-UI-019 「消す」：口 1 回（DELETE /ticket-fields/<id>）・小窓が閉じ・お知らせ「項目「PJコード」を消しました」（仮）・項目を読み直して（口 2 回）一覧から無くなり、先頭の項目が選ばれる", async ({
  page,
}) => {
  const mk = await open(page);
  await delBtn(page).click();
  await delDlg(page, "PJコード").getByRole("button", { name: "消す", exact: true }).click();
  await expect(page.locator(TOAST)).toContainText("項目「PJコード」を消しました");
  expect(mk.count("deleteField")).toBe(1);
  expect(mk.last("deleteField")?.id).toBe(F_PJ);
  expect(mk.count("fields")).toBe(2);
  await expect(page.locator(LIST).getByRole("link")).toHaveCount(4);
  await expect(page.locator(LIST).getByRole("link", { name: /^PJコード/ })).toHaveCount(0);
  await expect(page.locator(LIST).getByRole("link").first()).toHaveAttribute("aria-current", "true");
  await expect(page.locator(FORM("請求額"))).toBeVisible();
});

test("K720-UI-020 口が 404（もう消されていた）：確かめの小窓の中の赤い箱に E-PAGE-001 の文・項目を読み直して一覧から消える・「やめる」で閉じる", async ({
  page,
}) => {
  const mk = await open(page);
  await delBtn(page).click();
  mk.fields = mk.fields.filter((f) => f.id !== F_PJ);
  mk.script("deleteField", err(404, "E-PAGE-001"));
  const a = delDlg(page, "PJコード");
  await a.getByRole("button", { name: "消す", exact: true }).click();
  await expect(a.getByRole("alert")).toContainText(first(msg("E-PAGE-001")));
  await expect(page.locator(LIST).getByRole("link", { name: /^PJコード/ })).toHaveCount(0);
  await a.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

for (const [name, reply, code] of [
  ["403", err(403, "FORBIDDEN"), "E-PAGE-002"],
  ["503", err(503, "E-PAGE-003"), "E-PAGE-003"],
  ["網の切れ", "network", "E-PAGE-007"],
] as const)
  test(`K720-UI-021 消す口が失敗（${name}）：確かめの小窓の中の赤い箱に ${code} の文・項目は一覧に残り・押し直すと消える`, async ({
    page,
  }) => {
    const mk = await open(page);
    mk.script("deleteField", reply);
    await delBtn(page).click();
    const a = delDlg(page, "PJコード");
    await a.getByRole("button", { name: "消す", exact: true }).click();
    await expect(a.getByRole("alert")).toContainText(first(msg(code)));
    await expect(page.locator(LIST).getByRole("link", { name: /^PJコード/, includeHidden: true })).toBeVisible();
    await a.getByRole("button", { name: "消す", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(mk.count("deleteField")).toBe(2);
  });

test("K720-UI-022 二度押し：消す口の答えを止めた間に「消す」を 2 回押しても口は 1 回・小窓のボタンは押せない", async ({
  page,
}) => {
  const mk = await open(page);
  await delBtn(page).click();
  const a = delDlg(page, "PJコード");
  const release = mk.hold("deleteField");
  const go = a.getByRole("button", { name: "消す", exact: true });
  await go.click();
  await expect(go).toBeDisabled();
  await go.click({ force: true }).catch(() => undefined);
  expect(mk.count("deleteField")).toBe(1);
  release();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(mk.count("deleteField")).toBe(1);
});

// ---------------------------------------------------------------- 守り・幅・キーボード
test("K720-UI-023 項目・種別の名前に HTML が入っていても、足す小窓・消す確かめに文字として出て動かない（img も作られない）・送る名前は打ったとおりの字", async ({
  page,
}) => {
  const fields = fieldsTaka();
  fields.find((f) => f.id === F_PJ)!.name = '<img src=x onerror="window.__x=1">PJ';
  const kinds = kindsTaka();
  kinds[0]!.name = "<i>タスク</i>";
  const mk = await mockSettings(page, { fields, kinds });
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto(`${PATH}?tab=fields`);
  await expect(page.locator(LIST)).toBeVisible();
  await delBtn(page).click();
  await expect(page.getByRole("alertdialog")).toContainText('項目「<img src=x onerror="window.__x=1">PJ」を消しますか');
  await page.keyboard.press("Escape");
  const d = await openAdd(page);
  await expect(kindsOf(page, d).getByText("<i>タスク</i>", { exact: true })).toBeVisible();
  await nameOf(d).fill("<b>太字</b>");
  await goBtn(d).click();
  expect(mk.last("createField")?.body["name"]).toBe("<b>太字</b>");
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator("form img, .k-dialog img").count()).toBe(0);
});

for (const w of WIDTHS) {
  test(`K720-UI-024 幅 ${w}：足す小窓（長い種別名・選ぶ型・選ぶ物 3 つ）と消す確かめを開いても横のはみ出し 0（数値）・小窓が画面の中に収まる`, async ({
    page,
  }) => {
    const kinds = kindsTaka();
    kinds[1]!.name = "とても長い種別の名前".repeat(3);
    await mockSettings(page, { kinds });
    await openField(page, F_PJ, "PJコード", w);
    const d = await openAdd(page);
    await chooseType(page, d, "1 つ選ぶ");
    await d.getByRole("button", { name: "選ぶ物を足す", exact: true }).click();
    await d.getByRole("button", { name: "選ぶ物を足す", exact: true }).click();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    const box = (await d.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w);
    await page.keyboard.press("Escape");
    await delBtn(page).click();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
}

test("K720-UI-025 キーボードだけ：「項目を足す」に焦点して Enter で小窓・名前に焦点・Tab を 30 回押しても焦点が小窓の外へ出ない・Esc で閉じて焦点が戻る", async ({
  page,
}) => {
  await open(page);
  await addBtn(page).focus();
  await page.keyboard.press("Enter");
  const d = addDlg(page);
  await expect(nameOf(d)).toBeFocused();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    // 小窓の端の見えない番（focus guard）に一瞬焦点が乗り、すぐ小窓の中へ戻る。戻るのを待って確かめる
    await expect
      .poll(() => page.evaluate(() => Boolean(document.activeElement?.closest(".k-dialog"))), {
        message: `Tab ${i + 1} 回目`,
      })
      .toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(addBtn(page)).toBeFocused();
});
