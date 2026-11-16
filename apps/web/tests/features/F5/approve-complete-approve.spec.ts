// K-162「承認する（承認して実行の仕事を積む）」の画面の試験（実 Chrome）。親 K-63 の画面の試験を孫ごとに分けたもの（行 ID と中身は分ける前のまま）。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/approve-complete.md・タスクの列が K-162）＝試験 1 本。口は網の手前で差し替える。土台は ./approve-complete.harness.ts。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { expect, row } from "../../_lib/row";
import {
  R,
  A_INLINE,
  A_OPEN,
  MSG,
  QUEUE,
  ticketOf,
  pending,
  mockApi,
  menuCount,
  openQueue,
  openTicket,
  openTicketSettled,
  tickSettled,
  rowOf,
  dialog,
  bandOf,
} from "./approve-complete.harness.js";
import { approveVia, confirmButton } from "../../k/approve-modal";

row(R["K63-UI-002"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  const after = QUEUE().filter((x) => x.id !== A_INLINE);
  m.on.queue = () => ({ status: 200, body: { data: after, meta: { limit: 20, counts: { total: 2 } } } });
  await approveVia(page, rowOf(page, "見積を出す").getByRole("button", { name: "承認する", exact: true })); // 確かめの小窓を通す（K-229・D-143.4）
  await expect(rowOf(page, "見積を出す")).toHaveCount(0);
  expect(m.approves).toHaveLength(1);
  expect(m.approves[0]).toMatchObject({ id: A_INLINE, body: {} });
  expect(m.approves[0]!.key).toBeTruthy();
  await expect(page.getByRole("main").getByText("2 件", { exact: true })).toBeVisible(); // 見出しの横の数が 1 減る
  await menuCount(page, 2); // 1440 の左のメニューの「承認待ち」の数も 1 減る
});
row(R["K63-UI-012"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  m.on.approve = () => ({ status: 409, body: { error: "conflict", code: "E-CONF-003", message: MSG.decided } });
  const before = m.queueReads;
  m.on.queue = () => ({
    status: 200,
    body: { data: QUEUE().filter((x) => x.id !== A_INLINE), meta: { limit: 20, counts: { total: 2 } } },
  });
  await approveVia(page, rowOf(page, "見積を出す").getByRole("button", { name: "承認する", exact: true })); // 確かめの小窓を通す（K-229・D-143.4）
  await expect(page.getByRole("alert").filter({ hasText: MSG.decided })).toBeVisible();
  await expect.poll(() => m.queueReads).toBeGreaterThan(before);
  await expect(rowOf(page, "見積を出す")).toHaveCount(0);
});
row(R["K63-UI-013"], async (page) => {
  const m = await mockApi(page);
  await openQueue(page);
  const release = m.hold();
  await rowOf(page, "見積を出す").getByRole("button", { name: "承認する", exact: true }).click();
  // 確かめの小窓（K-229・D-143.4）の主ボタンを押す。答えの前は小窓の主ボタンも行のボタンも押せない
  const b = confirmButton(page);
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
    body: { data: QUEUE().filter((x) => x.id !== A_INLINE), meta: { limit: 20, counts: { total: 2 } } },
  });
  await approveVia(page, rowOf(page, "見積を出す").getByRole("button", { name: "承認する", exact: true })); // 確かめの小窓を通す（K-229・D-143.4）
  await expect(page.getByRole("alert").filter({ hasText: MSG.gone })).toBeVisible();
  await expect(rowOf(page, "見積を出す")).toHaveCount(0);
});
row(R["K63-UI-022"], async (page) => {
  const m = await mockApi(page);
  await openTicketSettled(page);
  m.on.ticket = () => ({
    status: 200,
    body: { data: ticketOf({ stage: "running", run: { phase: "execute", status: "running", pc: "live" } }) },
  });
  await approveVia(page, bandOf(page).getByRole("button", { name: "承認して送る" })); // 確かめの小窓を通す（K-229・D-143.4）
  await expect.poll(() => m.approves.length).toBe(1);
  expect(m.approves[0]).toMatchObject({ id: A_OPEN, body: {} });
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  expect(m.stepUps).toHaveLength(0); // 本人確認を取り直さない（D-128.177）
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0); // 送った後は確かめの小窓も閉じる
});
row(R["K63-UI-044"], async (page) => {
  // 開いたままのチケットで、作る段が終わって承認待ちになったら、読み直しで承認の帯に替わる
  const m = await mockApi(page, { stage: "running", run: { phase: "make", status: "running", pc: "live" } });
  await page.clock.install(); // 3 秒ごとの読み直しは、時計を進めて起こす（待ち時間に頼らない）
  await openTicketSettled(page);
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
  await tickSettled(page);
  await expect(bandOf(page)).toContainText(MSG.waitingMe);
  await expect(bandOf(page).getByRole("button", { name: "承認して送る" })).toBeVisible();
  await expect(page.getByText(MSG.k62Waiting)).toHaveCount(0);
});

// ---- 回 1・回 2 の精査で足した行（D-131）----
row(R["K63-UI-049"], async (page) => {
  // 担当者がいない：承認する人がいない。帯は文だけでボタンなし
  await mockApi(page, {
    stage: "awaiting_approval",
    approval: pending({ can_decide: false, approver_name: null }),
    assignee: null,
  });
  await openTicket(page);
  await expect(bandOf(page).getByText(MSG.noAssignee)).toBeVisible();
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "差し戻す" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "承認する", exact: true })).toHaveCount(0);
});
