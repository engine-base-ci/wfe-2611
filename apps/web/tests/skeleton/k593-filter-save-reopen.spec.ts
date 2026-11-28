// K-593 中間テスト（段 8・M3）：絞る（K-472〜K-474・K-478）→ 保存する（K-475・K-479）→ 開き直す → 別の人には（グループに見せたもの以外は）見えない（K-476）を、
//   本物のブラウザ・本物の DB・本物の口でつなぐ。2 人目は同じ会社のメンバーを別のブラウザで持つ（_lib/f7-flow.ts の mateOf）。
//   中の 1 本 1 本の分岐（13 欄の絞り・数の札・名前の長さと同名・上限・小窓の誤り・幅）は単体（K-472〜K-479 の試験）が持つ。ここはつないだときだけ出るもの。
//   口は網の手前で差し替えない（届く頭 x-forwarded-for だけを足す）。道具は K-460 が運ぶ _lib/f7-flow.ts を読むだけ。
//   完了のチケットは DB で完了にする（完了の口の道は F5 の試験が持つ）。固定の待ちは置かない。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { admin } from "../_lib/api";
import { SAVED_RE, answered, completeByDb, mateOf, scopeOf, ticketFor, type Mate } from "../_lib/f7-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { asPerson } from "../_lib/prep";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 93);
});
const mates: Mate[] = [];
test.afterEach(async () => {
  await Promise.all(mates.splice(0).map((m) => m.ctx.close()));
});

/** 文言（K-478・K-479 の仕様の表・モック f7-save-dialog・f7-saved-menu から。実装から書かない） */
const MSG = {
  noneMatch: "条件に合うチケットはありません",
  dialog: "検索条件を保存",
  saved: (name: string) => `「${name}」を保存しました`,
  everyone: "全員",
};
interface World {
  me: Newcomer;
  mate: Mate;
  scope: string;
  scopeName: string;
  open: string;
  mine: string;
  done: string;
  key: string;
}
/** 登録した人・2 人目・同じグループの 3 枚（担当が本人で未完了／担当が 2 人目で未完了／担当が本人で完了） */
async function world(page: Page, browser: Parameters<typeof mateOf>[0], tag: string): Promise<World> {
  const me = await newcomer(page, box, tag);
  const mate = await mateOf(browser, me, "同僚の鈴木");
  mates.push(mate);
  const scope = await scopeOf(me.memberId);
  const [s] = await admin<{ n: string }>("select name as n from scopes where id = $1", [scope]);
  const key = `ZF${randomUUID().slice(0, 6)}`;
  const open = await ticketFor(page, me, { title: `${key} 本人の未完了` });
  const mine = await ticketFor(page, me, { title: `${key} 同僚の未完了`, assignee: mate.memberId });
  const done = await ticketFor(page, me, { title: `${key} 本人の完了` });
  await completeByDb(done);
  return { me, mate, scope, scopeName: s!.n, open, mine, done, key };
}
const listUrl = (w: World): string => `/tickets?view=all&scope=${w.scope}`;
const rowOf = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
const menu = (page: Page) => page.getByRole("navigation", { name: "メニュー", exact: true });
const filterByNotDone = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "完了以外", exact: true }).click();
  await expect(page.getByRole("button", { name: "完了以外", exact: true })).toHaveAttribute("aria-pressed", "true");
};
/** 一覧で「完了以外」に絞って、保存の小窓で名前を付けて保存する。保存の口の答えの番号を返す */
async function saveCurrent(page: Page, name: string, share: "self" | "group", w: World): Promise<number> {
  await page.getByRole("button", { name: MSG.dialog, exact: true }).click();
  const d = page.getByRole("dialog", { name: MSG.dialog });
  await d.getByRole("textbox", { name: "名前", exact: true }).fill(name);
  await d.getByText(share === "self" ? "自分だけ" : `${w.scopeName}グループの全員`, { exact: true }).click();
  const res = answered(page, "POST", SAVED_RE);
  await d.getByRole("button", { name: "保存する", exact: true }).click();
  return (await res).status();
}
const viewsFor = async (
  p: Page,
  token: string,
): Promise<{ name: string; share: string; mine: boolean; can_edit: boolean }[]> => {
  const r = await asPerson(p, token, "GET", "/saved_views");
  expect(r.status).toBe(200);
  return (r.data as unknown as { name: string; share: string; mine: boolean; can_edit: boolean }[] | null) ?? [];
};

