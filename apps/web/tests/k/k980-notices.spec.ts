// K-980「運営のお知らせの画面（/ops/notices の一覧・/ops/notices/[id] の 1 件と障害の続報）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops2 の oq-notices・oq-notice（この葉が持ち主）。部品は features/F12/ops2/views-notices.tsx（K-942 が運ぶ）。
//   口は網の手前で差し替える（ops-mock.ts の後ろに ops-notices-mock.ts）。種類・下書きの絞り込みは URL に持つ（kind・state）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-980.md の表と 1 対 1
import { expect, test, type Locator, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps } from "./ops-mock";
import { incidentOf, mockNotices, NOTICES_A, type NoticesMock } from "./ops-notices-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
// ▾ は部品 components/k の Select（Base UI）。素の <select> は無いので、▾ を押して開いた portal の role=option を押す・数える
async function choose(page: Page, sel: Locator, label: string): Promise<void> {
  await sel.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
/** お知らせの本文の役（外枠は比べない＝K-946 の受け持ち） */
const PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", BOX),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("chips", ".k-op-chips", BOX),
  pair("chip", ".k-op-chip", ["width", "height", "color", "background-color", "texts"]),
  pair("table", ".k-table-wrap", BOX),
  pair("row", ".k-table-wrap tbody tr", [...BOX, "texts"]),
  pair("steps", ".k-oq-steps", [...BOX, "texts"]),
  pair("card", ".k-op-body .k-card", BOX),
  pair("feed", ".k-op-body .k-card ol, .k-op-body .k-card ul", [...BOX, "texts"]),
];
const ID = NOTICES_A[0]!.id;

async function open(
  page: Page,
  baseURL: string | undefined,
  path = "/ops/notices",
  width = 1440,
  caps: string[] = ["notice"],
): Promise<NoticesMock> {
  const ops = await mockOps(page);
  ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: "m-k980", caps } }) } });
  const m = await mockNotices(page);
  await signInOps(page, local(baseURL), path, width);
  return m;
}
const chip = (page: Page, name: string) => page.locator(".k-op-chip").filter({ hasText: new RegExp(`^${name}\\d*$`) });
const lists = (m: NoticesMock) => m.calls.filter((c) => c.startsWith("GET /api/v1/ops/notices") && !c.includes(ID));

test.describe("K-980 お知らせの見た目", () => {
  const STATES: [string, string, string][] = [
    ["K980-UI-001", "oq-notices", "/ops/notices"],
    ["K980-UI-002", "oq-notice", `/ops/notices/${ID}`],
  ];
  STATES.forEach(([row, id, path]) => {
    for (const w of MATCH_WIDTHS)
      test(`${row} ${id} とモックが同じ（幅 ${w}・頭・札・表か組・状態・続報）`, async ({ browser, baseURL }) => {
        const { bad } = await matchMock(
          browser,
          id,
          w,
          async (page) => {
            const ops = await mockOps(page);
            ops.on.shell = () => ({
              status: 200,
              body: { data: shellOf({ operator: { member_id: "m-k980", caps: ["notice"] } }) },
            });
            await mockNotices(page);
            await signInOps(page, local(baseURL), path, w);
            await expect(page.locator(".k-page-head h1")).toBeVisible();
          },
          { base: "/dev/mock/f12-ops2", pairs: PAIRS },
        );
        expect(bad, bad.join("\n")).toEqual([]);
      });
  });
});

