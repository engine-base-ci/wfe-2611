// K-184「開いたままのチケットで、任せる → 承認・差し戻しの後の帯が替わる」の画面の試験（実 Chrome・口は差し替え）。
//   1 つのページを開いたまま（再読み込みなし）、口の答えを時間の順に替えていく。固定の待ちは使わない（3 秒ごとの読み直しは時計を進めて起こし、画面の文が出るのを待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台は ./approve-complete.harness.ts。
//
// 捕まえる不具合（中間テスト K-64 の切り直しで見つかった・2026-11-13）：apps/web/features/F5/delegate/use-run.ts の useRuns は、
//   「AI に任せる」を押したときの実行の id（pinned）を持ち続け、今の実行を `pinned ?? 一覧の先頭` で決める。承認・差し戻しで新しい実行（承認の後の実行・作り直し）が
//   一覧の先頭に来ても、読むのは任せたときの古い実行のまま → 帯（実行中・止まった理由・完了の案内・作り直しの「作っています」）が出ない。再読み込みすると出る。
// この試験が今の実装で赤になる訳：土台の mockApi は getActionRun をどの id でも「今の実行」で答えるので、古い id を読み続けても気づけない。
//   この試験は実行を id ごとに答える（古い作る段の実行の id には、終わった作る段の実行を返す）。画面が古い id を読み続ければ、
//   承認の後に「実行中」が出ず（K63-UI-064・066・067）、差し戻しの後に「作っています」が出ない（K63-UI-065）。
import type { Page, Route, Request } from "@playwright/test";
import { expect, row } from "../../_lib/row";
import {
  R,
  API_RE,
  TICKET,
  MAKER,
  MSG,
  ticketOf,
  pending,
  mockApi,
  openTicket,
  bandOf,
  k62Band,
  reasonBox,
  type Band,
} from "./approve-complete.harness.js";

const MAKE_1 = "0193c5a0-0000-7000-8000-0000000e0011"; // 任せたときの作る段の実行（画面が pinned に持つ id）
const EXEC = "0193c5a0-0000-7000-8000-0000000e0012"; // 承認の後の実行
const MAKE_2 = "0193c5a0-0000-7000-8000-0000000e0013"; // 差し戻しの作り直し
const MAKING = "山田のAI が作っています";

interface Run {
  id: string;
  phase: "make" | "execute";
  status: string;
  pc?: "live" | "asleep";
  stopped_reason?: string;
  return_reason?: string;
}
const view = (r: Run) => ({
  id: r.id,
  ticket_id: TICKET,
  phase: r.phase,
  status: r.status,
  by: { member_id: MAKER, display_name: "山田" },
  pc: r.pc ?? "live",
  silent: false,
  last_event_at: null,
  progress: null,
  stopped_reason: r.stopped_reason ?? null,
  return_reason: r.return_reason ?? null,
  started_at: new Date().toISOString(),
  finished_at: null,
  checks: { state: "none" },
});

/** 口の今の様子（試験が時間の順に替える）。runs は新しい順。実行の 1 件は id ごとに答える */
interface World {
  ticket: Band;
  runs: Run[];
  delegates: number;
  /** id ごとの実行の 1 件の答えを止めておく（返した関数を呼ぶと答える） */
  hold: (id: string) => () => void;
}
async function world(page: Page): Promise<World> {
  const m = await mockApi(page, { stage: "doing", can_delegate: true });
  const gates: Record<string, Promise<void>> = {};
  const w: World = {
    ticket: { stage: "doing", can_delegate: true },
    runs: [],
    delegates: 0,
    hold: (id) => {
      let open = () => {};
      gates[id] = new Promise<void>((r) => (open = r));
      return () => open();
    },
  };
  m.on.ticket = () => ({ status: 200, body: { data: ticketOf(w.ticket) } });
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  // 後から足した道が先に見られる。ここで受けない道は土台（mockApi）へ回す
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (req.method() === "POST" && p === `/api/v1/tickets/${TICKET}/delegate`) {
      w.delegates++;
      w.runs = [{ id: MAKE_1, phase: "make", status: "running" }];
      w.ticket = { stage: "running" };
      return json(route, 201, { data: { run_id: MAKE_1, job_id: MAKE_1, status: "queued", pc: "live" } });
    }
    if (p === `/api/v1/tickets/${TICKET}/runs`)
      return json(route, 200, { data: w.runs.map(view), meta: { limit: 50 } });
    const one = /^\/api\/v1\/action_runs\/([^/]+)$/.exec(p);
    if (one) {
      const id = one[1]!;
      if (gates[id]) await gates[id];
      const r = w.runs.find((x) => x.id === id);
      return r ? json(route, 200, { data: view(r) }) : json(route, 404, { error: "not_found", code: "NOT_FOUND" });
    }
    return route.fallback();
  });
  return w;
}
/** 3 秒ごとの読み直しを 1 回起こす（時計を進める。待ち時間に頼らない） */
const tick = (page: Page) => page.clock.fastForward(3_000);
/** 再読み込みしていないことの印（再読み込みすると消える） */
const mark = (page: Page) => page.evaluate(() => ((window as unknown as { __k184?: number }).__k184 = 1));
const marked = (page: Page) => page.evaluate(() => (window as unknown as { __k184?: number }).__k184);

