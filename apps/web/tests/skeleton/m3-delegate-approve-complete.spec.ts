// K-64 中間テスト 3：AI に任せる（K-62）→ 承認して完了する（K-63 の孫 K-161〜K-166・K-179〜K-184）を、本物のブラウザ・本物の DB・本物の口と、試験の PC でつなぐ（D-128.131）。
//   中の 1 本 1 本の分岐は単体の試験（K-62：apps/api/test/features/F5/delegate*.test.ts・apps/web/tests/features/F5/delegate.spec.ts・apps/bridge/test、
//   K-63 の孫：apps/api/test/features/F5/approve-complete-*.test.ts・apps/web/tests/features/F5/approve-complete-*.spec.ts）が持つ。
//   ここは「つないだときにだけ出るもの」を見る：PC の結果が承認待ちに渡るか・承認が実行の仕事になって任せた人の同じ PC に同じ続きで届くか・
//   差し戻しの理由が作り直しの仕事に渡るか・24 時間を過ぎた承認で実行しないか・実行が止まったら人が完了にできるか・
//   「AI に任せている」印が段の進みと合うか・完了でチケットが閉じ仕事が残らないか。
//   口は網の手前で差し替えない（page.route で答えを作らない。届く頭 x-forwarded-for だけを足す）。AI は決まった答え（_lib/f5-flow.ts の AI）。
//   PC は K-58 の試験の PC（_lib/test-pc.ts）に、契約の口で仕事を運ばせる（_lib/f5-flow.ts の workOf）。この PC の中だけの口（38617）は開かない。
//   人は _lib/newcomer.ts（登録の画面と受け箱）、PC をつなぐ・チケットを作るは _lib/prep.ts（口の道。画面の道は K-58 が持つ）。
//   時刻は DB の時刻を動かす（clock.ts の lastBeatAgo・f5-flow.ts の approvedAgo・待たない）。画面の 3 秒ごとの読み直しは、
//   固定の待ちを置かず、expect が画面の変わるのを待つ（読み直しは本物の間隔のまま・expect の待ちは 15 秒）。
//   ★前提：CI の web の組の G59 と同じ（API を試験の受け箱へ・画面は BASE_URL）。CI では写真・報告を残さない（K-186 の設定のまま）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../_lib/api";
import { lastBeatAgo } from "../_lib/clock";
import {
  AI,
  approvalsOf,
  approvedAgo,
  artifactsOf,
  delegatedMark,
  runsOf,
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
// 1 本の上限：手元（2026-11-13・自分で立てた口と画面）で 1 本 10〜35 秒。登録（画面とメール）と、3 秒ごとの読み直しを待つ切り替わりが 1 本に 8〜10 回ある。
//   CI の台は VM が同時に走るので、設定の 60 秒ではなく 120 秒（手元の最大の 3 倍を切り上げ）。1 つの確かめの待ちは設定の 15 秒のまま
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 64);
});
/** 立てた試験の PC は筋の終わりに必ず閉じる（自分で立てた分だけ・G-10） */
const pcs: TestPc[] = [];
test.afterEach(async () => {
  await Promise.all(pcs.splice(0).map((p) => p.close()));
});

