// K-707「チケットの設定の画面の入れ物（/workspace/ticket-settings）と「種別」」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/set-kinds（本番と同じ部品 features/F9/settings・代表 OK 2026-11-22）。外枠は TicketShell（screen="masters"）・頭と第 2 ナビは WsHead・WsSub。
//   モックとの見た目の比べ方は f9-ws-match.ts の matchWs。ログイン・外枠・役は本物（signupViaApi・loginAs・viewerViaApi）。
//   設定の口（K-704・K-705・K-706・K-717）と人数の口（getWorkspaceMembers）だけを網の手前で差し替える（settings-mock.ts）。
//   答えの形は 07_functional/段10-F9/土台-settings.md の 3・4 章。本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs, signupViaApi, viewerViaApi } from "../_lib/api";
import { WS_WIDTHS, matchWs } from "./f9-ws-match";
import { K_ASK, K_BILL, K_TASK, err, kindsTaka, mockSettings, msg, type SMock } from "./settings-mock";

const PATH = "/workspace/ticket-settings";
const LIST = 'ul[aria-label="種別"]';
const FORM = (name: string) => `form[aria-label="種別「${name}」を直す"]`;
const DLG = ".k-dialog";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const item = (page: Page, name: string) => page.locator(LIST).getByRole("link", { name: new RegExp(`^${name}`) });
const save = (page: Page) => page.getByRole("button", { name: "保存する", exact: true });
const nameBox = (page: Page, kind: string) =>
  page.locator(FORM(kind)).getByRole("textbox", { name: "名前", exact: true });
