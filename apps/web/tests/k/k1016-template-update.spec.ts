// K-1016「会社の側の『ひな形がこう変わります』の頁（/settings/template-updates）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops2 の oq-template-update（この葉が持ち主）。部品は features/F12/ops2/views-skills.tsx の TemplateUpdatePage（K-942）。
//   ログイン・外枠・役は本物（signupViaApi・loginAs）。ひな形の口だけを網の手前で差し替える（ops-templates-mock.ts・K-994）。
//   本人の Bridge（127.0.0.1:38617）は届かせない。固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない。行 ID は 11_tickets/K-1016.md と 1 対 1
import { expect, test, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { overflowX } from "./f12-mock-kit";
import { count, mockTemplates, UPDATES_A, type TplMock } from "./ops-templates-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
const PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", [...BOX, "texts"]),
  pair("band", ".k-band", [...BOX, "texts"]),
  pair("table", ".k-f12-rt", BOX),
  pair("card", ".k-f12-rt-card", [...BOX, "texts"]),
  pair("fieldset", ".k-op-fieldset", [...BOX, "texts"]),
  pair("note", ".k-op-note", [...BOX, "texts"]),
];
const PATH = "/settings/template-updates";
let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

async function open(page: Page, width = 1440, setup?: (m: TplMock) => void): Promise<TplMock> {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  const m = await mockTemplates(page);
  setup?.(m);
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await loginAs(page, owner.token);
  await page.goto(PATH);
  return m;
}
const btn = (page: Page, name: string) => page.locator(".k-page-head").getByRole("button", { name, exact: true });

test.describe("K-1016 見た目", () => {
  for (const w of MATCH_WIDTHS)
    test(`K1016-UI-001 oq-template-update とモックが同じ（幅 ${w}）`, async ({ browser }) => {
      const { bad } = await matchMock(
        browser,
        "oq-template-update",
        w,
        async (page) => {
          await open(page, w);
          await expect(
            page.getByRole("heading", { name: "ひな形がこう変わります", level: 1, exact: true }),
          ).toBeVisible();
        },
        { base: "/dev/mock/f12-ops2", pairs: PAIRS },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
});

test.describe("K-1016 中身と選ぶ", () => {
  test("K1016-UI-002 開く：見出し・副題・差 3 行・一覧の口 1 回", async ({ page }) => {
    const m = await open(page);
    await expect(page.getByRole("heading", { name: "ひな形がこう変わります", level: 1, exact: true })).toBeVisible();
    await expect(page.locator(".k-page-head")).toContainText(
      "種別 v3 → v4 ・ 手を付けていない所だけ ・ 出した日 10/20 ・ Kaname 運営より",
    );
    for (const d of UPDATES_A[0]!.diffs)
      await expect(page.getByText(d.detail_label, { exact: true }).first()).toBeVisible();
    expect(count(m, "GET /api/v1/ticket_kinds/template-updates")).toBe(1);
  });

  test("K1016-UI-003 変える：体は { choice: change }・「新しい既定に変えました」・読み直して空の形", async ({
    page,
  }) => {
    const m = await open(page);
    m.on.updates = () => ({ status: 200, body: { data: count(m, "POST") > 0 ? [] : UPDATES_A } });
    await btn(page, "変える").click();
    await expect(page.getByRole("status")).toContainText("新しい既定に変えました");
    await expect(page.getByText("届いている新しい版はありません", { exact: true })).toBeVisible();
    expect(m.bodies.apply).toEqual([{ choice: "change" }]);
  });

  test("K1016-UI-004 そのままにする：体は { choice: keep }・「今のまま使います」", async ({ page }) => {
    const m = await open(page);
    await btn(page, "そのままにする").click();
    await expect(page.getByRole("status")).toContainText("今のまま使います");
    expect(m.bodies.apply).toEqual([{ choice: "keep" }]);
  });

  test("K1016-UI-005 2 つ届いた：種別を出し、選ぶと項目の版（項目 v1 → v2）を出す", async ({ page }) => {
    const field = {
      ...UPDATES_A[0]!,
      id: UPDATES_A[0]!.id.replace(/.$/, "2"),
      part: "field",
      part_name: "項目",
      from_version: 1,
      to_version: 2,
    };
    const m = await open(page, 1440, (x) => {
      x.on.updates = () => ({ status: 200, body: { data: count(x, "POST") > 0 ? [field] : [field, UPDATES_A[0]!] } });
    });
    await expect(page.locator(".k-page-head")).toContainText("種別 v3 → v4");
    await btn(page, "変える").click();
    await expect(page.locator(".k-page-head")).toContainText("項目 v1 → v2");
    expect(count(m, "POST /api/v1/ticket_kinds/template-updates/")).toBe(1);
  });

  test("K1016-UI-006 もう選んだ：409 E-OPS-025 で alert「もう選びました」・読み直して空の形", async ({ page }) => {
    const m = await open(page);
    m.on.apply = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-025" } });
    m.on.updates = () => ({ status: 200, body: { data: count(m, "POST") > 0 ? [] : UPDATES_A } });
    await btn(page, "変える").click();
    await expect(page.getByRole("alert")).toContainText("もう選びました");
    await expect(page.getByText("届いている新しい版はありません", { exact: true })).toBeVisible();
  });

  test("K1016-UI-007 届いていない：「届いている新しい版はありません」・選ぶボタンが無い", async ({ page }) => {
    await open(page, 1440, (x) => {
      x.on.updates = () => ({ status: 200, body: { data: [] } });
    });
    await expect(page.getByText("届いている新しい版はありません", { exact: true })).toBeVisible();
    await expect(btn(page, "変える")).toHaveCount(0);
  });
});

test.describe("K-1016 読めない・見えない・字", () => {
  test("K1016-UI-008 読めない：503 で「もう一度」・押すと差 3 行（口 2 回）", async ({ page }) => {
    let n = 0;
    await open(page, 1440, (x) => {
      x.on.updates = () =>
        ++n === 1
          ? { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } }
          : { status: 200, body: { data: UPDATES_A } };
    });
    await page.getByRole("button", { name: "もう一度", exact: true }).click();
    await expect(page.getByText(UPDATES_A[0]!.diffs[0]!.detail_label, { exact: true }).first()).toBeVisible();
    expect(n).toBe(2);
  });

  test("K1016-UI-009 管理者でない：403 で「この権限では見えない」・表とボタンが無い", async ({ page }) => {
    await open(page, 1440, (x) => {
      x.on.updates = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
    });
    await expect(page.locator('[data-code="E-PAGE-002"]')).toBeVisible();
    await expect(page.locator(".k-f12-rt")).toHaveCount(0);
    await expect(btn(page, "変える")).toHaveCount(0);
  });

  test("K1016-UI-010 字の守りと幅：HTML の入った差の字は字のまま・スクリプトが動かない・はみ出し 0 以下・業務の型の字が無い", async ({
    page,
  }) => {
    const evil = "<img src=x onerror=window.__k1016=1>欄";
    await open(page, 1440, (x) => {
      x.on.updates = () => ({
        status: 200,
        body: { data: [{ ...UPDATES_A[0]!, diffs: [{ ...UPDATES_A[0]!.diffs[0]!, detail_label: evil }] }] },
      });
    });
    await expect(page.getByText(evil, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __k1016?: number }).__k1016)).toBeUndefined();
    for (const w of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(await overflowX(page), String(w)).toBeLessThanOrEqual(0);
    }
    expect(await page.locator("main").innerText()).not.toContain("業務の型");
  });
});
