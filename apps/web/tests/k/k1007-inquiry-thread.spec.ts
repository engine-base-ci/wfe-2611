// K-1007「問い合わせ 1 件のやり取り（/inquiry/[id]）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f12-user の uh-thread・uh-thread-done・uh-thread-notfound（本番と同じ部品 features/F12/help・K-943）。
//   ログイン・外枠は本物。利用者の口（getMyInquiry・postInquiryMessage・resolveMyInquiry・listMyInquiries）だけを網の手前で差し替える
//   （help-mock.ts・K-956）。本人の Bridge は届かせない。固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { USER_PAIRS, USER_WIDTHS, matchUser, overflowX } from "./f12-user-match";
import { GONE, ME, Q_STUCK, err, mockHelp, threadTaka, type HMock } from "./help-mock";

const ONE = `/inquiry/${Q_STUCK}`;
const MSGS = 'ul[aria-label="やり取り"] > li';

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openAt(page: Page, path = ONE, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(path);
}
async function openOne(page: Page, width = 1440): Promise<void> {
  await openAt(page, ONE, width);
  await expect(
    page.getByRole("heading", { name: "PC をつけているのに実行待ちのまま", level: 1, exact: true }),
  ).toBeVisible();
}
const reply = (page: Page, label = "返事を書く") => page.getByLabel(label, { exact: true });
const sendBtn = (page: Page, name = "送る") => page.locator(".k-uh-compose").getByRole("button", { name, exact: true });
const doneMock = async (page: Page): Promise<HMock> => {
  const t = threadTaka();
  t.state = "done";
  t.messages = [
    ...t.messages,
    {
      id: "0193c5a0-0000-7000-8000-000000007003",
      from: "me",
      author_name: ME,
      body: "預け直したら、すぐ動きました。ありがとうございました。",
      attachments: [],
      created_at: "2025-11-02T01:40:00Z",
    },
  ];
  return mockHelp(page, { thread: t });
};

// ---------------------------------------------------------------- モックと本番の突き合わせ
const DRIVES: Record<string, (page: Page) => Promise<void>> = {
  "uh-thread": async (page) => {
    await mockHelp(page);
    await openOne(page, page.viewportSize()!.width);
  },
  "uh-thread-done": async (page) => {
    await doneMock(page);
    await openOne(page, page.viewportSize()!.width);
    await expect(page.getByText("済みにしました", { exact: true })).toBeVisible();
  },
  "uh-thread-notfound": async (page) => {
    await mockHelp(page);
    await openAt(page, `/inquiry/${GONE}`, page.viewportSize()!.width);
    await expect(page.locator('[data-code="E-PAGE-001"]')).toBeVisible();
  },
};
// 見つからないの箱（E-PAGE-001 は重さ medium で role を持たない・外枠の [role] の組に当たらない）も比べる
const ERROR_PAIR = {
  name: "error",
  role: "error",
  canvas: ".k-state[data-state='error']",
  app: ".k-state[data-state='error']",
  props: ["width", "height", "x", "y", "texts"],
};
for (const id of Object.keys(DRIVES)) {
  for (const w of USER_WIDTHS) {
    test(`K1007-UI-001 ${id} 幅 ${w}：見出し・やり取り・書く欄・右の注・見つからないの位置と大きさと字がモックと同じ`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const { bad, rows } = await matchUser(browser, id, w, DRIVES[id]!, { pairs: [...USER_PAIRS, ERROR_PAIR] });
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 開く・読む
test("K1007-UI-002 開く：1 件の口 1 回・見出しの下に「うまく動かない ・ 11/02 09:40 に送った」・札「返事あり」・やり取り 2 つ（自分・運営の順）・最初の書き込みに付けた情報", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openOne(page);
  await expect(page.getByText("うまく動かない ・ 11/02 09:40 に送った", { exact: true })).toBeVisible();
  await expect(page.locator(".k-page-head").getByText("返事あり", { exact: true })).toBeVisible();
  const msgs = page.locator(MSGS);
  await expect(msgs).toHaveCount(2);
  await expect(msgs.nth(0)).toHaveAttribute("data-from", "me");
  await expect(msgs.nth(1)).toHaveAttribute("data-from", "ops");
  await expect(msgs.nth(1)).toContainText("Kaname 運営（佐野）");
  await expect(msgs.nth(0).locator(".k-uh-msg-attach")).toHaveText(
    "付けた情報：画面 チケット EG-128 ・ Chrome 130 ・ PC つながっている（09:38）",
  );
  expect(mk.count("inquiry")).toBe(1);
  expect(mk.count("post") + mk.count("resolve")).toBe(0);
});

test("K1007-UI-003 開いた後に困ったとき・お知らせへ戻ると、自分の問い合わせを読み直す（返事ありの印を口の答えに合わせる）", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openAt(page, "/notices");
  await expect(page.locator('section.k-section:has(> h2:text-is("自分の問い合わせ")) li')).toHaveCount(2);
  await page.getByRole("link", { name: "PC をつけているのに実行待ちのまま", exact: true }).click();
  await expect(page.locator(MSGS)).toHaveCount(2);
  await page.goBack();
  await expect(page.locator('section.k-section:has(> h2:text-is("自分の問い合わせ")) li')).toHaveCount(2);
  expect(mk.count("inquiries")).toBe(2);
});

// ---------------------------------------------------------------- 書く・済み
test("K1007-UI-004 返事を書いて送る：postInquiryMessage 1 回（体は body だけ）・やり取りの最後に出て欄が空になる・札は「返事を待っている」・1 件を読み直す", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openOne(page);
  await reply(page).fill("預け直しました");
  await sendBtn(page).click();
  await expect(page.locator(MSGS)).toHaveCount(3);
  await expect(page.locator(MSGS).last()).toContainText("預け直しました");
  await expect(reply(page)).toHaveValue("");
  await expect(page.locator(".k-page-head").getByText("返事を待っている", { exact: true })).toBeVisible();
  expect(mk.count("post")).toBe(1);
  expect(mk.last("post")).toMatchObject({ id: Q_STUCK, body: { body: "預け直しました" } });
  expect(mk.count("inquiry")).toBe(2);
});

