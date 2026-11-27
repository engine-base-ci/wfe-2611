// K-63「承認して完了する」の画面の試験の共通の土台（K-161〜K-166 の画面の試験が読む）。分ける前の approve-complete.spec.ts の頭と、行の間にあった道具（openReturn・executedBand・openComplete・confirmBox・titleLink）をそのまま移した。
//   行（row）の中身は孫ごとのファイル approve-complete-<束>.spec.ts にある。仕様の表は 1 枚のまま（07_qa/test-specs/k/approve-complete.md・タスクの列が孫）。
//   以下は分ける前の頭の説明のまま。
// K-63「承認して完了する」の画面の試験（実 Chrome）：/approvals の承認待ちと、/tickets/[id] の承認の帯・完了の小窓・本人確認の小窓。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/approve-complete.md）＝試験 1 本。名前の頭の行 ID で op_gate.py が証拠を引く。
//   口（API）は網の手前（page.route）で差し替える。口の振る舞いそのものは apps/api/test/features/F5/approve-complete.test.ts が本物の DB で持つ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   口の形（K-63.md の「答えの形」）：
//     GET  /api/v1/approvals/queue       → { data: [承認待ちの行（1 回 20 件）], meta: { limit, cursor?（続きの鍵の文字列・D-131.9）, counts: { total } } }
//     GET  /api/v1/approvals/:id         → { data: { approval, ticket, artifact_version, checks, check_summary, cautions, irreversible, can_decide } }
//     POST /api/v1/approvals/:id/approve ← {}（頭 idempotency-key）・POST …/return ← { note }
//     GET  /api/v1/tickets/:id           → K-60 の詳細 ＋ approval（{ id, can_decide, irreversible, note, approver_name }|null）・run（{ phase, status, pc: "live"|"asleep", stopped_reason }|null）・can.complete（K-62 の can に足す）・stage.key
//     POST /api/v1/tickets/:id/complete  ← { conditions_confirmed: true }（K-566：todo_checked・todo_version は送らない）→ 201 …・unchecked: { body, specs }
//     GET  /api/v1/tickets/:id の body.doc（K-560）のチェックの箱と、完了を押したときの GET …/test-specs（K-434）が、完了の小窓の未チェックの注意の元（K-572）
//     承認では本人確認を取り直さない（D-128.177）：本人確認の小窓は出さず、stepUp の口も呼ばない
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Page, Request, Route } from "@playwright/test";
import { expect, row, rowsOf, type SpecRow } from "../../_lib/row";
import { shellData } from "../../k/shell-answer";

export const SPEC = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../07_qa/test-specs/k/approve-complete.md",
);
export const ROWS = rowsOf(SPEC);
export const R = Object.fromEntries(ROWS.map((r) => [r.id, r]));
export const API_RE = /\/api\/(v1|auth-ext|auth)\//;
export const TICKET = "0193c5a0-0000-7000-8000-00000000c063";
export const CHILD = "0193c5a0-0000-7000-8000-00000000c064";
export const TICKET_B = "0193c5a0-0000-7000-8000-00000000c065"; // 承認待ちの行ごとに別のチケット（題名のリンクの行き先を見分ける）
export const TICKET_C = "0193c5a0-0000-7000-8000-00000000c066";
export const A_INLINE = "0193c5a0-0000-7000-8000-0000000a0001";
export const A_OPEN = "0193c5a0-0000-7000-8000-0000000a0002";
export const A_NODUE = "0193c5a0-0000-7000-8000-0000000a0003";
export const ME = "11111111-0000-4000-8000-000000000001";
export const MAKER = "11111111-0000-4000-8000-000000000002";
export const MSG = {
  checkNone: "検査なし（まだ流していません）",
  reasonEmpty: "差し戻す理由を書いてください",
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
  noAssignee: "担当者がいないので、承認する人がいません。担当者を決めてください",
  runningAsleep: "実行中・PC が閉じています。開くと続きます", // D-131.13
  asking: "AI が許可を求めています。許可は自動で断られ、続けられなければ止まります", // D-131.13・D-129.44
  stoppedNoReason: "AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます", // D-129.47・D-131.4
  loadFail: "承認待ちを読み込めませんでした。もう一度お試しください",
};
export const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
export const ARTIFACT = "株式会社サンプル 御中\n11 月分の請求書をお送りします。";

