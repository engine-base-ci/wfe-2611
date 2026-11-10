// K-64 中間テスト 3：AI に任せる（K-62）→ 承認して完了する（K-63）を、本物のブラウザ・本物の DB・本物の口と、試験の PC でつなぐ（D-128.131）。
//   中の 1 本 1 本の分岐は単体の試験（K-62：apps/api/test/features/F5/delegate*.test.ts・apps/web/tests/features/F5/delegate.spec.ts・
//   apps/bridge/test/delegate.test.ts、K-63（孫 K-161〜K-166）：apps/api/test/features/F5/approve-complete-*.test.ts・apps/web/tests/features/F5/approve-complete-*.spec.ts）が持つ。
//   ここは「つないだときにだけ出るもの」を見る：PC の結果が承認待ちに正しく渡るか・承認が実行の仕事になって任せた人の PC に届くか・
//   完了でチケットとセッション（続きの id）が閉じるか・差し戻しで作り直しに戻るか・別の人の PC には届かないか・承認の記録が取り消せない扱いで残るか。
//   口は網の手前で差し替えない（page.route で答えを作らない。届く頭 x-forwarded-for だけを足す）。AI は決まった答え（_lib/f5-flow.ts の AI）。
//   PC は K-58 の試験の PC（_lib/test-pc.ts）に、契約の口で仕事を運ばせる（_lib/f5-flow.ts の workOf）。人は _lib/newcomer.ts、PC をつなぐ・チケットを作るは _lib/prep.ts（口の道）。
//   時刻は DB の時刻を動かす（K-58 の clock.ts の lastBeatAgo・f5-flow.ts の approvedAgo・待たない）。
//   ★前提：CI の web の組の G59 と同じ（API を試験の受け箱へ・画面は 127.0.0.1:3124）。K-58・K-62・K-63 がこの枝に入っていること。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../_lib/api";
import { lastBeatAgo } from "../_lib/clock";
import {
  AI,
  approvalsOf,
  approvedAgo,
  artifactsOf,
  deleteTicketRow,
  runsOf,
  setStage,
  systemLines,
  ticketState,
  todoNow,
  workOf,
  type Job,
  type PcWork,
} from "../_lib/f5-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { asPerson, pairedPc, teammate, ticketOf } from "../_lib/prep";
import type { TestPc } from "../_lib/test-pc";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 64);
});
/** 開いた PC は筋の終わりに必ず閉じる（G-10） */
const pcs: TestPc[] = [];
test.afterEach(async () => {
  await Promise.all(pcs.splice(0).map((p) => p.close()));
});

/** 文言（errors.json と K-62・K-63 の仕様の表・決定から。実装から書かない） */
const MSG = {
  queuedLive: "PC が受け取るのを待っています", // K-62 の帯・任せた直後（D-133.1）
  waking: "PC が起きるのを待っています", // K-62 の帯・PC が眠っている（D-128.163）
  made: "成果物ができました。承認待ちです", // K-62 の帯（承認する人でない人にだけ出す・D-128.178）
  checkNone: "検査なし（まだ流していません）", // D-128.138
  waitingMe: "あなたの承認を待っています", // K-63 の帯
  irreversible: "取り消せません", // D-128.177
  pcClosed: "実行待ち・PC が閉じています。開いたらすぐ実行します。承認から 24 時間を過ぎたら、もう一度聞きます", // K-63 の帯の文（E-CONN-002 とは別）
  completeHint: "完了の条件を確かめて完了にしてください", // K-63 の帯
  decided: "この承認はもう処理されています", // E-CONF-003
  emptyResult: "自分のAI が結果を返さずに終わりました。完了とは見なしていません", // E-SIG-004
  note24h: "承認から 24 時間を過ぎたので、実行の前にもう一度確かめてください", // K-63 の聞き直しの行の note
  expired24h: "承認から 24 時間を過ぎたので、実行の前にもう一度確かめます", // K-63 が止めた前の仕事の理由（D-131.14）
  todoLeft: "実施事項がまだ残っています", // E-VAL-022
  ticketDeleted: "チケットが消されたので止めました", // K-62 の合図・K-63 の片付け
  noWrite: "このチケットを直す権限が無くなったので止めました", // K-62 の止める理由（D-129.1・K62-API-019）
  execHint: "承認された成果物を実行してください", // K-63 の承認の関数の足し書き
  returnedHint: "差し戻されました。理由：", // K-63 の差し戻しの足し書き（作り直しの仕事の prompt）
  returnedOnBand: "差し戻しの理由：", // K-62 の帯（作り直しの間・D-129.12）
  empty: "いま決めるものはありません", // K-63 の承認待ちの画面・空
} as const;
/** K-63 の帯の名前（どの状態でも `<section aria-label="承認と実行">`・K-63 が決めた） */
const K63_BAND = "承認と実行";
/** 画面の 3 秒ごとの読み直し（K-62・K-63）を、本物の 3 秒を待たずに前に出す（page.clock・K-62・K-63 の単体と同じ形・D-128.130）。
 *  時計は止めない（止めるとページの setTimeout(cb, 0) も動かず、読み直しの結果が画面に渡らない） */
