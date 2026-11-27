// K-986「運営の人の画面（/ops/team）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops の op-team・op-team-add・op-team-edit・op-team-remove（この葉が持ち主）。
//   部品は features/F12/ops/views-team.tsx（K-941 が運ぶ）。口は網の手前で差し替える（ops-mock.ts の後ろに ops-team-mock.ts）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-986.md の表と 1 対 1
import { expect, test, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps } from "./ops-mock";
import { count, mockTeam, TEAM_A, type TeamMock } from "./ops-team-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
/** 本文の役（外枠は比べない＝K-946 の受け持ち） */
const MODAL = "[role='dialog'], [role='alertdialog']";
const PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", BOX),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("table", ".k-f12-rt", BOX),
  pair("card", ".k-f12-rt-card", [...BOX, "texts"]),
  pair("note", ".k-op-note", [...BOX, "texts"]),
  // 小窓は 2 つの役：足す・変えるは Dialog（role=dialog）・外す確かめは Confirm（role=alertdialog・K-229）
  pair("dialog", MODAL, [...BOX, "texts"]),
  pair("callout", "[role='dialog'] .k-callout, [role='alertdialog'] .k-callout", [...BOX, "texts"]),
];
const SATO = TEAM_A[1]!;
const ME = TEAM_A[0]!;

async function open(page: Page, baseURL: string | undefined, width = 1440): Promise<TeamMock> {
  const ops = await mockOps(page);
  ops.on.shell = () => ({
    status: 200,
    body: { data: shellOf({ operator: { member_id: ME.member_id, caps: [...ME.caps] } }) },
  });
  const m = await mockTeam(page);
  await signInOps(page, local(baseURL), "/ops/team", width);
  return m;
}
/** 題で小窓を 1 つ取る（dialog と alertdialog の両方を見る：外す確かめは Confirm＝alertdialog） */
const dialog = (page: Page, title: string) =>
  page.locator(MODAL).filter({ has: page.getByRole("heading", { name: title, exact: true }) });
/** 開いている小窓（dialog と alertdialog の両方） */
const modals = (page: Page) => page.locator(MODAL).filter({ visible: true });
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const edit = (page: Page, name: string) => btn(page, `${name} さんのできることを変える`);
const remove = (page: Page, name: string) => btn(page, `${name} さんを外す`);

test.describe("K-986 運営の人の見た目", () => {
  const STATES: [string, string, (page: Page) => Promise<void>][] = [
    ["K986-UI-001", "op-team", async () => undefined],
    ["K986-UI-002", "op-team-add", async (page) => void (await btn(page, "運営の人を足す").click())],
    ["K986-UI-003", "op-team-edit", async (page) => void (await edit(page, ME.name).click())],
    ["K986-UI-004", "op-team-remove", async (page) => void (await remove(page, SATO.name).click())],
  ];
  STATES.forEach(([row, id, act]) => {
    for (const w of MATCH_WIDTHS)
      test(`${row} ${id} とモックが同じ（幅 ${w}・表か組・印・小窓）`, async ({ browser, baseURL }) => {
        const { bad } = await matchMock(
          browser,
          id,
          w,
          async (page) => {
            await open(page, baseURL, w);
            await expect(page.locator(".k-page-head h1")).toHaveText("運営の人");
            await act(page);
          },
          { base: "/dev/mock/f12-ops", pairs: PAIRS },
        );
        expect(bad, bad.join("\n")).toEqual([]);
      });
  });
});

