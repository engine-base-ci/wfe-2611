// K-960「請求書の画面（/billing）・請求先を変える小窓・見られない」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f12-user の ub-bills・ub-bills-overdue・ub-bills-empty・ub-contact・ub-bills-noaccess（本番と同じ部品 features/F12/billing・K-943）。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。利用者の請求の口（getBilling・downloadInvoicePdf・updateBillingContact）だけを
//   網の手前で差し替える（billing-mock.ts）。本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない
import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { USER_PAIRS, USER_WIDTHS, matchUser, overflowX } from "./f12-user-match";
import { INV_OCT, PDF_URL, billingFree, billingOverdue, billingTaka, err, invalid, mockBilling } from "./billing-mock";
// 必須の欄の見出しは「会社名*」の形（印 * は読み上げない）。getByLabel の exact は印を含む字で比べて当たらないので、印のある・無いの両方に当てる

const HOME = "/billing";
const TABLE = ".k-f12-rt-table";
const CARDS = ".k-f12-rt-cards";
const contactDlg = (page: Page) => page.getByRole("dialog", { name: "請求先を変える", exact: true });

/** 請求書の画面の役（USER_PAIRS に足す・表と組と支払い条件） */
const BILL_PAIRS = [
  ...USER_PAIRS,
  {
    name: "terms",
    role: "terms",
    canvas: ".k-ub-terms > div",
    app: ".k-ub-terms > div",
    props: ["x", "y", "width", "texts"],
  },
  { name: "row", role: "row", canvas: `${TABLE} tbody tr`, app: `${TABLE} tbody tr`, props: ["height", "texts"] },
  { name: "card", role: "card", canvas: ".k-f12-rt-card", app: ".k-f12-rt-card", props: ["height", "x", "texts"] },
  { name: "note", role: "note", canvas: ".k-ub-note", app: ".k-ub-note", props: ["x", "font-size", "color", "texts"] },
];

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function openAt(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(HOME);
}
async function openBills(page: Page, width = 1440): Promise<void> {
  await openAt(page, width);
  await expect(page.getByRole("heading", { name: "請求書", level: 1, exact: true })).toBeVisible();
}

// ---------------------------------------------------------------- モックと本番の突き合わせ
const DRIVES: Record<string, (page: Page) => Promise<void>> = {
  "ub-bills": async (page) => {
    await mockBilling(page);
    await openBills(page, page.viewportSize()!.width);
  },
  "ub-bills-overdue": async (page) => {
    await mockBilling(page, { billing: billingOverdue() });
    await openBills(page, page.viewportSize()!.width);
    await expect(page.getByText("期限を過ぎた請求があります", { exact: true })).toBeVisible();
  },
  "ub-bills-empty": async (page) => {
    await mockBilling(page, { billing: billingFree() });
    await openBills(page, page.viewportSize()!.width);
    await expect(page.getByText("まだ請求書がありません", { exact: true })).toBeVisible();
  },
  "ub-contact": async (page) => {
    await mockBilling(page);
    await openBills(page, page.viewportSize()!.width);
    await page.getByRole("button", { name: "変える", exact: true }).click();
    await expect(contactDlg(page)).toBeVisible();
  },
  "ub-bills-noaccess": async (page) => {
    const mk = await mockBilling(page);
    mk.script("billing", err(403, "FORBIDDEN"));
    await openAt(page, page.viewportSize()!.width);
    await expect(page.locator('[data-code="E-PAGE-002"]')).toBeVisible();
  },
};
for (const id of Object.keys(DRIVES)) {
  for (const w of USER_WIDTHS) {
    test(`K960-UI-001 ${id} 幅 ${w}：本文（見出し・支払い条件・振込先・請求先・表か組・注意・小窓）の位置と大きさと字がモックと同じ`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const { bad, rows } = await matchUser(browser, id, w, DRIVES[id]!, { pairs: BILL_PAIRS });
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- 開く・読む
test("K960-UI-002 /billing を開くと見出し「請求書」・支払い条件・振込先 3 行・請求先・表 3 行（状態の札）。getBilling は 1 回（StrictMode でも二重にしない）", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await openBills(page);
  await expect(page.locator(".k-page-sub")).toHaveText("請求書払い ・ 月末締め 翌月 1 日に出す ・ 月末払い");
  await expect(page.locator(".k-ub-terms")).toContainText("〇〇銀行 本店 普通 1234567");
  await expect(page.locator(".k-ub-terms")).toContainText("株式会社ENGINE BASE 経理 ご担当");
  const rows = page.locator(`${TABLE} tbody tr`);
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("10 月分");
  await expect(rows.nth(0)).toContainText("¥16,500");
  await expect(rows.nth(0)).toContainText("お支払い待ち");
  await expect(rows.nth(1)).toContainText("払われた");
  await expect(rows.nth(1)).toContainText("10/28");
  expect(mk.count("billing")).toBe(1);
  expect(mk.count("pdf")).toBe(0);
});

test("K960-UI-003 期限を過ぎた請求：表の上に注意「期限を過ぎた請求があります」と「10 月分（¥16,500）の期限（10/31）を過ぎています。…」・行の札は「期限を過ぎた」", async ({
  page,
}) => {
  await mockBilling(page, { billing: billingOverdue() });
  await openBills(page);
  const c = page.locator(".k-callout");
  await expect(c).toContainText("期限を過ぎた請求があります");
  await expect(c).toContainText("10 月分（¥16,500）の期限（10/31）を過ぎています。振込のご確認をお願いします。");
  await expect(page.locator(`${TABLE} tbody tr`).nth(0)).toContainText("期限を過ぎた");
});

test("K960-UI-004 無料のプラン：「まだ請求書がありません」・表も組も無い・支払い条件は「無料のプラン ・ 請求書は出ません」", async ({
  page,
}) => {
  await mockBilling(page, { billing: billingFree() });
  await openBills(page);
  await expect(page.getByText("まだ請求書がありません", { exact: true })).toBeVisible();
  await expect(page.locator(TABLE)).toHaveCount(0);
  await expect(page.locator(".k-page-sub")).toHaveText("無料のプラン ・ 請求書は出ません");
});

test("K960-UI-005 PDF を押すと downloadInvoicePdf を 1 回（その請求書の id）呼び、答えの署名 URL を新しい窓で開く。画面の道は変わらない", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  // 署名 URL の先（置き場）は試験の外。新しい窓がそこへ移ったことだけを見るため、網の手前で空の PDF を返す
  await page.context().route(PDF_URL, (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "pdf" }));
  await openBills(page);
  const pop = page.waitForEvent("popup");
  await page.getByRole("link", { name: "10 月分の請求書（PDF）", exact: true }).click();
  const w = await pop;
  await w.waitForURL(PDF_URL, { waitUntil: "commit" }); // 窓は空で開いてから署名 URL へ移る（置き場の中身は見ない）
  expect(w.url()).toBe(PDF_URL);
  expect(mk.count("pdf")).toBe(1);
  expect(mk.last("pdf")!.id).toBe(INV_OCT);
  expect(new URL(page.url()).pathname).toBe(HOME);
});