/** 文言（errors.json と K-62・K-63 の仕様の表・決定から。実装から書かない） */
const MSG = {
  queuedLive: "PC が受け取るのを待っています", // K-62 の帯・任せた直後（D-133.1）
  made: "成果物ができました。承認待ちです", // K-62 の帯（承認する人でない人にだけ出す・D-128.178）
  checkNone: "検査なし（まだ流していません）", // D-128.138
  waitingMe: "あなたの承認を待っています", // K-63 の帯
  irreversible: "取り消せません", // D-128.177
  pcClosed: "実行待ち・PC が閉じています。開いたらすぐ実行します。承認から 24 時間を過ぎたら、もう一度聞きます", // K-63 の帯
  completeHint: "完了の条件を確かめて完了にしてください", // K-63 の帯
  decided: "この承認はもう処理されています", // E-CONF-003
  emptyResult: "自分のAI が結果を返さずに終わりました。完了とは見なしていません", // E-SIG-004
  note24h: "承認から 24 時間を過ぎたので、実行の前にもう一度確かめてください", // K-63 の聞き直しの行の note
  expired24h: "承認から 24 時間を過ぎたので、実行の前にもう一度確かめます", // K-63 が止めた前の仕事の理由（D-131.14）
  noWrite: "このチケットを直す権限が無くなったので止めました", // K-62 の止める理由（D-129.1）
  execHint: "承認された成果物を実行してください", // K-63 の承認の足し書き
  returnedHint: "差し戻されました。理由：", // K-63 の差し戻しの足し書き（作り直しの仕事の prompt）
  returnedOnBand: "差し戻しの理由：", // K-62 の帯（作り直しの間・D-129.12）
  empty: "いま決めるものはありません", // K-63 の承認待ちの画面・空
} as const;
/** 「{名前}のAI」（K-62・K-63 の画面とやり取りの 1 行の出し方・D-128.16） */
const aiOf = (me: Newcomer) => `${me.name}のAI`;
/** チケットの区画（実施事項は 2 項目＝完了の小窓のチェック 2 つ） */
const SECTIONS = {
  purpose: "先方に出す見積のたたき台を作って送る",
  done: "先方が見積を受け取った",
  todo: "- 見積を作る\n- 先方に送る",
} as const;

