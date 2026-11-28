// K-920 中間テスト（段 12・M3）：社内で作ったチケットは既定でゲストに見えない → 見せる相手にゲストのグループを選ぶ（K-905）→ グループの全員に見える（K-906・K-913）・受け箱に 1 件（メールなし・K-881）→
//   外すとすぐ見えない → 別のゲストのグループは見えない・見せる前の社内の話は見せても見えない（K-882）→ ゲストのグループを消す（K-927・K-928）と
//   中のゲストはすぐ入れない・チケットは残る（流れをまたぐ E1）を、本物のブラウザ（社内の 1 人とゲスト 2〜3 人）・本物の DB・本物の口でつなぐ。
//   中の 1 本 1 本の分岐は単体の試験（口：apps/api/test/features/F11・画面：apps/web/tests/k）が持つ。ここは「つないだときにだけ出るもの」：
//   画面で選んだ見せる相手が口・DB を通って、ゲストの画面（別のブラウザ）に入り直さずに効くか・外した直後・消した直後に効くか・別のグループに漏れないか・社内の変更が先方に漏れないか。
//   道具は K-918 が持ち込む _lib/f11-flow.ts（guestBySql・groupBySql・callAs ほか）。口は網の手前で差し替えない。使用者の本物の Bridge（38617）には触らない。
//   ゲストは招待の行を置いて受ける口を通す（招く画面・メールの通しは K-918 が持つ）。固定の待ちは置かない。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { expect, test, type Page } from "@playwright/test";
import { PW, admin } from "../_lib/api";
import {
  TICKET_READ_RE,
  answered,
  callAs,
  groupBySql,
  guestBySql,
  inboxCount,
  postTicketMessage,
  requestOnScreen,
  requestsOf,
  sharesOf,
  textOf,
  type Guest,
} from "../_lib/f11-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { ticketOf } from "../_lib/prep";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 93);
});
const guests: Guest[] = [];
test.afterEach(async () => {
  await Promise.all(guests.splice(0).map((g) => g.ctx.close()));
});

/** 文言（K-905・K-913・K-928・K-931 の仕様の表・モック /dev/mock/f11（mb-guest-* は stage9/guest-group-views.tsx）・決定 D-155.41・D-155.45・D-155.46・D-155.55 から。実装から書かない） */
const MSG = {
  sharePanel: "ゲストに見せる", // 右のパネルの区画・見せる小窓の題・「見せる」ボタン
  unshare: "見せるのをやめる",
  decide: "決める",
  notVisible: "この仕事は見られません", // 見せていないチケットを直に開いたとき（NotVisible what="この仕事"・モック /dev/mock/f11 の CP の状態）
  noPermission: "このページは見られません", // ゲストでなくなった人の先方の場所（403 は「見られません」の形・K911-UI-014・NotVisible の既定 what="このページ"）
  expired: "ログインが切れました。", // ゲストの口が 401 のときの期限切れの形（K911-UI-013・E-PAGE-005 の文の頭）
  sharedKind: "ticket.guest_shared",
} as const;
const HOME_RE = /^\/api\/v1\/portal$/; // getPortalHome（K-906）
const SECTIONS = {
  purpose: "11 月分の請求書を作って送る",
  done: "請求書が届いた",
  todo: "- 請求書を作る\n- 送る",
} as const;
const BEFORE = "見せる前の社内の話：値引きは相談中";
const AFTER = "見せたあとの書き込み：請求書を送りました";