test("K960-UI-006 PDF が開けない（503）：alert「請求書を開けませんでした。もう一度お試しください。」・新しい窓は開かない・表はそのまま", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  mk.script("pdf", err(503, "E-PAGE-003"));
  await openBills(page);
  let popups = 0;
  page.on("popup", () => (popups += 1));
  await page.getByRole("link", { name: "10 月分の請求書（PDF）", exact: true }).click();
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveText(
    "請求書を開けませんでした。もう一度お試しください。",
  );
  expect(popups).toBe(0);
  await expect(page.locator(`${TABLE} tbody tr`)).toHaveCount(3);
});

test("K960-UI-007 見られない（getBilling が 403）：見られない（data-code=E-PAGE-002）を出し、見出し・表・請求先を出さない・PDF の口を呼ばない", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  mk.script("billing", err(403, "FORBIDDEN"));
  await openAt(page);
  await expect(page.locator('[data-code="E-PAGE-002"]')).toBeVisible();
  await expect(page.locator(TABLE)).toHaveCount(0);
  await expect(page.locator(".k-ub-terms")).toHaveCount(0);
  expect(mk.count("pdf")).toBe(0);
});

test("K960-UI-008 読めない（網の切れ）：読めなかった旨（data-code=E-PAGE-007）・「もう一度」で読み直して表が出る（getBilling 2 回）", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  mk.script("billing", "network");
  await openAt(page);
  await expect(page.locator('[data-code="E-PAGE-007"]')).toBeVisible();
  await expect(page.locator(TABLE)).toHaveCount(0);
  await page.getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(page.locator(`${TABLE} tbody tr`)).toHaveCount(3);
  expect(mk.count("billing")).toBe(2);
});

// ---------------------------------------------------------------- 請求先を変える
test("K960-UI-009 「変える」で小窓「請求先を変える」が今の 3 欄を入れて開く。「やめる」で閉じ、口は呼ばない", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await openBills(page);
  await page.getByRole("button", { name: "変える", exact: true }).click();
  const d = contactDlg(page);
  await expect(d.getByLabel(/^会社名\*?$/)).toHaveValue("株式会社ENGINE BASE");
  await expect(d.getByLabel(/^宛名\*?$/)).toHaveValue("経理 ご担当");
  await expect(d.getByLabel(/^メール\*?$/)).toHaveValue("keiri@engine-base.example");
  await d.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(mk.count("contact")).toBe(0);
});

