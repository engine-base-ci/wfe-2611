// K-922 統合テスト（段 12・F11）：ゲストのグループを作って招く（K-874）→ ゲストが招待のメールから参加して依頼を出す（K-877・K-912）→ 社内が届いた依頼を受けて普通のチケットにする（K-898）→
//   依頼を出したグループに見える（K-913）と、チケットを見せる・外す（K-905）・ゲストのグループを消す（K-928）を、staging（本番と同じ形・D-128.144）の上で端から端まで通す。
//   中の分岐は単体（K-876〜K-913）と中間テスト（K-918・K-920）が開発の環境で持つ。ここで見るのは次の 2 つだけ：
//   ① 招く → 参加する → 依頼を出す → 受ける → 見える が、本物のメール（招待・依頼が届いたの知らせ）と別の住所の口の上で、社内とゲストの 2 つのブラウザでつながること
//   ② staging でしか出ないもの（招待と知らせの本物のメールの到達・ゲストのログインの印が口と画面の別の住所で通る・見せたとき・消したときにゲストへメールが出ないこと）
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204・K-65・K-418 と同じ）。「できた」はその回の JUnit の記録で決める。チケットの CI（枝）では流れない（judge-skip）
//   ★試験のための抜け道を作らない：page.route を使わない・製品に試験用の分かれ道を足さない・DB は読みも書きもしない（確かめは画面・同じブラウザの口の読み直し・Resend の記録だけ）・
//     固定の待ちを置かない。★記録に出さない：住所・宛先・確認と招待のリンク・鍵・パスワード・認証アプリの鍵（_lib/scrub-reporter が伏せる）
//   人は steps.ts の person（宛先は Resend の試験用・名前に「統合テスト」・その回のパスワード）。2 段階は画面で付ける（_lib/handover-steps.ts の throughTwoFactor）
//   試験が作った人・会社・グループ・チケットは staging に残す（名前に「統合テスト」）。1 回の通しで登録 2 人・招待で参加 2 人・メールは 6 通前後（無料の枠は 1 日 100 通）
//   行 ID（K922-STG-NN）を試験の名前の頭に持つ。03（本物の PC の分身が書く間に聞く・案を出す）と 04（外のサービスが落ちる）は staging では作れないので試験を持たない（チケットの judge-skip に訳）
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。直すのは道具（_lib）と設定の側
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createTicketFor, enterWithTwoFactor, nthMailTo, openTicket } from "./_lib/handover-steps";
import {
  acceptOnScreen,
  dueField,
  createGroupOnScreen,
  deleteGroupOnScreen,
  guestInviteLink,
  inviteGuestOnScreen,
  joinAsGuest,
  openGuests,
  openRequestByTitle,
  requestOnScreen,
  shareOnScreen,
  textOf,
  unshareOnScreen,
} from "./_lib/guest-steps";
import { countTo, verifyLink } from "./_lib/resend";
import { person, submitSignup, type Person } from "./_lib/steps";

/** 文言（K-874・K-877・K-898・K-905・K-911〜K-913・K-928 の仕様の表・モック /dev/mock/f11・決定 D-155.41・D-155.42・D-155.45 から。実装から書かない） */
const MSG = {
  portalTitle: /とのやり取り$/,
  sent: "依頼を出しました",
  made: /^チケットを作りました（.+）$/, // 社内の依頼の帯の題（モック CU の「チケットを作りました（EG-131）」・番号は作ったチケットの番号）
  head: "依頼のやり取り",
  notVisible: "この仕事は見られません", // 見せていないチケットを直に開いたとき（NotVisible what="この仕事"）
  noPermission: "このページは見られません", // ゲストでなくなった人の先方の場所（403 は「見られません」の形・K911-UI-014・NotVisible の既定）
  inviteMail: /招待/,
  createdMail: /新しい依頼が届きました/,
} as const;

/** 登録の画面 → Resend の記録の確認のメールのリンク →（2 段階）→ /tickets */
async function signUp(page: Page, p: Person): Promise<void> {
  expect(await submitSignup(page, p), "登録の口が受ける").toBe(201);
  const link = verifyLink(await nthMailTo(p.email, 1));
  expect(link, "確認のメールにリンクがある").not.toBeNull();
  await enterWithTwoFactor(page, link!, p);
}
/** 社内の人がグループを作って招き、Resend の記録の招待のメールのリンクから、別のブラウザで参加させる */
async function invitedGuest(browser: Browser, owner: Page, group: string, guest: Person): Promise<Page> {
  await openGuests(owner);
  expect(await createGroupOnScreen(owner, group), "ゲストのグループを作る口が受ける").toBe(201);
  expect(await inviteGuestOnScreen(owner, group, guest.email), "招く口が受ける").toBe(201);
  const mail = await nthMailTo(guest.email, 1);
  expect(mail.subject, "招待のメールが本当に届く").toMatch(MSG.inviteMail);
  expect(mail.lastEvent ?? "", "送れなかったにならない").not.toMatch(/bounced|failed/);
  return joinAsGuest(browser, guestInviteLink(mail), guest);
}

