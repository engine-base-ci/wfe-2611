// 作る画面（/tickets?new=1）の試験の網の手前の差し替え（K-224・K-442 の試験が使う。K-225 の試験は K-442 が消した）。口の形は前からある口（K-60）と一覧の口（K-92）。
//   本人の Bridge（127.0.0.1:38617）に届かせない（網の手前で 404）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, type Page, type Request, type Route } from "@playwright/test";
import { shellData } from "./shell-answer";

export const WS = "aaaaaaaa-0000-4000-8000-000000000001";
export const ME = "11111111-0000-4000-8000-000000000001";
export const MATE = "11111111-0000-4000-8000-000000000002";
export const BOSS = "11111111-0000-4000-8000-000000000003";
export const SCOPE = "22222222-0000-4000-8000-000000000001";
export const TASK = "44444444-0000-4000-8000-000000000001";
export const ISSUE = "44444444-0000-4000-8000-000000000002";
export const NEW_ID = "0193c5a0-0000-7000-8000-00000000c224";
const API_RE = /\/api\/(v1|auth-ext|auth)\//;

/** 種別のひな形（K-561 の形：見出しと説明の節が全部 attrs.ghost＝薄い字）。K-442 が作る面の本文に入れる */
const ghost = (type: "heading" | "paragraph", text: string) => ({
  type,
  attrs: type === "heading" ? { level: 2, ghost: true } : { ghost: true },
  content: [{ type: "text", text }],
});
export const TEMPLATE_TASK = {
  type: "doc",
  content: [
    ghost("heading", "目的"),
    ghost("paragraph", "このチケットで何を実現したいかを書きます"),
    ghost("heading", "完了の条件"),
    ghost("paragraph", "どうなれば終わりかを書きます"),
  ],
};
export const TEMPLATE_ISSUE = {
  type: "doc",
  content: [
    ghost("heading", "起きていること"),
    ghost("paragraph", "いま何が起きているかを書きます"),
    ghost("heading", "影響"),
    ghost("paragraph", "誰に何の影響があるかを書きます"),
  ],
};
/** 種別の口の答え（K-560：body_template を足した。sections は K-575 まで残るので空の並びで返す） */
export const KINDS = [
  { id: TASK, name: "タスク", sections: [], body_template: TEMPLATE_TASK },
  { id: ISSUE, name: "課題", sections: [], body_template: TEMPLATE_ISSUE },
];
export const MEMBERS = [
  { id: ME, display_name: "高本", kind_id: "human", deleted_at: null, suspended_at: null },
  { id: MATE, display_name: "山田", kind_id: "human", deleted_at: null, suspended_at: null },
  { id: BOSS, display_name: "佐藤", kind_id: "human", deleted_at: null, suspended_at: null },
];

/** 一覧の口（親の候補・つながりの候補）の答えに出る行（K-580 が候補を足せるよう、mockCreate の catalog で差し替えられる） */
export interface CatalogRow {
  id: string;
  number: string;
  title: string;
  depth: number;
  stage?: { id: string; name: string; key: string };
  scope?: { id: string; name: string };
}
export const PARENT_ROWS: CatalogRow[] = [
  { id: "p1", number: "EG-101", title: "月次の締め", depth: 1 },
  { id: "p2", number: "EG-102", title: "月次の締め 子", depth: 2 },
  { id: "p3", number: "EG-103", title: "月次の締め 孫", depth: 3 },
];

export type Reply = { status: number; body: unknown };
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
  /** 会社の項目のマスタ（K-563 の行の形・種別の id → 並び。種別の口 listTicketKinds の各種別の fields に入って来る）と、listTicketFields に飛んだ種別の id（作る面は呼ばないので空のまま） */
  masters: Record<string, unknown[]>;
  fieldReads: string[];
  /** 作る口の次の答え（先頭から使う。空なら 201）。断りを出したいとき（409・404・422・429・5xx）に積む */
  createReplies: Reply[];
  /** 作る口の答えを止めておく門（holdCreate が閉じ、返した関数で開く。二度押しの確かめ） */
  createGate: Promise<void>;
  /** 一覧の口（q 付き）が探す行。既定は親の候補 3 つ（K-224）。つながりの候補（K-580）は差し替える */
  catalog: CatalogRow[];
}

