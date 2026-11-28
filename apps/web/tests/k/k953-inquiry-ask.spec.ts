// K-953「問い合わせる小窓（/inquiry）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f12-user の uh-ask・uh-ask-invalid・uh-ask-file・uh-ask-sent（本番と同じ部品 features/F12/help・K-943）。
//   ログイン・外枠は本物。利用者の口（createInquiry・uploadInquiryAttachment・上げる先への PUT・listMyInquiries ほか）だけを
//   網の手前で差し替える（help-mock.ts・K-956）。本人の Bridge は届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { USER_WIDTHS, matchUser, overflowX } from "./f12-user-match";
import { Q_NEW, err, mockHelp } from "./help-mock";
// ▾ は部品 components/k の Select（Base UI）。素の <select> は無いので、▾ を押して開いた portal の role=option を押す・数える
async function choose(page: Page, sel: Locator, label: string): Promise<void> {
  await sel.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const ASK = "/inquiry";
const DLG = '[role="dialog"]:has(h2:text-is("問い合わせる"))';
const MB = 1024 * 1024;
const png = (name: string, size: number) => ({ name, mimeType: "image/png", buffer: Buffer.alloc(size, 1) });
const zip = (name: string, size: number) => ({ name, mimeType: "application/zip", buffer: Buffer.alloc(size, 2) });

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openAsk(page: Page, query = "", width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(`${ASK}${query}`);
  await expect(page.locator(DLG)).toBeVisible();
}
const dlg = (page: Page) => page.locator(DLG);
// 必須の欄の見出しは「題*」「内容*」（印 * は読み上げない）。getByLabel の exact は印を含む字で比べて当たらないので、読み上げの名前で探す
const title = (page: Page) => dlg(page).getByRole("textbox", { name: "題", exact: true });
const body = (page: Page) => dlg(page).getByRole("textbox", { name: "内容", exact: true });
const send = (page: Page) => dlg(page).getByRole("button", { name: "送る", exact: true });
const pick = (page: Page) => dlg(page).locator('input[type="file"]');
async function fill(page: Page): Promise<void> {
  await choose(page, dlg(page).getByRole("combobox", { name: "何について", exact: true }), "うまく動かない");
  await title(page).fill("PC をつけているのに実行待ちのまま");
  await body(page).fill(
    "請求書を送るチケット（KN-212）を承認したのですが、30 分たっても「実行待ち」のままです。PC はつけています。",
  );
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const DRIVES: Record<string, (page: Page) => Promise<void>> = {
  "uh-ask": async (page) => {
    await mockHelp(page);
    await openAsk(page, "", page.viewportSize()!.width);
    await fill(page);
  },
  "uh-ask-invalid": async (page) => {
    await mockHelp(page);
    await openAsk(page, "", page.viewportSize()!.width);
    await choose(page, dlg(page).getByRole("combobox", { name: "何について", exact: true }), "うまく動かない");
    await send(page).click();
    await expect(dlg(page).getByText("内容を書いてください", { exact: true })).toBeVisible();
  },
  "uh-ask-file": async (page) => {
    await mockHelp(page);
    await openAsk(page, "", page.viewportSize()!.width);
    await choose(page, dlg(page).getByRole("combobox", { name: "何について", exact: true }), "うまく動かない");
    await title(page).fill("実行待ちのまま止まっています");
    await body(page).fill("画面の写しを付けます。");
    await pick(page).setInputFiles([png("画面の写し.png", Math.round(1.2 * MB)), zip("実行の記録.zip", 48 * MB)]);
    await expect(dlg(page).getByRole("alert")).toBeVisible();
  },
  "uh-ask-sent": async (page) => {
    await mockHelp(page);
    await openAsk(page, "", page.viewportSize()!.width);
    await fill(page);
    await send(page).click();
    await expect(page.getByText("運営に届きました", { exact: true })).toBeVisible();
  },
};
for (const id of Object.keys(DRIVES)) {
  for (const w of USER_WIDTHS) {
    test(`K953-UI-001 ${id} 幅 ${w}：小窓（題・欄・付けたファイル・確かめ）と送った後のホームの位置と大きさと字がモックと同じ`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const { bad, rows } = await matchUser(browser, id, w, DRIVES[id]!);
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 開く
test("K953-UI-002 /inquiry は困ったとき・お知らせの上に小窓「問い合わせる」を開く：何について 4 つ・「いま見ている画面の情報を付ける」は入っている・焦点は何について・口はまだ書かない", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openAsk(page);
  // 小窓を開いたときの焦点は 何について（▾ を押す前に見る。押して閉じると焦点は ▾ に戻るので後では確かめにならない）
  await expect(dlg(page).getByRole("combobox", { name: "何について", exact: true })).toBeFocused();
  await dlg(page).getByRole("combobox", { name: "何について", exact: true }).click();
  // 選んでいる行は部品の印「✓」が字に入るので、頭の「✓」を許して比べる（出るまで待つ確かめ）
  await expect(page.getByRole("option")).toHaveText([
    /^✓?使い方$/,
    /^✓?うまく動かない$/,
    /^✓?お金・プラン$/,
    /^✓?ほか$/,
  ]);
  await page.keyboard.press("Escape");
  await expect(dlg(page).getByRole("checkbox")).toBeChecked();
  expect(mk.count("create") + mk.count("upload")).toBe(0);
});

test("K953-UI-003 題・内容が空のまま送る：口を呼ばず欄の下に「題を書いてください」「内容を書いてください」（aria-invalid）・書くと消える", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openAsk(page);
  await send(page).click();
  await expect(dlg(page).getByText("題を書いてください", { exact: true })).toBeVisible();
  await expect(dlg(page).getByText("内容を書いてください", { exact: true })).toBeVisible();
  await expect(title(page)).toHaveAttribute("aria-invalid", "true");
  expect(mk.count("create")).toBe(0);
  await title(page).fill("題");
  await expect(dlg(page).getByText("題を書いてください", { exact: true })).toHaveCount(0);
});

test("K953-UI-004 送る：createInquiry 1 回（何について trouble・題・内容・画面の情報）・小窓が閉じて /notices に「運営に届きました」・自分の問い合わせを読み直して頭に「いま」の返事を待っている", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openAsk(page);
  await fill(page);
  await send(page).click();
  await expect(page).toHaveURL(/\/notices\?sent=1$/);
  await expect(page.getByText("運営に届きました", { exact: true })).toBeVisible();
  expect(mk.count("create")).toBe(1);
  const b = mk.last("create")!.body;
  expect(Object.keys(b).sort()).toEqual(["body", "context", "title", "topic"]);
  expect(b).toMatchObject({ topic: "trouble", title: "PC をつけているのに実行待ちのまま" });
  expect(b["context"]).toMatchObject({ path: ASK });
  expect(mk.count("inquiries")).toBeGreaterThanOrEqual(2);
  const first = page.locator('section.k-section:has(> h2:text-is("自分の問い合わせ")) li').first();
  await expect(first).toContainText("返事を待っている");
  await expect(first).toContainText("いま");
  await expect(first.getByRole("link")).toHaveAttribute("href", `/inquiry/${Q_NEW}`);
});

test("K953-UI-005 「いま見ている画面の情報を付ける」を外して送ると、体に context が無い", async ({ page }) => {
  const mk = await mockHelp(page);
  await openAsk(page);
  await fill(page);
  await dlg(page).getByRole("checkbox").uncheck();
  await send(page).click();
  await expect(page.getByText("運営に届きました", { exact: true })).toBeVisible();
  expect(Object.keys(mk.last("create")!.body)).not.toContain("context");
});

test("K953-UI-006 来た画面：/inquiry?from=/tickets/abc は context.path が /tickets/abc・外の URL は付けた場所（/inquiry）", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openAsk(page, "?from=%2Ftickets%2Fabc");
  await fill(page);
  await send(page).click();
  await expect(page.getByText("運営に届きました", { exact: true })).toBeVisible();
  expect(mk.last("create")!.body["context"]).toMatchObject({ path: "/tickets/abc" });
  await openAsk(page, "?from=https%3A%2F%2Fevil.example%2Fx");
  await fill(page);
  await send(page).click();
  await expect(page.getByText("運営に届きました", { exact: true })).toBeVisible();
  expect(mk.last("create")!.body["context"]).toMatchObject({ path: ASK });
});

// ---------------------------------------------------------------- 付ける
test("K953-UI-007 ファイルを付ける：上げる先の口 1 回（名前・種類・大きさ）→ 上げる先に中身を PUT（同じ大きさと種類）→ 上げ終わりに POST 1 回 →「付いた」・送ると attachment_ids に id", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openAsk(page);
  await fill(page);
  await pick(page).setInputFiles([png("画面の写し.png", Math.round(1.2 * MB))]);
  await expect(dlg(page).locator(".k-uh-file").getByText("付いた", { exact: true })).toBeVisible();
  expect(mk.last("upload")!.body).toEqual({
    name: "画面の写し.png",
    content_type: "image/png",
    size: Math.round(1.2 * MB),
  });
  expect(mk.count("put")).toBe(1);
  expect(mk.last("put")).toMatchObject({ size: Math.round(1.2 * MB), contentType: "image/png" });
  expect(mk.count("done")).toBe(1);
  expect(mk.last("done")!.url.endsWith("/__k956_done/1")).toBe(true);
  await send(page).click();
  await expect(page.getByText("運営に届きました", { exact: true })).toBeVisible();
  const ids = mk.last("create")!.body["attachment_ids"] as string[];
  expect(ids).toHaveLength(1);
  expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
});

