// K-62「AI に任せる」の画面の試験（実 Chrome）：チケットの詳細 /tickets/[id] の上の帯（AI に任せる・途中の 1 行・止まった理由）と実行の記録。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/delegate.md）＝試験 1 本。口（API）は網の手前（page.route）で差し替える。
//   口の振る舞いそのものは apps/api/test/features/F5/delegate.test.ts・delegate-bridge.test.ts が本物の DB で持つ。
//   時間は眠らずに時計を進める（page.clock）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Page, Request, Route } from "@playwright/test";
import { expect, missingRows, row, rowsOf } from "../../_lib/row";
import { detailRows } from "../../k/detail-kit";

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC = join(HERE, "../../../../../07_qa/test-specs/k/delegate.md");
const K60_SPEC = join(HERE, "../../../../../07_qa/test-specs/k/create-ticket.md");
const ROWS = rowsOf(SPEC);
const R = Object.fromEntries(ROWS.map((r) => [r.id, r]));
const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const WS = "aaaaaaaa-0000-4000-8000-000000000062";
const ID = "0193c5a0-0000-7000-8000-00000000c062";
const RUN = "0193c5a0-0000-7000-8000-0000000a0062";
const JOB = "0193c5a0-0000-7000-8000-0000000b0062";
const TAKAMOTO = { member_id: "11111111-0000-4000-8000-000000000001", display_name: "高本" };
const SATO = { member_id: "11111111-0000-4000-8000-000000000003", display_name: "佐藤" };

type Reply = { status: number; body: unknown };
interface Run {
  id: string;
  ticket_id: string;
  phase: "make" | "execute";
  status: string;
  by: { member_id: string; display_name: string };
  pc: "live" | "asleep" | "none";
  silent: boolean;
  progress: string | null;
  stopped_reason: string | null;
  /** 差し戻しの後の作り直しなら、差し戻した承認の理由（K-63 が approval_id を入れる） */
  return_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
  last_event_at: string | null;
  checks: { state: "none" };
}
const run = (o: Partial<Run> = {}): Run => ({
  id: RUN,
  ticket_id: ID,
  phase: "make",
  status: "running",
  by: TAKAMOTO,
  pc: "live",
  silent: false,
  progress: null,
  stopped_reason: null,
  return_reason: null,
  started_at: "2026-11-07T01:00:00Z",
  finished_at: null,
  last_event_at: "2026-11-07T01:00:00Z",
  checks: { state: "none" },
  ...o,
});
interface Mock {
  delegates: unknown[];
  /** 口へ行った GET の数（どの口でも数える） */
  gets: number;
  runReads: number;
  /** getTicket を読んだ数（開いたままの画面で、実行が終わった・止まった後に読み直すかを見る） */
  ticketReads: number;
  /** getTicket が返す区画（成果物の区画が届いた後の形を作る） */
  sections: { key: string; label: string; body: { text: string }; version: number }[];
  stage: { key: string; name: string };
  canDelegate: boolean;
  /** getTicket の approval（K-63 が足す）。can_decide＝見ている人が承認する人か（D-128.178） */
  approval: { id: string; can_decide: boolean } | null;
  runs: Run[];
  /** getActionRun が返す順（読むたびに 1 つ進み、最後のものを返し続ける） */
  runSeq: Run[];
  onDelegate: () => Reply;
}
const mock = (o: Partial<Mock> = {}): Mock => ({
  delegates: [],
  gets: 0,
  runReads: 0,
  ticketReads: 0,
  sections: [{ key: "purpose", label: "目的", body: { text: "先方に出す見積のたたき台を作る" }, version: 1 }],
  stage: { key: "todo", name: "未着手" },
  canDelegate: true,
  approval: null,
  runs: [],
  runSeq: [run({ status: "queued" })],
  onDelegate: () => ({ status: 201, body: { data: { run_id: RUN, job_id: JOB, status: "queued", pc: "live" } } }),
  ...o,
});

