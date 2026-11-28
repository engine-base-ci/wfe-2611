// K-591 中間テスト（段 8・M1）：AI の結果が承認待ちになる（K-463 の引き金）→ 鈴に出る（K-461・K-465・K-467）→ 押す → チケットの詳細 → 既読（K-462）を、
//   本物のブラウザ・本物の DB・本物の口と、試験の PC でつなぐ。流れをまたぐ F5 → F7 の 1 行（承認待ちになったら鈴に出る）と、E6（運営のお知らせ）の読む側の 1 行を含む。
//   中の 1 本 1 本の分岐は単体（K-461〜K-465 の口の試験・K-467 の画面の試験）が持つ。ここは「つないだときにだけ出るもの」を見る。
//   口は網の手前で差し替えない（page.route で答えを作らない。届く頭 x-forwarded-for だけを足す）。AI は決まった答え（_lib/f5-flow.ts の AI）。
//   PC は K-58 の試験の PC（_lib/test-pc.ts）に、契約の口で仕事を運ばせる（_lib/f5-flow.ts の workOf）。この PC の中だけの口（38617）は開かない（本人の Bridge に触らない）。
//   運営のお知らせ（F12・種類が未実装）は、行き先の無い種類の行（invitation_resend_requested）と、知らない種類の行を DB に直に置いて代わりにする（E6 の読む側だけ）。
//   固定の待ちは置かない（口の答え・画面の要素・DB の値が変わるのを待つ）。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { AI, approvalsOf, workOf, type Job, type PcWork } from "../_lib/f5-flow";
import {
  NOTICE_RE,
  READ_ALL_RE,
  answered,
  approvalsBadge,
  bell,
  bellCount,
  dropPcNotice,
  noteRow,
  noticeBox,
  noticeRow,
  notesOf,
  openBell,
  openTicket,
  ticketFacts,
} from "../_lib/f7-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { asPerson, pairedPc, pressDelegate, teammate, ticketOf } from "../_lib/prep";
import type { TestPc } from "../_lib/test-pc";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 91);
});
/** 立てた試験の PC は筋の終わりに必ず閉じる（自分で立てた分だけ・G-10） */
const pcs: TestPc[] = [];
test.afterEach(async () => {
  await Promise.all(pcs.splice(0).map((p) => p.close()));
});

/** 文言（K-461 の種類の表・K-467 の文の表と仕様の行・K-62・K-63 から。実装から書かない） */
const MSG = {
  approvalText: (n: string) => `${n} の確認が終わり、あなたの承認を待っています`,
  tagApproval: "承認待ち",
  waitingMe: "あなたの承認を待っています",
  boxTitle: "お知らせ",
  emptyBox: "お知らせはまだありません",
  generic: "設定のお知らせがあります",
} as const;
const SECTIONS = {
  purpose: "先方に出す見積のたたき台を作る",
  done: "先方が受け取った",
  todo: "- 見積を作る\n- 先方に送る",
} as const;

/** 登録した人・チケット 1 枚（PC を使わない筋 M1-04・05 はこれだけ。CI の台が登録 1 回ぶん軽い） */
interface Signed {
  me: Newcomer;
  t: string;
  title: string;
  session: string;
}
async function ticketReady(page: Page, me: Newcomer, tag: string): Promise<Signed> {
  const title = `見積を送る 段8M1 ${tag}`;
  const t = await ticketOf(page, me, title, SECTIONS);
  return { me, t, title, session: randomUUID() };
}
async function signedUp(page: Page, tag: string): Promise<Signed> {
  return ticketReady(page, await newcomer(page, box, tag), tag);
}
interface Ready extends Signed {
  pc: TestPc;
  w: PcWork;
}
/** 登録した人・つないだ PC・チケット 1 枚（K-64 の m3 と同じ形）。PC をつなぐと本線の app.bridge_code_claim（0089）が bridge.connected のお知らせ
 *  （未読・設定の札・鈴にも数にも出る）を書くので、準備で消して、始めの受け箱を空にする（鈴の数・行の数は試験が起こしたお知らせだけで数える） */
