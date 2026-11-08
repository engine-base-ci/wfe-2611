// K-63「承認して完了する」の画面の試験（実 Chrome）：/approvals の承認待ちと、/tickets/[id] の承認の帯・完了の小窓・本人確認の小窓。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/approve-complete.md）＝試験 1 本。名前の頭の行 ID で op_gate.py が証拠を引く。
//   口（API）は網の手前（page.route）で差し替える。口の振る舞いそのものは apps/api/test/features/F5/approve-complete.test.ts が本物の DB で持つ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   口の形（K-63.md の「答えの形」）：
//     GET  /api/v1/approvals/queue       → { data: [承認待ちの行], meta: { limit, counts: { total } } }
//     GET  /api/v1/approvals/:id         → { data: { approval, ticket, artifact_version, checks, check_summary, cautions, irreversible, can_decide } }
//     POST /api/v1/approvals/:id/approve ← {}（頭 idempotency-key）・POST …/return ← { note }
//     GET  /api/v1/tickets/:id           → K-60 の詳細 ＋ approval（{ id, can_decide, irreversible, note, approver_name }|null）・run（{ phase, status, pc: "live"|"asleep", stopped_reason }|null）・can.complete（K-62 の can に足す）・stage.key
//     POST /api/v1/tickets/:id/complete  ← { todo_checked, todo_version, conditions_confirmed }
//     承認では本人確認を取り直さない（D-128.177）：本人確認の小窓は出さず、stepUp の口も呼ばない
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Page, Request, Route } from "@playwright/test";
import { expect, row, rowsOf, type SpecRow } from "../../_lib/row";
import { WIDTHS } from "../../_lib/api";

const SPEC = join(dirname(fileURLToPath(import.meta.url)), "../../../../../07_qa/test-specs/k/approve-complete.md");
const ROWS = rowsOf(SPEC);
const R = Object.fromEntries(ROWS.map((r) => [r.id, r]));
const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const TICKET = "0193c5a0-0000-7000-8000-00000000c063";
const CHILD = "0193c5a0-0000-7000-8000-00000000c064";
const TICKET_B = "0193c5a0-0000-7000-8000-00000000c065"; // 承認待ちの行ごとに別のチケット（題名のリンクの行き先を見分ける）
const TICKET_C = "0193c5a0-0000-7000-8000-00000000c066";
const A_INLINE = "0193c5a0-0000-7000-8000-0000000a0001";
const A_OPEN = "0193c5a0-0000-7000-8000-0000000a0002";
const A_NODUE = "0193c5a0-0000-7000-8000-0000000a0003";
const ME = "11111111-0000-4000-8000-000000000001";
const MAKER = "11111111-0000-4000-8000-000000000002";
const MSG = {
  checkNone: "検査なし（まだ流していません）",
  reasonEmpty: "差し戻す理由を書いてください",
  reasonLong: "差し戻す理由は 2000 文字までにしてください",
  decided: "この承認はもう処理されています",
  gone: "見つかりませんでした。消されたか、見る権限が無いかもしれません",
  waitingMe: "あなたの承認を待っています",
  waitingOther: "高本さんの承認を待っています",
  k62Waiting: "成果物ができました。承認待ちです", // K-62 の帯（承認する人でない人だけに出す・D-128.178）
  pcClosed: "実行待ち・PC が閉じています。開いたらすぐ実行します。承認から 24 時間を過ぎたら、もう一度聞きます",
  completeHint: "完了の条件を確かめて完了にしてください",
  todoLeft: "実施事項がまだ残っています",
  children: "終わっていない子のチケットがあります",
  stage: "承認待ち・実行中・確認中のチケットは完了にできません",
  note24h: "承認から 24 時間を過ぎたので、実行の前にもう一度確かめてください",
  inFlight: "「メールを送る」は途中だったので、その結末は分かりません。先方の画面で確かめてください",
};
const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const ARTIFACT = "株式会社サンプル 御中\n11 月分の請求書をお送りします。";

