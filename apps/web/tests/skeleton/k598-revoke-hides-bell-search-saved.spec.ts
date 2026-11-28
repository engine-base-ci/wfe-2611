// K-598 流れをまたぐテスト（段 8・X2・E1）：権限を外す → 鈴のお知らせ（K-461・K-467）・探す（K-468〜K-470・K-471）・保存した条件（K-475・K-479）に出ない。
//   F10（人と権限の画面）が後から作る流れなので、F7 が受け持つ「見えないものは出ない」を確かめる。F10 の画面はまだ無いので、権限の付け外しは DB に直に行う（段 3 と同じ作法）。
//   中の 1 本 1 本（行の守り・見える範囲の文・口の形）は単体（K-461・K-468〜K-470・K-475 の試験）が持つ。ここは、同じ会社の 2 人目を別のブラウザで持ち、
//   付けた直後は出る → 外した直後は出ない → 付け直すと出る を、鈴・探す・保存した条件の 3 つで揃って見る。
//   1 人目はグループ（根の下に置かない）を作って権限を付け、チケット・決定・お知らせの行・グループに見せた保存した条件を用意する。口は網の手前で差し替えない（届く頭 x-forwarded-for だけを足す）。
//   道具は K-460 が運ぶ _lib/f7-flow.ts を読むだけ。固定の待ちは置かない。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../_lib/api";
import {
  bell,
  bellCount,
  mateOf,
  noteRow,
  noticeBox,
  notesOf,
  openBell,
  searchFor,
  ticketFor,
  type Mate,
} from "../_lib/f7-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { asPerson } from "../_lib/prep";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 98);
});
const mates: Mate[] = [];
test.afterEach(async () => {
  await Promise.all(mates.splice(0).map((m) => m.ctx.close()));
});

const MSG = { notFound: "見つかりませんでした", noHit: (q: string) => `「${q}」に合うものがありません` };
interface World {
  me: Newcomer;
  mate: Mate;
  group: string;
  key: string;
  ticket: string;
  title: string;
  viewName: string;
}
const grant = async (member: string, group: string, tenant: string, ability: "view" | "edit"): Promise<void> => {
  await admin(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, $4)",
    [tenant, member, group, ability],
  );
};
const revoke = (member: string, group: string) =>
  admin("delete from permissions where grantee_member_id = $1 and scope_id = $2", [member, group]);

/** 登録した人（1 人目）と 2 人目と、根の下に無いグループ。1 人目は編集、2 人目は見るだけの権限を付ける。
 *  グループにチケット 1 枚・決定 1 つ・2 人目宛てのお知らせ 1 つ・グループに見せた保存した条件 1 つを用意する */
async function world(page: Page, browser: Parameters<typeof mateOf>[0], tag: string): Promise<World> {
  const me = await newcomer(page, box, tag);
  const mate = await mateOf(browser, me, "権限を外される人");
  mates.push(mate);
  // 2 人の始めの受け箱は空（鈴の数を「ちょうど 1」と置く前提。招待で入る人・最初のログインが新しい端末のお知らせを書くと、ここで原因が分かる）
  expect(await notesOf(me.memberId), "1 人目の始めの受け箱は空").toHaveLength(0);
  expect(await notesOf(mate.memberId), "2 人目の始めの受け箱は空").toHaveLength(0);
  const [t] = await admin<{ t: string }>("select tenant_id as t from members where id = $1", [me.memberId]);
  const key = `ZP${randomUUID().slice(0, 6)}`;
  const [g] = await admin<{ id: string }>(
    "insert into scopes (tenant_id, name, ticket_prefix) values ($1, $2, $3) returning id",
    [t!.t, `経理${key}`, `K${key.slice(2, 4).toUpperCase()}`],
  );
  await grant(me.memberId, g!.id, t!.t, "edit");
  await grant(mate.memberId, g!.id, t!.t, "view");
  const title = `${key} 経理のチケット`;
  const ticket = await ticketFor(page, me, { title, scope: g!.id });
  await admin(
    "insert into ticket_decisions (tenant_id, ticket_id, text, reason, decided_by) values ($1, $2, $3, $4, $5)",
    [t!.t, ticket, `${key} 経理の決めごと`, "理由", me.memberId],
  );
  await noteRow(mate.memberId, "ticket.assigned", { ticket, by: me.memberId });
  const viewName = `${key} 経理の条件`;
  const made = await asPerson(page, me.token, "POST", "/saved_views", {
    name: viewName,
    share: "group",
    scope_id: g!.id,
    filters: { v: 1, view: "all", params: { done: false } },
  });
  expect(made.status, "グループに見せた保存した条件を作る（K-475）").toBe(201);
  return { me, mate, group: g!.id, key, ticket, title, viewName };
}
const viewNames = async (m: Mate): Promise<string[]> => {
  const r = await asPerson(m.page, m.token, "GET", "/saved_views");
  expect(r.status).toBe(200);
  return ((r.data as unknown as { name: string }[] | null) ?? []).map((v) => v.name);
};
const menuLink = (p: Page, name: string) =>
  p.getByRole("navigation", { name: "メニュー", exact: true }).getByRole("link", { name });
const reopen = async (m: Mate): Promise<void> => {
  expect((await m.page.goto("/tickets"))?.status()).toBe(200);
  await expect(m.page.getByRole("heading", { level: 1 })).toBeVisible();
};