const tick = (page: Page) => page.clock.runFor(3_000);
/** 「{名前}のAI」（K-62・K-63 の画面とやり取りの 1 行の出し方・D-128.16） */
const aiOf = (me: Newcomer) => `${me.name}のAI`;
/** チケットの区画（実施事項は 2 項目＝完了の小窓のチェック 2 つ） */
const SECTIONS = {
  purpose: "先方に出す見積のたたき台を作って送る（中間テスト 3）",
  done: "先方が見積を受け取った",
  todo: "- 見積を作る\n- 先方に送る",
} as const;

interface Ready {
  me: Newcomer;
  pc: TestPc;
  w: PcWork;
  t: string;
}
/** 登録した人・つないだ PC・チケット 1 枚（K-58 の正常の筋の終わりと同じ形。画面でつなぐ・作る道は K-58 が持つ） */
async function ready(page: Page, tag: string): Promise<Ready> {
  const me = await newcomer(page, box, tag, { name: `中間3 ${tag}`, company: `中間テスト 3 の会社 ${tag}` });
  await page.clock.install(); // 読み直しを tick（runFor）で前に出せるようにする（登録の画面の後・次の goto から効く）
  const pc = await pairedPc(me.token, `中間3 の MacBook (${tag})`);
  pcs.push(pc);
  const t = await ticketOf(me, `見積を送る（中間3 ${tag}）`, SECTIONS);
  return { me, pc, w: workOf(pc), t };
}
const openTicket = async (page: Page, t: string) => {
  const res = await page.goto(`/tickets/${t}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
};
const aiBand = (page: Page) => page.getByRole("region", { name: "AI に任せる" });
/** K-63 の帯（どの状態でも） */
const execBand = (page: Page) => page.getByRole("region", { name: K63_BAND });
/** K-63 の帯が承認待ち（「あなたの承認を待っています」）の状態のとき */
const approvalBand = (page: Page) => execBand(page).filter({ hasText: MSG.waitingMe });
const delegateBtn = (page: Page) => page.getByRole("button", { name: "AI に任せる", exact: true });
const approveBtn = (page: Page) => approvalBand(page).getByRole("button", { name: "承認して送る" });

/** 画面で任せる → 帯は「任せました。PC が受け取るのを待っています」（D-133.1）→ PC が作る段の仕事を取る → 次の読み直しで「作っています」に替わる */
async function delegateAndTake(page: Page, r: Ready): Promise<Job> {
  await openTicket(page, r.t);
  await delegateBtn(page).click();
  await expect(aiBand(page)).toContainText(`${aiOf(r.me)} に任せました`);
  await expect(aiBand(page), "PC が受け取る前は「作っています」と言わない（D-133.1）").toContainText(MSG.queuedLive);
  await expect(execBand(page), "作る段の間は K-63 の帯を出さない（D-128.178）").toHaveCount(0);
  const job = await r.w.take();
  expect(job, "任せた仕事は任せた人の PC に渡る").not.toBeNull();
  expect(job).toMatchObject({ kind: "ticket", ticket_id: r.t, phase: "make", permission_mode: "manual" });
  expect(job!.prompt, "仕事の中身はチケットの区画から").toContain(SECTIONS.purpose);
  await tick(page);
  await expect(aiBand(page), "画面が PC の受け取りに自分で気づく").toContainText(`${aiOf(r.me)} が作っています`);
  await expect(aiBand(page)).not.toContainText(MSG.queuedLive);
  return job!;
}
/** 作る段を終える → 承認待ちの帯に中身が出る（PC の結果が承認待ちに渡る） */
async function makeToApproval(page: Page, r: Ready, job: Job, text: string = AI.made, session = "sess-k64") {
  expect(await r.w.finish(job.job_id, { state: "done", result: text, agent_session_id: session })).toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
  await tick(page);
  await expect(approvalBand(page), "開いたままの画面が自分で承認待ちに替わる（単体は K63-UI-044）").toBeVisible();
  await expect(approvalBand(page)).toContainText(text);
  await expect(approvalBand(page)).toContainText(MSG.checkNone);
  await expect(approvalBand(page)).toContainText(MSG.irreversible);
}
/** 実施事項を全部チェックし、完了の条件を確かめて完了にする */
async function completeAll(page: Page): Promise<void> {
  await page.getByRole("button", { name: "完了にする", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("checkbox", { name: "見積を作る" }).check();
  await d.getByRole("checkbox", { name: "先方に送る" }).check();
  await d.getByRole("checkbox", { name: "完了の条件を満たしたことを確かめました" }).check();
  await d.getByRole("button", { name: "確かめて完了にする" }).click();
  await expect(execBand(page).getByText(/完了しました（.+・\d{2}\/\d{2} \d{2}:\d{2}）/)).toBeVisible();
}

test("K64-M3-01 正常：任せる → PC が作って終える → 承認待ちの画面と帯に出る → 承認して送る → 同じ PC が同じ続きで実行して終える → 完了にする。記録が 1 本につながる", async ({
  page,
}) => {
  const r = await ready(page, "正常");
  const job = await delegateAndTake(page, r);
  expect(await r.w.progress(job.job_id, 1, "前回の見積を読んでいます")).toBe(201);
  await tick(page);
  await expect(aiBand(page), "PC の途中の様子が帯に届く").toContainText("前回の見積を読んでいます");
  await makeToApproval(page, r, job);
  // 承認する人には K-63 の帯だけ（帯は 1 つにまとめる・D-128.178・D-129.10）。K-62 の帯の文は出さない
  await expect(execBand(page), "K-63 の帯は 1 つ").toHaveCount(1);
  await expect(page.getByText(MSG.made), "承認待ちの文は 2 か所に出さない").toHaveCount(0);
  // 承認待ちの画面：PC の結果が、任せた人の AI の行として並ぶ（骨格では取り消せない扱いなので「中身を見る」・D-128.36・D-128.177）
  await page.goto("/approvals");
  const line = page.getByRole("row").filter({ hasText: "見積を送る（中間3 正常）" });
  await expect(line).toHaveCount(1);
  await expect(line).toContainText(aiOf(r.me));
  await expect(line).toContainText(MSG.checkNone);
  await expect(
    line.getByRole("button", { name: "承認する" }),
    "取り消せない操作の行では決めない（D-128.36）",
  ).toHaveCount(0);
  await line.getByRole("link", { name: "中身を見る" }).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${r.t}$`));
  await approveBtn(page).click();
  // 承認が実行の仕事になり、任せた人の PC に、作る段と同じ続きの id・auto で届く（D-128.176・D-128.177・同じ PC だから続きの id が渡る・D-131.3）
  const exec = await r.w.take();
  expect(exec).toMatchObject({
    kind: "ticket",
    ticket_id: r.t,
    phase: "execute",
    agent_session_id: "sess-k64",
    permission_mode: "auto",
  });
  expect(exec!.prompt).toContain(MSG.execHint);
  expect(await r.w.take(), "同じ仕事は二度渡らない").toBeNull();
  await tick(page);
  await expect(execBand(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(
    aiBand(page).getByText(`${aiOf(r.me)} が作っています`),
    "承認の後の実行の間は K-62 の状態の文を出さない（D-128.178）",
  ).toHaveCount(0);
  expect(
    await r.w.finish(exec!.job_id, { state: "done", result: AI.sent, agent_session_id: "sess-k64" }),
  ).toMatchObject({ status: 201 });
  await tick(page);
  await expect(execBand(page).getByText(MSG.completeHint), "実行が終わると完了の案内に替わる").toBeVisible();
  await expect(delegateBtn(page), "終わった後は任せ直す道（ボタンだけ）が並ぶ（G-03・D-129.11）").toBeVisible();
  await completeAll(page);
  // 記録：作る段と実行する段が、1 枚のチケットの上で 1 本につながる
  const runs = await runsOf(r.t);
  const [a] = await approvalsOf(r.t);
  expect(runs.map((x) => [x.phase, x.status_id, x.job_state])).toEqual([
    ["make", "done", "done"],
    ["execute", "done", "done"],
  ]);
  expect(runs[1]!.approval_id, "実行を許した承認").toBe(a!.id);
  expect(runs.every((x) => x.job_member === r.me.memberId && x.created_by === r.me.memberId)).toBe(true);
  expect(runs[0]!.taken_session_id).toBe(await r.pc.deviceId());
  expect(runs[1]!.taken_session_id, "実行も任せた人の同じ PC").toBe(await r.pc.deviceId());
  expect(a).toMatchObject({
    decision: "approve",
    status_id: "approved",
    irreversible: true,
    approver_member_id: r.me.memberId,
  });
  expect(
    (await artifactsOf(r.t)).map((v) => v.text),
    "成果物の版は 1 つ",
  ).toEqual([AI.made]);
  expect(await ticketState(r.t)).toMatchObject({ stage: "done", completed_by: r.me.memberId });
  const lines = await systemLines(r.t);
  for (const s of [
    `${aiOf(r.me)} に任せました`,
    `${aiOf(r.me)} が作り終えました`,
    `${r.me.name}が承認しました`,
    `${aiOf(r.me)} が実行しました`,
    AI.sent.slice(0, 20),
    `${r.me.name}が完了にしました`,
  ])
    expect(
      lines.some((l) => l.includes(s)),
      `やり取りに「${s}」`,
    ).toBe(true);
  const view = await asPerson(r.me.token, "GET", `/tickets/${r.t}/runs`);
  expect(
    (view.data as unknown as { phase: string }[]).map((x) => x.phase),
    "実行の記録の口は新しい順",
  ).toEqual(["execute", "make"]);
});

