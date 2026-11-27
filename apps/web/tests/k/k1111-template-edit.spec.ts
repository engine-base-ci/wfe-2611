// K-1111「ひな形の新しい版の中身を直す頁（/ops/skills/templates/[id]/new）」の画面の試験（実 Chrome・実装より先に積む）。
//   正の絵：モック /dev/mock/f12-ops2 の op-template-edit と oq-template-release（この葉が持ち主）。
//   部品は features/F12/ops2/views-skills.tsx（K-942 が運ぶ）。小窓は段 10 の NameColorDialog と DocEditor（K-707）を使う。
//   口は網の手前で差し替える：一覧は ops-templates-mock.ts（K-994）、1 つ（getOpsTemplate）と出す（releaseOpsTemplate）はこの試験の中、
//   本人確認の取り直しは ops-bills-mock.ts（K-984）。下絵と同じ直しは「下書き」（この PC の localStorage）として先に置いて開く。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。行 ID は 11_tickets/K-1111.md の表と 1 対 1
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { FORBIDDEN, overflowX } from "./f12-mock-kit";
import { local, mockOps, shellOf, signInOps } from "./ops-mock";
import { mockBills } from "./ops-bills-mock";
import { mockTemplates, TEMPLATES_A } from "./ops-templates-mock";
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
const PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", BOX),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("sub", ".k-page-head p", ["x", ...TEXT]),
  pair("card", ".k-op-card", [...BOX, "texts"]),
  pair("table", ".k-f12-rt", BOX),
  pair("rcard", ".k-f12-rt-card", [...BOX, "texts"]),
  pair("dialog", "[role='dialog']", [...BOX, "texts"]),
];

const KIND = TEMPLATES_A[0]!; // 種別 v3
const STATE = TEMPLATES_A[1]!; // 状態 v2
const FIELD = TEMPLATES_A[2]!; // 項目 v1
const NEW = (id: string) => `/ops/skills/templates/${id}/new`;
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
/** 下絵の今の版 v3 の種別 5 つ */
const KIND_ITEMS = [
  { key: "task", name: "タスク", color_key: "teal", body_template: doc("やること・期限・確かめること") },
  { key: "qa", name: "QA", color_key: "lavender", body_template: doc("確かめる所") },
  { key: "issue", name: "課題", color_key: "amber", body_template: doc("困っていること") },
  { key: "meeting", name: "会議", color_key: "indigo", body_template: doc("議題") },
  { key: "memo", name: "メモ", color_key: "sage", body_template: doc("書いておくこと") },
];
const STATE_ITEMS = [
  { key: "todo", name: "未着手", color_key: "indigo" },
  { key: "doing", name: "作業中", color_key: "teal" },
];
const FIELD_ITEMS = [
  { key: "due", name: "期限", field_type: "date", required: true, description: "", options: [], kind_keys: [] },
];
const ONE: Record<string, unknown> = {
  [KIND.id]: { ...KIND, items: KIND_ITEMS, versions: [] },
  [STATE.id]: { ...STATE, items: STATE_ITEMS, versions: [] },
  [FIELD.id]: { ...FIELD, items: FIELD_ITEMS, versions: [] },
};
/** 下絵 op-template-edit と同じ直し（QA・課題・会議の本文を直す・メモを消す・見積を足す） */
const MOCK_DRAFT = {
  edits: {
    base: 3,
    changes: {
      qa: { kind: "edit", item: { ...KIND_ITEMS[1], body_template: doc("確かめる所・再現の手順・期待") } },
      issue: { kind: "edit", item: { ...KIND_ITEMS[2], body_template: doc("困っていること・影響・次の手") } },
      meeting: { kind: "edit", item: { ...KIND_ITEMS[3], body_template: doc("議題・決めたこと・議事録のリンク") } },
      memo: { kind: "delete" },
    },
    added: [{ key: "x_estimate", name: "見積", color_key: "plum", body_template: doc("範囲・金額・期限") }],
  },
  saved_at: "2026-11-05T05:20:00Z",
  by: "佐野",
};
const DRAFT_KEY = (id: string) => `kaname.ops.template-draft.${id}`;