export type Reply = { status: number; body: unknown };
export type Handler = (req: Request) => Reply | Promise<Reply>;
export const qrow = (id: string, o: Record<string, unknown> = {}) => ({
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
export const QUEUE = () => [
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
export const detailOf = (id: string, o: Record<string, unknown> = {}) => ({
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
export type Band = {
  stage: string;
  approval?: Record<string, unknown> | null;
  run?: Record<string, unknown> | null;
  can_complete?: boolean;
  can_delegate?: boolean;
  todo?: string;
  /** 本文（body.doc）のチェックの箱。既定は未チェックが 2 つ（完了の小窓が開く）。全部 checked なら小窓なしで完了する */
  tasks?: { text: string; checked: boolean }[];
  completed?: { at: string; by: string } | null;
  /** null なら担当者がいない（K63-UI-049） */
  assignee?: null;
};
export const DEFAULT_TASKS = [
  { text: "請求書を作る", checked: false },
  { text: "先方に送る", checked: false },
];
/** getTicket の body（K-560・{ doc, text }）：目的の段落とチェックの箱の並び */
export const bodyOf = (tasks: { text: string; checked: boolean }[]) => ({
  doc: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "月末の請求を出す" }] },
      {
        type: "taskList",
        content: tasks.map((t) => ({
          type: "taskItem",
          attrs: { checked: t.checked },
          content: [{ type: "paragraph", content: [{ type: "text", text: t.text }] }],
        })),
      },
    ],
  },
  text: "月末の請求を出す",
});
export const BANDS = new WeakMap<object, Band>();
/** getTicket の答えに、その答えのときの今の実行（runs・action_runs で返す）を結ぶ。答えの JSON には入れない */
export const withBand = <T extends object>(b: Band, d: T): T => {
  BANDS.set(d, b);
  return d;
};
export const ticketOf = (b: Band) =>
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
    body: bodyOf(b.tasks ?? DEFAULT_TASKS),
    kind: { name: "タスク" },
    stage: { name: b.stage, key: b.stage },
    assignee: b.assignee === null ? null : { display_name: "高本" },
    approval: b.approval ?? null,
    can: { delegate: b.can_delegate ?? false, complete: b.can_complete ?? false },
    completed: b.completed ?? null,
  });
export const pending = (o: Record<string, unknown> = {}) => ({
  id: A_OPEN,
  can_decide: true,
  irreversible: true,
  note: null,
  approver_name: "高本",
  ...o,
});

