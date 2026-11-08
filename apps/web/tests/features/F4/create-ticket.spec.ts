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
/** 手で開ける待ち（時間で待たない）。open() するまで、作る口の答えを返さない */
interface Gate {
  wait: Promise<void>;
  open: () => void;
}
const gate = (): Gate => {
  let open = () => undefined as void;
  const wait = new Promise<void>((r) => (open = r));
  return { wait, open };
};
interface Mock {
  creates: Record<string, unknown>[];
  /** 下書きの置き場。鍵は「ワークスペース」（高本）か「ワークスペース~人の id」（同じワークスペースの別の人） */
  drafts: Map<string, Map<string, { body: unknown; saved_at: string }>>;
  draftSaves: Record<string, unknown>[];
  /** 作る口の答えを止めておく（2 回押し・作った後に届く保存を確かめる）。null なら止めない */
  hold: Gate | null;
  /** 次に届いた下書きの保存を 1 本だけ止めておく（作る前に出した保存が、作った後にサーバーで処理される）。止めたら null に戻る */
  holdSave: Gate | null;
  /** 止めて届いた保存の数・処理を終えた数 */
  heldSaves: { arrived: number; done: number };
  /** 作るときに使った下書きの id（本物と同じく、作った後にその id へ保存が来ても残さない） */
  usedDrafts: Set<string>;
  on: {
    create: () => Reply;
    kinds: () => Reply;
    scopes: () => Reply;
    list: () => Reply;
    detail: () => Reply;
    /** 下書きを残す口の答えを差し替える（null ならふつうに残す） */
    saveDraft: () => Reply | null;
  };
}
/** 鍵（Bearer tok-<ワークスペース>[~<人の id>]）から、どのワークスペースの誰か。人の id が無ければ高本（ME） */
const whoOf = (authorization: string | undefined, ws: string) => {
  const t = (authorization ?? "").replace("Bearer tok-", "");
  const [w, member] = t ? t.split("~") : [ws, undefined];
  return { ws: w || ws, member: member || ME, key: member && member !== ME ? `${w}~${member}` : w || ws };
};
const tokenOf = (ws: string, member = ME) => (member === ME ? `tok-${ws}` : `tok-${ws}~${member}`);
async function mockApi(page: Page | BrowserContext, o: { ws?: string; token?: boolean; m?: Mock } = {}): Promise<Mock> {
  const ws = o.ws ?? WS_A;
  const m: Mock = o.m ?? {
    creates: [],
    drafts: new Map(),
    draftSaves: [],
    hold: null,
    holdSave: null,
    heldSaves: { arrived: 0, done: 0 },
    usedDrafts: new Set(),
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
      saveDraft: () => null,
    },
  };
  if (o.token !== false) await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${ws}`);
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    const auth = req.headers()["authorization"];
    const who = whoOf(auth, ws);
    let reply: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    // 本物と同じく、鍵の人のセッションと役を返す（鍵が無ければ入っていない）
    if (p === "/api/auth/get-session")
      reply = auth
        ? {
            status: 200,
            body: {
              session: { id: `s-${who.member}`, userId: who.member, token: "t", expiresAt: "2099-01-01T00:00:00Z" },
              user: { id: who.member, email: `${who.member}@example.com`, name: "人", emailVerified: true },
            },
          }
        : { status: 200, body: null };
    else if (p === "/api/auth-ext/me")
      reply = auth
        ? {
            status: 200,
            body: {
              data: {
                member_id: who.member,
                tenant_id: who.ws,
                display_name: MEMBERS.find((x) => x.id === who.member)?.display_name ?? "人",
                role_id: "staff",
              },
            },
          }
        : { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
    else if (p === "/api/v1/scopes") reply = m.on.scopes();
    else if (p === "/api/v1/ticket_kinds") reply = m.on.kinds();
    else if (p === "/api/v1/members") reply = { status: 200, body: { data: MEMBERS, meta: { limit: 200 } } };
    else if (p === "/api/v1/tickets" && req.method() === "GET") reply = m.on.list();
    else if (p === "/api/v1/tickets" && req.method() === "POST") {
      const b = req.postDataJSON() as Record<string, unknown>;
      m.creates.push(b);
      reply = m.on.create();
      // 本物と同じく、作れたら同じ処理で、このタブの下書きと、続きとして出した元の下書き（source_draft_id）を消す
      if (reply.status === 201) {
        const mine = m.drafts.get(who.key);
        for (const k of ["draft_id", "source_draft_id"])
          if (typeof b[k] === "string") {
            mine?.delete(b[k] as string);
            m.usedDrafts.add(`${who.key}|${b[k] as string}`);
          }
      }
      if (m.hold) await m.hold.wait; // 答えを返すのは試験が開けてから
    } else if (p === `/api/v1/tickets/${ID}`) reply = m.on.detail();
    else if (p === "/api/v1/me/ticket-drafts") {
      const mine = m.drafts.get(who.key) ?? new Map();
      m.drafts.set(who.key, mine);
      const failed = req.method() === "POST" ? m.on.saveDraft() : null;
      if (failed) reply = failed;
      else if (req.method() === "POST") {
        const b = req.postDataJSON() as { draft_id: string; body?: unknown; discard?: boolean };
        const held = m.holdSave;
        if (held) {
          m.holdSave = null;
          m.heldSaves.arrived += 1;
          await held.wait; // サーバーで処理されるのは試験が開けてから（その間に作る）
        }
        m.draftSaves.push({ ...b, by: who.key });
        if (held) m.heldSaves.done += 1;
        if (!b.discard && m.usedDrafts.has(`${who.key}|${b.draft_id}`))
          // 本物と同じく、作るときに使った id の保存は残さず、黙って捨てる（201・body と saved_at が null・K-60.md の H2b）
          reply = { status: 201, body: { data: { draft_id: b.draft_id, body: null, saved_at: null } } };
        else {
          if (b.discard) mine.delete(b.draft_id);
          else mine.set(b.draft_id, { body: b.body ?? {}, saved_at: new Date().toISOString() });
          reply = {
            status: 201,
            body: { data: { draft_id: b.draft_id, body: b.body ?? {}, saved_at: new Date().toISOString() } },
          };
        }
      } else
        reply = {
          status: 200,
          body: {
            data: [...mine.entries()].reverse().map(([draft_id, v]) => ({ draft_id, ...v })),
            meta: { limit: mine.size },
          },
        };
    }
    // 止めていた保存は、答える前に画面が移って要求が取り消されていることがある（サーバーでは処理済み・答える先が無い）
    await route
      .fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) })
      .catch((e: unknown) => {
        if (!/abort|cancel|closed|handled/i.test(String(e))) throw e;
      });
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
/** 続きの下書きを読み終えた（読み終えると種別に既定のタスクが入る）。空であることを確かめる前に待つ */
const loaded = (page: Page) => expect(page.getByRole("combobox", { name: "種別" })).toContainText(/タスク|課題/);
const titleBox = (page: Page) => page.getByRole("textbox", { name: "題名", exact: true });
/** この PC に置いた下書きの写しと、タブの下書きの id（kaname.ticket-draft で始まる鍵） */
const draftCopies = (page: Page) =>
  page.evaluate(() => {
    const out: { store: "local" | "session"; key: string; value: string }[] = [];
    for (const [store, s] of [
      ["local", window.localStorage],
      ["session", window.sessionStorage],
    ] as const)
      for (let i = 0; i < s.length; i++) {
        const key = s.key(i) ?? "";
        if (key.startsWith("kaname.ticket-draft")) out.push({ store, key, value: s.getItem(key) ?? "" });
      }
    return out;
  });

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
  // ログインが切れたら、この PC の写しとタブの下書きの id は消す（共有の PC で次の人に見せない・H1）。続きはサーバーの下書きから出す
  await expect.poll(() => draftCopies(page)).toEqual([]);
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
  const context = page.context();
  const m = await mockApi(context);
  // 前のタブで書きかけを残す（タブは閉じずに置いておく。行の道具が最後にこのタブを撮る）
  await open(page);
  await titleBox(page).fill("前のタブの書きかけ");
  await expect.poll(() => m.drafts.get(WS_A)?.size ?? 0).toBe(1);
  // 新しいタブで開くと、前のタブの書きかけが続きとして出る。書き足して作る
  const tab = await context.newPage();
  await open(tab);
  await expect(titleBox(tab)).toHaveValue("前のタブの書きかけ");
  await fillAll(tab);
  await create(tab).click();
  await expect(tab).toHaveURL(new RegExp(`/tickets/${ID}$`));
  // 続きとして出した元の下書きも、サーバーから消えている
  expect(m.drafts.get(WS_A)?.size ?? 0).toBe(0);
  // 再読み込み・戻る：二重にできない。戻ると作る面は空
  await tab.reload();
  await expect(tab.getByRole("heading", { level: 1, name: "請求書を送る" })).toBeVisible();
  await tab.goBack();
  await expect(form(tab)).toBeVisible();
  await expect(titleBox(tab)).toHaveValue("");
  // 次に（別のタブで）開いても、作る面は空
  const next = await context.newPage();
  await open(next);
  await expect(form(next)).toBeVisible();
  await loaded(next);
  await expect(titleBox(next)).toHaveValue("");
  expect(m.creates).toHaveLength(1);
});

row(R["K60-UI-032"], async (page) => {
  // 共有の PC：A（高本）がログアウトし、同じタブで同じワークスペースの B（山田）が入る。鍵は最初の 1 回だけ A のものを置く
  //   （ログアウトで鍵が消えた後に、開き直しで A の鍵を置き直さない）
  await page.addInitScript((t) => {
    if (window.localStorage.getItem("k60.seeded")) return;
    window.localStorage.setItem("k60.seeded", "1");
    window.localStorage.setItem("kaname.token", t);
  }, tokenOf(WS_A));
  const m = await mockApi(page, { token: false });
  await open(page);
  await loaded(page);
  await titleBox(page).fill("A の書きかけ");
  await page.getByRole("textbox", { name: "目的", exact: true }).fill("A の本文");
  await expect.poll(() => JSON.stringify([...(m.drafts.get(WS_A)?.values() ?? [])])).toContain("A の本文");
  const copyA = (await draftCopies(page)).find((c) => c.store === "local" && c.value.includes("A の本文"));
  expect(copyA, "A の写しがこの PC にある").toBeTruthy();
  // A がログアウトする（鍵が消える）→ ログインへ
  await page.evaluate(() => window.localStorage.removeItem("kaname.token"));
  await page.goto("/tickets?new=1");
  await expect(page).toHaveURL(/\/login\?next=/);
  // 同じタブで B が入る
  await page.evaluate((t) => window.localStorage.setItem("kaname.token", t), tokenOf(WS_A, MATE));
  await open(page);
  await loaded(page);
  await expect(titleBox(page)).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "目的", exact: true })).toHaveValue("");
  // B が書く。B の下書きは B のところにだけ残り、A の中身は混ざらない
  await titleBox(page).fill("B の書きかけ");
  const bKey = `${WS_A}~${MATE}`;
  await expect.poll(() => JSON.stringify([...(m.drafts.get(bKey)?.values() ?? [])])).toContain("B の書きかけ");
  expect(JSON.stringify([...(m.drafts.get(bKey)?.values() ?? [])])).not.toContain("A の");
  await expect(page.getByRole("textbox", { name: "目的", exact: true })).toHaveValue("");
  // A の下書きに B の中身は入らない（A のものは A のまま）
  const a = JSON.stringify([...(m.drafts.get(WS_A)?.values() ?? [])]);
  expect(a).not.toContain("B の");
  // 写しの鍵は本人ごと：B の写しは A の写しと別の鍵で、1 つの写しに 2 人の中身が混ざらない
  const copies = await draftCopies(page);
  const copyB = copies.find((c) => c.store === "local" && c.value.includes("B の書きかけ"));
  expect(copyB, "B の写しがこの PC にある").toBeTruthy();
  expect(copyB!.key).not.toBe(copyA!.key);
  expect(copies.filter((c) => c.value.includes("A の") && c.value.includes("B の"))).toEqual([]);
});

row(R["K60-UI-033"], async (page) => {
  // 作った後に届いた保存は、下書きを残さない（サーバーの下書きが作った後にまた生えない）
  const m = await mockApi(page.context());
  await page.clock.install();
  await open(page);
  await fillAll(page);
  // 時計を止め、1 文字足す（下書きをサーバーに残すのを待っている間に「作る」を押す）
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await page.getByRole("textbox", { name: "実施事項", exact: true }).press("End");
  await page.getByRole("textbox", { name: "実施事項", exact: true }).pressSequentially("。");
  m.hold = gate();
  await create(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  const savesAtCreate = m.draftSaves.length;
  await page.clock.runFor(10_000); // 待っていた保存の時計を進める（作る口はまだ答えていない）
  m.hold.open();
  await page.clock.resume();
  await expect(page).toHaveURL(new RegExp(`/tickets/${ID}$`));
  expect(
    m.draftSaves.slice(savesAtCreate).filter((x) => !x["discard"]),
    "作った後に残す保存は送らない",
  ).toEqual([]);
  expect(m.drafts.get(WS_A)?.size ?? 0).toBe(0);
  // 次に開くと作る面は空
  const next = await page.context().newPage();
  await open(next);
  await loaded(next);
  await expect(titleBox(next)).toHaveValue("");
});

row(R["K60-UI-034"], async (page) => {
  // 下書きをサーバーに残せなかったら知らせる（何が起きたか・書いたものは消えないこと・D-128.62）。残せたら消える
  const m = await mockApi(page);
  let fail = true;
  m.on.saveDraft = () => (fail ? { status: 500, body: { error: "internal", code: null } } : null);
  await open(page);
  await loaded(page);
  await titleBox(page).fill("残せない題名");
  const notice = page.getByText(/下書きをサーバーに残せませんでした/);
  await expect(notice).toBeVisible();
  await expect(page.getByText(/書いたものは.*残っています/).first()).toBeVisible();
  await expect(titleBox(page)).toHaveValue("残せない題名");
  fail = false;
  await titleBox(page).fill("残せる題名");
  await expect.poll(() => JSON.stringify([...(m.drafts.get(WS_A)?.values() ?? [])])).toContain("残せる題名");
  await expect(notice).toHaveCount(0);
});

row(R["K60-UI-035"], async (page) => {
  // この PC の写しが壊れていても（読めない JSON・形の違う中身）、作る面は開いて書ける
  const m = await mockApi(page);
  await open(page);
  await loaded(page);
  await titleBox(page).fill("写しを作る");
  await expect.poll(async () => (await draftCopies(page)).filter((c) => c.store === "local").length).toBeGreaterThan(0);
  m.drafts.clear(); // サーバーには無く、写しだけがある
  for (const bad of ["{壊れた", JSON.stringify({ id: 1, body: "文字" }), "null"]) {
    await page.evaluate((v) => {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i) ?? "";
        if (k.startsWith("kaname.ticket-draft")) window.localStorage.setItem(k, v);
      }
    }, bad);
    await page.reload();
    await expect(form(page), bad).toBeVisible();
    await loaded(page);
    await titleBox(page).fill(`壊れた写しの後 ${bad.length}`);
    await expect(titleBox(page)).toHaveValue(`壊れた写しの後 ${bad.length}`);
  }
});

row(R["K60-UI-038"], async (page) => {
  // 作る前に送った保存が、作った後にサーバーで処理される：次に開いた作る面は空（作るときに使った id の保存は残らない）
  const m = await mockApi(page.context());
  await open(page);
  await loaded(page);
  m.holdSave = gate();
  const held = m.holdSave;
  await titleBox(page).fill("作る前に送った保存");
  await expect.poll(() => m.heldSaves.arrived).toBe(1); // 保存が 1 本、サーバーの手前で止まっている
  await fillAll(page);
  await create(page).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${ID}$`));
  held.open(); // 作った後に、止めていた保存をサーバーで処理する
  await expect.poll(() => m.heldSaves.done).toBe(1);
  expect(m.drafts.get(WS_A)?.size ?? 0).toBe(0);
  const next = await page.context().newPage();
  await open(next);
  await loaded(next);
  await expect(titleBox(next)).toHaveValue("");
});

