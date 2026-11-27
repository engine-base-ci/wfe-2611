// K-962「プランを変える小窓と値段が変わるお知らせ（設定 /settings/company の「プランと支払い」の差し込み口）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f12-user の ub-plan・ub-plan-confirm・ub-plan-blocked・ub-price-change（本番と同じ部品 features/F12/billing・K-943）。
//   設定の画面そのもの（名前・ロゴ・誰ができるか）は段 11 の K-831 の物で、この葉は「プランと支払い」の区画だけを見る。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。利用者のプランの口（listWorkspacePlans・changePlan）と本人確認の取り直し
//   （getMySecurity・stepUp）だけを網の手前で差し替える（billing-mock.ts・K-960 が持つ）。時刻は page.clock で止める（固定の待ちは使わない）。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Page } from "@playwright/test";
import { PW, loginAs, signupViaApi } from "../_lib/api";
import { USER_PAIRS, USER_WIDTHS, matchUser, overflowX } from "./f12-user-match";
import { err, mockBilling, plansPriceChange, plansTaka, type BMock } from "./billing-mock";

const HOME = "/settings/company";
const NOW = new Date("2025-11-22T03:00:00Z"); // 2025-11-22 12:00 日本時間
const card = (page: Page) => page.getByRole("region", { name: "プランと支払い", exact: true });
const planDlg = (page: Page) => page.getByRole("dialog", { name: "プランを変える", exact: true });
const upDlg = (page: Page) => page.getByRole("alertdialog", { name: "ビジネス に上げる", exact: true });
const blockedDlg = (page: Page) => page.getByRole("dialog", { name: "このプランには下げられません", exact: true });
const stepDlg = (page: Page) => page.getByRole("dialog", { name: "本人か確かめます", exact: true });
const choose = (page: Page, name: string) =>
  planDlg(page)
    .locator("li.k-ub-plan", { hasText: name })
    .getByRole("button", { name: "このプランにする", exact: true });

