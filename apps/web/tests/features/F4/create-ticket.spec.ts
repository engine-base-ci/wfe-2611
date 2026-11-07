// K-60「チケットを作る」の画面の試験（実 Chrome）：/tickets の作る面と、読むだけの詳細 /tickets/[id]。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/create-ticket.md）＝試験 1 本。口（API）は網の手前（page.route）で差し替える。
//   口の振る舞いそのものは apps/api/test/features/F4/create-ticket.test.ts が本物の DB で持つ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { BrowserContext, Page, Request, Route } from "@playwright/test";
import { expect, missingRows, row, rowsOf } from "../../_lib/row";
import { WIDTHS } from "../../_lib/api";

const SPEC = join(dirname(fileURLToPath(import.meta.url)), "../../../../../07_qa/test-specs/k/create-ticket.md");
const ROWS = rowsOf(SPEC);
const R = Object.fromEntries(ROWS.map((r) => [r.id, r]));
const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const WS_A = "aaaaaaaa-0000-4000-8000-000000000001";
const WS_B = "bbbbbbbb-0000-4000-8000-000000000002";
const ID = "0193c5a0-0000-7000-8000-00000000c060";
const ME = "11111111-0000-4000-8000-000000000001";
const MATE = "11111111-0000-4000-8000-000000000002";
const BOSS = "11111111-0000-4000-8000-000000000003";
const STOPPED = "11111111-0000-4000-8000-000000000004";
const SCOPE = "22222222-0000-4000-8000-000000000001";
const VIEW_ONLY_SCOPE = "22222222-0000-4000-8000-000000000002";
const TASK = "44444444-0000-4000-8000-000000000001";
const ISSUE = "44444444-0000-4000-8000-000000000002";
const sec = (key: string, label: string, mode = "show") => ({
  key,
  label,
  mode,
  position: 0,
  content_type: "text",
  hint: null,
});
const KINDS = [
  {
    id: TASK,
    name: "タスク",
    sections: [
      sec("purpose", "目的", "required"),
      sec("done", "完了の条件", "required"),
      sec("todo", "実施事項", "required"),
      sec("risks", "リスクと懸念"),
    ],
  },
  {
    id: ISSUE,
    name: "課題",
    sections: [
      sec("happening", "起きていること", "required"),
      sec("impact", "影響", "required"),
      sec("done", "完了の条件", "required"),
    ],
  },
];
const MEMBERS = [
  { id: ME, display_name: "高本", kind_id: "human", deleted_at: null, suspended_at: null },
  { id: MATE, display_name: "山田", kind_id: "human", deleted_at: null, suspended_at: null },
  { id: BOSS, display_name: "佐藤", kind_id: "human", deleted_at: null, suspended_at: null },
  {
    id: STOPPED,
    display_name: "止められた人",
    kind_id: "human",
    deleted_at: null,
    suspended_at: "2026-11-01T00:00:00Z",
  },
];
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

