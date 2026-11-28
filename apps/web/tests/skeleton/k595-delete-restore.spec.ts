// K-595 中間テスト（段 8・M5）：消す（K-487 の下見・K-488・K-590 の画面・子と孫の扱いの 3 つ）→ 元に戻す（K-489・消した直後のお知らせの「元に戻す」）を、
//   本物のブラウザ・本物の DB・本物の口でつなぐ。中の 1 本 1 本の分岐（権限・移し先の誤り・3 段・同時・証跡・幅）は単体（K-487〜K-489・K-590 の試験）が持つ。
//   ここはつないだときだけ出るもの：画面の選びが口の問い合わせになり、子・孫と親が DB で期待どおりに動き、戻すと一覧と詳細が別の GET で揃って戻ること。
//   口は網の手前で差し替えない（届く頭 x-forwarded-for だけを足す）。道具は K-460 が運ぶ _lib/f7-flow.ts を読むだけ。
//   30 日の境目は DB の消した時刻を動かす（待たない）。固定の待ちは置かない。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../_lib/api";
import { RESTORE_RE, TICKET_RE, answered, openTicket, ticketFacts, ticketFor, ticketRow } from "../_lib/f7-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { asPerson } from "../_lib/prep";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 95);
});

/** 文言（K-590 の仕様の表・モック f7-delete-* から。実装から書かない） */
const MSG = {
  confirm: "このチケットを消しますか",
  undo: "元に戻す",
  notFound: "見つかりませんでした",
  move: "別の親へ移す",
  cascade: "一緒に消す",
  detach: "親を外して単体にする",
  deleted: (n: string) => `${n} を消しました`,
  restored: (n: string) => `${n} を元に戻しました`,
  tooOld: "E-DEL-042",
};
interface World {
  me: Newcomer;
  key: string;
}
async function world(page: Page, tag: string): Promise<World> {
  return { me: await newcomer(page, box, tag), key: `ZX${randomUUID().slice(0, 6)}` };
}
const listRow = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
/** 詳細の「…」→「消す」→ 確認の小窓まで開く（下見の口の答えを待つ） */
async function openDelete(page: Page) {
  const preview = answered(page, "GET", /^\/api\/v1\/tickets\/[^/]+\/delete-preview$/);
  await page.getByRole("button", { name: "ほかの操作" }).click();
  await page.getByRole("menuitem", { name: "消す", exact: true }).click();
  expect((await preview).status(), "下見の口が受ける").toBe(200);
  const d = page.getByRole("dialog", { name: MSG.confirm });
  await expect(d).toBeVisible();
  return d;
}
/** 小窓の「消す」を押し、消す口の答えを返す（子・孫の扱いを選んだ後に使う） */
const confirmDelete = async (page: Page) => {
  const res = answered(page, "DELETE", TICKET_RE);
  await page.getByRole("dialog").getByRole("button", { name: "消す", exact: true }).click();
  return res;
};
const dbRows = (ids: string[]) =>
  admin<{ id: string; deleted_at: Date | null; parent_ticket_id: string | null }>(
    "select id, deleted_at, parent_ticket_id from tickets where id = any($1::uuid[]) order by created_at, id",
    [ids],
  );

test("K595-M5-01 消す → 元に戻す（子なし）：消すと一覧から消えて詳細は見つかりませんになり、直後のお知らせの「元に戻す」で詳細へ戻り、一覧にもまた出る", async ({
  page,
}) => {
  const w = await world(page, "子なし");
  const title = `${w.key} 消すチケット`;
  const t = await ticketFor(page, w.me, { title });
  const { number } = await ticketFacts(t);
  await openTicket(page, t, title);
  const d = await openDelete(page);
  await expect(d, "子・孫の 3 択は出ない").not.toContainText(MSG.cascade);
  await d.getByRole("textbox", { name: /理由/ }).fill("重複して作ったため");
  expect((await confirmDelete(page)).status(), "消す口が受ける").toBe(200);
  await expect.poll(() => new URL(page.url()).pathname, "消したら一覧へ").toBe("/tickets");
  await expect(page.getByText(MSG.deleted(number))).toBeVisible();
  await expect(listRow(page, title), "一覧に出ない").toHaveCount(0);
  expect((await ticketRow(t)).deleted_at, "DB に消した時刻").not.toBeNull();
  await page.goto(`/tickets/${t}`);
  await expect(page.getByText(MSG.notFound), "開き直すと見つかりません").toBeVisible();
  // 戻す：口を直に呼ぶ（画面の「元に戻す」ボタンの道は K595-M5-02 が持つ。ここは戻した後の見え方を別の GET で見る）
  const back = await asPerson(page, w.me.token, "POST", `/tickets/${t}/restore`, {});
  expect(back.status, "戻す口が受ける").toBe(201);
  await openTicket(page, t, title);
  await page.goto("/tickets");
  await expect(listRow(page, title), "一覧にまた出る（再取得）").toHaveCount(1);
  expect((await ticketRow(t)).deleted_at, "DB の消した時刻が空").toBeNull();
});

