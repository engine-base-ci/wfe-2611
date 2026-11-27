// K-734「画面：止める（任せる帯・承認の後の実行・承認の帯の［止める］・確かめの小窓・止めた後の帯・断られたときの知らせ）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5/stop-*（代表が OK を出した段 6 の下絵）。字・並び・ボタンは下絵が正。
//   詳細と帯は前からの土台（approve-complete.harness.ts の mockApi）。止める口 stopActionRun（K-731）・stopApproval（K-732）と止めた後の実行は、
//   段 6 の道具 f5-more-kit.ts の layer で網の手前に重ねる（口の葉と同時に書いているため。答えの形は 11_tickets/K-731.md・K-732.md）。
//   固定の待ちは使わない。name は exact。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  A_OPEN,
  bandOf,
  k62Band,
  mockApi,
  openTicket,
  pending,
  ticketOf,
  type Band,
  type Mock,
} from "../features/F5/approve-complete.harness";
import {
  BAND_PAIRS,
  DIALOG_PAIRS,
  DOWN,
  NOT_FOUND,
  RUN_ID,
  STOPPED_AT,
  TARGET,
  TICKET,
  WIDTHS,
  SHEET_GAP,
  confirmOf,
  layer,
  msg,
  noOverflow,
  noticeOf,
  refuse,
  runReplies,
  runRow,
  trailOf,
  type Writes,
} from "./f5-more-kit";
import { matchMock } from "./stage2-match";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const STOP_RUN = /^\/api\/v1\/action_runs\/[^/]+\/stop$/;
const STOP_APPROVAL = /^\/api\/v1\/approvals\/[^/]+\/stop$/;
const MSG = {
  runTitle: "AI を止めます",
  runBody: `${TARGET}。山田のAI の作業を止めます（止められるのは担当者だけです）。止めたあとに届いた結果は使いません。もう一度 AI に任せることもできます`,
  apTitle: "承認待ちの成果物を使わずに止めます",
  apBody: `${TARGET}。この成果物は送りません。チケットは作業中に戻ります（止められるのは承認する人だけです）`,
  stoppedTitle: "山田のAI を止めました",
  stoppedSub: "高本が 11/01 10:40 に止めました。止める前にできていた物は残っています",
  conflict: "この AI はもう止まっていました。表示を読み直しました",
  apStopped: "承認待ちの成果物を止めました",
  apStoppedSub: "この成果物は送っていません。チケットは作業中に戻りました",
  apDenied: "承認待ちを止められるのは、承認する人だけです",
} as const;

interface Stop {
  m: Mock;
  w: Writes;
  /** 今の実行（null なら土台の実行） */
  run: Record<string, unknown> | null;
}
/** 作る段・承認の後の実行が走っているチケットで、止める口を重ねる。201 の後は止まった実行を答える */
async function mockStop(page: Page, phase: "make" | "execute" = "make", status = "running"): Promise<Stop> {
  const band: Band =
    phase === "make"
      ? { stage: "running", run: { phase, status, pc: "live" } }
      : { stage: "running", run: { phase, status, pc: "live" } };
  const m = await mockApi(page, band);
  const s: Stop = { m, w: undefined as unknown as Writes, run: runRow({ phase, status }) };
  const runs = runReplies(() => s.run);
  s.w = await layer(page, (req, path) => {
    if (req.method() === "POST" && STOP_RUN.test(path)) {
      s.run = runRow({ phase, status: "stopped", stopped_reason: "高本が止めました", finished_at: STOPPED_AT });
      m.on.ticket = () => ({ status: 200, body: { data: ticketOf({ stage: "doing", can_delegate: true }) } });
      return {
        status: 201,
        body: {
          data: {
            id: RUN_ID,
            ticket_id: TICKET,
            phase,
            status: "stopped",
            stopped_reason: "高本が止めました",
            stopped_at: STOPPED_AT,
          },
        },
      };
    }
    if (path === `/api/v1/tickets/${TICKET}/timeline`) return null;
    return runs(path);
  });
  return s;
}
/** 承認待ち（承認する人）で、承認待ちを止める口を重ねる。201 の後のチケットは作業中 */
async function mockStopApproval(page: Page): Promise<{ m: Mock; w: Writes }> {
  const m = await mockApi(page, { stage: "awaiting_approval", approval: pending() });
  const w = await layer(page, (req, path) => {
    if (req.method() === "POST" && STOP_APPROVAL.test(path)) {
      m.on.ticket = () => ({ status: 200, body: { data: ticketOf({ stage: "doing", can_delegate: true }) } });
      return {
        status: 201,
        body: {
          data: {
            id: A_OPEN,
            decision: "stop",
            decided_at: new Date().toISOString(),
            status_id: "stopped",
            ticket_id: TICKET,
          },
        },
      };
    }
    return null;
  });
  return { m, w };
}
const stopBtn = (page: Page, region: "AI に任せる" | "承認と実行") =>
  page.getByRole("region", { name: region, exact: true }).getByRole("button", { name: "止める", exact: true });
