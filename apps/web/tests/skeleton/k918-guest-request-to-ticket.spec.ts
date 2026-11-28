// K-918 中間テスト（段 12・M1）：ゲストのグループを作って招く（K-874）→ 招待のメールから参加して先方の場所へ入る（K-877・K-875）→ 依頼を出す（K-912）→
//   社内の届いた依頼に出る（K-898）→ 受けて普通のチケットにする（K-894・K-898）→ 依頼を出したグループに見える・依頼のやり取りがチャットの頭に残る（K-913・K-906・K-882）
//   （流れをまたぐ F11 → F4 の 1 行を含む）を、本物のブラウザ（社内の 1 人とゲスト）・本物の DB・本物の口・本物のメール受け箱でつなぐ。
//   中の 1 本 1 本の分岐は単体の試験（口：K-876〜K-910 の apps/api/test/features/F11・画面：K-874〜K-913 の apps/web/tests/k）が持つ。
//   ここは「つないだときにだけ出るもの」を見る：画面で作ったグループと招待がメール・参加・ログインの強さ・先方の場所まで通るか・依頼が届け先の人に知らせとして届き社内の画面に出るか・
//   受けて作ったチケットが「ふつうのチケット」として社内の一覧に並び、依頼を出したグループにだけ（期限・担当を出さずに）見えるか・チャットの頭に依頼のやり取りが残るか・
//   同じグループの別のゲストにも同じ物が見えるか・社内の段の変わりがゲストの札に出るか。
//   口は網の手前で差し替えない（1 人目だけ届く頭 x-forwarded-for を足す）。ゲストの 2 人目以降は招待の行を置いて受ける口を通す（_lib/f11-flow.ts の guestBySql）。
//   メールは試験の受け箱（_lib/mailbox.ts）。固定の待ちは置かない（口の答え・画面・DB の値が変わるのを待つ）。使用者の本物の Bridge（38617）には触らない（PC は使わない）。
//   ★前提：CI の web の組の G59 と同じ（API を試験の受け箱へ・画面は BASE_URL）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, uniqEmail } from "../_lib/api";
import {
  TICKET_MSG_RE,
  TICKET_READ_RE,
  acceptOnScreen,
  dueField,
  answered,
  callAs,
  createGroupOnScreen,
  detailTo,
  guestByLink,
  guestBySql,
  inboxCount,
  inboxKinds,
  inviteGuestOnScreen,
  inviteLinkIn,
  openGuests,
  openRequest,
  requestOnScreen,
  requestsOf,
  sharesOf,
  stageTo,
  textOf,
  ticketRow,
  type Guest,
} from "../_lib/f11-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
// 1 本の上限：登録（画面とメール）・グループと招待の画面・参加・画面の行き来が 1 本に 6〜10 回。CI の台は VM が同時に走るので 120 秒（K-64 と同じ考え）
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context, 91);
});
const guests: Guest[] = [];
test.afterEach(async () => {
  await Promise.all(guests.splice(0).map((g) => g.ctx.close()));
});

/** 文言（K-874・K-877・K-898・K-911〜K-913 の仕様の表・モック /dev/mock/f11・決定 D-155.41・D-155.42・D-155.45 から。実装から書かない） */
const MSG = {
  invited: /招待を送りました/, // 招いた画面の知らせ
  inviteMail: /招待/, // 招待のメールの件名
  portalTitle: /とのやり取り$/, // 先方の場所の見出し（会社の名前＋「とのやり取り」）
  boxRequests: "依頼",
  boxTickets: "見せてもらったチケット",
  sent: "依頼を出しました",
  made: /^チケットを作りました（.+）$/, // 社内の依頼の帯の題（モック CU の「チケットを作りました（EG-131）」・番号は作ったチケットの番号）
  head: "依頼のやり取り", // チャットの頭の札
  fromHere: "ここからチケットのやり取り",
  noPerm: "この画面は「メンバー」です。いまの権限では開けません。見える画面へ戻ります。", // 役割が合わない画面の文（lib/auth/role.tsx の RequireRole・/members の画面の名前は nav の「メンバー」）
  notVisible: "この仕事は見られません", // 見せていないチケットを直に開いたとき（NotVisible what="この仕事"）
  createdMail: /新しい依頼が届きました/, // 届け先の人へのメールの件名（K-907）
} as const;
const GROUP = "セイコー株式会社（ゲスト）";
const ASK = "12 月分の作業報告書を作って送ってください\n宛先は経理部の山田様です";
const SECRET_IN_MAIL = "宛先は経理部の山田様です";
const DETAIL = "請求書は PDF で送ってください"; // 詳細の区画（鍵 detail）に社内が書いた字