interface Ready {
  me: Newcomer;
  pc: TestPc;
  w: PcWork;
  /** チケットの id */
  t: string;
  title: string;
  /** AI の続きの id（PC が作る段の終わりに返す。契約は uuid）。筋ごとに 1 つ */
  session: string;
}
/** 登録した人・つないだ PC・チケット 1 枚（K-58 の正常の筋の終わりと同じ形。画面でつなぐ・作る道は K-58 が持つ） */
async function ready(page: Page, tag: string): Promise<Ready> {
  // 人の名前は道具の形（「中間2 <tag>」）のまま使う。道具は K-54・K-58 の試験も読むので、このチケットでは変えない
  const me = await newcomer(page, box, tag);
  const pc = await pairedPc(page, me.token, `中間3 の MacBook (${tag})`);
  pcs.push(pc);
  const title = `見積を送る 中間3 ${tag}`; // 題名・区画は口が表記を揃える（全角の括弧などは半角になる）ので、揃えても変わらない文にする
  const t = await ticketOf(page, me, title, SECTIONS);
  return { me, pc, w: workOf(pc), t, title, session: randomUUID() };
}
const openTicket = async (page: Page, r: Ready) => {
  const res = await page.goto(`/tickets/${r.t}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: r.title })).toBeVisible();
};
/** K-62 の帯（作る段の間） */
const aiBand = (page: Page) => page.getByRole("region", { name: "AI に任せる" });
/** K-63 の帯（承認待ち・実行待ち・実行中・止まった・完了の案内・完了のどの状態でも同じ名前） */
const execBand = (page: Page) => page.getByRole("region", { name: "承認と実行" });
const delegateBtn = (page: Page) => page.getByRole("button", { name: "AI に任せる", exact: true });
const approveBtn = (page: Page) => execBand(page).getByRole("button", { name: "承認して送る", exact: true });
const completeBtn = (page: Page) => page.getByRole("button", { name: "完了にする", exact: true });

/** PC が仕事を取る。本物の Bridge の輪と同じく、空なら次の問い合わせでまた取りに来る
 *  （取る口は、ほかの読み書きが触っている最中の仕事を飛ばして空を返すことがある＝for update skip locked。時間では待たず、取れるまで問い合わせる） */
async function takeSoon(r: Ready, what: string): Promise<Job> {
  let job: Job | null = null;
  await expect.poll(async () => (job ??= await r.w.take()), what).not.toBeNull();
  return job!;
}

/** 画面で任せる → 帯は「任せました。PC が受け取るのを待っています」→ PC が作る段の仕事を取る → 画面が自分で「作っています」に替わる */
async function delegateAndTake(page: Page, r: Ready): Promise<Job> {
  await openTicket(page, r);
  await delegateBtn(page).click();
  await expect(aiBand(page)).toContainText(`${aiOf(r.me)} に任せました`);
  await expect(aiBand(page), "PC が受け取る前は「作っています」と言わない（D-133.1）").toContainText(MSG.queuedLive);
  await expect(execBand(page), "作る段の間は K-63 の帯を出さない（D-128.178）").toHaveCount(0);
  const job = await takeSoon(r, "任せた仕事は任せた人の PC に渡る");
  expect(job).toMatchObject({
    kind: "ticket",
    ticket_id: r.t,
    phase: "make",
    permission_mode: "manual",
  });
  expect(job.prompt, "仕事の中身はチケットの区画から").toContain(SECTIONS.purpose);
  await expect(aiBand(page), "画面が PC の受け取りに自分で気づく").toContainText(`${aiOf(r.me)} が作っています`);
  return job;
}
/** 作る段を中身のある結果で終える → 開いたままの画面が承認待ちの帯に替わり、中身が出る（PC の結果が承認待ちに渡る） */
async function makeToApproval(page: Page, r: Ready, job: Job, text: string = AI.made) {
  expect(await r.w.finish(job.job_id, { state: "done", result: text, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
  await expect(execBand(page), "開いたままの画面が自分で承認待ちに替わる").toContainText(MSG.waitingMe);
  await expect(execBand(page)).toContainText(text);
  await expect(execBand(page)).toContainText(MSG.checkNone);
  await expect(execBand(page)).toContainText(MSG.irreversible);
  await expect(
    page.getByText(MSG.made),
    "承認する人には K-62 の帯の承認待ちの文を重ねて出さない（D-128.178）",
  ).toHaveCount(0);
}
/** 決める口（承認・差し戻し）の答えが返るのを待つ。押した直後に PC が取りに行くと、口が仕事を積む前に空振りする（時間では待たない） */
const decided = (page: Page, what: "approve" | "return") =>
  page.waitForResponse(
    (res) =>
      res.request().method() === "POST" &&
      new RegExp(`/api/v1/approvals/[^/]+/${what}$`).test(new URL(res.url()).pathname),
  );
/** 帯の「承認して送る」を押し、口が 201 で受けるのを待つ */
async function approveOnBand(page: Page): Promise<void> {
  const res = decided(page, "approve");
  await approveBtn(page).click();
  expect((await res).status(), "承認の口が受ける").toBe(201);
  await expect(approveBtn(page), "決めた承認を二度は押させない").toHaveCount(0);
}
/** 承認の後の実行の仕事を PC が取る（同じ PC・同じ続きの id・auto・足し書きつき） */
async function takeExecute(r: Ready): Promise<Job> {
  const exec = await takeSoon(r, "承認が実行の仕事になって、任せた人の PC に届く");
  expect(exec).toMatchObject({
    kind: "ticket",
    ticket_id: r.t,
    phase: "execute",
    agent_session_id: r.session,
    permission_mode: "auto",
  });
  expect(exec.prompt).toContain(MSG.execHint);
  return exec;
}
/** 完了の小窓で実施事項を全部チェックし、完了の条件を確かめて完了にする → 帯が「完了しました（名前・日時）」に替わる */
async function completeAll(page: Page, r: Ready): Promise<void> {
  await completeBtn(page).click();
  const d = page.getByRole("dialog");
  await d.getByRole("checkbox", { name: "見積を作る" }).check();
  await d.getByRole("checkbox", { name: "先方に送る" }).check();
  await d.getByRole("checkbox", { name: "完了の条件を満たしたことを確かめました" }).check();
  await d.getByRole("button", { name: "確かめて完了にする" }).click();
  await expect(execBand(page).getByText(/完了しました（.+・\d{1,2}\/\d{1,2} \d{1,2}:\d{2}）/)).toBeVisible();
  await expect(execBand(page)).toContainText(r.me.name);
  await expect(completeBtn(page), "完了したら「完了にする」は出ない").toHaveCount(0);
  await expect(delegateBtn(page), "完了したチケットは任せられない").toHaveCount(0);
  expect(await ticketState(r.t)).toMatchObject({ stage: "done", completed_by: r.me.memberId });
  expect(await todoNow(r.t), "実施事項は全部済みの印の版になる").toBe("- [x] 見積を作る\n- [x] 先方に送る");
  expect(await delegatedMark(r.t), "完了したチケットに「AI に任せている」印は残らない").toBe(false);
  // 先に仕事の状態を見る（取る口の「何も動かしていない」は取り残しを片付けるので、後から見ると片付けが閉じた物まで緑になる）
  expect(
    (await runsOf(r.t)).map((x) => x.job_state).filter((st) => !["done", "stopped", "cancelled"].includes(st)),
    "完了した時点で、終わっていない仕事は無い",
  ).toEqual([]);
  expect(await r.w.take({ idle: true }), "閉じたチケットの仕事は PC に渡らない").toBeNull();
}

test("K64-M3-01 正常：任せる → PC が作って終える → 承認待ちの画面の行から帯へ → 承認して送る → 同じ PC が同じ続きで実行して終える → 完了にする。記録が 1 本につながり、チケットが閉じる", async ({
  page,
}) => {
  const r = await ready(page, "正常");
  expect(await delegatedMark(r.t), "任せる前は印が無い").toBe(false);
  const job = await delegateAndTake(page, r);
  expect(await delegatedMark(r.t), "任せたら「AI に任せている」印が付く").toBe(true);
  expect(await r.w.progress(job.job_id, 1, "前回の見積を読んでいます")).toBe(201);
  await expect(aiBand(page), "PC の途中の様子が帯に届く").toContainText("前回の見積を読んでいます");
  await makeToApproval(page, r, job);
  expect(await r.w.take(), "承認するまで、実行の仕事は PC に渡らない").toBeNull();
  // 承認待ちの画面：PC の結果が、任せた人の AI の行として並ぶ（取り消せない扱いなので行では決めず「中身を見る」・D-128.36・D-128.177）
  await page.goto("/approvals");
  const line = page.getByRole("row").filter({ hasText: r.title });
  await expect(line).toHaveCount(1);
  await expect(line).toContainText(aiOf(r.me));
  await expect(line).toContainText(MSG.checkNone);
  await expect(line.getByRole("button", { name: "承認する" }), "取り消せない操作は行で決めない").toHaveCount(0);
  await line.getByRole("link", { name: "中身を見る" }).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${r.t}$`));
  await approveOnBand(page);
  const exec = await takeExecute(r);
  expect(await r.w.take(), "同じ仕事は二度渡らない").toBeNull();
  expect(await delegatedMark(r.t), "承認して AI がまた動いている間は印が付いている").toBe(true);
  await expect(execBand(page).getByText("実行中", { exact: true })).toBeVisible();
  await expect(
    aiBand(page).getByText(`${aiOf(r.me)} が作っています`),
    "実行の間は K-62 の状態の文を出さない",
  ).toHaveCount(0);
  expect(await r.w.finish(exec.job_id, { state: "done", result: AI.sent, agent_session_id: r.session })).toMatchObject({
    status: 201,
  });
  await expect(execBand(page).getByText(MSG.completeHint), "実行が終わると完了の案内に替わる").toBeVisible();
  await expect(delegateBtn(page), "終わった後は任せ直す道（ボタン）も並ぶ（D-129.11）").toBeVisible();
  expect(await delegatedMark(r.t), "実行が終わったら印が外れる").toBe(false);
  expect(await todoNow(r.t), "AI の実行は実施事項にチェックを入れない（人が確かめる・D-125.55）").toBe(SECTIONS.todo);
  await completeAll(page, r);
  // 記録：作る段と実行する段が、1 枚のチケットの上で 1 本につながる
  const runs = await runsOf(r.t);
  const approvals = await approvalsOf(r.t);
  expect(approvals, "承認の行は 1 つ").toHaveLength(1);
  expect(runs.map((x) => [x.phase, x.status_id, x.job_state, x.approval_id])).toEqual([
    ["make", "done", "done", null],
    ["execute", "done", "done", approvals[0]!.id],
  ]);
  const mine = await r.pc.deviceId();
  expect(
    runs.map((x) => [x.job_member, x.created_by, x.taken_session_id]),
    "どちらも任せた人の同じ PC",
  ).toEqual([
    [r.me.memberId, r.me.memberId, mine],
    [r.me.memberId, r.me.memberId, mine],
  ]);
  expect(approvals[0]).toMatchObject({
    decision: "approve",
    status_id: "approved",
    irreversible: true,
    approver_member_id: r.me.memberId,
  });
  expect(
    (await artifactsOf(r.t)).map((v) => v.text),
    "成果物の版は 1 つ",
  ).toEqual([AI.made]);
  const lines = await systemLines(r.t);
  for (const s of [
    `${aiOf(r.me)} に任せました`,
    `${aiOf(r.me)} が作り終えました`,
    `${r.me.name}が承認しました`,
    `${aiOf(r.me)} が実行しました`,
    `${r.me.name}が完了にしました`,
  ])
    expect(
      lines.some((l) => l.includes(s)),
      `やり取りに「${s}」`,
    ).toBe(true);
  const view = await asPerson(page, r.me.token, "GET", `/tickets/${r.t}/runs`);
  expect(
    (view.data as unknown as { phase: string }[]).map((x) => x.phase),
    "実行の記録の口は新しい順",
  ).toEqual(["execute", "make"]);
  await page.goto("/approvals");
  await expect(page.getByText(MSG.empty), "決め終わったら承認待ちは空").toBeVisible();
});

