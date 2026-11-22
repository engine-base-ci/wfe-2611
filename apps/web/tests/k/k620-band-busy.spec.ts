// K-620「題名の下の帯の順の器 useBandOrder が数える approve を、AI が動いている・承認待ちの帯だけにする」の試験
//   （実 Chrome・実装より先に積む）。
//   直す前は、帯の入れ物 .k-detail-bands の直下に F5 の帯（section.k62-band）が 1 つでも在れば approve と数えていた。
//   そのため「AI に任せる」の任せる前の箱（白）や「完了にする」の箱（承認と実行の帯の ⑥）が出ているだけで、
//   渡しの帯（段 9 の HandoverBandSlot）と保留の帯（段 7 の HoldBandSlot）が譲って何も描かず、
//   担当者の欄（段 9 の AssigneeSlot）が AI が動いていないのに「AI の実行が終わってから渡してください」を出していた（K-416 の中間テストが見つけた）。
//   直した後の決まり：F5 の帯は、AI が動いている（作る段・承認の後の実行の queued・running・asking）か承認待ち（決める帯・承認待ちです・担当者なし）を
//   出している間だけ、帯の section に data-busy を付ける。帯の順の器は「:scope > section.k62-band[data-busy]」が在るときだけ approve と数える。
//   帯の section は状態が替わっても同じ要素のまま（React が作り直さない）ので、器は data-busy の付け外しも見張る。
//   口は網の手前で差し替える（前からの土台 tests/features/F5/approve-complete.harness.ts）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import {
  RUN_ID,
  TICKET,
  mockApi,
  openTicket,
  pending,
  ticketOf,
  type Band,
  type Mock,
} from "../features/F5/approve-complete.harness";

const bands = (page: Page) => page.locator("article.k-detail-card .k-detail-bands");
const delegateBand = (page: Page) => page.getByRole("region", { name: "AI に任せる" });
const approveBand = (page: Page) => page.getByRole("region", { name: "承認と実行" });

async function openWith(page: Page, b: Band): Promise<{ m: Mock; errors: string[] }> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const m = await mockApi(page, b);
  await openTicket(page, 1440);
  return { m, errors };
}

/** 帯の入れ物に approve が数えられていない（data-shown の属性が無い） */
const notCounted = async (page: Page) => {
  await expect(bands(page)).not.toHaveAttribute("data-shown", /.*/);
};
const counted = async (page: Page) => {
  await expect(bands(page)).toHaveAttribute("data-shown", "approve");
};
const busy = (loc: Locator) => expect(loc).toHaveAttribute("data-busy", /.*/);
const notBusy = (loc: Locator) => expect(loc).not.toHaveAttribute("data-busy", /.*/);

test("K620-UI-001 作業中・任せる前（can.delegate・走っている実行なし・完了にできない）：「AI に任せる」の白い箱が見え、その帯に data-busy が無く、帯の入れ物の data-shown が無い（渡し・保留の帯に譲らせない）", async ({
  page,
}) => {
  const { errors } = await openWith(page, { stage: "doing", can_delegate: true });
  await expect(delegateBand(page).getByRole("button", { name: "AI に任せる" })).toBeVisible();
  await expect(bands(page).locator(":scope > *")).toHaveCount(1);
  await notBusy(delegateBand(page));
  await notCounted(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K620-UI-002 作業中・完了にできて任せられる（承認と実行の帯の ⑥「完了にする」と任せる前の箱が両方出る）：どちらの帯にも data-busy が無く、data-shown が無い", async ({
  page,
}) => {
  const { errors } = await openWith(page, { stage: "doing", can_delegate: true, can_complete: true });
  await expect(approveBand(page).getByRole("button", { name: "完了にする", exact: true })).toBeVisible();
  await expect(delegateBand(page).getByRole("button", { name: "AI に任せる" })).toBeVisible();
  await notBusy(approveBand(page));
  await notBusy(delegateBand(page));
  await notCounted(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K620-UI-003 作る段の実行が queued・running・asking：「AI に任せる」の帯に data-busy が付き、data-shown は approve", async ({
  page,
}) => {
  for (const status of ["queued", "running", "asking"] as const) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const { errors } = await openWith(page, { stage: "doing", can_delegate: true, run: { phase: "make", status } });
    await expect(delegateBand(page)).toBeVisible();
    await expect(delegateBand(page).getByRole("button", { name: "AI に任せる" }), status).toHaveCount(0);
    await busy(delegateBand(page));
    await counted(page);
    expect(errors, `${status}: ${errors.join("\n")}`).toEqual([]);
  }
});

