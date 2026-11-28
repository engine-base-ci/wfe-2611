// K-991「配るもの › プランの画面（/ops/skills/plans）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops2 の oq-plans・oq-plan-edit・oq-plan-review・oq-plan-self・oq-plan-log（この葉が持ち主）。
//   部品は features/F12/ops2/views-plans.tsx（K-942 が運ぶ）。口は網の手前で差し替える（ops-mock.ts の後ろに ops-plans-mock.ts）。
//   今は ops-plans-mock.ts の NOW に止める（page.clock）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-991.md の表と 1 対 1
import { expect, test, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps } from "./ops-mock";
import { count, ME, mockPlans, NOW, PLANS_A, PROPOSAL_ID, proposalOf, SANO, type PlansMock } from "./ops-plans-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
// 必須の欄の見出しは「会社名*」の形（印 * は読み上げない）。getByLabel の exact は印を含む字で比べて当たらないので、印のある・無いの両方に当てる

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
const PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", BOX),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("subnav", ".k-oq-subnav", BOX),
  pair("chips", ".k-op-chips", BOX),
  pair("plans", ".k-oq-plans", BOX),
  pair("card", ".k-op-card", [...BOX, "texts"]),
  pair("band", ".k-band", [...BOX, "texts"]),
  pair("table", ".k-f12-rt", BOX),
  pair("bar", ".k-oq-bar", BOX),
  pair("feed", ".k-op-feed", [...BOX, "texts"]),
];
const PATH = "/ops/skills/plans";
const ONE = `${PATH}/proposals/${PROPOSAL_ID}`;

async function open(page: Page, baseURL: string | undefined, path = PATH, who = ME, width = 1440): Promise<PlansMock> {
  await page.clock.setFixedTime(NOW);
  const ops = await mockOps(page);
  ops.on.shell = () => ({
    status: 200,
    body: {
      data: shellOf({ operator: { member_id: who.member_id, caps: ["plan_propose", "plan_decide", "distribute"] } }),
    },
  });
  const m = await mockPlans(page);
  if (who === SANO) m.on.proposals = () => ({ status: 200, body: { data: [proposalOf({ can_decide: false })] } });
  await signInOps(page, local(baseURL), path, width);
  return m;
}
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const dialog = (page: Page, title: string) =>
  page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

test.describe("K-991 プランの見た目", () => {
  const STATES: [string, string, string, typeof ME][] = [
    ["K991-UI-001", "oq-plans", PATH, ME],
    ["K991-UI-002", "oq-plan-edit", ONE, SANO],
    ["K991-UI-003", "oq-plan-review", ONE, ME],
    ["K991-UI-004", "oq-plan-self", ONE, SANO],
    ["K991-UI-005", "oq-plan-log", `${PATH}/history`, ME],
  ];
  STATES.forEach(([row, id, path, who]) => {
    for (const w of MATCH_WIDTHS)
      test(`${row} ${id} とモックが同じ（幅 ${w}）`, async ({ browser, baseURL }) => {
        const { bad } = await matchMock(
          browser,
          id,
          w,
          async (page) => {
            const m = await open(page, baseURL, path, who, w);
            if (id === "oq-plan-edit")
              m.on.proposals = () => ({
                status: 200,
                body: { data: [proposalOf({ state: "draft", can_edit: true, can_decide: false })] },
              });
            if (id === "oq-plan-edit") await page.reload();
            await expect(page.locator(".k-page-head h1")).toBeVisible();
          },
          { base: "/dev/mock/f12-ops2", pairs: PAIRS },
        );
        expect(bad, bad.join("\n")).toEqual([]);
      });
  });
});