type Reply = { status: number; body: unknown } | "abort";
interface EditMock {
  calls: string[];
  releases: Record<string, unknown>[];
  on: { one: (id: string) => Reply; release: (req: Request) => Reply };
}
async function mockEdit(page: Page): Promise<EditMock> {
  const m: EditMock = {
    calls: [],
    releases: [],
    on: {
      one: (id) =>
        ONE[id]
          ? { status: 200, body: { data: ONE[id] } }
          : { status: 404, body: { error: "not_found", code: "E-PAGE-001" } },
      release: (req) => {
        const b = req.postDataJSON() as { dry_run?: boolean };
        return b.dry_run
          ? { status: 201, body: { data: KIND, meta: { offered: 31, using: 48 } } }
          : { status: 201, body: { data: { ...KIND, version: 4 }, meta: { offered: 31, using: 48 } } };
      },
    },
  };
  await page.route(/\/api\/v1\/ops\/templates\/[^/]+(\/versions)?$/, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const id = p.split("/")[5]!;
    m.calls.push(`${req.method()} ${p}`);
    let r: Reply;
    if (req.method() === "POST" && p.endsWith("/versions")) {
      m.releases.push(req.postDataJSON() as Record<string, unknown>);
      r = m.on.release(req);
    } else if (req.method() === "GET") r = m.on.one(id);
    else return route.fallback();
    if (r === "abort") return route.abort("failed");
    await route.fulfill({
      status: r.status,
      headers: { "access-control-allow-origin": "*" },
      contentType: "application/json",
      body: JSON.stringify(r.body),
    });
  });
  return m;
}
async function open(
  page: Page,
  baseURL: string | undefined,
  o: { id?: string; width?: number; caps?: string[]; draft?: unknown; path?: string } = {},
): Promise<{ m: EditMock; stepCalls: string[] }> {
  const id = o.id ?? KIND.id;
  if (o.draft !== undefined)
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [
      DRAFT_KEY(id),
      JSON.stringify(o.draft),
    ] as const);
  const ops = await mockOps(page);
  ops.on.shell = () => ({
    status: 200,
    body: { data: shellOf({ operator: { member_id: "op", caps: o.caps ?? ["distribute"] } }) },
  });
  const bills = await mockBills(page);
  await mockTemplates(page);
  const m = await mockEdit(page);
  await signInOps(page, local(baseURL), o.path ?? NEW(id), o.width ?? 1440);
  return { m, stepCalls: bills.calls };
}
const btn = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const dialog = (page: Page, title: string) =>
  page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const row = (page: Page, name: string) =>
  page.locator(".k-f12-rt tr, .k-f12-rt-card").filter({ hasText: name }).first();
const writes = (m: EditMock) => m.calls.filter((c) => c.startsWith("POST"));
const RELEASE_TITLE = "ひな形「種別」の新しい版（v4）を出す";

