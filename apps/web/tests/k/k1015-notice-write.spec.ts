// K-1015「運営のお知らせを書く・書き直す・出す画面（/ops/notices/new・/ops/notices/[id]/edit・出す確かめ）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops2 の oq-notice-new・oq-notice-publish（この葉が持ち主）。部品は features/F12/ops2/views-notices.tsx（K-942 が運ぶ）。
//   口は網の手前で差し替える（ops-mock.ts の後ろに ops-notices-mock.ts・K-980 が運ぶ）。ワークスペースを選ぶ候補は外枠の道具の listOpsWorkspaces（WS_A）。
//   書くは 作る（下書き）→ 出す の 2 回の口（K-1014・K-978）。出した後に変えられないのは 種類・誰に・出す場所・出す日時（K-1014 の 409 E-OPS-009）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-1015.md の表と 1 対 1
import { expect, test, type Locator, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps, WS_A } from "./ops-mock";
import { maintOf, mockNotices, NOTICES_A, type NoticesMock } from "./ops-notices-mock";
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
const PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", BOX),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("grid", ".k-oq-grid2", BOX),
  pair("form", ".k-oq-grid2 > .k-op-form", BOX),
  pair("fieldset", ".k-op-fieldset", [...BOX, "texts"]),
  pair("preview", ".k-oq-preview", [...BOX, "texts"]),
  pair("dialog", "[role='dialog']", [...BOX, "texts"]),
];
const NEW_ID = NOTICES_A[1]!.id;

async function open(
  page: Page,
  baseURL: string | undefined,
  path = "/ops/notices/new",
  width = 1440,
  caps: string[] = ["notice"],
): Promise<NoticesMock> {
  const ops = await mockOps(page);
  ops.on.shell = () => ({ status: 200, body: { data: shellOf({ operator: { member_id: "m-k1015", caps } }) } });
  const m = await mockNotices(page);
  m.on.create = () => ({ status: 201, body: { data: maintOf() } });
  m.on.update = () => ({ status: 200, body: { data: maintOf() } });
  m.on.one = () => ({ status: 200, body: { data: maintOf() } });
  m.on.publish = () => ({ status: 201, body: { data: maintOf({ state: "scheduled" }) } });
  await signInOps(page, local(baseURL), path, width);
  return m;
}
/** 下絵 oq-notice-new の形にする（メンテ・時間・影響・帯と一覧・日を決める） */
async function fillMaint(page: Page): Promise<void> {
  await choose(page, page.getByRole("combobox", { name: "種類", exact: true }), "メンテ");
  await page.getByLabel("題", { exact: true }).fill("11/10（月）2:00〜3:00 メンテナンス");
  await page.getByLabel("本文", { exact: true }).fill(maintOf().body);
  await page.getByLabel("メンテの始まり", { exact: true }).fill("2026-11-10T02:00");
  await page.getByLabel("メンテの終わり", { exact: true }).fill("2026-11-10T03:00");
  await page.getByLabel("影響する部分", { exact: true }).fill("画面・分身の実行・PC とのつながり");
  await page.getByRole("checkbox", { name: "上の帯", exact: false }).check();
  await page.getByRole("radio", { name: "日を決める", exact: false }).check();
  await page.getByLabel("出す日時", { exact: true }).fill("2026-11-03T10:00");
}
const writes = (m: NoticesMock) => m.calls.filter((c) => !c.startsWith("GET"));