test("K64-M3-02 差し戻し：理由つきで差し戻す → 理由が作り直しの仕事に渡り、同じ PC が同じ続きで作り直す → 2 つ目の結果だけが承認待ちに出る → 承認すると 2 つ目の承認で実行する", async ({
  page,
}) => {
  const r = await ready(page, "差し戻し");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  const reason = "<b>宛名</b>を株式会社サンプルにしてください";
  await execBand(page).getByRole("button", { name: "差し戻す", exact: true }).click();
  await page.getByRole("textbox", { name: "差し戻す理由" }).fill(reason);
  const returned = decided(page, "return");
  await page.getByRole("button", { name: "差し戻して作り直させる" }).click();
  expect((await returned).status(), "差し戻しの口が受ける").toBe(201);
  // 作り直し（phase make）の間は K-62 の帯だけ（帯は段で分ける・D-128.178）。理由は文字として出す（D-129.12）
  await expect(aiBand(page)).toContainText(MSG.queuedLive);
  await expect(aiBand(page), "差し戻しの理由が作り直しの帯に文字として出る").toContainText(
    `${MSG.returnedOnBand}${reason}`,
  );
  await expect(aiBand(page).locator("b"), "理由の HTML は要素にならない").toHaveCount(0);
  await expect(execBand(page), "作り直しの間に K-63 の帯は出ない").toHaveCount(0);
  expect(await delegatedMark(r.t), "差し戻して AI がまた動くので印が付いている").toBe(true);
  const remake = await takeSoon(r, "作り直しの仕事が任せた人の PC に届く");
  expect(remake, "作り直しは作る段として、同じ続きで届く（D-131.5）").toMatchObject({
    ticket_id: r.t,
    phase: "make",
    agent_session_id: r.session,
    permission_mode: "manual",
  });
  expect(remake.prompt, "理由は書いたとおりの文で渡る").toContain(`${MSG.returnedHint}${reason}`);
  await expect(aiBand(page)).toContainText(`${aiOf(r.me)} が作っています`);
  await makeToApproval(page, r, remake, AI.remade);
  await expect(execBand(page), "前の成果物は出さない").not.toContainText(AI.made);
  const both = await approvalsOf(r.t);
  expect(both, "承認の行は 2 つ（前の行は差し戻しのまま残る）").toHaveLength(2);
  expect(both[0]).toMatchObject({ decision: "return", status_id: "returned", return_reason: reason });
  expect(both[1]).toMatchObject({ decision: null, status_id: "pending" });
  expect(
    (await artifactsOf(r.t)).map((v) => v.text),
    "版は 2 つ（前の版は残る）",
  ).toEqual([AI.made, AI.remade]);
  expect((await runsOf(r.t)).map((x) => [x.phase, x.status_id, x.approval_id, x.created_by])).toEqual([
    ["make", "done", null, r.me.memberId],
    ["make", "done", both[0]!.id, r.me.memberId],
  ]);
  await page.goto("/approvals");
  await expect(page.getByRole("row").filter({ hasText: r.title }), "承認待ちは新しい 1 行だけ").toHaveCount(1);
  await openTicket(page, r);
  await approveOnBand(page);
  await takeExecute(r);
  expect(
    (await runsOf(r.t)).filter((x) => x.phase === "execute").map((x) => x.approval_id),
    "実行を許したのは 2 つ目の承認",
  ).toEqual([both[1]!.id]);
});

