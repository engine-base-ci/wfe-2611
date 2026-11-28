// K-771 中間テスト M2（段 6・K-61）：止める・取り下げる・試し打ち を、本物のブラウザ・本物の DB・本物の口と、試験の PC でつなぐ（D-128.131）。
//   中の 1 本 1 本の分岐は単体の試験（口：K-731〜K-733・K-746・K-779 の apps/api/test/features/F5、画面：K-734・K-735・K-747 の apps/web/tests/k）が持つ。
//   ここは「つないだときにだけ出るもの」を見る：止めた後に PC から届いた「終わった」が承認待ちにならないか・止める合図が PC に届くか・
//   止めた後に任せ直しても古い仕事が新しい実行を壊さないか・止められるのは担当者だけか・承認待ちを止めても成果物が残るか・
//   取り下げると承認待ちに戻り、PC が受け取る前なら何も渡らず、受け取った後は間に合わないか・取り下げのお知らせは今の担当者だけか・
//   試し打ちが承認待ちを動かさず本人のメールアドレス宛てで終わるか・承認が決まると待っている試し打ちが止まるか。
//   口は網の手前で差し替えない（page.route で答えを作らない。届く頭 x-forwarded-for だけを足す）。AI は決まった答え（_lib/f5-flow.ts の AI）。
//   PC は K-58 の試験の PC（_lib/test-pc.ts）に、契約の口で仕事を運ばせる（_lib/f5-flow.ts の workOf）。この PC の中だけの口（38617）は開かない（本人の Bridge に触らない）。
//   人は _lib/newcomer.ts、PC をつなぐ・チケットを作る・同じ会社のもう 1 人は _lib/prep.ts。任せるのは画面でなく口（POST /tickets/:id/delegate・使わない理由つき）：
//   画面で任せる道は K-770・段 5 の中間が通る。ここで画面を押すのは、止める・取り下げる・試し打ちの 3 つの入口だけ。
//   画面の字（帯・確かめの小窓・ボタン）は下絵（/dev/mock/f5 の stop-*・withdraw-*・dry-*）の字（画面の葉 K-734・K-735・K-747 が名前を変えたら、ここも同時に直す）。
//   時刻は進めない（待たない）。固定の待ちは置かず、口の答え・画面の要素・DB の値が変わるのを待つ。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Response } from "@playwright/test";
import { API, admin } from "../_lib/api";
import {
  AI,
  approvalsOf,
  artifactsOf,
  delegatedMark,
  runsOf,
  systemLines,
  ticketState,
  workOf,
  type Job,
  type PcWork,
} from "../_lib/f5-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { asPerson, pairedPc, teammate, ticketOf } from "../_lib/prep";
import type { TestPc } from "../_lib/test-pc";
import { approveVia } from "../k/approve-modal";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
// 1 本の上限：登録（画面とメール）・PC をつなぐ・任せる・PC が取る・画面を押す・開き直す、で 1 本 20〜40 秒の見込み。CI の台は VM が同時に走るので 150 秒
test.describe.configure({ timeout: 150_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 71);
});
/** 立てた試験の PC は筋の終わりに必ず閉じる（自分で立てた分だけ・G-10） */
const pcs: TestPc[] = [];
test.afterEach(async () => {
  await Promise.all(pcs.splice(0).map((p) => p.close()));
});