test("K593-M3-01 絞る：一覧の「完了以外」を押すと、完了したチケットが表から消え、URL に done=false が付く。もう一度押すと戻る", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "絞る");
  await page.goto(listUrl(w));
  await expect(rowOf(page, `${w.key} 本人の完了`), "絞る前は完了も出る").toHaveCount(1);
  await filterByNotDone(page);
  await expect(rowOf(page, `${w.key} 本人の完了`), "完了は消える").toHaveCount(0);
  await expect(rowOf(page, `${w.key} 本人の未完了`)).toHaveCount(1);
  await expect(rowOf(page, `${w.key} 同僚の未完了`)).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get("done"), "URL に絞りが付く（開き直しても同じ）").toBe("false");
  await page.reload();
  await expect(page.getByRole("button", { name: "完了以外", exact: true }), "再読み込みしても押した形").toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(rowOf(page, `${w.key} 本人の完了`)).toHaveCount(0);
  await page.getByRole("button", { name: "完了以外", exact: true }).click();
  await expect(rowOf(page, `${w.key} 本人の完了`), "もう一度押すと戻る").toHaveCount(1);
});

test("K593-M3-02 保存する（自分だけ）：絞った条件に名前を付けて保存すると、口が受け、左のメニューのグループの下に並び、DB と口の読み直しに 1 件ある", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "保存");
  const name = `${w.key} 完了以外`;
  await page.goto(listUrl(w));
  await filterByNotDone(page);
  expect(await saveCurrent(page, name, "self", w), "保存の口が受ける（201）").toBe(201);
  await expect(page.getByText(MSG.saved(name)), "保存したことのお知らせ").toBeVisible();
  await expect(menu(page).getByRole("link", { name }), "左のメニューのグループの下に並ぶ").toHaveCount(1);
  const [row] = await admin<{ share: string; member_id: string; filters: { params?: Record<string, unknown> } }>(
    "select share, member_id, filters from saved_views where tenant_id = (select tenant_id from members where id = $1) and name = $2 and deleted_at is null",
    [w.me.memberId, name],
  );
  expect(row, "DB に 1 件").toMatchObject({ share: "self", member_id: w.me.memberId });
  expect(row!.filters.params, "絞りがそのまま入っている").toMatchObject({ done: false });
  const mine = (await viewsFor(page, w.me.token)).filter((v) => v.name === name);
  expect(mine, "別の GET の読み直しに 1 件").toHaveLength(1);
  // 口の答えは 13 個の鍵を返す（id・scope_id・filters …）。必要な鍵だけを比べる（toEqual は余分な鍵で落ちる）
  expect(mine[0], "作った人の条件・自分のもので直せる").toMatchObject({
    name,
    share: "self",
    mine: true,
    can_edit: true,
  });
});

test("K593-M3-03 開き直す：保存した条件を左のメニューから開くと、同じ絞りで表が出る（aria-current・URL・行）。別の画面から戻っても同じ", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "開き直す");
  const name = `${w.key} 開き直す`;
  await page.goto(listUrl(w));
  await filterByNotDone(page);
  expect(await saveCurrent(page, name, "self", w)).toBe(201);
  await page.goto("/approvals"); // 別の画面へ行ってから
  await page.goto("/tickets");
  const link = menu(page).getByRole("link", { name });
  await expect(link, "開き直した後も左のメニューに在る（再取得）").toHaveCount(1);
  await link.click();
  await expect.poll(() => new URL(page.url()).searchParams.get("done"), "開くと URL に絞りが付く").toBe("false");
  await expect(rowOf(page, `${w.key} 本人の未完了`)).toHaveCount(1);
  await expect(rowOf(page, `${w.key} 本人の完了`), "保存した絞りで完了は出ない").toHaveCount(0);
  await expect(menu(page).getByRole("link", { name }), "開いている条件の印").toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(menu(page).getByRole("link", { name })).toHaveAttribute("aria-current", "page");
});