test("K64-M3-03 承認から 24 時間：PC が閉じたまま承認する → 実行待ち → 24 時間 1 分たって PC が来ても古い承認では実行しない → 帯がもう一度聞く → 承認し直すと実行の仕事が届く", async ({
  page,
}) => {
  const r = await ready(page, "24 時間");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  expect(await lastBeatAgo(await r.pc.deviceId(), "5 minutes"), "PC を閉じて 5 分").toBe(1);
  await approveOnBand(page);
  await expect(execBand(page).getByText(MSG.pcClosed), "PC が閉じている間は実行待ちの文").toBeVisible();
  expect(await delegatedMark(r.t), "実行待ちの間は印が付いている").toBe(true);
  const [old] = await approvalsOf(r.t);
  expect(await approvedAgo(old!.id, "24 hours 1 minute")).toBe(1);
  expect(await r.pc.beat(), "PC が起きる").toBeLessThan(300);
  expect(await r.w.take(), "古い承認の実行は渡さない（D-128.98）").toBeNull();
  expect(await delegatedMark(r.t), "聞き直しになったら印が外れる").toBe(false);
  // 再読み込みしない：開いたままの画面が、次の読み直しで聞き直しの帯に替わる（実行待ちの文のまま残らない）
  await expect(execBand(page), "開いたままの画面が自分で聞き直しに替わる").toContainText(MSG.waitingMe);
  await expect(execBand(page), "聞き直しの訳が帯に出る").toContainText(MSG.note24h);
  await expect(execBand(page).getByText(MSG.pcClosed), "古い実行待ちの文は消える").toHaveCount(0);
  const now = await approvalsOf(r.t);
  expect(now).toHaveLength(2);
  expect(now[0], "前の承認は変えない（取り消せない扱いのまま）").toMatchObject({
    id: old!.id,
    decision: "approve",
    status_id: "approved",
    irreversible: true,
  });
  expect(now[1]).toMatchObject({ decision: null, status_id: "pending", irreversible: true, note: MSG.note24h });
  await approveOnBand(page);
  await takeExecute(r);
  expect(await delegatedMark(r.t), "聞き直しを承認したら印が付け直る").toBe(true);
  const execs = (await runsOf(r.t)).filter((x) => x.phase === "execute");
  expect(
    execs.map((x) => [x.status_id, x.job_state, x.approval_id]),
    "前の実行は止まった（片付けは stopped・D-131.14）。新しい実行は新しい承認で動く",
  ).toEqual([
    ["stopped", "stopped", old!.id],
    ["running", "running", now[1]!.id],
  ]);
  expect(execs[0]!.why, "止めた理由").toBe(MSG.expired24h);
  await expect(execBand(page).getByText("実行中", { exact: true }), "画面が実行の受け取りに自分で気づく").toBeVisible();
});