test("K64-M3-02 差し戻し：理由つきで差し戻す → 理由が作り直しの仕事に渡り、同じ PC が同じ続きで作り直す → 2 つ目の結果が承認待ちに出る → 承認して実行する", async ({
  page,
}) => {
  const r = await ready(page, "差し戻し");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  const reason = "<b>宛名</b>を株式会社サンプルにしてください";
  await approvalBand(page).getByRole("button", { name: "差し戻す" }).click();
  await page.getByRole("textbox", { name: "差し戻す理由" }).fill(reason);
  await page.getByRole("button", { name: "差し戻して作り直させる" }).click();
  // 作り直し（phase make）の間は K-62 の帯だけ（帯は段で分ける・D-128.178・D-129.10）。待っている間の文は D-133.1、理由は文字として出す（D-129.12）
  await expect(aiBand(page)).toContainText(`${aiOf(r.me)} に任せました`);
  await expect(aiBand(page)).toContainText(MSG.queuedLive);
  await expect(aiBand(page), "差し戻しの理由が作り直しの帯に文字として出る").toContainText(
    `${MSG.returnedOnBand}${reason}`,
  );
  await expect(aiBand(page).locator("b"), "理由の HTML は要素にならない").toHaveCount(0);
  await expect(execBand(page), "作り直しの間に K-63 の帯は出ない").toHaveCount(0);
  const remake = await r.w.take();
  expect(remake, "作り直しは任せた人の PC に、作る段として届く（許可のモードは聞く・D-131.5）").toMatchObject({
    phase: "make",
    agent_session_id: "sess-k64",
    permission_mode: "manual",
  });
  expect(remake!.prompt, "理由はそのままの文で（HTML として扱わず）渡る").toContain(`${MSG.returnedHint}${reason}`);
  await tick(page);
  await expect(aiBand(page)).toContainText(`${aiOf(r.me)} が作っています`);
  await makeToApproval(page, r, remake!, AI.remade);
  await expect(approvalBand(page), "前の成果物は出さない").not.toContainText(AI.made);
  const both = await approvalsOf(r.t);
  expect(both, "承認の行は 2 つ（前の行は差し戻しのまま残る）").toHaveLength(2);
  const [first, second] = both;
  expect(first).toMatchObject({ decision: "return", status_id: "returned", return_reason: reason });
  expect(second).toMatchObject({ decision: null, status_id: "pending" });
  expect(
    (await artifactsOf(r.t)).map((v) => v.text),
    "版は 2 つ（前の版は残る）",
  ).toEqual([AI.made, AI.remade]);
  const runs = await runsOf(r.t);
  expect(runs.map((x) => [x.phase, x.status_id, x.approval_id])).toEqual([
    ["make", "done", null],
    ["make", "done", first!.id],
  ]);
  expect(runs[1]!.created_by, "作り直しの実行の押した人は任せた人（鎖を保つ・K63-API-077）").toBe(r.me.memberId);
  await page.goto("/approvals");
  await expect(
    page.getByRole("row").filter({ hasText: "見積を送る（中間3 差し戻し）" }),
    "承認待ちは新しい 1 行だけ",
  ).toHaveCount(1);
  await openTicket(page, r.t);
  await approveBtn(page).click();
  const exec = await r.w.take();
  expect(exec).toMatchObject({ phase: "execute", agent_session_id: "sess-k64", permission_mode: "auto" });
  expect(
    (await runsOf(r.t)).filter((x) => x.phase === "execute")[0]!.approval_id,
    "実行を許したのは 2 つ目の承認",
  ).toBe(second!.id);
});