test("K620-UI-004 作る段の実行が stopped・cancelled（任せられる）：赤い箱（role=alert）が見え、「AI に任せる」の帯に data-busy が無く、data-shown が無い", async ({
  page,
}) => {
  for (const status of ["stopped", "cancelled"] as const) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const { errors } = await openWith(page, {
      stage: "doing",
      can_delegate: true,
      run: { phase: "make", status, stopped_reason: "PC が応答しませんでした" },
    });
    await expect(delegateBand(page).getByRole("alert")).toBeVisible();
    await notBusy(delegateBand(page));
    await notCounted(page);
    expect(errors, `${status}: ${errors.join("\n")}`).toEqual([]);
  }
});

test("K620-UI-005 承認待ち・決める人：「承認と実行」の帯に data-busy が付き、data-shown は approve", async ({
  page,
}) => {
  const { errors } = await openWith(page, { stage: "awaiting_approval", approval: pending() });
  await expect(approveBand(page)).toBeVisible();
  await busy(approveBand(page));
  await counted(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K620-UI-006 承認待ち・決められない人（担当者あり）：「AI に任せる」の帯の「成果物ができました。承認待ちです」に data-busy が付き、data-shown は approve", async ({
  page,
}) => {
  const { errors } = await openWith(page, { stage: "awaiting_approval", approval: pending({ can_decide: false }) });
  await expect(delegateBand(page).getByText("成果物ができました。承認待ちです")).toBeVisible();
  await expect(approveBand(page)).toHaveCount(0);
  await busy(delegateBand(page));
  await counted(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K620-UI-007 承認待ち・担当者なし：「承認と実行」の帯の「担当者がいないので、承認する人がいません。…」に data-busy が付き、data-shown は approve", async ({
  page,
}) => {
  const { errors } = await openWith(page, {
    stage: "awaiting_approval",
    approval: pending({ can_decide: false }),
    assignee: null,
  });
  await expect(approveBand(page).getByText("担当者がいないので、承認する人がいません")).toBeVisible();
  await busy(approveBand(page));
  await counted(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K620-UI-008 承認の後の実行が running（PC 開）・running（PC 閉）・asking・queued（PC 閉）：「承認と実行」の帯（実行中／実行中・PC が閉じています／許可を求めています／実行待ち）に data-busy が付き、data-shown は approve", async ({
  page,
}) => {
  const cases = [
    { status: "running", pc: "live", text: "実行中" },
    { status: "running", pc: "asleep", text: "実行中・PC が閉じています。開くと続きます" },
    { status: "asking", pc: "live", text: "AI が許可を求めています。許可は自動で断られ、続けられなければ止まります" },
    { status: "queued", pc: "asleep", text: "実行待ち ・ PC が閉じています" },
  ] as const;
  for (const c of cases) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const { errors } = await openWith(page, { stage: "doing", run: { phase: "execute", status: c.status, pc: c.pc } });
    await expect(approveBand(page).getByText(c.text, { exact: true })).toBeVisible();
    await busy(approveBand(page));
    await counted(page);
    expect(errors, `${c.status}: ${errors.join("\n")}`).toEqual([]);
  }
});

test("K620-UI-009 承認の後の実行が止まった（⑤）・完了（⑦）：「承認と実行」の帯（実行が止まりました／完了しました）に data-busy が無く、data-shown が無い", async ({
  page,
}) => {
  const cases: { b: Band; text: RegExp }[] = [
    {
      b: {
        stage: "doing",
        can_complete: true,
        run: { phase: "execute", status: "stopped", pc: "live", stopped_reason: "PC が応答しませんでした" },
      },
      text: /実行が止まりました/,
    },
    { b: { stage: "done", completed: { at: "2026-11-08T06:20:00Z", by: "高本" } }, text: /完了しました/ },
  ];
  for (const c of cases) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    const { errors } = await openWith(page, c.b);
    await expect(approveBand(page).getByText(c.text)).toBeVisible();
    await notBusy(approveBand(page));
    await notCounted(page);
    expect(errors, `${c.b.stage}: ${errors.join("\n")}`).toEqual([]);
  }
});