/** 小窓と「プランと支払い」の 1 行だけを比べる（ub-* の下の頁は請求書の見本で、本番は段 11 の設定の頁のため） */
const DIALOG_PAIRS = USER_PAIRS.filter((p) =>
  ["dialog", "dialog-title", "dialog-btn", "callout"].includes(p.name),
).concat([
  { name: "plan", role: "plan", canvas: ".k-ub-plan", app: ".k-ub-plan", props: ["height", "width", "texts"] },
  {
    name: "steps",
    role: "steps",
    canvas: ".k-ub-steps li",
    app: ".k-ub-steps li",
    props: ["font-size", "color", "texts"],
  },
]);
const LINE_PAIRS = [
  {
    name: "line",
    role: "line",
    canvas: ".k-ub-setting-line",
    app: ".k-ub-setting-line",
    props: ["font-size", "color", "texts"],
  },
  {
    name: "change",
    role: "change",
    canvas: ".k-ub-change",
    app: ".k-ub-change",
    props: ["font-size", "color", "texts"],
  },
];

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openSettings(page: Page, width = 1440): Promise<void> {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(HOME);
  await expect(card(page)).toBeVisible();
}
async function openPlans(page: Page, width = 1440): Promise<void> {
  await openSettings(page, width);
  await card(page).getByRole("button", { name: "プランを変える", exact: true }).click();
  await expect(planDlg(page)).toBeVisible();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const DRIVES: Record<string, [(page: Page) => Promise<void>, typeof DIALOG_PAIRS]> = {
  "ub-plan": [
    async (page) => {
      await mockBilling(page);
      await openPlans(page, page.viewportSize()!.width);
    },
    DIALOG_PAIRS,
  ],
  "ub-plan-confirm": [
    async (page) => {
      await mockBilling(page);
      await openPlans(page, page.viewportSize()!.width);
      await choose(page, "ビジネス").click();
      await expect(upDlg(page)).toBeVisible();
    },
    DIALOG_PAIRS,
  ],
  "ub-plan-blocked": [
    async (page) => {
      await mockBilling(page);
      await openPlans(page, page.viewportSize()!.width);
      await choose(page, "無料").click();
      await expect(blockedDlg(page)).toBeVisible();
    },
    DIALOG_PAIRS,
  ],
  "ub-price-change": [
    async (page) => {
      await mockBilling(page, { plans: plansPriceChange() });
      await openSettings(page, page.viewportSize()!.width);
    },
    LINE_PAIRS,
  ],
};
for (const id of Object.keys(DRIVES)) {
  for (const w of USER_WIDTHS) {
    test(`K962-UI-001 ${id} 幅 ${w}：小窓（題・プランの行・確かめの手順・ボタン）と「プランと支払い」の 1 行・変わるお知らせの字と大きさがモックと同じ`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const [drive, pairs] = DRIVES[id]!;
      const { bad, rows } = await matchUser(browser, id, w, drive, { pairs });
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 1 行と小窓
test("K962-UI-002 設定の「プランと支払い」：1 行「チーム ・ 10 人まで ・ いま 5 人 ・ 次の請求 12/01 ¥15,000」・「プランを変える」は押せる・listWorkspacePlans は 1 回", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await openSettings(page);
  await expect(card(page).locator(".k-ub-setting-line")).toHaveText(
    "チーム ・ 10 人まで ・ いま 5 人 ・ 次の請求 12/01 ¥15,000",
  );
  await expect(card(page).getByRole("button", { name: "プランを変える", exact: true })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(card(page).locator(".k-ub-change")).toHaveCount(0);
  expect(mk.count("plans")).toBe(1);
});

test("K962-UI-003 小窓「プランを変える」：副題「株式会社ENGINE BASE ・ いま 5 人」・プラン 3 行・チームに「いま」でボタンなし・ビジネスに「おすすめ」・口は増えない", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await openPlans(page);
  await expect(planDlg(page)).toContainText("株式会社ENGINE BASE ・ いま 5 人");
  const rows = planDlg(page).locator("li.k-ub-plan");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText("いま");
  await expect(rows.nth(1).getByRole("button")).toHaveCount(0);
  await expect(rows.nth(2)).toContainText("おすすめ");
  await expect(rows.nth(2)).toContainText("¥40,000 ／月");
  expect(mk.count("plans")).toBe(1);
  expect(mk.count("plan")).toBe(0);
});

test("K962-UI-004 上げる確かめ：ビジネスの「このプランにする」で「ビジネス に上げる」が開き「今月の残り 9 日分（¥7,200）を、12/01 に出す請求書に足します。」・changePlan はまだ呼ばない", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await openPlans(page);
  await choose(page, "ビジネス").click();
  await expect(upDlg(page)).toContainText("今月の残り 9 日分（¥7,200）を、12/01 に出す請求書に足します。");
  expect(mk.count("plan")).toBe(0);
});

test("K962-UI-005 上げる：changePlan を体 { plan_key: business } で 1 回・小窓が全部閉じ・「ビジネス に変えました」・プランを読み直して 1 行がビジネスになる", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await openPlans(page);
  await choose(page, "ビジネス").click();
  await upDlg(page).getByRole("button", { name: "上げる", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "ビジネス に変えました" })).toBeVisible();
  await expect(planDlg(page)).toHaveCount(0);
  await expect(upDlg(page)).toHaveCount(0);
  expect(mk.last("plan")!.body).toEqual({ plan_key: "business" });
  expect(mk.count("plans")).toBe(2);
  await expect(card(page).locator(".k-ub-setting-line")).toContainText("ビジネス ・ 30 人まで");
});