test.describe("K-1015 書く画面の見た目", () => {
  const STATES: [string, string, (page: Page) => Promise<void>][] = [
    ["K1015-UI-001", "oq-notice-new", fillMaint],
    [
      "K1015-UI-002",
      "oq-notice-publish",
      async (page) => {
        await fillMaint(page);
        await page.getByRole("button", { name: "11/03 10:00 に出す", exact: true }).click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
      },
    ],
  ];
  STATES.forEach(([row, id, act]) => {
    for (const w of MATCH_WIDTHS)
      test(`${row} ${id} とモックが同じ（幅 ${w}・欄・誰に・出す場所・いつ・見え方・確かめ）`, async ({
        browser,
        baseURL,
      }) => {
        const { bad } = await matchMock(
          browser,
          id,
          w,
          async (page) => {
            await open(page, baseURL, "/ops/notices/new", w);
            await act(page);
          },
          { base: "/dev/mock/f12-ops2", pairs: PAIRS },
        );
        expect(bad, bad.join("\n")).toEqual([]);
      });
  });
  for (const w of MATCH_WIDTHS)
    test(`K1015-UI-015 oq-notice-edit とモックが同じ（幅 ${w}・出したお知らせの書き直し・押せない欄）`, async ({
      browser,
      baseURL,
    }) => {
      const { bad } = await matchMock(
        browser,
        "oq-notice-edit",
        w,
        async (page) => {
          const m = await open(page, baseURL, `/ops/notices/${maintOf().id}/edit`, w);
          m.on.one = () => ({
            status: 200,
            body: { data: maintOf({ state: "published", published_at: "2026-11-03T01:00:00Z" }) },
          });
          await page.reload();
          await expect(page.locator(".k-page-head h1")).toHaveText("お知らせを書き直す");
        },
        { base: "/dev/mock/f12-ops2", pairs: PAIRS },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
});

test.describe("K-1015 書く", () => {
  test("K1015-UI-003 開く：見出し「お知らせを書く」・種類 リリース・誰に 全部・出す場所 お知らせの一覧・いつ すぐ が既定。お知らせの書く口は呼ばない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await expect(page.locator(".k-page-head h1")).toHaveText("お知らせを書く");
    await expect(page.getByRole("combobox", { name: "種類", exact: true })).toContainText("リリース");
    await expect(page.getByRole("radio", { name: "全部のワークスペース", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "お知らせの一覧", exact: false })).toBeChecked();
    await expect(page.getByRole("radio", { name: "すぐ", exact: true })).toBeChecked();
    expect(writes(m)).toEqual([]);
  });

  test("K1015-UI-004 下書きにする：POST notices を 1 回（体はちょうど kind・title・body・audience_mode all・placements [list]・空白を落とした字）・/ops/notices/<id> に移る", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.create = () => ({ status: 201, body: { data: { ...maintOf(), kind: "release", id: NEW_ID } } });
    await page.getByLabel("題", { exact: true }).fill("  チケットにスレッドができました ");
    await page.getByLabel("本文", { exact: true }).fill("チケットの中で話せます");
    await page.getByRole("button", { name: "下書きにする", exact: true }).click();
    await page.waitForURL((u) => u.pathname === `/ops/notices/${NEW_ID}`);
    expect(m.bodies.create).toEqual([
      {
        kind: "release",
        title: "チケットにスレッドができました",
        body: "チケットの中で話せます",
        audience_mode: "all",
        placements: ["list"],
      },
    ]);
  });

  test("K1015-UI-005 メンテ：始まり・終わりは日本時間の +09:00 で送る・影響・帯と一覧・出す日時。見え方に上の帯と一覧の 1 行が出る", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await fillMaint(page);
    await expect(page.locator(".k-oq-preview").first()).toContainText("11/10（月）2:00〜3:00 メンテナンス");
    await expect(page.locator(".k-oq-preview").nth(1)).toContainText("メンテ ・ 11/10（月）2:00〜3:00 メンテナンス");
    await page.getByRole("button", { name: "下書きにする", exact: true }).click();
    expect(m.bodies.create).toEqual([
      {
        kind: "maintenance",
        title: "11/10（月）2:00〜3:00 メンテナンス",
        body: maintOf().body,
        audience_mode: "all",
        placements: ["band", "list"],
        maintenance_from: "2026-11-10T02:00:00+09:00",
        maintenance_to: "2026-11-10T03:00:00+09:00",
        impact: "画面・分身の実行・PC とのつながり",
        publish_at: "2026-11-03T10:00:00+09:00",
      },
    ]);
  });

  test("K1015-UI-006 誰に：［プランで選ぶ］で 無料・チーム・ビジネス の選び肢・チームだけで audience_plans [team]。［ワークスペースを選ぶ］で一覧の候補・2 つ選ぶと audience_workspace_ids にその 2 つ", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await page.getByLabel("題", { exact: true }).fill("プラン向け");
    await page.getByLabel("本文", { exact: true }).fill("本文");
    await page.getByRole("radio", { name: "プランで選ぶ", exact: true }).check();
    await page.getByRole("checkbox", { name: "チーム", exact: true }).check();
    await page.getByRole("button", { name: "下書きにする", exact: true }).click();
    expect((m.bodies.create![0] as Record<string, unknown>)["audience_plans"]).toEqual(["team"]);
    await page.goto(`${local(baseURL)}/ops/notices/new`);
    await page.getByLabel("題", { exact: true }).fill("選ぶ");
    await page.getByLabel("本文", { exact: true }).fill("本文");
    await page.getByRole("radio", { name: "ワークスペースを選ぶ", exact: true }).check();
    for (const w of WS_A.slice(0, 2)) await page.getByRole("checkbox", { name: w.name, exact: true }).check();
    await page.getByRole("button", { name: "下書きにする", exact: true }).click();
    const sent = m.bodies.create![1] as Record<string, unknown>;
    expect([sent["audience_mode"], sent["audience_workspace_ids"]]).toEqual([
      "workspaces",
      WS_A.slice(0, 2).map((w) => w.id),
    ]);
  });

  test("K1015-UI-007 出す：［11/03 10:00 に出す］で POST notices を 1 回 → 確かめに「48 か所・延べ 312 人」とメンテのメールの行 → ［出す］で POST publish を 1 回 → /ops/notices/<id>", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await fillMaint(page);
    await page.getByRole("button", { name: "11/03 10:00 に出す", exact: true }).click();
    const dlg = page.getByRole("alertdialog");
    await expect(dlg).toContainText("48 か所・延べ 312 人");
    await expect(dlg).toContainText("管理者にメールも届く");
    await dlg.getByRole("button", { name: "出す", exact: true }).click();
    await page.waitForURL((u) => u.pathname === `/ops/notices/${maintOf().id}`);
    expect(writes(m)).toEqual([`POST /api/v1/ops/notices`, `POST /api/v1/ops/notices/${maintOf().id}/publish`]);
    expect(m.bodies.publish).toEqual([{}]);
  });

  test("K1015-UI-008 リリースの確かめ：メールの行は出ない・すぐ出すのボタンは［出す］。確かめで［やめる］なら出す口を呼ばない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    m.on.create = () => ({ status: 201, body: { data: { ...maintOf(), kind: "release", maintenance: null } } });
    await page.getByLabel("題", { exact: true }).fill("リリース");
    await page.getByLabel("本文", { exact: true }).fill("本文");
    await page.getByRole("button", { name: "出す", exact: true }).click();
    const dlg = page.getByRole("alertdialog");
    await expect(dlg).toBeVisible();
    await expect(dlg).not.toContainText("メール");
    await dlg.getByRole("button", { name: "やめる", exact: true }).click();
    await expect(dlg).toHaveCount(0);
    expect(m.bodies.publish ?? []).toEqual([]);
  });

  test("K1015-UI-009 断り：作るが 409 E-OPS-014 なら赤い箱に「メンテの終わりは始まりより後にしてください」で字は残る。出すが 409 E-OPS-010 なら確かめの中に「メンテの時間を書いてから出してください」", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await fillMaint(page);
    m.on.create = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-014" } });
    await page.getByRole("button", { name: "下書きにする", exact: true }).click();
    await expect(page.locator("[role='alert']").first()).toContainText("メンテの終わりは始まりより後にしてください");
    await expect(page.getByLabel("題", { exact: true })).toHaveValue("11/10（月）2:00〜3:00 メンテナンス");
    m.on.create = () => ({ status: 201, body: { data: maintOf() } });
    m.on.publish = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-010" } });
    await page.getByRole("button", { name: "11/03 10:00 に出す", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "出す", exact: true }).click();
    await expect(page.getByRole("alertdialog").locator("[role='alert']")).toContainText(
      "メンテの時間を書いてから出してください",
    );
  });

  test("K1015-UI-010 空の題・本文（空白だけ）：［下書きにする］［出す］は押せない形で押しても口を呼ばない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL);
    await page.getByLabel("題", { exact: true }).fill("   ");
    await page.getByLabel("本文", { exact: true }).fill("本文");
    for (const n of ["下書きにする", "出す"]) {
      await expect(page.getByRole("button", { name: n, exact: true })).toHaveAttribute("aria-disabled", "true");
      await page.getByRole("button", { name: n, exact: true }).click({ force: true });
    }
    expect(writes(m)).toEqual([]);
  });
});