interface Ready {
  me: Newcomer;
  group: string; // ゲストのグループの名前
  groupId: string;
}
/** 社内の 1 人目（登録→入る）と、ゲストのグループ 1 つ（画面で作る） */
async function ready(page: Page, tag: string): Promise<Ready> {
  const me = await newcomer(page, box, tag);
  await openGuests(page);
  const group = `${GROUP}${tag}`;
  const groupId = await createGroupOnScreen(page, group);
  return { me, group, groupId };
}
/** 社内の人が招く → ゲストが招待のリンクで参加（画面）。ゲストのブラウザを返す */
async function invitedGuest(page: Page, browser: Browser, r: Ready, name: string): Promise<Guest> {
  await openGuests(page);
  const to = uniqEmail();
  expect(await inviteGuestOnScreen(page, r.group, to), "招く口が受ける").toBe(201);
  const mail = await box.waitFor(to, 1, MSG.inviteMail);
  const g = await guestByLink(browser, inviteLinkIn(mail.text), to, name);
  guests.push(g);
  return g;
}

test("K918-M1-01 招く → 参加：社内の人がゲストのグループを画面で作り、メールで招く → ゲストが招待のリンクから参加 → 先方の場所（外枠の中の見出しと 2 つの箱）へ入る。社内の画面には入れない", async ({
  page,
  browser,
}) => {
  const r = await ready(page, "m1-01");
  const [g] = await admin<{ request_scope_id: string }>("select request_scope_id from guest_groups where id = $1", [
    r.groupId,
  ]);
  expect(g!.request_scope_id, "グループを作るとき依頼が届く社内のグループを決めた").toBeTruthy();
  const guest = await invitedGuest(page, browser, r, "佐野 太郎");
  // 招待の行：役割 requester・ゲストのグループつき・届け先を持たない
  const [inv] = await admin<{
    role_id: string;
    guest_group_id: string | null;
    scope_id: string | null;
    accepted_member_id: string | null;
  }>("select role_id, guest_group_id, scope_id, accepted_member_id from invitations where email = $1", [guest.email]);
  expect(inv).toMatchObject({ role_id: "requester", guest_group_id: r.groupId, scope_id: null });
  expect(inv!.accepted_member_id, "受けた招待は受けた人を持つ（列は accepted_member_id）").not.toBeNull();
  // 先方の場所
  await expect(guest.page.getByRole("heading", { level: 1 })).toContainText(MSG.portalTitle);
  await expect(
    guest.page
      .getByRole("region", { name: MSG.boxRequests, exact: true })
      .or(guest.page.getByRole("heading", { name: MSG.boxRequests, exact: true })),
  ).toBeVisible();
  await expect(guest.page.getByRole("heading", { name: MSG.boxTickets, exact: true })).toBeVisible();
  expect(await guest.page.locator(".k-shell").count(), "社内の外枠（左のメニュー）は無い").toBe(0);
  const seen = await textOf(guest.page);
  for (const s of ["取引先", "検収", "確認してほしいもの"]) expect(seen, s).not.toContain(s);
  // 社内の画面は開けない（入口の 2 層：画面と口）
  await guest.page.goto("/members");
  await expect(guest.page.getByText(MSG.noPerm, { exact: true })).toBeVisible();
  expect((await callAs(guest.page, guest.token, "GET", "/tickets")).status, "ゲストは社内の口を使えない").toBe(403);
  // 社内の人の一覧にゲストは出ない（メンバーのタブの人数にも数えない・D-155.4）
  await page.goto("/members");
  // 一覧が描かれてから読む（描かれる前の空の画面を見て緑にしない）
  await expect(page.getByRole("heading", { name: "メンバー", level: 1, exact: true })).toBeVisible();
  expect(await textOf(page), "ゲストの名前が社内のメンバーの画面のどこにも出ない").not.toContain("佐野 太郎");
});

