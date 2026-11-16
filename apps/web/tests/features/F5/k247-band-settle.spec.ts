// K-247「承認の帯の画面の試験が、CI で時々 1 分の時間切れになる」の試験（実 Chrome・実装より先に積む）。
//   原因（調べた事実）：試験が画面を開いた直後（見出しが出た時点）に口の答え（m.on.ticket）を替える。実行の一覧（/runs）の最初の答えは
//   まだ届いていないことがあり、届くと替えた後の答え（承認の後の実行が走っている）が帰る。帯は走っている実行を見てチケットを読み直し、
//   承認の帯（承認して送る）を消す。押す前にボタンが消え、押す操作が 60 秒待って落ちる。遅い台ほど起きる。
//   直し方：開く道具 openTicketSettled と、時計を進める道具 tickSettled（試験の土台 approve-complete.harness.ts）は、
//   そのとき出た実行の一覧の読みの答えが届くまで返らない。答えを替える行はこの道具で開く・進める。製品のコードは変えない。
//   遅い台は、一覧の答えを網の手前で止めて作る（時間で待たない）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import * as H from "./approve-complete.harness.js";
import {
  A_OPEN,
  MSG,
  TICKET,
  bandOf,
  dialog,
  k62Band,
  mockApi,
  pending,
  reasonBox,
  ticketOf,
  type Mock,
} from "./approve-complete.harness.js";
import { approveVia, confirmButton } from "../../k/approve-modal";

/** 実装の段で土台に足す道具（今は無い。無ければ呼んだ所で赤になる） */
type Settle = (page: Page, width?: number) => Promise<void>;
const tool = (name: "openTicketSettled" | "tickSettled"): Settle => {
  const f = (H as unknown as Record<string, unknown>)[name];
  if (typeof f !== "function") throw new Error(`試験の土台 approve-complete.harness.ts に ${name} が無い`);
  return f as Settle;
};
const openTicketSettled: Settle = (page, width) => tool("openTicketSettled")(page, width);
const tickSettled: Settle = (page) => tool("tickSettled")(page);

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = `/api/v1/tickets/${TICKET}/runs`;
const approveBtn = (page: Page) => bandOf(page).getByRole("button", { name: "承認して送る" });

/** 実行の一覧の答えを止める（遅い台の代わり）。listAsked が問い合わせの数・release で答える */
async function slowRuns(page: Page) {
  const s = { asked: 0, release: () => {} };
  let gate = new Promise<void>((r) => (s.release = r));
  await page.route(`**${RUNS}`, async (route) => {
    s.asked++;
    await gate;
    await route.fallback();
  });
  return {
    s,
    /** 次の問い合わせからまた止める */
    hold: () => {
      gate = new Promise<void>((r) => (s.release = r));
    },
  };
}

/** 道具を呼んだ時点で印を付ける。done は道具が返ったときにだけ true になる（時間で待たず、答えを握っている間の今の様子を見る） */
function track(p: Promise<void>) {
  const t = { done: false, p };
  p.then(
    () => (t.done = true),
    () => undefined, // 失敗は await t.p で試験に返す
  );
  return t;
}

/** 一覧の答えを止めたまま開き、見出しが出て一覧を読みに行ったのに道具が返っていないことを見てから離す */
async function openWithSlowRuns(page: Page) {
  const slow = await slowRuns(page);
  const opening = track(openTicketSettled(page));
  await expect(page.getByRole("heading", { level: 1, name: /11 月分の請求書を送る/ })).toBeVisible();
  await expect.poll(() => slow.s.asked).toBeGreaterThan(0);
  expect(opening.done, "一覧の答えが届く前に開く道具が返った").toBe(false);
  slow.s.release();
  await opening.p;
  expect(opening.done).toBe(true);
  return slow;
}

/** 承認の帯のボタンの節を掴み、その節が消えた回数を数え始める */
async function watchNode(page: Page) {
  await approveBtn(page).evaluate((el) => {
    const w = window as unknown as { __k247btn: Element; __k247gone: number };
    w.__k247btn = el;
    w.__k247gone = 0;
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of Array.from(m.removedNodes)) if (n === el || n.contains(el)) w.__k247gone++;
    }).observe(document, { childList: true, subtree: true });
  });
}
const nodeState = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __k247btn: Element; __k247gone: number };
    const now = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "承認して送る");
    return { connected: w.__k247btn.isConnected, gone: w.__k247gone, same: now === w.__k247btn };
  });

/** チケットの読みの数（読み直しが本当に入ったかを数える） */
const countTicketReads = (page: Page) => {
  const c = { n: 0 };
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === `/api/v1/tickets/${TICKET}`) c.n++;
  });
  return c;
};

/** 読み直しが続く承認待ち（24 時間の聞き直し・承認の後の実行は PC が閉じていて待っている） */
const reaskBand = {
  stage: "awaiting_approval",
  approval: pending({ note: MSG.note24h }),
  run: { phase: "execute", status: "queued", pc: "asleep" },
};

