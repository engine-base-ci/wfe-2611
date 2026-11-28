// K-770 中間テスト（段 6・M1）：作る画面で AI と話して作る（K-774・K-775・K-777・K-767）→ 作る（段 5 の createTicket）→ 会話がチケットに移る（K-776・K-763）→
//   任せる → AI が確認項目にチェックを付けて終える（K-736）→ 承認待ちの確認の表「N ／ M 済み」（K-739・K-740）→ 自分で直す（K-742・K-743）→ 承認 → 実行 → 完了、を
//   本物のブラウザ・本物の DB・本物の口と、試験の PC でつなぐ。流れをまたぐ F4 → F5（作る画面の会話・K-442 の差し込み口）と F5 → F7（承認待ちのお知らせは担当者だけ）を含む。
//   中の 1 本 1 本の分岐は単体（K-736・K-739・K-742・K-774〜K-776 の口の試験と、K-740・K-743・K-767・K-777 の画面の試験）が持つ。ここは「つないだときにだけ出るもの」を見る。
//   口は網の手前で差し替えない（page.route で答えを作らない。届く頭 x-forwarded-for だけを足す）。AI は決まった答え（_lib/f5-flow.ts の AI と、この試験の中の案）。
//   PC は K-58 の試験の PC（_lib/test-pc.ts）に、契約の口で仕事を運ばせる（_lib/f5-flow.ts の workOf）。AI が使う道具（ticket_read・spec_check・draft_propose）は、取った仕事の
//   tool_token で POST /api/v1/bridge/jobs/:id/tools/:name を 1 回ずつ呼ぶ（この試験の中の pcPost・toolOf）。この PC の中だけの口（38617）は開かない（本人の Bridge に触らない）。
//   F9（段 10 の K-700 の守れていなかった数え）は、必ず守るから入った確認項目（ナレッジのページ）を作る準備が重いので入れない。受け持ちの葉の行：K736-API-003・K700-API-001。
//   画面の名前・字は /dev/mock/f5 の下絵（features/F5/{more,room}）から。画面の葉（K-740・K-743・K-767・K-777）の名前が絵と変わったら、この試験を同時に直す（仮の字は md に書いた）。
//   固定の待ちは置かない（口の答え・画面の要素・DB の値が変わるのを待つ）。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { API, admin } from "../_lib/api";
import {
  COMPLETE_RE,
  SPEC_ROW_RE,
  aiBand,
  answered,
  completeBtn,
  countRequests,
  delegateBtn,
  esc,
  execBand,
  fillAndCreate,
  jstDay,
  makeTicket,
  openCreateFromMenu,
  openTicket,
  panel,
  submitCreate,
  tagOf,
  typeDue,
} from "../_lib/f4-flow";
import {
  AI,
  approvalsOf,
  artifactsOf,
  runsOf,
  systemLines,
  ticketState,
  workOf,
  type Job,
  type PcWork,
} from "../_lib/f5-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { asPerson, pairedPc, teammate } from "../_lib/prep";
import type { TestPc } from "../_lib/test-pc";
import { approveDialog, confirmApprove } from "../k/approve-modal";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 150_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 96);
});
/** 立てた試験の PC は筋の終わりに必ず閉じる（自分で立てた分だけ・G-10） */
const pcs: TestPc[] = [];
test.afterEach(async () => {
  await Promise.all(pcs.splice(0).map((p) => p.close()));
});

/** 文言（K-736・K-739・K-742・K-774〜K-776 の md と、下絵 /dev/mock/f5 の字から。実装から書かない。仮の字は md の「仮」の一覧） */
const MSG = {
  waitingMe: "あなたの承認を待っています", // K-63 の帯
  completed: /完了しました/, // K-63 の帯・K-455 と同じ
  proposalOpen: "まだ欄には入っていません", // 下絵 ProposalCard の頭（mode open）
  proposalAll: "全部の欄に入りました",
  noteAdopted: (n: string) => `このチケットを作りました（${n}）`, // K-776・下絵 FROM_CREATE の 1 行
  pendingChecks: (n: number) => `チェックの無い確認項目が ${n} 件あります`, // K-740・下絵 ApproveConfirmMore
  noPc: "PC がまだつながっていません", // 下絵 PcNone・E-TALK-060 の文
  sum: (done: number, total: number) => `${done} ／ ${total} 済み`, // K-739・D-153.3
  editedBy: (name: string, v: number) => `成果物は ${name} が直しました（版 ${v}）`, // D-153.9・下絵 selfedit-saved
  reply: "11 月分のチケットを見て案を作りました。左の欄に入れる物を選んでください。",
} as const;
const SPEC = {
  a: "作業時間の合計が稼働記録と同じ",
  b: "宛名が山田様になっている",
  c: "送る前に PDF を目で見る",
} as const;
/** 目的をことばにした AI の案（画面は欄に入れるだけ。AI の出力は決まった答え） */
interface Proposal {
  title?: string;
  body?: string;
  checks?: string[];
}
const ASK = "セイコー様に 12 月分の作業報告書を年内に送りたい。形は 11 月と同じ";
const EDITED_ARTIFACT = "見積のたたき台（人が直した）：宛名を株式会社サンプルにしました（中間テスト 6）";

