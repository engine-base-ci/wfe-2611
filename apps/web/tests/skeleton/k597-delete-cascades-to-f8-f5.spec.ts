// K-597 流れをまたぐテスト（段 8・X1）：消す（F7・K-488・K-590）→ 待っている渡しが自動で取り消される（F8・段 9 の K-406 の引き金）・承認待ちが取り下げられ数が減る（F5）・走っている AI の実行が止まる。
//   F7 が後から作るので F7 が持つ（範囲.md 6 章）。中の 1 本 1 本（取り下げの件数・止めの理由・引き金の中身）は単体（K-488・K-406 の試験）が持つ。ここはつないだときだけ出るもの。
//   口は網の手前で差し替えない（届く頭 x-forwarded-for だけを足す）。PC は K-58 の試験の PC（_lib/test-pc.ts）に、契約の口で仕事を運ばせる（_lib/f5-flow.ts の workOf）。
//   この PC の中だけの口（38617）は開かない（本人の Bridge に触らない）。AI は決まった答え。道具は K-460 が運ぶ _lib/f7-flow.ts を読むだけ。
//   消すは画面（K-590）で押す。渡しを作るのは契約の口（K-402）で、この試験は渡す画面を通らない（渡す画面は K-411 の試験が持つ）。
//   固定の待ちは置かない。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { AI, approvalsOf, delegatedMark, runsOf, ticketState, workOf, type Job, type PcWork } from "../_lib/f5-flow";
import {
  approvalsBadge,
  bellCount,
  deleteOnScreen,
  dropPcNotice,
  handoversOf,
  mateOf,
  noticeBox,
  notesOf,
  openBell,
  openTicket,
  ticketFacts,
  ticketRow,
  type Mate,
} from "../_lib/f7-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { asPerson, pairedPc, pressDelegate, ticketOf } from "../_lib/prep";
import type { TestPc } from "../_lib/test-pc";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 97);
});
const pcs: TestPc[] = [];
const mates: Mate[] = [];
test.afterEach(async () => {
  await Promise.all(pcs.splice(0).map((p) => p.close()));
  await Promise.all(mates.splice(0).map((m) => m.ctx.close()));
});

/** 文言（K-590・K-63・K-488 の仕様の表から。実装から書かない） */
const MSG = {
  empty: "いま決めるものはありません", // K-63 の承認待ちの画面・空
  stoppedWhy: "チケットが消されたので止めました", // K488-API-018（止めた理由）
  waitingMe: "あなたの承認を待っています",
};
const SECTIONS = {
  purpose: "先方に出す見積のたたき台を作る",
  done: "先方が受け取った",
  todo: "- 見積を作る\n- 先方に送る",
} as const;
interface Ready {
  me: Newcomer;
  pc: TestPc;
  w: PcWork;
  t: string;
  title: string;
  session: string;
}
/** 登録した人・つないだ PC・チケット 1 枚。PC をつなぐと本線の app.bridge_code_claim（0089）が bridge.connected のお知らせ（未読・鈴にも数にも出る）を
 *  書くので、準備で消して始めの受け箱を空にする（鈴の数は試験が起こしたお知らせだけで数える・K-591 と同じ） */
async function ready(page: Page, tag: string): Promise<Ready> {
  const me = await newcomer(page, box, tag);
  const pc = await pairedPc(page, me.token, `中間 X1 の MacBook (${tag})`);
  pcs.push(pc);
  await dropPcNotice(me.memberId);
  const title = `見積を送る 段8X1 ${tag}`;
  const t = await ticketOf(page, me, title, SECTIONS);
  return { me, pc, w: workOf(pc), t, title, session: randomUUID() };
}
async function takeSoon(r: Ready, what: string): Promise<Job> {
  let job: Job | null = null;
  await expect.poll(async () => (job ??= await r.w.take()), what).not.toBeNull();
  return job!;
}
const delegate = async (page: Page, r: Ready): Promise<void> => {
  await openTicket(page, r.t, r.title);
  await pressDelegate(page);
  await expect(page.getByRole("region", { name: "AI に任せる" })).toContainText("に任せました");
};