test("K595-M5-02 お知らせの「元に戻す」：消した直後に出るお知らせのボタンで戻すと、戻す口が 1 回呼ばれ、そのチケットの詳細へ戻って題名が出る", async ({
  page,
}) => {
  const w = await world(page, "お知らせ");
  const title = `${w.key} お知らせから戻す`;
  const t = await ticketFor(page, w.me, { title });
  const { number } = await ticketFacts(t);
  await openTicket(page, t, title);
  await openDelete(page);
  expect((await confirmDelete(page)).status()).toBe(200);
  await expect(page.getByText(MSG.deleted(number))).toBeVisible();
  const restore = answered(page, "POST", RESTORE_RE);
  await page.getByRole("button", { name: MSG.undo, exact: true }).click();
  expect((await restore).status(), "戻す口が受ける").toBe(201);
  await expect.poll(() => new URL(page.url()).pathname, "詳細へ戻る").toBe(`/tickets/${t}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText(MSG.restored(number))).toBeVisible();
  expect((await ticketRow(t)).deleted_at).toBeNull();
});

test("K595-M5-03 一緒に消す → 戻す：親・子・孫の 3 枚が一緒に消え、親を戻すと 3 枚とも戻り、孫の親は子のまま", async ({
  page,
}) => {
  const w = await world(page, "一緒");
  const parent = await ticketFor(page, w.me, { title: `${w.key} 親` });
  const child = await ticketFor(page, w.me, { title: `${w.key} 子`, parent });
  const grand = await ticketFor(page, w.me, { title: `${w.key} 孫`, parent: child });
  await openTicket(page, parent, `${w.key} 親`);
  const d = await openDelete(page);
  await expect(d, "子・孫がいるので案内と 3 択が出る").toContainText(/子チケット 1 件・孫 1 件/);
  await d.getByText(MSG.cascade, { exact: true }).click();
  expect((await confirmDelete(page)).status()).toBe(200);
  const gone = await dbRows([parent, child, grand]);
  expect(
    gone.every((r) => r.deleted_at !== null),
    "3 枚とも消えた",
  ).toBe(true);
  await page.goto("/tickets");
  for (const n of ["親", "子", "孫"]) await expect(listRow(page, `${w.key} ${n}`), `${n}は一覧に出ない`).toHaveCount(0);
  const back = await asPerson(page, w.me.token, "POST", `/tickets/${parent}/restore`, {});
  expect(back.status).toBe(201);
  expect((back.data as { restored_count?: number } | null)?.restored_count, "戻した数は 3").toBe(3);
  const again = await dbRows([parent, child, grand]);
  expect(
    again.every((r) => r.deleted_at === null),
    "3 枚とも戻った",
  ).toBe(true);
  expect(again.find((r) => r.id === grand)!.parent_ticket_id, "孫の親は子のまま").toBe(child);
  await page.reload();
  await expect(listRow(page, `${w.key} 孫`), "一覧にも孫が戻る").toHaveCount(1);
});

test("K595-M5-04 別の親へ移す → 戻す：子は選んだ親の下へ移り、消した親を戻しても子は移し先のまま（付け替えは戻らない）", async ({
  page,
}) => {
  const w = await world(page, "移す");
  const old = await ticketFor(page, w.me, { title: `${w.key} 消す親` });
  const child = await ticketFor(page, w.me, { title: `${w.key} 移る子`, parent: old });
  const next = await ticketFor(page, w.me, { title: `${w.key} 移し先の親` });
  await openTicket(page, old, `${w.key} 消す親`);
  const d = await openDelete(page);
  await expect(d.getByText(MSG.move, { exact: true }), "初めの選びは別の親へ移す").toBeVisible();
  await expect(d.getByRole("button", { name: "消す", exact: true }), "移し先を選ぶまで押せない").toBeDisabled();
  await d.getByRole("combobox", { name: "親のチケット" }).fill(`${w.key} 移し先`);
  await page.getByRole("option", { name: new RegExp(`${w.key} 移し先の親`) }).click();
  const res = await confirmDelete(page);
  expect(res.status()).toBe(200);
  expect(new URL(res.url()).searchParams.get("children"), "問い合わせに扱いが入る").toBe("move");
  expect(new URL(res.url()).searchParams.get("parent_id"), "移し先が入る").toBe(next);
  expect((await ticketRow(child)).parent_ticket_id, "子は移し先の下").toBe(next);
  expect((await ticketRow(old)).deleted_at).not.toBeNull();
  expect((await asPerson(page, w.me.token, "POST", `/tickets/${old}/restore`, {})).status).toBe(201);
  expect((await ticketRow(child)).parent_ticket_id, "戻しても子は移し先のまま").toBe(next);
});

test("K595-M5-05 親を外して単体にする → 戻す：子は親なしの単体で残り、消した親を戻しても子は単体のまま", async ({
  page,
}) => {
  const w = await world(page, "外す");
  const parent = await ticketFor(page, w.me, { title: `${w.key} 外す親` });
  const child = await ticketFor(page, w.me, { title: `${w.key} 単体になる子`, parent });
  await openTicket(page, parent, `${w.key} 外す親`);
  const d = await openDelete(page);
  await d.getByText(MSG.detach, { exact: true }).click();
  const res = await confirmDelete(page);
  expect(res.status()).toBe(200);
  expect(new URL(res.url()).searchParams.get("children")).toBe("detach");
  expect((await ticketRow(child)).parent_ticket_id, "子は親なし").toBeNull();
  await page.goto("/tickets");
  await expect(listRow(page, `${w.key} 単体になる子`), "子は一覧に残る").toHaveCount(1);
  expect((await asPerson(page, w.me.token, "POST", `/tickets/${parent}/restore`, {})).status).toBe(201);
  expect((await ticketRow(child)).parent_ticket_id, "戻しても単体のまま").toBeNull();
});

test("K595-M5-06 30 日を過ぎたものは戻せない：消した時刻が 30 日より前なら戻す口が 409（E-DEL-042）で断り、消えたまま。29 日 23 時間前なら戻せる", async ({
  page,
}) => {
  const w = await world(page, "30日");
  const late = await ticketFor(page, w.me, { title: `${w.key} 古い` });
  const edge = await ticketFor(page, w.me, { title: `${w.key} 境目` });
  for (const t of [late, edge]) {
    await openTicket(page, t, t === late ? `${w.key} 古い` : `${w.key} 境目`);
    await openDelete(page);
    expect((await confirmDelete(page)).status()).toBe(200);
  }
  await admin("update tickets set deleted_at = now() - interval '30 days 1 hour' where id = $1", [late]);
  await admin("update tickets set deleted_at = now() - interval '29 days 23 hours' where id = $1", [edge]);
  const no = await asPerson(page, w.me.token, "POST", `/tickets/${late}/restore`, {});
  expect(no.status, "30 日を過ぎた物は戻せない").toBe(409);
  expect(no.code).toBe(MSG.tooOld);
  expect((await ticketRow(late)).deleted_at, "消えたまま").not.toBeNull();
  expect((await asPerson(page, w.me.token, "POST", `/tickets/${edge}/restore`, {})).status, "境目の手前は戻せる").toBe(
    201,
  );
  expect((await ticketRow(edge)).deleted_at).toBeNull();
});
