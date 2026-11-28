// K-417 中間テスト（段 9・M2）：引き継いでもらう → 返事が無い（期限切れ）→ 催促 → 断られる → 別の人にする → 受ける／途中で取り消す を、
//   本物のブラウザ 2〜3 つ・本物の DB・本物の口でつなぐ（K-411 渡す画面・K-412 受ける／断る画面・K-413 催促・取り消す・別の人にする画面）。
//   中の 1 本 1 本の分岐は単体の試験（口：K-402・K-403・K-406・K-407・画面：K-411〜K-413）が持つ。ここは「つないだときにだけ出るもの」を見る：
//   期限切れを渡した人が開いたときに 1 回だけ知らせるか・催促が相手の知らせに届き 1 日 1 回で止まるか・断った理由が渡した人の帯に届くか・
//   別の人に渡し直すと前の渡しの記録が残ったまま新しい渡しが成り立つか・取り消すと相手の承認待ちと詳細がそろって変わり古い画面から受けられないか。
//   時刻は DB の返事の期限を動かす（_lib/f8-flow.ts の replyDueAgo・待たない）。道具は K-416 が持ち込む _lib/f8-flow.ts を読む。
//   口は網の手前で差し替えない（1 人目だけ届く頭 x-forwarded-for を足す）。メールは試験の受け箱。固定の待ちは置かない。
//   ★前提：CI の web の組の G59 と同じ（API を試験の受け箱へ・画面は BASE_URL）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { expect, test, type Page } from "@playwright/test";
import {
  REMIND_RE,
  WITHDRAW_RE,
  acceptInQueue,
  answered,
  assigneeOf,
  bandOf,
  declineVia,
  handoverNotesOf,
  handoversOf,
  mateOf,
  openQueue,
  openTicket,
  panelAssignee,
  passOnScreen,
  queueRow,
  replyDueAgo,
  san,
  type Mate,
} from "../_lib/f8-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { ticketOf } from "../_lib/prep";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 66);
});
const mates: Mate[] = [];
test.afterEach(async () => {
  await Promise.all(mates.splice(0).map((m) => m.ctx.close()));
});

/** 文言（K-411〜K-413 の仕様の表・モック /dev/mock/f8・決定 D-148.8・D-148.9・D-148.19・D-148.21 から。実装から書かない） */
const MSG = {
  waiting: "の返事を待っています（渡し中）", // f8-waiting-sender
  overdue: "の返事がまだありません", // f8-overdue
  declined: "に断られました", // f8-declined-sender
  taken: "が引き継ぎました", // f8-taken-sender
  withdrawn: "この渡しは取り消されました", // f8-gone
  withdrawTitle: "渡しを取り消しますか？", // f8-withdraw
  reminded: "催促しました（同じ渡しは 1 日 1 回まで）", // f8-reminded の小さな知らせ
  remindOnce: "今日はもう催促しました", // 2 回目の催促を口が断ったときの帯の知らせ（正本 E-HND-080 の文）
} as const;
const SECTIONS = {
  purpose: "先方に出す見積のたたき台を作って送る",
  done: "先方が見積を受け取った",
  todo: "- 見積を作る\n- 先方に送る",
} as const;
const REASON = "先方と面識があるので、こちらから返したほうが早い";
const WHY = "今週は月次の締めで手が空きません";
/** その人に届いた、登録・確認のほかのメール（渡しの知らせ）。件名は K-402〜K-407 が決めるので、登録のメールを除いて数える */
const handoverMails = (email: string) => box.mails(email).filter((m) => !/確認|登録が完了/.test(m.subject));

interface Ready {
  me: Newcomer;
  mate: Mate;
  t: string;
  title: string;
}
async function ready(page: Page, browser: Parameters<typeof mateOf>[0], tag: string): Promise<Ready> {
  const me = await newcomer(page, box, tag);
  const mate = await mateOf(browser, me, `佐藤 ${tag}`);
  mates.push(mate);
  const title = `見積を送る 中間9-2 ${tag}`;
  const t = await ticketOf(page, me, title, SECTIONS);
  return { me, mate, t, title };
}
/** 渡して、渡しの行の id を返す */
async function passed(page: Page, r: Ready, to = r.mate.name): Promise<string> {
  await openTicket(page, r.t, r.title);
  expect(await passOnScreen(page, to, { reason: REASON }), "渡す口が受ける").toBe(201);
  await expect(bandOf(page, new RegExp(MSG.waiting))).toBeVisible();
  const hs = await handoversOf(r.t);
  return hs.at(-1)!.id;
}