test("K1007-UI-005 空・空白だけで送る：口を呼ばず欄の下に「返事を書いてください」（aria-invalid）", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openOne(page);
  await reply(page).fill("　 ");
  await sendBtn(page).click();
  await expect(page.getByText("返事を書いてください", { exact: true })).toBeVisible();
  await expect(reply(page)).toHaveAttribute("aria-invalid", "true");
  expect(mk.count("post")).toBe(0);
});

test("K1007-UI-006 「解決したので済みにする」：resolveMyInquiry 1 回（体 {}）・「済みにしました」・札「済み」・欄と押す物が「もう一度聞く」になる", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openOne(page);
  await page.getByRole("button", { name: "解決したので済みにする", exact: true }).click();
  await expect(page.getByText("済みにしました", { exact: true })).toBeVisible();
  await expect(page.locator(".k-page-head").getByText("済み", { exact: true })).toBeVisible();
  await expect(reply(page, "もう一度聞く")).toBeVisible();
  await expect(sendBtn(page, "もう一度聞く")).toBeVisible();
  expect(mk.count("resolve")).toBe(1);
  expect(mk.last("resolve")).toMatchObject({ id: Q_STUCK, body: {} });
});

test("K1007-UI-007 済みの後にもう一度聞く：書き込みの口 1 回で開き直る（「済みにしました」が消え札は「返事を待っている」・D-156.25）", async ({
  page,
}) => {
  const mk = await doneMock(page);
  await openOne(page);
  await reply(page, "もう一度聞く").fill("また止まりました");
  await sendBtn(page, "もう一度聞く").click();
  await expect(page.locator(".k-page-head").getByText("返事を待っている", { exact: true })).toBeVisible();
  await expect(page.getByText("済みにしました", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "解決したので済みにする", exact: true })).toBeVisible();
  expect(mk.count("post")).toBe(1);
});