test("K64-M3-04 実行が止まる（G-15）：承認の後の実行が空の結果で終わる → 完了と見なさず止まった理由が帯に出る → 作業中に戻り「完了にする」が出て、人が確かめて完了にできる", async ({
  page,
}) => {
  const r = await ready(page, "実行が止まる");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  await approveOnBand(page);
  const exec = await takeExecute(r);
  await expect(execBand(page).getByText("実行中", { exact: true })).toBeVisible();
  expect(
    (await r.w.finish(exec.job_id, { state: "done", result: "" })).status,
    "空の結果でも口は受ける（成功にはしない）",
  ).toBe(201);
  await expect(execBand(page), "止まった理由が K-63 の帯に出る").toContainText(MSG.emptyResult);
  expect((await runsOf(r.t)).at(-1)).toMatchObject({ phase: "execute", status_id: "stopped" });
  expect((await ticketState(r.t)).stage, "完了にも承認待ちにもならず作業中に戻る").toBe("doing");
  expect(await approvalsOf(r.t), "実行の終わりは新しい承認待ちを作らない").toHaveLength(1);
  expect(await delegatedMark(r.t), "止まったら印が外れる").toBe(false);
  await expect(
    execBand(page).getByText(MSG.completeHint),
    "止まった後も、人が確かめて完了にする道が出る",
  ).toBeVisible();
  await expect(delegateBtn(page), "もう一度任せる道も並ぶ").toBeVisible();
  await completeAll(page, r);
  expect((await systemLines(r.t)).some((l) => l.includes(`${r.me.name}が完了にしました`))).toBe(true);
});