const DRAFT_SAY_RE = /^\/api\/v1\/ticket_draft_conversations\/[^/]+\/messages$/;
const ADOPT_RE = /^\/api\/v1\/ticket_draft_conversations\/[^/]+\/adopt$/;
const EDIT_RE = /^\/api\/v1\/approvals\/[^/]+\/edit$/;
const loose = (s: string): RegExp => new RegExp([...s].map(esc).join("⁠?")); // 見出しの折り目の印（U+2060）が間に入っても当たる

// ---------------------------------------------------------------- 試験の PC の道具（この試験の中だけ・新しい共通の道具は作らない）
type Body = Record<string, unknown>;
const bridgeUa = (): string => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  return (createRequire(join(root, "apps/bridge/src/main.ts"))("./pairing.ts") as { BRIDGE_UA: string }).BRIDGE_UA;
};
const PC_IP = `10.96.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
/** PC の印で /bridge/jobs の口を 1 回呼ぶ（Bridge の輪と同じ頭。f5-flow の workOf が持たない道具の口・会話の写しの口） */
async function pcPost(pc: TestPc, path: string, body: Body, extra: Record<string, string> = {}) {
  const token = pc.token();
  if (!token) throw new Error("まだつながっていない PC は口を呼ばない");
  const r = await fetch(`${API}/api/v1/bridge/jobs${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bridge-session": token,
      "user-agent": bridgeUa(),
      "x-forwarded-for": PC_IP,
      ...extra,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  const j = (text ? JSON.parse(text) : {}) as { data?: Body; code?: string };
  return { status: r.status, data: j.data ?? null, code: j.code ?? null };
}
/** その仕事の道具の鍵で道具を呼ぶ（K-62 の callKanameTool） */
const toolOf =
  (pc: TestPc, job: Job) =>
  (name: string, input: Body): ReturnType<typeof pcPost> =>
    pcPost(pc, `/${job.job_id}/tools/${name}`, { input }, { "x-kaname-tool-token": job.tool_token ?? "" });

interface Ready {
  me: Newcomer;
  pc: TestPc;
  w: PcWork;
  /** AI の続きの id（PC が作る段の終わりに返す。契約は uuid）。筋ごとに 1 つ */
  session: string;
}
/** 登録した人・つないだ PC（K-64 の m3 と同じ形。画面でつなぐ道は K-58 が持つ） */
async function ready(page: Page, tag: string): Promise<Ready> {
  const me = await newcomer(page, box, tag);
  const pc = await pairedPc(page, me.token, `中間 M1（段 6）の MacBook (${tag})`);
  pcs.push(pc);
  return { me, pc, w: workOf(pc), session: randomUUID() };
}
/** PC が仕事を取る。取る口は、ほかの読み書きが触っている最中の仕事を飛ばして空を返すことがある。時間では待たず、取れるまで問い合わせる */
async function takeSoon(r: Ready, what: string): Promise<Job> {
  let job: Job | null = null;
  await expect.poll(async () => (job ??= await r.w.take()), what).not.toBeNull();
  return job!;
}

// ---------------------------------------------------------------- DB
const specRows = (t: string) =>
  admin<{
    id: string;
    title: string;
    checked_at: Date | null;
    checked_by_member_id: string | null;
    checked_by_ai: boolean;
  }>(
    `select id, title, checked_at, checked_by_member_id, checked_by_ai from test_specs
      where ticket_id = $1 and deleted_at is null order by created_at, id`,
    [t],
  );
const convsOf = (memberId: string) =>
  admin<{ id: string; talk_kind: string; ticket_id: string | null }>(
    `select id, talk_kind, ticket_id from conversations where owner_member_id = $1 and talk_kind in ('draft', 'ticket') and deleted_at is null order by created_at, id`,
    [memberId],
  );
const numberOf = async (t: string): Promise<string> =>
  (await admin<{ n: string }>("select number as n from tickets where id = $1", [t]))[0]!.n;
const titleOf = async (t: string): Promise<string> =>
  (await admin<{ n: string }>("select title as n from tickets where id = $1", [t]))[0]!.n;
const noticesOf = (memberId: string, kind: string) =>
  admin<{ id: string; ticket_id: string | null }>(
    `select id, payload->>'ticket_id' as ticket_id from notifications
      where member_id = $1 and channel_id = 'inapp' and event_kind_id = $2 and deleted_at is null`,
    [memberId, kind],
  );