// ---------------------------------------------------------------- 失敗・揺れ・入口
test("K1007-UI-008 無い・見えない問い合わせ（別の人の・消えた・古いリンク）：「見つからない」（E-PAGE-001）と困ったとき・お知らせへの道・書く口を呼ばない", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  await openAt(page, `/inquiry/${GONE}`);
  await expect(page.locator('[data-code="E-PAGE-001"]')).toBeVisible();
  await expect(page.locator('[data-code="E-PAGE-001"] a')).toHaveAttribute("href", "/notices");
  expect(mk.count("post") + mk.count("resolve")).toBe(0);
});

test("K1007-UI-009 読めない（503・網の切れ）：読めなかった旨（E-PAGE-007）と「もう一度」で読み直してやり取りが出る", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  mk.script("inquiry", err(503, "E-PAGE-003"));
  await openAt(page);
  await expect(page.locator('[data-code="E-PAGE-007"]')).toBeVisible();
  await page.locator('[data-code="E-PAGE-007"]').getByRole("button").first().click();
  await expect(page.locator(MSGS)).toHaveCount(2);
  expect(mk.count("inquiry")).toBe(2);
});

test("K1007-UI-010 送れない（503・網の切れ）：書く欄の上に赤い箱（E-PAGE-003・E-PAGE-007）・書いた字は残る・押し直すと送れる／404（その間に見えなくなった）は「見つからない」", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  mk.script("post", err(503, "E-PAGE-003"), "network", err(404, "NOT_FOUND"));
  await openOne(page);
  await reply(page).fill("預け直しました");
  for (const code of ["E-PAGE-003", "E-PAGE-007"]) {
    await sendBtn(page).click();
    await expect(page.locator(`.k-uh-compose [role="alert"][data-code="${code}"]`)).toBeVisible();
    await expect(reply(page)).toHaveValue("預け直しました");
  }
  await sendBtn(page).click();
  await expect(page.locator('[data-code="E-PAGE-001"]')).toBeVisible();
  expect(mk.count("post")).toBe(3);
});

test("K1007-UI-011 済みにできない（503）：赤い箱（E-PAGE-003）・札は「返事あり」のまま", async ({ page }) => {
  const mk = await mockHelp(page);
  mk.script("resolve", err(503, "E-PAGE-003"));
  await openOne(page);
  await page.getByRole("button", { name: "解決したので済みにする", exact: true }).click();
  await expect(page.locator('[role="alert"][data-code="E-PAGE-003"]')).toBeVisible();
  await expect(page.locator(".k-page-head").getByText("返事あり", { exact: true })).toBeVisible();
  expect(mk.count("resolve")).toBe(1);
});

test("K1007-UI-012 二度押し：答えを待つ間「送る」「解決したので済みにする」は押せず、口は 1 回ずつ", async ({
  page,
}) => {
  const mk = await mockHelp(page);
  const open = mk.hold("post");
  await openOne(page);
  await reply(page).fill("預け直しました");
  await sendBtn(page).click();
  await expect(sendBtn(page)).toBeDisabled();
  await sendBtn(page).click({ force: true });
  open();
  await expect(page.locator(MSGS)).toHaveCount(3);
  expect(mk.count("post")).toBe(1);
  const openR = mk.hold("resolve");
  await page.getByRole("button", { name: "解決したので済みにする", exact: true }).click();
  await expect(page.getByRole("button", { name: "解決したので済みにする", exact: true })).toBeDisabled();
  openR();
  await expect(page.getByText("済みにしました", { exact: true })).toBeVisible();
  expect(mk.count("resolve")).toBe(1);
});

test("K1007-UI-013 HTML の入った書き込み（運営の返事も）は字のまま・スクリプトが動かない", async ({ page }) => {
  const t = threadTaka();
  t.messages[1]!.body = '<img src=x onerror="window.__x=1">返事';
  await mockHelp(page, { thread: t });
  await openOne(page);
  await expect(page.locator(MSGS).nth(1)).toContainText('<img src=x onerror="window.__x=1">返事');
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
});

test("K1007-UI-014 幅 320・375・768・1024・1440：やり取りの画面の横のはみ出しが 0", async ({ page }) => {
  await mockHelp(page);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openOne(page, w);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
});