test("K953-UI-008 10MB を超えるファイル・6 つ目：行に「大きすぎて付けられません（1 つ 10MB まで・5 つまで）」・上げる先の口を呼ばない・送る体に入らない", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openAsk(page);
  await fill(page);
  await pick(page).setInputFiles([zip("実行の記録.zip", 10 * MB + 1)]);
  await expect(dlg(page).getByRole("alert")).toHaveText("大きすぎて付けられません（1 つ 10MB まで・5 つまで）");
  expect(mk.count("upload")).toBe(0);
  for (let i = 1; i <= 5; i += 1) await pick(page).setInputFiles([png(`写し${i}.png`, 10)]);
  await expect(dlg(page).locator(".k-uh-file").getByText("付いた", { exact: true })).toHaveCount(5);
  await pick(page).setInputFiles([png("写し6.png", 10)]);
  await expect(dlg(page).locator('.k-uh-file[data-bad="true"]')).toHaveCount(2);
  expect(mk.count("upload")).toBe(5);
  await send(page).click();
  await expect(page.getByText("運営に届きました", { exact: true })).toBeVisible();
  expect(mk.last("create")!.body["attachment_ids"] as string[]).toHaveLength(5);
});

test("K953-UI-009 種類が違うファイル（.exe）：行に「この種類は付けられません（画像・PDF・zip）」・口を呼ばない", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openAsk(page);
  await pick(page).setInputFiles([
    { name: "道具.exe", mimeType: "application/x-msdownload", buffer: Buffer.alloc(10) },
  ]);
  await expect(dlg(page).getByRole("alert")).toHaveText("この種類は付けられません（画像・PDF・zip）");
  expect(mk.count("upload")).toBe(0);
});

