// K-183「完了にする」の画面の試験（実 Chrome・口は K-165・K-566）。親 K-63 の画面の試験を孫ごとに分けたもの（行 ID は分ける前のまま）。
//   K-572 で替えた：小窓は「本文と確認項目の未チェックの注意」（戻って付ける／このまま完了にする）になり、完了の口は { conditions_confirmed: true } だけを受ける。
//   実施事項の項目ごとのチェック・済みは外せない・確かめのチェック・E-VAL-022 は無くなったので、K63-UI-029・039・040・058 の行は消した（仕様 07_qa/test-specs/k/approve-complete.md の行も同じに消す）。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/approve-complete.md・タスクの列が K-183）＝試験 1 本。口は網の手前で差し替える。土台は ./approve-complete.harness.ts。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, row, rowsOf } from "../../_lib/row";
import { WIDTHS } from "../../_lib/api";
import { detailRows, isMayAppear } from "../../k/detail-kit";
import {
  ROWS,
  R,
  TICKET,
  CHILD,
  MSG,
  ticketOf,
  pending,
  mockApi,
  missingInMain,
  openTicket,
  openTicketSettled,
  tickSettled,
  dialog,
  bandOf,
  k62Band,
  noOverflow,
  executedBand,
  openComplete,
  type Band,
} from "./approve-complete.harness.js";

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
  // K-226 が詳細の本文と右のパネルに置いた操作要素（まだ使えない物も・D-145.9）は K-226 の一覧（detailRows）が受け持つ
  const k226 = detailRows(["目的", "完了の条件", "実施事項"]);
  const have = new Set([...k60, ...k226].map((r) => `（${r.role}）「${r.name}」`));
  // 後ろの葉が詳細に足す操作要素（本文を直す・親チケットを決める・区画の「開く」など・DETAIL_MAY_APPEAR）は、その葉の表が持つ（K226-UI-025 と同じ決まり）
  const may = (x: string) => isMayAppear(/「(.+)」$/.exec(x)?.[1] ?? x);
  expect([...banded, ...completing].filter((x) => !have.has(x) && !may(x))).toEqual([]);
});
row(R["K63-UI-026"], async (page) => {
  const m = await mockApi(page, { stage: "running", run: { phase: "execute", status: "running", pc: "live" } });
  await page.clock.install(); // 3 秒ごとの読み直しは、時計を進めて起こす（待ち時間に頼らない）
  await openTicketSettled(page);
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf(executedBand) } });
  await tickSettled(page);
  await expect(bandOf(page).getByText(MSG.completeHint)).toBeVisible();
  await expect(k62Band(page)).toHaveCount(0); // 承認の後の実行の間、K-62 の帯は出さない（D-128.178）
  await expect(page.getByText(/のAI が作っています|PC が起きるのを待っています/)).toHaveCount(0);
});
row(R["K63-UI-027"], async (page) => {
  await mockApi(page, executedBand);
  await openTicket(page);
  await expect(bandOf(page).getByText(MSG.completeHint)).toBeVisible();
  await openComplete(page);
  await expect(dialog(page)).toContainText("本文に、チェックのないやることが 2 つ残っています");
  await expect(dialog(page)).toContainText("請求書を作る");
  await expect(dialog(page)).toContainText("先方に送る");
});
row(R["K63-UI-028"], async (page) => {
  const m = await mockApi(page, executedBand);
  await openTicketSettled(page);
  await openComplete(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "done", completed: { at: new Date().toISOString(), by: "高本" } }) },
  });
  await dialog(page).getByRole("button", { name: "このまま完了にする", exact: true }).click();
  await expect.poll(() => m.completes.length).toBe(1);
  expect(m.completes[0]).toEqual({ conditions_confirmed: true });
  await expect(bandOf(page).getByText(/完了しました/)).toBeVisible();
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
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
  await dialog(page).getByRole("button", { name: "このまま完了にする", exact: true }).click();
  await expect(dialog(page)).toContainText(MSG.children);
  await expect(dialog(page).getByRole("link", { name: /EG-134 宛名を確かめる/ })).toHaveAttribute(
    "href",
    new RegExp(`/tickets/${CHILD}$`),
  );
});
row(R["K63-UI-031"], async (page) => {
  const m = await mockApi(page, { stage: "awaiting_approval", approval: pending(), can_complete: true });
  await openTicketSettled(page);
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
  await dialog(page).getByRole("button", { name: "このまま完了にする", exact: true }).click();
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
  await openTicketSettled(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "done", completed: { at: new Date().toISOString(), by: "高本" } }) },
  });
  await openComplete(page);
  const b = dialog(page).getByRole("button", { name: "このまま完了にする", exact: true });
  const release = m.hold();
  await b.click();
  await expect.poll(() => m.completes.length).toBe(1);
  await expect(b).toBeDisabled();
  await b.dispatchEvent("click");
  release();
  await expect(bandOf(page).getByText(/完了しました/)).toBeVisible();
  expect(m.completes).toHaveLength(1);
});
row(R["K63-UI-041"], async (page) => {
  // 「戻って付ける」：完了の口を呼ばずに小窓が閉じ、「完了にする」が残る（K-572）
  const m = await mockApi(page, executedBand);
  await openTicket(page);
  await openComplete(page);
  await dialog(page).getByRole("button", { name: "戻って付ける", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.completes).toHaveLength(0);
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toBeVisible();
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
    await expect(p.getByRole("button", { name: "AI に任せる", exact: true })).toBeVisible(); // 「AI に任せる」は題の行（K-573）。K-62 の帯は状態の知らせだけ
    await expect(k62Band(p).getByText(K62_STATE)).toHaveCount(0);
    await p.close();
  }
});
row(R["K63-UI-075"], async (page) => {
  const m = await mockApi(page, executedBand);
  await openTicket(page);
  await openComplete(page);
  await expect(dialog(page).getByRole("button", { name: "閉じる" })).toHaveCount(1);
  await dialog(page).locator(".k-dialog-head").getByRole("button", { name: "閉じる" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.completes).toHaveLength(0);
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toBeVisible();
});