type Reply = { status: number; body: unknown };
interface Mock {
  creates: Record<string, unknown>[];
  drafts: Map<string, Map<string, { body: unknown; saved_at: string }>>;
  draftSaves: Record<string, unknown>[];
  on: { create: () => Reply; kinds: () => Reply; scopes: () => Reply; list: () => Reply; detail: () => Reply };
}
async function mockApi(page: Page | BrowserContext, o: { ws?: string; token?: boolean; m?: Mock } = {}): Promise<Mock> {
  const ws = o.ws ?? WS_A;
  const m: Mock = o.m ?? {
    creates: [],
    drafts: new Map(),
    draftSaves: [],
    on: {
      create: () => ({ status: 201, body: { data: { id: ID, number: "EG-133", title: "請求書を送る" } } }),
      kinds: () => ({ status: 200, body: { data: KINDS, meta: { limit: 2 } } }),
      scopes: () => ({
        status: 200,
        body: {
          data: [
            { id: SCOPE, name: "営業", tenant_id: ws },
            { id: VIEW_ONLY_SCOPE, name: "経理（見るだけ）", tenant_id: ws },
          ],
          meta: { limit: 200, writable: [SCOPE] },
        },
      }),
      // 一覧の口（listTickets）は K-92 が作る（D-128.152）。K-60 の時点では作っていない＝ 501。作る面の親の候補と一覧の並びは K-92 の試験が見る
      list: () => ({ status: 501, body: { error: "not_implemented", code: "NOT_IMPLEMENTED" } }),
      detail: () => ({
        status: 200,
        body: {
          data: {
            ticket: {
              id: ID,
              number: "EG-133",
              title: "請求書を送る",
              due_on: jst(3),
              start_on: null,
              priority: "mid",
            },
            sections: [{ key: "purpose", label: "目的", body: { text: "月末の請求を出す" }, version: 1 }],
            kind: { name: "タスク" },
            stage: { name: "未着手" },
            assignee: { display_name: "山田" },
          },
        },
      }),
    },
  };
  if (o.token !== false) await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${ws}`);
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    const wsOf = (req.headers()["authorization"] ?? "").replace("Bearer tok-", "") || ws;
    let reply: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    if (p === "/api/v1/scopes") reply = m.on.scopes();
    else if (p === "/api/v1/ticket_kinds") reply = m.on.kinds();
    else if (p === "/api/v1/members") reply = { status: 200, body: { data: MEMBERS, meta: { limit: 200 } } };
    else if (p === "/api/v1/tickets" && req.method() === "GET") reply = m.on.list();
    else if (p === "/api/v1/tickets" && req.method() === "POST") {
      m.creates.push(req.postDataJSON() as Record<string, unknown>);
      await new Promise((r) => setTimeout(r, 200)); // 答えを待つ間（2 回押しを確かめる）
      reply = m.on.create();
    } else if (p === `/api/v1/tickets/${ID}`) reply = m.on.detail();
    else if (p === "/api/v1/me/ticket-drafts") {
      const mine = m.drafts.get(wsOf) ?? new Map();
      m.drafts.set(wsOf, mine);
      if (req.method() === "POST") {
        const b = req.postDataJSON() as { draft_id: string; body?: unknown; discard?: boolean };
        m.draftSaves.push(b);
        if (b.discard) mine.delete(b.draft_id);
        else mine.set(b.draft_id, { body: b.body ?? {}, saved_at: new Date().toISOString() });
        reply = {
          status: 201,
          body: { data: { draft_id: b.draft_id, body: b.body ?? {}, saved_at: new Date().toISOString() } },
        };
      } else
        reply = {
          status: 200,
          body: {
            data: [...mine.entries()].reverse().map(([draft_id, v]) => ({ draft_id, ...v })),
            meta: { limit: mine.size },
          },
        };
    }
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return m;
}
const open = async (page: Page, q = "?new=1", width = 1440) => {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(`/tickets${q}`);
  expect(res?.status()).toBe(200);
};
const form = (page: Page) => page.getByRole("region", { name: "チケットを作る" });
const pick = async (page: Page, label: string, option: string) => {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const reasonOf = async (page: Page, label: string) => {
  const el = page
    .getByRole("textbox", { name: label, exact: true })
    .or(page.getByLabel(label, { exact: true }))
    .first();
  const ids = (await el.getAttribute("aria-describedby")) ?? "";
  const texts = await Promise.all(
    ids
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => page.locator(`[id="${id}"]`).innerText()),
  );
  return texts.join(" ");
};
const fillAll = async (page: Page, o: { title?: string; due?: string } = {}) => {
  await expect(form(page)).toBeVisible();
  await page.getByRole("textbox", { name: "題名", exact: true }).fill(o.title ?? "請求書を送る");
  await pick(page, "担当者", "山田");
  await page.getByRole("textbox", { name: "期限", exact: true }).fill(o.due ?? jst(3));
  await page.getByRole("textbox", { name: "目的", exact: true }).fill("月末の請求を出す");
  await page.getByRole("textbox", { name: "完了の条件", exact: true }).fill("先方が受け取った");
  await page.getByRole("textbox", { name: "実施事項", exact: true }).fill("作る・送る");
};
const create = (page: Page) => page.getByRole("button", { name: "作る", exact: true });

row(R["K60-UI-000"], async (page) => {
  await mockApi(page);
  await open(page);
  await expect(form(page)).toBeVisible();
  // 区画の欄（種別のマスタから並ぶ）と知らせる人（人の数だけ並ぶ）は、K60-UI-014・K60-UI-015 の行が受け持つ
  const generated = new Set([
    ...KINDS.flatMap((k) => k.sections.map((s) => s.label)),
    ...MEMBERS.map((x) => x.display_name),
  ]);
  // 外枠（サイドバー・下タブ）の要素は外枠の試験が受け持つ（D-128.151）。ここは本文だけを見る。外枠が出ることは K60-UI-031
  const missing = (await missingRows(page, ROWS, "[data-ticket-shell]")).filter(
    (x) => !generated.has(/「(.+)」/.exec(x)?.[1] ?? ""),
  );
  expect(missing).toEqual([]);
});

row(R["K60-UI-001"], async (page) => {
  await mockApi(page);
  await open(page, "");
  await page.getByRole("button", { name: "＋ チケットを作る" }).click();
  await expect(form(page)).toBeVisible();
  await expect(page).toHaveURL(/\/tickets\?new=1$/);
  await page.reload();
  await expect(form(page)).toBeVisible();
});

row(R["K60-UI-002"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fillAll(page);
  await create(page).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${ID}$`));
  expect(m.creates).toHaveLength(1);
  expect(m.creates[0]).toMatchObject({
    scope_id: SCOPE,
    kind_id: TASK,
    title: "請求書を送る",
    assignee_member_id: MATE,
    due_on: jst(3),
    priority: "mid",
    sections: { purpose: "月末の請求を出す", done: "先方が受け取った", todo: "作る・送る" },
    notify_member_ids: [],
  });
  expect(String(m.creates[0]!["draft_id"])).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "請求書を送る" })).toBeVisible();
  await expect(page.getByText("EG-133")).toBeVisible();
  await expect(page.getByText("未着手")).toBeVisible();
  await expect(page.getByText("月末の請求を出す")).toBeVisible();
});