async function mockApi(page: Page, m: Mock): Promise<Mock> {
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (req.method() === "GET") m.gets += 1;
    let reply: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    if (p === `/api/v1/tickets/${ID}`) m.ticketReads += 1;
    if (p === `/api/v1/tickets/${ID}`)
      reply = {
        status: 200,
        body: {
          data: {
            ticket: {
              id: ID,
              number: "AI-62",
              title: "見積を作る",
              due_on: "2026-11-10",
              start_on: null,
              priority: "mid",
            },
            sections: m.sections,
            kind: { id: "k", name: "タスク", color: null },
            stage: { id: "s", ...m.stage },
            assignee: { id: TAKAMOTO.member_id, display_name: "高本" },
            can: { delegate: m.canDelegate },
            approval: m.approval,
          },
        },
      };
    else if (p === `/api/v1/tickets/${ID}/runs`) reply = { status: 200, body: { data: m.runs, meta: { limit: 50 } } };
    else if (p === `/api/v1/tickets/${ID}/delegate` && req.method() === "POST") {
      m.delegates.push(req.postDataJSON());
      await new Promise((r) => setTimeout(r, 200)); // 答えを待つ間（2 回押しを確かめる）
      reply = m.onDelegate();
      if (reply.status === 201) m.runs = [m.runSeq[0]!, ...m.runs];
    } else if (p === `/api/v1/action_runs/${RUN}`) {
      const r = m.runSeq[Math.min(m.runReads, m.runSeq.length - 1)]!;
      m.runReads += 1;
      reply = { status: 200, body: { data: r } };
    }
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return m;
}
const open = async (page: Page, width = 1440) => {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(`/tickets/${ID}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "見積を作る" })).toBeVisible();
};
const band = (page: Page) => page.getByRole("region", { name: "AI に任せる" });
const delegateBtn = (page: Page) => page.getByRole("button", { name: "AI に任せる", exact: true });
/** 右のパネルの「実行の記録（最新）」（K-226：最新 1 件だけを出し、全部は小窓「実行の記録」） */
const runLog = (page: Page) => page.getByRole("region", { name: "実行の記録（最新）" });
/** 読み終えた印：実行の記録を n 件読み終えるまで待つ（「出ない」を確かめる前に、画面が読み終えたことを見る）。
 *  K-226 で右のパネルは最新 1 件だけになったので、読んだ件数（data-runs）で見る */
const loaded = async (page: Page, n: number) => expect(runLog(page)).toHaveAttribute("data-runs", String(n));

row(R["K62-UI-000"], async (page) => {
  await mockApi(page, mock());
  await open(page);
  // K-60 が持つ詳細の要素（チケットへ戻る など）は K-60 の表が受け持つ。外枠は外枠の試験（D-128.151）
  // K-226 が詳細の本文と右のパネルに置いた操作要素（まだ使えない物も・D-145.9）は K-226 の一覧（detailRows）が受け持つ
  const both = [...ROWS, ...rowsOf(K60_SPEC), ...detailRows(["目的"])];
  expect(await missingRows(page, both, "[data-ticket-shell]")).toEqual([]);
});

row(R["K62-UI-001"], async (page) => {
  const m = await mockApi(page, mock({ runSeq: [run({ status: "running", progress: null })] }));
  await open(page);
  await delegateBtn(page).click();
  await expect(band(page)).toContainText("高本のAI が作っています");
  await expect(delegateBtn(page)).toHaveCount(0);
  expect(m.delegates).toEqual([{}]);
});

row(R["K62-UI-002"], async (page) => {
  const m = await mockApi(page, mock());
  await open(page);
  await delegateBtn(page).click();
  // 答えを待つ間（200 ms）は押せない。2 回目は口に届かない
  await expect(delegateBtn(page)).toBeDisabled();
  await delegateBtn(page)
    .click({ force: true })
    .catch(() => undefined);
  await expect(band(page)).toContainText("のAI");
  expect(m.delegates).toHaveLength(1);
});

row(R["K62-UI-003"], async (page) => {
  await mockApi(
    page,
    mock({
      onDelegate: () => ({ status: 201, body: { data: { run_id: RUN, job_id: JOB, status: "queued", pc: "asleep" } } }),
      runSeq: [run({ status: "queued", pc: "asleep" })],
    }),
  );
  await open(page);
  await delegateBtn(page).click();
  await expect(band(page)).toContainText("PC が起きるのを待っています");
  await expect(band(page)).not.toContainText("止まり");
});

row(R["K62-UI-004"], async (page) => {
  await mockApi(page, mock({ onDelegate: () => ({ status: 409, body: { error: "conflict", code: "E-CONN-001" } }) }));
  await open(page);
  await delegateBtn(page).click();
  await expect(band(page)).toContainText("まだつながっていません");
  await page.getByRole("link", { name: "PC をつなぐ" }).click();
  await expect(page).toHaveURL(/\/setup\/bridge/);
});

row(R["K62-UI-005"], async (page) => {
  await page.clock.install();
  const m = mock({
    stage: { key: "running", name: "実行中" },
    canDelegate: false,
    runSeq: [run({ progress: "前回の見積を読んでいます" }), run({ progress: "内訳を書いています" })],
  });
  m.runs = [m.runSeq[0]!];
  await mockApi(page, m);
  await open(page);
  await expect(band(page)).toContainText("前回の見積を読んでいます");
  await page.clock.runFor(3_000);
  await expect(band(page)).toContainText("内訳を書いています");
});

row(R["K62-UI-006"], async (page) => {
  const stopped = run({
    status: "stopped",
    stopped_reason: "サブスクの 5 時間の枠に達しました",
    finished_at: "2026-11-07T01:10:00Z",
  });
  await mockApi(page, mock({ stage: { key: "doing", name: "作業中" }, runs: [stopped], runSeq: [stopped] }));
  await open(page);
  await expect(band(page)).toContainText("サブスクの 5 時間の枠に達しました");
  await expect(delegateBtn(page)).toBeVisible();
});

row(R["K62-UI-007"], async (page) => {
  const quiet = run({ status: "running", silent: true });
  await mockApi(
    page,
    mock({ stage: { key: "running", name: "実行中" }, canDelegate: false, runs: [quiet], runSeq: [quiet] }),
  );
  await open(page);
  await expect(band(page)).toContainText("PC から 10 分知らせがありません。止まったとみなしています");
});

row(R["K62-UI-008"], async (page) => {
  // 承認待ちの帯は 1 つ（D-128.178）：承認する人でない人には K-62 の「承認待ちです」の帯を出す
  const made = run({ status: "done", finished_at: "2026-11-07T01:20:00Z" });
  await mockApi(
    page,
    mock({
      stage: { key: "awaiting_approval", name: "承認待ち" },
      canDelegate: false,
      approval: { id: "ap-1", can_decide: false },
      runs: [made],
      runSeq: [made],
    }),
  );
  await open(page);
  await expect(delegateBtn(page)).toHaveCount(0);
  await expect(band(page)).toContainText("成果物ができました。承認待ちです");
  await expect(band(page)).toContainText("検査なし（まだ流していません）");
});

row(R["K62-UI-024"], async (page) => {
  // 承認する人が見ているときは K-63 の承認の帯だけ。K-62 の「承認待ちです」の帯は出さない（同じ人に 2 つ並ばない・D-128.178）
  const made = run({ status: "done", finished_at: "2026-11-07T01:20:00Z" });
  await mockApi(
    page,
    mock({
      stage: { key: "awaiting_approval", name: "承認待ち" },
      canDelegate: false,
      approval: { id: "ap-1", can_decide: true },
      runs: [made],
      runSeq: [made],
    }),
  );
  await open(page);
  await loaded(page, 1);
  await expect(delegateBtn(page)).toHaveCount(0);
  await expect(page.getByText("成果物ができました。承認待ちです")).toHaveCount(0);
});

row(R["K62-UI-009"], async (page) => {
  await mockApi(page, mock({ stage: { key: "done", name: "完了" }, canDelegate: false }));
  await open(page);
  await expect(delegateBtn(page)).toHaveCount(0);
});

row(R["K62-UI-010"], async (page) => {
  await mockApi(page, mock({ canDelegate: false }));
  await open(page);
  await expect(delegateBtn(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /AI に任せる/ })).toHaveCount(0);
});

row(R["K62-UI-011"], async (page) => {
  const busy = run({ status: "running", progress: "内訳を書いています" });
  const m = await mockApi(
    page,
    mock({ stage: { key: "running", name: "実行中" }, canDelegate: false, runs: [busy], runSeq: [busy] }),
  );
  await open(page);
  await expect(band(page)).toContainText("高本のAI が作っています");
  await page.reload();
  await expect(band(page)).toContainText("内訳を書いています");
  expect(m.delegates).toHaveLength(0);
});

row(R["K62-UI-012"], async (page) => {
  const other = run({ status: "running", progress: "別のタブで任せた実行" });
  const m = mock({
    onDelegate: () => ({ status: 409, body: { error: "conflict", code: "E-CONF-013", run_id: RUN } }),
    runSeq: [other],
  });
  await mockApi(page, m);
  await open(page);
  await delegateBtn(page).click();
  await expect(band(page)).toContainText("別のタブで任せた実行");
  expect(m.delegates).toHaveLength(1);
});

row(R["K62-UI-013"], async (page) => {
  const evil = run({ status: "stopped", stopped_reason: '<img src=x onerror="window.__k62=1">止まりました' });
  await mockApi(page, mock({ stage: { key: "doing", name: "作業中" }, runs: [evil], runSeq: [evil] }));
  await open(page);
  await expect(band(page)).toContainText('<img src=x onerror="window.__k62=1">止まりました');
  expect(await band(page).locator("img").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __k62?: number }).__k62)).toBeUndefined();
});

row(R["K62-UI-014"], async (page) => {
  await mockApi(page, mock({ runSeq: [run({ status: "running", by: SATO })] }));
  await open(page);
  await delegateBtn(page).click();
  await expect(band(page)).toContainText("佐藤のAI が作っています");
});

row(R["K62-UI-015"], async (page) => {
  await page.clock.install();
  const m = mock({
    onDelegate: () => ({ status: 429, body: { error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 30 } }),
  });
  await mockApi(page, m);
  await open(page);
  await delegateBtn(page).click();
  await expect(band(page)).toContainText("30 秒");
  // 待つ秒数が過ぎるまでは押せない。過ぎたら押せる（押すのは人・自動で送り直さない）
  await expect(delegateBtn(page)).toBeDisabled();
  await page.clock.runFor(29_000);
  await expect(delegateBtn(page)).toBeDisabled();
  await page.clock.runFor(2_000);
  await expect(delegateBtn(page)).toBeEnabled();
  expect(m.delegates).toHaveLength(1);
});

row(R["K62-UI-016"], async (page) => {
  const older = run({
    id: "0193c5a0-0000-7000-8000-0000000a0001",
    status: "stopped",
    stopped_reason: "あなたが止めました",
    started_at: "2026-11-06T23:00:00Z", // 日本時間 11/7 8:00
    by: SATO,
  });
  const now = run({ status: "running", started_at: "2026-11-07T01:00:00Z" }); // 日本時間 10:00
  await mockApi(
    page,
    mock({ stage: { key: "running", name: "実行中" }, canDelegate: false, runs: [now, older], runSeq: [now] }),
  );
  await open(page);
  // K-226：全部の実行は右のパネルの「実行の記録をすべて見る」で開く小窓「実行の記録」に、新しい順で出る
  await page.getByRole("button", { name: "実行の記録をすべて見る" }).click();
  const log = page.getByRole("dialog", { name: "実行の記録" });
  const items = log.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("高本のAI");
  await expect(items.nth(0)).toContainText("10:00");
  await expect(items.nth(1)).toContainText("佐藤のAI");
  await expect(items.nth(1)).toContainText("8:00");
});

row(R["K62-UI-017"], async (page) => {
  await page.clock.install();
  const stopped = run({ status: "stopped", stopped_reason: "あなたが止めました" });
  const m = await mockApi(page, mock({ stage: { key: "doing", name: "作業中" }, runs: [stopped], runSeq: [stopped] }));
  await open(page);
  await expect(band(page)).toContainText("あなたが止めました");
  const before = m.gets;
  await page.clock.runFor(10_000);
  expect(m.gets).toBe(before); // 実行の 1 件・一覧・詳細のどれも読み直さない
});

row(R["K62-UI-018"], async (page) => {
  await mockApi(
    page,
    mock({ onDelegate: () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } }) }),
  );
  await open(page);
  await delegateBtn(page).click();
  await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(`/tickets/${ID}`)}`));
});