interface Ready {
  me: Newcomer;
  gA: string;
  gB: string;
  a1: Guest;
  b1: Guest;
  t: string;
  title: string;
}
/** 社内の 1 人目・ゲストのグループ 2 つ（A・B）にゲスト 1 人ずつ・社内のチケット 1 枚（まだ誰にも見せていない） */
async function ready(page: Page, browser: Parameters<typeof guestBySql>[0], tag: string): Promise<Ready> {
  const me = await newcomer(page, box, tag);
  const gA = await groupBySql(me, `Ａ社 ${tag}`);
  const gB = await groupBySql(me, `Ｂ社 ${tag}`);
  const a1 = await guestBySql(browser, me, gA, `佐野 ${tag}`);
  const b1 = await guestBySql(browser, me, gB, `鈴木 ${tag}`);
  guests.push(a1, b1);
  const title = `請求書を送る 中間12 ${tag}`;
  const t = await ticketOf(page, me, title, SECTIONS);
  return { me, gA, gB, a1, b1, t, title };
}
const openTicket = async (page: Page, id: string, title: string): Promise<void> => {
  expect((await page.goto(`/tickets/${id}`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
};
const panel = (page: Page) => page.getByRole("region", { name: MSG.sharePanel, exact: true });
/** 詳細の右のパネルの「ゲストに見せる」→ 小窓でグループの箱を付けて「決める」。見せる口の答えの番号を返す */
async function shareOnScreen(page: Page, names: string[]): Promise<number> {
  await panel(page)
    .getByRole("button", { name: MSG.sharePanel, exact: true })
    .or(panel(page).getByRole("button", { name: "相手を選ぶ", exact: true }))
    .first()
    .click();
  const d = page.getByRole("dialog", { name: MSG.sharePanel, exact: true });
  for (const n of names) await d.getByRole("checkbox", { name: new RegExp(`^${n}`) }).check();
  const res = answered(page, "PATCH", /^\/api\/v1\/tickets\/[^/]+\/guest-shares$/);
  await d.getByRole("button", { name: MSG.decide, exact: true }).click();
  return (await res).status();
}
/** 「見せるのをやめる」→ 確かめの「見せるのをやめる」。外す口の答えの番号を返す */
async function unshareOnScreen(page: Page): Promise<number> {
  await panel(page).getByRole("button", { name: MSG.unshare, exact: true }).click();
  const res = answered(page, "PATCH", /^\/api\/v1\/tickets\/[^/]+\/guest-shares$/);
  await page.getByRole("alertdialog").getByRole("button", { name: MSG.unshare, exact: true }).click();
  return (await res).status();
}
/** ゲストの画面でそのチケットを開く。読む口の答えの番号を返す */
async function guestOpens(g: Guest, id: string): Promise<number> {
  const read = answered(g.page, "GET", TICKET_READ_RE);
  await g.page.goto(`/portal/tickets/${id}`);
  return (await read).status();
}
const homeHas = async (g: Guest, title: string): Promise<boolean> => {
  const read = answered(g.page, "GET", HOME_RE); // 一覧の口の答えを待ってから読む（描かれる前に読むと「出ない」が何も見ずに通る）
  await g.page.goto("/portal");
  expect((await read).status(), "ホームの口が受ける").toBe(200);
  await expect(g.page.getByRole("heading", { level: 1 })).toBeVisible();
  return (await textOf(g.page)).includes(title); // 出ない（false）を見る所が 3 つあるので、部分の字で探す形をやめて画面の字全部で見る
};

test("K920-M3-01 既定は見えない → 見せる → 見える → 外すとすぐ見えない：社内のチケットは既定でゲストに見えない（一覧にも直に開いても）。画面で見せるとグループの人の受け箱に 1 件（メールなし）・外すと送らず・見せ直すとまた 1 件", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m3-01");
  // 既定：見えない
  expect(await homeHas(r.a1, r.title), "一覧に出ない").toBe(false);
  expect(await guestOpens(r.a1, r.t), "直に開いても 404").toBe(404);
  await expect(r.a1.page.getByText(MSG.notVisible, { exact: true }).first()).toBeVisible();
  await openTicket(page, r.t, r.title);
  await expect(panel(page)).toContainText("社内だけ");
  // 見せる（画面）
  expect(await shareOnScreen(page, [`Ａ社 m3-01`]), "見せる口が受ける").toBe(200);
  await expect(panel(page)).toContainText("見せている相手");
  expect((await sharesOf(r.t)).map((x) => x.guest_group_id)).toEqual([r.gA]);
  // 入り直さずにゲストの画面に効く
  expect(await homeHas(r.a1, r.title), "一覧に出る").toBe(true);
  expect(await guestOpens(r.a1, r.t)).toBe(200);
  await expect(r.a1.page.getByRole("heading", { level: 1, name: r.title, exact: true })).toBeVisible();
  await expect.poll(() => inboxCount(r.a1.memberId, MSG.sharedKind), "ゲストの受け箱に 1 件").toBe(1);
  expect(box.mails(r.a1.email, /チケット|見せ/), "メールは出ない").toHaveLength(0);
  // 外す（画面）→ すぐ見えない・知らせは増えない
  await openTicket(page, r.t, r.title);
  expect(await unshareOnScreen(page), "外す口が受ける").toBe(200);
  await expect(panel(page)).toContainText("社内だけ");
  expect(await guestOpens(r.a1, r.t), "外した直後に 404").toBe(404);
  expect(await homeHas(r.a1, r.title)).toBe(false);
  expect(await inboxCount(r.a1.memberId, MSG.sharedKind), "外しても送らない").toBe(1);
  // 見せ直す → また見える・受け箱はもう 1 件
  await openTicket(page, r.t, r.title);
  expect(await shareOnScreen(page, [`Ａ社 m3-01`])).toBe(200);
  expect(await guestOpens(r.a1, r.t)).toBe(200);
  await expect.poll(() => inboxCount(r.a1.memberId, MSG.sharedKind), "見せ直すとまた 1 件").toBe(2);
});

test("K920-M3-02 グループどうしは見えない：A だけに見せると B のゲストには見えない（一覧にも直にも）。A と B の両方に見せると両方に見え、A のゲストの書き込みは B に見えない。B の依頼も A に見えない", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m3-02");
  await openTicket(page, r.t, r.title);
  expect(await shareOnScreen(page, [`Ａ社 m3-02`])).toBe(200);
  expect(await guestOpens(r.a1, r.t)).toBe(200);
  expect(await guestOpens(r.b1, r.t), "B には見えない").toBe(404);
  expect(await homeHas(r.b1, r.title)).toBe(false);
  expect(await inboxCount(r.b1.memberId, MSG.sharedKind), "B に知らせは入らない").toBe(0);
  // 両方に見せる
  await openTicket(page, r.t, r.title);
  expect(await shareOnScreen(page, [`Ｂ社 m3-02`])).toBe(200);
  expect((await sharesOf(r.t)).length, "複数のグループに見せられる").toBe(2);
  expect(await guestOpens(r.b1, r.t)).toBe(200);
  // A のゲストの書き込みは B に見えない
  await guestOpens(r.a1, r.t);
  await r.a1.page.getByLabel("やり取りに書く", { exact: true }).fill("Ａ社だけの書き込み");
  await r.a1.page.getByRole("button", { name: "送る", exact: true }).click();
  await expect(r.a1.page.getByText("Ａ社だけの書き込み", { exact: true })).toBeVisible();
  await guestOpens(r.b1, r.t);
  expect(await textOf(r.b1.page), "別のグループの書き込みは見えない").not.toContain("Ａ社だけの書き込み");
  // B の依頼は A に見えない（依頼もグループ単位）
  const sent = await requestOnScreen(r.b1.page, "Ｂ社の依頼です");
  expect(sent.status).toBe(201);
  const bReq = sent.id!;
  expect(
    (await callAs(r.a1.page, r.a1.token, "GET", `/portal/requests/${bReq}`)).status,
    "A のゲストは B の依頼を読めない",
  ).toBe(404);
  await r.a1.page.goto("/portal");
  expect(await textOf(r.a1.page)).not.toContain("Ｂ社の依頼です");
  expect((await requestsOf(r.gB)).length).toBe(1);
});

test("K920-M3-03 見せる前の社内の話・社内の変更は先方に効かない：見せる前に社内で書いた書き込みは、見せても見えない。見せたあとの書き込みと、ゲストの書き込みは見える。社内が期限・担当を変えても、ゲストの答えにも画面にも出ない", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m3-03");
  expect((await postTicketMessage(page, r.me.token, r.t, BEFORE)).status, "社内の書き込みの口が受ける").toBe(201);
  await openTicket(page, r.t, r.title);
  expect(await shareOnScreen(page, [`Ａ社 m3-03`])).toBe(200);
  expect((await postTicketMessage(page, r.me.token, r.t, AFTER)).status).toBe(201);
  expect(await guestOpens(r.a1, r.t)).toBe(200);
  await expect(r.a1.page.getByText(AFTER, { exact: true })).toBeVisible();
  expect(await textOf(r.a1.page), "見せる前の社内の話は見えない").not.toContain(BEFORE);
  // 社内が期限・担当を変える（ゲストの答えは変わらず、期限・担当の字は出ない）
  const newDue = new Date(Date.now() + 9 * 3600_000 + 30 * 86400_000).toISOString().slice(0, 10);
  await admin("update tickets set due_on = $2::date where id = $1", [r.t, newDue]);
  const read = answered(r.a1.page, "GET", TICKET_READ_RE);
  await r.a1.page.reload();
  const raw = await (await read).text();
  for (const k of ["due_on", "assignee", "priority"]) expect(raw, k).not.toContain(k);
  expect(raw).not.toContain(newDue);
  expect(await textOf(r.a1.page)).not.toContain(newDue);
});