test.describe("K-1111 直す頁の見た目", () => {
  for (const w of MATCH_WIDTHS) {
    test(`K1111-UI-001 op-template-edit とモックが同じ（幅 ${w}・見出し・副題・表か組・印・差の箱）`, async ({
      browser,
      baseURL,
    }) => {
      const { bad } = await matchMock(
        browser,
        "op-template-edit",
        w,
        async (page) => {
          await open(page, baseURL, { width: w, draft: MOCK_DRAFT });
          await expect(page.locator(".k-page-head h1")).toHaveText("ひな形「種別」の新しい版（v4）");
        },
        { base: "/dev/mock/f12-ops2", pairs: PAIRS },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
    test(`K1111-UI-002 oq-template-release とモックが同じ（幅 ${w}・出す確かめ・48 か所・31 か所・17 か所）`, async ({
      browser,
      baseURL,
    }) => {
      const { bad } = await matchMock(
        browser,
        "oq-template-release",
        w,
        async (page) => {
          await open(page, baseURL, { width: w, draft: MOCK_DRAFT });
          await btn(page, "v4 を出す").click();
          await expect(dialog(page, RELEASE_TITLE)).toBeVisible();
        },
        { base: "/dev/mock/f12-ops2", pairs: PAIRS },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
});

test.describe("K-1111 直す", () => {
  test("K1111-UI-003 入口：配るもの › ひな形の［種別 の新しい版を作る］で直す頁に移る・見出しと副題・今の版の 5 行が「そのまま」・1 つの口が 1 回", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL, { path: "/ops/skills/templates" });
    await page.getByRole("link", { name: "種別 の新しい版を作る", exact: true }).click();
    await page.waitForURL((u) => u.pathname === NEW(KIND.id));
    await expect(page.locator(".k-page-head h1")).toHaveText("ひな形「種別」の新しい版（v4）");
    await expect(page.locator(".k-page-head p").first()).toHaveText("今の版 v3 を写して直しています");
    for (const i of KIND_ITEMS) await expect(row(page, i.name)).toContainText("そのまま");
    expect(m.calls.filter((c) => c === `GET /api/v1/ops/templates/${KIND.id}`)).toHaveLength(1);
  });

  test("K1111-UI-004 直す（種別）：［QA を直す］の小窓に名前・色・本文のひな形と今の値・名前を変えて保存すると「直した」・差に「直す：種別「品質確認」」・書く口は 0", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    await btn(page, "QA を直す").click();
    const d = page.getByRole("dialog");
    await expect(d.getByLabel("名前", { exact: true })).toHaveValue("QA");
    await expect(d.getByRole("radiogroup", { name: "色", exact: true })).toBeVisible();
    await expect(d.getByText("本文のひな形", { exact: true })).toBeVisible();
    await d.getByLabel("名前", { exact: true }).fill("品質確認");
    await d.getByRole("button", { name: "保存する", exact: true }).click();
    await expect(row(page, "品質確認")).toContainText("直した");
    await expect(page.locator(".k-op-card").filter({ hasText: "今の版 v3 との差" })).toContainText(
      "直す：種別「品質確認」",
    );
    expect(writes(m)).toEqual([]);
  });

  test("K1111-UI-005 足す：［種別を足す］の小窓で名前「見積」・色 葡萄で保存すると表の最後に「足した」・差に「足す：種別「見積」」", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    await btn(page, "種別を足す").click();
    const d = page.getByRole("dialog");
    await d.getByLabel("名前", { exact: true }).fill("見積");
    await d.getByRole("radio", { name: "葡萄", exact: true }).check();
    await d.getByRole("button", { name: "保存する", exact: true }).click();
    await expect(row(page, "見積")).toContainText("足した");
    await expect(page.locator(".k-op-card").filter({ hasText: "今の版 v3 との差" })).toContainText(
      "足す：種別「見積」",
    );
  });

  test("K1111-UI-006 消す・取り消す：［メモ を消す］で「消す」と［メモ を消すのを取り消す］・差に消すの行。取り消すと「そのまま」に戻り差の行が消える", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL);
    await btn(page, "メモ を消す").click();
    await expect(row(page, "メモ")).toContainText("消す");
    const diff = page.locator(".k-op-card").filter({ hasText: "今の版 v3 との差" });
    await expect(diff).toContainText("消す：種別「メモ」（使っているワークスペースの「メモ」はそのまま残る）");
    await btn(page, "メモ を消すのを取り消す").click();
    await expect(row(page, "メモ")).toContainText("そのまま");
    await expect(diff).not.toContainText("消す：種別「メモ」");
  });

  test("K1111-UI-007 差の箱：直す 3・消す 1・足す 1 で 3 行（下絵の字の形）", async ({ page, baseURL }) => {
    await open(page, baseURL, { draft: MOCK_DRAFT });
    const diff = page.locator(".k-op-card").filter({ hasText: "今の版 v3 との差" });
    await expect(diff.getByRole("listitem")).toHaveText([
      "足す：種別「見積」",
      "直す：種別「QA」「課題」「会議」",
      "消す：種別「メモ」（使っているワークスペースの「メモ」はそのまま残る）",
    ]);
  });

  test("K1111-UI-008 下書き：［下書きにする］で副題に「下書き ・ <名前> ・ <時刻> に保存」・読み直すと同じ直し・書く口は 0。版が v4 になった後は古い下書きを戻さない", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    await btn(page, "メモ を消す").click();
    await btn(page, "下書きにする").click();
    await expect(page.locator(".k-page-head p").first()).toContainText("下書き ・ ");
    await expect(page.locator(".k-page-head p").first()).toContainText("に保存");
    await page.reload();
    await expect(row(page, "メモ")).toContainText("消す");
    expect(writes(m)).toEqual([]);
    m.on.one = (id) => ({ status: 200, body: { data: { ...(ONE[id] as object), version: 4 } } });
    await page.reload();
    await expect(page.locator(".k-page-head h1")).toHaveText("ひな形「種別」の新しい版（v5）");
    await expect(row(page, "メモ")).toContainText("そのまま");
  });
});