test.describe("K-1015 書き直す", () => {
  test("K1015-UI-011 下書きを書き直す：/ops/notices/<id>/edit は 1 件の値が入る・題だけ変えて［書き直す］で PATCH を 1 回（体は { title } だけ）・/ops/notices/<id> に移る", async ({
    page,
    baseURL,
  }) => {
    const id = maintOf().id;
    const m = await open(page, baseURL, `/ops/notices/${id}/edit`);
    await expect(page.getByLabel("題", { exact: true })).toHaveValue("11/10（月）2:00〜3:00 メンテナンス");
    await expect(page.getByLabel("メンテの始まり", { exact: true })).toHaveValue("2026-11-10T02:00");
    await page.getByLabel("題", { exact: true }).fill("11/10（月）2:00〜4:00 メンテナンス");
    await page.getByRole("button", { name: "書き直す", exact: true }).click();
    await page.waitForURL((u) => u.pathname === `/ops/notices/${id}`);
    expect(m.bodies.update).toEqual([{ title: "11/10（月）2:00〜4:00 メンテナンス" }]);
  });

  test("K1015-UI-012 出した後の書き直し：種類・誰に・出す場所・いつ出すかは押せない形・本文だけ変えると PATCH { body }。409 E-OPS-009 は「出したお知らせの 種類・誰に・出す場所・出す日時 は変えられません」", async ({
    page,
    baseURL,
  }) => {
    const id = maintOf().id;
    const m = await open(page, baseURL, `/ops/notices/${id}/edit`);
    m.on.one = () => ({
      status: 200,
      body: { data: maintOf({ state: "published", published_at: "2026-11-03T01:00:00Z" }) },
    });
    await page.reload();
    await expect(page.getByRole("combobox", { name: "種類", exact: true })).toHaveAttribute("aria-disabled", "true");
    for (const n of ["全部のワークスペース", "すぐ"])
      await expect(page.getByRole("radio", { name: n, exact: true })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("checkbox", { name: "上の帯", exact: false })).toHaveAttribute("aria-disabled", "true");
    await page.getByLabel("本文", { exact: true }).fill("時間が 4:00 までに延びました");
    m.on.update = () => ({ status: 409, body: { error: "conflict", code: "E-OPS-009" } });
    await page.getByRole("button", { name: "書き直す", exact: true }).click();
    expect(m.bodies.update).toEqual([{ body: "時間が 4:00 までに延びました" }]);
    await expect(page.locator("[role='alert']").first()).toContainText(
      "出したお知らせの 種類・誰に・出す場所・出す日時 は変えられません",
    );
  });
});

