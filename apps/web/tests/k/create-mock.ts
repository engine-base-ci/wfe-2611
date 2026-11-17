// 作る画面（/tickets?new=1）の試験の網の手前の差し替え（K-224・K-225 の試験が使う）。口の形は前からある口（K-60）と一覧の口（K-92）。
//   本人の Bridge（127.0.0.1:38617）に届かせない（網の手前で 404）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, type Page, type Request, type Route } from "@playwright/test";

export const WS = "aaaaaaaa-0000-4000-8000-000000000001";
export const ME = "11111111-0000-4000-8000-000000000001";
export const MATE = "11111111-0000-4000-8000-000000000002";
export const BOSS = "11111111-0000-4000-8000-000000000003";
export const SCOPE = "22222222-0000-4000-8000-000000000001";
export const TASK = "44444444-0000-4000-8000-000000000001";
export const ISSUE = "44444444-0000-4000-8000-000000000002";
export const NEW_ID = "0193c5a0-0000-7000-8000-00000000c224";
const API_RE = /\/api\/(v1|auth-ext|auth)\//;

const sec = (key: string, label: string, mode = "show", hint: string | null = null) => ({
  key,
  label,
  mode,
  position: 0,
  content_type: "text",
  hint,
});
export const KINDS = [
  {
    id: TASK,
    name: "タスク",
    sections: [
      sec("purpose", "目的", "required"),
      sec("done", "完了の条件", "required", "ここからテスト仕様の案ができる"),
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
export const MEMBERS = [
  { id: ME, display_name: "高本", kind_id: "human", deleted_at: null, suspended_at: null },
  { id: MATE, display_name: "山田", kind_id: "human", deleted_at: null, suspended_at: null },
  { id: BOSS, display_name: "佐藤", kind_id: "human", deleted_at: null, suspended_at: null },
];

type Reply = { status: number; body: unknown };
const ok = (data: unknown, meta: Record<string, unknown> = {}): Reply => ({ status: 200, body: { data, meta } });

export interface CreateMock {
  creates: Record<string, unknown>[];
  draftSaves: Record<string, unknown>[];
  draftDeletes: number;
  listCalls: URLSearchParams[];
  /** 下書きの一覧の口を止めておく（開けると答える） */
  holdDrafts: Promise<void> | null;
  /** 下書きの一覧の口の答え */
  drafts: { draft_id: string; body: Record<string, unknown>; saved_at: string }[];
  /** 一覧の口（親の候補）の答えの状態。200 以外なら体はエラー */
  listStatus: number;
  /** 下書きを残す口の答えの状態。200 番台以外なら残さない */
  draftSaveStatus: number;
}

export async function mockCreate(page: Page, o: Partial<CreateMock> = {}): Promise<CreateMock> {
  const m: CreateMock = {
    creates: [],
    draftSaves: [],
    draftDeletes: 0,
    listCalls: [],
    holdDrafts: null,
    drafts: [],
    listStatus: 200,
    draftSaveStatus: 201,
    ...o,
  };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    let r: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    if (p === "/api/auth/get-session")
      r = {
        status: 200,
        body: {
          session: { id: "s1", userId: ME, token: "t", expiresAt: "2099-01-01T00:00:00Z" },
          user: { id: ME, email: "me@example.com", name: "高本", emailVerified: true },
        },
      };
    else if (p === "/api/auth-ext/me")
      r = ok({ member_id: ME, tenant_id: WS, display_name: "高本", role_id: "owner", scope_id: null });
    else if (p === "/api/v1/scopes")
      r = ok([{ id: SCOPE, name: "営業", tenant_id: WS, ticket_prefix: "EG" }], { limit: 200, writable: [SCOPE] });
    else if (p === "/api/v1/ticket_kinds") r = ok(KINDS, { limit: 50 });
    else if (p === "/api/v1/members") r = ok(MEMBERS, { limit: 200 });
    else if (p === "/api/v1/approvals/queue") r = ok([], { limit: 1, counts: { total: 0 }, cursor: null });
    else if (p === "/api/v1/bridge/devices") r = ok([]);
    else if (p === "/api/v1/tickets" && req.method() === "GET" && m.listStatus !== 200) {
      m.listCalls.push(u.searchParams);
      r = { status: m.listStatus, body: { error: "server_error", code: "INTERNAL" } };
    } else if (p === "/api/v1/tickets" && req.method() === "GET") {
      m.listCalls.push(u.searchParams);
      const q = u.searchParams.get("q") ?? "";
      const rows = [
        { id: "p1", number: "EG-101", title: "月次の締め", depth: 1 },
        { id: "p2", number: "EG-102", title: "月次の締め 子", depth: 2 },
        { id: "p3", number: "EG-103", title: "月次の締め 孫", depth: 3 },
      ].filter((x) => q !== "" && (x.title.includes(q) || x.number === q));
      r = ok(
        rows.map((x) => ({
          ...x,
          kind: { id: TASK, name: "タスク" },
          stage: { id: "s", name: "未着手", key: "todo" },
          assignee: null,
          delegated_to_clone: false,
          due_on: null,
          overdue: false,
          updated_at: "2026-11-15T00:00:00Z",
          parent_ticket_id: null,
        })),
        { next_cursor: null },
      );
    } else if (p === "/api/v1/tickets" && req.method() === "POST") {
      m.creates.push(req.postDataJSON() as Record<string, unknown>);
      r = { status: 201, body: { data: { id: NEW_ID, number: "EG-133", title: "作った" } } };
    } else if (p === "/api/v1/me/ticket-drafts") {
      if (req.method() === "GET") {
        if (m.holdDrafts) await m.holdDrafts;
        r = ok(m.drafts);
      } else if (m.draftSaveStatus >= 300) {
        r = { status: m.draftSaveStatus, body: { error: "server_error", code: "INTERNAL" } };
      } else {
        const b = req.postDataJSON() as Record<string, unknown>;
        if (b["discard"]) m.draftDeletes += 1;
        m.draftSaves.push(b);
        // 本物と同じく、残した下書きは次の一覧の口の答えに出る（消す保存は消える）
        const rest = m.drafts.filter((d) => d.draft_id !== b["draft_id"]);
        m.drafts = b["discard"]
          ? rest
          : [
              ...rest,
              {
                draft_id: String(b["draft_id"]),
                body: (b["body"] ?? {}) as Record<string, unknown>,
                saved_at: "2026-11-16T01:42:00Z",
              },
            ];
        r = {
          status: 201,
          body: { data: { draft_id: b["draft_id"], body: b["body"] ?? {}, saved_at: "2026-11-16T01:42:00Z" } },
        };
      }
    } else if (p === `/api/v1/tickets/${NEW_ID}`)
      r = ok({
        ticket: { id: NEW_ID, number: "EG-133", title: "作った", due_on: null, start_on: null, priority: "mid" },
        sections: [],
        kind: { name: "タスク" },
        stage: { name: "未着手" },
        assignee: { display_name: "高本" },
      });
    else if (p === `/api/v1/tickets/${NEW_ID}/runs`) r = ok([]);
    else if (p === "/api/v1/tickets/p2")
      // 下書きから戻した親を番号と題名で出すための詳細の口
      r = ok({
        ticket: { id: "p2", number: "EG-102", title: "月次の締め 子", due_on: null, start_on: null, priority: "mid" },
        sections: [],
        kind: { name: "タスク" },
        stage: { name: "未着手" },
        assignee: null,
      });
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}

export async function openCreate(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto("/tickets?new=1");
  expect(res?.status()).toBe(200);
}
/** 作った後に詳細へ移り切るのを待つ（K-260）。URL が移った（toHaveURL）だけでは、詳細の画面はまだ動き出していないことがある。
 *  その間に鍵（kaname.token）を消すと、動き出した詳細の画面が鍵の無いことを見てログインへ移し、次の開き直しの goto が取り消される（ERR_ABORTED）。
 *  詳細の見出し（差し替えた詳細の口の題名「作った」）は、詳細の画面が鍵を確かめて詳細の口を読んだ後にだけ出るので、これが出たら移り切った印 */
export async function settledDetail(page: Page) {
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "作った" })).toBeVisible();
}
export const form = (page: Page) => page.getByRole("region", { name: "チケットを作る" });
/** 続きの下書きを読み終えた（種別に既定のタスクが入る） */
export const loaded = (page: Page) => expect(page.getByRole("combobox", { name: "種別" })).toContainText(/タスク|課題/);
export const css = (page: Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
export const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** 作る口に送れるところまで欄を埋める（担当者は高本・期限は 3 日後・必須の区画） */
export async function fillRequired(page: Page, title = "請求書を送る") {
  await page.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  await page.getByRole("combobox", { name: "担当者" }).click();
  await page.getByRole("option", { name: "高本", exact: true }).click();
  await page
    .getByRole("textbox", { name: "期限", exact: true })
    .fill(new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10));
  for (const n of ["目的", "完了の条件", "実施事項"])
    await page.getByRole("textbox", { name: n, exact: true }).fill("書いた");
}
export const gate = () => {
  let release!: () => void;
  const wait = new Promise<void>((r) => (release = r));
  return { wait, open: () => release() };
};