async function ready(page: Page, tag: string): Promise<Ready> {
  const me = await newcomer(page, box, tag);
  const pc = await pairedPc(page, me.token, `中間 M1 の MacBook (${tag})`);
  pcs.push(pc);
  await dropPcNotice(me.memberId);
  expect(await notesOf(me.memberId), "始めの受け箱は空（PC をつないだお知らせは消してある）").toHaveLength(0);
  return { ...(await ticketReady(page, me, tag)), pc, w: workOf(pc) };
}
const aiBand = (page: Page) => page.getByRole("region", { name: "AI に任せる" });
const execBand = (page: Page) => page.getByRole("region", { name: "承認と実行" });
async function takeSoon(r: Ready, what: string): Promise<Job> {
  let job: Job | null = null;
  await expect.poll(async () => (job ??= await r.w.take()), what).not.toBeNull();
  return job!;
}
/** 画面で任せる → PC が作る段を取る → 中身のある結果で終える（承認待ちになる）。開いたままの詳細が承認待ちの帯に替わる */
async function delegateToApproval(page: Page, r: Ready, text: string = AI.made): Promise<void> {
  await openTicket(page, r.t, r.title);
  await pressDelegate(page);
  await expect(aiBand(page)).toContainText("に任せました");
  const job = await takeSoon(r, "任せた仕事は任せた人の PC に渡る");
  expect(await r.w.finish(job.job_id, { state: "done", result: text, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
  await expect(execBand(page), "開いたままの画面が自分で承認待ちに替わる").toContainText(MSG.waitingMe);
}

test("K591-M1-01 承認待ちになる → 鈴に出る → 押す → 詳細 → 既読：承認待ちになった直後に鈴の数が 1 になり、押すとそのチケットの詳細へ移って既読になる（F5 → F7）", async ({
  page,
}) => {
  const r = await ready(page, "正常");
  const { number } = await ticketFacts(r.t);
  expect(
    (await notesOf(r.me.memberId)).filter((n) => n.kind === "approval.requested"),
    "承認待ちになる前はお知らせが無い（始めの受け箱は空）",
  ).toHaveLength(0);
  await delegateToApproval(page, r);
  // 書く側（K-463）：承認する人（担当者の本人）に受け箱の行が 1 つ・未読
  const notes = (await notesOf(r.me.memberId)).filter((n) => n.kind === "approval.requested");
  expect(notes, "承認待ちになったお知らせが 1 行").toHaveLength(1);
  expect(notes[0]).toMatchObject({ ticket_id: r.t, read_at: null });
  // 読む側（K-465・K-461）：開き直した画面の鈴の数と、箱の行
  await page.goto("/tickets");
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ（1 件）");
  expect(await bellCount(page), "外枠の数は受け箱の未読と同じ").toBe(1);
  const panel = await openBell(page);
  await expect(panel.getByRole("heading", { name: MSG.boxTitle })).toBeVisible();
  const row = noticeRow(page, MSG.approvalText(number));
  await expect(row, "承認待ちの行（文と札）").toHaveCount(1);
  await expect(row).toContainText(MSG.tagApproval);
  await expect(row).toContainText("未読");
  // 押す → 詳細へ移り、既読の口が 1 回通る
  const read = answered(page, "PATCH", NOTICE_RE);
  await row.click();
  expect((await read).status(), "既読の口が受ける").toBe(200);
  await expect.poll(() => new URL(page.url()).pathname, "押した行のチケットの詳細へ移る").toBe(`/tickets/${r.t}`);
  await expect(page.getByRole("heading", { level: 1, name: r.title })).toBeVisible();
  await expect(execBand(page), "移った先で承認の帯が出ている").toContainText(MSG.waitingMe);
  // 反映：別の GET（開き直し）で数が減り、DB の行が読んだ印を持つ
  await page.reload();
  await expect(bell(page), "数の印が無くなる").toHaveAttribute("aria-label", "お知らせ");
  expect(
    (await notesOf(r.me.memberId)).filter((n) => n.kind === "approval.requested")[0]!.read_at,
    "DB に読んだ時刻",
  ).not.toBeNull();
  await openBell(page);
  await expect(noticeRow(page, MSG.approvalText(number)), "読んだ行は一覧に残る").toHaveCount(1);
  await expect(noticeRow(page, MSG.approvalText(number))).not.toContainText("未読");
  expect(await approvalsBadge(page), "左の承認待ちの数は承認が決まるまで 1").toBe(1);
});

test("K591-M1-02 差し戻し → 作り直し → もう一度承認待ち：前のお知らせは読んだまま残り、新しい承認待ちのお知らせだけが未読で増える（行は 2 つ）", async ({
  page,
}) => {
  const r = await ready(page, "差し戻し");
  const { number } = await ticketFacts(r.t);
  await delegateToApproval(page, r);
  await page.goto("/tickets");
  await openBell(page);
  const first = answered(page, "PATCH", NOTICE_RE);
  await noticeRow(page, MSG.approvalText(number)).click();
  expect((await first).status()).toBe(200);
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/tickets/${r.t}`);
  // 差し戻す → 同じ PC が作り直す → 2 つ目の結果が承認待ちになる
  await execBand(page).getByRole("button", { name: "差し戻す", exact: true }).click();
  await page.getByRole("textbox", { name: "差し戻す理由" }).fill("宛名を直してください");
  const returned = page.waitForResponse(
    (x) => x.request().method() === "POST" && /\/approvals\/[^/]+\/return$/.test(new URL(x.url()).pathname),
  );
  await page.getByRole("dialog").getByRole("button", { name: "差し戻す", exact: true }).click();
  expect((await returned).status()).toBe(201);
  const again = await takeSoon(r, "作り直しの仕事が同じ PC に届く");
  expect(await r.w.finish(again.job_id, { state: "done", result: AI.remade, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
  await expect(execBand(page)).toContainText(AI.remade);
  expect(await approvalsOf(r.t), "承認の行は 2 つ").toHaveLength(2);
  const notes = (await notesOf(r.me.memberId)).filter((n) => n.kind === "approval.requested");
  expect(notes, "承認待ちのお知らせは承認の行ごとに 1 つ").toHaveLength(2);
  expect(
    notes.filter((n) => n.read_at === null),
    "未読は新しい 1 つだけ",
  ).toHaveLength(1);
  await page.goto("/tickets");
  expect(await bellCount(page), "鈴の数は新しい 1 つ分").toBe(1);
  await openBell(page);
  await expect(noticeRow(page, MSG.approvalText(number)), "箱には同じチケットの行が 2 つ").toHaveCount(2);
  await expect(noticeRow(page, "未読"), "未読の印があるのは 1 行").toHaveCount(1);
});

test("K591-M1-03 すべて既読にする：承認待ちのお知らせ 1 つとほかの種類 1 つを、1 回で既読にし、数と DB が揃って 0 になる", async ({
  page,
}) => {
  const r = await ready(page, "すべて既読");
  await delegateToApproval(page, r);
  await noteRow(r.me.memberId, "ticket.created", { ticket: r.t }); // 書き込みの札の行（読む側の文は汎用）
  await page.goto("/tickets");
  expect(await bellCount(page)).toBe(2);
  await openBell(page);
  const all = answered(page, "POST", READ_ALL_RE);
  await noticeBox(page).getByRole("button", { name: "すべて既読にする" }).click();
  expect((await all).status(), "全部既読の口が受ける（K462-API-008：200）").toBe(200);
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ");
  await expect(
    noticeBox(page).getByRole("button", { name: "すべて既読にする" }),
    "未読が 0 なら押せない",
  ).toBeDisabled();
  expect(
    (await notesOf(r.me.memberId)).filter((n) => n.read_at === null),
    "DB の未読は 0",
  ).toHaveLength(0);
  await page.reload();
  expect(await bellCount(page), "開き直しても 0").toBe(0);
});

test("K591-M1-04 ほかの人のお知らせは見えない：同じ会社の 2 人目宛てのお知らせ（チケットの題名入り）は、1 人目の鈴にも数にも出ない", async ({
  page,
}) => {
  const r = await signedUp(page, "他人");
  const mate = await teammate(r.me, "同僚の佐藤");
  const secretTitle = `同僚だけの題名 ${randomUUID().slice(0, 8)}`;
  const other = await ticketOf(page, r.me, secretTitle, SECTIONS);
  await noteRow(mate.memberId, "ticket.assigned", { ticket: other, by: r.me.memberId });
  await noteRow(r.me.memberId, "ticket.created", { ticket: r.t });
  await page.goto("/tickets");
  expect(await bellCount(page), "1 人目の数は自分宛ての 1 つだけ").toBe(1);
  await openBell(page);
  await expect(
    noticeBox(page)
      .getByRole("link")
      .or(noticeBox(page).getByRole("button"))
      .filter({ hasText: /書き込み|設定|承認/ }),
    "行は 1 つ",
  ).toHaveCount(1);
  // 題名のチケットは 1 人目が作った物で、一覧（/tickets）の行には出る。お知らせの箱に出ないことを見る
  await expect(noticeBox(page).getByText(secretTitle), "別の人のお知らせの題名が箱に出ない").toHaveCount(0);
  // 口を直に読んでも、答えに別の人の行が無い（2 層目：口と行の守り・D-151.3）
  const res = await asPerson(page, r.me.token, "GET", "/notifications");
  expect(res.status).toBe(200);
  expect(JSON.stringify(res.data), "答えに別の人のチケットの題名が無い").not.toContain(secretTitle);
});

test("K591-M1-05 運営のお知らせの読む側（E6）：行き先の無い行は押すと既読になるだけで画面は動かず、知らない種類の行は鈴にも数にも出ない", async ({
  page,
}) => {
  const r = await signedUp(page, "運営");
  const noDest = await noteRow(r.me.memberId, "invitation_resend_requested"); // 開く画面がまだ無い種類（運営のお知らせの代わり）
  await noteRow(r.me.memberId, "ops.announcement"); // 表に無い種類（F12 が足すまで読み飛ばす）
  await page.goto("/tickets");
  expect(await bellCount(page), "知らない種類は数えない（行き先の無い行 1 つだけ）").toBe(1);
  await openBell(page);
  const row = noticeRow(page, MSG.generic);
  await expect(row, "知らない種類は出さず、行き先の無い行だけ出る").toHaveCount(1);
  const before = new URL(page.url()).pathname;
  const read = answered(page, "PATCH", NOTICE_RE);
  await row.click();
  expect((await read).status(), "既読の口が受ける").toBe(200);
  expect(new URL(page.url()).pathname, "押しても画面は動かない").toBe(before);
  await expect(noticeBox(page), "箱は開いたまま").toBeVisible();
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ");
  const rows = await notesOf(r.me.memberId);
  expect(rows.find((n) => n.id === noDest)!.read_at, "行き先の無い行が既読").not.toBeNull();
  expect(rows.find((n) => n.kind === "ops.announcement")!.read_at, "知らない種類の行は触らない").toBeNull();
});

test("K591-M1-06 鈴の口で見る：承認待ちのお知らせは GET /notifications に札 approval・行き先 /tickets/<id>・題名つきの未読で出て、押して既読にすると未読だけの一覧から消える（F5 → F7。もとの K463-DB-011）", async ({
  page,
}) => {
  const r = await ready(page, "口で見る");
  const { number } = await ticketFacts(r.t);
  // 任せるのは口で（画面で任せる道は M1-01 が通る）。PC が作る段を中身のある結果で終えると承認待ちになる
  // 確認項目が 0 件のチケットは使わない理由を付けて任せる（K-573：理由が無いと口は 409）
  const delegated = await asPerson(page, r.me.token, "POST", `/tickets/${r.t}/delegate`, {
    no_spec_reason: "定型の作業（試験）",
  });
  expect(delegated.status, "任せる口が受ける").toBe(201);
  const job = await takeSoon(r, "任せた仕事は任せた人の PC に渡る");
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
  interface Item {
    id: string;
    kind: string;
    tag: string;
    href: string | null;
    ticket_id: string | null;
    title: string | null;
    read: boolean;
  }
  const unreadItems = async (): Promise<Item[]> =>
    ((await asPerson(page, r.me.token, "GET", "/notifications?unread=true")).data as unknown as Item[] | null) ?? [];
  const item = (await unreadItems()).find((x) => x.kind === "approval.requested");
  expect(item, "承認待ちのお知らせが未読の一覧に出る").toBeDefined();
  expect(item, "札・行き先・題名つきの未読で出る").toMatchObject({
    tag: "approval",
    href: `/tickets/${r.t}`,
    ticket_id: r.t,
    title: r.title,
    read: false,
  });
  // 押す（画面）→ 既読の口が通り、未読だけの一覧から消える
  await page.goto("/tickets");
  await openBell(page);
  const read = answered(page, "PATCH", NOTICE_RE);
  await noticeRow(page, MSG.approvalText(number)).click();
  expect((await read).status(), "既読の口が受ける").toBe(200);
  expect(
    (await unreadItems()).map((x) => x.id),
    "既読にすると未読だけの一覧から消える",
  ).not.toContain(item!.id);
});