export interface Mock {
  approves: { id: string; body: unknown; key: string | undefined }[];
  returns: { id: string; body: Record<string, unknown> }[];
  completes: Record<string, unknown>[];
  stepUps: Record<string, unknown>[];
  queueReads: number;
  /** 書く口（承認・差し戻し・完了）の答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
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
export const RUN_ID = "0193c5a0-0000-7000-8000-0000000e0001";
export const runView = (b: Band) =>
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
export const runsReply = (b: Band): Reply => {
  const v = runView(b);
  return { status: 200, body: { data: v ? [v] : [], meta: { limit: 50 } } };
};
export async function mockApi(
  page: Page,
  band: Band = { stage: "awaiting_approval", approval: pending() },
): Promise<Mock> {
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
        return { status: 200, body: { data: rows, meta: { limit: 20, counts: { total: rows.length } } } };
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
            unchecked: { body: 0, specs: 0 },
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
      await m.gate; // 差し戻しの 2 回押しも同じ形で確かめる（K63-UI-055）
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
    } else if (p === "/api/v1/shell") {
      // 外枠は getShell 1 本（K-466）。承認待ちの数は承認待ちの口の答えの数（役・名前は下の /me と同じ）
      const q = await m.on.queue(req);
      const total = Number((q.body as { meta?: { counts?: { total?: number } } }).meta?.counts?.total ?? 0);
      reply = { status: 200, body: { data: shellData({ approvals: total }), meta: {} } };
    } else if (/\/me$/.test(p))
      // 役は role_id で読む（分からない役は外枠が項目を出さない・K-138）
      reply = {
        status: 200,
        body: {
          data: { id: ME, member_id: ME, display_name: "高本", role_id: "owner", roles: ["member"], name: "高本" },
        },
      };
    else reply = { status: 200, body: { data: [], meta: { limit: 50 } } };
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return m;
}

export const CONTROL =
  /^\s*- (button|link|tab|radio|textbox|searchbox|combobox|checkbox|switch|menuitem|option|slider|spinbutton) "((?:[^"\\]|\\.)*)"/;
/** 本体（main と開いている小窓）の操作要素のうち、仕様に行の無いもの。外枠のメニューは K-60 の仕様が持つ */
export async function missingInMain(page: Page, rows: SpecRow[], extra: SpecRow[] = []): Promise<string[]> {
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
/** 1440 の左のメニュー（新しい外枠・D-143.1）の「承認待ち」の数の印が n */
export const menuCount = async (page: Page, n: number) => {
  const item = page.getByRole("navigation", { name: "メニュー", exact: true }).getByRole("link", { name: /^承認待ち/ });
  await expect(item.locator(".k-nav-badge")).toHaveText(String(n));
};
export const openQueue = async (page: Page, width = 1440) => {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto("/approvals");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /承認待ち/ })).toBeVisible();
  // 見出しは一覧を読む前から出る。最初の読み込みが終わる（読み込み中が消える）まで待ってから、試験が口の答えを差し替える（K-138）
  await expect(page.locator('#k-main [aria-busy="true"]')).toHaveCount(0);
};
export const openTicket = async (page: Page, width = 1440) => {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(`/tickets/${TICKET}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: /11 月分の請求書を送る/ })).toBeVisible();
};
export const rowOf = (page: Page, title: string) => page.getByRole("row").filter({ hasText: title });
export const dialog = (page: Page) => page.getByRole("dialog");
/** K-63 の帯（承認待ち・実行待ち・実行中・止まった・作業中・完了のどの状態でも同じ名前の region）。段の名札（K-60 の Badge）と取り違えないよう、帯の中だけで探す */
export const BAND = "承認と実行";
export const bandOf = (page: Page) => page.getByRole("region", { name: BAND });
/** K-62 の帯（phase make の間だけ出す。承認の後の実行の間は出さない・D-128.178） */
export const k62Band = (page: Page) => page.getByRole("region", { name: "AI に任せる" });
export const reasonBox = (page: Page) => page.getByRole("textbox", { name: "差し戻す理由" });
export const reasonOf = async (page: Page) => {
  const ids = (await reasonBox(page).getAttribute("aria-describedby")) ?? "";
  const texts = await Promise.all(
    ids
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => page.locator(`[id="${id}"]`).innerText()),
  );
  return texts.join(" ");
};
export const noOverflow = async (page: Page, w: number) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, `幅 ${w} の横溢れ`).toBe(0);
};

export const openReturn = async (page: Page, title = "11 月分の請求書を送る") => {
  await rowOf(page, title).getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
};

export const executedBand: Band = {
  stage: "doing",
  run: { phase: "execute", status: "done", pc: "live", stopped_reason: null },
  can_complete: true,
};

/** 「完了にする」を押して小窓（未チェックの注意）を開く。既定の本文（未チェック 2 つ）なら開く。全部済みなら小窓なしで完了するので使わない */
export const openComplete = async (page: Page) => {
  await page.getByRole("button", { name: "完了にする", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
};

export const titleLink = (id: string, title: string, ticketId: string) =>
  row(R[id], async (page) => {
    await mockApi(page);
    await openQueue(page);
    const link = rowOf(page, title).getByRole("link", { name: title, exact: true });
    await expect(link).toHaveAttribute("href", new RegExp(`/tickets/${ticketId}$`)); // その行のチケットへ（最初のチケットではない）
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`));
  });

// ---- 実行の一覧の答えを待つ道具（K-247）----
// 試験が開いた直後・時計を進めた直後に口の答え（m.on.ticket）を替えると、まだ届いていない実行の一覧の答えが替えた後の答えで帰り、
// 帯が替わって押す前にボタンが消える（遅い台で起きる揺れ）。答えを替える行は、この道具で開く・進める
const RUNS_PATH = `/api/v1/tickets/${TICKET}/runs`;
const isRuns = (req: Request) => new URL(req.url()).pathname === RUNS_PATH;
/** 開いた後、実行の一覧の最初の答えが届くまで返らない（一覧を握ったまま開く行は openTicket のまま） */
export const openTicketSettled = async (page: Page, width = 1440): Promise<void> => {
  const read = page.waitForResponse((r) => isRuns(r.request()));
  await openTicket(page, width);
  await read;
};
/** 時計を 3 秒進め、進めた後に出た実行の一覧の問い合わせの答えが届くまで返らない（進める前から飛んでいた答えでは返らない）。
 *  一覧が 3 秒ごとに読み直している間（走っている実行がある・任せた直後）だけ使う */
export const tickSettled = async (page: Page): Promise<void> => {
  const asked = new Promise<Request>((resolve) => {
    const on = (req: Request) => {
      if (!isRuns(req)) return;
      page.off("request", on);
      resolve(req);
    };
    page.on("request", on);
  });
  await page.clock.fastForward(3_000);
  const req = await asked;
  await req.response();
};