async function needStepUp(mk: BMock): Promise<void> {
  mk.script("plan", err(403, "STEP_UP_REQUIRED"));
}
test("K962-UI-006 本人確認の取り直し：changePlan が 403 STEP_UP_REQUIRED なら getMySecurity を 1 回読み、取り直しの小窓。パスワードで確かめると stepUp 1 回 → 同じプランで changePlan をもう 1 回（押し直させない）", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await needStepUp(mk);
  await openPlans(page);
  await choose(page, "ビジネス").click();
  await upDlg(page).getByRole("button", { name: "上げる", exact: true }).click();
  await expect(stepDlg(page)).toBeVisible();
  expect(mk.count("security")).toBe(1);
  await stepDlg(page).getByLabel("パスワード", { exact: true }).fill(PW);
  await stepDlg(page).getByRole("button", { name: "確かめる", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "ビジネス に変えました" })).toBeVisible();
  expect(mk.count("stepUp")).toBe(1);
  expect(mk.calls.filter((c) => c.op === "plan").map((c) => c.body)).toEqual([
    { plan_key: "business" },
    { plan_key: "business" },
  ]);
});

test("K962-UI-007 取り直しを「やめる」：stepUp も changePlan のやり直しも呼ばない・1 行はチームのまま・お知らせの字は出ない", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await needStepUp(mk);
  await openPlans(page);
  await choose(page, "ビジネス").click();
  await upDlg(page).getByRole("button", { name: "上げる", exact: true }).click();
  await stepDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(stepDlg(page)).toHaveCount(0);
  expect(mk.count("stepUp")).toBe(0);
  expect(mk.count("plan")).toBe(1);
  await expect(card(page).locator(".k-ub-setting-line")).toContainText("チーム ・ 10 人まで");
  await expect(page.getByText("ビジネス に変えました", { exact: true })).toHaveCount(0);
});

test("K962-UI-008 下げられない（人数が上限を超える）：無料を選ぶと「このプランには下げられません」「無料 は 3 人まで」「いまのメンバーは 5 人で、上限（3 人）を超えています」・「このプランにする」は押せない・changePlan 0 回・「メンバーを見る」で /members", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await openPlans(page);
  await choose(page, "無料").click();
  const d = blockedDlg(page);
  await expect(d).toContainText("無料 は 3 人まで");
  await expect(d).toContainText("いまのメンバーは 5 人で、上限（3 人）を超えています");
  await expect(d.getByRole("button", { name: "このプランにする", exact: true })).toBeDisabled();
  expect(mk.count("plan")).toBe(0);
  await d.getByRole("button", { name: "メンバーを見る", exact: true }).click();
  await expect(page).toHaveURL(/\/members$/);
});

test("K962-UI-009 下げる確かめ：下げられる無料を選ぶと「無料 に下げる」と「次の請求日（12/01）から」の字・下げると changePlan { plan_key: free } を 1 回", async ({
  page,
}) => {
  const plans = plansTaka().map((p) =>
    p.plan_key === "free" ? { ...p, can_choose: true, effective_from: "2025-12-01", reason: undefined } : p,
  );
  const mk = await mockBilling(page, { plans, members: 2 });
  await openPlans(page);
  await choose(page, "無料").click();
  const d = page.getByRole("alertdialog", { name: "無料 に下げる", exact: true });
  await expect(d).toContainText("次の請求日（12/01）から");
  await d.getByRole("button", { name: "下げる", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "無料 に変えました" })).toBeVisible();
  expect(mk.last("plan")!.body).toEqual({ plan_key: "free" });
});

test("K962-UI-010 下げる間に人数が増えた（changePlan が 409）：プランを読み直し、選べなくなっていれば「このプランには下げられません」を出す（2 回目の changePlan は呼ばない）", async ({
  page,
}) => {
  const plans = plansTaka().map((p) => (p.plan_key === "free" ? { ...p, can_choose: true, reason: undefined } : p));
  const mk = await mockBilling(page, { plans, members: 3 });
  mk.script("plan", err(409, "E-PLAN-002"));
  await openPlans(page);
  await choose(page, "無料").click();
  mk.plans = plansTaka();
  mk.members = 5;
  await page
    .getByRole("alertdialog", { name: "無料 に下げる", exact: true })
    .getByRole("button", { name: "下げる", exact: true })
    .click();
  await expect(blockedDlg(page)).toContainText("いまのメンバーは 5 人で、上限（3 人）を超えています");
  expect(mk.count("plan")).toBe(1);
  expect(mk.count("plans")).toBe(2);
});