/** 会話の 1 行（K-757 の MessageView） */
interface Msg {
  who: "me" | "ai" | "stopped" | "note";
  text: string;
  passed: string[];
  proposal: Proposal | null;
}
/** 会話を口で読み直す（会話の id で。作る画面の会話・チケットの会話のどちらも同じ形） */
async function readConv(page: Page, me: Newcomer, convId: string) {
  const r = await asPerson(page, me.token, "GET", `/conversations/${convId}`);
  expect(r.status, "会話を読む口が受ける").toBe(200);
  return r.data as unknown as { conversation: { talk_kind: string; ticket_id: string | null }; messages: Msg[] };
}
/** チケットの右のパネルの会話を口で読み直す（K-763） */
async function ticketSession(page: Page, me: Newcomer, t: string) {
  const r = await asPerson(page, me.token, "GET", `/tickets/${t}/agent-session`);
  expect(r.status, "チケットの会話を読む口が受ける").toBe(200);
  return r.data as unknown as { conversation: { talk_kind: string; ticket_id: string | null } | null; messages: Msg[] };
}

// ---------------------------------------------------------------- 作る画面（下絵 create-talk-・K-767・K-777）
const chat = (page: Page): Locator => page.getByRole("region", { name: "AI との会話", exact: true });
const sayBox = (page: Page): Locator => chat(page).getByRole("textbox", { name: /AI に話す$/ });
const sendBtn = (page: Page): Locator => chat(page).getByRole("button", { name: "送る", exact: true });
const thread = (page: Page): Locator => chat(page).getByRole("list", { name: "会話", exact: true });
const cards = (page: Page): Locator => chat(page).getByRole("article", { name: "AI の案", exact: true });
const titleBox = (page: Page): Locator => page.getByRole("textbox", { name: /^題名/ });
const bodyBox = (page: Page): Locator => page.getByRole("textbox", { name: /^本文/ });
// 作る画面の確認項目の欄（create の group「確認項目の欄」・中の list「確認項目」）
const checksBlock = (page: Page): Locator => page.getByRole("group", { name: "確認項目の欄", exact: true });
const useAll = (card: Locator): Locator => card.getByRole("button", { name: "全部使う", exact: true });

/** 作る画面を開き、作り方の「AI と話して作る」を押して右に会話を開く（K-767-UI-001：会話は押してから開く・道に how=ai） */
async function openCreateWithAi(page: Page): Promise<void> {
  await openCreateFromMenu(page);
  const how = page.locator(".k-create-how").getByRole("button", { name: "AI と話して作る", exact: true });
  await expect(how, "「AI と話して作る」は押せない形ではない").not.toHaveAttribute("aria-disabled", "true");
  await how.click();
  await expect(page).toHaveURL(/[?&]how=ai/);
}
/** 作る画面で言う。画面が会話を始める口（初回だけ）と言う口を呼び、言う口が 201 を答えるまで待つ */
async function talkSay(page: Page, text: string): Promise<void> {
  await sayBox(page).fill(text);
  const sent = answered(page, "POST", DRAFT_SAY_RE);
  await sendBtn(page).click();
  expect((await sent).status(), "作る画面の会話に言う口が受ける").toBe(201);
  await expect(thread(page)).toContainText(text);
}
/** PC が作る画面の会話の仕事を取る */
async function takeChat(r: Ready): Promise<Job> {
  const job = await takeSoon(r, "言った言葉は自分の PC の会話の仕事になる");
  expect(job.kind, "作る画面の会話は会話の仕事（チケットの仕事ではない）").toBe("chat");
  return job;
}
/** AI が案の道具で案を出し、返事を会話に写し、仕事を終える */
async function answer(r: Ready, job: Job, proposal: Proposal, reply: string): Promise<void> {
  const made = await toolOf(r.pc, job)("draft_propose", proposal as Body);
  expect(made.status, "案の道具が受ける").toBe(201);
  const wrote = await pcPost(r.pc, `/${job.job_id}/conversation-entries`, {
    entries: [{ uuid: randomUUID(), text: reply }],
  });
  expect(wrote.status, "返事を会話に写す口が受ける").toBe(201);
  expect(await r.w.finish(job.job_id, { state: "done", result: reply, agent_session_id: r.session })).toMatchObject({
    status: 201,
  });
}
/** 担当者（本人）と期限を入れる。題名・本文・確認項目は AI の案で入っている */
async function assigneeAndDue(page: Page, me: Newcomer): Promise<void> {
  await page.getByRole("combobox", { name: "担当者", exact: true }).click();
  await page.getByRole("option", { name: me.name, exact: true }).click();
  await typeDue(page, jstDay(3));
}

