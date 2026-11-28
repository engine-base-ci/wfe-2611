// K-772 中間テスト（段 6・M3）：分身の部屋（ようす → 話す → やったこと → チケットへ戻る・K-753〜K-756・K-757〜K-759・K-762）と、
//   承認待ち（札で絞る・並べ替える・まとめて承認・決めた履歴から取り下げ・続けて裁く・K-748〜K-752・K-768・K-769）を、
//   本物のブラウザ・本物の DB・本物の口と、試験の PC でつなぐ。中の 1 本 1 本の分岐は単体（口の試験・画面の試験）が持つ。ここは「つないだときにだけ出るもの」を見る。
//   口は網の手前で差し替えない（page.route で答えを作らない。届く頭 x-forwarded-for だけを足す）。AI は決まった答え（_lib/f5-flow.ts の AI）。
//   PC は K-58 の試験の PC（_lib/test-pc.ts）に契約の口で仕事を運ばせる（f5-flow の workOf）。会話の返事は PC が会話の写しの口（K-760）で書く。
//   使用者の本物の Bridge（38617）には触らない。画面の名前・字は /dev/mock/f5 の下絵（features/F5/{more,room}）から。
//   画面の葉（K-749・K-751・K-752・K-755・K-756・K-762・K-769）の名前が絵と変わったら、この試験を同時に直す（仮の字は md に書いた）。
//   固定の待ちは置かない（口の答え・画面の要素・DB の値が変わるのを待つ）。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { API, admin } from "../_lib/api";
import { answered, esc, makeTicket, tagOf } from "../_lib/f4-flow";
import { AI, approvalsOf, runsOf, workOf, type Job, type PcWork } from "../_lib/f5-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { asPerson, pairedPc } from "../_lib/prep";
import type { TestPc } from "../_lib/test-pc";
import { approveDialog, confirmApprove } from "../k/approve-modal";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 150_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 99);
});
const pcs: TestPc[] = [];
test.afterEach(async () => {
  await Promise.all(pcs.splice(0).map((p) => p.close()));
});

/** 文言（K-753・K-754・K-768・K-750 の md と下絵 /dev/mock/f5 の字から。実装から書かない。仮の字は md の「仮」の一覧） */
const MSG = {
  idle: "いまは何もしていません",
  waiting: "あなたを待っています",
  pcNone: "PC がまだつながっていません",
  stoppedBy: "あなたが止めました",
  bulkTitle: (n: number) => `AI の成果物 ${n} 件をまとめて承認します`,
  irreversible: (n: number) => `取り消せない物が ${n} 件含まれます`,
  pending: (n: number) => `チェックの無い確認項目が ${n} 件あります`,
  bulkDone: (n: number) => `${n} 件を承認しました`,
  bulkPartial: "1 件は承認できませんでした",
  decidedFirst: "先にほかの人が決めていました",
  undoLate: "もう実行が始まっているので、取り消せません",
  focusEnd: "決め終わりました",
  doneEmpty: "札を「すべて」に戻すか、期間を広げてみてください",
} as const;
const loose = (s: string): RegExp => new RegExp([...s].map(esc).join("⁠?"));
const SPEC = { a: "作業時間の合計が稼働記録と同じ", b: "宛名が山田様になっている" } as const;

type Body = Record<string, unknown>;
const bridgeUa = (): string => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  return (createRequire(join(root, "apps/bridge/src/main.ts"))("./pairing.ts") as { BRIDGE_UA: string }).BRIDGE_UA;
};
const PC_IP = `10.99.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
/** PC の印で /bridge/jobs の口を 1 回呼ぶ（f5-flow の workOf が持たない会話の写しの口） */
async function pcPost(pc: TestPc, path: string, body: Body) {
  const token = pc.token();
  if (!token) throw new Error("まだつながっていない PC は口を呼ばない");
  const r = await fetch(`${API}/api/v1/bridge/jobs${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bridge-session": token,
      "user-agent": bridgeUa(),
      "x-forwarded-for": PC_IP,
    },
    body: JSON.stringify(body),
  });
  return { status: r.status };
}