test("K953-UI-010 上げられない（上げる先の口が 503・PUT が網の切れ）：行に「付けられませんでした。もう一度付けてください」・上げ終わりが 415 E-INQ-003 なら「この種類は付けられません（画像・PDF・zip）」・どれも送る体に入らない・送れる", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  mk.script("upload", err(503, "E-PAGE-003"));
  mk.script("put", "network");
  await openAsk(page);
  await fill(page);
  await pick(page).setInputFiles([png("a.png", 10)]);
  await expect(dlg(page).getByRole("alert")).toHaveText("付けられませんでした。もう一度付けてください");
  await pick(page).setInputFiles([png("b.png", 10)]);
  await expect(dlg(page).getByRole("alert")).toHaveCount(2);
  mk.script("done", err(415, "E-INQ-003"));
  await pick(page).setInputFiles([png("c.png", 10)]);
  await expect(dlg(page).getByRole("alert")).toHaveCount(3);
  await expect(dlg(page).getByRole("alert").nth(2)).toHaveText("この種類は付けられません（画像・PDF・zip）");
  await send(page).click();
  await expect(page.getByText("運営に届きました", { exact: true })).toBeVisible();
  expect(Object.keys(mk.last("create")!.body)).not.toContain("attachment_ids");
});

test("K953-UI-011 上げている間は「送る」を押せない（付け終わるまで待つ）", async ({ page }) => {
  const mk = await mockHelp(page);
  const open = mk.hold("put");
  await openAsk(page);
  await fill(page);
  await pick(page).setInputFiles([png("a.png", 10)]);
  await expect(send(page)).toBeDisabled();
  open();
  await expect(dlg(page).locator(".k-uh-file").getByText("付いた", { exact: true })).toBeVisible();
  await expect(send(page)).toBeEnabled();
});