// ---------------------------------------------------------------- 任せる → 承認待ち（口の道）
/** チケットを作り、口で任せ、PC が作る段を取って中身のある結果で終える（承認待ちになる）。check 件までの確認項目には PC が spec_check でチェックを付ける */
async function toApproval(
  page: Page,
  r: Ready,
  tag: string,
  o: { specs: string[]; check?: number },
): Promise<{ t: string; title: string; approval: string }> {
  const title = `見積を送る 段6M1 ${tagOf(tag)}`;
  const t = await makeTicket(page, r.me, title, { specs: o.specs });
  const d = await asPerson(page, r.me.token, "POST", `/tickets/${t}/delegate`, {});
  expect(d.status, "任せる口が受ける").toBeLessThan(300);
  const job = await takeSoon(r, "任せた仕事は任せた人の PC に渡る");
  expect(job).toMatchObject({ kind: "ticket", ticket_id: t, phase: "make" });
  if (o.check) {
    const tool = toolOf(r.pc, job);
    const read = await tool("ticket_read", {});
    const specs = (read.data?.["result"] as { specs: { id: string; text: string }[] }).specs;
    for (const s of specs.slice(0, o.check)) {
      expect((await tool("spec_check", { spec_id: s.id, checked: true, basis: `確かめた：${s.text}` })).status).toBe(
        201,
      );
    }
  }
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
  const [a] = await approvalsOf(t);
  return { t, title, approval: a!.id };
}
const approveBtn = (page: Page): Locator => execBand(page).getByRole("button", { name: "承認して送る", exact: true });

test("K770-M1-01 話して作る：作る画面で言う → PC の AI が案の道具で案を出す → ［全部使う］で欄に入る → 作る → 会話が作ったチケットの右のパネルに続く（F4 → F5・K-442 の差し込み口）", async ({
  page,
}) => {
  const r = await ready(page, "話して作る");
  const tag = tagOf("m1-01");
  const p1: Proposal = {
    title: `セイコー様へ 12 月分の作業報告書を送る ${tag}`,
    body: "11 月分と同じ形で、12 月分の作業報告書を作ります。できたら PDF にして山田様にメールで送ります。",
    checks: [SPEC.a, SPEC.b],
  };
  await openCreateWithAi(page);
  // F4 → F5：段 5 の作る面の「AI と話して作る」の差し込み口に会話が入り、PC の幅では右に出る（段 5 では押せない形だった）
  await expect(chat(page), "作る画面の右に AI との会話が出る").toBeVisible();
  await expect(
    // 作る面の頭の作り方の並び（create-head の .k-create-how・aria-label「作り方」・役は付けていない）
    page.locator('[aria-label="作り方"]').getByRole("button", { name: "AI と話して作る", exact: true }).first(),
    "「AI と話して作る」は押せない形ではなくなる",
  ).not.toHaveAttribute("aria-disabled", "true");
  await talkSay(page, ASK);
  const job = await takeChat(r);
  expect(job.prompt, "言った言葉が仕事の中身に入る").toContain(ASK);
  expect(job.prompt, "案は案の道具で出す指示が入る（K-774）").toContain("draft_propose");
  await answer(r, job, p1, MSG.reply);
  // 案のカード：まだ欄には入っていない → ［全部使う］で題名・本文・確認項目が欄に入る
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText(MSG.proposalOpen);
  await expect(titleBox(page), "使うまで欄は空").toHaveValue("");
  await useAll(cards(page)).click();
  await expect(cards(page)).toContainText(MSG.proposalAll);
  await expect(titleBox(page)).toHaveValue(p1.title!);
  await expect(bodyBox(page)).toContainText(p1.body!);
  await expect(checksBlock(page)).toContainText(SPEC.a);
  await expect(checksBlock(page)).toContainText(SPEC.b);
  await assigneeAndDue(page, r.me);
  // 作る（段 5 の createTicket は変えない）→ 作った後に画面が会話をチケットへ移す口を 1 回呼ぶ
  const adopted = answered(page, "POST", ADOPT_RE);
  const t = await submitCreate(page, p1.title!);
  expect((await adopted).status(), "会話をチケットへ移す口が受ける").toBe(201);
  expect(
    (await specRows(t)).map((s) => s.title),
    "AI の案の確認項目がチケットに入る",
  ).toEqual([SPEC.a, SPEC.b]);
  // 反映：別の GET で、会話が作る画面の会話からチケットの会話になっている（作った本人の 1 つだけ）
  const convs = await convsOf(r.me.memberId);
  expect(convs, "会話は 1 つのまま（コピーではなく付け替え）").toHaveLength(1);
  expect(convs[0]).toMatchObject({ talk_kind: "ticket", ticket_id: t });
  const s = await ticketSession(page, r.me, t);
  expect(s.conversation).toMatchObject({ talk_kind: "ticket", ticket_id: t });
  expect(s.messages.find((m) => m.who === "me")?.text, "人の言葉は残る").toBe(ASK);
  expect(
    s.messages.some((m) => m.who === "ai" && m.proposal?.title === p1.title),
    "AI の案の行は残る",
  ).toBe(true);
  expect(
    s.messages.some((m) => m.who === "ai" && m.text === MSG.reply),
    "AI の返事は残る",
  ).toBe(true);
  const number = await numberOf(t);
  expect(
    s.messages.some((m) => m.who === "note" && m.text.includes(MSG.noteAdopted(number))),
    "「作る時の会話はここに続きます」の 1 行",
  ).toBe(true);
  // 画面：右のパネルの「〇〇のAI」タブに同じ会話が続く（K-764）
  await panel(page)
    .getByRole("navigation", { name: "パネルのタブ", exact: true })
    .getByRole("button", { name: /のAI$/ })
    .click();
  await expect(panel(page)).toContainText(ASK);
  await expect(panel(page)).toContainText(MSG.noteAdopted(number));
});