row(R["K60-UI-003"], async (page) => {
  const m = await mockApi(page);
  m.on.list = () => ({ status: 200, body: { data: [], meta: { limit: 50 } } });
  await open(page, "");
  await page.getByRole("button", { name: "自分で書く" }).click();
  await expect(form(page)).toBeVisible();
});

row(R["K60-UI-004"], async (page) => {
  await mockApi(page);
  await open(page);
  await page.getByRole("button", { name: "閉じる" }).click();
  await expect(form(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/tickets$/);
});

row(R["K60-UI-005"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fillAll(page, { title: "" });
  await create(page).click();
  await expect.poll(() => reasonOf(page, "題名")).toContain("題名を入れてください");
  await page.getByRole("textbox", { name: "題名", exact: true }).fill("あ".repeat(201));
  await create(page).click();
  await expect.poll(() => reasonOf(page, "題名")).toContain("200 文字まで");
  expect(m.creates).toHaveLength(0);
});

row(R["K60-UI-006"], async (page) => {
  await mockApi(page);
  await open(page);
  await expect(page.getByRole("combobox", { name: "種別" })).toContainText("タスク");
  await pick(page, "種別", "課題");
  await expect(page.getByRole("textbox", { name: "起きていること", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "影響", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "目的", exact: true })).toHaveCount(0);
});

row(R["K60-UI-007"], async (page) => {
  await mockApi(page);
  await open(page);
  await page.getByRole("combobox", { name: "グループ" }).click();
  await expect(page.getByRole("option", { name: "営業" })).toBeVisible();
  await expect(page.getByRole("option", { name: "経理（見るだけ）" })).toHaveCount(0);
});

row(R["K60-UI-008"], async (page) => {
  await mockApi(page);
  await open(page);
  await page.getByRole("combobox", { name: "担当者" }).click();
  await expect(page.getByRole("option", { name: "山田" })).toBeVisible();
  await expect(page.getByRole("option", { name: "止められた人" })).toHaveCount(0);
});

row(R["K60-UI-009"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fillAll(page, { due: "" });
  await create(page).click();
  await expect.poll(() => reasonOf(page, "期限")).toContain("期限を入れてください");
  await page.getByRole("textbox", { name: "期限", exact: true }).fill(jst(-1));
  await create(page).click();
  await expect.poll(() => reasonOf(page, "期限")).toContain("期限は今日か、それより後の日にしてください");
  expect(m.creates).toHaveLength(0);
});

row(R["K60-UI-010"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fillAll(page);
  await page.getByRole("textbox", { name: "開始", exact: true }).fill(jst(10));
  await create(page).click();
  await expect.poll(() => reasonOf(page, "開始")).toContain("開始は期限より前の日にしてください");
  expect(m.creates).toHaveLength(0);
  await page.getByRole("textbox", { name: "開始", exact: true }).fill(jst(-30));
  await create(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]).toMatchObject({ start_on: jst(-30) });
});