test.describe("K-1015 守り", () => {
  test("K1015-UI-013 お知らせ（notice）を持たない人：書く・書き直すの本文は「この画面を見る権限がありません」でお知らせの口を呼ばない", async ({
    page,
    baseURL,
  }) => {
    const m = await open(page, baseURL, "/ops/notices/new", 1440, ["money"]);
    await expect(page.getByText("見る権限がありません", { exact: false })).toBeVisible();
    await page.goto(`${local(baseURL)}/ops/notices/${maintOf().id}/edit`);
    await expect(page.getByText("見る権限がありません", { exact: false })).toBeVisible();
    expect(m.calls.length).toBe(0);
  });

  test("K1015-UI-014 幅と字：320・375・768・1024・1440 で書く画面と確かめの横のはみ出しが 0 以下。HTML の入った題は見え方で字のまま・スクリプトが動かない・取引先・業務の型・書き出・CSV が無い・作る口が 503 なら赤い箱で字が残る", async ({
    page,
    baseURL,
  }) => {
    const evil = `<img src=x onerror="window.__k1015=1">`;
    const m = await open(page, baseURL);
    await page.getByLabel("題", { exact: true }).fill(evil);
    await page.getByLabel("本文", { exact: true }).fill("本文");
    await page.getByRole("checkbox", { name: "上の帯", exact: false }).check();
    for (const w of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(await overflowX(page), String(w)).toBeLessThanOrEqual(0);
    }
    await expect(page.locator(".k-oq-preview").first()).toContainText(evil);
    expect(await page.evaluate(() => (window as unknown as { __k1015?: number }).__k1015)).toBeUndefined();
    expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
    m.on.create = () => ({ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } });
    await page.getByRole("button", { name: "下書きにする", exact: true }).click();
    await expect(page.locator("[role='alert']").first()).toBeVisible();
    await expect(page.getByLabel("題", { exact: true })).toHaveValue(evil);
  });
});