/** 開いたままのページで「AI に任せる」を押し、作る段が終わって承認待ちの帯（承認して送る）が出るまで */
async function delegatedAndMade(page: Page): Promise<World> {
  const w = await world(page);
  await page.clock.install();
  await openTicket(page);
  await mark(page);
  await k62Band(page).getByRole("button", { name: "AI に任せる" }).click();
  await expect.poll(() => w.delegates).toBe(1);
  await expect(k62Band(page).getByText(MAKING)).toBeVisible();
  // 作る段が終わり、承認待ちになった
  w.runs = [{ id: MAKE_1, phase: "make", status: "done" }];
  w.ticket = { stage: "awaiting_approval", approval: pending() };
  await tick(page);
  await expect(bandOf(page).getByRole("button", { name: "承認して送る" })).toBeVisible();
  return w;
}
/** 承認すると、承認の後の実行が一覧の先頭に来る（古い作る段の実行は終わったまま残る） */
const approveTo = (w: World, exec: Run) => {
  w.runs = [exec, { id: MAKE_1, phase: "make", status: "done" }];
  w.ticket = { stage: "running" };
};

row(R["K63-UI-064"], async (page) => {
  const w = await delegatedAndMade(page);
  approveTo(w, { id: EXEC, phase: "execute", status: "running" });
  await bandOf(page).getByRole("button", { name: "承認して送る" }).click();
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible(); // 再読み込みなしで替わる
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  // 実行が終わった
  w.runs = [
    { id: EXEC, phase: "execute", status: "done" },
    { id: MAKE_1, phase: "make", status: "done" },
  ];
  w.ticket = { stage: "doing", can_complete: true, can_delegate: true };
  await tick(page);
  await expect(bandOf(page).getByText(MSG.completeHint)).toBeVisible();
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toBeVisible();
  expect(await marked(page)).toBe(1);
});

row(R["K63-UI-065"], async (page) => {
  const w = await delegatedAndMade(page);
  await bandOf(page).getByRole("button", { name: "差し戻す" }).click();
  await reasonBox(page).fill("宛名を直してください");
  // 差し戻すと、作り直しの実行が一覧の先頭に来る
  w.runs = [
    { id: MAKE_2, phase: "make", status: "running", return_reason: "宛名を直してください" },
    { id: MAKE_1, phase: "make", status: "done" },
  ];
  w.ticket = { stage: "running" };
  await page.getByRole("button", { name: "差し戻して作り直させる" }).click();
  await expect(k62Band(page).getByText(MAKING)).toBeVisible(); // 再読み込みなしで、作り直しの間の K-62 の帯が出る
  await expect(k62Band(page).getByText("差し戻しの理由：宛名を直してください")).toBeVisible();
  await expect(bandOf(page)).toHaveCount(0); // 作り直しの間は K-63 の帯を出さない（D-128.178）
  // 作り直しが終わり、新しい承認待ちになった
  w.runs = [
    { id: MAKE_2, phase: "make", status: "done" },
    { id: MAKE_1, phase: "make", status: "done" },
  ];
  w.ticket = { stage: "awaiting_approval", approval: pending() };
  await tick(page);
  await expect(bandOf(page).getByRole("button", { name: "承認して送る" })).toBeVisible();
  await expect(k62Band(page).getByText(MAKING)).toHaveCount(0);
  expect(await marked(page)).toBe(1);
});