interface Ready {
  me: Newcomer;
  pc: TestPc;
  w: PcWork;
  session: string;
}
async function ready(page: Page, tag: string): Promise<Ready> {
  const me = await newcomer(page, box, tag);
  const pc = await pairedPc(page, me.token, `中間 M3（段 6）の MacBook (${tag})`);
  pcs.push(pc);
  return { me, pc, w: workOf(pc), session: randomUUID() };
}
async function takeSoon(r: Ready, what: string): Promise<Job> {
  let job: Job | null = null;
  await expect.poll(async () => (job ??= await r.w.take()), what).not.toBeNull();
  return job!;
}
const numberOf = async (t: string): Promise<string> =>
  (await admin<{ n: string }>("select number as n from tickets where id = $1", [t]))[0]!.n;

/** チケットを作り、口で任せ、PC が作る段を取って終える（承認待ちになる）。作る段の仕事は取らずに残さない */
async function waiting(
  page: Page,
  r: Ready,
  title: string,
  o: { specs?: string[]; dueIn?: number } = {},
): Promise<{ t: string; title: string; approval: string; number: string }> {
  const t = await makeTicket(page, r.me, title, { specs: o.specs ?? [SPEC.a], ...(o.dueIn ? { dueIn: o.dueIn } : {}) });
  const d = await asPerson(page, r.me.token, "POST", `/tickets/${t}/delegate`, {});
  expect(d.status, "任せる口が受ける").toBeLessThan(300);
  const job = await takeSoon(r, "任せた仕事は任せた人の PC に渡る");
  expect(job).toMatchObject({ kind: "ticket", ticket_id: t, phase: "make" });
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: r.session })).toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
  return { t, title, approval: (await approvalsOf(t))[0]!.id, number: await numberOf(t) };
}

// ---------------------------------------------------------------- 画面
const tab = (page: Page, name: string): Locator =>
  page.getByRole("navigation", { name: "部屋のタブ", exact: true }).getByRole("button", { name, exact: true });
const sayBox = (page: Page): Locator => page.getByRole("textbox", { name: /AI に話す$/ });
const sendBtn = (page: Page): Locator => page.getByRole("button", { name: "送る", exact: true });
const stopBtn = (page: Page): Locator => page.getByRole("button", { name: "止める", exact: true });
const thread = (page: Page): Locator => page.getByRole("list", { name: "会話", exact: true });
const SAY_RE = /^\/api\/v1\/conversations\/[^/]+\/messages$/;
const STOP_RE = /^\/api\/v1\/conversations\/[^/]+\/stop$/;
const queueRow = (page: Page, title: string): Locator => page.getByRole("row").filter({ hasText: title });
const chip = (page: Page, re: RegExp): Locator =>
  page.getByRole("group", { name: "絞り込み", exact: true }).getByRole("button", { name: re });
/** 承認待ちの行を上から順に並んだ題名で返す（題名に付けた目印の頭で拾う） */
async function order(page: Page, prefix: string): Promise<string[]> {
  const texts = await page.getByRole("row").allInnerTexts();
  return texts.map((x) => new RegExp(`${prefix}\\w+`).exec(x)?.[0] ?? "").filter((x) => x !== "");
}
const BULK_PREVIEW_RE = /^\/api\/v1\/approvals\/bulk\/preview$/;
const BULK_RE = /^\/api\/v1\/approvals\/bulk$/;
const WITHDRAW_RE = /^\/api\/v1\/approvals\/[^/]+\/withdraw$/;
const historyDialog = (page: Page): Locator => page.getByRole("dialog", { name: "決めた履歴", exact: true });

/** 部屋の「話す」で言う。言う口が 201 を答えるまで待つ（初回は画面が会話を作る口も呼ぶ） */
async function talk(page: Page, text: string): Promise<void> {
  await sayBox(page).fill(text);
  const sent = answered(page, "POST", SAY_RE);
  await sendBtn(page).click();
  expect((await sent).status(), "言う口が受ける").toBe(201);
  await expect(thread(page)).toContainText(text);
}