test("K64-M3-05 2 つのタブで承認：後のタブは「もう処理されています」の知らせで帯が替わり、実行の仕事は 1 つ。口からのやり直しも 409 で、承認の記録は変わらない", async ({
  page,
  context,
}) => {
  const r = await ready(page, "二つのタブ");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  // 承認待ちの間は走っている実行が無いので、B は自分では読み直さない（K62-UI-017）。A の承認の口が答えてから B を押す
  const tabB = await context.newPage();
  await openTicket(tabB, r);
  await expect(approveBtn(tabB)).toBeVisible();
  await approveOnBand(page);
  const late = decided(tabB, "approve");
  await approveBtn(tabB).click();
  expect((await late).status(), "後のタブの承認は 409").toBe(409);
  await expect(tabB.getByRole("alert").filter({ hasText: MSG.decided }), "後のタブに 409 の知らせ").toBeVisible();
  await expect(approveBtn(tabB), "B の帯は読み直して今の状態に替わる").toHaveCount(0);
  const [a] = await approvalsOf(r.t);
  for (const [path, body] of [
    [`/approvals/${a!.id}/approve`, {}],
    [`/approvals/${a!.id}/return`, { note: "やっぱり直してください" }],
  ] as const) {
    const res = await asPerson(page, r.me.token, "POST", path, body);
    expect([res.status, res.code], path).toEqual([409, "E-CONF-003"]);
  }
  expect((await approvalsOf(r.t))[0], "決まった承認は変わらない").toEqual(a);
  expect(a).toMatchObject({ decision: "approve", irreversible: true });
  expect(
    (await runsOf(r.t)).filter((x) => x.phase === "execute"),
    "実行の仕事は 1 つ",
  ).toHaveLength(1);
  await takeExecute(r);
  expect(await r.w.take(), "PC に届く実行も 1 つだけ").toBeNull();
  await tabB.close();
});