test.describe("K-991 一覧と作る", () => {
  test("K991-UI-006 開く：3 つの箱・チームに「案 ・ v2 ¥18,000 ・ 決める人を待っている」・listOpsPlans 1 回", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    for (const p of PLANS_A) await expect(page.locator(".k-op-card").filter({ hasText: p.name }).first()).toBeVisible();
    await expect(page.getByText("案 ・ v2 ¥18,000 ・ 決める人を待っている", { exact: true })).toBeVisible();
    expect(count(m, "GET /api/v1/ops/plans")).toBe(1);
  });

  test("K991-UI-007 新しい案を下書きに：作る頁 → 下書きにする → POST の体（無料期間を変えたら trial_days）→ 案の頁・影響の口 1 回", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.proposals = () => ({
      status: 200,
      body: { data: [proposalOf({ state: "draft", can_edit: true, can_decide: false })] },
    });
    await page
      .locator(".k-op-card")
      .filter({ hasText: "チーム" })
      .getByRole("button", { name: "変える案を作る", exact: true })
      .click();
    await expect(page).toHaveURL(/\/ops\/skills\/plans\/new\?plan=team$/);
    await page.getByLabel(/^値段（月・税別）\*?$/).fill("18000");
    await page.getByLabel(/^人数\*?$/).fill("12");
    await expect(page.getByLabel(/^無料期間（日）\*?$/)).toHaveValue("0");
    await page.getByLabel(/^無料期間（日）\*?$/).fill("14");
    await page.getByLabel(/^理由\*?$/).fill("人数の上限に当たる会社が多いため");
    await btn(page, "下書きにする").click();
    await expect(page).toHaveURL(new RegExp(`/ops/skills/plans/proposals/${PROPOSAL_ID}$`));
    expect(m.bodies.create).toEqual([
      {
        plan_key: "team",
        price_monthly: 18000,
        member_limit: 12,
        existing_policy: "after_days",
        notice_days: 90,
        new_from: null,
        trial_days: 14,
        reason: "人数の上限に当たる会社が多いため",
      },
    ]);
    await expect.poll(() => count(m, `GET /api/v1/ops/plan_proposals/${PROPOSAL_ID}/impact`)).toBe(1);
  });

  test("K991-UI-008 決める人に回す：作った本人（佐野）で submit が 1 回 → 自分の案の形（見出し「自分が作った案 ・ 佐野 ・ 11/04 16:40 に回した」・帯）", async ({
    page,
    baseURL,
  }) => {
    // 下書きを直せる・回せるのは作った本人だけ（K-987 の can_edit・K-988 の回す口は他人に 403）。回した後、本人が見ると can_decide は偽（K987-API-004）
    const m = await open(page, baseURL, ONE, SANO);
    let submitted = false;
    m.on.proposals = () => ({
      status: 200,
      body: {
        data: [
          submitted
            ? proposalOf({ can_decide: false })
            : proposalOf({ state: "draft", can_edit: true, can_decide: false }),
        ],
      },
    });
    const base = m.on.submit;
    m.on.submit = (req) => ((submitted = true), base(req));
    await page.reload();
    await btn(page, "決める人に回す").click();
    await expect(page.locator(".k-page-head")).toContainText("自分が作った案 ・ 佐野 ・ 11/04 16:40 に回した");
    await expect(page.getByText("自分の案は自分で決められません", { exact: true })).toBeVisible();
    expect(count(m, `POST /api/v1/ops/plan_proposals/${PROPOSAL_ID}/submit`)).toBe(1);
  });

  test("K991-UI-009 開いた案が在る：作るが 409 E-OPS-019 で目録の字の alert・作る形のまま", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `${PATH}/new?plan=team`);
    m.on.create = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-019" } });
    await page.getByLabel(/^理由\*?$/).fill("理由");
    await btn(page, "下書きにする").click();
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("このプランにはもう変える案があります");
    await expect(page).toHaveURL(/\/new\?plan=team$/);
  });

  test("K991-UI-010 30 日より短い：日数 29 で口の 422（field notice_days）なら欄の下に「30 日より短くはできません」", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `${PATH}/new?plan=team`);
    m.on.create = () => ({
      status: 422,
      body: { error: "validation", code: "VALIDATION_ERROR", field: "notice_days" },
    });
    await page.getByLabel(/^日数\*?$/).fill("29");
    await page.getByLabel(/^理由\*?$/).fill("理由");
    await btn(page, "下書きにする").click();
    await expect(page.getByText("30 日より短くはできません", { exact: true })).toBeVisible();
  });
});