test("K920-M3-04 ゲストのグループを消す（K-927・K-928）：画面の「⋯」→「消す」で消すと、中のゲストは全員すぐ入れない・見せていたチケットから外れる（見せる相手の行が外れる）。チケットと依頼は残る。別のグループは今までどおり", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m3-04");
  const a2 = await guestBySql(browser, r.me, r.gA, "乙の人 m3-04");
  guests.push(a2);
  await openTicket(page, r.t, r.title);
  expect(await shareOnScreen(page, [`Ａ社 m3-04`, `Ｂ社 m3-04`])).toBe(200);
  const sent = await requestOnScreen(r.a1.page, "消す前に出した依頼");
  expect(sent.status).toBe(201);
  expect(await guestOpens(a2, r.t)).toBe(200);
  // 消す（画面：ゲストのタブのグループの行の「⋯」→「消す」→ 確かめ）
  await page.goto("/members");
  await page
    .getByRole("navigation", { name: "メンバーとゲスト", exact: true })
    .getByRole("link", { name: /^ゲスト \d+$/ })
    .click();
  const row = page.locator(".k-inv-group").filter({ hasText: `Ａ社 m3-04` });
  await row.getByRole("button", { name: `Ａ社 m3-04のほかの操作`, exact: true }).click();
  await page.getByRole("menuitem", { name: "消す", exact: true }).click();
  const del = answered(page, "DELETE", /^\/api\/v1\/guest-groups\/[^/]+$/);
  await page.getByRole("alertdialog").getByRole("button", { name: "消す", exact: true }).click();
  expect((await del).status(), "消す口が受ける").toBe(200);
  // 中のゲストは全員すぐ入れない
  for (const g of [r.a1, a2]) {
    const s = await callAs(g.page, g.token, "GET", `/portal/tickets/${r.t}`);
    expect([401, 403], "消えたグループのゲストは読めない").toContain(s.status);
  }
  // 画面でも入れない（入り直さない・ログインし直しもしない）
  await r.a1.page.goto("/portal");
  await expect(
    r.a1.page
      .getByText(MSG.noPermission, { exact: true })
      .or(r.a1.page.getByText(MSG.expired, { exact: true }))
      .first(),
  ).toBeVisible();
  // 見せていたチケットから外れる・チケットと依頼は残る・別のグループは今までどおり
  expect(
    (await sharesOf(r.t)).map((x) => x.guest_group_id),
    "A の見せる相手だけ外れる",
  ).toEqual([r.gB]);
  expect(
    (await requestsOf(r.gA)).map((x) => x.id),
    "依頼は残る",
  ).toContain(sent.id);
  const [t] = await admin<{ n: string }>("select count(*) as n from tickets where id = $1 and deleted_at is null", [
    r.t,
  ]);
  expect(Number(t!.n)).toBe(1);
  expect(await guestOpens(r.b1, r.t), "B は今までどおり見える").toBe(200);
});