test("K247-UI-001 開く道具 openTicketSettled：実行の一覧の最初の答えを止めている間は返らない。離すと返り、そのとき帯は最初の答えのとおり（承認の帯・「承認して送る」が 1 件）", async ({
  page,
}) => {
  await mockApi(page);
  await openWithSlowRuns(page);
  await expect(approveBtn(page)).toHaveCount(1);
  await expect(bandOf(page)).toContainText(MSG.waitingMe);
});

test("K247-UI-002 K63-UI-022 の形（開いた後に答えを承認の後の実行中に替えて「承認して送る」）を、実行の一覧の答えが遅い台で流す：ボタンは押せ、承認の口に 1 回届き、帯が「実行中」に替わる", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openWithSlowRuns(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "running", pc: "live" } }) },
  });
  await approveVia(page, approveBtn(page)); // 確かめの小窓を通す（K-229・D-143.4）
  await expect.poll(() => m.approves.length).toBe(1);
  expect(m.approves[0]).toMatchObject({ id: A_OPEN, body: {} });
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
});

test("K247-UI-003 K63-UI-043 の形（押した時点で決まっていた 409）を、実行の一覧の答えが遅い台で流す：ボタンは押せ、知らせ（role=alert）に「この承認はもう処理されています」、帯は「実行中」に替わりボタンは消える", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openWithSlowRuns(page);
  m.on.approve = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "queued", pc: "live" } }) },
  });
  await approveVia(page, approveBtn(page)); // 確かめの小窓を通す（K-229）
  await expect(page.getByRole("alert").filter({ hasText: MSG.decided })).toBeVisible();
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(approveBtn(page)).toHaveCount(0);
});

test("K247-UI-004 K63-UI-024 の形（開いた後に答えを作り直しの実行に替えて帯の「差し戻す」）を、実行の一覧の答えが遅い台で流す：小窓が開き、差し戻しの口に { note } が 1 回届き、小窓が閉じ、K-63 の帯は出ない", async ({
  page,
}) => {
  const m = await mockApi(page);
  await openWithSlowRuns(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "make", status: "queued", pc: "live" } }) },
  });
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  await reasonBox(page).fill("宛名を直してください");
  await page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true }).click();
  await expect.poll(() => m.returns.length).toBe(1);
  expect(m.returns[0]).toEqual({ id: A_OPEN, body: { note: "宛名を直してください" } });
  await expect(dialog(page)).toHaveCount(0);
  await expect(bandOf(page)).toHaveCount(0);
});

test("K247-UI-005 K63-UI-044 の形（作る段の間に開き、答えを承認待ちに替えて時計を 3 秒進める）を、実行の一覧の答えが遅い台で流す：承認の帯（「あなたの承認を待っています」・承認して送る）に替わる", async ({
  page,
}) => {
  const m = await mockApi(page, { stage: "running", run: { phase: "make", status: "running", pc: "live" } });
  await page.clock.install();
  await openWithSlowRuns(page);
  await expect(bandOf(page)).toHaveCount(0);
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
  await tickSettled(page);
  await expect(bandOf(page)).toContainText(MSG.waitingMe);
  await expect(approveBtn(page)).toBeVisible();
});

test("K247-UI-006 時計を進める道具 tickSettled：その読み直しで出た実行の一覧の答えを止めている間は返らない。離すと返る", async ({
  page,
}) => {
  await mockApi(page, { stage: "running", run: { phase: "make", status: "running", pc: "live" } });
  await page.clock.install();
  const slow = await openWithSlowRuns(page);
  const before = slow.s.asked;
  slow.hold();
  const ticking = track(tickSettled(page));
  await expect.poll(() => slow.s.asked).toBeGreaterThan(before);
  expect(ticking.done, "読み直しの一覧の答えが届く前に時計の道具が返った").toBe(false);
  slow.s.release();
  await ticking.p;
  expect(ticking.done).toBe(true);
  await expect(k62Band(page)).toBeVisible();
});