test.describe("K-1111 出す", () => {
  test("K1111-UI-009 出す：下書き（dry_run）を 1 回 → 確かめ → 本人確認をして出すで同じ items と理由・dry_run なしを 1 回 → ひな形の一覧に移り「v4 を出しました」・下書きが消える", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL, { draft: MOCK_DRAFT });
    await btn(page, "v4 を出す").click();
    const d = dialog(page, RELEASE_TITLE);
    await expect(d).toContainText(
      "使っているワークスペース 48 か所のうち、既定のまま使っている 31 か所の管理者に鈴で知らせます",
    );
    await expect(d).toContainText("既定から変えたワークスペース 17 か所には知らせない（そのまま残る）");
    await d.getByRole("button", { name: "本人確認をして出す", exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/ops/skills/templates");
    await expect(page.getByRole("status").filter({ hasText: "v4 を出しました" })).toBeVisible();
    expect(m.releases).toHaveLength(2);
    const [dry, real] = m.releases as { items: { key: string }[]; change_reason: string; dry_run?: boolean }[];
    expect(dry!.dry_run).toBe(true);
    expect(real!.dry_run).toBeUndefined();
    expect(real!.items).toEqual(dry!.items);
    expect(real!.items.map((i) => i.key)).toEqual(["task", "qa", "issue", "meeting", "x_estimate"]);
    expect(real!.change_reason).toBe(
      "足す：種別「見積」／直す：種別「QA」「課題」「会議」／消す：種別「メモ」（使っているワークスペースの「メモ」はそのまま残る）",
    );
    expect(await page.evaluate((k) => window.localStorage.getItem(k), DRAFT_KEY(KIND.id))).toBeNull();
  });

  test("K1111-UI-010 本人確認の取り直し：出すが 403 STEP_UP_REQUIRED なら getMySecurity を 1 回・「本人か確かめます」・［パスキーで確かめる］で stepUp を 1 回・出すをもう 1 回（同じ体）", async ({
    page,
    baseURL,
  }) => {
    const { m, stepCalls } = await open(page, baseURL, { draft: MOCK_DRAFT });
    let n = 0;
    m.on.release = (req) =>
      (req.postDataJSON() as { dry_run?: boolean }).dry_run
        ? { status: 201, body: { data: KIND, meta: { offered: 31, using: 48 } } }
        : ++n === 1
          ? { status: 403, body: { error: "forbidden", code: "STEP_UP_REQUIRED" } }
          : { status: 201, body: { data: { ...KIND, version: 4 }, meta: { offered: 31, using: 48 } } };
    await btn(page, "v4 を出す").click();
    await dialog(page, RELEASE_TITLE).getByRole("button", { name: "本人確認をして出す", exact: true }).click();
    await dialog(page, "本人か確かめます").getByRole("button", { name: "パスキーで確かめる", exact: true }).click();
    await page.waitForURL((u) => u.pathname === "/ops/skills/templates");
    const count = (p: string) => stepCalls.filter((c) => c.startsWith(p)).length;
    expect([count("GET /api/v1/me/security"), count("POST /api/v1/auth/step-up"), n]).toEqual([1, 1, 2]);
    expect(m.releases[2]).toEqual(m.releases[1]);
  });

  test("K1111-UI-011 断り：409 E-OPS-023 は確かめの中に「今の版と同じです」・E-OPS-024（key qa）は「ひな形の中身が合いません」と QA の行に印・直した中身は残る", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL, { draft: MOCK_DRAFT });
    const codes = ["E-OPS-023", "E-OPS-024"];
    m.on.release = (req) => {
      if ((req.postDataJSON() as { dry_run?: boolean }).dry_run)
        return { status: 201, body: { data: KIND, meta: { offered: 31, using: 48 } } };
      const code = codes.shift()!;
      return {
        status: 409,
        body: { error: "conflict", code, ...(code === "E-OPS-024" ? { detail: { key: "qa" } } : {}) },
      };
    };
    await btn(page, "v4 を出す").click();
    const d = dialog(page, RELEASE_TITLE);
    await d.getByRole("button", { name: "本人確認をして出す", exact: true }).click();
    await expect(d.getByRole("alert")).toContainText("今の版と同じです");
    await d.getByRole("button", { name: "本人確認をして出す", exact: true }).click();
    await expect(d.getByRole("alert")).toContainText("ひな形の中身が合いません");
    await expect(row(page, "QA")).toHaveAttribute("data-invalid", "true");
    await expect(row(page, "メモ")).toContainText("消す");
  });

  test("K1111-UI-012 落ちた：下書き（dry_run）が 503・網の切れで頁の上に赤い箱・直した中身が残る・もう一度押せる", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL, { draft: MOCK_DRAFT });
    const replies: Reply[] = [{ status: 503, body: { error: "unavailable", code: "E-PAGE-003" } }, "abort"];
    m.on.release = () => replies.shift() ?? "abort";
    for (let i = 0; i < 2; i++) {
      await btn(page, "v4 を出す").click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await expect(row(page, "見積")).toContainText("足した");
    }
    expect(m.releases).toHaveLength(2);
  });

  test("K1111-UI-013 変えていない：差が 0 の間は［v4 を出す］が aria-disabled・押しても口を呼ばない", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    const b = btn(page, "v4 を出す");
    await expect(b).toHaveAttribute("aria-disabled", "true");
    await b.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes(m)).toEqual([]);
  });
});

