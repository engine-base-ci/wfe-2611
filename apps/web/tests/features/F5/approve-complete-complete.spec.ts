// K-183「完了にする」の画面の試験（実 Chrome・口は K-165）。親 K-63 の画面の試験を孫ごとに分けたもの（行 ID は分ける前のまま。K63-UI-040 は決める人の答え answer=bf373f5b265a で「済みは外せない」に直した）。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/approve-complete.md・タスクの列が K-183）＝試験 1 本。口は網の手前で差し替える。土台は ./approve-complete.harness.ts。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, row, rowsOf } from "../../_lib/row";
import { WIDTHS } from "../../_lib/api";
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
  dialog,
  bandOf,
  k62Band,
  noOverflow,
  executedBand,
  openComplete,
  confirmBox,
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
  const have = new Set(k60.map((r) => `（${r.role}）「${r.name}」`));
  expect([...banded, ...completing].filter((x) => !have.has(x))).toEqual([]);
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
  // 済み（- [x]）の項目のチェックは外せない（押せない・決める人の答え answer=bf373f5b265a）
  const m = await mockApi(page, { ...executedBand, todo: "- 請求書を作る\n- [x] 先方に送る" });
  await openTicket(page);
  await openComplete(page);
  const done = page.getByRole("checkbox", { name: "先方に送る" });
  await expect(done).toBeChecked();
  await expect(done).toBeDisabled();
  await done.click({ force: true }); // 押しても外れない
  await expect(done).toBeChecked();
  await page.getByRole("checkbox", { name: "請求書を作る" }).check();
  await confirmBox(page).check();
  await page.getByRole("button", { name: "確かめて完了にする" }).click();
  await expect.poll(() => m.completes.length).toBe(1);
  expect(m.completes[0]!["todo_checked"]).toEqual([0, 1]); // 済みの項目は入ったまま送る
});
row(R["K63-UI-041"], async (page) => {
  const m = await mockApi(page, executedBand);
  await openTicket(page);
  await openComplete(page);
  const b = page.getByRole("button", { name: "確かめて完了にする" });
  // どちらのチェックも入っていない間に押しても、口は呼ばずに理由を出す（ブラウザ標準の検証に止められない）。
  // 済み（- [x]）の項目は入ったまま外せないので数に入る（K63-UI-040）。ここは済みの項目が無い形
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
row(R["K63-UI-058"], async (page) => {
  const m = await mockApi(page, executedBand);
  await openTicket(page);
  await openComplete(page);
  await dialog(page).getByRole("checkbox", { name: "請求書を作る" }).check();
  await dialog(page).getByRole("button", { name: "やめる", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.completes).toHaveLength(0);
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toBeVisible();
});
