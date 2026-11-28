// K-594 中間テスト（段 8・M4）：期限切れ（K-484 の炎・K-478 の札）→ 期限を変える（K-483・K-484・理由が必須）→ 札が減る（K-474）・カレンダー（K-481）・ガント（K-482）に出る を、
//   本物のブラウザ・本物の DB・本物の口でつなぐ。中の 1 本 1 本の分岐（日付の境目・同時に変えられた・親子の前後・小窓の誤り・幅）は単体（K-483・K-484・K-481・K-482 の試験）が持つ。
//   ここはつないだときだけ出るもの：期限の口が書いた値を、一覧の札・月の格子・ガントの行が別の GET で読み直して揃えて出すこと。
//   口は網の手前で差し替えない（届く頭 x-forwarded-for だけを足す）。道具は K-460 が運ぶ _lib/f7-flow.ts を読むだけ。期限切れは DB で作る（口は過去日を断るため）。
//   固定の待ちは置かない（口の答え・画面の要素・DB の値が変わるのを待つ）。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../_lib/api";
import { TICKET_RE, answered, jst, openTicket, scopeOf, setDueDays, ticketFor, ticketRow } from "../_lib/f7-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 94);
});

/** 文言（K-484・K-481・K-482・K-478 の仕様の表・モック f7-tidy-due・f7-calendar・f7-gantt から。実装から書かない） */
const MSG = {
  reasonEmpty: "E-DUE-001", // 理由が空のときの欄の下の字の頭（正本の文は番号つきで出る）
  changedTo: (md: string) => `期限を ${md} に変えました`,
  flame: "期限切れ",
};
const md = (day: string): string => day.slice(5).replace("-", "/");

interface World {
  me: Newcomer;
  scope: string;
  key: string;
  late: string;
  late2: string;
  later: string;
}
/** 登録した人と、同じグループの 3 枚（期限切れ 2 枚・期限が先の 1 枚）。期限切れは DB で作る */
async function world(page: Page, tag: string): Promise<World> {
  const me = await newcomer(page, box, tag);
  const scope = await scopeOf(me.memberId);
  const key = `ZD${randomUUID().slice(0, 6)}`;
  const late = await ticketFor(page, me, { title: `${key} 期限切れの一つ目` });
  const late2 = await ticketFor(page, me, { title: `${key} 期限切れの二つ目` });
  const later = await ticketFor(page, me, { title: `${key} 期限は先`, dueDays: 6 });
  await setDueDays(late, -1);
  await setDueDays(late2, -2);
  return { me, scope, key, late, late2, later };
}
const cards = (page: Page) => page.getByRole("group", { name: "数の札" });
const card = (page: Page, head: string) => cards(page).getByRole("button", { name: new RegExp(`^${head}`) });
/** 詳細の期限の小窓を開いて、日を選び、理由を書いて押す。口の答え（PATCH）を返す。day が null なら初めの選びのまま */
async function changeDue(page: Page, reason: string, o: { pick?: string } = {}) {
  await page.getByRole("button", { name: "期限を変える", exact: true }).click();
  const d = page.getByRole("dialog", { name: "期限を変える" });
  await expect(d).toBeVisible();
  if (o.pick) await d.getByRole("button", { name: o.pick, exact: true }).click();
  await d.getByRole("textbox", { name: "理由" }).fill(reason);
  const res = answered(page, "PATCH", TICKET_RE);
  await d.getByRole("button", { name: /^\d{2}\/\d{2} にする$/ }).click();
  return { res: await res, dialog: d };
}