test("K772-M3-01 ようす：任せて PC が動かしている間は「いま」に出て、承認待ちになると「あなたを待っています」に変わり、押すと承認待ちの画面へ（K-753・K-755）", async ({
  page,
}) => {
  const r = await ready(page, "ようす");
  const title = `見積を送る 段6M3 ${tagOf("m3-01")}`;
  await page.goto("/ai");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${r.me.name}のAI`);
  await expect(page.getByText(MSG.idle)).toBeVisible();
  const t = await makeTicket(page, r.me, title, { specs: [SPEC.a] });
  expect((await asPerson(page, r.me.token, "POST", `/tickets/${t}/delegate`, {})).status).toBeLessThan(300);
  const job = await takeSoon(r, "任せた仕事は PC に渡る");
  // 動いている間：口の答え（K-753）と画面の「いま」
  const now = await asPerson(page, r.me.token, "GET", "/clones/me/now");
  expect(now.data).toMatchObject({ current: { ticket_id: t, title }, waiting_approvals: 0 });
  await page.reload();
  await expect(page.locator('section[aria-labelledby="room-now"]')).toContainText(title);
  // 承認待ちになった：「いま」は空に戻り、承認が 1 件
  expect(await r.w.finish(job.job_id, { state: "done", result: AI.made, agent_session_id: r.session })).toMatchObject({
    status: 201,
  });
  expect((await asPerson(page, r.me.token, "GET", "/clones/me/now")).data).toMatchObject({
    current: null,
    waiting_approvals: 1,
  });
  await page.reload();
  const wait = page.getByRole("link", { name: loose(MSG.waiting) });
  await expect(wait).toContainText("承認 1");
  await wait.click();
  await expect(page).toHaveURL(/\/approvals$/);
  await expect(queueRow(page, title)).toHaveCount(1);
});

test("K772-M3-02 PC がまだ：部屋の「ようす」と「話す」に PC をつなぐ案内が出て、書く欄は止まっている（K-753・K-755・K-762）", async ({
  page,
}) => {
  const me = await newcomer(page, box, "PC なし");
  const clone = await asPerson(page, me.token, "GET", "/clones/me");
  expect(clone.data).toMatchObject({ pc: { state: "none", label: null } });
  await page.goto("/ai");
  await expect(page.getByText(loose(MSG.pcNone)).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "PC をつなぐ（3 分）", exact: true })).toBeVisible();
  await tab(page, "話す").click();
  await expect(page).toHaveURL(/\/ai\/talk$/);
  await expect(sayBox(page)).toBeDisabled();
  await expect(sendBtn(page)).toBeDisabled();
});

test("K772-M3-03 話す：部屋で言う → PC が会話の仕事を取る → 作業中の 1 行 → 返事が書かれて会話に並ぶ → 開き直しても残る（K-757・K-758・K-759・K-760・K-762）", async ({
  page,
}) => {
  const r = await ready(page, "話す");
  const ask = "セイコー様の更新案の下書きを作って";
  const reply = "更新案の下書きを作りました。期限は 12/15 です。";
  await page.goto("/ai/talk");
  await talk(page, ask);
  const job = await takeSoon(r, "言った言葉は自分の PC の会話の仕事になる");
  expect(job.kind).toBe("chat");
  expect(job.prompt).toContain(ask);
  expect(await r.w.progress(job.job_id, 1, "考えています…（EG-124 の見積を確かめています）")).toBe(201);
  await expect(
    page.getByRole("status").filter({ hasText: "EG-124 の見積を確かめています" }),
    "作業中の 1 行が届く",
  ).toBeVisible();
  expect(
    (await pcPost(r.pc, `/${job.job_id}/conversation-entries`, { entries: [{ uuid: randomUUID(), text: reply }] }))
      .status,
  ).toBe(201);
  expect(await r.w.finish(job.job_id, { state: "done", result: reply, agent_session_id: r.session })).toMatchObject({
    status: 201,
  });
  await expect(thread(page), "返事が会話に並ぶ").toContainText(reply);
  await expect(sendBtn(page), "終わったらまた書ける").toBeVisible();
  // 反映：開き直した画面と口の答え
  await page.reload();
  await expect(thread(page)).toContainText(ask);
  await expect(thread(page)).toContainText(reply);
  const [c] = await admin<{ id: string }>(
    "select id from conversations where owner_member_id = $1 and talk_kind = 'clone'",
    [r.me.memberId],
  );
  const got = await asPerson(page, r.me.token, "GET", `/conversations/${c!.id}`);
  const who = (got.data as unknown as { messages: { who: string; text: string }[] }).messages
    .filter((m) => m.who === "me" || m.who === "ai")
    .map((m) => [m.who, m.text]);
  expect(who).toEqual([
    ["me", ask],
    ["ai", reply],
  ]);
});

test("K772-M3-04 話すを止める：作業中の［止める］で止まり（止めた印・止まった理由）、止めた後でもまた話せる。止められた仕事を PC が「止まった」で閉じても会話は壊れない（K-758・K-762）", async ({
  page,
}) => {
  const r = await ready(page, "止める");
  await page.goto("/ai/talk");
  await talk(page, "長めの調べものをして");
  const job = await takeSoon(r, "言った言葉は PC の会話の仕事になる");
  expect(await r.w.progress(job.job_id, 1, "調べています…")).toBe(201);
  await expect(stopBtn(page), "作業中は［送る］が［止める］に替わる").toBeVisible();
  const stopped = answered(page, "POST", STOP_RE);
  await stopBtn(page).click();
  expect((await stopped).status(), "止める口が受ける").toBe(201);
  const [j] = await admin<{ stop_requested_at: Date | null }>(
    "select stop_requested_at from bridge_jobs where id = $1",
    [job.job_id],
  );
  expect(j!.stop_requested_at, "止める印が立つ").not.toBeNull();
  expect(
    await r.w.finish(job.job_id, { state: "stopped", reason: "stopped_by_user", agent_session_id: r.session }),
  ).toMatchObject({ status: 201 });
  await expect(page.getByText(MSG.stoppedBy), "PC が止まったで閉じた後に、止まった理由が出る").toBeVisible();
  // 止めた後にまた話せる：新しい仕事が PC に届く
  await talk(page, "さっきの続きを短くまとめて");
  const next = await takeSoon(r, "止めた後の言葉も PC の仕事になる");
  expect(next.job_id).not.toBe(job.job_id);
  expect(next.prompt).toContain("さっきの続きを短くまとめて");
});

test("K772-M3-05 やったこと：任せた結果が時間の順に並び、行のチケットへ戻れる。札で絞ると 0 件の札は空の案内（K-754・K-756）", async ({
  page,
}) => {
  const r = await ready(page, "やったこと");
  const w = await waiting(page, r, `見積を送る 段6M3 ${tagOf("m3-05")}`);
  const act = await asPerson(page, r.me.token, "GET", "/clones/me/activity");
  const rows = act.data as unknown as { kind: string; result: string; ticket_id: string }[];
  expect(rows.find((x) => x.ticket_id === w.t)).toMatchObject({ kind: "made", result: "awaiting" });
  await page.goto("/ai/done");
  const line = page.getByRole("listitem").filter({ hasText: w.title }).last(); // 日の li の中の行の li（後ろ）
  await expect(page.getByRole("link", { name: w.number, exact: true }), "行は 1 つ").toHaveCount(1);
  await expect(line).toContainText(w.title);
  await expect(line).toContainText(w.number);
  await page
    .getByRole("group", { name: "やったことの絞り込み", exact: true })
    .getByRole("button", { name: "止まった", exact: true })
    .click();
  await expect(page.getByText(MSG.doneEmpty)).toBeVisible();
  await page
    .getByRole("group", { name: "やったことの絞り込み", exact: true })
    .getByRole("button", { name: "すべて", exact: true })
    .click();
  await page.getByRole("link", { name: w.number, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${w.t}$`));
  await expect(page.getByRole("heading", { level: 1, name: w.title, exact: true })).toBeVisible();
});