test.describe("K-980 一覧", () => {
  test("K980-UI-003 開く：一覧の口を問い合わせなしで 1 回・5 行・［お知らせを書く］は押せて /ops/notices/new へ", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await expect(page.locator(".k-page-head h1")).toHaveText("お知らせ");
    await expect(page.locator(".k-table-wrap tbody tr")).toHaveCount(5);
    expect(lists(m)).toEqual(["GET /api/v1/ops/notices"]);
    const write = page.getByRole("link", { name: "お知らせを書く", exact: true });
    await expect(write).not.toHaveAttribute("aria-disabled", "true");
    await write.click();
    await page.waitForURL((u) => u.pathname === "/ops/notices/new");
  });

  test("K980-UI-004 絞り込みは URL：［障害］で ?kind=incident と口に kind=incident・［下書き］で ?state=draft と口に state=draft・戻ると前の札", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await chip(page, "障害").click();
    await page.waitForURL((u) => u.search === "?kind=incident");
    await expect.poll(() => m.listQueries.at(-1)?.toString()).toBe("kind=incident");
    await expect(chip(page, "障害")).toHaveAttribute("aria-pressed", "true");
    await chip(page, "下書き").click();
    await page.waitForURL((u) => u.search === "?state=draft");
    await expect.poll(() => m.listQueries.at(-1)?.toString()).toBe("state=draft");
    await page.goBack();
    await page.waitForURL((u) => u.search === "?kind=incident");
  });

  test("K980-UI-005 1 件を開く：題を押すと /ops/notices/<id>・1 件の口を 1 回", async ({ page, baseURL }) => {
    const m = await open(page, baseURL);
    await page.getByRole("link", { name: "分身の実行が遅れています", exact: true }).click();
    await page.waitForURL((u) => u.pathname === `/ops/notices/${ID}`);
    await expect(page.locator(".k-page-head h1")).toHaveText("分身の実行が遅れています");
    expect(m.calls.filter((c) => c === `GET /api/v1/ops/notices/${ID}`).length).toBe(1);
  });

  test("K980-UI-011 空：お知らせが 0 件なら「まだお知らせはありません」（表は出ない）", async ({ page, baseURL }) => {
    const ops = await mockOps(page);
    ops.on.shell = () => ({
      status: 200,
      body: { data: shellOf({ operator: { member_id: "m-k980", caps: ["notice"] } }) },
    });
    const m = await mockNotices(page);
    m.on.list = () => ({ status: 200, body: { data: [] } });
    await signInOps(page, local(baseURL), "/ops/notices");
    await expect(page.getByText("まだお知らせはありません", { exact: true })).toBeVisible();
    await expect(page.locator(".k-table-wrap tbody tr")).toHaveCount(0);
  });
});

test.describe("K-980 1 件と障害の続報", () => {
  test("K980-UI-006 障害の 1 件：頭の下に「障害 ・ 全部のワークスペース ・ 11/02 09:40〜」・状態の 2 つ目（原因が分かった）が今・これまでは新しい順に 2 つ", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL, `/ops/notices/${ID}`);
    await expect(page.locator(".k-page-head")).toContainText("障害 ・ 全部のワークスペース ・ 11/02 09:40〜");
    await expect(page.locator(".k-oq-steps li[aria-current='step']")).toHaveText("2 原因が分かった");
    const feed = page.getByRole("list", { name: "続報の記録", exact: true }).locator("li");
    await expect(feed).toHaveCount(2);
    await expect(feed.first()).toContainText("11/02 10:20");
    await expect(feed.first()).toContainText("原因が分かった");
  });

  test("K980-UI-007 続報を足す：［様子を見ている］と続報を書いて［足して出す］で POST updates を 1 回（{ state: monitoring, body }）・1 件を読み直し・欄が空", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `/ops/notices/${ID}`);
    m.on.incident = () => ({ status: 201, body: { data: incidentOf({ incident_state: "monitoring" }) } });
    await choose(page, page.getByRole("combobox", { name: "状態", exact: true }), "様子を見ている");
    const box = page.getByLabel("続報", { exact: true });
    await box.fill("  遅れていた実行は順に動いています  ");
    await page.getByRole("button", { name: "足して出す", exact: true }).click();
    await expect(box).toHaveValue("");
    expect(m.bodies.incident).toEqual([{ state: "monitoring", body: "遅れていた実行は順に動いています" }]);
    expect(m.calls.filter((c) => c === `GET /api/v1/ops/notices/${ID}`).length).toBe(2);
  });

  test("K980-UI-008 直ったにする：押すと POST updates を 1 回（{ state: resolved, body: 直りました }）・直った後は［足して出す］［直ったにする］が押せない形で、押しても口を呼ばない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `/ops/notices/${ID}`);
    const fixed = incidentOf({ state: "resolved", incident_state: "resolved" });
    m.on.incident = () => ({ status: 201, body: { data: fixed } });
    await page.getByRole("button", { name: "直ったにする", exact: true }).click();
    expect(m.bodies.incident).toEqual([{ state: "resolved", body: "直りました" }]);
    m.on.one = () => ({ status: 200, body: { data: fixed } });
    await page.reload();
    for (const n of ["足して出す", "直ったにする"]) {
      await expect(page.getByRole("button", { name: n, exact: true })).toHaveAttribute("aria-disabled", "true");
      await page.getByRole("button", { name: n, exact: true }).click({ force: true });
    }
    expect(m.bodies.incident!.length).toBe(1);
  });

  test("K980-UI-009 もう直っている（409 E-OPS-013）：赤い箱に「この障害はもう直ったにしています」・書いた続報は残る", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, `/ops/notices/${ID}`);
    m.on.incident = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-013" } });
    await page.getByLabel("続報", { exact: true }).fill("残る続報");
    await page.getByRole("button", { name: "足して出す", exact: true }).click();
    await expect(page.locator("[role='alert']").first()).toContainText("この障害はもう直ったにしています");
    await expect(page.getByLabel("続報", { exact: true })).toHaveValue("残る続報");
  });

  test("K980-UI-010 リリースの 1 件：状態の段と［状態を足す］と［直ったにする］は出ない・本文が出る・［書き直す］は /ops/notices/<id>/edit へ", async ({
    page,
    baseURL,
  }) => {
    const rel = NOTICES_A[2]!;
    const m = await open(page, baseURL, `/ops/notices/${rel.id}`);
    m.on.one = () => ({
      status: 200,
      body: {
        data: {
          ...rel,
          body: "チケットの中で話せるようになりました",
          maintenance: null,
          impact: null,
          updates: [],
          reach: { workspaces: 48, members: 312 },
        },
      },
    });
    await page.reload();
    await expect(page.locator(".k-oq-steps")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "足して出す", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "直ったにする", exact: true })).toHaveCount(0);
    await expect(page.getByText("チケットの中で話せるようになりました", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "書き直す", exact: true }).click();
    await page.waitForURL((u) => u.pathname === `/ops/notices/${rel.id}/edit`);
  });
});