type Reply = { status: number; body: unknown };
type Handler = (req: Request) => Reply | Promise<Reply>;
const qrow = (id: string, o: Record<string, unknown> = {}) => ({
  kind: "artifact",
  id,
  ticket_id: TICKET,
  ticket_number: "EG-133",
  title: "11 月分の請求書を送る",
  from_member_id: MAKER,
  from_name: "山田",
  check_summary: MSG.checkNone,
  due_on: jst(0),
  decide_inline: false,
  irreversible: true,
  primary_action: "open",
  secondary_action: "return",
  note: null,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  ...o,
});
const QUEUE = () => [
  qrow(A_INLINE, {
    due_on: jst(-1),
    decide_inline: true,
    irreversible: false,
    primary_action: "approve",
    title: "見積を出す",
    ticket_id: TICKET_B,
  }),
  qrow(A_OPEN, { due_on: jst(0) }),
  qrow(A_NODUE, { due_on: null, title: "応募文を出す", ticket_number: "EG-140", ticket_id: TICKET_C }),
];
const detailOf = (id: string, o: Record<string, unknown> = {}) => ({
  approval: {
    id,
    kind: "artifact",
    status_id: "pending",
    decision: null,
    decided_at: null,
    irreversible: true,
    note: null,
    approver_member_id: ME,
    approver_name: "高本",
    created_at: new Date().toISOString(),
  },
  ticket: { id: TICKET, number: "EG-133", title: "11 月分の請求書を送る", stage_key: "awaiting_approval" },
  artifact_version: { version: 1, text: ARTIFACT },
  checks: [],
  check_summary: MSG.checkNone,
  cautions: ["取り消せません"],
  irreversible: true,
  can_decide: true,
  chain: [],
  ...o,
});
type Band = {
  stage: string;
  approval?: Record<string, unknown> | null;
  run?: Record<string, unknown> | null;
  can_complete?: boolean;
  can_delegate?: boolean;
  todo?: string;
  completed?: { at: string; by: string } | null;
};
const BANDS = new WeakMap<object, Band>();
/** getTicket の答えに、その答えのときの今の実行（runs・action_runs で返す）を結ぶ。答えの JSON には入れない */
const withBand = <T extends object>(b: Band, d: T): T => {
  BANDS.set(d, b);
  return d;
};
const ticketOf = (b: Band) =>
  withBand(b, {
    ticket: {
      id: TICKET,
      number: "EG-133",
      title: "11 月分の請求書を送る",
      due_on: jst(3),
      start_on: null,
      priority: "mid",
    },
    sections: [
      { key: "purpose", label: "目的", body: { text: "月末の請求を出す" }, version: 1 },
      { key: "done", label: "完了の条件", body: { text: "先方が請求書を受け取った" }, version: 1 },
      { key: "todo", label: "実施事項", body: { text: b.todo ?? "- 請求書を作る\n- 先方に送る" }, version: 4 },
    ],
    kind: { name: "タスク" },
    stage: { name: b.stage, key: b.stage },
    assignee: { display_name: "高本" },
    approval: b.approval ?? null,
    can: { delegate: b.can_delegate ?? false, complete: b.can_complete ?? false },
    completed: b.completed ?? null,
  });
const pending = (o: Record<string, unknown> = {}) => ({
  id: A_OPEN,
  can_decide: true,
  irreversible: true,
  note: null,
  approver_name: "高本",
  ...o,
});

interface Mock {
  approves: { id: string; body: unknown; key: string | undefined }[];
  returns: { id: string; body: Record<string, unknown> }[];
  completes: Record<string, unknown>[];
  stepUps: Record<string, unknown>[];
  queueReads: number;
  /** 書く口（承認・完了）の答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
  hold: () => () => void;
  gate: Promise<void>;
  on: {
    queue: Handler;
    detail: Handler;
    approve: Handler;
    ret: Handler;
    ticket: Handler;
    complete: Handler;
    stepUp: Handler;
  };
}
/** 今の実行は K-62 の listTicketRuns・getActionRun（ActionRunView）で読む。getTicket に run は無い */
const RUN_ID = "0193c5a0-0000-7000-8000-0000000e0001";
const runView = (b: Band) =>
  b.run
    ? {
        id: RUN_ID,
        ticket_id: TICKET,
        phase: b.run["phase"],
        status: b.run["status"],
        by: { display_name: "山田" },
        pc: b.run["pc"] ?? "live",
        silent: false,
        progress: null,
        stopped_reason: b.run["stopped_reason"] ?? null,
        started_at: new Date().toISOString(),
        finished_at: null,
        checks: { state: "none" },
      }
    : null;
const runsReply = (b: Band): Reply => {
  const v = runView(b);
  return { status: 200, body: { data: v ? [v] : [], meta: { limit: 50 } } };
};
async function mockApi(page: Page, band: Band = { stage: "awaiting_approval", approval: pending() }): Promise<Mock> {
  const m: Mock = {
    approves: [],
    returns: [],
    completes: [],
    stepUps: [],
    queueReads: 0,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      m.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      queue: () => {
        const rows = QUEUE();
        return { status: 200, body: { data: rows, meta: { limit: 50, counts: { total: rows.length } } } };
      },
      detail: (req) => ({ status: 200, body: { data: detailOf(new URL(req.url()).pathname.split("/").at(-1)!) } }),
      approve: (req) => ({
        status: 201,
        body: {
          data: {
            id: new URL(req.url()).pathname.split("/").at(-2),
            decision: "approve",
            decided_at: new Date().toISOString(),
            status_id: "approved",
            ticket_id: TICKET,
            run_id: "0193c5a0-0000-7000-8000-0000000e0001",
            pc: "live",
          },
        },
      }),
      ret: (req) => ({
        status: 201,
        body: {
          data: {
            id: new URL(req.url()).pathname.split("/").at(-2),
            decision: "return",
            decided_at: new Date().toISOString(),
            status_id: "returned",
            ticket_id: TICKET,
            run_id: "0193c5a0-0000-7000-8000-0000000e0002",
            pc: "live",
          },
        },
      }),
      ticket: () => ({ status: 200, body: { data: ticketOf(band) } }),
      complete: () => ({
        status: 201,
        body: {
          data: {
            ticket: {
              id: TICKET,
              number: "EG-133",
              stage_key: "done",
              completed_at: new Date().toISOString(),
              completed_by: ME,
            },
            knowledge_candidates: [],
            skipped_reason: "候補はまだ出していません",
          },
        },
      }),
      stepUp: () => ({ status: 201, body: { data: { step_up_at: new Date().toISOString() } } }),
    },
  };
  /** 今の getTicket の答えに結んだ実行（試験が m.on.ticket を差し替えれば、実行も一緒に替わる） */
  const bandNow = async (req: Request): Promise<Band> => {
    const r = await m.on.ticket(req);
    return BANDS.get((r.body as { data: object }).data) ?? { stage: "doing" };
  };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), "tok-k63");
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const post = req.method() === "POST";
    let reply: Reply;
    if (p === "/api/v1/approvals/queue") {
      m.queueReads++;
      reply = await m.on.queue(req);
    } else if (post && /^\/api\/v1\/approvals\/[^/]+\/approve$/.test(p)) {
      m.approves.push({ id: p.split("/").at(-2)!, body: req.postDataJSON(), key: req.headers()["idempotency-key"] });
      await m.gate; // 試験が hold() で止めている間は答えない（2 回押しを確かめる）
      reply = await m.on.approve(req);
    } else if (post && /^\/api\/v1\/approvals\/[^/]+\/return$/.test(p)) {
      m.returns.push({ id: p.split("/").at(-2)!, body: req.postDataJSON() as Record<string, unknown> });
      reply = await m.on.ret(req);
    } else if (/^\/api\/v1\/approvals\/[^/]+$/.test(p)) reply = await m.on.detail(req);
    else if (post && p === `/api/v1/tickets/${TICKET}/complete`) {
      m.completes.push(req.postDataJSON() as Record<string, unknown>);
      await m.gate;
      reply = await m.on.complete(req);
    } else if (p === `/api/v1/tickets/${TICKET}/runs`) reply = runsReply(await bandNow(req));
    else if (/^\/api\/v1\/action_runs\/[^/]+$/.test(p)) {
      const v = runView(await bandNow(req));
      reply = v ? { status: 200, body: { data: v } } : { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    } else if (p === `/api/v1/tickets/${TICKET}`) reply = await m.on.ticket(req);
    else if (post && p === "/api/v1/auth/step-up") {
      m.stepUps.push(req.postDataJSON() as Record<string, unknown>);
      reply = await m.on.stepUp(req);
    } else if (/\/me$/.test(p))
      reply = { status: 200, body: { data: { id: ME, display_name: "高本", roles: ["member"], name: "高本" } } };
    else reply = { status: 200, body: { data: [], meta: { limit: 50 } } };
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return m;
}