test("K772-M3-06 絞る・並べ替える：札の数は絞っても変わらず、並べ替えは口に届き、開き直しても残る。「渡された」が 0 件のときは空の案内から戻れる（K-748・K-749）", async ({
  page,
}) => {
  const r = await ready(page, "札");
  const tag = tagOf("m3-06").replace(/-/g, "");
  // 期限は Alpha が近く、承認待ちになるのも Alpha が先 → 並びが 3 つとも違う（期限＝Alpha,Bravo／新しい順＝Bravo,Alpha／題名＝Alpha,Bravo）
  const a = await waiting(page, r, `Alpha${tag} 見積`, { dueIn: 2 });
  const b = await waiting(page, r, `Bravo${tag} 見積`, { dueIn: 5 });
  await page.goto("/approvals");
  await expect(chip(page, /^AI の成果物\s*2$/)).toBeVisible();
  await expect(chip(page, /^渡された\s*0$/)).toBeVisible();
  await expect.poll(() => order(page, "(Alpha|Bravo)"), "初めは期限の近い順").toEqual([`Alpha${tag}`, `Bravo${tag}`]);
  const sorted = page.waitForRequest(
    (q) => /\/api\/v1\/approvals\/queue/.test(q.url()) && /sort=waiting/.test(q.url()),
  );
  await page.getByRole("button", { name: /^期限の近い順/ }).click();
  await page.getByRole("option", { name: "新しく承認待ちになった順", exact: true }).click();
  await sorted;
  await expect
    .poll(() => order(page, "(Alpha|Bravo)"), "新しく承認待ちになった物が先")
    .toEqual([`Bravo${tag}`, `Alpha${tag}`]);
  await page.getByRole("button", { name: /^新しく承認待ちになった順/ }).click();
  await page.getByRole("option", { name: "題名の順", exact: true }).click();
  await expect.poll(() => order(page, "(Alpha|Bravo)")).toEqual([`Alpha${tag}`, `Bravo${tag}`]);
  // 札：押すと道に残り、開き直しても同じ。数は絞っても変わらない
  await chip(page, /^AI の成果物/).click();
  await expect(chip(page, /^AI の成果物/)).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(chip(page, /^AI の成果物/), "開き直しても札は残る").toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, /^AI の成果物\s*2$/)).toBeVisible();
  await chip(page, /^渡された/).click();
  await expect(page.getByText(loose("「渡された」で決めるものはありません"))).toBeVisible();
  await expect(queueRow(page, a.title)).toHaveCount(0);
  await page.getByRole("button", { name: "すべてに戻す", exact: true }).click();
  await expect(queueRow(page, b.title)).toHaveCount(1);
});