test.describe("K-1111 部・守り", () => {
  test("K1111-UI-014 部ごとの小窓：状態の［直す］は名前と色だけ・項目の［項目を足す］は名前・種類・必須・説明", async ({
    page,
    baseURL,
  }) => {
    await open(page, baseURL, { id: STATE.id });
    await btn(page, "未着手 を直す").click();
    let d = page.getByRole("dialog");
    await expect(d.getByLabel("名前", { exact: true })).toHaveValue("未着手");
    await expect(d.getByRole("radiogroup", { name: "色", exact: true })).toBeVisible();
    await expect(d.getByText("本文のひな形", { exact: true })).toHaveCount(0);
    await d.getByRole("button", { name: "やめる", exact: true }).click();
    await page.goto(`${local(baseURL)}${NEW(FIELD.id)}`);
    await btn(page, "項目を足す").click();
    d = page.getByRole("dialog");
    for (const l of ["名前", "種類", "説明"]) await expect(d.getByLabel(l, { exact: true })).toBeVisible();
    await expect(d.getByRole("checkbox", { name: "必須", exact: true })).toBeVisible();
  });

  test("K1111-UI-015 配るものを持たない運営の人：「見る権限がありません」・ひな形の口を 1 回も呼ばない", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL, { caps: ["money"] });
    await expect(page.getByText("見る権限がありません", { exact: true })).toBeVisible();
    expect(m.calls).toEqual([]);
  });

  test("K1111-UI-016 2 回押し：確かめの［本人確認をして出す］を 2 回続けて押しても出す口は 1 回", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL, { draft: MOCK_DRAFT });
    await btn(page, "v4 を出す").click();
    await dialog(page, RELEASE_TITLE).getByRole("button", { name: "本人確認をして出す", exact: true }).dblclick();
    await page.waitForURL((u) => u.pathname === "/ops/skills/templates");
    expect(m.releases.filter((b) => !b["dry_run"])).toHaveLength(1);
  });

  test("K1111-UI-017 幅と字の守り：320〜1440 で横のはみ出しが 0 以下・HTML の入った名前は字のまま・スクリプトが動かない・取引先・業務の型・書き出しと dry_run・key の字が無い", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    const evil = "<img src=x onerror=window.__k1111=1>会議";
    m.on.one = () => ({
      status: 200,
      body: {
        data: { ...KIND, items: KIND_ITEMS.map((i) => (i.key === "meeting" ? { ...i, name: evil } : i)), versions: [] },
      },
    });
    await page.reload();
    await expect(page.getByText(evil, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __k1111?: number }).__k1111)).toBeUndefined();
    for (const w of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(await overflowX(page), String(w)).toBeLessThanOrEqual(0);
    }
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(/dry_run|\bkey\b/);
  });

  test("K1111-UI-018 種別は 10 まで：種別が 10 の版で［種別を足す］の小窓に名前を書いて保存すると小窓の中の赤字に「種別は 10 まで」・小窓は閉じず名前は残る・表に「見積」が足されない・書く口は 0", async ({
    page,
    baseURL,
  }) => {
    const { m } = await open(page, baseURL);
    const ten = [
      ...KIND_ITEMS,
      ...Array.from({ length: 5 }, (_, i) => ({
        key: `k${i}`,
        name: `種別${i + 1}`,
        color_key: "indigo",
        body_template: null,
      })),
    ];
    m.on.one = () => ({ status: 200, body: { data: { ...KIND, items: ten, versions: [] } } });
    await page.reload();
    await expect(row(page, "種別5")).toContainText("そのまま");
    await btn(page, "種別を足す").click();
    const d = page.getByRole("dialog");
    await d.getByLabel("名前", { exact: true }).fill("見積");
    await d.getByRole("button", { name: "保存する", exact: true }).click();
    await expect(d).toContainText("種別は 10 まで");
    await expect(d.getByLabel("名前", { exact: true })).toHaveValue("見積");
    await expect(page.locator(".k-f12-rt tr, .k-f12-rt-card").filter({ hasText: "見積" })).toHaveCount(0);
    expect(writes(m)).toEqual([]);
  });
});