const CONTROL =
  /^\s*- (button|link|tab|radio|textbox|searchbox|combobox|checkbox|switch|menuitem|option|slider|spinbutton) "((?:[^"\\]|\\.)*)"/;
/** 本体（main と開いている小窓）の操作要素のうち、仕様に行の無いもの。外枠のメニューは K-60 の仕様が持つ */
async function missingInMain(page: Page, rows: SpecRow[], extra: SpecRow[] = []): Promise<string[]> {
  const have = new Set([...rows, ...extra].map((r) => `${r.role}|${r.name}`));
  const out = new Set<string>();
  for (const sel of ["main", "[role=dialog]"]) {
    const loc = page.locator(sel);
    for (let i = 0; i < (await loc.count()); i++) {
      for (const ln of (await loc.nth(i).ariaSnapshot()).split("\n")) {
        const c = CONTROL.exec(ln);
        if (c && !have.has(`${c[1]}|${c[2]!.replace(/\\"/g, '"')}`)) out.add(`（${c[1]}）「${c[2]}」`);
      }
    }
  }
  return [...out];
}
/** 左のメニューの「承認待ち」の数。外枠は K-60 の前の外枠（D-128.151・lib/nav.legacy）で、承認待ちは「仕事」のまとまりの中（閉じている）。
 *  まとまりを開いてから、その中の「承認待ち」のリンクの数を見る。左のメニューが出る幅（1440）だけで見る（狭い幅の下のタブは前の外枠の並び） */