test("K597-X1-01 渡し中に消す：待っている渡しが自動で取り消され（F8）、相手は担当者のまま替わらず、相手の鈴には「取り消されました」が番号だけで出る（題名・チケットの id は出ない・押しても移らない）", async ({
  page,
  browser,
}) => {
  // この筋は PC を使わない（渡しと消すだけ）。登録だけで始める
  const me = await newcomer(page, box, "渡し");
  const title = "見積を送る 段8X1 渡し";
  const t = await ticketOf(page, me, title, SECTIONS);
  const mate = await mateOf(browser, me, "渡される人");
  mates.push(mate);
  const { number } = await ticketFacts(t);
  const made = await asPerson(page, me.token, "POST", `/tickets/${t}/handovers`, {
    kind: "pass",
    to_member_id: mate.memberId,
    reason: "来週から担当してほしい",
  });
  expect(made.status, "渡す口が受ける（K-402）").toBe(201);
  expect(
    (await handoversOf(t)).map((h) => h.state),
    "消す前は待っている",
  ).toEqual(["waiting"]);
  expect(await deleteOnScreen(page, t, title), "消す口が受ける").toBe(200);
  const after = await handoversOf(t);
  expect(after, "渡しの行は 1 つのまま").toHaveLength(1);
  expect(after[0]).toMatchObject({ state: "withdrawn", to_member_id: mate.memberId });
  expect(after[0]!.decided_at, "取り消した時刻が入る").not.toBeNull();
  expect((await ticketRow(t)).assignee_member_id, "担当者は渡した人のまま（渡しは成り立っていない）").toBe(me.memberId);
  expect(
    (await notesOf(mate.memberId)).filter((n) => n.kind === "handover.withdrawn"),
    "相手の受け箱に取り消しの行が 1 つある（K-406）",
  ).toHaveLength(1);
  // 読む側（K-461・D-148.5）：取り消し系は、チケットを消した後でも出す。本文は番号だけ・題名とチケットの id は出さず・行き先も無い
  const listed = await asPerson(mate.page, mate.token, "GET", "/notifications");
  expect(listed.status).toBe(200);
  const rows =
    (listed.data as unknown as
      | {
          kind: string;
          number: string | null;
          ticket_id: string | null;
          title: string | null;
          href: string | null;
          read: boolean;
        }[]
      | null) ?? [];
  const withdrawn = rows.filter((n) => n.kind === "handover.withdrawn");
  expect(withdrawn, "相手の鈴の口に取り消しの行が 1 つ（消したチケットでも出る）").toHaveLength(1);
  expect(withdrawn[0], "番号だけ。題名・チケットの id・行き先は無い").toMatchObject({
    number,
    ticket_id: null,
    title: null,
    href: null,
    read: false,
  });
  expect(JSON.stringify(listed.data), "答えのどこにも消したチケットの題名が無い").not.toContain(title);
  // 外枠の数は未読の行の数と同じ（相手の始めの受け箱の中身には頼らない）
  const unreadRows = await asPerson(mate.page, mate.token, "GET", "/notifications?unread=true");
  const unread = ((unreadRows.data as unknown as unknown[] | null) ?? []).length;
  const shell = await asPerson(mate.page, mate.token, "GET", "/shell");
  const shellCount = (shell.data as { notifications_unread?: number } | null)?.notifications_unread;
  expect(unread, "未読の行に取り消しの行が入っている").toBeGreaterThanOrEqual(1);
  expect(shellCount, "外枠の数は未読の行の数と同じ（取り消しのお知らせを数える）").toBe(unread);
  // 画面（K-467）：相手の鈴を開く → 番号だけの行・題名はどこにも出ない・チケットへ移るリンクは無い
  await mate.page.goto("/tickets");
  expect(await bellCount(mate.page), "鈴の数は口の数と同じ").toBe(unread);
  const panel = await openBell(mate.page);
  await expect(panel, "取り消しの行に番号が出る").toContainText(number);
  await expect(
    panel.getByRole("link").filter({ hasText: number }),
    "チケットへ移るリンクは無い（行き先が無い）",
  ).toHaveCount(0);
  await expect(mate.page.getByText(title), "消したチケットの題名が画面のどこにも出ない").toHaveCount(0);
  await expect(noticeBox(mate.page)).toBeVisible();
});