test.describe("K-991 決める・差し戻す・自分の案", () => {
  test("K991-UI-011 決める：403 STEP_UP_REQUIRED → 取り直し → 同じ体で 2 回目 → 一覧へ戻り「決めました」", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, ONE);
    let n = 0;
    const base = m.on.decide;
    m.on.decide = (req) =>
      ++n === 1 ? { status: 403, body: { error: "forbidden", code: "STEP_UP_REQUIRED" } } : base(req);
    const notice = await page.getByLabel(/^お知らせの文（決めたら出る）\*?$/).inputValue();
    await btn(page, "決める").click();
    await dialog(page, "本人か確かめます").getByRole("button", { name: "パスキーで確かめる", exact: true }).click();
    await expect(page).toHaveURL(/\/ops\/skills\/plans$/);
    await expect(page.getByRole("status")).toContainText("決めました");
    expect(m.bodies.decide).toEqual([{ notice_body: notice }, { notice_body: notice }]);
    expect([count(m, "GET /api/v1/me/security"), count(m, "POST /api/v1/auth/step-up")]).toEqual([1, 1]);
  });

  test("K991-UI-012 差し戻す：小窓に理由 → return の体は reason → 一覧へ戻り「差し戻しました」", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, ONE);
    await btn(page, "差し戻す（理由を書く）").click();
    const d = page.getByRole("dialog");
    await d.getByLabel(/^理由\*?$/).fill("上げ幅が大きい");
    await d.getByRole("button", { name: "差し戻す", exact: true }).click();
    await expect(page).toHaveURL(/\/ops\/skills\/plans$/);
    await expect(page.getByRole("status")).toContainText("差し戻しました");
    expect(m.bodies.ret).toEqual([{ reason: "上げ幅が大きい" }]);
  });

  test("K991-UI-013 自分の案：帯・決める／差し戻すは押せない形・押しても口が呼ばれない", async ({ page, baseURL }) => {
    const m = await open(page, baseURL, ONE, SANO);
    await expect(page.getByText("自分の案は自分で決められません", { exact: true })).toBeVisible();
    for (const name of ["決める", "差し戻す（理由を書く）"]) {
      const b = btn(page, name);
      await expect(b).toHaveAttribute("aria-disabled", "true");
      await b.click({ force: true });
    }
    expect(count(m, "POST /api/v1/ops/plan_proposals")).toBe(0);
  });

  test("K991-UI-014 口が自分の案を断る：決めるが 409 E-OPS-022 なら同じ帯・頁はそのまま", async ({ page, baseURL }) => {
    const m = await open(page, baseURL, ONE);
    m.on.decide = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-022" } });
    await btn(page, "決める").click();
    await expect(page.getByText("自分の案は自分で決められません", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${ONE}$`));
  });
});

test.describe("K-991 記録・読めない・幅", () => {
  test("K991-UI-015 記録の札：「チーム」で ?plan=team・口に plan_key=team・戻るで ?plan なし", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `${PATH}/history`);
    await page.locator('[role="group"][aria-label="プラン"]').getByText("チーム", { exact: true }).click();
    await expect(page).toHaveURL(/\/ops\/skills\/plans\/history\?plan=team$/);
    expect(m.queries.map((q) => q.get("plan_key")).filter(Boolean)).toEqual(["team"]);
    await page.goBack();
    await expect(page).toHaveURL(/\/ops\/skills\/plans\/history$/);
  });

  test("K991-UI-016 読めない：listOpsPlans が 503 で「もう一度」・押すと 3 つの箱（口 2 回）", async ({
    page,
    baseURL,
  }) => {
    await page.clock.setFixedTime(NOW);
    const ops = await mockOps(page);
    ops.on.shell = () => ({
      status: 200,
      body: { data: shellOf({ operator: { member_id: ME.member_id, caps: ["plan_decide"] } }) },
    });
    const m = await mockPlans(page);
    let n = 0;
    m.on.plans = () =>
      ++n === 1
        ? { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } }
        : { status: 200, body: { data: PLANS_A } };
    await signInOps(page, local(baseURL), PATH, 1440);
    await btn(page, "もう一度").click();
    await expect(page.locator(".k-op-card").filter({ hasText: "ビジネス" }).first()).toBeVisible();
    expect(n).toBe(2);
  });

  test("K991-UI-017 値段の印なし：口が 403 で「この権限では見えない」・箱が無い", async ({ page, baseURL }) => {
    const ops = await mockOps(page);
    ops.on.shell = () => ({
      status: 200,
      body: { data: shellOf({ operator: { member_id: "op", caps: ["inquiry"] } }) },
    });
    const m = await mockPlans(page);
    m.on.plans = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
    await signInOps(page, local(baseURL), PATH, 1440);
    await expect(page.getByText("この権限では見えない", { exact: false }).first()).toBeVisible();
    await expect(page.locator(".k-oq-plans")).toHaveCount(0);
  });

  test("K991-UI-018 幅：一覧と案の頁が 320・375・768・1024・1440 で横のはみ出し 0 以下", async ({ page, baseURL }) => {
    await open(page, baseURL);
    for (const path of [PATH, ONE]) {
      await page.goto(`${local(baseURL)}${path}`);
      await expect(page.locator(".k-page-head h1")).toBeVisible();
      for (const w of [320, 375, 768, 1024, 1440]) {
        await page.setViewportSize({ width: w, height: 900 });
        expect(await overflowX(page), `${path} ${w}`).toBeLessThanOrEqual(0);
      }
    }
  });

  test("K991-UI-019 字の守り：HTML の入った理由は字のまま・スクリプトが動かない・取引先・業務の型・書き出し・CSV が無い", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, ONE);
    const evil = "<img src=x onerror=window.__k991=1>理由";
    m.on.proposals = () => ({ status: 200, body: { data: [proposalOf({ reason: evil })] } });
    await page.reload();
    await expect(page.getByText(evil, { exact: false }).first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __k991?: number }).__k991)).toBeUndefined();
    expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
  });
  test("K991-UI-020 一覧に無い案：案の一覧（100 件まで）に id が無いと「見つかりませんでした」（E-PAGE-001）・変わることの区画は出さない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, ONE);
    m.on.proposals = () => ({ status: 200, body: { data: [] } });
    await page.reload();
    await expect(page.getByText("見つかりませんでした", { exact: false }).first()).toBeVisible();
    await expect(page.locator(".k-op-card")).toHaveCount(0);
  });
});