test("K918-M1-02 依頼を出す → 社内に届く：ゲストが画面で依頼を書いて出す → 届け先の社内の人の受け箱に 1 件・メールはリンクだけ（ゲストの字を載せない）→ 社内の届いた依頼に出る", async ({
  page,
  browser,
}) => {
  const r = await ready(page, "m1-02");
  const guest = await invitedGuest(page, browser, r, "佐野 太郎");
  const sent = await requestOnScreen(guest.page, ASK);
  expect(sent.status, "依頼を出す口が受ける").toBe(201);
  await expect(guest.page.getByText(MSG.sent, { exact: true })).toBeVisible();
  const [req] = await requestsOf(r.groupId);
  expect(req).toMatchObject({ id: sent.id, state: "new", guest_group_id: r.groupId });
  expect(req!.body).toBe(ASK);
  expect(req!.title).toBe("12 月分の作業報告書を作って送ってください");
  // 届け先の人（1 人目の社内の人）：受け箱 1 件・メールはリンクだけ
  await expect.poll(() => inboxCount(r.me.memberId, "client_request.created"), "届け先の人の受け箱に 1 件").toBe(1);
  const mail = await box.waitFor(r.me.email, 1, MSG.createdMail);
  expect(mail.text, "メールにゲストの書いた字を載せない").not.toContain(SECRET_IN_MAIL);
  expect(mail.text).toContain(`/requests/${sent.id}`);
  // 社内の届いた依頼
  await openRequest(page, sent.id!, "12 月分の作業報告書を作って送ってください");
  await expect(page.getByText(ASK, { exact: true })).toBeVisible(); // ゲストの書いた本文の全部（2 行目が SECRET_IN_MAIL）
  const seen = await textOf(page);
  expect(seen).not.toContain("取引先");
  expect(seen).toContain(r.group);
  // 出した本人は自分のグループの画面で、自分の依頼が「受付済み」で見える
  await guest.page.goto("/portal");
  await expect(guest.page.getByText("12 月分の作業報告書を作って送ってください", { exact: true })).toBeVisible();
});