test("K64-M3-03 PC が閉じている（作る段）：PC を閉じてから任せる → 帯は起きるのを待つ → PC が起きると 1 回だけ受けて進む", async ({
  page,
}) => {
  const r = await ready(page, "閉じて任せる");
  expect(await lastBeatAgo(await r.pc.deviceId(), "5 minutes")).toBe(1);
  await openTicket(page, r.t);
  await delegateBtn(page).click();
  await expect(aiBand(page)).toContainText(`${aiOf(r.me)} に任せました`);
  await expect(aiBand(page)).toContainText(MSG.waking);
  await expect(aiBand(page), "眠っているときは「受け取るのを待っています」ではない").not.toContainText(MSG.queuedLive);
  expect(
    (await runsOf(r.t)).map((x) => [x.phase, x.status_id]),
    "仕事は待ちに入って消えない",
  ).toEqual([["make", "queued"]]);
  expect(await r.pc.beat(), "PC が起きる").toBeLessThan(300);
  const job = await r.w.take();
  expect(job?.phase).toBe("make");
  expect(await r.w.take(), "二重に受けない").toBeNull();
  expect(await r.w.progress(job!.job_id, 1, "内訳を書いています")).toBe(201);
  await tick(page);
  await expect(aiBand(page), "帯が待ちから作っているに替わる").toContainText(`${aiOf(r.me)} が作っています`);
  await expect(aiBand(page)).not.toContainText(MSG.waking);
  await expect(aiBand(page), "途中の様子も届く").toContainText("内訳を書いています");
  await makeToApproval(page, r, job!);
});