test("K620-UI-010 切り替わり（任せる前 → 任せました）：「AI に任せる」を押して口が 202 を返すと、同じ帯の要素のまま「任せました」に替わり、data-busy が付いて data-shown が approve になる", async ({
  page,
}) => {
  const { m, errors } = await openWith(page, { stage: "doing", can_delegate: true });
  await notCounted(page);
  // 帯の要素に試験の印を付ける（作り直されずに同じ要素のまま data-busy が付くことを見る）
  await delegateBand(page).evaluate((el) => el.setAttribute("data-k620", "same"));
  const queued: Band = { stage: "doing", can_delegate: true, run: { phase: "make", status: "queued" } };
  await page.route(`**/api/v1/tickets/${TICKET}/delegate`, async (route: Route) => {
    m.on.ticket = () => ({ status: 200, body: { data: ticketOf(queued) } });
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ data: { run_id: RUN_ID } }),
    });
  });
  await delegateBand(page).getByRole("button", { name: "AI に任せる" }).click();
  await expect(delegateBand(page).getByText(/に任せました。/)).toBeVisible();
  await expect(delegateBand(page)).toHaveAttribute("data-k620", "same");
  await busy(delegateBand(page));
  await counted(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K620-UI-011 切り替わり（作っています → 止まった）：読み直しで実行が stopped になると、同じ帯の要素のまま data-busy が外れ、data-shown が無くなる", async ({
  page,
}) => {
  const { m, errors } = await openWith(page, {
    stage: "doing",
    can_delegate: true,
    run: { phase: "make", status: "running" },
  });
  await counted(page);
  await delegateBand(page).evaluate((el) => el.setAttribute("data-k620", "same"));
  const stopped: Band = {
    stage: "doing",
    can_delegate: true,
    run: { phase: "make", status: "stopped", stopped_reason: "PC が応答しませんでした" },
  };
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf(stopped) } });
  // 走っている間は 3 秒ごとに読み直す（K-62 の use-run）。固定の待ちは置かず、帯が替わるのを待つ
  await expect(delegateBand(page).getByRole("alert")).toBeVisible();
  await expect(delegateBand(page)).toHaveAttribute("data-k620", "same");
  await notBusy(delegateBand(page));
  await notCounted(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K620-UI-012 印だけの付け外し：作っています（approve）の帯から、中身を替えずに data-busy だけを外すと data-shown が無くなり、付け直すと approve に戻る（見張りが印の付け外しを見る）", async ({
  page,
}) => {
  const { errors } = await openWith(page, {
    stage: "doing",
    can_delegate: true,
    run: { phase: "make", status: "running" },
  });
  await counted(page);
  await delegateBand(page).evaluate((el) => el.removeAttribute("data-busy"));
  await notCounted(page);
  await delegateBand(page).evaluate((el) => el.setAttribute("data-busy", ""));
  await counted(page);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("K620-UI-013 任せる前に押して口が 429：「押しすぎです。…」の知らせと任せる前の箱が見え、「AI に任せる」の帯に data-busy が無く、data-shown が無い（知らせは数えに入らない）", async ({
  page,
}) => {
  const { errors } = await openWith(page, { stage: "doing", can_delegate: true });
  await page.route(`**/api/v1/tickets/${TICKET}/delegate`, async (route: Route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { "Retry-After": "60" },
      body: JSON.stringify({ error: "rate_limited", code: "RATE_LIMITED" }),
    });
  });
  await delegateBand(page).getByRole("button", { name: "AI に任せる" }).click();
  await expect(delegateBand(page).getByText(/押しすぎです。/)).toBeVisible();
  await expect(delegateBand(page).getByRole("button", { name: "AI に任せる" })).toBeVisible();
  await notBusy(delegateBand(page));
  await notCounted(page);
  expect(errors, errors.join("\n")).toEqual([]);
});
