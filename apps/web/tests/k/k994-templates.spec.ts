// K-994「配るもの › ひな形と操作の画面」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops2 の oq-templates・oq-operations（この葉が持ち主）。部品は features/F12/ops2/views-skills.tsx（K-942）。
//   口は網の手前で差し替える（ops-mock.ts の後ろに ops-templates-mock.ts）。テストはチケットを作る人が書き、実装する人は変えない。行 ID は 11_tickets/K-994.md と 1 対 1
import { expect, test, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps } from "./ops-mock";
import { count, mockTemplates, TEMPLATES_A, type TplMock } from "./ops-templates-mock";
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
  pair("head", ".k-page-head", BOX),
  pair("h1", ".k-page-head h1", ["x", "y", "font-size", "color", "texts"]),
  pair("subnav", ".k-oq-subnav", BOX),
  pair("table", ".k-f12-rt", BOX),
  pair("card", ".k-op-card", [...BOX, "texts"]),
  pair("note", ".k-op-note", [...BOX, "texts"]),
];
const TPL = "/ops/skills/templates";
const OPS = "/ops/skills/operations";

async function open(
  page: Page,
  baseURL: string | undefined,
  path = TPL,
  width = 1440,
  caps = ["distribute"],
): Promise<TplMock> {
  const ops = await mockOps(page);
  ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: "op", caps } }) } });
  const m = await mockTemplates(page);
  await signInOps(page, local(baseURL), path, width);
  return m;
}
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test.describe("K-994 見た目", () => {
  for (const [row, id, path] of [
    ["K994-UI-001", "oq-templates", TPL],
    ["K994-UI-002", "oq-operations", OPS],
  ] as const)
    for (const w of MATCH_WIDTHS)
      test(`${row} ${id} とモックが同じ（幅 ${w}）`, async ({ browser, baseURL }) => {
        const { bad } = await matchMock(
          browser,
          id,
          w,
          async (page) => {
            await open(page, baseURL, path, w);
            await expect(page.locator(".k-page-head h1")).toBeVisible();
          },
          { base: "/dev/mock/f12-ops2", pairs: PAIRS },
        );
        expect(bad, bad.join("\n")).toEqual([]);
      });
});

test.describe("K-994 中身", () => {
  test("K994-UI-003 ひな形を開く：3 行・31 ／ 46・48 ／ 48・—・listOpsTemplates 1 回", async ({ page, baseURL }) => {
    const m = await open(page, baseURL);
    for (const t of ["31 ／ 46", "48 ／ 48", "v3", "v2", "v1"])
      await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    await expect(page.locator(".k-page-head h1")).toHaveText("ひな形");
    expect(count(m, "GET /api/v1/ops/templates")).toBe(1);
  });

  test("K994-UI-004 操作を開く：ブラウザで操作する・v1.4 ・ 読むだけ・検査 通った・listOperations 1 回", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, OPS);
    await expect(page.getByText("ブラウザで操作する", { exact: true })).toBeVisible();
    await expect(page.getByText("v1.4 ・ 読むだけ", { exact: true })).toBeVisible();
    await expect(page.getByText("検査 通った", { exact: true })).toBeVisible();
    expect(count(m, "GET /api/v1/ops/operations")).toBe(1);
  });

  test("K994-UI-005 押せない形：足す・新しい版（3 つ）・上げる・版を見るは aria-disabled・押しても頁も小窓も変わらず書く口が無い（［新しい版］を押せる形にするのは K-1111）", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    const names = ["ひな形を足す", ...TEMPLATES_A.map((r) => `${r.name} の新しい版を作る`)];
    for (const n of names) {
      const b = btn(page, n);
      await expect(b).toHaveAttribute("aria-disabled", "true");
      await b.click({ force: true });
    }
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${TPL}$`));
    await page.goto(`${local(baseURL)}${OPS}`);
    for (const n of ["操作を上げる", "版を見る"]) {
      const b = btn(page, n);
      await expect(b).toHaveAttribute("aria-disabled", "true");
      await b.click({ force: true });
    }
    await expect(page).toHaveURL(new RegExp(`${OPS}$`));
    expect(m.calls.filter((c) => !c.startsWith("GET"))).toEqual([]);
  });

  test("K994-UI-006 中の行き先：操作・ひな形・プランの行き先は本番の道・今の頁に aria-current", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    const nav = page.getByRole("navigation", { name: "配るものの中", exact: true });
    const link = (n: string) => nav.getByRole("link").filter({ hasText: n });
    await expect(link("操作")).toHaveAttribute("href", OPS);
    await expect(link("ひな形")).toHaveAttribute("href", TPL);
    await expect(link("プラン")).toHaveAttribute("href", "/ops/skills/plans");
    await expect(link("ひな形")).toHaveAttribute("aria-current", "page");
  });

  test("K994-UI-007 読めない：503 で「もう一度」・押すと 3 行（口 2 回）", async ({ page, baseURL }) => {
    const ops = await mockOps(page);
    ops.on.shell = () => ({
      status: 200,
      body: { data: shellOf({ operator: { member_id: "op", caps: ["distribute"] } }) },
    });
    const m = await mockTemplates(page);
    let n = 0;
    m.on.templates = () =>
      ++n === 1
        ? { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } }
        : { status: 200, body: { data: TEMPLATES_A } };
    await signInOps(page, local(baseURL), TPL, 1440);
    await btn(page, "もう一度").click();
    await expect(page.getByText("48 ／ 48", { exact: true }).first()).toBeVisible();
    expect(n).toBe(2);
  });

  test("K994-UI-008 配るものなし：口が 403 で「この権限では見えない」・表が無い", async ({ page, baseURL }) => {
    const ops = await mockOps(page);
    ops.on.shell = () => ({
      status: 200,
      body: { data: shellOf({ operator: { member_id: "op", caps: ["inquiry"] } }) },
    });
    const m = await mockTemplates(page);
    m.on.templates = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
    await signInOps(page, local(baseURL), TPL, 1440);
    await expect(page.getByText("この権限では見えない", { exact: false }).first()).toBeVisible();
    await expect(page.locator(".k-f12-rt")).toHaveCount(0);
  });

  test("K994-UI-009 幅：2 つの頁が 320・375・768・1024・1440 で横のはみ出し 0 以下", async ({ page, baseURL }) => {
    await open(page, baseURL);
    for (const path of [TPL, OPS]) {
      await page.goto(`${local(baseURL)}${path}`);
      await expect(page.locator(".k-page-head h1")).toBeVisible();
      for (const w of [320, 375, 768, 1024, 1440]) {
        await page.setViewportSize({ width: w, height: 900 });
        expect(await overflowX(page), `${path} ${w}`).toBeLessThanOrEqual(0);
      }
    }
  });

  test("K994-UI-010 字の守り：HTML の入った名前は字のまま・スクリプトが動かない・取引先・業務の型・書き出し・CSV・スキルが無い", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    const evil = "<img src=x onerror=window.__k994=1>種別";
    m.on.templates = () => ({ status: 200, body: { data: [{ ...TEMPLATES_A[0]!, name: evil }] } });
    await page.reload();
    await expect(page.getByText(evil, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __k994?: number }).__k994)).toBeUndefined();
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toContain("スキル");
  });
});