test("K594-M4-01 期限切れが見える：詳細の期限に炎と「過ぎ」が出て、「自分に関わるもの」の札「期限切れ」の数が期限切れの枚数（2）と合う", async ({
  page,
}) => {
  const w = await world(page, "切れ");
  await openTicket(page, w.late, `${w.key} 期限切れの一つ目`);
  await expect(page.getByRole("img", { name: MSG.flame }), "炎（期限切れの印）").toHaveCount(1);
  await expect(page.getByText(/1 日過ぎ/)).toBeVisible();
  await page.goto("/tickets");
  await expect(card(page, "期限切れ"), "札の数は期限切れの 2 枚").toContainText("2");
  await expect(card(page, "今日まで")).not.toContainText(/[1-9]/);
  await openTicket(page, w.later, `${w.key} 期限は先`);
  await expect(page.getByRole("img", { name: MSG.flame }), "期限が先のチケットに炎は出ない").toHaveCount(0);
});

test("K594-M4-02 理由が必須：理由を書かずに押しても口は呼ばれず、理由を書いて押すと期限が変わり、やり取りに変更の 1 行が残る（口の答えと DB と画面が揃う）", async ({
  page,
}) => {
  const w = await world(page, "理由");
  const today = jst(0);
  const changeLines = async (): Promise<number> =>
    (
      await admin<{ n: number }>(
        "select count(*)::int as n from ticket_messages where ticket_id = $1 and kind = 'change'",
        [w.late],
      )
    )[0]!.n;
  const linesBefore = await changeLines();
  await openTicket(page, w.late, `${w.key} 期限切れの一つ目`);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "PATCH" && TICKET_RE.test(new URL(r.url()).pathname)) calls.push(r.url());
  });
  await page.getByRole("button", { name: "期限を変える", exact: true }).click();
  const d = page.getByRole("dialog", { name: "期限を変える" });
  await d.getByRole("button", { name: /^\d{2}\/\d{2} にする$/ }).click();
  await expect(d, "理由が空の字").toContainText(MSG.reasonEmpty);
  await expect(d.getByRole("textbox", { name: "理由" })).toHaveAttribute("aria-invalid", "true");
  expect(calls, "口は呼ばれない").toHaveLength(0);
  expect((await ticketRow(w.late)).due_on, "DB の期限はそのまま").toBe(jst(-1));
  await d.getByRole("textbox", { name: "理由" }).fill("先方の入金の確認待ちで 1 日待ちます");
  const res = answered(page, "PATCH", TICKET_RE);
  await d.getByRole("button", { name: /^\d{2}\/\d{2} にする$/ }).click();
  const r = await res;
  expect(r.status(), "期限の口が受ける").toBe(200);
  expect(r.request().postDataJSON(), "体に期限・理由・今の期限が入る").toMatchObject({
    due_on: today,
    expected_due_on: jst(-1),
  });
  await expect(page.getByText(MSG.changedTo(md(today)))).toBeVisible();
  await expect(page.getByRole("img", { name: MSG.flame }), "炎が消える（詳細の読み直し）").toHaveCount(0);
  expect((await ticketRow(w.late)).due_on, "DB の期限が変わっている").toBe(today);
  expect(await changeLines(), "やり取りに変更の行がちょうど 1 つ増える（K-483：変更の 1 行）").toBe(linesBefore + 1);
});

test("K594-M4-03 札が減る：期限を変えた後、一覧の札「期限切れ」は 1 に減り、「今日まで」は 1 に増える（数は一覧の口の 1 回目の答えから）", async ({
  page,
}) => {
  const w = await world(page, "札");
  await openTicket(page, w.late, `${w.key} 期限切れの一つ目`);
  const { res } = await changeDue(page, "1 日待ちます");
  expect(res.status()).toBe(200);
  await page.goto("/tickets");
  await expect(card(page, "期限切れ"), "2 → 1").toContainText("1");
  await expect(card(page, "期限切れ")).not.toContainText("2");
  await expect(card(page, "今日まで"), "0 → 1").toContainText("1");
  await card(page, "期限切れ").click();
  await expect(
    page.getByRole("row").filter({ hasText: `${w.key} 期限切れの二つ目` }),
    "札で絞ると残りの 1 枚だけ",
  ).toHaveCount(1);
  await expect(
    page.getByRole("row").filter({ hasText: `${w.key} 期限切れの一つ目` }),
    "期限を変えた方は出ない",
  ).toHaveCount(0);
});