const menuCount = async (page: Page, n: number) => {
  const group = page.getByRole("button", { name: /^仕事/ });
  if ((await group.getAttribute("aria-expanded")) === "false") await group.click();
  await expect(page.getByRole("link", { name: new RegExp(`承認待ち\\s*${n}`) })).toBeVisible();
};
const openQueue = async (page: Page, width = 1440) => {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto("/approvals");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /承認待ち/ })).toBeVisible();
};
const openTicket = async (page: Page, width = 1440) => {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(`/tickets/${TICKET}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /11 月分の請求書を送る/ })).toBeVisible();
};
const rowOf = (page: Page, title: string) => page.getByRole("row").filter({ hasText: title });
const dialog = (page: Page) => page.getByRole("dialog");
/** K-63 の帯（承認待ち・実行待ち・実行中・止まった・作業中・完了のどの状態でも同じ名前の region）。段の名札（K-60 の Badge）と取り違えないよう、帯の中だけで探す */
const BAND = "承認と実行";
const bandOf = (page: Page) => page.getByRole("region", { name: BAND });
/** K-62 の帯（phase make の間だけ出す。承認の後の実行の間は出さない・D-128.178） */
const k62Band = (page: Page) => page.getByRole("region", { name: "AI に任せる" });
const reasonBox = (page: Page) => page.getByRole("textbox", { name: "差し戻す理由" });
const reasonOf = async (page: Page) => {
  const ids = (await reasonBox(page).getAttribute("aria-describedby")) ?? "";
  const texts = await Promise.all(
    ids
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => page.locator(`[id="${id}"]`).innerText()),
  );
  return texts.join(" ");
};
const noOverflow = async (page: Page, w: number) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, `幅 ${w} の横溢れ`).toBe(0);
};

// ---- 承認待ち（/approvals）----
row(R["K63-UI-000"], async (page) => {
  await mockApi(page);
  await openQueue(page);
  await rowOf(page, "請求書").getByRole("button", { name: "差し戻す" }).click();
  await expect(dialog(page)).toBeVisible();
  expect(await missingInMain(page, ROWS)).toEqual([]);
});
row(R["K63-UI-001"], async (page) => {
  await mockApi(page);
  for (const w of WIDTHS) {
    await openQueue(page, w);
    const order = await page
      .getByRole("main")
      .getByText(/^(期限切れ|今日|7 日以内|それより後|期限なし)$/)
      .allInnerTexts(); // 外枠の「今日」（左のメニュー・下タブ）に当てない
    expect(order).toEqual(["期限切れ", "今日", "期限なし"]);
    await expect(page.getByRole("main").getByText("3 件", { exact: true })).toBeVisible();
    if (w >= 1440) await menuCount(page, 3);
    await noOverflow(page, w);
  }
});
row(R["K63-UI-002"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  const after = QUEUE().filter((x) => x.id !== A_INLINE);
  m.on.queue = () => ({ status: 200, body: { data: after, meta: { limit: 50, counts: { total: 2 } } } });
  await rowOf(page, "見積を出す").getByRole("button", { name: "承認する", exact: true }).click();
  await expect(rowOf(page, "見積を出す")).toHaveCount(0);
  expect(m.approves).toHaveLength(1);
  expect(m.approves[0]).toMatchObject({ id: A_INLINE, body: {} });
  expect(m.approves[0]!.key).toBeTruthy();
  await menuCount(page, 2);
});
row(R["K63-UI-003"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  const r = rowOf(page, "11 月分の請求書を送る");
  await expect(r.getByRole("button", { name: "承認する", exact: true })).toHaveCount(0);
  await r.getByRole("link", { name: "中身を見る" }).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET}$`));
  expect(m.approves).toHaveLength(0);
});
const openReturn = async (page: Page, title = "11 月分の請求書を送る") => {
  await rowOf(page, title).getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
};
row(R["K63-UI-004"], async (page) => {
  await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await expect(reasonBox(page)).toBeEditable();
});
row(R["K63-UI-005"], async (page) => {
  await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await reasonBox(page).fill("宛名を直してください\n日付も今日に");
  await expect(reasonBox(page)).toHaveValue("宛名を直してください\n日付も今日に");
});
row(R["K63-UI-006"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  m.on.queue = () => ({
    status: 200,
    body: { data: QUEUE().filter((x) => x.id !== A_OPEN), meta: { limit: 50, counts: { total: 2 } } },
  });
  await openReturn(page);
  await reasonBox(page).fill("宛名を直してください");
  await page.getByRole("button", { name: "差し戻して作り直させる" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.returns).toEqual([{ id: A_OPEN, body: { note: "宛名を直してください" } }]);
  await expect(rowOf(page, "11 月分の請求書を送る")).toHaveCount(0);
});
row(R["K63-UI-007"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  for (const v of ["", "　　"]) {
    await reasonBox(page).fill(v);
    await page.getByRole("button", { name: "差し戻して作り直させる" }).click();
    await expect.poll(() => reasonOf(page)).toContain(MSG.reasonEmpty);
  }
  expect(m.returns).toHaveLength(0);
  await expect(dialog(page)).toBeVisible();
});
row(R["K63-UI-008"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await reasonBox(page).fill("あ".repeat(2001));
  await page.getByRole("button", { name: "差し戻して作り直させる" }).click();
  await expect.poll(() => reasonOf(page)).toContain(MSG.reasonLong);
  expect(m.returns).toHaveLength(0);
});
row(R["K63-UI-009"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await reasonBox(page).fill("やっぱりやめる");
  await page.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.returns).toHaveLength(0);
  await expect(rowOf(page, "11 月分の請求書を送る")).toHaveCount(1);
});
row(R["K63-UI-010"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  await openReturn(page);
  await reasonBox(page).fill("書きかけの理由");
  await page.getByRole("button", { name: "やめる", exact: true }).click();
  await openReturn(page);
  await expect(reasonBox(page)).toHaveValue("書きかけの理由");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: /承認待ち/ })).toBeVisible();
  await openReturn(page);
  await expect(reasonBox(page)).toHaveValue("書きかけの理由");
  await page.getByRole("button", { name: "差し戻して作り直させる" }).click();
  await expect.poll(() => m.returns.length).toBe(1);
  await openReturn(page);
  await expect(reasonBox(page)).toHaveValue("");
});
row(R["K63-UI-011"], async (page) => {
  const m = await mockApi(page);
  m.on.queue = () => ({ status: 200, body: { data: [], meta: { limit: 50, counts: { total: 0 } } } });
  await openQueue(page);
  await expect(page.getByText("いま決めるものはありません")).toBeVisible();
  const group = page.getByRole("button", { name: /^仕事/ });
  if ((await group.getAttribute("aria-expanded")) === "false") await group.click();
  await expect(page.getByRole("link", { name: /^承認待ち$/ })).toBeVisible(); // 数は出さない（0 件）
});
row(R["K63-UI-012"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  m.on.approve = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  const before = m.queueReads;
  m.on.queue = () => ({
    status: 200,
    body: { data: QUEUE().filter((x) => x.id !== A_INLINE), meta: { limit: 50, counts: { total: 2 } } },
  });
  await rowOf(page, "見積を出す").getByRole("button", { name: "承認する", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: MSG.decided })).toBeVisible();
  await expect.poll(() => m.queueReads).toBeGreaterThan(before);
  await expect(rowOf(page, "見積を出す")).toHaveCount(0);
});
row(R["K63-UI-013"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  const b = rowOf(page, "見積を出す").getByRole("button", { name: "承認する", exact: true });
  const release = m.hold();
  await b.click();
  await expect.poll(() => m.approves.length).toBe(1);
  await expect(b).toBeDisabled(); // 答えの前は押せない
  await b.dispatchEvent("click"); // 押せない間に押しても口は呼ばない
  release();
  await expect(rowOf(page, "見積を出す")).toHaveCount(0);
  expect(m.approves).toHaveLength(1);
});
row(R["K63-UI-014"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  m.on.approve = () => ({ status: 404, body: { error: "not_found", code: "E-PAGE-001", message: MSG.gone } });
  m.on.queue = () => ({
    status: 200,
    body: { data: QUEUE().filter((x) => x.id !== A_INLINE), meta: { limit: 50, counts: { total: 2 } } },
  });
  await rowOf(page, "見積を出す").getByRole("button", { name: "承認する", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: MSG.gone })).toBeVisible();
  await expect(rowOf(page, "見積を出す")).toHaveCount(0);
});
row(R["K63-UI-015"], async (page) => {
  const m = await mockApi(page);
  m.on.queue = () => ({
    status: 200,
    body: {
      data: [qrow(A_OPEN, { title: '<img src=x onerror="window.__k63=1">請求書' })],
      meta: { limit: 50, counts: { total: 1 } },
    },
  });
  await openQueue(page);
  await expect(page.getByText('<img src=x onerror="window.__k63=1">請求書')).toBeVisible();
  await openReturn(page, "請求書");
  const note = "<script>window.__k63=2</script>宛名を直して";
  await reasonBox(page).fill(note);
  await page.getByRole("button", { name: "差し戻して作り直させる" }).click();
  await expect.poll(() => m.returns.length).toBe(1);
  expect(m.returns[0]!.body).toEqual({ note });
  expect(await page.evaluate(() => (window as unknown as { __k63?: number }).__k63)).toBeUndefined();
});
row(R["K63-UI-016"], async (page) => {
  await mockApi(page);
  await openQueue(page);
  const r = rowOf(page, "11 月分の請求書を送る");
  await expect(r).toContainText(MSG.checkNone);
  await expect(r).toContainText("山田のAI");
});