test("K64-M3-04 PC が閉じている（実行の段）：PC が閉じたまま承認する → 実行待ちの文 → 別のタブでも同じ → PC が開くと実行の仕事を受けて終え、完了の案内に替わる", async ({
  page,
  context,
}) => {
  const r = await ready(page, "閉じて承認");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  expect(await lastBeatAgo(await r.pc.deviceId(), "5 minutes")).toBe(1);
  await approveBtn(page).click();
  await expect(execBand(page).getByText(MSG.pcClosed)).toBeVisible();
  await expect(page.getByText(MSG.waking), "実行待ちに K-62 の帯の「起きるのを待っています」は出ない").toHaveCount(0);
  const other = await context.newPage();
  await other.clock.install(); // このタブの読み直しも時計で前に出す
  await openTicket(other, r.t);
  await expect(execBand(other).getByText(MSG.pcClosed), "開き直しても同じ（サーバーの答えから出す）").toBeVisible();
  await expect(other.getByRole("button", { name: "承認して送る" }), "決めた承認を二度は押させない").toHaveCount(0);
  expect(await r.pc.beat()).toBeLessThan(300);
  const exec = await r.w.take();
  expect(exec).toMatchObject({ phase: "execute", agent_session_id: "sess-k64" });
  await tick(page);
  await expect(execBand(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(execBand(page).getByText(MSG.pcClosed), "PC が取ったら実行待ちの文は消える").toHaveCount(0);
  // 承認の後の実行（phase execute）の間は K-63 の帯だけ。K-62 の帯の文は出さない（D-128.178）
  await expect(page.getByText(`${aiOf(r.me)} が作っています`), "実行中に K-62 の帯の文は出ない").toHaveCount(0);
  await expect(page.getByText(MSG.waking)).toHaveCount(0);
  expect(await r.w.finish(exec!.job_id, { state: "done", result: AI.sent })).toMatchObject({ status: 201 });
  await tick(page);
  await expect(execBand(page).getByText(MSG.completeHint)).toBeVisible();
  await tick(other);
  await expect(execBand(other).getByText(MSG.completeHint), "もう 1 つのタブも自分で替わる").toBeVisible();
  await other.close();
});

test("K64-M3-05 承認から 24 時間：PC が閉じたまま 24 時間 1 分たつ → PC が来ても古い承認では実行しない → 帯がもう一度聞く → 承認し直すと実行の仕事が届く", async ({
  page,
}) => {
  const r = await ready(page, "24 時間");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  expect(await lastBeatAgo(await r.pc.deviceId(), "5 minutes")).toBe(1);
  await approveBtn(page).click();
  await expect(execBand(page).getByText(MSG.pcClosed)).toBeVisible();
  const [old] = await approvalsOf(r.t);
  expect(await approvedAgo(old!.id, "24 hours 1 minute")).toBe(1);
  expect(await r.pc.beat()).toBeLessThan(300);
  expect(await r.w.take(), "古い承認の実行は渡さない（D-128.98）").toBeNull();
  await page.reload();
  await expect(approvalBand(page)).toContainText(MSG.note24h);
  const now = await approvalsOf(r.t);
  expect(now).toHaveLength(2);
  expect(now[0], "前の承認は変えない（取り消せない扱いのまま）").toMatchObject({
    id: old!.id,
    decision: "approve",
    status_id: "approved",
  });
  expect(now[1]).toMatchObject({ decision: null, status_id: "pending", irreversible: true, note: MSG.note24h });
  await approveBtn(page).click();
  const exec = await r.w.take();
  expect(exec, "聞き直しの承認で、同じ PC に同じ続きで届く").toMatchObject({
    phase: "execute",
    agent_session_id: "sess-k64",
  });
  const execs = (await runsOf(r.t)).filter((x) => x.phase === "execute");
  expect(
    execs.map((x) => [x.status_id, x.job_state, x.approval_id]),
    "前の実行は止まった（片付けは stopped・D-131.14）。新しい実行は新しい承認で動く",
  ).toEqual([
    ["stopped", "stopped", old!.id],
    ["running", "running", now[1]!.id],
  ]);
  expect(execs[0]!.job_reason, "止めた理由").toBe(MSG.expired24h);
});

test("K64-M3-06 合図なしで終わる（G-15）：作る段が空の結果で終わったら承認待ちに出さない。実行の段が空で終わったら完了とみなさない", async ({
  page,
}) => {
  const r = await ready(page, "空の結果");
  const job = await delegateAndTake(page, r);
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.empty })).toEqual({
    status: 201,
    outcome: "stopped",
  });
  await tick(page);
  await expect(aiBand(page), "作る段の止まった理由は K-62 の帯に").toContainText(MSG.emptyResult);
  await expect(delegateBtn(page), "止まったらもう一度任せられる").toBeVisible();
  expect(await approvalsOf(r.t), "承認待ちを作らない").toEqual([]);
  expect(await artifactsOf(r.t)).toEqual([]);
  expect((await ticketState(r.t)).stage, "段は作業中に戻る").toBe("doing");
  await page.goto("/approvals");
  await expect(page.getByText(MSG.empty)).toBeVisible();
  // もう一度任せて承認まで進め、実行の段を空で終える
  const again = await delegateAndTake(page, r);
  await makeToApproval(page, r, again);
  await approveBtn(page).click();
  const exec = await r.w.take();
  expect(
    (await r.w.finish(exec!.job_id, { state: "done", result: "" })).status,
    "空の結果でも口は受ける（成功にしない）",
  ).toBe(201);
  await tick(page);
  await expect(execBand(page), "実行の段の空は K-63 の帯に止まった理由として出る").toContainText(MSG.emptyResult);
  await expect(execBand(page).getByText(MSG.completeHint), "完了の案内にはならない").toHaveCount(0);
  expect((await runsOf(r.t)).at(-1)).toMatchObject({ phase: "execute", status_id: "stopped" });
  expect((await ticketState(r.t)).stage, "完了にも承認待ちにもならず作業中").toBe("doing");
  expect(await approvalsOf(r.t), "実行の終わりは新しい承認待ちを作らない").toHaveLength(1);
});