test("K918-M1-03 受けて普通のチケット：社内が「チケットを作る」で期限と担当を入れて作る → 依頼は「済み」・チケットは社内の一覧に他と同じように並ぶ（期限・担当あり）・見せる相手に依頼を出したグループが最初から入る → ゲストの受け箱に 1 件（メールなし）", async ({
  page,
  browser,
}) => {
  const r = await ready(page, "m1-03");
  const guest = await invitedGuest(page, browser, r, "佐野 太郎");
  const sent = await requestOnScreen(guest.page, ASK);
  await openRequest(page, sent.id!, "12 月分の作業報告書を作って送ってください");
  const due = new Date(Date.now() + 9 * 3600_000 + 14 * 86400_000).toISOString().slice(0, 10);
  expect(await acceptOnScreen(page, due), "チケットにする口が受ける").toBe(201);
  await expect(page.getByText(MSG.made, { exact: true })).toBeVisible();
  const [done] = await requestsOf(r.groupId);
  expect(done).toMatchObject({ state: "ticketed" });
  expect(done!.ticket_id).not.toBeNull();
  const t = await ticketRow(done!.ticket_id!);
  expect(t.due_on, "期限は社内が入れた物").toBe(due);
  expect(t.assignee_member_id, "担当は社内が入れた物").not.toBeNull();
  expect(
    (await sharesOf(t.id)).map((x) => x.guest_group_id),
    "見せる相手は依頼を出したグループが最初から入る",
  ).toEqual([r.groupId]);
  // 社内の一覧：ふつうのチケットとして並ぶ
  await page.goto("/tickets");
  // 一覧は幅で表とカードを出し分ける（隠れている方にも同じ字が在る）。見えている物を見る
  await expect(page.getByText(t.title, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  // ゲストの受け箱に 1 件・メールは出さない
  await expect.poll(() => inboxCount(guest.memberId, "ticket.guest_shared"), "見せたらゲストの受け箱に 1 件").toBe(1);
  expect(box.mails(guest.email, /チケット|見せ/), "ゲストにメールは出ない").toHaveLength(0);
  expect(await inboxKinds(guest.memberId)).toEqual(["ticket.guest_shared"]);
});

test("K918-M1-04 ゲストに見える形：ゲストの場所の「見せてもらったチケット」に題と段の札だけの行が出て、開くと題・本文・詳細・やり取りが見える（チャットの頭に依頼のやり取りが残る・依頼から来た書き込みの札つき）。口の答えにも画面にも期限・担当が出ない", async ({
  page,
  browser,
}) => {
  const r = await ready(page, "m1-04");
  const guest = await invitedGuest(page, browser, r, "佐野 太郎");
  const sent = await requestOnScreen(guest.page, ASK);
  await openRequest(page, sent.id!, "12 月分の作業報告書を作って送ってください");
  const due = new Date(Date.now() + 9 * 3600_000 + 14 * 86400_000).toISOString().slice(0, 10);
  expect(await acceptOnScreen(page, due)).toBe(201);
  const [done] = await requestsOf(r.groupId);
  const t = await ticketRow(done!.ticket_id!);
  const [asg] = await admin<{ display_name: string }>("select display_name from members where id = $1", [
    t.assignee_member_id,
  ]);
  await detailTo(t.id, DETAIL); // 詳細は書く画面が無いので DB で置き、ゲストの画面に出ることを見る
  // ホームの行
  await guest.page.goto("/portal");
  // 依頼の行（「済み」）も同じ題名を持つ。見せてもらったチケットの箱の中の行を見る
  const row = guest.page
    .getByRole("region", { name: MSG.boxTickets, exact: true })
    .getByRole("link", { name: new RegExp(t.title) })
    .first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("作っている");
  // 開く：口の答えを横から読む（page.route で答えを作らない・待つだけ）
  const read = answered(guest.page, "GET", TICKET_READ_RE);
  await row.click();
  const res = await read;
  expect(res.status()).toBe(200);
  const raw = await res.text();
  for (const k of ["due_on", "assignee", "priority", "checks", "decisions", "artifacts"])
    expect(raw, `口の答えに ${k} が無い`).not.toContain(k);
  expect(raw).not.toContain(due);
  await expect(guest.page.getByRole("heading", { level: 1, name: t.title, exact: true })).toBeVisible();
  await expect(guest.page.getByText(MSG.head, { exact: true })).toBeVisible(); // チャットの頭の札
  await expect(guest.page.getByText(MSG.fromHere, { exact: true })).toBeVisible();
  await expect(guest.page.getByText(ASK, { exact: true })).toBeVisible(); // 依頼のやり取りの最初の書き込みの全部（2 行目が SECRET_IN_MAIL）
  await expect(guest.page.getByText("詳細", { exact: true }).first()).toBeVisible();
  await expect(guest.page.getByText(DETAIL, { exact: true })).toBeVisible(); // 詳細の区画の字
  const seen = await textOf(guest.page);
  expect(seen, "期限の日付が画面に出ない").not.toContain(due);
  expect(seen, "期限の日付（欄に入れた M/D の形）も画面に出ない").not.toMatch(
    new RegExp(`(?<![0-9])${dueField(due)}(?![0-9])`),
  );
  expect(seen, "担当者の名前が画面に出ない").not.toContain(asg!.display_name);
  for (const s of ["取引先", "検収", "確認してほしいもの", "担当", "期限"]) expect(seen, s).not.toContain(s);
});

test("K918-M1-05 同じグループの別のゲスト：同じグループの 2 人目（招待の行から入った人）にも、依頼もチケットも同じ物が見える。2 人目がチャットに書くと担当者の受け箱に 1 件・社内の返事（ゲストに見せる）が 1 人目にも見える", async ({
  page,
  browser,
}) => {
  const r = await ready(page, "m1-05");
  const g1 = await invitedGuest(page, browser, r, "佐野 太郎");
  const g2 = await guestBySql(browser, r.me, r.groupId, "鈴木 健太");
  guests.push(g2);
  const sent = await requestOnScreen(g1.page, ASK);
  await openRequest(page, sent.id!, "12 月分の作業報告書を作って送ってください");
  const due = new Date(Date.now() + 9 * 3600_000 + 14 * 86400_000).toISOString().slice(0, 10);
  expect(await acceptOnScreen(page, due)).toBe(201);
  const [done] = await requestsOf(r.groupId);
  const t = await ticketRow(done!.ticket_id!);
  // 2 人目にも依頼とチケットが見える（グループ単位）
  await g2.page.goto("/portal");
  await expect(g2.page.getByText("12 月分の作業報告書を作って送ってください", { exact: true }).first()).toBeVisible();
  await g2.page.goto(`/portal/tickets/${t.id}`);
  await expect(g2.page.getByRole("heading", { level: 1, name: t.title, exact: true })).toBeVisible();
  // 2 人目がチャットに書く → 担当者に知らせが 1 件
  const before = await inboxCount(t.assignee_member_id!, "ticket.message");
  const post = answered(g2.page, "POST", TICKET_MSG_RE);
  await g2.page.getByLabel("やり取りに書く", { exact: true }).fill("宛先は山田様で間違いありません");
  await g2.page.getByRole("button", { name: "送る", exact: true }).click();
  expect((await post).status()).toBe(201);
  await expect
    .poll(() => inboxCount(t.assignee_member_id!, "ticket.message"), "担当者の受け箱に 1 件")
    .toBe(before + 1);
  // 1 人目は開き直すと、2 人目の書き込みが見える
  await g1.page.goto(`/portal/tickets/${t.id}`);
  await expect(g1.page.getByText("宛先は山田様で間違いありません", { exact: true })).toBeVisible();
});

test("K918-M1-06 F11 → F4（流れをまたぐ）：社内が段を変えると、ゲストの札が入り直さずに替わる（作っている → 確認中 → 完了）。見せていないチケットを直に開くと 404・「見られません」で、題も出ない", async ({
  page,
  browser,
}) => {
  const r = await ready(page, "m1-06");
  const guest = await invitedGuest(page, browser, r, "佐野 太郎");
  const sent = await requestOnScreen(guest.page, ASK);
  await openRequest(page, sent.id!, "12 月分の作業報告書を作って送ってください");
  const due = new Date(Date.now() + 9 * 3600_000 + 14 * 86400_000).toISOString().slice(0, 10);
  expect(await acceptOnScreen(page, due)).toBe(201);
  const [done] = await requestsOf(r.groupId);
  const t = await ticketRow(done!.ticket_id!);
  const tone = (label: string) =>
    guest.page
      .getByRole("group", { name: "いまの段", exact: true })
      .locator(`[data-tone="progress"]`)
      .filter({ hasText: label });
  await guest.page.goto(`/portal/tickets/${t.id}`);
  await expect(tone("作っている")).toBeVisible();
  await stageTo(t.id, "checking");
  await guest.page.reload();
  await expect(tone("確認中")).toBeVisible();
  await stageTo(t.id, "done");
  await guest.page.reload();
  await expect(tone("完了")).toBeVisible();
  // 見せていないチケット（同じ会社の別のチケット）は直に開いても見えない
  const [other] = await admin<{ id: string; title: string }>(
    "insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title) select tenant_id, scope_id, 'pending', kind_id, stage_id, '社内だけのひみつの題' from tickets where id = $1 returning id, title",
    [t.id],
  );
  const read = answered(guest.page, "GET", TICKET_READ_RE);
  await guest.page.goto(`/portal/tickets/${other!.id}`);
  expect((await read).status()).toBe(404);
  await expect(guest.page.getByText(MSG.notVisible, { exact: true }).first()).toBeVisible();
  expect(await textOf(guest.page)).not.toContain("社内だけのひみつの題");
});