row(R["K62-UI-019"], async (page) => {
  const gone = run({ status: "stopped", stopped_reason: "PC を外したので止まりました" });
  await mockApi(page, mock({ stage: { key: "doing", name: "作業中" }, runs: [gone], runSeq: [gone] }));
  await open(page);
  await expect(band(page)).toContainText("PC を外したので止まりました");
});

row(R["K62-UI-020"], async (page) => {
  const busy = run({ status: "running", progress: "内訳を書いています。".repeat(20) });
  await mockApi(
    page,
    mock({ stage: { key: "running", name: "実行中" }, canDelegate: false, runs: [busy], runSeq: [busy] }),
  );
  for (const w of [375, 768, 1024, 1440]) {
    await open(page, w);
    await expect(band(page)).toBeVisible();
    await expect(runLog(page)).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `${w}px`).toBe(0);
  }
});

row(R["K62-UI-021"], async (page) => {
  const m = await mockApi(
    page,
    mock({ onDelegate: () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } }) }),
  );
  await open(page);
  await delegateBtn(page).click();
  await expect(band(page)).toContainText("権限がありません"); // E-PAGE-002
  await expect(band(page)).not.toContainText("のAI が作っています");
  expect(m.delegates).toHaveLength(1);
});

row(R["K62-UI-022"], async (page) => {
  for (const status of [500, 503]) {
    const m = mock({ onDelegate: () => ({ status, body: { error: "internal", code: "E-PAGE-003" } }) });
    await page.unrouteAll();
    await mockApi(page, m);
    await open(page);
    await delegateBtn(page).click();
    await expect(band(page), String(status)).toContainText("Kaname の調子が悪くなっています");
    await expect(delegateBtn(page)).toBeEnabled(); // もう一度押せる（何も積まれていない）
  }
});