row(R["K60-UI-011"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fillAll(page);
  await expect(page.getByRole("combobox", { name: "優先度" })).toContainText("中");
  await pick(page, "優先度", "高");
  await create(page).click();
  await expect.poll(() => reasonOf(page, "高にする理由")).toContain("優先度を高にする理由を書いてください");
  expect(m.creates).toHaveLength(0);
});

row(R["K60-UI-012"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fillAll(page);
  await pick(page, "優先度", "高");
  await page.getByRole("textbox", { name: "高にする理由", exact: true }).fill("先方の締めが早い");
  await create(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]).toMatchObject({ priority: "high", priority_reason: "先方の締めが早い" });
});

row(R["K60-UI-014"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fillAll(page);
  await page.getByRole("textbox", { name: "完了の条件", exact: true }).fill("");
  await page.getByRole("textbox", { name: "実施事項", exact: true }).fill("");
  await create(page).click();
  await expect.poll(() => reasonOf(page, "完了の条件")).toContain("この区画は書かないと作れません");
  await expect.poll(() => reasonOf(page, "実施事項")).toContain("この区画は書かないと作れません");
  const before = page.getByRole("region", { name: "作る前に" });
  await expect(before.getByText("× 完了の条件")).toBeVisible();
  await expect(before.getByText("✓ 目的")).toBeVisible();
  expect(m.creates).toHaveLength(0);
});