test("K64-M3-07 別の人の PC には届かない：同じ会社の別の人の PC がつながっていても、作る段も実行の段も任せた人の PC にだけ届く", async ({
  page,
}) => {
  const r = await ready(page, "別の人");
  const mate = await teammate(r.me, "中間3 同僚");
  const matePc = await pairedPc(mate.token, "中間3 の同僚の PC");
  pcs.push(matePc);
  const mateW = workOf(matePc);
  await openTicket(page, r.t);
  await delegateBtn(page).click();
  await expect(aiBand(page)).toContainText(`${aiOf(r.me)} に任せました`);
  expect(await mateW.take(), "作る段は同僚の PC に渡らない").toBeNull();
  const job = await r.w.take();
  expect(job?.phase).toBe("make");
  await tick(page);
  await makeToApproval(page, r, job!);
  await approveBtn(page).click();
  expect(await mateW.take(), "実行の段も同僚の PC に渡らない（D-128.176）").toBeNull();
  const exec = await r.w.take();
  expect(exec?.phase).toBe("execute");
  const runs = await runsOf(r.t);
  expect(runs.every((x) => x.job_member === r.me.memberId)).toBe(true);
  const mine = await r.pc.deviceId();
  expect(
    runs.map((x) => x.taken_session_id),
    "受け取った PC はどちらも任せた人の PC",
  ).toEqual([mine, mine]);
  const mateSid = await matePc.deviceId();
  expect(runs.some((x) => x.taken_session_id === mateSid)).toBe(false);
});