test("K598-X2-01 付けた人には出る：見る権限を付けた 2 人目の鈴にお知らせが出て、探すで見つかり、保存した条件が左のメニューと口の一覧に出る", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "付けた");
  await reopen(w.mate);
  expect(await bellCount(w.mate.page), "鈴の数は 1").toBe(1);
  await openBell(w.mate.page);
  await expect(noticeBox(w.mate.page)).toContainText(/書き込み|担当/);
  await w.mate.page.keyboard.press("Escape");
  const found = await searchFor(w.mate.page, `${w.key} 経理`);
  await expect(found.getByRole("link").filter({ hasText: w.title }), "チケットが探すで出る").toHaveCount(1);
  await expect(found.getByRole("link").filter({ hasText: `${w.key} 経理の決めごと` }), "決定も出る").toHaveCount(1);
  expect(await viewNames(w.mate), "保存した条件が口の一覧に出る").toContain(w.viewName);
  await expect(menuLink(w.mate.page, w.viewName), "左のメニューのグループの下に出る").toHaveCount(1);
});

test("K598-X2-02 外した直後は出ない：権限を外すと、2 人目の鈴の数と一覧・探す・保存した条件・チケットの詳細から消える（お知らせの行そのものは DB に残る）", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "外した");
  await reopen(w.mate);
  expect(await bellCount(w.mate.page)).toBe(1);
  await revoke(w.mate.memberId, w.group);
  await reopen(w.mate);
  expect(await bellCount(w.mate.page), "鈴の数が 0 になる").toBe(0);
  await openBell(w.mate.page);
  await expect(noticeBox(w.mate.page), "箱に行が出ない").toContainText("お知らせはまだありません");
  await expect(w.mate.page.getByText(w.title), "題名がどこにも出ない").toHaveCount(0);
  await w.mate.page.keyboard.press("Escape");
  const found = await searchFor(w.mate.page, `${w.key} 経理`);
  await expect(found, "探すに出ない").toContainText(MSG.noHit(`${w.key} 経理`));
  expect(await viewNames(w.mate), "保存した条件が口の一覧に出ない").not.toContain(w.viewName);
  await expect(menuLink(w.mate.page, w.viewName), "左のメニューにも出ない").toHaveCount(0);
  const detail = await asPerson(w.mate.page, w.mate.token, "GET", `/tickets/${w.ticket}`);
  expect(detail.status, "詳細の口は 404（無い／見えないは同じ答え）").toBe(404);
  const rows = await admin<{ n: number }>(
    "select count(*)::int as n from notifications where member_id = $1 and deleted_at is null",
    [w.mate.memberId],
  );
  expect(rows[0]!.n, "お知らせの行は消さない（付け直すと戻る）").toBeGreaterThanOrEqual(1);
});

test("K598-X2-03 付け直すと戻る：権限を付け直すと、同じお知らせ・チケット・保存した条件がまた出る（外している間に消されたものは無い）", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "付け直す");
  const [t] = await admin<{ t: string }>("select tenant_id as t from members where id = $1", [w.me.memberId]);
  await revoke(w.mate.memberId, w.group);
  await reopen(w.mate);
  expect(await bellCount(w.mate.page)).toBe(0);
  await grant(w.mate.memberId, w.group, t!.t, "view");
  await reopen(w.mate);
  expect(await bellCount(w.mate.page), "鈴の数が 1 に戻る").toBe(1);
  expect(await viewNames(w.mate)).toContain(w.viewName);
  const found = await searchFor(w.mate.page, `${w.key} 経理`);
  await expect(found.getByRole("link").filter({ hasText: w.title })).toHaveCount(1);
});

test("K598-X2-04 開いたまま外された：鈴の箱を開いて行を見ている間に権限が外されても、行を押すと見つかりませんに行き、開き直した箱にはその行が無い", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "開いたまま");
  await reopen(w.mate);
  await openBell(w.mate.page);
  const row = noticeBox(w.mate.page)
    .getByRole("link")
    .or(noticeBox(w.mate.page).getByRole("button"))
    .filter({ hasText: /書き込み|担当/ });
  await expect(row).toHaveCount(1);
  await revoke(w.mate.memberId, w.group);
  await row.click();
  await expect(w.mate.page.getByText(MSG.notFound), "押した先は見つかりません").toBeVisible();
  await w.mate.page.goto("/tickets");
  await bell(w.mate.page).click();
  await expect(noticeBox(w.mate.page)).toContainText("お知らせはまだありません");
});

test("K598-X2-05 本人は影響を受けない：2 人目の権限を外しても、1 人目の鈴・探す・保存した条件は同じに出る（外した相手の変化が混ざらない）", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "本人");
  await noteRow(w.me.memberId, "ticket.assigned", { ticket: w.ticket });
  await revoke(w.mate.memberId, w.group);
  await page.goto("/tickets");
  expect(await bellCount(page), "1 人目の鈴の数は自分宛ての 1 つ").toBe(1);
  const found = await searchFor(page, `${w.key} 経理`);
  await expect(found.getByRole("link").filter({ hasText: w.title }), "1 人目はチケットを探せる").toHaveCount(1);
  const mine = await asPerson(page, w.me.token, "GET", "/saved_views");
  expect(JSON.stringify(mine.data), "保存した条件は 1 人目に出る").toContain(w.viewName);
  const detail = await asPerson(page, w.me.token, "GET", `/tickets/${w.ticket}`);
  expect(detail.status, "チケットの詳細も読める").toBe(200);
});