/** ゲストのタブの人の行の「⋯」→ 項目 → 確かめの「本人確認して…」。本人確認の小窓が出たらパスワードで通す。口の答えの番号を返す */
async function guestActOnScreen(page: Page, name: string, item: "一時的に止める" | "戻す" | "外す"): Promise<number> {
  await page.goto("/members?tab=guests");
  const row = page.locator(".k-inv-row").filter({ hasText: name });
  await row.getByRole("button", { name: `${name}のほかの操作`, exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
  const op = item === "一時的に止める" ? "suspend" : item === "戻す" ? "resume" : "remove";
  const label =
    item === "一時的に止める" ? "本人確認して止める" : item === "戻す" ? "本人確認して戻す" : "本人確認して外す";
  const re = new RegExp(`^/api/v1/members/[^/]+/${op}$`);
  // 本人確認が要るときは 1 回目が 403（STEP_UP_REQUIRED）。やり直した後の答えを待つ
  const res = page.waitForResponse(
    (x) => x.request().method() === "POST" && re.test(new URL(x.url()).pathname) && x.status() !== 403,
  );
  await page.getByRole("alertdialog").getByRole("button", { name: label, exact: true }).click();
  const step = page.getByRole("dialog", { name: "本人か確かめます", exact: true });
  await expect(step.or(page.locator(".k-toast")).first()).toBeVisible();
  if (await step.isVisible()) {
    await step.getByLabel("パスワード", { exact: true }).fill(PW);
    await step.getByRole("button", { name: "確かめる", exact: true }).click();
  }
  return (await res).status();
}

test("K920-M3-05 ゲストを 1 人だけ止める → 戻す → 外す（K-931・段 11 の K-814・K-848・流れをまたぐ E1）：画面で止めると、その人だけすぐ入れない（同じグループの乙は今までどおり）・出した依頼は残る。戻すと所属は戻る（切ったセッションは戻らない）。外すと入れる所属が無くなり、依頼とやり取りは残り、ゲストのタブから行が消える", async ({
  page,
  browser,
}) => {
  const r = await ready(page, browser, "m3-05");
  const a2 = await guestBySql(browser, r.me, r.gA, `乙の人 m3-05`);
  guests.push(a2);
  await openTicket(page, r.t, r.title);
  expect(await shareOnScreen(page, [`Ａ社 m3-05`])).toBe(200);
  const sent = await requestOnScreen(r.a1.page, "止める前に出した依頼");
  expect(sent.status).toBe(201);
  // 止める（画面）→ その人だけすぐ入れない
  expect(await guestActOnScreen(page, `佐野 m3-05`, "一時的に止める"), "止める口が受ける").toBe(200);
  await expect(page.locator(".k-inv-row").filter({ hasText: `佐野 m3-05` }).locator(".k-inv-state")).toHaveText(
    "一時的に止まっている",
  );
  const s1 = await callAs(r.a1.page, r.a1.token, "GET", `/portal/tickets/${r.t}`);
  expect([401, 403], "止めたゲストは読めない").toContain(s1.status);
  expect(await guestOpens(a2, r.t), "同じグループの乙は今までどおり").toBe(200);
  expect(
    (await requestsOf(r.gA)).map((x) => x.id),
    "止めても依頼は残る",
  ).toContain(sent.id);
  // 戻す（画面）→ 所属は戻るが、切ったセッションは戻らない（本人は入り直す・K-814）
  expect(await guestActOnScreen(page, `佐野 m3-05`, "戻す"), "戻す口が受ける").toBe(200);
  await expect(page.locator(".k-inv-row").filter({ hasText: `佐野 m3-05` }).locator(".k-inv-state")).toHaveText("");
  const [st] = await admin<{ status: string }>(
    "select status from tenant_memberships where member_id = $1 and deleted_at is null",
    [r.a1.memberId],
  );
  expect(st?.status, "戻した後の所属").toBe("active");
  const s3 = await callAs(r.a1.page, r.a1.token, "GET", `/portal/tickets/${r.t}`);
  expect([401, 403], "切ったセッションは戻らない").toContain(s3.status);
  // 外す（画面）→ 行が消え・所属は抜けた形・依頼とやり取りは残る
  expect(await guestActOnScreen(page, `佐野 m3-05`, "外す"), "外す口が受ける").toBe(200);
  await expect(page.locator(".k-inv-row").filter({ hasText: `佐野 m3-05` })).toHaveCount(0);
  const [left] = await admin<{ n: string }>(
    "select count(*) as n from tenant_memberships where member_id = $1 and deleted_at is null and status = 'active'",
    [r.a1.memberId],
  );
  expect(Number(left!.n), "外したゲストは入れる所属を持たない").toBe(0);
  expect(
    (await requestsOf(r.gA)).map((x) => x.id),
    "外しても依頼は残る",
  ).toContain(sent.id);
  expect(await guestOpens(a2, r.t), "乙は今までどおり").toBe(200);
});