row(R["K60-UI-015"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fillAll(page);
  await page.getByRole("checkbox", { name: "佐藤" }).check();
  await page.getByRole("checkbox", { name: "高本" }).check();
  await create(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect([...(m.creates[0]!["notify_member_ids"] as string[])].sort()).toEqual([ME, BOSS].sort());
});

row(R["K60-UI-016"], async (page) => {
  await mockApi(page, { token: false });
  await page.goto("/tickets?new=1");
  await expect(page).toHaveURL(/\/login\?next=%2Ftickets%3Fnew%3D1$/);
});

row(R["K60-UI-017"], async (page) => {
  const m = await mockApi(page);
  m.on.create = () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
  await open(page);
  await fillAll(page, { title: "切れる前に書いた題名" });
  await create(page).click();
  await expect(page).toHaveURL(/\/login\?next=%2Ftickets%3Fnew%3D1$/);
  // 入り直した（鍵が戻った）後、作る面を開くと書きかけが続きから出る
  await page.evaluate((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS_A}`);
  await page.goto("/tickets?new=1");
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("切れる前に書いた題名");
  await expect(page.getByRole("textbox", { name: "目的", exact: true })).toHaveValue("月末の請求を出す");
});

row(R["K60-UI-018"], async (page) => {
  const m = await mockApi(page);
  m.on.scopes = () => ({
    status: 200,
    body: { data: [{ id: SCOPE, name: "営業", tenant_id: WS_A }], meta: { limit: 200, writable: [] } },
  });
  m.on.list = () => ({ status: 200, body: { data: [], meta: { limit: 50 } } });
  await open(page, "");
  await expect(page.getByRole("heading", { level: 1, name: "チケット" })).toBeVisible();
  await expect(page.getByText("まだチケットがありません")).toBeVisible();
  await expect(page.getByRole("button", { name: "＋ チケットを作る" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "自分で書く" })).toHaveCount(0);
});

row(R["K60-UI-019"], async (page) => {
  // 鍵は最初の 1 回だけ会社 A のものを置く（切り替えた後の鍵を、開き直すたびに上書きしない）
  await page.addInitScript((t) => {
    if (!window.localStorage.getItem("kaname.token")) window.localStorage.setItem("kaname.token", t);
  }, `tok-${WS_A}`);
  const m = await mockApi(page.context(), { ws: WS_A, token: false });
  await open(page);
  await page.getByRole("textbox", { name: "題名", exact: true }).fill("会社 A の書きかけ");
  await expect.poll(() => m.drafts.get(WS_A)?.size ?? 0).toBe(1);
  // 会社 B に切り替える（鍵が会社 B のもの）
  await page.evaluate((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS_B}`);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.context().unrouteAll({ behavior: "ignoreErrors" });
  await mockApi(page, { ws: WS_B, token: false, m });
  m.on.scopes = () => ({
    status: 200,
    body: { data: [{ id: SCOPE, name: "営業", tenant_id: WS_B }], meta: { limit: 200, writable: [SCOPE] } },
  });
  await page.goto("/tickets?new=1");
  await expect(form(page)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("");
});

row(R["K60-UI-020"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fillAll(page);
  await create(page).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${ID}$`));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "請求書を送る" })).toBeVisible();
  await page.goBack();
  await expect(form(page)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("");
  expect(m.creates).toHaveLength(1);
});

row(R["K60-UI-021"], async (page) => {
  const m = await mockApi(page);
  m.on.create = () => ({
    status: 422,
    body: {
      error: "validation",
      code: "E-VAL-014",
      field: "kind_id",
      details: [
        {
          field: "kind_id",
          message: "選んだものが、いまは選べなくなりました。選び直してください。書いたものは残っています",
        },
      ],
    },
  });
  await open(page);
  await fillAll(page);
  await create(page).click();
  await expect(page.getByText(/選んだものが、いまは選べなくなりました/).first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("請求書を送る");
});

row(R["K60-UI-022"], async (page) => {
  const m = await mockApi(page);
  m.on.create = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
  await open(page);
  await fillAll(page);
  await create(page).click();
  await expect(page.getByText(/この画面を見る権限がありません/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "目的", exact: true })).toHaveValue("月末の請求を出す");
});

row(R["K60-UI-023"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await page.getByRole("textbox", { name: "題名", exact: true }).fill("読めなくても消えない題名");
  await page.getByRole("textbox", { name: "目的", exact: true }).fill("本文");
  await expect.poll(() => m.drafts.get(WS_A)?.size ?? 0).toBe(1);
  let fail = true;
  m.on.kinds = () =>
    fail ? { status: 500, body: { error: "internal", code: null } } : { status: 200, body: { data: KINDS } };
  await page.reload();
  await expect(page.getByText(/読み込めませんでした/)).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "もう一度" }).click();
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("読めなくても消えない題名");
  await expect(page.getByRole("textbox", { name: "目的", exact: true })).toHaveValue("本文");
});

row(R["K60-UI-024"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await fillAll(page);
  await create(page).dblclick();
  await expect(page).toHaveURL(new RegExp(`/tickets/${ID}$`));
  expect(m.creates).toHaveLength(1);
});

row(R["K60-UI-025"], async (page) => {
  const m = await mockApi(page.context());
  await open(page);
  const other = await page.context().newPage();
  await other.setViewportSize({ width: 1440, height: 1000 });
  await other.goto("/tickets?new=1");
  await page.getByRole("textbox", { name: "題名", exact: true }).fill("タブ A");
  await other.getByRole("textbox", { name: "題名", exact: true }).fill("タブ B");
  await expect.poll(() => m.drafts.get(WS_A)?.size ?? 0).toBe(2);
  const titles = [...(m.drafts.get(WS_A)?.values() ?? [])].map((d) => (d.body as { title: string }).title).sort();
  expect(titles).toEqual(["タブ A", "タブ B"]);
  await other.close();
});

row(R["K60-UI-026"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await page.getByRole("textbox", { name: "題名", exact: true }).fill("途中の題名");
  await expect.poll(() => m.draftSaves.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("途中の題名");
});

row(R["K60-UI-027"], async (page) => {
  const m = await mockApi(page);
  m.on.create = () => ({ status: 429, body: { error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 60 } });
  await open(page);
  await fillAll(page);
  await create(page).click();
  await expect(page.getByText(/60 秒たってから/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("請求書を送る");
});

row(R["K60-UI-028"], async (page) => {
  const m = await mockApi(page);
  const evil = '<script>window.__k60 = 1</script><img src=x onerror="window.__k60 = 2">';
  m.on.detail = () => ({
    status: 200,
    body: {
      data: {
        ticket: { id: ID, number: "EG-1", title: evil, due_on: null, start_on: null, priority: "mid" },
        sections: [{ key: "purpose", label: "目的", body: { text: evil }, version: 1 }],
        kind: null,
        stage: null,
        assignee: null,
      },
    },
  });
  await page.goto(`/tickets/${ID}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(evil);
  expect(await page.evaluate(() => (window as unknown as { __k60?: number }).__k60)).toBeUndefined();
});

row(R["K60-UI-029"], async (page) => {
  await mockApi(page);
  for (const w of WIDTHS) {
    await open(page, "?new=1", w);
    await expect(form(page)).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `幅 ${w} の横溢れ`).toBe(0);
  }
});

row(R["K60-UI-030"], async (page) => {
  await mockApi(page);
  await page.goto(`/tickets/${ID}`);
  await page.getByRole("link", { name: "チケットへ戻る" }).click();
  await expect(page).toHaveURL(/\/tickets$/);
});

row(R["K60-UI-031"], async (page) => {
  await mockApi(page);
  // 役と名前は前からある口（/api/auth-ext/me・useMyRoles）で読む（D-128.151）。後から足した route が先に効く
  const me: string[] = [];
  await page.route(/\/api\/auth\/get-session/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: { id: "s1", userId: "u1", token: "t", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
        user: { id: "u1", email: "yamada@example.com", name: "山田", emailVerified: true },
      }),
    }),
  );
  await page.route(/\/api\/auth-ext\/me$/, (route) => {
    me.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { member_id: "m1", tenant_id: WS_A, display_name: "山田", role_id: "viewer" },
      }),
    });
  });
  for (const path of ["", `/${ID}`]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const res = await page.goto(`/tickets${path}`);
    expect(res?.status()).toBe(200);
    const side = page.getByRole("complementary", { name: "主ナビ" });
    await expect(side).toBeVisible();
    await expect(side).toHaveAttribute("data-role", "R4");
    await expect(page.locator('nav.tabbar[aria-label="下タブ"]')).toBeAttached(); // 下タブは狭い幅だけで見える
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  }
  expect(me.length).toBeGreaterThan(0);
});