test.describe("K-986 一覧と足す", () => {
  test("K986-UI-005 開く：3 行・一覧の口 1 回・行の字は 高本 聖斗／運営の管理者 ・ パスキー・佐野 美穂／サポート ・ パスキー", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await expect(page.getByText("運営の管理者 ・ パスキー", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("サポート ・ パスキー", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(ME.name, { exact: true }).first()).toBeVisible();
    expect(count(m, "GET /api/v1/ops/members")).toBe(1);
  });

  test("K986-UI-006 足す：取り直し → 同じ体でやり直し（email と caps＝inquiry・money）→ 閉じて「… に招待を送りました」・一覧を読み直す", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    let n = 0;
    const base = m.on.add;
    m.on.add = (req) =>
      ++n === 1 ? { status: 403, body: { error: "forbidden", code: "STEP_UP_REQUIRED" } } : base(req);
    await btn(page, "運営の人を足す").click();
    const d = dialog(page, "運営の人を足す");
    await d.getByLabel("メールアドレス", { exact: true }).fill("kato@kaname.example");
    await d.getByLabel("お金", { exact: true }).check();
    await d.getByRole("button", { name: "招待を送る", exact: true }).click();
    await dialog(page, "本人か確かめます").getByRole("button", { name: "パスキーで確かめる", exact: true }).click();
    await expect(d).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("kato@kaname.example に招待を送りました");
    expect(m.bodies.add).toEqual([
      { email: "kato@kaname.example", caps: ["inquiry", "money"] },
      { email: "kato@kaname.example", caps: ["inquiry", "money"] },
    ]);
    expect([count(m, "GET /api/v1/me/security"), count(m, "POST /api/v1/auth/step-up")]).toEqual([1, 1]);
    expect(count(m, "GET /api/v1/ops/members")).toBe(2);
  });

  test("K986-UI-007 もう運営の人：409 E-OPS-015 で小窓の中に目録の字の alert・小窓は開いたまま", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.add = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-015" } });
    await btn(page, "運営の人を足す").click();
    const d = dialog(page, "運営の人を足す");
    await d.getByLabel("メールアドレス", { exact: true }).fill(SATO.email);
    await d.getByRole("button", { name: "招待を送る", exact: true }).click();
    await expect(d.getByRole("alert")).toContainText("この人はもう運営の人です");
    await expect(d).toHaveCount(1);
  });

  test("K986-UI-008 メールが送れない：mail_sent false で「招待のメールを送れませんでした。外してから足し直してください」", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    const base = m.on.add;
    m.on.add = (req) => {
      const r = base(req);
      return r === "abort" ? r : { status: r.status, body: { ...(r.body as object), meta: { mail_sent: false } } };
    };
    await btn(page, "運営の人を足す").click();
    const d = dialog(page, "運営の人を足す");
    await d.getByLabel("メールアドレス", { exact: true }).fill("kato@kaname.example");
    await d.getByRole("button", { name: "招待を送る", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(
      "招待のメールを送れませんでした。外してから足し直してください",
    );
  });

  test("K986-UI-009 空：メールが空・できることを全部外すと「招待を送る」が押せない形・口が呼ばれない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await btn(page, "運営の人を足す").click();
    const d = dialog(page, "運営の人を足す");
    const send = d.getByRole("button", { name: "招待を送る", exact: true });
    await expect(send).toHaveAttribute("aria-disabled", "true");
    await d.getByLabel("メールアドレス", { exact: true }).fill("kato@kaname.example");
    await d.getByLabel("問い合わせ", { exact: true }).uncheck();
    await expect(send).toHaveAttribute("aria-disabled", "true");
    await send.click({ force: true });
    expect(count(m, "POST /api/v1/ops/members")).toBe(0);
  });
});