/** 人が題名を直した状態まで進める：言う → 案 → ［全部使う］→ 題名を直す。人が直した題名と、AI の最初の案を返す */
async function editedTitleState(page: Page, r: Ready, tag: string) {
  const p1: Proposal = {
    title: `作業報告書を送る ${tag}`,
    body: "11 月分と同じ形で 12 月分を作って山田様に送ります。",
    checks: [SPEC.a, SPEC.b],
  };
  const mine = `作業報告書を 12/26 までに送る（人が直した）${tag}`;
  await openCreateWithAi(page);
  await talkSay(page, ASK);
  await answer(r, await takeChat(r), p1, MSG.reply);
  await useAll(cards(page).first()).click();
  await expect(titleBox(page)).toHaveValue(p1.title!);
  await titleBox(page).fill(mine);
  await expect(page.getByText("直しました", { exact: true }).first(), "直した欄に印が付く").toBeVisible();
  return { p1, mine };
}
/** 食い違ったときに AI が会話で聞く文（仮・下絵に無い字。K-777 が決める） */
const askWhich = (mine: string, ai: string): string =>
  `題名は、あなたが直した「${mine}」と、私の案の「${ai}」のどちらにしますか？`;
const NEW_CHECK = "鈴木さんにも送っている";

test("K770-M1-02 人が直した欄と案が食い違うと会話で聞く：欄を直して言い直すと、直した中身が AI に渡り、AI が「どちらにしますか」と聞き（案は題名に当たらない・食い違わない確認項目は当たる）、人が会話で案の方を選ぶと案の題名が欄に当たる", async ({
  page,
}) => {
  const r = await ready(page, "食い違う");
  const tag = tagOf("m1-02");
  const { mine } = await editedTitleState(page, r, tag);
  const aiTitle = `AI が出し直した題名 ${tag}`;
  // 言い直す：欄の今の中身（直した題名）が仕事の中身に入る・人の言葉の行に「題名を AI に渡しました」の印
  await r.pc.beat(); // 操作を挟んで鮮度の窓を越えないように、PC の生きている知らせを入れ直す
  await talkSay(page, "鈴木さんにも送るので、確認項目にも入れて。題名は AI の案でもいい");
  const job2 = await takeChat(r);
  expect(job2.prompt, "直した題名が AI に渡る（毎回いまの欄の中身を読み直す）").toContain(mine);
  await expect(thread(page).getByText(/題名.*AI に渡しました/)).toBeVisible();
  const [conv] = await convsOf(r.me.memberId);
  const humans = (await readConv(page, r.me, conv!.id)).messages.filter((m) => m.who === "me");
  expect(
    humans.map((m) => m.passed),
    "1 つ目の言葉は何も直していない・2 つ目は題名を直した",
  ).toEqual([[], ["title"]]);
  // AI は食い違う題名を黙って決めず、会話で聞く。案には食い違わない確認項目だけを載せる
  const question = askWhich(mine, aiTitle);
  await answer(r, job2, { checks: [SPEC.a, SPEC.b, NEW_CHECK] }, question);
  await expect(thread(page), "AI の返事に聞く文が出る").toContainText("どちらにしますか");
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).last(), "案は食い違う題名の欄を含まない").not.toContainText("題名");
  await expect(page.getByRole("alertdialog"), "小窓は出さない").toHaveCount(0);
  await expect(page.getByRole("dialog"), "小窓は出さない").toHaveCount(0);
  await expect(titleBox(page), "聞いている間、題名は人の字のまま").toHaveValue(mine);
  await useAll(cards(page).last()).click();
  await expect(checksBlock(page), "食い違わない欄（確認項目）はそのまま当たる").toContainText(NEW_CHECK);
  await expect(titleBox(page), "題名は人の返事があるまで変わらない").toHaveValue(mine);
  // 人が会話で選ぶ（案の方）→ 2 回目の仕事：欄の今の中身を読み直し、選ばれた案を出す → 当てると案の題名
  await r.pc.beat();
  await talkSay(page, "案の方で");
  const job3 = await takeChat(r);
  expect(job3.prompt, "人の返事が仕事の中身に入る").toContain("案の方で");
  expect(job3.prompt, "欄の今の中身（人が直した題名のまま）を読み直して渡す").toContain(mine);
  await answer(r, job3, { title: aiTitle }, "題名を案の方にします。");
  await useAll(cards(page).last()).click();
  await expect(titleBox(page), "人が案を選んだので、案の題名が欄に当たる").toHaveValue(aiTitle);
  await assigneeAndDue(page, r.me);
  const t = await submitCreate(page, aiTitle);
  expect(await titleOf(t), "作ったチケットの題名は人が選んだ案の字").toBe(aiTitle);
  expect(
    (await specRows(t)).map((x) => x.title),
    "確認項目は食い違わなかった案の 3 つ",
  ).toEqual([SPEC.a, SPEC.b, NEW_CHECK]);
});