row(R["K60-UI-039"], async (page) => {
  // 下書きを残す口が 429・500・通信の失敗（fetch が例外）・答えない、のどれでも「作る」でチケットはできる（下書きは作るのを止めない・D-128.62）。
  //   作る口の答えを止めている間に「残せなかった」と知らせ、開けたら詳細へ移る（作る口は 1 回）
  for (const how of ["429", "500", "network", "hang"] as const) {
    const ctx = await page.context().browser()!.newContext();
    try {
      const tab = await ctx.newPage();
      const m = await mockApi(tab);
      if (how === "429")
        m.on.saveDraft = () => ({
          status: 429,
          body: { error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 60 },
        });
      if (how === "500") m.on.saveDraft = () => ({ status: 500, body: { error: "internal", code: null } });
      if (how === "network")
        await tab.route(/\/api\/v1\/me\/ticket-drafts$/, (route) =>
          route.request().method() === "POST" ? route.abort("failed") : route.fallback(),
        );
      if (how === "hang") {
        // 答えない。作る前の保存を待つのは 5 秒まで（時計を進めて確かめる・実際の時間では待たない）
        await tab.clock.install();
        await tab.route(/\/api\/v1\/me\/ticket-drafts$/, (route) =>
          route.request().method() === "POST" ? new Promise<void>(() => undefined) : route.fallback(),
        );
      }
      await open(tab);
      await loaded(tab);
      await fillAll(tab);
      m.hold = gate();
      await create(tab).click();
      if (how === "hang") await tab.clock.runFor(5_000);
      await expect.poll(() => m.creates.length, how).toBe(1);
      await expect(tab.getByText(/下書きをサーバーに残せませんでした/).first(), how).toBeVisible();
      m.hold.open();
      await expect(tab, how).toHaveURL(new RegExp(`/tickets/${ID}$`));
      expect(m.creates, how).toHaveLength(1);
    } finally {
      await ctx.close();
    }
  }
});