test("K772-M3-07 まとめて承認（全部）：確かめの小窓が件数・取り消せない件数・チェックの無い確認項目の件数を出し、承認すると全部決まって実行の仕事が PC に届く（K-768・K-769）", async ({
  page,
}) => {
  const r = await ready(page, "まとめて全部");
  const tag = tagOf("m3-07");
  const a = await waiting(page, r, `見積 甲 ${tag}`, { specs: [SPEC.a, SPEC.b] });
  const b = await waiting(page, r, `見積 乙 ${tag}`, { specs: [SPEC.a] });
  await page.goto("/approvals");
  const preview = answered(page, "POST", BULK_PREVIEW_RE);
  await page.getByRole("button", { name: "まとめて承認（全部）", exact: true }).click();
  expect((await preview).status(), "確かめの口が受ける").toBe(201);
  const d = approveDialog(page);
  await expect(d).toContainText(MSG.bulkTitle(2));
  await expect(d).toContainText(MSG.irreversible(2));
  await expect(d).toContainText(MSG.pending(3));
  expect((await approvalsOf(a.t))[0]!.decision, "確かめの間は何も決まらない").toBeNull();
  const bulk = answered(page, "POST", BULK_RE);
  await d.getByRole("button", { name: "2 件を承認する", exact: true }).click();
  expect((await bulk).status()).toBe(201);
  await expect(page.getByText(MSG.bulkDone(2))).toBeVisible();
  for (const x of [a, b]) {
    expect(
      (await approvalsOf(x.t)).map((p) => p.decision),
      "どちらも承認",
    ).toEqual(["approve"]);
    await expect(queueRow(page, x.title)).toHaveCount(0);
  }
  // 1 件ずつの承認と同じ守りを通って、実行の仕事が 2 つ PC に届く
  const seen = new Set<string>();
  for (let i = 0; i < 2; i++) {
    const job = await takeSoon(r, "承認が実行の仕事になって PC に届く");
    expect(job).toMatchObject({ kind: "ticket", phase: "execute" });
    seen.add(job.ticket_id!);
  }
  expect([...seen].sort()).toEqual([a.t, b.t].sort());
});

