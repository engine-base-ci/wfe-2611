// K-265「段 1 の締めの全部の CI で K63-UI-066 が揺れた（承認して送るを押す前に帯から消えた）」の画面の試験（実 Chrome・口は網の手前で差し替え）。
//   原因（11_tickets/K-265.md）：作る段が終わった読み直しの回では、チケットの読み直しに続いて、作る段の実行の 1 件の答え（終わった）が後から届き、
//   それを合図に詳細がチケットをもう 1 回読む（K62-UI-029・030 の読み直し）。前の試験は「承認して送る」を押す前に口の答えを承認の後の形に替えていたので、
//   この遅れた読みが承認の後の形（承認待ちなし）を読み、ボタンが本当に消えていた（押す前に別の人が承認したのと同じ形）。
// この行は、口の答えを「承認の口が呼ばれたとき」にだけ替える（本物の口と同じ）形で、遅れた読みが入っても「承認して送る」が同じ要素のまま残り、押せることを見る。
//   遅れは時間で作らない：作る段の実行の 1 件の答えを握り、ボタンが出た後に放す。遅れた読みが本当に入ったことは、その読みにだけ載せた文が帯に出ることで見る。
//   口は前からの土台 approve-complete.harness.ts で差し替える。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page, Request, Route } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  API_RE,
  MAKER,
  TICKET,
  bandOf,
  k62Band,
  mockApi,
  openTicket,
  pending,
  tickSettled,
  ticketOf,
  type Band,
} from "../features/F5/approve-complete.harness";
import { approveVia } from "./approve-modal";

const MAKE_1 = "0193c5a0-0000-7000-8000-0000000e2651"; // 任せたときの作る段の実行
const EXEC = "0193c5a0-0000-7000-8000-0000000e2652"; // 承認の後の実行
const MAKING = "山田のAI が作っています";
/** 遅れた読み（作る段の実行が終わったのを合図にした詳細の読み直し）にだけ載せる承認の注の文 */
const LATE_NOTE = "成果物を読み直しました。宛名を確かめてから送ってください";

interface Run {
  id: string;
  phase: "make" | "execute";
  status: string;
}
const view = (r: Run) => ({
  id: r.id,
  ticket_id: TICKET,
  phase: r.phase,
  status: r.status,
  by: { member_id: MAKER, display_name: "山田" },
  pc: "live",
  silent: false,
  last_event_at: null,
  progress: null,
  stopped_reason: null,
  return_reason: null,
  started_at: new Date().toISOString(),
  finished_at: null,
  checks: { state: "none" },
});

/** 「承認して送る」の要素を控え、DOM から外れた回数を数える（K247-UI-009 と同じ見方） */
async function watchButton(page: Page): Promise<void> {
  await bandOf(page)
    .getByRole("button", { name: "承認して送る" })
    .evaluate((el) => {
      const w = window as unknown as { __k265btn: Element; __k265gone: number };
      w.__k265btn = el;
      w.__k265gone = 0;
      new MutationObserver((ms) => {
        for (const m of ms) for (const n of Array.from(m.removedNodes)) if (n === el || n.contains(el)) w.__k265gone++;
      }).observe(document, { childList: true, subtree: true });
    });
}
const buttonState = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __k265btn: Element; __k265gone: number };
    const now = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "承認して送る");
    return { connected: w.__k265btn.isConnected, gone: w.__k265gone, same: now === w.__k265btn };
  });

test("K265-UI-001 作る段が終わった読み直しの回で、作る段の実行の答えが遅れて届き、詳細がチケットをもう 1 回読んでも、「承認して送る」は同じ要素のまま外れずに残り、押すと確かめの小窓を通って承認の口が 1 回呼ばれ、帯が「実行中」に替わる", async ({
  page,
}) => {
  const m = await mockApi(page, { stage: "doing", can_delegate: true });
  let ticket: Band = { stage: "doing", can_delegate: true };
  let runs: Run[] = [];
  let gate: Promise<void> | null = null;
  // 口の答えは、承認の口が呼ばれたときにだけ承認の後の形に替わる（本物の口と同じ）
  const approveBase = m.on.approve;
  m.on.approve = (req) => {
    runs = [
      { id: EXEC, phase: "execute", status: "running" },
      { id: MAKE_1, phase: "make", status: "done" },
    ];
    ticket = { stage: "running" };
    return approveBase(req);
  };
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf(ticket) } });
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (req.method() === "POST" && p === `/api/v1/tickets/${TICKET}/delegate`) {
      runs = [{ id: MAKE_1, phase: "make", status: "running" }];
      ticket = { stage: "running" };
      return json(route, 201, { data: { run_id: MAKE_1, job_id: MAKE_1, status: "queued", pc: "live" } });
    }
    if (p === `/api/v1/tickets/${TICKET}/runs`)
      return json(route, 200, { data: runs.map(view), meta: { limit: 50 } });
    const one = /^\/api\/v1\/action_runs\/([^/]+)$/.exec(p);
    if (one) {
      if (one[1] === MAKE_1 && gate) await gate;
      const r = runs.find((x) => x.id === one[1]);
      return r ? json(route, 200, { data: view(r) }) : json(route, 404, { error: "not_found", code: "NOT_FOUND" });
    }
    return route.fallback();
  });

  await page.clock.install(); // 3 秒ごとの読み直しは時計を進めて起こす（待ち時間に頼らない）
  await openTicket(page);
  await k62Band(page).getByRole("button", { name: "AI に任せる" }).click();
  await expect(k62Band(page).getByText(MAKING)).toBeVisible();

  // 作る段が終わり承認待ちになった。作る段の実行の 1 件の答えは握っておく（CI の遅い台で後から届く形）
  let releaseRun = () => {};
  gate = new Promise<void>((r) => (releaseRun = r));
  runs = [{ id: MAKE_1, phase: "make", status: "done" }];
  ticket = { stage: "awaiting_approval", approval: pending() };
  await tickSettled(page);
  const send = bandOf(page).getByRole("button", { name: "承認して送る" });
  await expect(send).toBeVisible();
  await expect(bandOf(page)).not.toContainText(LATE_NOTE);
  await watchButton(page);

  // 遅れた答えを放す → 詳細がチケットをもう 1 回読む。その読みにだけ注の文を載せ、読んだ答えが帯に入ったことを文で見る
  ticket = { stage: "awaiting_approval", approval: pending({ note: LATE_NOTE }) };
  gate = null;
  releaseRun();
  await expect(bandOf(page)).toContainText(LATE_NOTE);
  expect(await buttonState(page), "遅れた読みの後も、承認して送るは同じ要素のまま").toEqual({
    connected: true,
    gone: 0,
    same: true,
  });

  // 押せる：確かめの小窓を通して承認の口が 1 回。口が受けた後の読み直しで「実行中」に替わる
  await approveVia(page, send);
  await expect.poll(() => m.approves.length).toBe(1);
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(bandOf(page).getByRole("button", { name: "承認して送る" })).toHaveCount(0);
});