/** 文言（K-731〜K-733・K-746・K-779 の仕様の表と、下絵 /dev/mock/f5 の字から。実装から書かない。下絵に無い字は「仮」） */
const MSG = {
  waitingMe: "あなたの承認を待っています", // K-63 の帯
  empty: "いま決めるものはありません", // 承認待ちの画面・空
  running: "実行中", // 承認の後の実行の帯
  stopRunTitle: "AI を止めます", // 下絵 stop-running-confirm
  stopApprovalTitle: "承認待ちの成果物を使わずに止めます", // 下絵 stop-approval-confirm
  withdrawTitle: "承認を取り下げます", // 下絵 withdraw-confirm
  dryTitle: "試し打ちします", // 下絵 dry-confirm
  stoppedRun: "を止めました", // 下絵 stop-stopped-band「〈名〉のAI を止めました」
  stoppedApproval: "承認待ちの成果物を止めました", // 下絵 stop-approval-stopped
  ignored: "止めたので、届いた結果は使いませんでした", // D-153.20・下絵 stop-ignored-result
  denied: "この AI を止められるのは担当者です", // E-RUN-001（D-153.24）
  dryRunning: "試し打ちを実行しています", // 下絵 dry-running
  dryDone: "試し打ちをあなた宛てに送りました", // 下絵 dry-done
  dryStopped: "試し打ちは止まりました", // 下絵 dry-stopped
  dryHead: "【試し打ちは実行せず止まりました】", // K-746 の決めた見出し
  dryWaitingStopped: "承認が決まったので、待っていた試し打ちを止めました", // K-779 の決めた文
} as const;
const SECTIONS = {
  purpose: "先方に出す見積のたたき台を作って送る",
  done: "先方が見積を受け取った",
  todo: "- 見積を作る\n- 先方に送る",
} as const;
/** 確認項目が 0 件のチケットを任せるときに送る使わない理由（K-565・D-150.45） */
const NO_SPEC = "定型の作業・中間テスト（段 6）の準備";
const STOP_RUN_RE = /^\/api\/v1\/action_runs\/[^/]+\/stop$/;
const STOP_APPROVAL_RE = /^\/api\/v1\/approvals\/[^/]+\/stop$/;
const WITHDRAW_RE = /^\/api\/v1\/approvals\/[^/]+\/withdraw$/;
const DRY_RE = /^\/api\/v1\/tickets\/[^/]+\/dry-run$/;
const aiOf = (me: Newcomer) => `${me.name}のAI`;

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
/** 登録した人・つないだ PC・チケット 1 枚（担当は本人）。人の名前は道具の形（「中間2 <tag>」）のまま使う（道具は K-54・K-58 の試験も読む） */
async function ready(page: Page, tag: string): Promise<Ready> {
  const me = await newcomer(page, box, tag);
  const pc = await pairedPc(page, me.token, `中間M2 の MacBook (${tag})`);
  pcs.push(pc);
  const title = `見積を送る 中間M2 ${tag}`;
  const t = await ticketOf(page, me, title, SECTIONS);
  return { me, pc, w: workOf(pc), t, title, session: randomUUID() };
}
const openTicket = async (page: Page, r: Ready) => {
  const res = await page.goto(`/tickets/${r.t}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: r.title })).toBeVisible();
};
const aiBand = (page: Page) => page.getByRole("region", { name: "AI に任せる", exact: true });
const execBand = (page: Page) => page.getByRole("region", { name: "承認と実行", exact: true });
const approveBtn = (page: Page) => execBand(page).getByRole("button", { name: "承認して送る", exact: true });
/** 押した後の口の答え（POST・道が re に合う）。押す前に呼んで、押した後に await する（時間では待たない） */
const answered = (page: Page, method: string, re: RegExp): Promise<Response> =>
  page.waitForResponse((res) => res.request().method() === method && re.test(new URL(res.url()).pathname));
const dataOf = async (res: Response): Promise<Record<string, unknown>> =>
  ((await res.json()) as { data?: Record<string, unknown> }).data ?? {};

// ---------------------------------------------------------------- DB・PC の読み（この試験の中だけ）
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
/** 本物の Bridge の名乗り（f5-flow.ts の workOf と同じ読み方・apps/bridge は CommonJS） */
const bridgeUa = (): string =>
  (createRequire(join(ROOT, "apps/bridge/src/main.ts"))("./pairing.ts") as { BRIDGE_UA: string }).BRIDGE_UA;
/** PC が「止める合図が立っているか」を見に行く口（getJobControl・PC の輪は動いている間ずっと呼ぶ）。f5-flow.ts の workOf には無いので、この試験の中に置く */
async function controlOf(pc: TestPc, jobId: string): Promise<{ status: number; stop: boolean | null }> {
  const token = pc.token();
  if (!token) throw new Error("まだつながっていない PC は止める合図を見に行かない");
  const res = await fetch(`${API}/api/v1/bridge/jobs/${jobId}/control`, {
    headers: {
      "x-bridge-session": token,
      "user-agent": bridgeUa(),
      "x-forwarded-for": `10.71.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`,
    },
  });
  const j = JSON.parse((await res.text()) || "{}") as { data?: { stop?: boolean } };
  return { status: res.status, stop: j.data?.stop ?? null };
}
const jobOf = async (jobId: string) =>
  (
    await admin<{ state_id: string; stop_requested_at: Date | null; stopped_reason: string | null }>(
      "select state_id, stop_requested_at, stopped_reason from bridge_jobs where id = $1",
      [jobId],
    )
  )[0]!;
/** DB：承認の行（古い順）。取り下げの印は withdrawn_at（決まった承認は変えず、印だけ付く・D-153.27） */
const approvalRows = (t: string) =>
  admin<{
    id: string;
    decision: string | null;
    status_id: string;
    withdrawn: boolean;
    approver_member_id: string | null;
  }>(
    `select id, decision, status_id, withdrawn_at is not null as withdrawn, approver_member_id
       from approvals where ticket_id = $1 and deleted_at is null order by created_at, id`,
    [t],
  );
/** DB：そのチケットの受け箱の行（種類と宛先の人） */
const noticesOf = (t: string) =>
  admin<{ member_id: string; event_kind_id: string }>(
    "select member_id, event_kind_id from notifications where payload->>'ticket_id' = $1 and deleted_at is null order by created_at, id",
    [t],
  );
const hasLine = async (t: string, s: string | RegExp): Promise<boolean> =>
  (await systemLines(t)).some((l) => (typeof s === "string" ? l.includes(s) : s.test(l)));

// ---------------------------------------------------------------- 筋の部品
/** 口で任せる（使わない理由つき）。201 を確かめて、答えを返す */
async function delegateByApi(page: Page, r: Ready): Promise<void> {
  const d = await asPerson(page, r.me.token, "POST", `/tickets/${r.t}/delegate`, { no_spec_reason: NO_SPEC });
  expect(d.status, "任せる口が受ける").toBe(201);
}
/** PC が仕事を取る。本物の Bridge の輪と同じく、空なら次の問い合わせでまた取りに来る（時間では待たず、取れるまで問い合わせる） */
async function takeSoon(r: Ready, what: string): Promise<Job> {
  let job: Job | null = null;
  await expect.poll(async () => (job ??= await r.w.take()), what).not.toBeNull();
  return job!;
}
/** 口で任せる → PC が作る段の仕事を取る（実行は動いている） */
async function delegateAndTake(page: Page, r: Ready): Promise<Job> {
  await delegateByApi(page, r);
  const job = await takeSoon(r, "任せた仕事は任せた人の PC に渡る");
  expect(job).toMatchObject({ kind: "ticket", ticket_id: r.t, phase: "make" });
  return job;
}
/** 作る段を中身のある結果で終える → 承認待ちになる */
async function finishMake(r: Ready, job: Job, text: string = AI.made): Promise<void> {
  expect(await r.w.finish(job.job_id, { state: "done", result: text, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
}
/** 作る段を終えて、開いた画面が承認待ちの帯に替わるまで見る */
async function makeToApproval(page: Page, r: Ready, job: Job): Promise<void> {
  await openTicket(page, r);
  await finishMake(r, job);
  await expect(execBand(page), "開いたままの画面が自分で承認待ちに替わる").toContainText(MSG.waitingMe);
}
/** 帯の「承認して送る」を押し、確かめの小窓で承認して、口が 201 で受けるのを待つ */
async function approveOnBand(page: Page): Promise<void> {
  const res = answered(page, "POST", /^\/api\/v1\/approvals\/[^/]+\/approve$/);
  await approveVia(page, approveBtn(page));
  expect((await res).status(), "承認の口が受ける").toBe(201);
  await expect(approveBtn(page), "決めた承認を二度は押させない").toHaveCount(0);
}
/** 承認の後の実行の仕事を PC が取る（同じ続きの id・execute） */
async function takeExecute(r: Ready): Promise<Job> {
  const exec = await takeSoon(r, "承認が実行の仕事になって、任せた人の PC に届く");
  expect(exec).toMatchObject({ kind: "ticket", ticket_id: r.t, phase: "execute", agent_session_id: r.session });
  return exec;
}
/** 確かめの小窓（alertdialog）を開いて、題を確かめ、主ボタンを押す。口の答えを返す */
async function pressAndConfirm(
  page: Page,
  press: () => Promise<void>,
  title: string,
  confirm: string,
  method: string,
  re: RegExp,
): Promise<Response> {
  const got = answered(page, method, re);
  await press();
  const sure = page.getByRole("alertdialog", { name: title, exact: true });
  await expect(sure, `確かめの小窓「${title}」が開く`).toBeVisible();
  await sure.getByRole("button", { name: confirm, exact: true }).click();
  return got;
}

test("K771-M2-01 止める：動いている AI を担当者が［止める］で止める → 実行は止まり PC に止める合図が届く → 止めた後に PC が「終わった」を返しても承認待ちにならず、結果も使わない", async ({
  page,
}) => {
  const r = await ready(page, "止める1");
  const job = await delegateAndTake(page, r);
  await openTicket(page, r);
  await expect(aiBand(page)).toContainText(`${aiOf(r.me)} が作っています`);
  const res = await pressAndConfirm(
    page,
    () => aiBand(page).getByRole("button", { name: "止める", exact: true }).click(),
    MSG.stopRunTitle,
    "止める",
    "POST",
    STOP_RUN_RE,
  );
  expect(res.status(), "止める口が受ける").toBe(201);
  expect(await dataOf(res)).toMatchObject({ ticket_id: r.t, phase: "make", status: "stopped" });
  await expect(page.getByText(`${aiOf(r.me)} ${MSG.stoppedRun}`, { exact: true }), "止めた後の帯").toBeVisible();
  // 押した直後：実行は止まり、仕事は動いたまま止める合図だけが立つ。PC は合図を読める。段は作業中・印は下りる。お知らせは止める口が書かない（D-153.7）
  const [run] = await runsOf(r.t);
  expect(run).toMatchObject({
    phase: "make",
    status_id: "stopped",
    job_state: "running",
    why: `${r.me.name}が止めました`,
  });
  expect((await jobOf(job.job_id)).stop_requested_at, "止める合図が立つ").not.toBeNull();
  expect(await controlOf(r.pc, job.job_id), "PC が合図を読むと止まれと言われる").toEqual({ status: 200, stop: true });
  expect((await ticketState(r.t)).stage, "段は作業中に戻る").toBe("doing");
  expect(await delegatedMark(r.t), "「AI に任せている」印は下りる").toBe(false);
  expect(await hasLine(r.t, `${r.me.name}が AI を止めました`), "やり取りに止めた 1 行").toBe(true);
  expect(
    (await noticesOf(r.t)).filter((n) => ["ticket.run_stopped", "approval.stopped"].includes(n.event_kind_id)),
    "止める口は受け箱に何も書かない（D-153.7）",
  ).toEqual([]);
  // 止めた後に PC が合図を読まないまま「終わった」を返す：承認待ちにせず、成果物も作らず、使わなかったと残す
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "stopped",
  });
  expect(await approvalRows(r.t), "承認待ちを作らない").toEqual([]);
  expect(await artifactsOf(r.t), "成果物の版を作らない").toEqual([]);
  expect(
    (await runsOf(r.t)).map((x) => [x.status_id, x.job_state]),
    "仕事は閉じ、実行は止まったまま",
  ).toEqual([["stopped", "stopped"]]);
  expect((await jobOf(job.job_id)).stopped_reason, "止めた理由が仕事に残る").not.toBeNull();
  expect(await hasLine(r.t, MSG.ignored), "やり取りに「使いませんでした」1 行").toBe(true);
  expect(await hasLine(r.t, "作り終えました"), "「作り終えました」の行は出ない").toBe(false);
  expect((await ticketState(r.t)).stage).toBe("doing");
  expect(await delegatedMark(r.t)).toBe(false);
  await openTicket(page, r);
  await expect(page.getByText(MSG.waitingMe, { exact: true }), "開き直しても承認待ちの帯は出ない").toHaveCount(0);
  await page.goto("/approvals");
  await expect(page.getByText(MSG.empty), "承認待ちの画面にも出ない").toBeVisible();
});

test("K771-M2-02 止めて任せ直す：止めた後にもう一度任せ、古い仕事の「終わった」が後から届いても、新しい実行・旗・承認待ちを壊さない", async ({
  page,
}) => {
  const r = await ready(page, "止める2");
  const old = await delegateAndTake(page, r);
  const [oldRun] = await runsOf(r.t);
  expect((await asPerson(page, r.me.token, "POST", `/action_runs/${oldRun!.id}/stop`, {})).status, "止める口").toBe(
    201,
  );
  await delegateByApi(page, r); // 止めた後にもう一度任せる
  expect(
    (await runsOf(r.t)).map((x) => [x.status_id, x.job_state]),
    "古い実行は止まり、新しい実行は待っている",
  ).toEqual([
    ["stopped", "running"],
    ["queued", "queued"],
  ]);
  expect(await delegatedMark(r.t), "任せ直したので印が付く").toBe(true);
  // 古い仕事の「終わった」が後から届く
  expect(await r.w.finish(old.job_id, { state: "done", result: AI.made, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "stopped",
  });
  expect(
    (await runsOf(r.t)).map((x) => [x.status_id, x.job_state]),
    "新しい実行は待ったまま",
  ).toEqual([
    ["stopped", "stopped"],
    ["queued", "queued"],
  ]);
  expect(await delegatedMark(r.t), "新しい実行の印は残る").toBe(true);
  expect(await approvalRows(r.t), "古い結果は承認待ちにならない").toEqual([]);
  expect(await artifactsOf(r.t)).toEqual([]);
  expect(await hasLine(r.t, MSG.ignored)).toBe(true);
  // 新しい仕事は PC に渡り、新しい結果は承認待ちになる
  const next = await takeSoon(r, "任せ直した仕事が PC に届く");
  expect(next).toMatchObject({ ticket_id: r.t, phase: "make" });
  expect(next.job_id, "古い仕事とは別").not.toBe(old.job_id);
  await finishMake(r, next, AI.remade);
  expect(
    (await approvalRows(r.t)).map((a) => a.decision),
    "承認待ちは新しい結果の 1 つだけ",
  ).toEqual([null]);
  expect((await artifactsOf(r.t)).map((v) => v.text)).toEqual([AI.remade]);
});

test("K771-M2-03 止められるのは担当者だけ（D-153.24）：任せた人でも担当者でなければ止められず、断りの文が帯に出て、実行はそのまま動き、結果が承認待ちに渡る先は今の担当者", async ({
  page,
}) => {
  const r = await ready(page, "止める3");
  const mate = await teammate(r.me, "中間M2 担当");
  const job = await delegateAndTake(page, r);
  // 担当を替える口（F4）が入るまでは DB に直に置く（K-64 の m3-06 と同じ置き方）
  await admin("update tickets set assignee_member_id = $2 where id = $1", [r.t, mate.memberId]);
  await openTicket(page, r);
  const res = await pressAndConfirm(
    page,
    () => aiBand(page).getByRole("button", { name: "止める", exact: true }).click(),
    MSG.stopRunTitle,
    "止める",
    "POST",
    STOP_RUN_RE,
  );
  expect(res.status(), "担当者でない人の止める口は 403").toBe(403);
  expect(((await res.json()) as { code?: string }).code).toBe("E-RUN-001");
  await expect(page.getByRole("alert").filter({ hasText: MSG.denied }), "断りの文が帯に出る").toBeVisible();
  const [run] = await runsOf(r.t);
  expect([run!.status_id, run!.job_state], "実行は動いたまま").toEqual(["running", "running"]);
  expect((await jobOf(job.job_id)).stop_requested_at, "止める合図は立たない").toBeNull();
  expect(await controlOf(r.pc, job.job_id), "PC は止めろと言われない").toEqual({ status: 200, stop: false });
  const direct = await asPerson(page, r.me.token, "POST", `/action_runs/${run!.id}/stop`, {});
  expect([direct.status, direct.code], "口を直に呼んでも同じ").toEqual([403, "E-RUN-001"]);
  expect(await hasLine(r.t, "AI を止めました"), "止めていないのでやり取りに行は増えない").toBe(false);
  // 止められなかった実行はそのまま終わり、承認する人は結果が届いた時点の担当者
  await finishMake(r, job);
  const [a] = await approvalsOf(r.t);
  expect(a).toMatchObject({ decision: null, approver_member_id: mate.memberId });
});

test("K771-M2-04 承認待ちを止める：承認する人が［止める］で承認待ちを止める → 成果物は残り、チケットは作業中に戻り、お知らせは書かれず、もう一度任せられる", async ({
  page,
}) => {
  const r = await ready(page, "止める4");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  const res = await pressAndConfirm(
    page,
    () => execBand(page).getByRole("button", { name: "止める", exact: true }).click(),
    MSG.stopApprovalTitle,
    "止める",
    "POST",
    STOP_APPROVAL_RE,
  );
  expect(res.status(), "承認待ちを止める口が受ける").toBe(201);
  expect(await dataOf(res)).toMatchObject({ decision: "stop", status_id: "stopped", ticket_id: r.t });
  await expect(page.getByText(MSG.stoppedApproval, { exact: true }), "止めた後の帯").toBeVisible();
  const rows = await approvalRows(r.t);
  expect(
    rows.map((a) => [a.decision, a.status_id, a.withdrawn]),
    "承認の行は止めたで決まる",
  ).toEqual([["stop", "stopped", false]]);
  expect(
    (await artifactsOf(r.t)).map((v) => v.text),
    "成果物は使わずに残る（版は消えない）",
  ).toEqual([AI.made]);
  expect((await ticketState(r.t)).stage).toBe("doing");
  expect(await delegatedMark(r.t)).toBe(false);
  expect(
    await hasLine(r.t, `${r.me.name}が承認待ちを止めました（成果物の版 1 は残っています）`),
    "やり取りに止めた 1 行",
  ).toBe(true);
  expect(
    (await noticesOf(r.t)).filter((n) => n.event_kind_id === "approval.stopped"),
    "止める口は受け箱に何も書かない（D-153.7）",
  ).toEqual([]);
  await page.goto("/approvals");
  await expect(page.getByText(MSG.empty), "止めた承認は承認待ちの画面から消える").toBeVisible();
  expect(await r.w.take(), "止めた成果物は実行の仕事にならない").toBeNull();
  // もう一度任せられる：止めた承認は止めたまま、新しい作る段が積まれる
  await delegateByApi(page, r);
  const next = await takeSoon(r, "もう一度任せた作る段が PC に届く");
  expect(next).toMatchObject({ ticket_id: r.t, phase: "make" });
  expect(
    (await approvalRows(r.t)).map((a) => a.decision),
    "止めた承認は止めたまま",
  ).toEqual(["stop"]);
});

test("K771-M2-05 承認を取り下げる：承認した後・PC が受け取る前に［承認を取り下げる］ → 承認待ちに戻り、実行は取り消され、PC に何も渡らず、承認し直すと新しい実行が届く。本人が担当者ならお知らせは出ない", async ({
  page,
}) => {
  const r = await ready(page, "取り下げ5");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  await approveOnBand(page); // PC はまだ取りに来ない＝実行待ち
  const res = await pressAndConfirm(
    page,
    () => execBand(page).getByRole("button", { name: "承認を取り下げる", exact: true }).click(),
    MSG.withdrawTitle,
    "取り下げる",
    "POST",
    WITHDRAW_RE,
  );
  expect(res.status(), "取り下げる口が受ける").toBe(201);
  const body = await dataOf(res);
  expect(body, "答えは新しい承認待ちの行を指す").toMatchObject({ ticket_id: r.t });
  await expect(approveBtn(page), "承認待ちの帯に戻る").toBeVisible();
  await expect(execBand(page)).toContainText(MSG.waitingMe);
  const rows = await approvalRows(r.t);
  expect(
    rows.map((a) => [a.decision, a.withdrawn]),
    "古い承認は承認のまま取り下げの印・新しい承認待ちが 1 つ",
  ).toEqual([
    ["approve", true],
    [null, false],
  ]);
  expect(rows[1]!.id, "答えの approval_id は新しい承認待ちの行").toBe(body["approval_id"]);
  expect(
    (await runsOf(r.t)).map((x) => [x.phase, x.status_id, x.job_state]),
    "承認の後の実行は取り消される",
  ).toEqual([
    ["make", "done", "done"],
    ["execute", "cancelled", "cancelled"],
  ]);
  expect((await ticketState(r.t)).stage, "段は承認待ちに戻る").toBe("awaiting_approval");
  expect(await delegatedMark(r.t), "印は下りる").toBe(false);
  expect(await hasLine(r.t, `${r.me.name}が承認を取り下げました（承認待ちに戻りました）`)).toBe(true);
  expect(await r.w.take(), "取り下げた後は、PC が取りに来ても何も渡らない").toBeNull();
  expect(
    (await noticesOf(r.t)).filter((n) => n.event_kind_id === "approval.withdrawn"),
    "取り下げた本人が担当者なら自分あてのお知らせは出ない（D-153.7）",
  ).toEqual([]);
  // 承認し直すと、新しい承認で新しい実行が届く
  await approveOnBand(page);
  await takeExecute(r);
  expect(
    (await approvalRows(r.t)).map((a) => [a.decision, a.withdrawn]),
    "2 つ目の承認が実行を許した",
  ).toEqual([
    ["approve", true],
    ["approve", false],
  ]);
  expect((await runsOf(r.t)).map((x) => [x.phase, x.status_id])).toEqual([
    ["make", "done"],
    ["execute", "cancelled"],
    ["execute", "running"],
  ]);
});

test("K771-M2-06 受け取った後は間に合わない：PC が実行の仕事を取った後の取り下げは 409（もう実行が始まっています）で何も変わらず、帯は取り下げを出さず［止める］だけ → 止めると実行は止まり、後から届く結果は使わない", async ({
  page,
}) => {
  const r = await ready(page, "取り下げ6");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  await approveOnBand(page);
  const exec = await takeExecute(r);
  const [a] = await approvalRows(r.t);
  const late = await asPerson(page, r.me.token, "POST", `/approvals/${a!.id}/withdraw`, {});
  expect([late.status, late.code], "PC が受け取った後の取り下げは 409・E-APR-010").toEqual([409, "E-APR-010"]);
  expect(
    (await approvalRows(r.t)).map((x) => [x.decision, x.withdrawn]),
    "承認は変わらない",
  ).toEqual([["approve", false]]);
  expect((await runsOf(r.t)).at(-1)).toMatchObject({ phase: "execute", status_id: "running", job_state: "running" });
  await openTicket(page, r);
  await expect(execBand(page).getByText(MSG.running, { exact: true }), "帯は実行中").toBeVisible();
  await expect(
    execBand(page).getByRole("button", { name: "承認を取り下げる", exact: true }),
    "実行が始まったら取り下げは出さない",
  ).toHaveCount(0);
  // 止めるには［止める］（K-731）：実行は止まり、段は作業中・印は下りる。承認の行は承認のまま、新しい承認待ちは作らない
  const res = await pressAndConfirm(
    page,
    () => execBand(page).getByRole("button", { name: "止める", exact: true }).click(),
    MSG.stopRunTitle,
    "止める",
    "POST",
    STOP_RUN_RE,
  );
  expect(res.status(), "止める口が受ける").toBe(201);
  expect(await dataOf(res)).toMatchObject({ phase: "execute", status: "stopped" });
  expect((await runsOf(r.t)).at(-1)).toMatchObject({ phase: "execute", status_id: "stopped" });
  expect((await ticketState(r.t)).stage).toBe("doing");
  expect(await delegatedMark(r.t)).toBe(false);
  expect(
    (await approvalRows(r.t)).map((x) => [x.decision, x.withdrawn]),
    "新しい承認待ちは作らない",
  ).toEqual([["approve", false]]);
  expect(
    (await r.w.finish(exec.job_id, { state: "done", result: AI.sent, agent_session_id: r.session })).status,
    "止めた後に届いた結果は受けるだけ",
  ).toBe(201);
  expect(await hasLine(r.t, MSG.ignored), "使わなかったと残る").toBe(true);
  expect(await hasLine(r.t, "が実行しました"), "「実行しました」の行は出ない").toBe(false);
  expect((await ticketState(r.t)).stage, "完了にも承認待ちにもならない").toBe("doing");
});

test("K771-M2-07 取り下げのお知らせは今の担当者だけ（F5 → F7・D-153.7）：担当者が替わった後に前の承認者が取り下げると、新しい承認待ちの承認する人も、お知らせの宛先も今の担当者になり、取り下げた本人には出ない", async ({
  page,
}) => {
  const r = await ready(page, "取り下げ7");
  const mate = await teammate(r.me, "中間M2 新しい担当");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  await approveOnBand(page);
  await admin("update tickets set assignee_member_id = $2 where id = $1", [r.t, mate.memberId]);
  const res = await asPerson(page, r.me.token, "POST", `/approvals/${(await approvalRows(r.t))[0]!.id}/withdraw`, {});
  expect(res.status, "承認した本人は、担当が替わった後でも取り下げられる").toBe(201);
  const rows = await approvalRows(r.t);
  expect(rows.map((a) => [a.decision, a.withdrawn])).toEqual([
    ["approve", true],
    [null, false],
  ]);
  expect(rows[1]!.approver_member_id, "新しい承認待ちの承認する人は今の担当者").toBe(mate.memberId);
  const withdrawn = (await noticesOf(r.t)).filter((n) => n.event_kind_id === "approval.withdrawn");
  expect(
    withdrawn.map((n) => n.member_id),
    "お知らせは今の担当者に 1 件だけ（取り下げた本人には出ない）",
  ).toEqual([mate.memberId]);
  expect(await hasLine(r.t, `${r.me.name}が承認を取り下げました（承認待ちに戻りました）`), "やり取りには残る").toBe(
    true,
  );
  expect(await r.w.take(), "実行の仕事は渡らない").toBeNull();
});

test("K771-M2-08 試し打ち：承認待ちの成果物で［試し打ち（自分宛）］ → PC が試し打ちの仕事を取り、本人のメールアドレスを宛先にした指示で終える → 承認待ち・段・印・成果物は動かず、そのまま承認して実行できる（試し打ちは任意）", async ({
  page,
}) => {
  const r = await ready(page, "試し打ち8");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  const markBefore = await delegatedMark(r.t);
  const res = await pressAndConfirm(
    page,
    () => page.getByRole("button", { name: "試し打ち（自分宛）", exact: true }).click(),
    MSG.dryTitle,
    "試し打ちする",
    "POST",
    DRY_RE,
  );
  expect(res.status(), "試し打ちの口が受ける").toBe(201);
  expect(Object.keys(await dataOf(res)).sort(), "答えは実行・仕事・状態・PC").toEqual([
    "job_id",
    "pc",
    "run_id",
    "status",
  ]);
  await expect(execBand(page).getByText(MSG.dryRunning, { exact: true }), "試し打ち中の帯").toBeVisible();
  await expect(approveBtn(page), "承認の帯はそのまま").toBeVisible();
  const dry = await takeSoon(r, "試し打ちの仕事が任せた人の PC に届く");
  expect(dry).toMatchObject({ kind: "ticket", ticket_id: r.t, phase: "dry_run" });
  expect(dry.prompt, "宛先は押した人のメールアドレスに差し替える指示").toContain(r.me.email);
  expect(await r.w.finish(dry.job_id, { state: "done", result: AI.sent, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "done",
  });
  await expect(
    execBand(page).getByText(MSG.dryDone, { exact: true }),
    "画面が試し打ちの結末に自分で気づく",
  ).toBeVisible();
  await expect(
    execBand(page).getByRole("button", { name: "もう一度試し打ち", exact: true }),
    "何回でも試せる",
  ).toBeVisible();
  expect((await runsOf(r.t)).map((x) => [x.phase, x.status_id, x.job_state])).toEqual([
    ["make", "done", "done"],
    ["dry_run", "done", "done"],
  ]);
  expect(
    (await approvalRows(r.t)).map((a) => [a.decision, a.status_id]),
    "承認待ちは 1 つのまま",
  ).toEqual([[null, "pending"]]);
  expect((await ticketState(r.t)).stage, "段は承認待ちのまま").toBe("awaiting_approval");
  expect(await delegatedMark(r.t), "印は動かない").toBe(markBefore);
  expect(
    (await artifactsOf(r.t)).map((v) => v.text),
    "成果物の版は増えない",
  ).toEqual([AI.made]);
  expect(await hasLine(r.t, /が試し打ちをあなた宛てに送りました/), "やり取りに届いた 1 行").toBe(true);
  // 試し打ちは任意：しなくても承認でき、承認すれば実行の仕事が届く（試し打ちの結果は承認の前の必須の手順ではない）
  await approveOnBand(page);
  const exec = await takeExecute(r);
  expect(exec.job_id, "実行の仕事は試し打ちの仕事とは別").not.toBe(dry.job_id);
});

test("K771-M2-09 試し打ちが止まる（2 通り）：PC が決めた見出しで返す／動いている試し打ちを［止める］の口で止める → どちらも承認待ち・段・印は動かず、もう一度試せる", async ({
  page,
}) => {
  const r = await ready(page, "試し打ち9");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  const markBefore = await delegatedMark(r.t);
  // ① 宛先を差し替えられない操作があって、決めた見出しで止まりを返す
  const start = await asPerson(page, r.me.token, "POST", `/tickets/${r.t}/dry-run`, {});
  expect(start.status, "試し打ちの口が受ける").toBe(201);
  const first = await takeSoon(r, "試し打ちの仕事が PC に届く");
  expect(first.phase).toBe("dry_run");
  expect(
    (
      await r.w.finish(first.job_id, {
        state: "done",
        result: `${MSG.dryHead}応募フォームへの入力は宛先を差し替えられません`,
        agent_session_id: r.session,
      })
    ).status,
  ).toBe(201);
  const stoppedRun = (await runsOf(r.t)).at(-1)!;
  expect([stoppedRun.phase, stoppedRun.status_id]).toEqual(["dry_run", "stopped"]);
  expect(stoppedRun.why, "止まった理由は見出しの後の字").toContain("応募フォームへの入力は宛先を差し替えられません");
  await openTicket(page, r);
  await expect(execBand(page).getByText(MSG.dryStopped, { exact: true }), "止まった帯").toBeVisible();
  expect(
    (await approvalRows(r.t)).map((a) => a.decision),
    "承認待ちは動かない",
  ).toEqual([null]);
  // ② もう一度試す（画面）→ 動いている間に止める口で止める
  const again = await pressAndConfirm(
    page,
    () => execBand(page).getByRole("button", { name: "もう一度試し打ち", exact: true }).click(),
    MSG.dryTitle,
    "試し打ちする",
    "POST",
    DRY_RE,
  );
  expect(again.status(), "もう一度試せる").toBe(201);
  const second = await takeSoon(r, "2 回目の試し打ちが PC に届く");
  expect(second.phase).toBe("dry_run");
  const runId = (await runsOf(r.t)).at(-1)!.id;
  const stop = await asPerson(page, r.me.token, "POST", `/action_runs/${runId}/stop`, {});
  expect(stop.status, "止める口が試し打ちにも効く").toBe(201);
  expect(stop.data).toMatchObject({ phase: "dry_run", status: "stopped" });
  expect((await runsOf(r.t)).at(-1)).toMatchObject({ phase: "dry_run", status_id: "stopped", job_state: "running" });
  expect((await ticketState(r.t)).stage, "試し打ちを止めても承認待ちのまま").toBe("awaiting_approval");
  expect(await delegatedMark(r.t), "印も動かない").toBe(markBefore);
  expect((await approvalRows(r.t)).map((a) => [a.decision, a.status_id])).toEqual([[null, "pending"]]);
  expect(await controlOf(r.pc, second.job_id), "PC には止める合図が届く").toEqual({ status: 200, stop: true });
  expect(
    (await r.w.finish(second.job_id, { state: "done", result: AI.sent, agent_session_id: r.session })).status,
    "止めた後に届いた結果は受けるだけ",
  ).toBe(201);
  expect(
    (await approvalRows(r.t)).map((a) => a.decision),
    "承認待ちは 1 つのまま",
  ).toEqual([null]);
  await openTicket(page, r);
  await expect(approveBtn(page), "承認の帯は出たまま").toBeVisible();
});

test("K771-M2-10 承認が決まると待っている試し打ちが止まる：PC が取る前の試し打ちは、承認すると止まり、PC に渡るのは承認の後の実行だけ", async ({
  page,
}) => {
  const r = await ready(page, "試し打ち10");
  const job = await delegateAndTake(page, r);
  await makeToApproval(page, r, job);
  const start = await asPerson(page, r.me.token, "POST", `/tickets/${r.t}/dry-run`, {});
  expect(start.status, "試し打ちの口が受ける").toBe(201);
  expect((await runsOf(r.t)).at(-1)).toMatchObject({ phase: "dry_run", status_id: "queued", job_state: "queued" }); // PC はまだ取りに来ない
  await approveOnBand(page);
  const waited = (await runsOf(r.t)).find((x) => x.phase === "dry_run")!;
  expect([waited.status_id, waited.job_state], "待っていた試し打ちは止まる").toEqual(["stopped", "stopped"]);
  expect(waited.why, "止めた理由の文").toBe(MSG.dryWaitingStopped);
  const exec = await takeExecute(r);
  expect(exec.phase, "PC に渡るのは承認の後の実行").toBe("execute");
  expect(await r.w.take(), "止まった試し打ちは渡らない").toBeNull();
  expect(
    (await runsOf(r.t)).map((x) => [x.phase, x.status_id]),
    "実行の記録：作る段・止めた試し打ち・実行",
  ).toEqual([
    ["make", "done"],
    ["dry_run", "stopped"],
    ["execute", "running"],
  ]);
});