test("K64-M3-08 チケットが消された：作っている間に消えたら結果は承認待ちに出ない。承認して実行待ちの間に消えたら PC に実行を渡さない", async ({
  page,
}) => {
  const r = await ready(page, "消された");
  const job = await delegateAndTake(page, r);
  // 消す口は後の F4。ここでは行の消した時刻だけを置く（K-62・K-63 の単体の試験と同じ置き方）
  await deleteTicketRow(r.t, r.me.memberId);
  expect(await r.w.control(job.job_id)).toEqual({ stop: true, reason: MSG.ticketDeleted });
  expect((await r.w.finish(job.job_id, { state: "done", result: AI.made })).outcome).toBe("stopped");
  expect(await approvalsOf(r.t), "消えたチケットの結果は承認待ちにしない").toEqual([]);
  expect(await artifactsOf(r.t), "成果物の版も作らない").toEqual([]);
  await page.goto("/approvals");
  await expect(page.getByText(MSG.empty)).toBeVisible();
  // 2 枚目：承認して実行待ちの間に消す
  const t2 = await ticketOf(r.me, "見積を送る（中間3 消された 2）", SECTIONS);
  const r2 = { ...r, t: t2 };
  const job2 = await delegateAndTake(page, r2);
  await makeToApproval(page, r2, job2);
  expect(await lastBeatAgo(await r.pc.deviceId(), "5 minutes")).toBe(1);
  await approveBtn(page).click();
  await expect(execBand(page).getByText(MSG.pcClosed)).toBeVisible();
  await deleteTicketRow(t2, r.me.memberId);
  expect(await r.pc.beat()).toBeLessThan(300);
  expect(await r.w.take(), "消えたチケットの実行は渡さない").toBeNull();
  const exec = (await runsOf(t2)).find((x) => x.phase === "execute");
  expect(exec, "実行の仕事と記録は止まった（片付けは stopped・D-131.14）").toMatchObject({
    status_id: "stopped",
    job_state: "stopped",
  });
  expect(exec?.job_reason, "止まった理由").toBe(MSG.ticketDeleted);
  expect((await approvalsOf(t2))[0], "承認の記録は残る").toMatchObject({ decision: "approve", irreversible: true });
});

test("K64-M3-09 承認の記録は取り消せない：2 つのタブで承認する → 後のタブは「もう処理されています」・実行の仕事は 1 つ。口からの承認・差し戻しのやり直しも 409 で、記録は変わらない", async ({
  page,
  context,
}) => {
  const r = await ready(page, "二つのタブ");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  const tabB = await context.newPage();
  await tabB.clock.install(); // B の読み直しも本物の 3 秒に任せない（A の承認の後に B が勝手に読み直して「承認して送る」が消えないように）
  // B を確かな順で押せるのは、A の承認が決まるのを expect.poll で待ってから押すことと、
  // 承認待ちの間は動いている実行が無いので B は読み直さないこと（K-62・K-63 の読み直しの決まり・K62-UI-017）と、B の時計を進めないことによる
  await openTicket(tabB, r.t);
  await expect(approvalBand(tabB)).toBeVisible();
  await approveBtn(page).click();
  await expect
    .poll(async () => (await approvalsOf(r.t))[0]?.decision, "A の承認が決まってから B を押す")
    .toBe("approve");
  await approveBtn(tabB).click();
  await expect(tabB.getByRole("alert"), "帯で押して 409 の知らせ（単体は K63-UI-043）").toContainText(MSG.decided);
  await expect(approvalBand(tabB), "B の帯は読み直して今の状態に替わる").toHaveCount(0);
  const [a] = await approvalsOf(r.t);
  for (const [path, body] of [
    [`/approvals/${a!.id}/approve`, {}],
    [`/approvals/${a!.id}/return`, { note: "やっぱり直してください" }],
  ] as const) {
    const res = await asPerson(r.me.token, "POST", path, body);
    expect([res.status, res.code], path).toEqual([409, "E-CONF-003"]);
  }
  expect((await approvalsOf(r.t))[0], "決まった承認は変わらない").toEqual(a);
  expect(a).toMatchObject({ decision: "approve", irreversible: true });
  expect(
    (await runsOf(r.t)).filter((x) => x.phase === "execute"),
    "実行の仕事は 1 つ",
  ).toHaveLength(1);
  const one = await asPerson(r.me.token, "GET", `/approvals/${a!.id}`);
  expect(one.status).toBe(200);
  expect(one.data?.["irreversible"], "1 件の口も取り消せないの印を返す").toBe(true);
  await tabB.close();
});