/** 試験のファイルの行（row(R["…"]) の塊）ごとに、中身を返す */
function rowBlocks(file: string): { id: string; body: string }[] {
  const src = readFileSync(join(HERE, file), "utf8");
  return src
    .split(/\n(?=row\(R\[")/)
    .slice(1)
    .map((b) => ({ id: /^row\(R\["([^"]+)"/.exec(b)![1]!, body: b }));
}
const SPECS = [
  "approve-complete-approve.spec.ts",
  "approve-complete-complete.spec.ts",
  "approve-complete-execute.spec.ts",
  "approve-complete-guard.spec.ts",
  "approve-complete-queue.spec.ts",
  "approve-complete-return.spec.ts",
];

test("K247-UI-007 同じ形が残っていない：承認と完了の画面の試験（approve-complete-*.spec.ts）で、開いた後・最初の再読み込み（reload・goto）より前に答え（m.on.ticket）を替える行は、どれも openTicket ではなく openTicketSettled で開く（該当 0 件）", async () => {
  const bad: string[] = [];
  let seen = 0;
  for (const f of SPECS) {
    for (const { id, body } of rowBlocks(f)) {
      const swap = body.indexOf("m.on.ticket =");
      const open = body.search(/\bopenTicket(Settled)?\(/);
      if (swap < 0 || open < 0 || open > swap) continue;
      if (/\.(reload|goto)\(/.test(body.slice(open, swap))) continue;
      seen++;
      if (/\bopenTicket\(/.test(body.slice(0, swap))) bad.push(`${f} ${id}`);
    }
  }
  expect(seen, "答えを替える行が 1 つも見つからない（読み方が壊れている）").toBeGreaterThan(0);
  expect(bad).toEqual([]);
});

test("K247-UI-008 同じ形が残っていない：開いたままの試験（approve-complete-live.spec.ts）は、時計を進める読み直しを tickSettled でする（素の page.clock.fastForward を使う所が 0 件・承認の帯が出るまでの道具 delegatedAndMade も含む）", async () => {
  const src = readFileSync(join(HERE, "approve-complete-live.spec.ts"), "utf8");
  expect(src).toContain("tickSettled");
  expect(src.match(/\.clock\.fastForward\(/g) ?? []).toEqual([]);
});

test("K247-UI-009 守り（製品）：読み直しが続く承認待ち（24 時間の聞き直し・実行待ちで PC が閉じている）で時計を 3 秒ずつ 10 回進めても、「承認して送る」は同じ節のまま（作り直し 0 回・消えない）。チケットの読み直しは 5 回以上入る", async ({
  page,
}) => {
  await mockApi(page, reaskBand);
  const reads = countTicketReads(page);
  await page.clock.install();
  await openTicketSettled(page);
  await expect(approveBtn(page)).toBeVisible();
  await watchNode(page);
  const before = reads.n;
  for (let i = 0; i < 10; i++) await tickSettled(page);
  await expect.poll(() => reads.n - before).toBeGreaterThanOrEqual(5);
  expect(await nodeState(page)).toEqual({ connected: true, gone: 0, same: true });
});

test("K247-UI-010 守り（製品）：押して答えを待っている間に読み直しが 2 回入っても、承認の口は 1 回だけで、ボタンは押せないまま。答えの後は帯が「実行待ち・PC が閉じています…」に替わる", async ({
  page,
}) => {
  const m: Mock = await mockApi(page, reaskBand);
  await page.clock.install();
  await openTicketSettled(page);
  const release = m.hold();
  await approveVia(page, approveBtn(page)); // 確かめの小窓を通す（K-229）
  await expect.poll(() => m.approves.length).toBe(1);
  await tickSettled(page);
  await tickSettled(page);
  // 答えを待つ間は確かめの小窓（K-229）が開いたまま。帯は小窓の外で読み上げの木から外れるので、小窓の主ボタンで見る
  await expect(confirmButton(page)).toBeDisabled();
  expect(m.approves).toHaveLength(1);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "queued", pc: "asleep" } }) },
  });
  release();
  await expect(bandOf(page).getByText(MSG.pcClosed)).toBeVisible();
  await expect(approveBtn(page)).toHaveCount(0);
  expect(m.approves).toHaveLength(1);
});

test("K247-UI-011 守り（製品）：差し戻しの小窓を開いて理由を書いている間に読み直しが 5 回入っても、小窓は閉じず、書いた文がそのまま残る", async ({
  page,
}) => {
  await mockApi(page, reaskBand);
  await page.clock.install();
  await openTicketSettled(page);
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  await reasonBox(page).fill("宛名を直してください");
  for (let i = 0; i < 5; i++) await tickSettled(page);
  await expect(dialog(page)).toHaveCount(1);
  await expect(reasonBox(page)).toHaveValue("宛名を直してください");
});

test("K247-UI-012 守り（製品）：読み直しで帯の中身（聞き直しの注の文）が替わったときは、その文だけが新しくなり、「承認して送る」は同じ節のまま", async ({
  page,
}) => {
  const NEW_NOTE = "承認から 24 時間を過ぎました（2 回目）。実行の前にもう一度確かめてください";
  const m = await mockApi(page, reaskBand);
  await page.clock.install();
  await openTicketSettled(page);
  await expect(bandOf(page)).toContainText(MSG.note24h);
  await watchNode(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ ...reaskBand, approval: pending({ note: NEW_NOTE }) }) },
  });
  await tickSettled(page);
  await expect(bandOf(page)).toContainText(NEW_NOTE);
  await expect(bandOf(page).getByText(MSG.note24h)).toHaveCount(0);
  expect(await nodeState(page)).toEqual({ connected: true, gone: 0, same: true });
});