test.describe("K-980 失敗と守り", () => {
  test("K980-UI-012 読めない：一覧が 503 なら E-PAGE-007 の形と［もう一度］で読み直す。1 件が 404 なら「見つかりませんでした」", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.list = () => ({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });
    await page.reload();
    await expect(page.getByRole("button", { name: "もう一度", exact: true })).toBeVisible();
    m.on.list = () => ({ status: 200, body: { data: NOTICES_A } });
    await page.getByRole("button", { name: "もう一度", exact: true }).click();
    await expect(page.locator(".k-table-wrap tbody tr")).toHaveCount(5);
    m.on.one = () => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
    await page.goto(`${local(baseURL)}/ops/notices/${ID}`);
    await expect(page.getByText("見つかりませんでした", { exact: false })).toBeVisible();
  });

  test("K980-UI-013 お知らせ（notice）を持たない人：本文は「この画面を見る権限がありません」でお知らせの口を呼ばない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, "/ops/notices", 1440, ["money"]);
    await expect(page.getByText("見る権限がありません", { exact: false })).toBeVisible();
    expect(m.calls.length).toBe(0);
  });

  test("K980-UI-014 幅と字：320・375・768・1024・1440 で一覧と 1 件の横のはみ出しが 0 以下。HTML の入った題・続報は字のまま・スクリプトが動かない・取引先・業務の型・書き出・CSV が無い", async ({
    page,
    baseURL,
  }) => {
    const evil = `<img src=x onerror="window.__k980=1">`;
    const m = await open(page, baseURL);
    m.on.list = () => ({ status: 200, body: { data: [{ ...NOTICES_A[0]!, title: evil }, ...NOTICES_A.slice(1)] } });
    m.on.one = () => ({
      status: 200,
      body: {
        data: incidentOf({ title: evil, updates: [{ state: "identified", body: evil, at: "2026-11-02T01:20:00Z" }] }),
      },
    });
    for (const path of ["/ops/notices", `/ops/notices/${ID}`]) {
      await page.goto(`${local(baseURL)}${path}`);
      for (const w of [320, 375, 768, 1024, 1440]) {
        await page.setViewportSize({ width: w, height: 900 });
        expect(await overflowX(page), `${path} ${w}`).toBeLessThanOrEqual(0);
      }
      await expect(page.locator("main")).toContainText(evil);
      expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
    }
    expect(await page.evaluate(() => (window as unknown as { __k980?: number }).__k980)).toBeUndefined();
  });
});