test("K922-STG-01 招く → 参加 → 依頼 → 受ける → 見える：本物のメールで招いたゲストが先方の場所に入り、画面で依頼を出す → 届け先の社内の人に本物のメールが届き、画面で受けて普通のチケットにする → ゲストに題と札だけの行が出る（期限・担当は出ない）・ゲストにメールは出ない", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const owner = person("k922-01o");
  const guest = person("k922-01g");
  await signUp(page, owner);
  const gp = await invitedGuest(browser, page, "セイコー株式会社（ゲスト）統合テスト k922-01", guest);
  await expect(gp.getByRole("heading", { level: 1 })).toContainText(MSG.portalTitle);
  expect(await gp.locator(".k-shell").count(), "社内の外枠は無い").toBe(0);
  // 依頼を出す
  const ask = "12 月分の作業報告書を作って送ってください 統合テスト k922-01";
  expect(await requestOnScreen(gp, ask), "依頼を出す口が受ける").toBe(201);
  await expect(gp.getByText(MSG.sent, { exact: true })).toBeVisible();
  const notice = await nthMailTo(owner.email, 2);
  expect(notice.subject, "依頼が届いたのメールが本当に届く").toMatch(MSG.createdMail);
  expect(notice.text, "メールにゲストの書いた字を載せない").not.toContain(ask);
  expect(notice.lastEvent ?? "", "送れなかったにならない").not.toMatch(/bounced|failed/);
  // 社内が受ける
  await openRequestByTitle(page, ask); // 題は本文の最初の行（ここでは 1 行なので本文の全部）
  const due = new Date(Date.now() + 9 * 3600_000 + 14 * 86400_000).toISOString().slice(0, 10);
  expect(await acceptOnScreen(page, due), "チケットにする口が受ける").toBe(201);
  await expect(page.getByText(MSG.made, { exact: true })).toBeVisible();
  // ゲストに見える
  await gp.goto("/portal");
  const row = gp.getByRole("link", { name: /12 月分の作業報告書を作って送ってください/ }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("作っている");
  await row.click();
  await expect(gp.getByText(MSG.head, { exact: true })).toBeVisible();
  const seen = await textOf(gp);
  for (const s of [due, "取引先", "検収", "確認してほしいもの"])
    expect(seen, `ゲストの画面に ${s} が出ない`).not.toContain(s);
  expect(seen, "期限の日付（欄に入れた M/D の形）もゲストの画面に出ない").not.toMatch(
    new RegExp(`(?<![0-9])${dueField(due)}(?![0-9])`),
  );
  expect(await countTo(guest.email), "見せてもメールは出ない（招待の 1 通のまま）").toBe(1);
  await gp.context().close();
});

test("K922-STG-02 見せる → 外す → 消す：社内のチケットを画面でゲストのグループに見せるとゲストに見え、やめるとすぐ「見られません」。もう一度見せてからグループを消すと、ゲストはすぐ入れず、チケットは社内に残る", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const owner = person("k922-02o");
  const guest = person("k922-02g");
  const group = "セイコー株式会社（ゲスト）統合テスト k922-02";
  await signUp(page, owner);
  const gp = await invitedGuest(browser, page, group, guest);
  const title = "請求書を送る 統合テスト k922-02";
  const id = await createTicketFor(page, title, owner.name, "11 月分の請求書を作って送る");
  // 見せる前は見えない
  await gp.goto(`/portal/tickets/${id}`);
  await expect(gp.getByText(MSG.notVisible, { exact: true }).first()).toBeVisible();
  // 見せる → 見える
  await openTicket(page, id, title);
  expect(await shareOnScreen(page, group), "見せる口が受ける").toBe(200);
  await gp.goto("/portal");
  await expect(gp.getByRole("link", { name: new RegExp(title) }).first()).toBeVisible();
  await gp.goto(`/portal/tickets/${id}`);
  await expect(gp.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
  // 外す → すぐ見えない
  await openTicket(page, id, title);
  expect(await unshareOnScreen(page), "外す口が受ける").toBe(200);
  await gp.reload();
  await expect(gp.getByText(MSG.notVisible, { exact: true }).first()).toBeVisible();
  // 見せ直してから、グループを消す → ゲストはすぐ入れない・チケットは残る
  await openTicket(page, id, title);
  expect(await shareOnScreen(page, group)).toBe(200);
  expect(await deleteGroupOnScreen(page, group), "消す口が受ける").toBe(200);
  await gp.goto("/portal");
  await expect(
    gp
      .getByText(MSG.notVisible, { exact: true })
      .or(gp.getByRole("heading", { name: /ログイン/ }))
      .or(gp.getByText(MSG.noPermission, { exact: true }))
      .first(),
  ).toBeVisible();
  await openTicket(page, id, title);
  expect(await countTo(guest.email), "見せても外しても消してもメールは出ない（招待の 1 通のまま）").toBe(1);
  await gp.context().close();
});