test.describe("K-986 変える・外す", () => {
  test("K986-UI-010 ほかの人を変える：佐野の「中を見る」を外して「変える」→ PATCH の体は caps・小窓が閉じ一覧を読み直す", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await edit(page, SATO.name).click();
    const d = dialog(page, "できることを変える");
    await d.getByLabel("中を見る", { exact: true }).uncheck();
    await d.getByRole("button", { name: "変える", exact: true }).click();
    await expect(d).toHaveCount(0);
    expect(m.bodies.edit).toEqual([{ caps: SATO.caps.filter((c) => c !== "peek") }]);
    expect(count(m, "POST /api/v1/auth/step-up")).toBe(0);
    expect(count(m, "GET /api/v1/ops/members")).toBe(2);
  });

  test("K986-UI-011 自分：チェックと「変える」が押せない・注意「この人のできることは変えられません」・PATCH が 0 回", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await edit(page, ME.name).click();
    const d = dialog(page, "できることを変える");
    await expect(d.getByText("この人のできることは変えられません", { exact: true })).toBeVisible();
    await expect(d.getByRole("button", { name: "変える", exact: true })).toBeDisabled();
    await expect(d.getByLabel("お金", { exact: true })).toBeDisabled();
    expect(count(m, "PATCH /api/v1/ops/members")).toBe(0);
  });

  test("K986-UI-012 最後の 1 人（口が断る）：409 E-OPS-018・detail.cap plan_decide で注意の箱に「値段を決める」・小窓は開いたまま", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.edit = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-018", detail: { cap: "plan_decide" } } });
    await edit(page, SATO.name).click();
    const d = dialog(page, "できることを変える");
    await d.getByLabel("お金", { exact: true }).uncheck();
    await d.getByRole("button", { name: "変える", exact: true }).click();
    await expect(d.locator(".k-callout")).toContainText("値段を決める");
    await expect(d).toHaveCount(1);
  });

  test("K986-UI-013 外す：確かめの「外す」で DELETE が 1 回・確かめが閉じ・佐野の行が無い", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.list = () =>
      count(m, "DELETE /api/v1/ops/members") > 0
        ? { status: 200, body: { data: TEAM_A.filter((x) => x.member_id !== SATO.member_id) } }
        : { status: 200, body: { data: TEAM_A } };
    await remove(page, SATO.name).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "外す", exact: true }).click();
    await expect(modals(page)).toHaveCount(0);
    await expect(page.getByText(SATO.name, { exact: true })).toHaveCount(0);
    expect(m.calls.filter((c) => c.startsWith("DELETE"))).toEqual([`DELETE /api/v1/ops/members/${SATO.member_id}`]);
  });

  test("K986-UI-014 外せない行：自分と locked_caps のある行の「外す」は押せない形・押しても確かめが開かない", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    const b = remove(page, ME.name);
    await expect(b).toHaveAttribute("aria-disabled", "true");
    await b.click({ force: true });
    await expect(modals(page)).toHaveCount(0);
  });
});

test.describe("K-986 読めない・見えない・幅", () => {
  test("K986-UI-015 読めない：一覧が 503 で E-PAGE-007 の形・「もう一度」で読み直して 3 行（一覧の口 2 回）", async ({
    page,
    baseURL,
  }) => {
    const ops = await mockOps(page);
    ops.on.shell = () => ({
      status: 200,
      body: { data: shellOf({ operator: { member_id: ME.member_id, caps: [...ME.caps] } }) },
    });
    const m = await mockTeam(page);
    let n = 0;
    m.on.list = () =>
      ++n === 1
        ? { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } }
        : { status: 200, body: { data: TEAM_A } };
    await signInOps(page, local(baseURL), "/ops/team", 1440);
    await expect(page.getByText(SATO.name, { exact: true })).toHaveCount(0);
    await btn(page, "もう一度").click();
    await expect(page.getByText(SATO.name, { exact: true }).first()).toBeVisible();
    expect(n).toBe(2);
  });

  test("K986-UI-016 運営の人を持たない：一覧が 403 で「この権限では見えない」・表が無い・足すボタンが無い", async ({
    page,
    baseURL,
  }) => {
    const ops = await mockOps(page);
    ops.on.shell = () => ({
      status: 200,
      body: { data: shellOf({ operator: { member_id: "op", caps: ["inquiry"] } }) },
    });
    const m = await mockTeam(page);
    m.on.list = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
    await signInOps(page, local(baseURL), "/ops/team", 1440);
    await expect(page.getByText("この権限では見えない", { exact: false }).first()).toBeVisible();
    await expect(page.locator(".k-f12-rt")).toHaveCount(0);
    await expect(btn(page, "運営の人を足す")).toHaveCount(0);
  });

  test("K986-UI-017 幅：320・375・768・1024・1440 で横のはみ出しが 0 以下", async ({ page, baseURL }) => {
    await open(page, baseURL);
    for (const w of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(await overflowX(page), String(w)).toBeLessThanOrEqual(0);
    }
  });

  test("K986-UI-018 字の守り：HTML の入った名前は字のまま・スクリプトが動かない・取引先・業務の型・書き出し・CSV が無い", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    const evil = "<img src=x onerror=window.__k986=1>佐野";
    m.on.list = () => ({ status: 200, body: { data: [{ ...SATO, name: evil }] } });
    await page.reload();
    await expect(page.getByText(evil, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __k986?: number }).__k986)).toBeUndefined();
    expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
  });
});
