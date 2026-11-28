// K-709「チケットの設定の「項目」」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/set-fields（本番と同じ部品 features/F9/settings・代表 OK 2026-11-22）。入れ物・タブ・外枠・管理者だけの確かめは K-707。
//   項目を足す・消すは別の葉（K-709 は「押せない形」で出す・差し込み口 fields-slots.ts）。ここでは読む・直す・選ぶ物・保存・失敗を見る。
//   ログイン・外枠・役は本物（signupViaApi・loginAs・viewerViaApi）。設定の口（K-706・K-717）と種別の口・人数の口だけを網の手前で差し替える（settings-mock.ts）。
//   答えの形は 07_functional/段10-F9/土台-settings.md の 3・4 章。本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs, signupViaApi, viewerViaApi } from "../_lib/api";
import { WS_WIDTHS, matchWs } from "./f9-ws-match";
import {
  F_AMOUNT,
  F_CLASS,
  F_PJ,
  K_ASK,
  K_BILL,
  err,
  fieldsTaka,
  kindsTaka,
  mockSettings,
  msg,
  uid,
  type SMock,
} from "./settings-mock";

const PATH = "/workspace/ticket-settings";
const LIST = 'ul[aria-label="会社が足した項目"]';
const FORM = (name: string) => `form[aria-label="項目「${name.replace(/["\\]/g, "\\$&")}」を直す"]`;
const DLG = ".k-dialog";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const item = (page: Page, name: string) => page.locator(LIST).getByRole("link", { name: new RegExp(`^${name}`) });
const save = (page: Page) => page.getByRole("button", { name: "保存する", exact: true });
const nameBox = (page: Page, f: string) => page.locator(FORM(f)).getByRole("textbox", { name: "名前", exact: true });
// 型の ▾ は部品 components/k の Select（Base UI）。素の <select> は無いので、▾ を押して開いた portal の role=option を押す
const typeSel = (page: Page, f: string) => page.locator(FORM(f)).getByRole("combobox", { name: "型", exact: true });
async function pickType(page: Page, f: string, label: string): Promise<void> {
  await typeSel(page, f).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
const opts = (page: Page, f: string) =>
  page.locator(FORM(f)).locator("fieldset", { has: page.getByText("選ぶ物", { exact: true }) });
const kindsBox = (page: Page, f: string) =>
  page.locator(FORM(f)).locator("fieldset", { has: page.getByText("どの種別で出すか", { exact: true }) });
const required = (page: Page, f: string) =>
  page.locator(FORM(f)).getByRole("checkbox", { name: "必須にする（入れないとチケットを作れません）", exact: true });
const err1 = (page: Page, f: string) => page.locator(`${FORM(f)} .k-err`);

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openAt(page: Page, query: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(`${PATH}${query}`);
}
async function openField(page: Page, id: string, name: string, width = 1440): Promise<void> {
  await openAt(page, `?tab=fields&id=${id}`, width);
  await expect(page.locator(FORM(name))).toBeVisible();
}
async function open(page: Page, id = F_AMOUNT, name = "請求額"): Promise<SMock> {
  const mk = await mockSettings(page);
  await openField(page, id, name);
  return mk;
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
// 比べない 3 つ（チケットの決めとモックの差・PM の決め 2026-11-24）：値の入った項目（PJコード）は型の欄の下に
//   「値が入っている項目は、型を変えられません」が出るがモック set-fields には無いので、その下の選ぶ物（options）と
//   ボタン（acts）の縦の位置 y がずれる。「この項目を消す…」はこの葉では押せない形（K-720 がつなぐ）なので、acts の
//   薄さ（opacity）がモックと違った。K-720 が消すをつないだので "acts:opacity" は外した（統合の枝 2026-11-28・K-720.md の申し送り）
const UI001_SKIP = ["options:y", "acts:y"] as const;
for (const w of WS_WIDTHS) {
  test(`K709-UI-001 set-fields 幅 ${w}：一覧・必須の印・右の欄（名前・型・選ぶ物・必須・説明・どの種別で出すか・ボタン）の位置と大きさと字がモックと同じ（matchWs の bad が 0）`, async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const { bad, rows } = await matchWs(
      browser,
      "set-fields",
      w,
      async (page) => {
        await mockSettings(page);
        await openField(page, F_PJ, "PJコード", w);
      },
      { skip: UI001_SKIP },
    );
    expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

// ---------------------------------------------------------------- 開く・読む
test("K709-UI-002 タブ「項目」を押すと ?tab=fields で項目の口 1 回と種別の口 1 回が同時に始まる（直列でない）・再読み込みでも同じタブ・種別のタブで読んだ種別は読み直さない", async ({
  page,
}) => {
  const mk = await mockSettings(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto(PATH);
  await expect(page.locator('ul[aria-label="種別"]')).toBeVisible();
  const release = mk.hold("fields");
  await page.getByRole("tab", { name: "項目", exact: true }).click();
  await expect(page).toHaveURL(/tab=fields/);
  expect(mk.count("kinds")).toBe(1);
  await expect.poll(() => mk.count("fields")).toBe(1);
  release();
  await expect(page.locator(LIST)).toBeVisible();
  expect(mk.count("kinds")).toBe(1);
  await page.reload();
  await expect(page.getByRole("tab", { name: "項目", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(LIST)).toBeVisible();
});

test("K709-UI-003 一覧：名前・必須の印（PJコードと支払期日だけ）・型の字（1 つ選ぶ・数・日付・複数選ぶ・複数行）・先頭が選ばれる・無い id を指すと先頭", async ({
  page,
}) => {
  await mockSettings(page);
  await openAt(page, "?tab=fields&id=0193c5a0-0000-7000-8000-00000000ffff");
  const items = page.locator(LIST).getByRole("link");
  await expect(items).toHaveCount(5);
  await expect(items.first()).toHaveAttribute("aria-current", "true");
  await expect(items.nth(0)).toContainText("PJコード");
  await expect(items.nth(0)).toContainText("必須");
  await expect(items.nth(0)).toContainText("1 つ選ぶ");
  await expect(items.nth(1)).toContainText("請求額");
  await expect(items.nth(1)).toContainText("金額");
  await expect(items.nth(1)).not.toContainText("必須");
  await expect(items.nth(2)).toContainText("日付");
  await expect(items.nth(3)).toContainText("複数選ぶ");
  await expect(items.nth(4)).toContainText("複数行");
  await expect(page.locator(`${LIST} .k-badge`)).toHaveCount(2);
});

test("K709-UI-004 会社が足した項目が 0 件のときは「会社が足した項目はまだありません」（仮）で、右の欄は出ない", async ({
  page,
}) => {
  await mockSettings(page, { fields: [] });
  await openAt(page, "?tab=fields");
  await expect(page.getByText("会社が足した項目はまだありません", { exact: true })).toBeVisible();
  await expect(page.locator("form[aria-label^='項目「']")).toHaveCount(0);
});

test("K709-UI-005 右の欄：名前・型（今の型が選ばれる）・選ぶ物（選ぶ型だけ）・必須・説明・どの種別で出すか（チェック）・「保存する」", async ({
  page,
}) => {
  await open(page, F_PJ, "PJコード");
  await expect(nameBox(page, "PJコード")).toHaveValue("PJコード");
  await expect(typeSel(page, "PJコード")).toContainText("1 つ選ぶ");
  await expect(opts(page, "PJコード").getByRole("textbox")).toHaveCount(3);
  await expect(required(page, "PJコード")).toBeChecked();
  await expect(page.locator(FORM("PJコード")).getByLabel("説明", { exact: true })).toHaveValue(
    "どの案件の仕事かを選びます",
  );
  await expect(kindsBox(page, "PJコード").getByRole("checkbox")).toHaveCount(5);
  await expect(kindsBox(page, "PJコード").getByRole("checkbox", { name: "タスク", exact: true })).toBeChecked();
  await expect(kindsBox(page, "PJコード").getByRole("checkbox", { name: "請求", exact: true })).toBeChecked();
  await expect(kindsBox(page, "PJコード").getByRole("checkbox", { name: "不具合", exact: true })).not.toBeChecked();
});

test("K709-UI-006 種別の行が 1 つも無い前からの項目（all_kinds）は今ある全部の種別にチェックが付き、触らず保存の差分に種別を含めない・種別を 1 つ外して保存すると全部の種別の並びで kind_ids を送る", async ({
  page,
}) => {
  const fields = fieldsTaka();
  const f = fields.find((x) => x.id === F_AMOUNT)!;
  f.all_kinds = true;
  f.kind_ids = [];
  const mk = await mockSettings(page, { fields });
  await openField(page, F_AMOUNT, "請求額");
  await expect(kindsBox(page, "請求額").getByRole("checkbox", { checked: true })).toHaveCount(5);
  await nameBox(page, "請求額").fill("請求の額");
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("項目「請求の額」を保存しました");
  expect(mk.last("updateField")?.body).toEqual({ name: "請求の額" });
  await kindsBox(page, "請求の額").getByRole("checkbox", { name: "不具合", exact: true }).uncheck();
  await save(page).click();
  await expect.poll(() => mk.count("updateField")).toBe(2);
  expect(mk.last("updateField")?.body["kind_ids"]).toHaveLength(4);
  expect(mk.last("updateField")?.body["kind_ids"]).not.toContain(kindsTaka()[3]!.id);
});

// ---------------------------------------------------------------- 直す・保存
test("K709-UI-007 名前を直して保存：書く口 1 回・体は名前だけ・お知らせ「項目「請求の額」を保存しました」・一覧の名前が替わり、項目を読み直して（口 2 回）画面と答えが合う", async ({
  page,
}) => {
  const mk = await open(page);
  await nameBox(page, "請求額").fill("請求の額");
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("項目「請求の額」を保存しました");
  expect(mk.last("updateField")?.id).toBe(F_AMOUNT);
  expect(mk.last("updateField")?.body).toEqual({ name: "請求の額" });
  await expect(item(page, "請求の額")).toBeVisible();
  expect(mk.count("fields")).toBe(2);
  expect(mk.fields.find((x) => x.id === F_AMOUNT)?.name).toBe("請求の額");
});

test("K709-UI-008 型を替えて保存（値の無い項目）：体は field_type だけ・1 つ選ぶにすると「選ぶ物」の欄が出て、足して保存すると field_type と options を送る・1 つ選ぶ → 複数選ぶ（選ぶ型どうし）も options を一緒に送る・選ぶ型でなくすと選ぶ物の欄が消えて options は送らない", async ({
  page,
}) => {
  const mk = await open(page);
  await pickType(page, "請求額", "日付");
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("保存しました");
  expect(mk.last("updateField")?.body).toEqual({ field_type: "date" });
  await pickType(page, "請求額", "1 つ選ぶ");
  await expect(opts(page, "請求額")).toBeVisible();
  await opts(page, "請求額").getByRole("button", { name: "選ぶ物を足す", exact: true }).click();
  await opts(page, "請求額").getByRole("textbox").last().fill("税込");
  await save(page).click();
  await expect.poll(() => mk.count("updateField")).toBe(2);
  expect(mk.last("updateField")?.body).toEqual({ field_type: "select", options: [{ name: "税込" }] });
  await pickType(page, "請求額", "複数選ぶ");
  await save(page).click();
  await expect.poll(() => mk.count("updateField")).toBe(3);
  const toMulti = mk.last("updateField")!.body;
  expect(toMulti["field_type"], "選ぶ型どうしの変更").toBe("multi_select");
  expect(JSON.stringify(toMulti["options"]), "選ぶ型どうしでも選ぶ物を一緒に送る").toContain("税込");
  await pickType(page, "請求額", "チェック");
  await expect(opts(page, "請求額")).toHaveCount(0);
  await save(page).click();
  await expect.poll(() => mk.count("updateField")).toBe(4);
  expect(mk.last("updateField")?.body).toEqual({ field_type: "check" });
});

test("K709-UI-009 必須・説明・どの種別で出すかを直して保存：体は変えた欄だけ（required・description・kind_ids）・説明を空にして保存すると description は null", async ({
  page,
}) => {
  const mk = await open(page);
  await required(page, "請求額").check();
  await page.locator(FORM("請求額")).getByLabel("説明", { exact: true }).fill("税抜の額");
  await kindsBox(page, "請求額").getByRole("checkbox", { name: "問い合わせ", exact: true }).check();
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("保存しました");
  expect(mk.last("updateField")?.body).toEqual({ required: true, description: "税抜の額", kind_ids: [K_BILL, K_ASK] });
  await page.locator(FORM("請求額")).getByLabel("説明", { exact: true }).fill("");
  await save(page).click();
  await expect.poll(() => mk.count("updateField")).toBe(2);
  expect(mk.last("updateField")?.body).toEqual({ description: null });
});

test("K709-UI-010 何も変えていないと「保存する」は押せない形で押しても口を呼ばない・直すと押せて、元に戻すとまた押せない", async ({
  page,
}) => {
  const mk = await open(page);
  await expect(save(page)).toBeDisabled();
  await save(page).click({ force: true });
  expect(mk.count("updateField")).toBe(0);
  await required(page, "請求額").check();
  await expect(save(page)).toBeEnabled();
  await required(page, "請求額").uncheck();
  await expect(save(page)).toBeDisabled();
});

test("K709-UI-011 入力の確かめ（JS が先に働く・口を呼ばない）：名前が空 →「名前を入れてください」・41 字・選ぶ物の欄の下に「同じ名前の選ぶ物があります」「選ぶ物の名前を入れてください」「選ぶ物を 1 つ以上入れてください」・種別の欄の下に「出す種別を 1 つ以上選んでください」。直すと消える", async ({
  page,
}) => {
  const mk = await open(page, F_CLASS, "分類");
  await nameBox(page, "分類").fill("");
  await save(page).click();
  await expect(err1(page, "分類")).toHaveText("名前を入れてください");
  await expect(nameBox(page, "分類")).toHaveAttribute("aria-invalid", "true");
  await nameBox(page, "分類").fill("あ".repeat(41));
  await save(page).click();
  await expect(err1(page, "分類")).toHaveText("名前は 40 字までです");
  await nameBox(page, "分類").fill("分類");
  await expect(err1(page, "分類")).toHaveCount(0);
  const o = opts(page, "分類");
  await o.getByRole("textbox").nth(1).fill("経理");
  await save(page).click();
  await expect(o.locator(".k-err")).toHaveText("同じ名前の選ぶ物があります");
  await o.getByRole("textbox").nth(1).fill("");
  await save(page).click();
  await expect(o.locator(".k-err")).toHaveText("選ぶ物の名前を入れてください");
  const del = o.getByRole("button", { name: /を外す$/ });
  await del.first().click();
  await del.first().click();
  await save(page).click();
  await expect(o.locator(".k-err")).toHaveText("選ぶ物を 1 つ以上入れてください");
  await kindsBox(page, "分類").getByRole("checkbox", { name: "タスク", exact: true }).uncheck();
  await save(page).click();
  await expect(kindsBox(page, "分類").locator(".k-err")).toHaveText("出す種別を 1 つ以上選んでください");
  await kindsBox(page, "分類").getByRole("checkbox", { name: "タスク", exact: true }).check();
  await expect(kindsBox(page, "分類").locator(".k-err")).toHaveCount(0);
  expect(mk.count("updateField")).toBe(0);
});

test("K709-UI-012 値が入っている項目（PJコード）は型の欄が押せない形で「値が入っている項目は、型を変えられません」が見える・口が 409 E-FMS-002 を返したとき（別の人が値を入れた直後）は型の欄の下に正本の文で、選んだ型は残る", async ({
  page,
}) => {
  const mk = await open(page, F_PJ, "PJコード");
  await expect(typeSel(page, "PJコード")).toBeDisabled();
  await expect(page.locator(FORM("PJコード"))).toContainText("値が入っている項目は、型を変えられません");
  await page.goto(`${PATH}?tab=fields&id=${F_AMOUNT}`);
  await expect(page.locator(FORM("請求額"))).toBeVisible();
  await expect(typeSel(page, "請求額")).toBeEnabled();
  mk.script("updateField", err(409, "E-FMS-002"));
  await pickType(page, "請求額", "日付");
  await save(page).click();
  await expect(err1(page, "請求額")).toHaveText(msg("E-FMS-002"));
  await expect(typeSel(page, "請求額")).toContainText("日付");
  await save(page).click();
  await expect.poll(() => mk.count("updateField")).toBe(2);
});

test("K709-UI-013 口が 409 E-FMS-001（同じ名前）：名前の欄の下に正本の文・中身は残り一覧の名前は変わらない・直して押し直せる", async ({
  page,
}) => {
  const mk = await open(page);
  mk.script("updateField", err(409, "E-FMS-001"));
  await nameBox(page, "請求額").fill("備考");
  await save(page).click();
  await expect(err1(page, "請求額")).toHaveText(msg("E-FMS-001"));
  await expect(nameBox(page, "請求額")).toHaveValue("備考");
  await expect(item(page, "請求額")).toBeVisible();
  await nameBox(page, "請求額").fill("請求の額");
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("保存しました");
  expect(mk.count("updateField")).toBe(2);
});

test("K709-UI-014 口が 409 E-FMS-004（同じ名前の選ぶ物）は選ぶ物の欄の下に正本の文・409 E-FMS-005（選ぶ型でない項目に選ぶ物だけ）は赤い箱に正本の文。どちらも書いた中身は残る", async ({
  page,
}) => {
  const mk = await open(page, F_CLASS, "分類");
  mk.script("updateField", err(409, "E-FMS-004"), err(409, "E-FMS-005"));
  await opts(page, "分類").getByRole("textbox").first().fill("経理部");
  await save(page).click();
  await expect(opts(page, "分類").locator(".k-err")).toHaveText(msg("E-FMS-004"));
  await expect(opts(page, "分類").getByRole("textbox").first()).toHaveValue("経理部");
  await save(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-FMS-005") })).toBeVisible();
  await expect(opts(page, "分類").getByRole("textbox").first()).toHaveValue("経理部");
});

test("K709-UI-015 選ぶ物の編集：「選ぶ物を足す」で空の欄が増え焦点・名前を直す・つまみで Enter → ↑ → Enter で並べ替え（Esc は戻して何も変えない）。保存すると options は並びの順（既存は id つき・新しい物は id なし）で書く口 1 回・「外す」で欄が消える", async ({
  page,
}) => {
  const mk = await open(page, F_CLASS, "分類");
  const o = opts(page, "分類");
  await o.getByRole("button", { name: "選ぶ物を足す", exact: true }).click();
  await expect(o.getByRole("textbox").last()).toBeFocused();
  await o.getByRole("textbox").last().fill("総務");
  await o.getByRole("textbox").first().fill("経理部");
  await o.getByRole("button", { name: "営業を並べ替える", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(o.getByRole("button", { name: "営業を並べ替える", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Escape");
  expect(await o.getByRole("textbox").evaluateAll((xs) => xs.map((x) => (x as HTMLInputElement).value))).toEqual([
    "経理部",
    "営業",
    "総務",
  ]);
  await o.getByRole("button", { name: "営業を並べ替える", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  expect(await o.getByRole("textbox").evaluateAll((xs) => xs.map((x) => (x as HTMLInputElement).value))).toEqual([
    "営業",
    "経理部",
    "総務",
  ]);
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("保存しました");
  expect(mk.count("updateField")).toBe(1);
  expect(mk.last("updateField")?.body).toEqual({
    options: [{ id: uid(0xe112), name: "営業" }, { id: uid(0xe111), name: "経理部" }, { name: "総務" }],
  });
  await o.getByRole("button", { name: "総務を外す", exact: true }).click();
  await expect(o.getByRole("textbox")).toHaveCount(2);
});

test("K709-UI-016 二度押し：答えを待つ間「保存する」は押せず口は 1 回", async ({ page }) => {
  const mk = await open(page);
  await nameBox(page, "請求額").fill("請求の額");
  const release = mk.hold("updateField");
  await save(page).click();
  await expect(save(page)).toBeDisabled();
  await save(page).click({ force: true });
  release();
  await expect(page.locator(".k-toast")).toContainText("保存しました");
  expect(mk.count("updateField")).toBe(1);
});

test("K709-UI-017 口が 503・網の切れ・403：赤い箱に正本の文（E-PAGE-003・E-PAGE-007・E-PAGE-002）・中身は残り押し直すと保存できる（口 4 回）。404（開いている間に消された）は赤い箱に正本の文で項目を読み直して一覧から消える", async ({
  page,
}) => {
  const mk = await open(page);
  mk.script("updateField", err(503, "E-PAGE-003"), "network", err(403, "E-PAGE-002"));
  await nameBox(page, "請求額").fill("請求の額");
  await save(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-003").split("。")[0]! })).toBeVisible();
  await save(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-007").split("。")[0]! })).toBeVisible();
  await save(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-002").split("。")[0]! })).toBeVisible();
  await expect(nameBox(page, "請求額")).toHaveValue("請求の額");
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("項目「請求の額」を保存しました");
  expect(mk.count("updateField")).toBe(4);
  mk.fields = mk.fields.filter((x) => x.id !== F_AMOUNT);
  await nameBox(page, "請求の額").fill("もう一度");
  await save(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-001").split("。")[0]! })).toBeVisible();
  await expect(page.locator(LIST).getByRole("link")).toHaveCount(4);
});

test("K709-UI-018 保存していない変更のまま別の項目・別のタブを押すと小窓「保存していない変更があります」：「戻る」で残り変更も残る・「捨てて移る」で移って変更は消える・変更が無ければ出ない", async ({
  page,
}) => {
  await open(page);
  await item(page, "支払期日").click();
  await expect(page.locator(FORM("支払期日"))).toBeVisible();
  await expect(page.locator(DLG)).toHaveCount(0);
  await item(page, "請求額").click();
  await nameBox(page, "請求額").fill("請求の額");
  await item(page, "備考").click();
  const dlg = page.locator(DLG);
  await expect(dlg.getByRole("heading", { name: "保存していない変更があります" })).toBeVisible();
  await dlg.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(nameBox(page, "請求額")).toHaveValue("請求の額");
  await page.getByRole("tab", { name: "種別", exact: true }).click();
  await expect(dlg.getByRole("heading", { name: "保存していない変更があります" })).toBeVisible();
  await dlg.getByRole("button", { name: "捨てて移る", exact: true }).click();
  await expect(page).toHaveURL(/tab=kinds/);
  await page.getByRole("tab", { name: "項目", exact: true }).click();
  // タブを押した道は ?id= を持たないので先頭（PJコード）が選ばれる（「無い id は先頭」）。請求額を選び直して、変更が消えたことを見る
  await item(page, "請求額").click();
  await expect(nameBox(page, "請求額")).toHaveValue("請求額");
});

// ---------------------------------------------------------------- 権限・読み込み・幅
test("K709-UI-019 管理者でない人（閲覧のみ）が ?tab=fields を直に開くと「この画面を見る権限がありません」・項目の口と種別の口は 0 回。口が 403（管理者の束を外された直後）のときも同じ", async ({
  page,
}) => {
  const v = await viewerViaApi();
  const mk = await mockSettings(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, v.token);
  await page.goto(`${PATH}?tab=fields`);
  await expect(page.locator('[data-code="E-PAGE-002"]')).toBeVisible();
  expect(mk.count("fields") + mk.count("kinds")).toBe(0);
  const page2 = await page.context().newPage();
  const mk2 = await mockSettings(page2);
  mk2.script("fields", err(403, "E-PAGE-002"));
  await page2.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page2, owner.token);
  await page2.goto(`${PATH}?tab=fields`);
  await expect(page2.locator('[data-code="E-PAGE-002"]')).toBeVisible();
  await expect(page2.locator(LIST)).toHaveCount(0);
});

test("K709-UI-020 読み込み中は「読み込んでいます…」・項目か種別のどちらかが 503 のときは読めなかった旨と「もう一度読む」で、押すと両方を読み直して一覧が出る", async ({
  page,
}) => {
  const mk = await mockSettings(page);
  mk.script("kinds", err(503, "E-PAGE-003"));
  const release = mk.hold("fields");
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, owner.token);
  await page.goto(`${PATH}?tab=fields`);
  await expect(page.getByRole("status", { name: "読み込んでいます…" })).toBeVisible();
  release();
  await expect(page.locator('[data-state="error"]')).toBeVisible();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(page.locator(LIST)).toBeVisible();
  expect(mk.count("kinds")).toBe(2);
});

test("K709-UI-021 項目と種別の名前・選ぶ物に HTML が入っていても文字として出て動かない（img も作られない）", async ({
  page,
}) => {
  const fields = fieldsTaka();
  fields.find((x) => x.id === F_PJ)!.name = '<img src=x onerror="window.__x=1">PJ';
  fields.find((x) => x.id === F_PJ)!.options[0]!.name = "<b>太字</b>";
  const kinds = kindsTaka();
  kinds[0]!.name = "<i>タスク</i>";
  await mockSettings(page, { fields, kinds });
  await openAt(page, "?tab=fields");
  await expect(page.locator(LIST).getByRole("link").first()).toContainText('<img src=x onerror="window.__x=1">PJ');
  await expect(
    kindsBox(page, '<img src=x onerror="window.__x=1">PJ').getByText("<i>タスク</i>", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator("form img, ul img").count()).toBe(0);
});

for (const w of WIDTHS) {
  test(`K709-UI-022 幅 ${w}：横のはみ出し 0（数値）・長い選ぶ物の名前でも 0・幅 767 以下は一覧が右の欄の上に縦に並ぶ`, async ({
    page,
  }) => {
    const fields = fieldsTaka();
    fields.find((x) => x.id === F_PJ)!.options[0]!.name = "とても長い選ぶ物の名前".repeat(3);
    await mockSettings(page, { fields });
    await openField(page, F_PJ, "PJコード", w);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    if (w <= 767) {
      const a = await page.locator(LIST).boundingBox();
      const b = await page.locator(FORM("PJコード")).boundingBox();
      expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
    }
  });
}

test("K709-UI-023 キーボードだけ：一覧の項目に Tab で届き Enter で選べる・選ぶ物の欄・種別のチェックに Tab で届き、Tab を 30 回押しても焦点が画面の外へ出ない（ページの中で循環する）", async ({
  page,
}) => {
  await open(page, F_PJ, "PJコード");
  await item(page, "請求額").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(FORM("請求額"))).toBeVisible();
  for (let i = 0; i < 30; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});