row(R["K62-UI-023"], async (page) => {
  const made = run({ status: "done", finished_at: "2026-11-07T01:20:00Z" });
  const m = mock();
  // 開いている間に別の所で承認待ちになった：任せる口は 409・E-CONF-014。その後の読み直しでは承認待ち
  m.onDelegate = () => {
    m.stage = { key: "awaiting_approval", name: "承認待ち" };
    m.canDelegate = false;
    m.approval = { id: "ap-1", can_decide: false }; // 見ているのは承認する人でない人（承認する人なら K-63 の帯・K62-UI-024）
    m.runs = [made];
    m.runSeq = [made];
    return { status: 409, body: { error: "conflict", code: "E-CONF-014" } };
  };
  await mockApi(page, m);
  await open(page);
  await delegateBtn(page).click();
  await expect(band(page)).toContainText("いまの段のチケットは AI に任せられません");
  await expect(delegateBtn(page)).toHaveCount(0);
  await expect(band(page)).toContainText("成果物ができました。承認待ちです");
  expect(m.delegates).toHaveLength(1);
});

row(R["K62-UI-025"], async (page) => {
  // 承認の後の実行（phase execute）の間は K-62 の帯を出さない（K-63 の帯だけ・D-128.178）。段は K-63 に合わせる（止まったら作業中）
  const cases = [
    {
      r: run({ phase: "execute", status: "running", progress: "先方に送っています" }),
      stage: { key: "running", name: "実行中" },
    },
    { r: run({ phase: "execute", status: "queued", pc: "asleep" }), stage: { key: "running", name: "実行中" } },
    {
      r: run({ phase: "execute", status: "stopped", stopped_reason: "あなたが止めました" }),
      stage: { key: "doing", name: "作業中" },
    },
  ];
  for (const { r, stage } of cases) {
    await page.unrouteAll();
    await mockApi(page, mock({ stage, canDelegate: false, runs: [r], runSeq: [r] }));
    await open(page);
    await loaded(page, 1);
    await expect(band(page), `${r.status}`).toHaveCount(0); // K-62 の帯そのものが出ない
    for (const text of [
      "のAI が作っています",
      "PC が起きるのを待っています",
      "あなたが止めました",
      "先方に送っています",
    ])
      await expect(runLog(page).getByText(text), `${r.status}: ${text}`).toHaveCount(0);
    // K-226：全部の実行は小窓「実行の記録」に出る。小窓にも K-62 の帯の文を出さない
    await page.getByRole("button", { name: "実行の記録をすべて見る" }).click();
    const all = page.getByRole("dialog", { name: "実行の記録" });
    await expect(all.getByRole("listitem")).toHaveCount(1);
    for (const text of [
      "のAI が作っています",
      "PC が起きるのを待っています",
      "あなたが止めました",
      "先方に送っています",
    ])
      await expect(all.getByText(text), `小窓 ${r.status}: ${text}`).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
});

row(R["K62-UI-026"], async (page) => {
  // 差し戻しの後の作り直し（phase make）の間は K-62 の帯だけ。K-63 の帯（「作り直しています」）は出さない（D-128.178）
  const remake = run({ phase: "make", status: "running", progress: "差し戻しの理由に沿って直しています" });
  await mockApi(
    page,
    mock({
      stage: { key: "running", name: "実行中" },
      canDelegate: false,
      approval: null,
      runs: [remake],
      runSeq: [remake],
    }),
  );
  await open(page);
  await loaded(page, 1);
  await expect(band(page)).toContainText("高本のAI が作っています");
  await expect(band(page)).toContainText("差し戻しの理由に沿って直しています");
  await expect(page.getByText("作り直しています")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "承認と実行" })).toHaveCount(0);
});