test("K960-UI-010 保存する：前後の空白を落とした 3 欄で updateBillingContact を 1 回・小窓が閉じ・getBilling を読み直して請求先が新しい値になる", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await openBills(page);
  await page.getByRole("button", { name: "変える", exact: true }).click();
  const d = contactDlg(page);
  await d.getByLabel(/^宛名\*?$/).fill("  経理部 山田 様 ");
  await d.getByLabel(/^メール\*?$/).fill("yamada@engine-base.example");
  await d.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect(mk.last("contact")!.body).toEqual({
    company: "株式会社ENGINE BASE",
    attn: "経理部 山田 様",
    email: "yamada@engine-base.example",
  });
  await expect(page.locator(".k-ub-terms")).toContainText("経理部 山田 様");
  await expect(page.locator(".k-ub-terms")).toContainText("yamada@engine-base.example");
  expect(mk.count("billing")).toBe(2);
});

test("K960-UI-011 画面での確かめ：会社名を空・メールを「keiri@」にして保存すると、欄の下に「会社名を書いてください」「メールの形が違います」が出て（ブラウザの標準の確かめに止められない）、口は呼ばない", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  await openBills(page);
  await page.getByRole("button", { name: "変える", exact: true }).click();
  const d = contactDlg(page);
  await d.getByLabel(/^会社名\*?$/).fill(" ");
  await d.getByLabel(/^メール\*?$/).fill("keiri@");
  await d.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(d.getByText("会社名を書いてください", { exact: true })).toBeVisible();
  await expect(d.getByText("メールの形が違います", { exact: true })).toBeVisible();
  expect(mk.count("contact")).toBe(0);
});

test("K960-UI-012 口の形の断り（422・欄 email）：小窓は開いたまま、メールの欄の下に口の文「メールの形が違います」・打った値は残る", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  mk.script("contact", invalid("email", "メールの形が違います"));
  await openBills(page);
  await page.getByRole("button", { name: "変える", exact: true }).click();
  const d = contactDlg(page);
  await d.getByLabel(/^メール\*?$/).fill("keiri@engine-base.invalid");
  await d.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(d.getByText("メールの形が違います", { exact: true })).toBeVisible();
  await expect(d.getByLabel(/^メール\*?$/)).toHaveValue("keiri@engine-base.invalid");
  expect(mk.count("contact")).toBe(1);
});

test("K960-UI-013 保存が失敗（503 E-PAGE-003）：小窓の中に alert（保存できなかった旨）・小窓は開いたまま・請求先は前のまま・読み直さない", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  mk.script("contact", err(503, "E-PAGE-003"));
  await openBills(page);
  await page.getByRole("button", { name: "変える", exact: true }).click();
  const d = contactDlg(page);
  await d.getByLabel(/^宛名\*?$/).fill("経理部 山田 様");
  await d.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(d.getByRole("alert")).toBeVisible();
  await expect(d.getByLabel(/^宛名\*?$/)).toHaveValue("経理部 山田 様");
  await expect(page.locator(".k-ub-terms")).toContainText("経理 ご担当");
  expect(mk.count("billing")).toBe(1);
});

test("K960-UI-014 二度押し：答えを止めている間に「保存する」を 2 回押しても updateBillingContact は 1 回", async ({
  page,
}) => {
  const mk = await mockBilling(page);
  const release = mk.hold("contact");
  await openBills(page);
  await page.getByRole("button", { name: "変える", exact: true }).click();
  const save = contactDlg(page).getByRole("button", { name: "保存する", exact: true });
  await save.click();
  await save.click({ force: true });
  release();
  await expect(contactDlg(page)).toHaveCount(0);
  expect(mk.count("contact")).toBe(1);
});

test("K960-UI-015 請求先を変えられない人（can_edit_contact false）：「変える」は押せない形（aria-disabled）で、押しても小窓は開かない", async ({
  page,
}) => {
  await mockBilling(page, { billing: { ...billingTaka(), can_edit_contact: false } });
  await openBills(page);
  const b = page.getByRole("button", { name: "変える", exact: true });
  await expect(b).toHaveAttribute("aria-disabled", "true");
  await b.click({ force: true });
  await expect(contactDlg(page)).toHaveCount(0);
});

test("K960-UI-016 字の守り：請求先の会社名に HTML が入っていても字のまま出て、スクリプトが動かない", async ({
  page,
}) => {
  const evil = '<img src=x onerror="window.__k960=1">株式会社A';
  await mockBilling(page, { billing: { ...billingTaka(), contact: { ...billingTaka().contact, company: evil } } });
  await openBills(page);
  await expect(page.locator(".k-ub-terms")).toContainText(evil);
  await expect(page.locator(".k-ub-terms img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __k960?: number }).__k960)).toBeUndefined();
});

test("K960-UI-017 幅 320・375・768・1024・1440 で横のはみ出しが 0 以下（狭い幅は組・広い幅は表）", async ({ page }) => {
  await mockBilling(page);
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openBills(page, w);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
  await openBills(page, 375);
  await expect(page.locator(CARDS)).toBeVisible();
  await expect(page.locator(TABLE)).toBeHidden();
});