test("K417-M2-01 返事が無い：返事の期限を 1 分過ぎた後に渡した人が詳細を開く → 帯「〇〇さんの返事がまだありません」・渡した人の受け箱の行とメールが 1 回だけ（開き直しても増えない・D-148.9）", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m2-01");
  const h = await passed(page, r);
  const before = handoverMails(r.me.email).length;
  expect(await replyDueAgo(h, "1 minute")).toBe(1);
  await openTicket(page, r.t, r.title);
  const band = bandOf(page, new RegExp(MSG.overdue));
  await expect(band).toContainText(r.mate.name.split(" ")[0]!);
  await expect(band.getByRole("button", { name: "催促する", exact: true })).toBeVisible();
  await expect
    .poll(() => handoverNotesOf(r.me.memberId, r.t), "期限切れの知らせが渡した人の受け箱に 1 行")
    .toHaveLength(1);
  await expect.poll(() => handoverMails(r.me.email).length, "期限切れのメールが 1 通").toBe(before + 1);
  await openTicket(page, r.t, r.title);
  await openQueue(page);
  await openTicket(page, r.t, r.title);
  expect(await handoverNotesOf(r.me.memberId, r.t), "開き直しても増えない").toHaveLength(1);
  expect(handoverMails(r.me.email)).toHaveLength(before + 1);
  const [row] = await handoversOf(r.t);
  expect(row!.state, "期限を過ぎても渡しは待ったまま").toBe("waiting");
});

test("K417-M2-02 催促：期限切れの帯の「催促する」→ 小さな知らせ「〇〇さんに催促しました（同じ渡しは 1 日 1 回まで）」・相手の受け箱の行とメールが 1 つずつ増える。同じ日にもう一度押すと口が断り、相手の知らせは増えない（D-148.8）", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m2-02");
  const h = await passed(page, r);
  await replyDueAgo(h, "1 minute");
  await openTicket(page, r.t, r.title);
  const notes = (await handoverNotesOf(r.mate.memberId, r.t)).length;
  const mails = handoverMails(r.mate.email).length;
  const res = answered(page, "POST", REMIND_RE);
  await bandOf(page, new RegExp(MSG.overdue)).getByRole("button", { name: "催促する", exact: true }).click();
  expect((await res).status()).toBeLessThan(300);
  await expect(page.getByRole("status").filter({ hasText: MSG.reminded })).toBeVisible();
  await expect.poll(() => handoverNotesOf(r.mate.memberId, r.t).then((n) => n.length)).toBe(notes + 1);
  await expect.poll(() => handoverMails(r.mate.email).length).toBe(mails + 1);
  const again = answered(page, "POST", REMIND_RE);
  await bandOf(page, new RegExp(MSG.overdue)).getByRole("button", { name: "催促する", exact: true }).click();
  const second = await again;
  expect(second.status(), "同じ渡しは 1 日 1 回まで（K-406 の 409）").toBe(409);
  expect(((await second.json()) as { code?: string }).code, "K-406 の番号（今日はもう催促しました）").toBe("E-HND-080");
  // Next の読み上げの部品（next-route-announcer）も role=alert なので、帯の知らせ（正本 E-HND-080 の文）に絞る
  await expect(page.getByRole("alert").filter({ hasText: MSG.remindOnce })).toBeVisible();
  expect(await handoverNotesOf(r.mate.memberId, r.t)).toHaveLength(notes + 1);
  expect(handoverMails(r.mate.email)).toHaveLength(mails + 1);
});

test("K417-M2-03 断られる：渡された人が詳細の帯で理由を書いて断る → 渡した人の帯「〇〇さんに断られました」に理由・担当者は渡した人のまま・渡した人の受け箱の行とメールが 1 つずつ（D-125.90）", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m2-03");
  await passed(page, r);
  const mails = handoverMails(r.me.email).length;
  await openTicket(r.mate.page, r.t, r.title);
  const asked = bandOf(r.mate.page, /から、引き継いでほしいと頼まれています/);
  expect(await declineVia(r.mate.page, asked, WHY), "断る口が受ける").toBe(200);
  const [h] = await handoversOf(r.t);
  expect(h).toMatchObject({ state: "declined", decline_reason: WHY });
  expect(await assigneeOf(r.t)).toBe(r.me.memberId);
  await openTicket(page, r.t, r.title);
  const b = bandOf(page, new RegExp(`${san(r.mate.name).source}${MSG.declined}`));
  await expect(b).toContainText(`理由：${WHY}`);
  await expect(panelAssignee(page)).toContainText(r.me.name);
  await expect.poll(() => handoverNotesOf(r.me.memberId, r.t).then((n) => n.length)).toBe(1);
  await expect.poll(() => handoverMails(r.me.email).length).toBe(mails + 1);
});