const confirmStop = (page: Page) =>
  confirmOf(page).locator(".k-dialog-actions").getByRole("button", { name: "止める", exact: true });
const nowStamp = () => {
  const d = new Date(Date.now() + 9 * 3600_000).toISOString();
  return `${d.slice(5, 7)}/${d.slice(8, 10)}`;
};

// ---------------------------------------------------------------- 動いている実行を止める（作る段）

test("K734-UI-001 入口：作る段の実行が running の青い箱の「止める」は押せる形で、押すと口を呼ばずに小窓「AI を止めます」が開く（本文と足「やめる」「止める」）", async ({
  page,
}) => {
  const s = await mockStop(page);
  await openTicket(page);
  const b = stopBtn(page, "AI に任せる");
  await expect(b).toBeEnabled();
  await expect(b).not.toHaveAttribute("aria-disabled", "true");
  await b.click();
  const d = confirmOf(page);
  await expect(d.getByRole("heading", { name: MSG.runTitle, exact: true })).toBeVisible();
  await expect(d.getByText(MSG.runBody, { exact: true })).toBeVisible();
  await expect(d.locator(".k-dialog-actions").getByRole("button")).toHaveText(["やめる", "止める"]);
  expect(s.w.of(STOP_RUN)).toHaveLength(0);
});

test("K734-UI-002 入力：小窓の「止める」で止める口に 1 回（体は {}）。小窓が閉じ、帯が白い箱「山田のAI を止めました」・要約「高本が 11/01 10:40 に止めました。止める前にできていた物は残っています」になり、実行の一覧とやり取りを読み直す", async ({
  page,
}) => {
  const s = await mockStop(page);
  await openTicket(page);
  const runs0 = s.w.reads(`/api/v1/tickets/${TICKET}/runs`);
  const tl0 = s.w.reads(`/api/v1/tickets/${TICKET}/timeline`);
  await stopBtn(page, "AI に任せる").click();
  await confirmStop(page).click();
  await expect.poll(() => s.w.of(STOP_RUN).length).toBe(1);
  expect(s.w.of(STOP_RUN)[0]).toEqual({ method: "POST", path: `/api/v1/action_runs/${RUN_ID}/stop`, body: {} });
  await expect(confirmOf(page)).toHaveCount(0);
  const band = k62Band(page);
  await expect(band.getByRole("heading", { name: MSG.stoppedTitle, exact: true })).toBeVisible();
  await expect(band.getByText(MSG.stoppedSub, { exact: true })).toBeVisible();
  await expect(band.getByRole("alert")).toHaveCount(0);
  await expect.poll(() => s.w.reads(`/api/v1/tickets/${TICKET}/runs`)).toBeGreaterThan(runs0);
  await expect.poll(() => s.w.reads(`/api/v1/tickets/${TICKET}/timeline`)).toBeGreaterThan(tl0);
});

test("K734-UI-003 操作の揺れ：答えを止めた間に小窓の「止める」を 2 回押し Esc を押しても、止める口は 1 回。待つ間は主ボタンが処理中で「やめる」は押せず、小窓は閉じない。答えが来ると閉じて止めた後の箱になる", async ({
  page,
}) => {
  const s = await mockStop(page);
  await openTicket(page);
  const release = s.w.hold();
  await stopBtn(page, "AI に任せる").click();
  await confirmStop(page).click();
  await expect.poll(() => s.w.of(STOP_RUN).length).toBe(1);
  await confirmStop(page).click({ force: true });
  await page.keyboard.press("Escape");
  await expect(confirmStop(page)).toHaveAttribute("aria-busy", "true");
  await expect(confirmOf(page).getByRole("button", { name: "やめる", exact: true })).toBeDisabled();
  await expect(confirmOf(page)).toBeVisible();
  expect(s.w.of(STOP_RUN)).toHaveLength(1);
  release();
  await expect(confirmOf(page)).toHaveCount(0);
  await expect(k62Band(page).getByRole("heading", { name: MSG.stoppedTitle, exact: true })).toBeVisible();
  expect(s.w.of(STOP_RUN)).toHaveLength(1);
});