row(R["K62-UI-027"], async (page) => {
  // 作り直しの間は K-63 の帯を出さないので、差し戻しの理由は K-62 の帯に出す。理由は文字として出す（HTML にしない）
  const remake = run({
    phase: "make",
    status: "running",
    return_reason: '<b onclick="window.__k62r=1">金額</b>が違います',
  });
  await mockApi(
    page,
    mock({ stage: { key: "running", name: "実行中" }, canDelegate: false, runs: [remake], runSeq: [remake] }),
  );
  await open(page);
  await loaded(page, 1);
  await expect(band(page)).toContainText("高本のAI が作っています");
  await expect(band(page)).toContainText('差し戻しの理由：<b onclick="window.__k62r=1">金額</b>が違います');
  expect(await band(page).locator("b").count()).toBe(0);
});

row(R["K62-UI-028"], async (page) => {
  // 承認の後の実行が終わった・止まった後（作業中・can.delegate true）：K-62 の帯は「AI に任せる」のボタンだけ（G-03）。状態の文は K-63 の帯が出す
  for (const r of [
    run({ phase: "execute", status: "done", finished_at: "2026-11-07T02:00:00Z" }),
    run({
      phase: "execute",
      status: "stopped",
      stopped_reason: "あなたが止めました",
      finished_at: "2026-11-07T02:00:00Z",
    }),
  ]) {
    await page.unrouteAll();
    await mockApi(page, mock({ stage: { key: "doing", name: "作業中" }, canDelegate: true, runs: [r], runSeq: [r] }));
    await open(page);
    await loaded(page, 1);
    await expect(delegateBtn(page), r.status).toBeVisible();
    for (const text of [
      "のAI が作っています",
      "PC が起きるのを待っています",
      "あなたが止めました",
      "成果物ができました",
      "PC から 10 分知らせがありません",
    ])
      await expect(band(page).getByText(text), `${r.status}: ${text}`).toHaveCount(0);
  }
});