row(R["K60-UI-040"], async (page) => {
  // 続きの下書きの一覧の答えを止める（手で開ける・時間で待たない）
  const m = await mockApi(page);
  const slow = gate();
  await page.route(/\/api\/v1\/me\/ticket-drafts$/, async (route) => {
    if (route.request().method() === "GET") await slow.wait;
    await route.fallback();
  });
  await open(page);
  await expect(page.getByText("書きかけを読み込んでいます…")).toBeVisible();
  await expect(titleBox(page), "読み終えるまで欄を出さない").toHaveCount(0);
  slow.open();
  await loaded(page);
  await fillAll(page, { title: "読み終えた後に書いた題名" });
  await expect(titleBox(page)).toHaveValue("読み終えた後に書いた題名");
  await create(page).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${ID}$`));
  expect(m.creates[0]).toMatchObject({
    title: "読み終えた後に書いた題名",
    assignee_member_id: MATE,
    due_on: jst(3),
  });
});

row(R["K60-UI-041"], async (page) => {
  // 下書きの一覧の口が通信の失敗で落ちても、この PC の写し（本人の鍵）があれば、それを出して作る面が開く（D-128.62）
  const m = await mockApi(page);
  await open(page);
  await loaded(page);
  await titleBox(page).fill("写しにある題名");
  await page.getByRole("textbox", { name: "目的", exact: true }).fill("写しにある本文");
  await expect
    .poll(async () => (await draftCopies(page)).some((c) => c.store === "local" && c.value.includes("写しにある本文")))
    .toBe(true);
  m.drafts.clear(); // サーバーの分では出せないようにする
  await page.route(/\/api\/v1\/me\/ticket-drafts$/, (route) =>
    route.request().method() === "GET" ? route.abort("failed") : route.fallback(),
  );
  await page.reload();
  await expect(form(page)).toBeVisible();
  await loaded(page);
  await expect(titleBox(page)).toHaveValue("写しにある題名");
  await expect(page.getByRole("textbox", { name: "目的", exact: true })).toHaveValue("写しにある本文");
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
  m.hold = gate(); // 1 回目の答えを返す前に 2 回目を押す
  await create(page).dblclick();
  await expect.poll(() => m.creates.length).toBe(1);
  await expect(create(page)).toBeDisabled();
  m.hold.open();
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

// K-144（D-129.42）：入口は正式な uuid でない道の値に 422 を返す。画面は入口と同じ基準で先に確かめ、口を呼ばずに「見つからない」にする
row(R["K144-UI-001"], async (page) => {
  await mockApi(page);
  const asked: string[] = [];
  // 本物の入口と同じく、詳細の口は uuid でない道の値に 422（この差し替えが先に効く）
  await page.route(/\/api\/v1\/tickets\/[^/?]+$/, (route) => {
    asked.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        error: "validation_failed",
        code: "VALIDATION_ERROR",
        details: [{ field: "id", message: "uuid" }],
      }),
    });
  });
  for (const bad of ["3fa85f64-5717-0562-b3fc-2c963f66afa6", "------------------------------------", "not-a-uuid"]) {
    await page.goto(`/tickets/${bad}`);
    const err = page.locator('[data-state="error"]');
    await expect(err, bad).toHaveAttribute("data-code", "E-PAGE-001");
    await expect(err.getByText("見つかりませんでした", { exact: false }), bad).toBeVisible();
  }
  expect(asked, "uuid でない道の値で詳細の口を呼んだ").toEqual([]);
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