test("K772-M3-08 まとめて承認（選んだもの・一部できなかった）：小窓を開いた後に 1 件が先に決まると、通った 1 件だけ承認され、通らなかった件が理由つきで知らされる（K-768・K-769）", async ({
  page,
}) => {
  const r = await ready(page, "まとめて一部");
  const tag = tagOf("m3-08");
  const a = await waiting(page, r, `見積 甲 ${tag}`);
  const b = await waiting(page, r, `見積 乙 ${tag}`);
  await page.goto("/approvals");
  await page.getByRole("checkbox", { name: `${a.number} を選ぶ`, exact: true }).check();
  await page.getByRole("checkbox", { name: `${b.number} を選ぶ`, exact: true }).check();
  await expect(page.getByRole("region", { name: "選んだもの", exact: true })).toContainText("2 件を選んでいます");
  const preview = answered(page, "POST", BULK_PREVIEW_RE);
  await page.getByRole("button", { name: "選んだものを承認", exact: true }).click();
  expect((await preview).status()).toBe(201);
  await expect(approveDialog(page)).toContainText(MSG.bulkTitle(2).replace("AI の成果物 2 件", "選んだ 2 件"));
  // 小窓を開いている間に、甲が先に決まる（ほかの道で承認）
  expect((await asPerson(page, r.me.token, "POST", `/approvals/${a.approval}/approve`, {})).status).toBe(201);
  const bulk = answered(page, "POST", BULK_RE);
  await approveDialog(page).getByRole("button", { name: "2 件を承認する", exact: true }).click();
  expect((await bulk).status(), "通った物があれば口は受ける").toBe(201);
  const note = page.getByText(MSG.bulkPartial);
  await expect(note).toBeVisible();
  await expect(note).toContainText(MSG.decidedFirst);
  await expect(note).toContainText(a.number);
  await expect(note).toContainText(`${b.number} は承認しました`);
  expect(
    (await approvalsOf(a.t)).map((p) => p.decision),
    "甲は先の 1 回だけ",
  ).toEqual(["approve"]);
  expect(
    (await approvalsOf(b.t)).map((p) => p.decision),
    "乙は一括で承認",
  ).toEqual(["approve"]);
  expect(
    (await runsOf(b.t)).filter((x) => x.phase === "execute"),
    "乙の実行は 1 つだけ",
  ).toHaveLength(1);
});