// ---- チケットの詳細の帯（/tickets/[id]）----
const executedBand: Band = {
  stage: "doing",
  run: { phase: "execute", status: "done", pc: "live", stopped_reason: null },
  can_complete: true,
};
row(R["K63-UI-020"], async (page) => {
  await mockApi(page);
  await openTicket(page);
  const banded = await missingInMain(page, ROWS);
  const page2 = await page.context().newPage();
  await mockApi(page2, executedBand);
  await openTicket(page2);
  await page2.getByRole("button", { name: "完了にする", exact: true }).click();
  await expect(dialog(page2)).toBeVisible();
  const completing = await missingInMain(page2, ROWS);
  // K-60 の詳細の操作要素（チケットへ戻る など）は K-60 の表の行
  const k60 = rowsOf(
    join(dirname(fileURLToPath(import.meta.url)), "../../../../../07_qa/test-specs/k/create-ticket.md"),
  );
  const have = new Set(k60.map((r) => `（${r.role}）「${r.name}」`));
  expect([...banded, ...completing].filter((x) => !have.has(x))).toEqual([]);
});
row(R["K63-UI-021"], async (page) => {
  const m = await mockApi(page);
  await openTicket(page);
  const band = bandOf(page);
  await expect(band).toContainText(MSG.waitingMe);
  await expect(band.getByRole("button", { name: "承認して送る" })).toBeVisible();
  await expect(band.getByRole("button", { name: "差し戻す" })).toBeVisible();
  await expect(band).toContainText("11 月分の請求書をお送りします。");
  await expect(band).toContainText(MSG.checkNone);
  await expect(band).toContainText("取り消せません");
  // 帯は題名のすぐ下
  const h = await page.getByRole("heading", { level: 1 }).boundingBox();
  const b = await band.boundingBox();
  expect(b!.y).toBeGreaterThan(h!.y);
  expect(b!.y - (h!.y + h!.height)).toBeLessThan(80);
  // 決められない人：ボタンなし
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "awaiting_approval", approval: pending({ can_decide: false }) }) },
  });
  await page.reload();
  await expect(page.getByText(MSG.k62Waiting)).toBeVisible();
  await expect(page.getByText(MSG.waitingOther)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "差し戻す" })).toHaveCount(0);
  // 承認待ちが無い：帯なし
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf({ stage: "doing", approval: null }) } });
  await page.reload();
  await expect(page.getByText(MSG.waitingMe)).toHaveCount(0);
  await expect(page.getByText(MSG.waitingOther)).toHaveCount(0);
});
row(R["K63-UI-022"], async (page) => {
  const m = await mockApi(page);
  await openTicket(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "running", pc: "live" } }) },
  });
  await bandOf(page).getByRole("button", { name: "承認して送る" }).click();
  await expect.poll(() => m.approves.length).toBe(1);
  expect(m.approves[0]).toMatchObject({ id: A_OPEN, body: {} });
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  expect(m.stepUps).toHaveLength(0); // 本人確認を取り直さない（D-128.177）
  await expect(dialog(page)).toHaveCount(0);
});
row(R["K63-UI-024"], async (page) => {
  const m = await mockApi(page);
  await openTicket(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "make", status: "queued", pc: "live" } }) },
  });
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  await reasonBox(page).fill("宛名を直してください");
  await page.getByRole("button", { name: "差し戻して作り直させる" }).click();
  await expect.poll(() => m.returns.length).toBe(1);
  expect(m.returns[0]).toEqual({ id: A_OPEN, body: { note: "宛名を直してください" } });
  await expect(dialog(page)).toHaveCount(0);
  await expect(bandOf(page)).toHaveCount(0); // 作り直し（phase make）の間は K-63 の帯を出さない（K-62 の帯だけ・D-128.178）
});
row(R["K63-UI-025"], async (page) => {
  await mockApi(page, { stage: "running", run: { phase: "execute", status: "queued", pc: "asleep" } });
  await openTicket(page);
  await expect(bandOf(page).getByText(MSG.pcClosed)).toBeVisible();
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  await expect(k62Band(page)).toHaveCount(0); // 承認の後の実行の間、K-62 の帯は出さない（D-128.178）
  await expect(page.getByText(/のAI が作っています|PC が起きるのを待っています/)).toHaveCount(0);
});
row(R["K63-UI-026"], async (page) => {
  const m = await mockApi(page, { stage: "running", run: { phase: "execute", status: "running", pc: "live" } });
  await page.clock.install(); // 3 秒ごとの読み直しは、時計を進めて起こす（待ち時間に頼らない）
  await openTicket(page);
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf(executedBand) } });
  await page.clock.fastForward(3_000);
  await expect(bandOf(page).getByText(MSG.completeHint)).toBeVisible();
  await expect(k62Band(page)).toHaveCount(0); // 承認の後の実行の間、K-62 の帯は出さない（D-128.178）
  await expect(page.getByText(/のAI が作っています|PC が起きるのを待っています/)).toHaveCount(0);
});
const openComplete = async (page: Page) => {
  await page.getByRole("button", { name: "完了にする", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
};
const confirmBox = (page: Page) => page.getByRole("checkbox", { name: "完了の条件を満たしたことを確かめました" });
row(R["K63-UI-027"], async (page) => {
  await mockApi(page, executedBand);
  await openTicket(page);
  await expect(bandOf(page).getByText(MSG.completeHint)).toBeVisible();
  await openComplete(page);
  await expect(dialog(page)).toContainText("請求書を作る");
  await expect(dialog(page)).toContainText("先方が請求書を受け取った");
});
row(R["K63-UI-028"], async (page) => {
  const m = await mockApi(page, executedBand);
  await openTicket(page);
  await openComplete(page);
  await page.getByRole("checkbox", { name: "請求書を作る" }).check();
  await page.getByRole("checkbox", { name: "先方に送る" }).check();
  await confirmBox(page).check();
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "done", completed: { at: new Date().toISOString(), by: "高本" } }) },
  });
  await page.getByRole("button", { name: "確かめて完了にする" }).click();
  await expect.poll(() => m.completes.length).toBe(1);
  expect(m.completes[0]).toEqual({ todo_checked: [0, 1], todo_version: 4, conditions_confirmed: true });
  await expect(bandOf(page).getByText(/完了しました/)).toBeVisible();
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
});
row(R["K63-UI-029"], async (page) => {
  const m = await mockApi(page, executedBand);
  m.on.complete = () => ({
    status: 422,
    body: {
      error: "validation_failed",
      code: "E-VAL-022",
      message: `${MSG.todoLeft}。全部チェックしてから完了にしてください`,
      details: [{ field: "todo_checked", message: "先方に送る" }],
    },
  });
  await openTicket(page);
  await openComplete(page);
  await page.getByRole("checkbox", { name: "請求書を作る" }).check();
  await page.getByRole("checkbox", { name: "先方に送る" }).check();
  await confirmBox(page).check();
  await page.getByRole("button", { name: "確かめて完了にする" }).click();
  await expect(dialog(page)).toContainText(MSG.todoLeft);
  await expect(dialog(page)).toContainText("先方に送る");
  await expect(dialog(page)).toBeVisible();
});
row(R["K63-UI-030"], async (page) => {
  const m = await mockApi(page, executedBand);
  m.on.complete = () => ({
    status: 422,
    body: {
      error: "validation_failed",
      code: "E-VAL-024",
      message: `${MSG.children}。先に子を完了にしてください`,
      details: [{ field: "children", message: "EG-134 宛名を確かめる", id: CHILD }],
    },
  });
  await openTicket(page);
  await openComplete(page);
  await page.getByRole("checkbox", { name: "請求書を作る" }).check();
  await page.getByRole("checkbox", { name: "先方に送る" }).check();
  await confirmBox(page).check();
  await page.getByRole("button", { name: "確かめて完了にする" }).click();
  await expect(dialog(page)).toContainText(MSG.children);
  await expect(dialog(page).getByRole("link", { name: /EG-134 宛名を確かめる/ })).toHaveAttribute(
    "href",
    new RegExp(`/tickets/${CHILD}$`),
  );
});
row(R["K63-UI-031"], async (page) => {
  const m = await mockApi(page, { stage: "awaiting_approval", approval: pending(), can_complete: true });
  await openTicket(page);
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  m.on.ticket = () => ({
    status: 200,
    body: {
      data: ticketOf({
        stage: "running",
        run: { phase: "execute", status: "running", pc: "live" },
        can_complete: true,
      }),
    },
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf(executedBand) } });
  m.on.complete = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-016", message: MSG.stage } });
  await page.reload();
  await openComplete(page);
  await page.getByRole("checkbox", { name: "請求書を作る" }).check();
  await page.getByRole("checkbox", { name: "先方に送る" }).check();
  await confirmBox(page).check();
  await page.getByRole("button", { name: "確かめて完了にする" }).click();
  await expect(page.getByRole("alert").filter({ hasText: MSG.stage })).toBeVisible();
});
row(R["K63-UI-032"], async (page) => {
  await mockApi(page, { ...executedBand, can_complete: false });
  await openTicket(page);
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
});
row(R["K63-UI-033"], async (page) => {
  const m = await mockApi(page);
  await openTicket(page);
  await page.reload();
  await expect(bandOf(page).getByText(MSG.waitingMe)).toBeVisible();
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "queued", pc: "asleep" } }) },
  });
  await page.goto(`/tickets/${TICKET}`);
  await expect(bandOf(page).getByText(MSG.pcClosed)).toBeVisible();
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "done", completed: { at: "2026-11-08T06:20:00Z", by: "高本" } }) },
  });
  await page.reload();
  await expect(bandOf(page).getByText(/完了しました（高本・11\/08 15:20）/)).toBeVisible();
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  expect(m.approves).toHaveLength(0);
});
row(R["K63-UI-034"], async (page) => {
  await mockApi(page, { stage: "awaiting_approval", approval: pending({ note: MSG.note24h }) });
  await openTicket(page);
  const band = bandOf(page);
  await expect(band).toContainText(MSG.note24h);
  await expect(band.getByRole("button", { name: "承認して送る" })).toBeVisible();
  await expect(band.getByRole("button", { name: "差し戻す" })).toBeVisible();
});
row(R["K63-UI-035"], async (page) => {
  await mockApi(page, {
    stage: "doing",
    run: {
      phase: "execute",
      status: "stopped",
      pc: "live",
      stopped_reason: `ここで止まりました。あなたが止めました。${MSG.inFlight}`,
    },
    can_complete: true,
  });
  await openTicket(page);
  await expect(bandOf(page).getByText(MSG.inFlight)).toBeVisible();
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /やり直す|続きから/ })).toHaveCount(0);
});
row(R["K63-UI-036"], async (page) => {
  await mockApi(page);
  for (const w of WIDTHS) {
    await openTicket(page, w);
    await expect(bandOf(page).getByText(MSG.waitingMe)).toBeVisible();
    await noOverflow(page, w);
  }
  const page2 = await page.context().newPage();
  await mockApi(page2, executedBand);
  for (const w of WIDTHS) {
    await openTicket(page2, w);
    await openComplete(page2);
    await noOverflow(page2, w);
  }
});
row(R["K63-UI-037"], async (page) => {
  const m = await mockApi(page, executedBand);
  await openTicket(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "done", completed: { at: new Date().toISOString(), by: "高本" } }) },
  });
  await openComplete(page);
  await page.getByRole("checkbox", { name: "請求書を作る" }).check();
  await page.getByRole("checkbox", { name: "先方に送る" }).check();
  await confirmBox(page).check();
  const b = page.getByRole("button", { name: "確かめて完了にする" });
  const release = m.hold();
  await b.click();
  await expect.poll(() => m.completes.length).toBe(1);
  await expect(b).toBeDisabled();
  await b.dispatchEvent("click");
  release();
  await expect(bandOf(page).getByText(/完了しました/)).toBeVisible();
  expect(m.completes).toHaveLength(1);
});
row(R["K63-UI-039"], async (page) => {
  await mockApi(page, executedBand);
  await openTicket(page);
  await openComplete(page);
  const box = page.getByRole("checkbox", { name: "請求書を作る" });
  await expect(box).not.toBeChecked();
  await box.click();
  await expect(box).toBeChecked();
  await box.click();
  await expect(box).not.toBeChecked();
});
row(R["K63-UI-040"], async (page) => {
  const m = await mockApi(page, { ...executedBand, todo: "- 請求書を作る\n- [x] 先方に送る" });
  await openTicket(page);
  await openComplete(page);
  const done = page.getByRole("checkbox", { name: "先方に送る" });
  await expect(done).toBeChecked();
  await page.getByRole("checkbox", { name: "請求書を作る" }).check();
  await done.uncheck();
  await confirmBox(page).check();
  await page.getByRole("button", { name: "確かめて完了にする" }).click();
  await expect.poll(() => m.completes.length).toBe(1);
  expect(m.completes[0]!["todo_checked"]).toEqual([0]);
});
row(R["K63-UI-041"], async (page) => {
  const m = await mockApi(page, executedBand);
  await openTicket(page);
  await openComplete(page);
  const b = page.getByRole("button", { name: "確かめて完了にする" });
  // どちらのチェックも入っていない間に押しても、口は呼ばずに理由を出す（ブラウザ標準の検証に止められない）
  await b.click();
  await expect(dialog(page)).toContainText(MSG.todoLeft);
  await expect(dialog(page)).toContainText("完了の条件を満たしたか確かめて、チェックを入れてください");
  expect(m.completes).toHaveLength(0);
  await page.getByRole("checkbox", { name: "請求書を作る" }).check();
  await page.getByRole("checkbox", { name: "先方に送る" }).check();
  await confirmBox(page).check();
  await b.click();
  await expect.poll(() => m.completes.length).toBe(1);
});
row(R["K63-UI-042"], async (page) => {
  const m = await mockApi(page); // 承認待ち・決められる人（承認する人）
  await openTicket(page);
  await expect(bandOf(page)).toContainText(MSG.waitingMe);
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(1);
  await expect(page.getByText(MSG.k62Waiting)).toHaveCount(0); // 同じ人に帯を 2 つ並べない
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "awaiting_approval", approval: pending({ can_decide: false }) }) },
  });
  await page.reload();
  await expect(page.getByText(MSG.k62Waiting)).toHaveCount(1);
  await expect(page.getByText(MSG.waitingMe)).toHaveCount(0);
  await expect(page.getByText(MSG.waitingOther)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "差し戻す" })).toHaveCount(0);
});
row(R["K63-UI-043"], async (page) => {
  const m = await mockApi(page);
  await openTicket(page);
  // 帯で押した時点で、もう決まっていた（別のタブ・別の人）：知らせを出し、帯を読み直す
  m.on.approve = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "queued", pc: "live" } }) },
  });
  await bandOf(page).getByRole("button", { name: "承認して送る" }).click();
  await expect(page.getByRole("alert").filter({ hasText: MSG.decided })).toBeVisible();
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(bandOf(page).getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  // 差し戻しでも同じ
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf({ stage: "awaiting_approval", approval: pending() }) } });
  await page.reload();
  await expect(bandOf(page)).toContainText(MSG.waitingMe); // 画面がチケットを読み終えてから、答えを替える
  m.on.ret = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "queued", pc: "live" } }) },
  });
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  await reasonBox(page).fill("宛名を直してください");
  await page.getByRole("button", { name: "差し戻して作り直させる" }).click();
  await expect(page.getByRole("alert").filter({ hasText: MSG.decided })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await expect(bandOf(page).getByRole("button", { name: "差し戻す" })).toHaveCount(0);
});
row(R["K63-UI-044"], async (page) => {
  // 開いたままのチケットで、作る段が終わって承認待ちになったら、読み直しで承認の帯に替わる
  const m = await mockApi(page, { stage: "running", run: { phase: "make", status: "running", pc: "live" } });
  await page.clock.install(); // 3 秒ごとの読み直しは、時計を進めて起こす（待ち時間に頼らない）
  await openTicket(page);
  await expect(bandOf(page)).toHaveCount(0); // 作る段の間は K-63 の帯ごと出さない（K-62 の帯だけ・D-128.178）
  m.on.ticket = () => ({
    status: 200,
    body: {
      data: ticketOf({
        stage: "awaiting_approval",
        approval: pending(),
        run: { phase: "make", status: "done", pc: "live" },
      }),
    },
  });
  await page.clock.fastForward(3_000);
  await expect(bandOf(page)).toContainText(MSG.waitingMe);
  await expect(bandOf(page).getByRole("button", { name: "承認して送る" })).toBeVisible();
  await expect(page.getByText(MSG.k62Waiting)).toHaveCount(0);
});
row(R["K63-UI-045"], async (page) => {
  const K62_STATE = /のAI が作っています|PC が起きるのを待っています|成果物ができました。承認待ちです/;
  const cases: [Band, string][] = [
    [{ ...executedBand, can_delegate: true }, MSG.completeHint],
    [
      {
        stage: "doing",
        run: { phase: "execute", status: "stopped", pc: "live", stopped_reason: `ここで止まりました。${MSG.inFlight}` },
        can_complete: true,
        can_delegate: true,
      },
      MSG.inFlight,
    ],
  ];
  for (const [b, text] of cases) {
    const p = await page.context().newPage();
    await mockApi(p, b);
    await openTicket(p);
    await expect(bandOf(p).getByText(text)).toBeVisible(); // 状態は K-63 の帯が出す
    await expect(k62Band(p).getByRole("button", { name: "AI に任せる" })).toBeVisible(); // K-62 の帯は任せるボタンだけ
    await expect(k62Band(p).getByText(K62_STATE)).toHaveCount(0);
    await p.close();
  }
});
const titleLink = (id: string, title: string, ticketId: string) =>
  row(R[id], async (page) => {
    await mockApi(page);
    await openQueue(page);
    const link = rowOf(page, title).getByRole("link", { name: title, exact: true });
    await expect(link).toHaveAttribute("href", new RegExp(`/tickets/${ticketId}$`)); // その行のチケットへ（最初のチケットではない）
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`));
  });
titleLink("K63-UI-046", "11 月分の請求書を送る", TICKET);
titleLink("K63-UI-047", "見積を出す", TICKET_B);
titleLink("K63-UI-048", "応募文を出す", TICKET_C);