test("K594-M4-04 カレンダー：期限を変えたチケットが、新しい日のセルにリンクで出て、押すと詳細へ移る。期限が決まっていないものの列は変わらない", async ({
  page,
}) => {
  const w = await world(page, "月");
  await openTicket(page, w.late, `${w.key} 期限切れの一つ目`);
  expect((await changeDue(page, "今日に直します")).res.status()).toBe(200);
  await page.goto(`/tickets?view=calendar&scope=${w.scope}`);
  await expect(page.getByRole("link", { name: "カレンダー", exact: true }), "タブの印").toHaveAttribute(
    "aria-current",
    "page",
  );
  const item = page.getByRole("link").filter({ hasText: `${w.key} 期限切れの一つ目` });
  await expect(item, "新しい日のセルに 1 つ").toHaveCount(1);
  await expect(item).toHaveAttribute("href", `/tickets/${w.late}`);
  await item.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/tickets/${w.late}`);
});

test("K594-M4-05 ガント：期限を変えたチケットの行が、新しい期限の棒つきで出る。期限が決まっていない 1 枚は「開始・期限が無い」の小窓に出る", async ({
  page,
}) => {
  const w = await world(page, "ガント");
  const none = await ticketFor(page, w.me, { title: `${w.key} 期限なし`, dueDays: null });
  await openTicket(page, w.late2, `${w.key} 期限切れの二つ目`);
  expect((await changeDue(page, "二日待ちます")).res.status()).toBe(200);
  await page.goto(`/tickets?view=gantt&scope=${w.scope}`);
  await expect(page.getByRole("link", { name: "ガント", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(`${w.key} 期限切れの二つ目`).first(), "期限を変えたチケットの行").toBeVisible();
  await page.getByRole("button", { name: /^開始・期限が無い \d+ 件$/ }).click();
  await expect(page.getByText(`${w.key} 期限なし`).first(), "期限が決まっていないものは小窓に出る").toBeVisible();
  expect((await ticketRow(none)).due_on).toBeNull();
});

test("K594-M4-06 親の期限を超える変更は断られる：子の期限を親より後にしようとすると口が 409 で断り、小窓は開いたまま・DB の期限は変わらない（口が最後の砦）", async ({
  page,
}) => {
  const w = await world(page, "親子");
  const parent = await ticketFor(page, w.me, { title: `${w.key} 親`, dueDays: 5 });
  const child = await ticketFor(page, w.me, { title: `${w.key} 子`, parent, dueDays: 4 });
  await openTicket(page, child, `${w.key} 子`);
  await page.getByRole("button", { name: "期限を変える", exact: true }).click();
  const d = page.getByRole("dialog", { name: "期限を変える" });
  // 小窓の格子が開く月は「今の期限（+4 日）の月」（K-484：今の期限が今日以後ならその日の月）。月末の 4 日間は +4 日がもう翌月なので、
  // 押すかどうかは「+9 日の月」を「開いている月（+4 日の月）」と比べて決める（今日の月と比べると、月末だけ翌々月へ進んで落ちる）
  const after = new Date(`${jst(9)}T00:00:00Z`);
  const opened = new Date(`${jst(4)}T00:00:00Z`);
  if (after.getUTCMonth() !== opened.getUTCMonth())
    await d.getByRole("button", { name: "次の月", exact: true }).click();
  await d.getByRole("button", { name: `${after.getUTCMonth() + 1}月${after.getUTCDate()}日`, exact: true }).click();
  await d.getByRole("textbox", { name: "理由" }).fill("親より後にしたい");
  const res = answered(page, "PATCH", TICKET_RE);
  await d.getByRole("button", { name: /^\d{2}\/\d{2} にする$/ }).click();
  const r = await res;
  expect(r.status(), "親の期限を過ぎるので断る").toBe(409);
  await expect(d, "小窓は開いたまま").toBeVisible();
  expect((await ticketRow(child)).due_on, "DB の期限は変わらない").toBe(jst(4));
});