row(R["K62-UI-029"], async (page) => {
  // G-12：開いたままの画面で、動いている実行が作り終えた（承認待ちになった）直後
  await page.clock.install();
  const busy = run({ progress: "内訳を書いています" });
  const made = run({ status: "done", progress: null, finished_at: "2026-11-07T01:20:00Z" });
  const m = mock({ stage: { key: "running", name: "実行中" }, canDelegate: false, runSeq: [busy, made] });
  m.runs = [busy];
  await mockApi(page, m);
  await open(page);
  await expect(band(page)).toContainText("高本のAI が作っています");
  const readsBefore = m.ticketReads;
  // Kaname の側で作り終えた：段は承認待ち・成果物の区画ができた（画面はまだ知らない）
  m.stage = { key: "awaiting_approval", name: "承認待ち" };
  m.approval = { id: "ap-29", can_decide: false };
  m.runs = [made];
  m.sections = [
    ...m.sections,
    { key: "artifacts", label: "成果物", body: { text: "見積：合計 120,000 円（内訳 3 行）" }, version: 1 },
  ];
  await page.clock.runFor(3_000);
  await expect(band(page)).toContainText("成果物ができました。承認待ちです");
  await expect(band(page)).toContainText("検査なし（まだ流していません）");
  await expect(band(page)).not.toContainText("のAI が作っています");
  await expect(delegateBtn(page)).toHaveCount(0);
  await expect(page.getByText("見積：合計 120,000 円（内訳 3 行）")).toBeVisible();
  expect(m.ticketReads, "実行が終わったらチケットの詳細を読み直す").toBeGreaterThan(readsBefore);
});