row(R["K63-UI-066"], async (page) => {
  const w = await delegatedAndMade(page);
  approveTo(w, { id: EXEC, phase: "execute", status: "running" });
  await bandOf(page).getByRole("button", { name: "承認して送る" }).click();
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  // 実行が止まった（道具の途中）
  const reason = `ここで止まりました。${MSG.inFlight}`;
  w.runs = [
    { id: EXEC, phase: "execute", status: "stopped", stopped_reason: reason },
    { id: MAKE_1, phase: "make", status: "done" },
  ];
  w.ticket = { stage: "doing", can_complete: true, can_delegate: true };
  await tick(page);
  await expect(bandOf(page).getByText(MSG.inFlight)).toBeVisible();
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toBeVisible();
  await expect(bandOf(page).getByText("実行中", { exact: true })).toHaveCount(0);
  expect(await marked(page)).toBe(1);
});

row(R["K63-UI-067"], async (page) => {
  const w = await delegatedAndMade(page);
  // 承認の後、古い作る段の実行（MAKE_1）の答えだけを止めておく（新しい実行の答えより後に届かせる）
  const release = w.hold(MAKE_1);
  approveTo(w, { id: EXEC, phase: "execute", status: "running" });
  await bandOf(page).getByRole("button", { name: "承認して送る" }).click();
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible();
  // 古い実行の答え（作る段・終わった）が後から届く
  release();
  await tick(page);
  await expect(bandOf(page).getByText("実行中", { exact: true })).toBeVisible(); // 新しい実行の帯を上書きしない
  await expect(k62Band(page)).toHaveCount(0); // 承認の後の実行の間、K-62 の帯は出ない（D-128.178）
  await expect(page.getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  // 続けて実行が終われば、完了の案内まで進む（古い答えに引きずられない）
  w.runs = [
    { id: EXEC, phase: "execute", status: "done" },
    { id: MAKE_1, phase: "make", status: "done" },
  ];
  w.ticket = { stage: "doing", can_complete: true, can_delegate: true };
  await tick(page);
  await expect(bandOf(page).getByText(MSG.completeHint)).toBeVisible();
  expect(await marked(page)).toBe(1);
});

// 開いたまま、PC が閉じていて実行待ちの間に承認から 24 時間が過ぎる：読み直しの間隔で、帯が聞き直し（新しい承認待ち）に替わる。
//   実行待ち（queued）は走っている実行なので、3 秒ごとの読み直し（実行の 1 件・一覧・チケット）は続く。聞き直しは、読む口の前の片付け（口の側）が作る。
//   口の答え：実行は stopped（理由は「承認から 24 時間を過ぎたので…」）・チケットは承認待ち・approval は新しい id で note に聞き直しの文
row(R["K63-UI-068"], async (page) => {
  const REASK = "0193c5a0-0000-7000-8000-0000000a0068"; // 聞き直しの承認待ち（前の承認とは別の id）
  const w = await delegatedAndMade(page);
  approveTo(w, { id: EXEC, phase: "execute", status: "queued", pc: "asleep" });
  await bandOf(page).getByRole("button", { name: "承認して送る" }).click();
  await expect(bandOf(page).getByText(MSG.pcClosed)).toBeVisible(); // 実行待ち・PC が閉じている
  await expect(bandOf(page).getByRole("button", { name: "承認して送る" })).toHaveCount(0);
  // 24 時間が過ぎ、読む口の前の片付けが聞き直しにした
  w.runs = [
    {
      id: EXEC,
      phase: "execute",
      status: "stopped",
      pc: "asleep",
      stopped_reason: "承認から 24 時間を過ぎたので、実行の前にもう一度確かめます",
    },
    { id: MAKE_1, phase: "make", status: "done" },
  ];
  w.ticket = { stage: "awaiting_approval", approval: pending({ id: REASK, note: MSG.note24h }) };
  await tick(page);
  await expect(bandOf(page)).toContainText(MSG.note24h); // 再読み込みなしで聞き直しの帯に替わる
  await expect(bandOf(page).getByRole("button", { name: "承認して送る" })).toBeVisible();
  await expect(bandOf(page).getByRole("button", { name: "差し戻す" })).toBeVisible();
  await expect(bandOf(page).getByText(MSG.pcClosed)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  await expect(k62Band(page)).toHaveCount(0); // 承認する人には K-62 の帯を出さない（D-128.178）
  expect(await marked(page)).toBe(1);
});
