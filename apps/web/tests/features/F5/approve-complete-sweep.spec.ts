// K-1192「チケットの帯に『片付けに失敗しています』と出し、担当者が止められる」の画面の試験（実 Chrome・口は網の手前で差し替える）。
//   操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/approve-complete.md・タスクの列が K-1192）＝試験 1 本。土台は ./approve-complete.harness.ts（変えない）。
//   印（sweep_failed_at）は K-1191 が実行の形（ActionRunView）に足す欄。土台の runView には無いので、この試験が実行の口を後から差し替える（後に足した道が先に当たる）。
//   決める人の答え answer=449e47c15ace（担当者だけ）・ed20fcc1483d（字）・0e11672a186a（下絵）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, Route } from "@playwright/test";
import { expect, row } from "../../_lib/row";
import {
  R,
  ME,
  MAKER,
  TICKET,
  RUN_ID,
  mockApi,
  openTicket,
  bandOf,
  dialog,
  ticketOf,
  withBand,
  type Band,
  type Mock,
} from "./approve-complete.harness.js";

const TITLE = "片付けに失敗しています";
const BODY = "この実行は待ったままで、PC には渡していません。止めると、もう一度『AI に任せる』から始められます";
const STOP = "この実行を止める";
const MANUAL = "片付けに失敗していたので、高本が止めました";
const MARK = "2026-11-24T08:40:00.000Z";
const STOP_PATH = `/api/v1/action_runs/${RUN_ID}/stop`;

/** 正本（errors.json）から code の文を引く（どの入れ子にあっても code と message の組を探す） */
const catalogText = (code: string): string => {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../../../../../07_qa/test-specs/errors.json");
  let found = "";
  const walk = (x: unknown): void => {
    if (found || x === null || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    if (o["code"] === code && typeof o["message"] === "string") found = o["message"];
    else Object.values(o).forEach(walk);
  };
  walk(JSON.parse(readFileSync(path, "utf8")));
  expect(found, `errors.json に ${code} が無い（K-731 が足す）`).not.toBe("");
  return found;
};

interface Sweep {
  m: Mock;
  stops: unknown[];
  /** 止める口の答え（既定は 201・止まった実行） */
  stopReply: { status: number; body: unknown };
  /** 止める口の答えを止めておく。返した関数を呼ぶと答える */
  hold: () => () => void;
}
/** 片付けに失敗した印のある、待っている承認の後の実行。assignee は担当者の id（見ている人 ME か、ほかの人 MAKER） */
async function sweepFailed(page: Page, assignee: string): Promise<Sweep> {
  const band: Band = { stage: "running", run: { phase: "execute", status: "queued", pc: "asleep" } };
  const m = await mockApi(page, band);
  let stopped = false;
  let gate: Promise<void> = Promise.resolve();
  const view = () => ({
    id: RUN_ID,
    ticket_id: TICKET,
    phase: "execute",
    status: stopped ? "stopped" : "queued",
    by: { display_name: "山田" },
    pc: "asleep",
    silent: false,
    progress: null,
    stopped_reason: stopped ? MANUAL : null,
    return_reason: null,
    started_at: null,
    finished_at: stopped ? new Date().toISOString() : null,
    checks: { state: "none" },
    sweep_failed_at: stopped ? null : MARK,
  });
  m.on.ticket = () => {
    const t = ticketOf(stopped ? { stage: "doing" } : band);
    return {
      status: 200,
      body: { data: withBand(band, { ...t, assignee: { id: assignee, display_name: "高本" } }) },
    };
  };
  const s: Sweep = {
    m,
    stops: [],
    stopReply: { status: 201, body: {} },
    hold: () => {
      let open = () => {};
      gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
  };
  await page.route(/\/api\/v1\/(tickets\/[^/]+\/runs|action_runs\/[^/]+(\/stop)?)$/, async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    if (req.method() === "POST" && p === STOP_PATH) {
      s.stops.push(req.postDataJSON());
      await gate;
      if (s.stopReply.status === 201) stopped = true;
      const body =
        s.stopReply.status === 201
          ? { data: { id: RUN_ID, ticket_id: TICKET, phase: "execute", status: "stopped", stopped_reason: MANUAL } }
          : s.stopReply.body;
      return route.fulfill({ status: s.stopReply.status, contentType: "application/json", body: JSON.stringify(body) });
    }
    const data = p.endsWith("/runs") ? [view()] : view();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(p.endsWith("/runs") ? { data, meta: { limit: 50 } } : { data }),
    });
  });
  return s;
}
const alertBox = (page: Page) => bandOf(page).getByRole("alert").filter({ hasText: TITLE });