row(R["K62-UI-030"], async (page) => {
  // G-12：開いたままの画面で、動いている実行が止まった直後
  await page.clock.install();
  const busy = run({ progress: "内訳を書いています" });
  const stopped = run({
    status: "stopped",
    progress: null,
    stopped_reason: "サブスクの 5 時間の枠に達しました",
    finished_at: "2026-11-07T01:10:00Z",
  });
  const m = mock({ stage: { key: "running", name: "実行中" }, canDelegate: false, runSeq: [busy, stopped] });
  m.runs = [busy];
  await mockApi(page, m);
  await open(page);
  await expect(band(page)).toContainText("高本のAI が作っています");
  await expect(delegateBtn(page)).toHaveCount(0);
  const readsBefore = m.ticketReads;
  // Kaname の側で止まった：段は作業中に戻り、また任せられる
  m.stage = { key: "doing", name: "作業中" };
  m.canDelegate = true;
  m.runs = [stopped];
  await page.clock.runFor(3_000);
  await expect(band(page)).toContainText("サブスクの 5 時間の枠に達しました");
  await expect(band(page)).not.toContainText("のAI が作っています");
  await expect(delegateBtn(page)).toBeVisible();
  await expect(delegateBtn(page)).toBeEnabled();
  expect(m.ticketReads, "実行が止まったらチケットの詳細を読み直す").toBeGreaterThan(readsBefore);
});

row(R["K62-UI-031"], async (page) => {
  // 決める人の決定 D-129.47：止まったときに帯に出す 3 つの文。口が返した止まった理由をそのまま文字で出す
  for (const reason of [
    "AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます",
    "PC でこの実行をやめました。もう一度「AI に任せる」を押せます",
    "PC の Kaname Bridge が途中で止まったので、ここで止まりました。Bridge を開き直してから、もう一度「AI に任せる」を押してください",
  ]) {
    const stopped = run({ status: "stopped", stopped_reason: reason, finished_at: "2026-11-07T01:10:00Z" });
    await mockApi(page, mock({ stage: { key: "doing", name: "作業中" }, runs: [stopped], runSeq: [stopped] }));
    await open(page);
    await expect(band(page)).toContainText(reason);
    await expect(delegateBtn(page)).toBeVisible();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

row(R["K62-UI-032"], async (page) => {
  // 決める人の決定 D-134.1：待っている（queued）かつ PC が起きている間は「任せました。PC が受け取るのを待っています」。PC が受け取ったら「作っています」
  await page.clock.install();
  const m = await mockApi(page, mock()); // 既定：任せる口は 201（queued・pc live）、実行の 1 件は queued
  await open(page);
  await delegateBtn(page).click();
  await expect(band(page)).toContainText("高本のAI に任せました。PC が受け取るのを待っています");
  await expect(band(page)).not.toContainText("が作っています");
  await expect(band(page)).not.toContainText("起きるのを待っています");
  await expect(delegateBtn(page)).toHaveCount(0);
  // Kaname の側で PC が受け取った（画面はまだ知らない）→ 3 秒ごとの読み直しで替わる
  m.runSeq = [run({ status: "running" })];
  await page.clock.runFor(3_000);
  await expect(band(page)).toContainText("高本のAI が作っています");
  await expect(band(page)).not.toContainText("受け取るのを待っています");
  expect(m.delegates).toEqual([{}]);
});