test("K417-M2-04 別の人にする：断られた帯の「別の人にする」→ 3 人目を選んで渡し直す → 3 人目が受ける → 担当者は 3 人目。前の渡しは断った理由ごと残り、渡した人の帯は「〇〇さんが引き継ぎました」に替わる", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m2-04");
  const third = await mateOf(browser, r.me, "田中 m2-04");
  mates.push(third);
  await passed(page, r);
  await openQueue(r.mate.page);
  expect(await declineVia(r.mate.page, queueRow(r.mate.page, r.title), WHY)).toBe(200);
  await openTicket(page, r.t, r.title);
  const declined = bandOf(page, new RegExp(MSG.declined));
  await declined.getByRole("button", { name: "別の人にする", exact: true }).click();
  const pick = page.getByRole("dialog", { name: "担当者を選ぶ" });
  await pick.getByRole("button", { name: new RegExp(`^${third.name}`) }).click();
  const d = page.getByRole("dialog", { name: "引き継いでもらう" });
  await d.getByRole("textbox", { name: /^理由/ }).fill(REASON);
  const res = answered(page, "POST", /^\/api\/v1\/tickets\/[^/]+\/handovers$/);
  await d.getByRole("button", { name: "引き継いでもらう", exact: true }).click();
  expect((await res).status()).toBe(201);
  await expect(bandOf(page, new RegExp(MSG.declined)), "別の人に渡したら断られた帯は消える（D-148.34）").toHaveCount(0);
  await openQueue(third.page);
  expect(await acceptInQueue(third.page, r.title)).toBe(200);
  await expect.poll(() => assigneeOf(r.t)).toBe(third.memberId);
  const hs = await handoversOf(r.t);
  expect(hs.map((h) => [h.to_member_id, h.state, h.decline_reason])).toEqual([
    [r.mate.memberId, "declined", WHY],
    [third.memberId, "accepted", null],
  ]);
  await openTicket(page, r.t, r.title);
  await expect(bandOf(page, new RegExp(`${san(third.name).source}${MSG.taken}`))).toBeVisible();
});

test("K417-M2-05 途中で取り消す：渡し中の帯の「取り消す」→ 確かめ「渡しを取り消しますか？」→ 取り消す → 相手の承認待ちから消え、相手の詳細は「この渡しは取り消されました」。開いたままの古い承認待ちで受けても口が断る。相手への知らせは受け箱の行だけ（メールは増えない・D-148.19）", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m2-05");
  await passed(page, r);
  await openQueue(r.mate.page); // 古い画面として開いたままにする
  await expect(queueRow(r.mate.page, r.title)).toBeVisible();
  const mails = handoverMails(r.mate.email).length;
  await openTicket(page, r.t, r.title);
  await bandOf(page, new RegExp(MSG.waiting)).getByRole("button", { name: "取り消す", exact: true }).click();
  const c = page
    .getByRole("alertdialog", { name: MSG.withdrawTitle })
    .or(page.getByRole("dialog", { name: MSG.withdrawTitle }));
  const res = answered(page, "POST", WITHDRAW_RE);
  await c.getByRole("button", { name: "取り消す", exact: true }).click();
  expect((await res).status()).toBeLessThan(300);
  await expect(bandOf(page, new RegExp(MSG.waiting))).toHaveCount(0);
  const [h] = await handoversOf(r.t);
  expect(h!.state).toBe("withdrawn");
  expect(await assigneeOf(r.t)).toBe(r.me.memberId);
  expect(await acceptInQueue(r.mate.page, r.title), "取り消した渡しは受けられない").toBe(409);
  await openQueue(r.mate.page);
  await expect(queueRow(r.mate.page, r.title)).toHaveCount(0);
  await openTicket(r.mate.page, r.t, r.title);
  await expect(bandOf(r.mate.page, new RegExp(MSG.withdrawn))).toBeVisible();
  expect(await handoverNotesOf(r.mate.memberId, r.t), "渡された・取り消されたの 2 行").toHaveLength(2);
  expect(handoverMails(r.mate.email), "取り消されたはメールを出さない").toHaveLength(mails);
});

test("K417-M2-06 期限を過ぎても受けられる：期限切れの後に渡された人が承認待ちで受ける → 担当者が移り、渡した人の帯は「返事がまだありません」から「〇〇さんが引き継ぎました」に替わる", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m2-06");
  const h = await passed(page, r);
  await replyDueAgo(h, "2 hours");
  await openTicket(page, r.t, r.title);
  await expect(bandOf(page, new RegExp(MSG.overdue))).toBeVisible();
  await openQueue(r.mate.page);
  expect(await acceptInQueue(r.mate.page, r.title)).toBe(200);
  await expect.poll(() => assigneeOf(r.t)).toBe(r.mate.memberId);
  await openTicket(page, r.t, r.title);
  await expect(bandOf(page, new RegExp(MSG.overdue))).toHaveCount(0);
  await expect(bandOf(page, new RegExp(`${san(r.mate.name).source}${MSG.taken}`))).toBeVisible();
});