test("K734-UI-004 操作：小窓の「やめる」・Esc は止める口を呼ばずに閉じ、焦点は「止める」に戻り、帯は作っている箱のまま", async ({
  page,
}) => {
  const s = await mockStop(page);
  await openTicket(page);
  const close = [
    () => confirmOf(page).getByRole("button", { name: "やめる", exact: true }).click(),
    () => page.keyboard.press("Escape"),
  ];
  for (const c of close) {
    await stopBtn(page, "AI に任せる").click();
    await expect(confirmOf(page)).toBeVisible();
    await c();
    await expect(confirmOf(page)).toHaveCount(0);
    await expect(stopBtn(page, "AI に任せる")).toBeFocused();
  }
  await expect(k62Band(page)).toContainText("山田のAI が作っています");
  expect(s.w.of(STOP_RUN)).toHaveLength(0);
});

test("K734-UI-005 失敗：手順 S1 の失敗（409・E-RUN-002 もう止まっていた）は小窓を閉じ、帯の箱の上に知らせ「この AI はもう止まっていました。表示を読み直しました」を出し、実行の一覧を読み直す", async ({
  page,
}) => {
  const s = await mockStop(page);
  await openTicket(page);
  const runs0 = s.w.reads(`/api/v1/tickets/${TICKET}/runs`);
  s.w.next.push(refuse(409, "E-RUN-002"));
  await stopBtn(page, "AI に任せる").click();
  await confirmStop(page).click();
  await expect(confirmOf(page)).toHaveCount(0);
  await expect(noticeOf(page)).toHaveText(MSG.conflict);
  const n = await noticeOf(page).boundingBox();
  const box = await k62Band(page).locator(".k-band").first().boundingBox();
  expect(n && box && n.y < box.y).toBe(true);
  await expect.poll(() => s.w.reads(`/api/v1/tickets/${TICKET}/runs`)).toBeGreaterThan(runs0);
});

test("K734-UI-006 守り：手順 S1 の失敗（403・E-RUN-001 担当者でない人が押した）は小窓を閉じ、帯の上の知らせに正本の文。帯は作っている箱のまま・「止める」は押せる形のまま", async ({
  page,
}) => {
  const s = await mockStop(page);
  await openTicket(page);
  s.w.next.push(refuse(403, "E-RUN-001", "permission"));
  await stopBtn(page, "AI に任せる").click();
  await confirmStop(page).click();
  await expect(confirmOf(page)).toHaveCount(0);
  await expect(noticeOf(page)).toHaveText(msg("E-RUN-001"));
  await expect(k62Band(page)).toContainText("山田のAI が作っています");
  await expect(stopBtn(page, "AI に任せる")).toBeEnabled();
});

test("K734-UI-007 失敗：手順 S1 の失敗（503 E-PAGE-003・404）はどれも小窓を閉じ、帯の上の知らせに正本の文を出し、帯は作っている箱のまま", async ({
  page,
}) => {
  const s = await mockStop(page);
  await openTicket(page);
  for (const [r, text] of [
    [DOWN, msg("E-PAGE-003")],
    [NOT_FOUND, "見つかりませんでした。消されたか、見る権限が無いかもしれません"],
  ] as const) {
    s.w.next.push(r);
    await stopBtn(page, "AI に任せる").click();
    await confirmStop(page).click();
    await expect(confirmOf(page)).toHaveCount(0);
    await expect(noticeOf(page)).toHaveText(text);
    await expect(k62Band(page)).toContainText("山田のAI が作っています");
  }
});

// ---------------------------------------------------------------- 止まった実行の箱

test("K734-UI-008 対象の状態：止まった実行の理由が「高本が止めました」なら、赤い箱でなく白い箱「山田のAI を止めました」・要約「高本が 11/01 10:40 に止めました。…」・acts は「自分で直す」だけ（［直し方を AI に伝える］は無い・answer=4d049789b537）。帯の中に［AI に任せる］は無く、題の行の「AI に任せる」が押せる", async ({
  page,
}) => {
  const s = await mockStop(page);
  s.run = runRow({ status: "stopped", stopped_reason: "高本が止めました", finished_at: STOPPED_AT });
  s.m.on.ticket = () => ({ status: 200, body: { data: ticketOf({ stage: "doing", can_delegate: true }) } });
  await openTicket(page);
  const band = k62Band(page);
  await expect(band.getByRole("heading", { name: MSG.stoppedTitle, exact: true })).toBeVisible();
  await expect(band.getByText(MSG.stoppedSub, { exact: true })).toBeVisible();
  await expect(band.getByRole("alert")).toHaveCount(0);
  await expect(band.locator(".k-band-acts").getByRole("button")).toHaveText(["自分で直す"]);
  await expect(band.getByRole("button", { name: "直し方を AI に伝える", exact: true })).toHaveCount(0);
  await expect(band.getByRole("button", { name: "AI に任せる", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "AI に任せる", exact: true })).toBeEnabled();
});