row(R["K1192-UI-001"], async (page) => {
  await sweepFailed(page, ME);
  await openTicket(page);
  const box = alertBox(page);
  await expect(box).toBeVisible();
  await expect(box).toContainText(BODY);
  await expect(bandOf(page).getByRole("button", { name: STOP })).toHaveCount(1);
  await expect(bandOf(page).getByText("実行待ち ・ PC が閉じています")).toHaveCount(0);
  await expect(bandOf(page).getByRole("link", { name: "PC をつなぐ" })).toHaveCount(0);
});
row(R["K1192-UI-002"], async (page) => {
  await sweepFailed(page, MAKER);
  await openTicket(page);
  await expect(alertBox(page)).toContainText(BODY);
  await expect(bandOf(page).getByRole("button")).toHaveCount(0);
});
row(R["K1192-UI-003"], async (page) => {
  const s = await sweepFailed(page, ME);
  await openTicket(page);
  await bandOf(page).getByRole("button", { name: STOP }).click();
  const d = dialog(page);
  await expect(d.getByRole("heading", { name: "この実行を止めますか" })).toBeVisible();
  await expect(d).toContainText("承認した中身は実行しません。チケットは作業中に戻ります。");
  await expect(d.getByRole("button", { name: "やめる" })).toBeVisible();
  await expect(d.getByRole("button", { name: "止める", exact: true })).toBeVisible();
  expect(s.stops).toHaveLength(0);
});
row(R["K1192-UI-004"], async (page) => {
  const s = await sweepFailed(page, ME);
  await openTicket(page);
  await bandOf(page).getByRole("button", { name: STOP }).click();
  await dialog(page).getByRole("button", { name: "止める", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(bandOf(page).getByText("実行が止まりました")).toBeVisible();
  await expect(bandOf(page).getByText(MANUAL)).toBeVisible();
  await expect(alertBox(page)).toHaveCount(0);
  expect(s.stops).toEqual([{}]);
});
row(R["K1192-UI-005"], async (page) => {
  const s = await sweepFailed(page, ME);
  await openTicket(page);
  await bandOf(page).getByRole("button", { name: STOP }).click();
  await dialog(page).getByRole("button", { name: "やめる" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(alertBox(page)).toBeVisible();
  expect(s.stops).toHaveLength(0);
});
row(R["K1192-UI-006"], async (page) => {
  const s = await sweepFailed(page, ME);
  s.stopReply = { status: 409, body: { error: "conflict", code: "E-RUN-002" } };
  await openTicket(page);
  await bandOf(page).getByRole("button", { name: STOP }).click();
  const reread = page.waitForRequest(
    (r) => new URL(r.url()).pathname === `/api/v1/tickets/${TICKET}` && r.method() === "GET",
  );
  await dialog(page).getByRole("button", { name: "止める", exact: true }).click();
  await reread;
  await expect(dialog(page)).toHaveCount(0);
  await expect(bandOf(page).getByText(catalogText("E-RUN-002"))).toBeVisible();
  expect(s.stops).toHaveLength(1);
});
row(R["K1192-UI-007"], async (page) => {
  const s = await sweepFailed(page, ME);
  await openTicket(page);
  await bandOf(page).getByRole("button", { name: STOP }).click();
  const open = s.hold();
  const confirm = dialog(page).getByRole("button", { name: "止める", exact: true });
  await confirm.click();
  await expect.poll(() => s.stops.length).toBe(1);
  await confirm.dispatchEvent("click"); // 処理中の主ボタンに 2 回目の押しを直に送る（押せない形でも、押せても口は呼ばれない）
  open();
  await expect(bandOf(page).getByText(MANUAL)).toBeVisible();
  expect(s.stops).toHaveLength(1);
});
row(R["K1192-UI-008"], async (page) => {
  await sweepFailed(page, ME);
  await openTicket(page, 375);
  await expect(alertBox(page)).toBeVisible();
  await expect(bandOf(page).getByRole("button", { name: STOP })).toBeVisible();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBe(0);
});