test("K770-M1-08 人が会話で自分の字を選ぶ：食い違いを聞かれて「自分の題名のまま」と答えると、人の字のまま欄に残り、作ったチケットの題名も人の字", async ({
  page,
}) => {
  const r = await ready(page, "人の字");
  const tag = tagOf("m1-08");
  const { mine } = await editedTitleState(page, r, tag);
  const aiTitle = `AI が出し直した題名 ${tag}`;
  await r.pc.beat();
  await talkSay(page, "題名は AI の案でもいいけど、どう思う？");
  const job2 = await takeChat(r);
  expect(job2.prompt).toContain(mine);
  await answer(r, job2, { checks: [SPEC.a, SPEC.b, NEW_CHECK] }, askWhich(mine, aiTitle));
  await expect(thread(page)).toContainText("どちらにしますか");
  await expect(titleBox(page)).toHaveValue(mine);
  await r.pc.beat();
  await talkSay(page, "自分の題名のままで");
  const job3 = await takeChat(r);
  expect(job3.prompt, "欄の今の中身は人の字のまま").toContain(mine);
  await answer(r, job3, { title: mine }, "題名はあなたの字のままにします。");
  await useAll(cards(page).last()).click();
  await expect(titleBox(page), "人の方を選んだので、人の字のまま").toHaveValue(mine);
  await expect(page.getByRole("alertdialog"), "小窓は出さない").toHaveCount(0);
  await assigneeAndDue(page, r.me);
  const t = await submitCreate(page, mine);
  expect(await titleOf(t), "作ったチケットの題名は人の字").toBe(mine);
});

test("K770-M1-03 PC がまだ：PC をつなぐまで作る画面では話せず（案内が出て書く欄が止まる）、自分で書いて作れる。口に直に言うと 409（E-TALK-060）で、会話はチケットに移らない", async ({
  page,
}) => {
  const me = await newcomer(page, box, "PC なし");
  await openCreateWithAi(page);
  await expect(
    chat(page)
      .getByRole("status")
      .filter({ hasText: loose(MSG.noPc) }),
  ).toBeVisible();
  await expect(chat(page).getByRole("heading", { level: 2 })).toHaveText(loose("PC をつなぐと、AI と話して作れます"));
  await expect(sayBox(page), "書く欄は止まっている").toBeDisabled();
  await expect(sendBtn(page)).toBeDisabled();
  // 左の欄に自分で書いて作る：会話は始まらず、移しの口も呼ばれない
  const adopts = countRequests(page, "POST", ADOPT_RE);
  const t = await fillAndCreate(page, me, `自分で書いた 段6M1 ${tagOf("m1-03")}`, {
    body: "社内の確認だけの作業",
    specs: [SPEC.a],
  });
  expect(adopts.n, "話していないので、会話をチケットへ移す口は呼ばれない").toBe(0);
  expect(await convsOf(me.memberId), "会話は 1 つも無い").toHaveLength(0);
  expect((await specRows(t)).map((s) => s.title)).toEqual([SPEC.a]);
  // 口に直に：会話は始められるが、PC が無いと言えない
  const start = await asPerson(page, me.token, "POST", "/ticket_draft_conversations", {});
  expect(start.status, "会話を始める口は PC が無くても受ける").toBe(201);
  const said = await asPerson(page, me.token, "POST", `/ticket_draft_conversations/${start.data!["id"]}/messages`, {
    text: "作りたい",
    draft: { title: "", body: "", checks: [] },
  });
  expect(said.status).toBe(409);
  expect(said.code).toBe("E-TALK-060");
});