test("K734-UI-009 対象の状態：止まった実行の理由が人の止めでない（「PC が閉じていたので止まりました」）なら、赤い箱（role=alert）「山田のAI が止まりました」と理由の全文のまま", async ({
  page,
}) => {
  const s = await mockStop(page);
  s.run = runRow({ status: "stopped", stopped_reason: "PC が閉じていたので止まりました", finished_at: STOPPED_AT });
  s.m.on.ticket = () => ({ status: 200, body: { data: ticketOf({ stage: "doing", can_delegate: true }) } });
  await openTicket(page);
  const alert = k62Band(page).getByRole("alert");
  await expect(alert).toContainText("山田のAI が止まりました");
  await expect(alert).toContainText("PC が閉じていたので止まりました");
  await expect(k62Band(page).getByRole("heading", { name: MSG.stoppedTitle, exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- 承認の後の実行を止める

test("K734-UI-010 入口：承認の後の実行が running・asking の箱の acts に押せる「止める」が 1 つ在り、押すと同じ小窓「AI を止めます」が開く", async ({
  page,
}) => {
  for (const status of ["running", "asking"]) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockStop(page, "execute", status);
    await openTicket(page);
    await expect(bandOf(page).getByRole("button", { name: "止める", exact: true })).toHaveCount(1);
    await stopBtn(page, "承認と実行").click();
    await expect(confirmOf(page).getByRole("heading", { name: MSG.runTitle, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  }
});

test("K734-UI-011 入力：承認の後の実行の小窓の「止める」で止める口に 1 回（その実行の id・体は {}）。小窓が閉じ、承認と実行の帯が赤い箱「実行が止まりました」と理由「高本が止めました」になる", async ({
  page,
}) => {
  const s = await mockStop(page, "execute");
  await openTicket(page);
  await stopBtn(page, "承認と実行").click();
  await confirmStop(page).click();
  await expect.poll(() => s.w.of(STOP_RUN).length).toBe(1);
  expect(s.w.of(STOP_RUN)[0]!.path).toBe(`/api/v1/action_runs/${RUN_ID}/stop`);
  expect(s.w.of(STOP_RUN)[0]!.body).toEqual({});
  await expect(confirmOf(page)).toHaveCount(0);
  const alert = bandOf(page).getByRole("alert");
  await expect(alert).toContainText("実行が止まりました");
  await expect(alert).toContainText("高本が止めました");
});

// ---------------------------------------------------------------- 承認待ちを止める

test("K734-UI-012 入口：承認の帯の「止める」は押せる形で、押すと口を呼ばずに小窓「承認待ちの成果物を使わずに止めます」が開く（本文と足「やめる」「止める」）", async ({
  page,
}) => {
  const { w } = await mockStopApproval(page);
  await openTicket(page);
  const b = stopBtn(page, "承認と実行");
  await expect(b).toBeEnabled();
  await b.click();
  const d = confirmOf(page);
  await expect(d.getByRole("heading", { name: MSG.apTitle, exact: true })).toBeVisible();
  await expect(d.getByText(MSG.apBody, { exact: true })).toBeVisible();
  await expect(d.locator(".k-dialog-actions").getByRole("button")).toHaveText(["やめる", "止める"]);
  expect(w.of(STOP_APPROVAL)).toHaveLength(0);
});

test("K734-UI-013 入力：承認待ちの小窓の「止める」で止める口に 1 回（体は {}）。チケットを読み直して作業中の帯が白い箱「承認待ちの成果物を止めました」・要約になり、その下に 1 行「MM/DD HH:MM 高本が承認待ちを止めました（成果物の版 1 は残っています）」。やり取りを読み直す", async ({
  page,
}) => {
  const { w } = await mockStopApproval(page);
  await openTicket(page);
  const tl0 = w.reads(`/api/v1/tickets/${TICKET}/timeline`);
  await stopBtn(page, "承認と実行").click();
  await confirmStop(page).click();
  await expect.poll(() => w.of(STOP_APPROVAL).length).toBe(1);
  expect(w.of(STOP_APPROVAL)[0]).toEqual({ method: "POST", path: `/api/v1/approvals/${A_OPEN}/stop`, body: {} });
  await expect(confirmOf(page)).toHaveCount(0);
  const band = k62Band(page);
  await expect(band.getByRole("heading", { name: MSG.apStopped, exact: true })).toBeVisible();
  await expect(band.getByText(MSG.apStoppedSub, { exact: true })).toBeVisible();
  await expect(trailOf(page)).toHaveCount(1);
  await expect(trailOf(page).locator("time")).toHaveText(new RegExp(`^${nowStamp()} \\d\\d:\\d\\d$`));
  await expect(trailOf(page)).toContainText("高本が承認待ちを止めました（成果物の版 1 は残っています）");
  await expect.poll(() => w.reads(`/api/v1/tickets/${TICKET}/timeline`)).toBeGreaterThan(tl0);
});

test("K734-UI-014 守り：手順 S2 の失敗（403 承認する人でない・409 E-CONF-003 もう決まっていた・503）は帯の上の知らせ。403 は「承認待ちを止められるのは、承認する人だけです」で帯は承認待ちのまま、409 は正本の文とチケットの読み直し、503 は正本の文", async ({
  page,
}) => {
  const { w } = await mockStopApproval(page);
  await openTicket(page);
  for (const [r, text] of [
    [refuse(403, "FORBIDDEN", "permission"), MSG.apDenied],
    [refuse(409, "E-CONF-003"), msg("E-CONF-003")],
    [DOWN, msg("E-PAGE-003")],
  ] as const) {
    w.next.push(r);
    const reads = w.reads(`/api/v1/tickets/${TICKET}`);
    await stopBtn(page, "承認と実行").click();
    await confirmStop(page).click();
    await expect(confirmOf(page)).toHaveCount(0);
    await expect(noticeOf(page)).toHaveText(text);
    await expect(bandOf(page)).toContainText("あなたの承認を待っています");
    if (r.status === 409) await expect.poll(() => w.reads(`/api/v1/tickets/${TICKET}`)).toBeGreaterThan(reads);
  }
});

test("K734-UI-015 操作の揺れ：承認待ちの小窓の「止める」を答えを止めた間に 2 回押しても止める口は 1 回。待つ間は主ボタンが処理中で小窓は閉じない", async ({
  page,
}) => {
  const { w } = await mockStopApproval(page);
  await openTicket(page);
  const release = w.hold();
  await stopBtn(page, "承認と実行").click();
  await confirmStop(page).click();
  await expect.poll(() => w.of(STOP_APPROVAL).length).toBe(1);
  await confirmStop(page).click({ force: true });
  await expect(confirmStop(page)).toHaveAttribute("aria-busy", "true");
  await expect(confirmOf(page)).toBeVisible();
  release();
  await expect(confirmOf(page)).toHaveCount(0);
  expect(w.of(STOP_APPROVAL)).toHaveLength(1);
});

// ---------------------------------------------------------------- 画面・突き合わせ・守り

test("K734-UI-016 画面：キーボードだけで、Tab で「止める」に届き Enter で小窓が開き、Esc で閉じて焦点は「止める」へ戻る。もう一度開いて Tab で小窓の「止める」に届き Enter で止める口が 1 回", async ({
  page,
}) => {
  const s = await mockStop(page);
  await openTicket(page);
  const b = stopBtn(page, "AI に任せる");
  await b.focus();
  await page.keyboard.press("Enter");
  await expect(confirmOf(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(b).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(confirmOf(page)).toBeVisible();
  for (let i = 0; i < 4 && !(await confirmStop(page).evaluate((e) => e === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await expect(confirmStop(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => s.w.of(STOP_RUN).length).toBe(1);
});

test("K734-UI-017 画面：幅 375・768・1440 で 2 つの小窓は横溢れ 0・足の 2 つのボタンが画面の中。375 では小窓の下の端が画面の下の端から 16px（±1・下絵の下から出す形の余白）", async ({
  page,
}) => {
  for (const w of WIDTHS) {
    for (const kind of ["run", "approval"] as const) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      if (kind === "run") await mockStop(page);
      else await mockStopApproval(page);
      await openTicket(page, w);
      await stopBtn(page, kind === "run" ? "AI に任せる" : "承認と実行").click();
      const d = confirmOf(page);
      await expect(d).toBeVisible();
      await noOverflow(page, w);
      for (const btn of await d.locator(".k-dialog-actions").getByRole("button").all())
        await expect(btn).toBeInViewport();
      if (w === 375) {
        const r = await d.boundingBox();
        expect(r && Math.abs(812 - (r.y + r.height) - SHEET_GAP) <= 1, "下から出る").toBe(true);
      }
    }
  }
});

test("K734-UI-018 画面：下絵との突き合わせ（stop-running-band・stop-running-confirm・stop-stopped-band・stop-approval-confirm・stop-approval-stopped）。幅 375・768・1440 で帯の箱・題と要約・acts のボタン・小窓の箱と題と足・帯の下の 1 行の形が下絵と同じ", async ({
  browser,
}) => {
  const drives: [string, (p: Page) => Promise<void>, boolean][] = [
    [
      "stop-running-band",
      async (p) => {
        await mockStop(p);
        await openTicket(p, 1440);
      },
      false,
    ],
    [
      "stop-running-confirm",
      async (p) => {
        await mockStop(p);
        await openTicket(p, 1440);
        await stopBtn(p, "AI に任せる").click();
      },
      true,
    ],
    [
      "stop-stopped-band",
      async (p) => {
        const s = await mockStop(p);
        s.run = runRow({ status: "stopped", stopped_reason: "高本が止めました", finished_at: STOPPED_AT });
        s.m.on.ticket = () => ({ status: 200, body: { data: ticketOf({ stage: "doing", can_delegate: true }) } });
        await openTicket(p, 1440);
      },
      false,
    ],
    [
      "stop-approval-confirm",
      async (p) => {
        await mockStopApproval(p);
        await openTicket(p, 1440);
        await stopBtn(p, "承認と実行").click();
      },
      true,
    ],
    [
      "stop-approval-stopped",
      async (p) => {
        await mockStopApproval(p);
        await openTicket(p, 1440);
        await stopBtn(p, "承認と実行").click();
        await confirmStop(p).click();
        await expect(trailOf(p)).toHaveCount(1);
      },
      false,
    ],
  ];
  for (const [id, drive, dialog] of drives) {
    for (const w of WIDTHS) {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (p) => {
          await p.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
          await drive(p);
        },
        { base: "/dev/mock/f5", pairs: dialog ? DIALOG_PAIRS : BAND_PAIRS, blur: true },
      );
      expect(rows.length, `${id}・幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
      expect(bad, `${id}・幅 ${w}\n${bad.join("\n")}`).toEqual([]);
    }
  }
});

test("K734-UI-019 守り：開く・小窓を開く・やめるだけでは書く口 0。書く口は止める口だけで、本人の Bridge（38617）に飛ばない", async ({
  page,
}) => {
  const bridge: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("127.0.0.1:38617")) bridge.push(r.url());
  });
  const s = await mockStop(page);
  await openTicket(page);
  await stopBtn(page, "AI に任せる").click();
  await confirmOf(page).getByRole("button", { name: "やめる", exact: true }).click();
  expect(s.w.all).toEqual([]);
  await stopBtn(page, "AI に任せる").click();
  await confirmStop(page).click();
  await expect.poll(() => s.w.all.length).toBe(1);
  expect(s.w.all.every((x) => STOP_RUN.test(x.path))).toBe(true);
  expect(bridge).toEqual([]);
});

test("K734-UI-020 入口（ファイルを読む）：先 features/F5/more/fills/stop.tsx が StopRunActFill・RunStoppedFill・StopApprovalActFill を export し、口 stopActionRun・stopApproval は features/F5/stop/ からだけ呼ばれる（帯のファイルと slots.tsx は口の名前を持たない）", () => {
  const fill = join(WEB, "features/F5/more/fills/stop.tsx");
  expect(existsSync(fill)).toBe(true);
  const src = readFileSync(fill, "utf8");
  for (const n of ["StopRunActFill", "RunStoppedFill", "StopApprovalActFill"])
    expect(src).toMatch(new RegExp(`export function ${n}\\b`));
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? files(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [],
    );
  const callers = files(join(WEB, "features")).filter((f) =>
    /"stopActionRun"|"stopApproval"/.test(readFileSync(f, "utf8")),
  );
  expect(callers.length).toBeGreaterThan(0);
  for (const f of callers) expect(f, `${f} が止める口を呼ぶ`).toContain(join("features", "F5", "stop"));
});