test("K64-M3-06 途中で権限が無くなる（G-14）：任せたあと担当を同僚に替え、任せた人を見るだけにする → PC が結果を返しても捨てられ、承認待ちに出ない。画面のログインは切れ、PC のつながりは残る", async ({
  page,
}) => {
  const r = await ready(page, "権限");
  const mate = await teammate(r.me, "中間3 新しい担当");
  const job = await delegateAndTake(page, r);
  // 担当を替える口（F4）と権限を変える口（F2）が入るまでは、このチケットでは DB に直に置く（K62-API-019 と同じ置き方）
  await admin("update tickets set assignee_member_id = $2 where id = $1", [r.t, mate.memberId]);
  const changed = await admin<{ id: string }>(
    "update permissions set ability_id = 'view' where grantee_member_id = $1 and target_kind_id = 'tickets' and revoked_at is null and deleted_at is null returning id",
    [r.me.memberId],
  );
  expect(changed.length, "任せた人のチケットの権限を見るだけにした").toBeGreaterThan(0);
  const sessions = await admin<{ kind: string | null; revoked: boolean; reason: string | null }>(
    "select kind_id as kind, revoked_at is not null as revoked, revoke_reason_id as reason from sessions where member_id = $1",
    [r.me.memberId],
  );
  const web = sessions.filter((x) => x.kind !== "bridge");
  expect(web.length, "画面のセッションがある（0 本で緑にしない）").toBeGreaterThan(0);
  expect(
    web.map((x) => [x.revoked, x.reason]),
    "画面のログインは権限の変化で切れる（D-128.179）",
  ).toEqual(web.map(() => [true, "permission_changed"]));
  expect(
    sessions.filter((x) => x.kind === "bridge").map((x) => x.revoked),
    "PC のつながりは切れない",
  ).toEqual([false]);
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "stopped",
  });
  expect(await artifactsOf(r.t), "遅れた結果は成果物にしない").toHaveLength(0);
  expect(await approvalsOf(r.t), "承認待ちに出さない").toHaveLength(0);
  const runs = await runsOf(r.t);
  expect(runs.map((x) => [x.phase, x.status_id, x.why])).toEqual([["make", "stopped", MSG.noWrite]]);
  expect((await ticketState(r.t)).stage).toBe("doing");
  expect(await delegatedMark(r.t), "止まったら印が外れる").toBe(false);
  expect((await systemLines(r.t)).at(-1), "やり取りに止まった 1 行").toContain("止まりました");
});

test("K64-M3-07 作る段が止まる（G-15）：作る段が空白だけの結果で終わる → 承認待ちに出ず、止まった理由と「AI に任せる」が出る → 人が自分で進めて「完了にする」で完了にできる", async ({
  page,
}) => {
  const r = await ready(page, "作る段が止まる");
  const job = await delegateAndTake(page, r);
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.empty })).toEqual({
    status: 201,
    outcome: "stopped",
  });
  await expect(aiBand(page), "作る段の止まった理由は K-62 の帯に").toContainText(MSG.emptyResult);
  await expect(delegateBtn(page), "止まったらもう一度任せられる").toBeVisible();
  expect(await approvalsOf(r.t), "承認待ちを作らない").toEqual([]);
  expect(await artifactsOf(r.t), "成果物の版を作らない").toEqual([]);
  expect((await ticketState(r.t)).stage, "段は作業中").toBe("doing");
  expect(await delegatedMark(r.t), "止まったら印が外れる").toBe(false);
  await page.goto("/approvals");
  await expect(page.getByText(MSG.empty), "承認待ちの画面に止まった作る段の結果は混ざらない").toBeVisible();
  // AI の成果物が無いまま、人が自分で進めて完了にする（作る段が止まった後の「完了にする」は K-63 の孫の最後の画面で出る）
  await openTicket(page, r);
  await expect(execBand(page).getByText(MSG.completeHint)).toBeVisible();
  await completeAll(page, r);
  expect(
    (await runsOf(r.t)).map((x) => [x.phase, x.status_id]),
    "実行の記録は止まった作る段の 1 つのまま",
  ).toEqual([["make", "stopped"]]);
});