test("K593-M3-04 別の人には見えない：自分だけで保存した条件は、同じ会社の 2 人目の左のメニューにも口の一覧にも出ない（口を直に読んでも同じ）", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "他人");
  const name = `${w.key} 自分だけ`;
  await page.goto(listUrl(w));
  await filterByNotDone(page);
  expect(await saveCurrent(page, name, "self", w)).toBe(201);
  await w.mate.page.goto(listUrl(w));
  await expect(w.mate.page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(menu(w.mate.page).getByRole("link", { name }), "2 人目の左のメニューに出ない").toHaveCount(0);
  expect(
    (await viewsFor(w.mate.page, w.mate.token)).map((v) => v.name),
    "2 人目の口の一覧に無い",
  ).not.toContain(name);
});

test("K593-M3-05 グループに見せた条件：2 人目の左のメニューに「全員」の札つきで出て開けるが、直す・消すの「…」は作った人にだけ出る。作った人が消すと 2 人目の開き直しから消える", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "全員");
  const name = `${w.key} 全員向け`;
  await page.goto(listUrl(w));
  await filterByNotDone(page);
  expect(await saveCurrent(page, name, "group", w)).toBe(201);
  const m = w.mate.page;
  await m.goto("/tickets");
  const theirs = menu(m).getByRole("link", { name });
  await expect(theirs, "2 人目の左のメニューに出る").toHaveCount(1);
  await expect(menu(m).getByText(MSG.everyone, { exact: true }).first(), "全員向けの札").toBeVisible();
  await expect(menu(m).getByRole("button", { name: `${name}の操作` }), "作った人でない人に「…」は出ない").toHaveCount(
    0,
  );
  const viewed = (await viewsFor(m, w.mate.token)).find((v) => v.name === name);
  expect(viewed, "口の一覧：2 人目は使うだけ").toMatchObject({ share: "group", mine: false, can_edit: false });
  await theirs.click();
  await expect.poll(() => new URL(m.url()).searchParams.get("done")).toBe("false");
  await expect(rowOf(m, `${w.key} 本人の完了`), "2 人目にも同じ絞りで表が出る").toHaveCount(0);
  // 作った人が消す → 2 人目の開き直しから消える（口の答えが決める）
  await menu(page)
    .getByRole("button", { name: `${name}の操作` })
    .click();
  await page.getByRole("menuitem", { name: "消す", exact: true }).click();
  const gone = answered(page, "DELETE", /^\/api\/v1\/saved_views\/[^/]+$/);
  await page.getByRole("dialog").getByRole("button", { name: "消す", exact: true }).click();
  expect((await gone).status(), "消す口が受ける").toBe(200);
  await expect(menu(page).getByRole("link", { name })).toHaveCount(0);
  await m.reload();
  await expect(menu(m).getByRole("link", { name }), "2 人目の開き直しからも消える").toHaveCount(0);
  expect((await viewsFor(m, w.mate.token)).map((v) => v.name)).not.toContain(name);
});

test("K593-M3-06 絞って 0 件：絞りの結果が空でも保存でき、開くと「条件に合うチケットはありません」が出る（保存した条件は口の答えのまま描く）", async ({
  page,
  browser,
}) => {
  const w = await world(page, browser, "空");
  const name = `${w.key} 空の条件`;
  await page.goto(`${listUrl(w)}&assignee_id=${w.mate.memberId}&done=true`);
  await expect(page.getByText(MSG.noneMatch), "同僚の完了は 0 件").toBeVisible();
  expect(await saveCurrent(page, name, "self", w), "0 件でも保存できる").toBe(201);
  await page.goto("/tickets");
  await menu(page).getByRole("link", { name }).click();
  await expect(page.getByText(MSG.noneMatch)).toBeVisible();
  expect(new URL(page.url()).searchParams.get("assignee_id"), "保存した担当者の絞りが付く").toBe(w.mate.memberId);
});