test("K770-M1-04 AI がチェックを付ける：任せる → PC の AI が確認項目を読み、確かめられた 2 つにだけ付けて終える → 承認待ちの確認の表が「2 ／ 3 済み」。AI は外せない", async ({
  page,
}) => {
  const r = await ready(page, "チェック");
  const title = `見積を送る 段6M1 ${tagOf("m1-04")}`;
  const t = await makeTicket(page, r.me, title, { specs: [SPEC.a, SPEC.b, SPEC.c] });
  await openTicket(page, t, title);
  await delegateBtn(page).click();
  await expect(aiBand(page)).toContainText("に任せました");
  const job = await takeSoon(r, "任せた仕事は任せた人の PC に渡る");
  expect(job).toMatchObject({ kind: "ticket", ticket_id: t, phase: "make" });
  expect(job.prompt, "終わる前に確認項目へチェックを付ける指示が入る（K-736・確認項目が 1 件以上のとき）").toContain(
    "spec_check",
  );
  const tool = toolOf(r.pc, job);
  const read = await tool("ticket_read", {});
  const specs = (read.data?.["result"] as { specs: { id: string; text: string; checked: boolean }[] }).specs;
  expect(
    specs.map((s) => [s.text, s.checked]),
    "AI は確認項目の id・文・チェックの有無を読める",
  ).toEqual([
    [SPEC.a, false],
    [SPEC.b, false],
    [SPEC.c, false],
  ]);
  for (const s of specs.slice(0, 2)) {
    expect((await tool("spec_check", { spec_id: s.id, checked: true, basis: `確かめた：${s.text}` })).status).toBe(201);
  }
  const unset = await tool("spec_check", { spec_id: specs[0]!.id, checked: false, basis: "外したい" });
  expect(unset.status, "AI が自分でチェックを外す道は無い").toBe(422);
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
  // DB：AI が付けた 2 つ（人の名前は付かない）と、付けていない 1 つ
  expect(
    (await specRows(t)).map((s) => [s.title, s.checked_at !== null, s.checked_by_ai, s.checked_by_member_id]),
  ).toEqual([
    [SPEC.a, true, true, null],
    [SPEC.b, true, true, null],
    [SPEC.c, false, false, null],
  ]);
  // 画面：開いたままの詳細が承認待ちに替わり、確認の表は数だけ（だれが・根拠は表に出さない）
  await expect(execBand(page)).toContainText(MSG.waitingMe);
  await expect(execBand(page)).toContainText(`確認 ${MSG.sum(2, 3)}`);
  const table = page.getByRole("table", { name: "確認の結果", exact: true });
  for (const x of [SPEC.a, SPEC.b, SPEC.c]) await expect(table).toContainText(x);
  await expect(table.locator('[aria-label="チェック済み"]')).toHaveCount(2);
  await expect(table.locator('[aria-label="まだ"]')).toHaveCount(1);
  await expect(table, "根拠は表に出さない（やり取りに出る）").not.toContainText("確かめた：");
  // 別の GET：口の答え・承認待ちの列・やり取りが同じ数
  const [a] = await approvalsOf(t);
  const got = await asPerson(page, r.me.token, "GET", `/approvals/${a!.id}`);
  expect(got.data).toMatchObject({ check_summary: MSG.sum(2, 3) });
  expect((got.data as unknown as { checks: { checked: boolean }[] }).checks.map((c) => c.checked)).toEqual([
    true,
    true,
    false,
  ]);
  await page.goto("/approvals");
  await expect(page.getByRole("row").filter({ hasText: title })).toContainText(MSG.sum(2, 3));
  const basis = (await systemLines(t)).filter((l) => l.includes("根拠："));
  expect(basis, "AI の根拠は付けた分だけ、やり取りの行に残る").toHaveLength(2);
});

test("K770-M1-05 承認待ちのお知らせは担当者だけ（F5 → F7）：AI の結果が承認待ちになると、担当者に 1 件・同じ会社のほかの人には出ない", async ({
  page,
}) => {
  const r = await ready(page, "お知らせ");
  const mate = await teammate(r.me, "同僚");
  const { t } = await toApproval(page, r, "m1-05", { specs: [SPEC.a] });
  const mine = await noticesOf(r.me.memberId, "approval.requested");
  expect(mine, "担当者にお知らせが 1 件").toHaveLength(1);
  expect(mine[0]!.ticket_id).toBe(t);
  expect(await noticesOf(mate.memberId, "approval.requested"), "同じ会社のほかの人には出ない").toHaveLength(0);
});

test("K770-M1-06 自分で直す：承認待ちの［自分で直す］→ 成果物を直して保存 → 新しい版・承認待ちのまま・AI のチェックは残り、確認の表の上に直した人が出る。古い版からの保存は 409", async ({
  page,
}) => {
  const r = await ready(page, "自分で直す");
  const { t, title, approval } = await toApproval(page, r, "m1-06", { specs: [SPEC.a, SPEC.b], check: 1 });
  await openTicket(page, t, title);
  await expect(execBand(page)).toContainText(MSG.waitingMe);
  await execBand(page).getByRole("button", { name: "自分で直す", exact: true }).click();
  const surface = page.getByRole("region", { name: "成果物を直す", exact: true });
  await expect(surface.getByRole("heading")).toContainText("版 1 をもとに");
  await surface.getByRole("textbox", { name: "成果物の字", exact: true }).fill(EDITED_ARTIFACT);
  const saved = answered(page, "POST", EDIT_RE);
  await surface.getByRole("button", { name: "直して保存する", exact: true }).click();
  expect((await saved).status(), "自分で直す口が受ける").toBe(201);
  // 反映：新しい版が 1 つ増え、承認は決まらないまま、AI のチェックは外れない
  expect((await artifactsOf(t)).map((v) => v.text)).toEqual([AI.made, EDITED_ARTIFACT]);
  expect(await approvalsOf(t), "承認待ちの行は 1 つのまま（決まっていない）").toHaveLength(1);
  expect((await approvalsOf(t))[0]!.decision).toBeNull();
  expect(
    (await specRows(t)).map((s) => [s.title, s.checked_by_ai]),
    "AI のチェックは残る",
  ).toEqual([
    [SPEC.a, true],
    [SPEC.b, false],
  ]);
  await expect(surface, "保存したら直す面は閉じる").toHaveCount(0);
  await expect(execBand(page)).toContainText(EDITED_ARTIFACT);
  await expect(execBand(page)).toContainText("成果物の版 2");
  await expect(execBand(page)).toContainText(MSG.editedBy(r.me.name, 2));
  await expect(execBand(page)).toContainText(MSG.waitingMe);
  expect(
    (await systemLines(t)).some((l) => l.includes(`${r.me.name}が成果物を直しました（版 2）`)),
    "やり取りに 1 行",
  ).toBe(true);
  // 古い版（1）からもう一度保存すると、先に直されていたものとして 409
  const stale = await asPerson(page, r.me.token, "POST", `/approvals/${approval}/edit`, { text: "別の字", version: 1 });
  expect(stale.status).toBe(409);
  expect(stale.code).toBe("E-APR-020");
  expect(
    (await artifactsOf(t)).map((v) => v.text),
    "古い版からの保存は何も変えない",
  ).toEqual([AI.made, EDITED_ARTIFACT]);
});