const template = (page: Page) => page.getByRole("textbox", { name: "本文のひな形", exact: true });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openAt(page: Page, query = "", width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(`${PATH}${query}`);
}
/** 請求を選んで開き、右の欄が出るまで待つ */
async function openBill(page: Page, width = 1440): Promise<void> {
  await openAt(page, `?tab=kinds&id=${K_BILL}`, width);
  await expect(page.locator(FORM("請求"))).toBeVisible();
}
async function open(page: Page): Promise<SMock> {
  const mk = await mockSettings(page);
  await openBill(page);
  return mk;
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
for (const w of WS_WIDTHS) {
  test(`K707-UI-001 set-kinds 幅 ${w}：外枠の中の本文（見出し・タブ・種別の一覧・右の欄・色・ひな形・ボタン）の位置と大きさと字がモックと同じ`, async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const { bad, rows } = await matchWs(browser, "set-kinds", w, async (page) => {
      await mockSettings(page);
      await openBill(page, w);
    });
    expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

// ---------------------------------------------------------------- 開く・読む
test("K707-UI-002 道を開くと見出し「チケットの設定」と 3 つのタブ（種別が選ばれている）・種別の口 1 回・状態と項目の口 0 回・?tab= の不正な値は種別", async ({
  page,
}) => {
  const mk = await mockSettings(page);
  await openAt(page, "?tab=nonsense");
  await expect(page.getByRole("heading", { name: "チケットの設定", level: 1 })).toBeVisible();
  for (const n of ["種別", "状態", "項目"]) await expect(page.getByRole("tab", { name: n, exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "種別", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(LIST).getByRole("link")).toHaveCount(5);
  expect(mk.count("kinds")).toBe(1);
  expect(mk.count("stages") + mk.count("fields")).toBe(0);
});

test("K707-UI-004 種別の一覧：名前・「ひな形あり／なし」・色の点・先頭が選ばれる・?id= が無い物を指すと先頭・HTML の入った名前は文字として出て動かない", async ({
  page,
}) => {
  const kinds = kindsTaka();
  kinds[3]!.name = '<img src=x onerror="window.__x=1">不具合';
  await mockSettings(page, { kinds });
  await openAt(page, "?id=0193c5a0-0000-7000-8000-00000000ffff");
  const items = page.locator(LIST).getByRole("link");
  await expect(items).toHaveCount(5);
  await expect(items.first()).toHaveAttribute("aria-current", "true");
  await expect(items.nth(1)).toContainText("請求");
  await expect(items.nth(1)).toContainText("ひな形あり");
  await expect(items.nth(3)).toContainText("ひな形なし");
  await expect(items.nth(3)).toContainText('<img src=x onerror="window.__x=1">不具合');
  await expect(items.nth(1).locator(".k-f9s-dot")).toHaveAttribute("data-tone", "teal");
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator(`${LIST} img`).count()).toBe(0);
});

test("K707-UI-005 種別を押すと ?id= が替わり右の欄が替わる（種別の口は読み直さない）・戻るで前の種別に戻る", async ({
  page,
}) => {
  const mk = await open(page);
  await item(page, "問い合わせ").click();
  await expect(page).toHaveURL(new RegExp(`id=${K_ASK}`));
  await expect(page.locator(FORM("問い合わせ"))).toBeVisible();
  expect(mk.count("kinds")).toBe(1);
  await page.goBack();
  await expect(page.locator(FORM("請求"))).toBeVisible();
  expect(mk.count("kinds")).toBe(1);
});

test("K707-UI-006 右の欄：名前・色はラジオ 8 つで選ばれているのは 1 つ（請求は青緑）・本文のひな形に見出しと薄い字・ボタンは「この種別を消す…」「保存する」", async ({
  page,
}) => {
  await open(page);
  const f = page.locator(FORM("請求"));
  await expect(nameBox(page, "請求")).toHaveValue("請求");
  await expect(f.getByRole("radio")).toHaveCount(8);
  await expect(f.getByRole("radio", { checked: true })).toHaveCount(1);
  await expect(f.getByRole("radio", { name: "青緑", exact: true })).toBeChecked();
  await expect(template(page).getByRole("heading", { name: "目的" })).toBeVisible();
  await expect(template(page)).toContainText("どの取引先の・何月分の請求かを書きます");
  await expect(f.getByRole("button", { name: "この種別を消す…", exact: true })).toBeVisible();
  await expect(save(page)).toBeVisible();
});

// ---------------------------------------------------------------- 保存
test("K707-UI-007 名前を直して保存：書く口 1 回・体は名前だけ・お知らせ「種別「請求書」を保存しました」・一覧の名前が替わり、保存の後に種別を読み直して（口 2 回）画面と答えが合う", async ({
  page,
}) => {
  const mk = await open(page);
  await nameBox(page, "請求").fill("請求書");
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("種別「請求書」を保存しました");
  expect(mk.count("updateKind")).toBe(1);
  expect(mk.last("updateKind")?.id).toBe(K_BILL);
  expect(mk.last("updateKind")?.body).toEqual({ name: "請求書" });
  await expect(item(page, "請求書")).toBeVisible();
  expect(mk.count("kinds")).toBe(2);
  expect(mk.kinds.find((k) => k.id === K_BILL)?.name).toBe("請求書");
});

test("K707-UI-008 色を替えて保存：体は color_key だけ（鍵の字）・一覧の点の色が替わる", async ({ page }) => {
  const mk = await open(page);
  await page.locator(FORM("請求")).getByRole("radio", { name: "珊瑚", exact: true }).check();
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("種別「請求」を保存しました");
  expect(mk.last("updateKind")?.body).toEqual({ color_key: "coral" });
  await expect(item(page, "請求").locator(".k-f9s-dot")).toHaveAttribute("data-tone", "coral");
});

test("K707-UI-009 本文のひな形を直して保存：体は body_template の文書の木・全部消して保存すると null（ひな形なし）で一覧が「ひな形なし」になる", async ({
  page,
}) => {
  const mk = await open(page);
  await template(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("見積書の番号を書く");
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("種別「請求」を保存しました");
  const sent = mk.last("updateKind")?.body["body_template"] as { type: string; content: unknown[] };
  expect(sent.type).toBe("doc");
  expect(JSON.stringify(sent)).toContain("見積書の番号を書く");
  expect(Object.keys(mk.last("updateKind")!.body)).toEqual(["body_template"]);
  await template(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Delete");
  await save(page).click();
  await expect.poll(() => mk.count("updateKind")).toBe(2);
  expect(mk.last("updateKind")?.body).toEqual({ body_template: null });
  await expect(item(page, "請求")).toContainText("ひな形なし");
});

test("K707-UI-010 何も変えていないと「保存する」は押せない形で、押しても口を呼ばない（空の体で 422 にならない）・直すと押せて、元に戻すとまた押せない", async ({
  page,
}) => {
  const mk = await open(page);
  await expect(save(page)).toBeDisabled();
  await save(page).click({ force: true });
  expect(mk.count("updateKind")).toBe(0);
  await nameBox(page, "請求").fill("請求書");
  await expect(save(page)).toBeEnabled();
  await nameBox(page, "請求書").fill("請求");
  await expect(save(page)).toBeDisabled();
});

test("K707-UI-011 名前の入力：空・全角の空白だけ →「名前を入れてください」・41 字 →「名前は 40 字までです」・どちらも口を呼ばず欄は aria-invalid・直すと消える（ブラウザ標準の確かめに奪われない）", async ({
  page,
}) => {
  const mk = await open(page);
  await nameBox(page, "請求").fill("　　");
  await save(page).click();
  await expect(page.locator(`${FORM("請求")} .k-err`)).toHaveText("名前を入れてください");
  await expect(nameBox(page, "請求")).toHaveAttribute("aria-invalid", "true");
  await nameBox(page, "請求").fill("あ".repeat(41));
  await save(page).click();
  await expect(page.locator(`${FORM("請求")} .k-err`)).toHaveText("名前は 40 字までです");
  expect(mk.count("updateKind")).toBe(0);
  await nameBox(page, "請求").fill("あ".repeat(40));
  await expect(page.locator(`${FORM("請求")} .k-err`)).toHaveCount(0);
});

test("K707-UI-012 口が 409 E-KND-001（同じ名前）：名前の欄の下に正本の文・書いた中身は残り・一覧の名前は変わらない・直して押し直せる", async ({
  page,
}) => {
  const mk = await open(page);
  mk.script("updateKind", err(409, "E-KND-001"));
  await nameBox(page, "請求").fill("タスク");
  await save(page).click();
  await expect(page.locator(`${FORM("請求")} .k-err`)).toHaveText(msg("E-KND-001"));
  await expect(nameBox(page, "請求")).toHaveValue("タスク");
  await expect(item(page, "請求")).toBeVisible();
  await nameBox(page, "請求").fill("請求書");
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("種別「請求書」を保存しました");
  expect(mk.count("updateKind")).toBe(2);
});

test("K707-UI-013 二度押し：答えを待つ間「保存する」は押せず口は 1 回", async ({ page }) => {
  const mk = await open(page);
  await nameBox(page, "請求").fill("請求書");
  const release = mk.hold("updateKind");
  await save(page).click();
  await expect(save(page)).toBeDisabled();
  await save(page).click({ force: true });
  release();
  await expect(page.locator(".k-toast")).toContainText("保存しました");
  expect(mk.count("updateKind")).toBe(1);
});

test("K707-UI-014 口が 503・網の切れ・403：赤い箱（role=alert）に正本の文・書いた中身は残る・押し直すと保存できる（口 4 回）", async ({
  page,
}) => {
  const mk = await open(page);
  mk.script("updateKind", err(503, "E-PAGE-003"), "network", err(403, "E-PAGE-002"));
  await nameBox(page, "請求").fill("請求書");
  await save(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-003").split("。")[0]! })).toBeVisible();
  await save(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-007").split("。")[0]! })).toBeVisible();
  await save(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-002").split("。")[0]! })).toBeVisible();
  await expect(nameBox(page, "請求")).toHaveValue("請求書");
  await save(page).click();
  await expect(page.locator(".k-toast")).toContainText("種別「請求書」を保存しました");
  expect(mk.count("updateKind")).toBe(4);
});

test("K707-UI-015 口が 404（開いている間に別の人が消した）：赤い箱に「見つかりません」の正本の文・種別を読み直して（口 2 回）一覧からその種別が消え先頭が選ばれる", async ({
  page,
}) => {
  const mk = await open(page);
  mk.kinds = mk.kinds.filter((k) => k.id !== K_BILL);
  await nameBox(page, "請求").fill("請求書");
  await save(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-001").split("。")[0]! })).toBeVisible();
  await expect.poll(() => mk.count("kinds")).toBe(2);
  await expect(page.locator(LIST).getByRole("link")).toHaveCount(4);
  await expect(page.locator(LIST).getByRole("link").first()).toHaveAttribute("aria-current", "true");
});

test("K707-UI-016 保存していない変更があるまま別の種別を押すと小窓「保存していない変更があります」：「戻る」で元の種別に残り変更も残る・「捨てて移る」で移って変更は消える。変更が無ければ小窓は出ない", async ({
  page,
}) => {
  await open(page);
  await item(page, "不具合").click();
  await expect(page.locator(FORM("不具合"))).toBeVisible();
  await expect(page.locator(DLG)).toHaveCount(0);
  await item(page, "請求").click();
  await nameBox(page, "請求").fill("請求書");
  await item(page, "タスク").click();
  const dlg = page.locator(DLG);
  await expect(dlg.getByRole("heading", { name: "保存していない変更があります" })).toBeVisible();
  await dlg.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(nameBox(page, "請求")).toHaveValue("請求書");
  await item(page, "請求").click();
  await item(page, "タスク").click();
  await dlg.getByRole("button", { name: "捨てて移る", exact: true }).click();
  await expect(page.locator(FORM("タスク"))).toBeVisible();
  await item(page, "請求").click();
  await expect(nameBox(page, "請求")).toHaveValue("請求");
});

// ---------------------------------------------------------------- 足す・消す
test("K707-UI-017 「種別を足す」で小窓（名前・色）が開き、足すと書く口 1 回（体は name と color_key）・小窓が閉じ・新しい種別が選ばれて右に出る・お知らせ「種別「見積もり」を足しました」・種別を読み直す", async ({
  page,
}) => {
  const mk = await open(page);
  await page.getByRole("button", { name: "種別を足す", exact: true }).click();
  const dlg = page.locator(DLG);
  await expect(dlg.getByRole("heading", { name: "種別を足す" })).toBeVisible();
  await expect(dlg.getByRole("textbox", { name: "名前", exact: true })).toBeFocused();
  await expect(dlg.getByRole("radio")).toHaveCount(8);
  await dlg.getByRole("textbox", { name: "名前", exact: true }).fill("見積もり");
  await dlg.getByRole("radio", { name: "若草", exact: true }).check();
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg).toHaveCount(0);
  expect(mk.last("createKind")?.body).toEqual({ name: "見積もり", color_key: "sage" });
  await expect(page.locator(".k-toast")).toContainText("種別「見積もり」を足しました");
  await expect(page.locator(FORM("見積もり"))).toBeVisible();
  expect(mk.count("kinds")).toBe(2);
});

test("K707-UI-018 足す小窓の失敗：409 E-KND-001・E-KND-002 は名前の欄の下に正本の文で小窓は閉じず中身は残る・空の名前は口を呼ばない・やめる・Esc は口を呼ばず焦点は「種別を足す」に戻る", async ({
  page,
}) => {
  const mk = await open(page);
  const add = page.getByRole("button", { name: "種別を足す", exact: true });
  await add.click();
  const dlg = page.locator(DLG);
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg.locator(".k-err")).toHaveText("名前を入れてください");
  expect(mk.count("createKind")).toBe(0);
  mk.script("createKind", err(409, "E-KND-001"), err(409, "E-KND-002"));
  await dlg.getByRole("textbox", { name: "名前", exact: true }).fill("請求");
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg.locator(".k-err")).toHaveText(msg("E-KND-001"));
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg.locator(".k-err")).toHaveText(msg("E-KND-002"));
  await expect(dlg.getByRole("textbox", { name: "名前", exact: true })).toHaveValue("請求");
  await dlg.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dlg).toHaveCount(0);
  await expect(add).toBeFocused();
  await add.click();
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  expect(mk.count("createKind")).toBe(2);
});

test("K707-UI-019 「この種別を消す…」で確かめの小窓（種別の名前・元に戻せない旨）が開き、「消す」で書く口 1 回・一覧から消えて先頭が選ばれ・お知らせ「種別「請求」を消しました」。「やめる」は口を呼ばない", async ({
  page,
}) => {
  const mk = await open(page);
  await page.getByRole("button", { name: "この種別を消す…", exact: true }).click();
  const dlg = page.locator(DLG);
  await expect(dlg).toContainText("種別「請求」を消しますか");
  await dlg.getByRole("button", { name: "やめる", exact: true }).click();
  expect(mk.count("deleteKind")).toBe(0);
  await page.getByRole("button", { name: "この種別を消す…", exact: true }).click();
  await dlg.getByRole("button", { name: "消す", exact: true }).click();
  await expect(dlg).toHaveCount(0);
  expect(mk.last("deleteKind")?.id).toBe(K_BILL);
  await expect(page.locator(".k-toast")).toContainText("種別「請求」を消しました");
  await expect(page.locator(LIST).getByRole("link")).toHaveCount(4);
  await expect(page.locator(LIST).getByRole("link").first()).toHaveAttribute("aria-current", "true");
  expect(mk.count("kinds")).toBe(2);
});

test("K707-UI-020 口が 409：E-KND-003 は帯に「この種別を使っているチケットがあるので、消せません」と枚数「（3 枚）」・E-KND-005 は帯に正本の文。どちらも一覧に残り、小窓は閉じる", async ({
  page,
}) => {
  const mk = await open(page);
  mk.script("deleteKind", err(409, "E-KND-003", { ticket_count: 3 }), err(409, "E-KND-005"));
  for (const want of [`${msg("E-KND-003")}（3 枚）`, msg("E-KND-005")]) {
    await page.getByRole("button", { name: "この種別を消す…", exact: true }).click();
    await page.locator(DLG).getByRole("button", { name: "消す", exact: true }).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: want })).toBeVisible();
    await expect(item(page, "請求")).toBeVisible();
  }
  expect(mk.count("deleteKind")).toBe(2);
});

test("K707-UI-021 種別が 1 つだけのとき「この種別を消す…」は押せない形（理由は title）で、押しても小窓も口も出ない", async ({
  page,
}) => {
  const only = kindsTaka().filter((k) => k.id === K_TASK);
  const mk = await mockSettings(page, { kinds: only });
  await openAt(page, "");
  const del = page.getByRole("button", { name: "この種別を消す…", exact: true });
  await expect(del).toHaveAttribute("aria-disabled", "true");
  await expect(del).toHaveAttribute("title", "最後の 1 つの種別は消せません");
  await del.click({ force: true });
  await expect(page.locator(DLG)).toHaveCount(0);
  expect(mk.count("deleteKind")).toBe(0);
});

test("K707-UI-025 足す・消すの口が失敗：足すが 403・503・網の切れなら小窓の上の赤い箱（E-PAGE-002・003・007）で閉じず中身は残り押し直すと通る・消すが 403・503・網の切れなら帯の赤い箱で種別は一覧に残り、404 なら帯に正本の文で読み直して一覧から消え先頭が選ばれる", async ({
  page,
}) => {
  const mk = await open(page);
  const add = page.getByRole("button", { name: "種別を足す", exact: true });
  await add.click();
  const dlg = page.locator(DLG);
  await dlg.getByRole("textbox", { name: "名前", exact: true }).fill("見積");
  mk.script("createKind", err(503, "E-PAGE-003"), "network", err(403, "E-PAGE-002"));
  for (const code of ["E-PAGE-003", "E-PAGE-007", "E-PAGE-002"]) {
    await dlg.getByRole("button", { name: "足す", exact: true }).click();
    await expect(dlg.getByRole("alert").filter({ hasText: msg(code).split("。")[0]! })).toBeVisible();
    await expect(dlg.getByRole("textbox", { name: "名前", exact: true })).toHaveValue("見積");
  }
  await dlg.getByRole("button", { name: "足す", exact: true }).click();
  await expect(dlg).toHaveCount(0);
  expect(mk.count("createKind")).toBe(4);
  mk.script("deleteKind", err(503, "E-PAGE-003"), "network", err(403, "E-PAGE-002"), err(404, "E-PAGE-001"));
  await item(page, "請求").click();
  for (const code of ["E-PAGE-003", "E-PAGE-007", "E-PAGE-002"]) {
    await page.getByRole("button", { name: "この種別を消す…", exact: true }).click();
    await page.locator(DLG).getByRole("button", { name: "消す", exact: true }).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: msg(code).split("。")[0]! })).toBeVisible();
    await expect(item(page, "請求")).toBeVisible();
  }
  mk.kinds = mk.kinds.filter((k) => k.id !== K_BILL);
  await page.getByRole("button", { name: "この種別を消す…", exact: true }).click();
  await page.locator(DLG).getByRole("button", { name: "消す", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-001").split("。")[0]! })).toBeVisible();
  await expect(item(page, "請求")).toHaveCount(0);
  await expect(page.locator(LIST).getByRole("link").first()).toHaveAttribute("aria-current", "true");
  expect(mk.count("deleteKind")).toBe(4);
});

// ---------------------------------------------------------------- 権限・読み込み・幅
test("K707-UI-022 管理者でない人（閲覧のみ）が直に開くと「この画面を見る権限がありません」（E-PAGE-002）・設定の口は 0 回。管理者の束を外された直後（口が 403）も同じ画面で、書いた中身は出ない", async ({
  page,
}) => {
  const v = await viewerViaApi();
  const mk = await mockSettings(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page, v.token);
  await page.goto(PATH);
  await expect(page.locator('[data-code="E-PAGE-002"]')).toBeVisible();
  await expect(page.getByText("この画面を見る権限がありません", { exact: false })).toBeVisible();
  await expect(page.locator(LIST)).toHaveCount(0);
  expect(mk.count("kinds")).toBe(0);
  const page2 = await page.context().newPage();
  const mk2 = await mockSettings(page2);
  mk2.script("kinds", err(403, "E-PAGE-002"));
  await page2.setViewportSize({ width: 1440, height: 900 });
  await loginAs(page2, owner.token);
  await page2.goto(PATH);
  await expect(page2.locator('[data-code="E-PAGE-002"]')).toBeVisible();
  await expect(page2.locator(LIST)).toHaveCount(0);
});

test("K707-UI-023 読み込み中は「読み込んでいます…」・種別が 503 のときは本文の場所に読めなかった旨（E-PAGE-003）と「もう一度読む」で、押すと読み直して（口 2 回）一覧が出る", async ({
  page,
}) => {
  const mk = await mockSettings(page);
  const release = mk.hold("kinds");
  await openAt(page, "");
  await expect(page.getByRole("status", { name: "読み込んでいます…" })).toBeVisible();
  await expect(page.locator(LIST)).toHaveCount(0);
  mk.script("kinds", err(503, "E-PAGE-003"));
  release();
  await expect(page.locator('[data-state="error"]')).toBeVisible();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(page.locator(LIST).getByRole("link")).toHaveCount(5);
  expect(mk.count("kinds")).toBe(2);
});

for (const w of WIDTHS) {
  test(`K707-UI-024 幅 ${w}：横のはみ出し 0（数値）・小窓を開いても 0・幅 767 以下は一覧が右の欄の上に縦に並ぶ`, async ({
    page,
  }) => {
    await mockSettings(page);
    await openBill(page, w);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    if (w <= 767) {
      const a = await page.locator(LIST).boundingBox();
      const b = await page.locator(FORM("請求")).boundingBox();
      expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
    }
    await page.getByRole("button", { name: "種別を足す", exact: true }).click();
    await expect(page.locator(DLG)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });
}