/** 作った後の詳細の答え（K-560 の形）。最後に作った体から組む：本文は {doc, text, version: 1}・項目は種別のマスタ＋送った値・確認項目は数だけ */
function detailOf(m: CreateMock) {
  const sent = (m.creates[m.creates.length - 1] ?? {}) as {
    kind_id?: string;
    body?: { doc?: { content?: unknown[] } };
    fields?: Record<string, unknown>;
    specs?: string[];
    links?: { kind: string; other_ticket_id: string }[];
  };
  const master = (m.masters[sent.kind_id ?? ""] ?? []) as { id: string }[];
  const textOf = (n: unknown): string => {
    const x = n as { text?: string; content?: unknown[] };
    return typeof x.text === "string" ? x.text : (x.content ?? []).map(textOf).join("");
  };
  const doc = sent.body?.doc ?? { type: "doc", content: [] };
  return {
    ticket: { id: NEW_ID, number: "EG-133", title: "作った", due_on: null, start_on: null, priority: "mid" },
    sections: [],
    body: { doc, text: (doc.content ?? []).map(textOf).join("\n"), version: sent.body?.doc ? 1 : 0 },
    fields: master.map((f) => ({ ...f, value: sent.fields?.[f.id] ?? null })),
    spec_count: (sent.specs ?? []).length,
    spec_unchecked: (sent.specs ?? []).length,
    no_spec_reason: null,
    parent: null,
    child_count: 0,
    link_count: (sent.links ?? []).length,
    results: {},
    kind: { name: "タスク" },
    stage: { name: "未着手" },
    assignee: { display_name: "高本" },
  };
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
    masters: {},
    fieldReads: [],
    createReplies: [],
    createGate: Promise.resolve(),
    catalog: PARENT_ROWS,
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
    else if (p === "/api/v1/shell")
      // 外枠は getShell 1 本（K-466）。作る面は営業が書ける
      r = ok(shellData({ groups: [{ id: SCOPE, name: "営業", ticket_prefix: "EG", writable: true, open_count: 0 }] }));
    else if (p === "/api/v1/scopes")
      r = ok([{ id: SCOPE, name: "営業", tenant_id: WS, ticket_prefix: "EG" }], { limit: 200, writable: [SCOPE] });
    // 会社の項目のマスタは種別の口の答えの各種別の fields に入って来る（X6・K-560。作る面は listTicketFields を呼ばない）
    else if (p === "/api/v1/ticket_kinds")
      r = ok(
        KINDS.map((k) => ({ ...k, fields: m.masters[k.id] ?? [] })),
        { limit: 50 },
      );
    else if (p === "/api/v1/ticket-fields" && req.method() === "GET") {
      const kind = u.searchParams.get("kind_id") ?? "";
      m.fieldReads.push(kind);
      r = ok(m.masters[kind] ?? [], { limit: 200 });
    } else if (p === "/api/v1/members") r = ok(MEMBERS, { limit: 200 });
    else if (p === "/api/v1/approvals/queue") r = ok([], { limit: 1, counts: { total: 0 }, cursor: null });
    else if (p === "/api/v1/bridge/devices") r = ok([]);
    else if (p === "/api/v1/tickets" && req.method() === "GET" && m.listStatus !== 200) {
      m.listCalls.push(u.searchParams);
      r = { status: m.listStatus, body: { error: "server_error", code: "INTERNAL" } };
    } else if (p === "/api/v1/tickets" && req.method() === "GET") {
      m.listCalls.push(u.searchParams);
      const q = (u.searchParams.get("q") ?? "").normalize("NFKC").trim().toLowerCase();
      const rows = m.catalog.filter(
        (x) => q !== "" && (x.title.toLowerCase().includes(q) || x.number.toLowerCase() === q),
      );
      r = ok(
        rows.map((x) => ({
          ...x,
          kind: { id: TASK, name: "タスク" },
          stage: x.stage ?? { id: "s", name: "未着手", key: "todo" },
          scope: x.scope ?? { id: SCOPE, name: "営業" },
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
      await m.createGate;
      r = m.createReplies.shift() ?? { status: 201, body: { data: { id: NEW_ID, number: "EG-133", title: "作った" } } };
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
    } else if (p === `/api/v1/tickets/${NEW_ID}/links`) {
      // 作った後の詳細のつながりのカード（K-452）が「開く」で読む口。最後に作った体の links から組む（K-580）
      const sent =
        ((m.creates[m.creates.length - 1] ?? {}) as { links?: { kind: string; other_ticket_id: string }[] }).links ??
        [];
      r = ok(
        sent.map((l, i) => {
          const c = m.catalog.find((x) => x.id === l.other_ticket_id);
          return {
            id: `7d000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
            kind: l.kind,
            side: l.kind === "derived_from" ? "derived" : null,
            other: c
              ? {
                  id: c.id,
                  number: c.number,
                  title: c.title,
                  stage: c.stage ?? { id: "s", name: "未着手", key: "todo" },
                  scope: c.scope ?? { id: SCOPE, name: "営業" },
                  visible: true,
                }
              : { id: null, number: "—", title: null, stage: null, scope: null, visible: false },
            can_remove: true,
            created_at: "2026-11-20T01:00:00Z",
          };
        }),
        { limit: 200, children: [] },
      );
    } else if (p === `/api/v1/tickets/${NEW_ID}`) r = ok(detailOf(m));
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

/** 作る口の答えを止める。返した関数を呼ぶと、止めていた答えが返る（固定の待ちを使わず、口が何回呼ばれたかを数えるため） */
export function holdCreate(m: CreateMock): () => void {
  let open = (): void => undefined;
  m.createGate = new Promise<void>((r) => (open = r));
  return () => open();
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
/** 今日（日本時間）から days 日後の YYYY-MM-DD */
export const jstDay = (days = 0): string =>
  new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

/** 期限の欄が小窓のボタンか（K-444 の後）。日付の欄（textbox「期限」）なら false。どちらも出るまで待つ */
export async function dueIsDialog(page: Page): Promise<boolean> {
  const box = page.getByRole("textbox", { name: "期限", exact: true });
  const button = page.getByRole("button", { name: "期限", exact: true });
  await expect(box.or(button)).toBeVisible();
  return (await box.count()) === 0;
}

/** 期限を入れる（K-431 が持つ・日付の欄でも小窓のボタンでも通る）。空（""）は何も入れない。
 *  小窓では、月を送ってカレンダーの日（名前「12月1日（月）」）を押し、「〜にする」を押す。小窓は今日より前を選べないので、過去の日は投げる
 *  （過去を試す行は dueIsDialog で分ける）。作る面の欄の形が替わっても、この道具だけを直す */
export async function fillDue(page: Page, ymd: string): Promise<void> {
  if (!(await dueIsDialog(page))) return page.getByRole("textbox", { name: "期限", exact: true }).fill(ymd);
  if (ymd === "") return;
  if (ymd < jstDay(0)) throw new Error(`期限の小窓は今日より前（${ymd}）を選べない`);
  await page.getByRole("button", { name: "期限", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "期限を決める", exact: true });
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  for (let i = 0; i < 24 && (await dlg.getByText(`${y}年 ${m}月`, { exact: true }).count()) === 0; i += 1)
    await dlg.getByRole("button", { name: "次の月", exact: true }).click();
  const week = "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  await dlg.getByRole("button", { name: `${m}月${d}日（${week}）`, exact: true }).click();
  await dlg.getByRole("button", { name: /にする$/ }).click();
  await expect(dlg).toHaveCount(0);
}

/** 作る面で親を選ぶ（K-442 が持つ・前の欄でも小窓でも通る）。親の小窓（K-443 の後）は入口「親チケットを決める」の小窓で探して選び「親にする」を押す。
 *  前の欄（K-443 の前）は「親…」のボタンから打って探し、選ぶ。`fillDue` と同じ考えで、親の欄の形が替わっても、この道具だけを直す。
 *  q は探す字・row は選ぶ行の名前（正規表現） */
export async function pickParent(page: Page, q: string, row: RegExp): Promise<void> {
  const entry = page.getByRole("button", { name: "親チケットを決める", exact: true }).first();
  const legacy = page.getByRole("button", { name: /^親/ }).first();
  await expect(entry.or(legacy)).toBeVisible();
  if ((await entry.count()) > 0) {
    await entry.click();
    const d = page.getByRole("dialog", { name: "親チケットを決める", exact: true });
    await d.getByRole("textbox", { name: "番号か題名で探す", exact: true }).fill(q);
    await d.getByRole("radio", { name: row }).click();
    await d.getByRole("button", { name: "親にする", exact: true }).click();
    await expect(d).toHaveCount(0);
    return;
  }
  await legacy.click();
  await page.getByRole("combobox", { name: /親/ }).first().fill(q);
  await page.getByRole("option", { name: row }).click();
}

/** 本文の欄（K-567 の部品・role=textbox・名前「本文」）。作る面に 1 つ */
export const bodyBox = (page: Page) => page.getByRole("textbox", { name: "本文", exact: true });

/** 本文に字を書く（K-442）：薄い説明の節（ひな形）があれば最初のそこへ、無ければ本文の先頭へ打つ。薄い節に打つと、その節は普通の字になる（K-567）。
 *  日本語の変換は通さず、打った字をそのまま入れる */
export async function writeBody(page: Page, text: string): Promise<void> {
  const box = bodyBox(page);
  await expect(box).toBeVisible();
  const ghostP = box.locator('p[data-ghost="true"]').first();
  if ((await ghostP.count()) > 0) await ghostP.click();
  else await box.click();
  await page.keyboard.type(text);
}

/** 作る口に送れるところまで欄を埋める（担当者は高本・期限は 3 日後）。本文は空でも作れる（D-150.49）ので、body を渡したときだけ書く */
export async function fillRequired(page: Page, title = "請求書を送る", body?: string) {
  await page.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  await page.getByRole("combobox", { name: "担当者" }).click();
  await page.getByRole("option", { name: "高本", exact: true }).click();
  await fillDue(page, jstDay(3));
  if (body) await writeBody(page, body);
}
export const gate = () => {
  let release!: () => void;
  const wait = new Promise<void>((r) => (release = r));
  return { wait, open: () => release() };
};