test("K962-UI-011 変えられなかった（503 E-PAGE-003）：確かめの小窓を閉じて「プランを変える」の小窓に alert・1 行はチームのまま・読み直さない", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  mk.script("plan", err(503, "E-PAGE-003"));
  await openPlans(page);
  await choose(page, "ビジネス").click();
  await upDlg(page).getByRole("button", { name: "上げる", exact: true }).click();
  await expect(planDlg(page).getByRole("alert")).toBeVisible();
  await expect(upDlg(page)).toHaveCount(0);
  expect(mk.count("plans")).toBe(1);
  await expect(card(page).locator(".k-ub-setting-line")).toContainText("チーム ・ 10 人まで");
});

test("K962-UI-012 二度押し：答えを止めている間に「上げる」を 2 回押しても changePlan は 1 回", async ({ page }) => {
  const mk = await mockBilling(page);
  const release = mk.hold("plan");
  await openPlans(page);
  await choose(page, "ビジネス").click();
  const b = upDlg(page).getByRole("button", { name: "上げる", exact: true });
  await b.click();
  await b.click({ force: true });
  release();
  await expect(page.getByRole("status").filter({ hasText: "ビジネス に変えました" })).toBeVisible();
  expect(mk.count("plan")).toBe(1);
});

test("K962-UI-013 プランと支払いの権限が無い（listWorkspacePlans が 403）：「プランを変える」「請求書」は押せない形（aria-disabled）で、押しても小窓は開かない", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  mk.script("plans", err(403, "FORBIDDEN"));
  await openSettings(page);
  const b = card(page).getByRole("button", { name: "プランを変える", exact: true });
  await expect(b).toHaveAttribute("aria-disabled", "true");
  await b.click({ force: true });
  await expect(planDlg(page)).toHaveCount(0);
  await expect(card(page).getByText("請求書", { exact: true })).toHaveAttribute("aria-disabled", "true");
  expect(mk.count("plan")).toBe(0);
});

test("K962-UI-014 値段が変わる予定：1 行に「変わる」の札と、role=status の「2027 年 2 月分から ¥18,000（税別）・ 人数は 12 人まで に広がる。それまでは今のまま（お知らせ 11/05）」", async ({
  page,
}) => {
  await mockBilling(page, { plans: plansPriceChange() });
  await openSettings(page);
  await expect(card(page).getByText("変わる", { exact: true })).toBeVisible();
  await expect(card(page).locator(".k-ub-change")).toHaveText(
    "2027 年 2 月分から ¥18,000（税別）・ 人数は 12 人まで に広がる。それまでは今のまま（お知らせ 11/05）",
  );
});

test("K962-UI-015 行き先：1 行と小窓の「請求書」は /billing へ。小窓の「カード払いは後のフェーズ」は押せない形", async ({
  page,
}) => {
  await mockBilling(page);
  await openPlans(page);
  await expect(planDlg(page).getByRole("link", { name: "請求書", exact: true })).toHaveAttribute("href", "/billing");
  await expect(planDlg(page).getByText("カード払いは後のフェーズ", { exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await planDlg(page).getByRole("button", { name: "やめる", exact: true }).click();
  await card(page).getByRole("link", { name: "請求書", exact: true }).click();
  await expect(page).toHaveURL(/\/billing$/);
});

test("K962-UI-016 幅 320・375・768・1024・1440 で、設定の画面と「プランを変える」の小窓の横のはみ出しが 0 以下", async ({
  page,
}) => {
  await mockBilling(page);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openPlans(page, w);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
});