test("K597-X1-02 承認待ちがある物を消す：承認が取り下げられ、承認待ちの画面は空になり、左の数が 0 に減る（F5）。承認待ちになったお知らせも鈴に出ない", async ({
  page,
}) => {
  const r = await ready(page, "承認");
  await delegate(page, r);
  const job = await takeSoon(r, "任せた仕事が PC に届く");
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
  await expect(page.getByRole("region", { name: "承認と実行" })).toContainText(MSG.waitingMe);
  await page.goto("/approvals");
  await expect(page.getByRole("row").filter({ hasText: r.title }), "消す前は承認待ちに 1 行").toHaveCount(1);
  await expect.poll(() => approvalsBadge(page), "左の数は 1（外枠の答えが届いてから読む）").toBe(1);
  expect(await bellCount(page), "承認待ちのお知らせで鈴の数は 1").toBe(1);
  expect(await deleteOnScreen(page, r.t, r.title)).toBe(200);
  const rows = await approvalsOf(r.t);
  expect(rows, "承認の行は 1 つ").toHaveLength(1);
  expect(rows[0]!.status_id, "取り下げ").toBe("withdrawn");
  await page.goto("/approvals");
  await expect(page.getByText(MSG.empty), "承認待ちの画面は空").toBeVisible();
  await expect.poll(() => approvalsBadge(page), "左の数は 0（外枠の答えが届いてから読む）").toBe(0);
  expect(await bellCount(page), "消したチケットの承認待ちのお知らせは数えない").toBe(0);
});

test("K597-X1-03 走っている AI を消す：PC が取った仕事と実行が止まり、PC が後から結果を返しても受けず、段は作業中に戻り「AI に任せている」印が下りる（F5）", async ({
  page,
}) => {
  const r = await ready(page, "走行");
  await delegate(page, r);
  const job = await takeSoon(r, "任せた仕事が PC に届く（走っている）");
  expect((await runsOf(r.t))[0], "消す前は走っている").toMatchObject({ job_state: "running" });
  expect(await deleteOnScreen(page, r.t, r.title)).toBe(200);
  // 消す印を先に立ててから止めるので、K-464 の「止まったら担当者にお知らせ」の引き金は消えたチケットでは書かない（受け箱の行で数える）
  expect(
    (await notesOf(r.me.memberId)).filter((n) => n.kind === "ticket.stopped"),
    "消したのに「止まりました」のお知らせが担当者に出ない",
  ).toHaveLength(0);
  const runs = await runsOf(r.t);
  expect(runs[0], "仕事と実行が止まった").toMatchObject({ job_state: "stopped", status_id: "stopped" });
  expect(runs[0]!.why, "止めた理由").toBe(MSG.stoppedWhy);
  expect(await delegatedMark(r.t), "「AI に任せている」印が下りる").toBe(false);
  expect((await ticketState(r.t)).stage, "段は作業中").toBe("doing");
  const late = await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: r.session });
  expect(late.status, "止めた後に PC が結果を返しても受けない").toBe(404);
  expect((await runsOf(r.t))[0], "実行は止まったまま").toMatchObject({ status_id: "stopped" });
  expect(await approvalsOf(r.t), "承認待ちは作られない").toHaveLength(0);
});

test("K597-X1-04 まだ PC に取られていない仕事を消す：仕事は止まり、PC が取りに来ても何も取れない", async ({ page }) => {
  const r = await ready(page, "待機");
  await delegate(page, r);
  expect((await runsOf(r.t))[0], "消す前は待っている").toMatchObject({ job_state: "queued" });
  expect(await deleteOnScreen(page, r.t, r.title)).toBe(200);
  expect((await runsOf(r.t))[0]).toMatchObject({ job_state: "stopped" });
  expect(await r.w.take(), "取りに来ても仕事は無い").toBeNull();
});

test("K597-X1-05 戻しても止めたものは戻らない：消して戻すと、承認の取り下げ・実行の停止はそのままで、チケットは作業中に戻っていて、もう一度 AI に任せられる", async ({
  page,
}) => {
  const r = await ready(page, "戻す");
  await delegate(page, r);
  const job = await takeSoon(r, "任せた仕事が PC に届く");
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: r.session })).toMatchObject({
    status: 201,
  });
  await expect(page.getByRole("region", { name: "承認と実行" })).toContainText(MSG.waitingMe);
  expect(await deleteOnScreen(page, r.t, r.title)).toBe(200);
  const back = await asPerson(page, r.me.token, "POST", `/tickets/${r.t}/restore`, {});
  expect(back.status, "戻す口が受ける").toBe(201);
  expect((await approvalsOf(r.t))[0]!.status_id, "承認は取り下げのまま").toBe("withdrawn");
  expect(await delegatedMark(r.t), "印は下りたまま").toBe(false);
  await openTicket(page, r.t, r.title);
  await expect(page.getByRole("button", { name: "AI に任せる", exact: true }), "もう一度任せられる").toBeVisible();
  const again = await asPerson(page, r.me.token, "POST", `/tickets/${r.t}/delegate`, {});
  expect(again.status, "任せる口が受ける（段が作業中に戻してあるので）").toBe(201);
});