test("K64-M3-10 完了の条件と閉じ方：実施事項が残っていると完了にできない → 全部で完了 → チケットは閉じ、仕事は残らず、任せ直しても前の続きの id を使わない", async ({
  page,
}) => {
  const r = await ready(page, "完了");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  await approveBtn(page).click();
  const exec = await r.w.take();
  expect(
    await r.w.finish(exec!.job_id, { state: "done", result: AI.sent, agent_session_id: "sess-k64" }),
  ).toMatchObject({ status: 201 });
  await tick(page);
  await expect(execBand(page).getByText(MSG.completeHint)).toBeVisible();
  // AI の実行は実施事項にチェックを入れない。人が確かめる（D-125.55）。1 つだけでは止まる
  expect(await todoNow(r.t), "AI の実行は実施事項にチェックを入れない").toBe(SECTIONS.todo);
  const completes: string[] = [];
  page.on("request", (q) => {
    if (q.method() === "POST" && new URL(q.url()).pathname.endsWith(`/tickets/${r.t}/complete`))
      completes.push(q.url());
  });
  await page.getByRole("button", { name: "完了にする", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d.getByRole("checkbox", { name: "見積を作る" }), "小窓を開いた直後は済みにしていない").not.toBeChecked();
  await expect(d.getByRole("checkbox", { name: "先方に送る" })).not.toBeChecked();
  await d.getByRole("checkbox", { name: "見積を作る" }).check();
  await d.getByRole("checkbox", { name: "完了の条件を満たしたことを確かめました" }).check();
  await d.getByRole("button", { name: "確かめて完了にする" }).click();
  await expect(d).toContainText(MSG.todoLeft);
  expect(completes, "残っている間は完了の口を呼ばない").toEqual([]);
  expect((await ticketState(r.t)).stage).toBe("doing");
  await d.getByRole("button", { name: "やめる" }).click();
  await completeAll(page);
  expect(completes, "全部そろったときだけ完了の口を 1 回").toHaveLength(1);
  await page.reload();
  await expect(delegateBtn(page), "完了したチケットは任せられない").toHaveCount(0);
  await expect(page.getByRole("button", { name: "完了にする", exact: true }), "完了にするも出ない").toHaveCount(0);
  await expect(execBand(page).getByText(/完了しました/)).toBeVisible();
  expect(await r.w.take(), "閉じたチケットの仕事は残らない").toBeNull();
  expect((await runsOf(r.t)).every((x) => ["done", "stopped", "cancelled"].includes(x.job_state))).toBe(true);
  expect(await todoNow(r.t), "実施事項は全部済みの印").toBe("- [x] 見積を作る\n- [x] 先方に送る");
  // 開き直す口は後の F5／F7。段だけを作業中に戻して任せ直す → 前の続き（sess-k64）を使わない（D-125.155）
  await setStage(r.t, "doing");
  await page.reload();
  await delegateBtn(page).click();
  const fresh = await r.w.take();
  expect(fresh).toMatchObject({ phase: "make", agent_session_id: null });
});

test("K64-M3-11 途中で権限が無くなる：任せたあと担当を同僚に替え、任せた人を見るだけにする → PC が結果を返す → 遅れた結果は捨てられ、承認待ちに出ない（G-14・D-128.179）", async ({
  page,
}) => {
  const r = await ready(page, "権限");
  const mate = await teammate(r.me, "中間3 新しい担当");
  const job = await delegateAndTake(page, r);
  // 担当を替える口（F4）と権限を変える口（F2）はまだ無いので、DB に直に置く（K62-API-019 と同じ置き方）
  await admin("update tickets set assignee_member_id = $2 where id = $1", [r.t, mate.memberId]);
  const changed = await admin<{ id: string }>(
    "update permissions set ability_id = 'view' where grantee_member_id = $1 and target_kind_id = 'tickets' and revoked_at is null and deleted_at is null returning id",
    [r.me.memberId],
  );
  expect(changed.length, "任せた人のチケットの権限を見るだけにした").toBeGreaterThan(0);
  const sessions = await admin<{ kind: string | null; revoked: boolean }>(
    "select kind_id as kind, revoked_at is not null as revoked from sessions where member_id = $1",
    [r.me.memberId],
  );
  expect(
    sessions.filter((x) => x.kind !== "bridge").every((x) => x.revoked),
    "画面のログインは切れる（D-128.179）",
  ).toBe(true);
  expect(
    sessions.some((x) => x.kind === "bridge" && !x.revoked),
    "PC のつながりは切れない（D-128.179）",
  ).toBe(true);
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: "sess-k64" })).toEqual({
    status: 201,
    outcome: "stopped",
  });
  expect(await artifactsOf(r.t), "遅れた結果は成果物にしない").toHaveLength(0);
  expect(await approvalsOf(r.t), "承認待ちに出さない").toHaveLength(0);
  const runs = await runsOf(r.t);
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({ phase: "make", status_id: "stopped" });
  const why = await admin<{ e: string | null }>("select error_summary as e from action_runs where id = $1", [
    runs[0]!.id,
  ]);
  expect(why[0]!.e).toBe(MSG.noWrite);
  expect((await ticketState(r.t)).stage).toBe("doing");
  expect((await systemLines(r.t)).at(-1)).toContain("止まりました");
});