test("K770-M1-07 承認 → 実行 → 完了：確かめの小窓がチェックの無い確認項目を知らせ、その場でチェックを付けて承認できる。実行の仕事には直した成果物が渡り、完了にできる", async ({
  page,
}) => {
  const r = await ready(page, "承認から完了");
  const { t, title, approval } = await toApproval(page, r, "m1-07", { specs: [SPEC.a, SPEC.b], check: 1 });
  const edited = await asPerson(page, r.me.token, "POST", `/approvals/${approval}/edit`, {
    text: EDITED_ARTIFACT,
    version: 1,
  });
  expect(edited.status, "自分で直す口が受ける（画面の道は M1-06）").toBe(201);
  await openTicket(page, t, title);
  await expect(execBand(page)).toContainText(`確認 ${MSG.sum(1, 2)}`);
  // 承認の確かめの小窓：チェックの無い確認項目が 1 件 → その場で人がチェックを付ける → 承認（付けなくても承認できるが、ここは付ける）
  await approveBtn(page).click();
  const dialog = approveDialog(page);
  await expect(dialog).toContainText(MSG.pendingChecks(1));
  const marked = answered(page, "PATCH", SPEC_ROW_RE);
  await dialog.getByRole("checkbox", { name: SPEC.b, exact: true }).check();
  expect((await marked).status(), "確認項目のチェックの口が受ける").toBe(200);
  const rows = await specRows(t);
  expect(
    rows.map((s) => [s.title, s.checked_by_ai, s.checked_by_member_id]),
    "付けたのは人（AI のチェックは AI のまま）",
  ).toEqual([
    [SPEC.a, true, null],
    [SPEC.b, false, r.me.memberId],
  ]);
  const decided = answered(page, "POST", /^\/api\/v1\/approvals\/[^/]+\/approve$/);
  await confirmApprove(page);
  expect((await decided).status(), "承認の口が受ける").toBe(201);
  // 承認が実行の仕事になり、同じ PC に届く。中身は直した成果物。承認の後の実行の指示に spec_check は足さない（K-736）
  const exec = await takeSoon(r, "承認が実行の仕事になって、任せた人の PC に届く");
  expect(exec).toMatchObject({ kind: "ticket", ticket_id: t, phase: "execute", agent_session_id: r.session });
  expect(exec.prompt, "実行する成果物は人が直した版").toContain(EDITED_ARTIFACT);
  expect(exec.prompt, "承認の後の実行には、チェックを付ける指示を足さない").not.toContain("spec_check");
  expect(await r.w.finish(exec.job_id, { state: "done", result: AI.sent, agent_session_id: r.session })).toMatchObject({
    status: 201,
  });
  // 完了：確認項目は全部付いているので、小窓なしで完了にできる
  const done = answered(page, "POST", COMPLETE_RE);
  await completeBtn(page).click();
  expect((await done).status(), "完了の口が受ける").toBeLessThan(300);
  await expect(execBand(page)).toContainText(MSG.completed);
  expect(await ticketState(t)).toMatchObject({ stage: "done", completed_by: r.me.memberId });
  expect(
    (await approvalsOf(t)).map((a) => a.decision),
    "承認の行は 1 つ・承認",
  ).toEqual(["approve"]);
  expect((await runsOf(t)).map((x) => [x.phase, x.job_state])).toEqual([
    ["make", "done"],
    ["execute", "done"],
  ]);
  expect(
    (await artifactsOf(t)).map((v) => v.text),
    "成果物の版は 2 つ（承認で版は増えない）",
  ).toEqual([AI.made, EDITED_ARTIFACT]);
});