// ---------------------------------------------------------------- 失敗・揺れ
test("K953-UI-012 二度押し：答えを待つ間「送る」を押せず、口は 1 回", async ({ page }) => {
  const mk = await mockHelp(page);
  const open = mk.hold("create");
  await openAsk(page);
  await fill(page);
  await send(page).click();
  await expect(send(page)).toBeDisabled();
  await send(page).click({ force: true });
  open();
  await expect(page.getByText("運営に届きました", { exact: true })).toBeVisible();
  expect(mk.count("create")).toBe(1);
});

test("K953-UI-013 送れない（503・網の切れ・404 の付けたファイルが見えない）：小窓の上に赤い箱（E-PAGE-003・E-PAGE-007・E-PAGE-001 の字）・閉じず中身は残る・押し直すと送れる", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  mk.script("create", err(503, "E-PAGE-003"), "network", err(404, "NOT_FOUND"));
  await openAsk(page);
  await fill(page);
  for (const code of ["E-PAGE-003", "E-PAGE-007", "E-PAGE-001"]) {
    await send(page).click();
    await expect(dlg(page).locator(`[role="alert"][data-code="${code}"]`)).toBeVisible();
    await expect(title(page)).toHaveValue("PC をつけているのに実行待ちのまま");
  }
  await send(page).click();
  await expect(page.getByText("運営に届きました", { exact: true })).toBeVisible();
  expect(mk.count("create")).toBe(4);
});

test("K953-UI-014 やめる・Esc：口を呼ばず小窓を閉じて /notices へ", async ({ page }) => {
  const mk = await mockHelp(page);
  await openAsk(page);
  await fill(page);
  await dlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(page).toHaveURL(/\/notices$/);
  await openAsk(page);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/notices$/);
  expect(mk.count("create") + mk.count("upload")).toBe(0);
});

test("K953-UI-015 HTML の入った題・ファイルの名前は字のまま（スクリプトが動かない）", async ({ page }) => {
  await mockHelp(page);
  await openAsk(page);
  await pick(page).setInputFiles([png('<img src=x onerror="window.__x=1">.png', 10)]);
  await expect(dlg(page).locator(".k-uh-file-name")).toContainText('<img src=x onerror="window.__x=1">.png');
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
});

test("K953-UI-016 幅 320・375・768・1024・1440：小窓を開いて付けたファイルが 2 つの形で横のはみ出しが 0", async ({
  page,
}) => {
  await mockHelp(page);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openAsk(page, "", w);
    await pick(page).setInputFiles([png("画面の写し.png", 10), zip("実行の記録.zip", 48 * MB)]);
    await expect(dlg(page).locator(".k-uh-file")).toHaveCount(2);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
});