test("K772-M3-09 決めた履歴から取り下げ：承認した直後（PC が受け取る前）は［取り消す］で承認待ちに戻り、PC が受け取った後は間に合わず 409 の案内（K-750・K-751・K-733）", async ({
  page,
}) => {
  const r = await ready(page, "履歴");
  const w = await waiting(page, r, `見積を送る 段6M3 ${tagOf("m3-09")}`);
  expect((await asPerson(page, r.me.token, "POST", `/approvals/${w.approval}/approve`, {})).status).toBe(201);
  await page.goto("/approvals");
  await page.getByRole("button", { name: "決めた履歴", exact: true }).click();
  const row = historyDialog(page).getByRole("listitem").filter({ hasText: w.title });
  await expect(row).toContainText("承認");
  const undone = answered(page, "POST", WITHDRAW_RE);
  await row.getByRole("button", { name: "取り消す", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "取り下げる", exact: true }).click();
  expect((await undone).status(), "取り下げる口が受ける").toBe(201);
  const rows = await approvalsOf(w.t);
  expect(rows, "決まった行は残り、新しい承認待ちの行ができる").toHaveLength(2);
  expect(rows.map((p) => p.decision)).toEqual(["approve", null]);
  expect(await r.w.take(), "取り下げた承認の実行は PC に渡らない").toBeNull();
  await expect(queueRow(page, w.title), "承認待ちに戻る").toHaveCount(1);
  // もう一度承認 → 履歴を開く → PC が受け取る → 間に合わない
  expect((await asPerson(page, r.me.token, "POST", `/approvals/${rows[1]!.id}/approve`, {})).status).toBe(201);
  await page.reload();
  await page.getByRole("button", { name: "決めた履歴", exact: true }).click();
  const again = historyDialog(page).getByRole("listitem").filter({ hasText: w.title }).first();
  await expect(again.getByRole("button", { name: "取り消す", exact: true })).toBeVisible();
  const exec = await takeSoon(r, "承認が実行の仕事になって PC に届く");
  expect(exec.phase).toBe("execute");
  const late = answered(page, "POST", WITHDRAW_RE);
  await again.getByRole("button", { name: "取り消す", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "取り下げる", exact: true }).click();
  expect((await late).status(), "受け取った後は間に合わない").toBe(409);
  await expect(page.getByText(MSG.undoLate)).toBeVisible();
  expect(
    (await approvalsOf(w.t)).map((p) => p.decision),
    "承認の行はこれ以上増えない",
  ).toEqual(["approve", "approve"]);
});

test("K772-M3-10 続けて裁く：1 件ずつ全画面で飛ばす・承認する → 終わりの面に数が出て、飛ばした物は承認待ちに残る（K-752）", async ({
  page,
}) => {
  const r = await ready(page, "続けて");
  const tag = tagOf("m3-10");
  const a = await waiting(page, r, `見積 甲 ${tag}`, { dueIn: 2 });
  const b = await waiting(page, r, `見積 乙 ${tag}`, { dueIn: 5 });
  await page.goto("/approvals");
  await page.getByRole("button", { name: /^続けて裁く（2 件/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "続けて裁く", exact: true })).toBeVisible();
  await expect(page.getByText("1 / 2 件")).toBeVisible();
  const card = page.getByRole("region", { name: "いま決めるもの", exact: true });
  await expect(card.getByRole("heading", { level: 2 })).toContainText(a.title);
  await page.getByRole("button", { name: /^飛ばす/ }).click();
  await expect(page.getByText("2 / 2 件")).toBeVisible();
  await expect(card.getByRole("heading", { level: 2 })).toContainText(b.title);
  const decided = answered(page, "POST", /^\/api\/v1\/approvals\/[^/]+\/approve$/);
  await page.getByRole("button", { name: /^承認して送る → 次へ/ }).click();
  await confirmApprove(page);
  expect((await decided).status(), "承認の口が受ける").toBe(201);
  await expect(page.getByText(MSG.focusEnd)).toBeVisible();
  const tally = page.getByRole("list", { name: "結果", exact: true });
  await expect(tally).toContainText("承認 1 件");
  await expect(tally).toContainText("飛ばした 1 件");
  expect((await approvalsOf(a.t))[0]!.decision, "飛ばした物は決まらない").toBeNull();
  expect((await approvalsOf(b.t)).map((p) => p.decision)).toEqual(["approve"]);
  await page.getByRole("button", { name: "承認待ちに戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/approvals$/);
  await expect(queueRow(page, a.title)).toHaveCount(1);
  await expect(queueRow(page, b.title)).toHaveCount(0);
});
