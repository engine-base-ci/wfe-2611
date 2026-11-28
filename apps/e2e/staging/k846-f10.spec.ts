// K-846 統合テスト（段 11・F10）：招く → 送り直す → 取り消す → 止める → 戻す・役割を変える → 外す・顔の写真とロゴ・メールを変える を、
//   staging（本番と同じ形・D-128.144）の上で端から端まで通す。中の分岐は単体（K-800〜K-849）と中間テスト（K-845）が開発の環境で持つ。ここで見るのは 2 つだけ：
//   ① 招待とメールの確かめの本物のメール（関門 C6）・顔とロゴの本物の置き場（関門 C4）が、別の住所の口と画面の上でつながること
//   ② staging でしか出ないもの（止めた・外した人のログインの印が本物の認証の側で切れる・権限を付けた直後に入り直さず効く・接続の束ね役ごしの会社の分け）。
//   書き出しは作らない（D-154.4）ので書き出しの置き場は見ない。
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204・K-65 と同じ）。「できた」はその回の JUnit の記録で決める。チケットの CI（枝）では流れない。
//   ★試験のための抜け道を作らない：page.route を使わない・製品に試験用の分かれ道を足さない・DB は読みも書きもしない（確かめは画面・同じブラウザからの口の読み直し・
//     Resend の記録・置き場の期限つきの住所だけ）・固定の待ちを置かない。★記録に出さない：住所・宛先・招待と確かめのリンク・鍵・パスワード・認証アプリの鍵。
//   人は steps.ts の person（宛先は Resend の試験用・名前に「統合テスト」・その回のパスワード）。2 段階は画面で付ける（鍵は手元に持ち、本人確認の取り直しの 6 けたに使う）。
//   試験が作った人・会社は staging に残す（名前に「統合テスト」）。1 回の通しで登録 4 人・招待で参加 2 人・メールは 14 通前後（無料の枠は 1 日 100 通）。
//   行 ID（K846-STG-NN）を試験の名前の頭に持つ。05（期限切れ）・06（外のサービスが落ちる）・07（戻した人の入り直し・30 日の招き直し）は試験を持たない（チケットの judge-skip）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。直すのは道具（_lib）と設定の側
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  changeRole,
  emailConfirmLink,
  enterKeepingKey,
  fetchStored,
  memberRow,
  notice,
  openAccount,
  openFromMore,
  openMembers,
  PNG_SIGNATURE,
  pressWithStepUp,
  REMOVE_RE,
  removeButton,
  requestEmailOnScreen,
  resendInvite,
  resetAvatarOnScreen,
  RESUME_RE,
  resumeButton,
  revokeInvite,
  suspendButton,
  SUSPEND_RE,
  uploadAvatarOnScreen,
  uploadLogoOnScreen,
} from "./_lib/f10-steps";
import {
  createTicketFor,
  enterWithTwoFactor,
  inviteLink,
  inviteOnScreen,
  joinByInvite,
  nthMailTo,
} from "./_lib/handover-steps";
import { countTo, latestTo, readMail, verifyLink } from "./_lib/resend";
import { person, readAs, submitSignup, type Person } from "./_lib/steps";

/** 文言（K-809・K-818・K-821・K-822・K-839・K-840 の仕様の表・モック /dev/mock/f10・K-423 の招待の画面から。実装から書かない） */
const MSG = {
  resent: (email: string): string => `${email} に招待を送り直しました。7 日のあいだ入れます`,
  revoked: (email: string): string => `${email} への招待を取り消しました`,
  inviteGone: "この招待は見つかりません",
  inviteRevoked: "この招待は取り消されています",
  suspended: (p: Person): string => `${p.name} を一時的に止めました`,
  suspendedBand: "一時的に止まっています",
  resumed: (p: Person): string => `${p.name} を戻しました`,
  role: (p: Person): string => `${p.name}の役割を マネージャー にしました`,
  removed: (p: Person, heir: Person): RegExp =>
    new RegExp(`^${p.name} さんを外しました。担当のチケット 1 件は ${heir.name} さんに移りました`),
  emailChanged: "メールを変えました",
  emailUsed: "このリンクはもう使いました",
} as const;
/** 会社の分けを見るため、02 で外した人の id を 03 に渡す（同じ働き手の中だけ・書き出さない） */
const shared: { removedOf02: string | null } = { removedOf02: null };

/** 登録の画面 → 確認のメールのリンク → 2 段階を付ける → /tickets。鍵を返す */
async function signUpKeepingKey(page: Page, p: Person): Promise<string> {
  expect(await submitSignup(page, p), "登録の口が受ける").toBe(201);
  const link = verifyLink(await nthMailTo(p.email, 1));
  expect(link, "確認のメールにリンクがある").not.toBeNull();
  return enterKeepingKey(page, link!, p);
}
/** 招く人の画面で招き、招待のメールのリンクから、別のブラウザで参加させる */
async function invited(browser: Browser, owner: Page, p: Person): Promise<Page> {
  await inviteOnScreen(owner, p.email, "メンバー");
  const link = inviteLink(await nthMailTo(p.email, 1));
  expect(link, "招待のメールに招待のリンクがある").not.toBeNull();
  const page = await (await browser.newContext()).newPage();
  await joinByInvite(page, link!, p);
  return page;
}
const meStatus = async (page: Page): Promise<number> => (await readAs(page, "/me")).status;

test("K846-STG-01 招く → 送り直す → 取り消す → 止める → 戻す：本物の招待のメールで、送り直すと前のリンクが使えなくなり、取り消した招待は開けず、止めた人のログインの印は本物の認証の側ですぐ切れ、戻しても印は戻らない", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const a = person("k846-01a");
  const b = person("k846-01b");
  const c = person("k846-01c");
  const keyA = await signUpKeepingKey(page, a);

  // 招く → 送り直す（前のリンクは使えなくなる・期限が新しく 7 日・D-154.35）
  await inviteOnScreen(page, b.email, "メンバー");
  const first = inviteLink(await nthMailTo(b.email, 1));
  expect(first, "1 通目の招待のメールにリンクがある").not.toBeNull();
  expect(await resendInvite(page, b.email), "送り直す口が受ける").toBe(200);
  await expect(notice(page, MSG.resent(b.email))).toBeVisible();
  await expect(memberRow(page, b.email)).toContainText("送り直しました ・ あと 7 日");
  const second = inviteLink(await nthMailTo(b.email, 2));
  expect(second, "2 通目の招待のメールにリンクがある").not.toBeNull();
  expect(second, "送り直したリンクは前のリンクと違う").not.toBe(first);
  const pb = await (await browser.newContext()).newPage();
  expect((await pb.goto(first!))?.status(), "前のリンクの先も画面は開く").toBe(200);
  await expect(pb.getByRole("heading", { name: MSG.inviteGone, exact: true }), "前のリンクは使えない").toBeVisible();
  await joinByInvite(pb, second!, b);

  // 取り消す（取り消した招待のリンクは開けない・メールは 1 通のまま）
  await inviteOnScreen(page, c.email, "メンバー");
  const linkC = inviteLink(await nthMailTo(c.email, 1));
  expect(linkC, "招待のメールにリンクがある").not.toBeNull();
  expect(await revokeInvite(page, c.email), "取り消す口が受ける").toBe(200);
  await expect(notice(page, MSG.revoked(c.email))).toBeVisible();
  await expect(memberRow(page, c.email), "招待中の行が消える").toHaveCount(0);
  const pc = await (await browser.newContext()).newPage();
  expect((await pc.goto(linkC!))?.status()).toBe(200);
  await expect(pc.getByRole("heading", { name: MSG.inviteRevoked, exact: true })).toBeVisible();
  expect(await countTo(c.email), "取り消した人へのメールは招待の 1 通のまま").toBe(1);

  // 止める（止めた直後に、別のブラウザの印が本物の認証の側で切れる・G-12・G-14・D-154.20）
  expect(await meStatus(pb), "止める前は 2 人目の印が通る").toBe(200);
  await openFromMore(page, b, "一時的に止める");
  const stop = await pressWithStepUp(page, suspendButton(page), "POST", SUSPEND_RE, a, keyA);
  expect(stop.status, "止める口が受ける（取り直しのあとも 1 回だけやり直す）").toBe(200);
  await expect(notice(page, MSG.suspended(b))).toBeVisible();
  await expect(page.getByText(MSG.suspendedBand, { exact: true })).toBeVisible();
  expect(await meStatus(pb), "止めた直後、2 人目の印は口に通らない").toBe(401);

  // 戻す（戻しても印は戻らない・入り直し・D-154.33）
  const resume = await pressWithStepUp(page, await resumeButton(page), "POST", RESUME_RE, a, keyA);
  expect(resume.status, "戻す口が受ける").toBe(200);
  await expect(notice(page, MSG.resumed(b))).toBeVisible();
  await expect(page.getByText(MSG.suspendedBand, { exact: true }), "止まっている帯が消える").toHaveCount(0);
  expect(await meStatus(pb), "戻しても、切れた印は戻らない（入り直し）").toBe(401);
});

test("K846-STG-02 役割を変える → 外す：マネージャーにした直後に入り直さず記録を読めるようになり、外すと担当のチケットは選んだ引き継ぎ先にすぐ移って、外した人の印は本物の認証の側ですぐ切れる", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const a = person("k846-02a");
  const b = person("k846-02b");
  const keyA = await signUpKeepingKey(page, a);
  const pb = await invited(browser, page, b);
  const title = "見積を送る 統合テスト k846-02";
  const ticket = await createTicketFor(page, title, b.name, "先方に見積を送る");
  expect((await readAs(page, `/tickets/${ticket}`)).status, "作ったチケットを読める").toBe(200);

  // 役割を変える（権限を付けた直後・入り直さず効く・TP-PERM-05）
  expect((await readAs(pb, "/audit_events")).status, "メンバーは記録を読めない").toBe(403);
  const role = await changeRole(page, b, "マネージャー", a, keyA);
  expect(role.status, "役割を変える口が受ける").toBe(200);
  await expect(notice(page, MSG.role(b))).toBeVisible();
  expect((await readAs(pb, "/audit_events")).status, "マネージャーにした直後、入り直さず記録を読める").toBe(200);

  // 外す（管理者が選んだ引き継ぎ先にすぐ移る・D-154.6・外した人の印はすぐ切れる・D-154.20）
  const removedId = await openFromMore(page, b, "ワークスペースから外す");
  const go = await pressWithStepUp(page, await removeButton(page, b, a), "POST", REMOVE_RE, a, keyA);
  expect(go.status, "外す口が受ける").toBe(200);
  await expect.poll(() => new URL(page.url()).pathname, "外したら /members へ戻る").toBe("/members");
  await expect(notice(page, MSG.removed(b, a))).toBeVisible();
  await openMembers(page);
  await expect(memberRow(page, b.email), "外した人の行が消える").toHaveCount(0);
  const after = (await readAs(page, `/tickets/${ticket}`)).data as {
    assignee?: { display_name?: string } | null;
  } | null;
  expect(after?.assignee?.display_name, "担当者は選んだ引き継ぎ先（受けるを待たない）").toBe(a.name);
  expect(await meStatus(pb), "外した直後、外した人の印は口に通らない").toBe(401);
  expect((await readAs(page, `/members/${removedId}`)).status, "外した人は 1 人の口で読めない").toBe(404);
  shared.removedOf02 = removedId;
});

test("K846-STG-03 顔の写真とロゴ：本物の置き場に置いた PNG を期限つきの住所で読め、文字に戻すと顔の住所が無くなり、別の会社の人はほかの会社のメンバーを読めない", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const d = person("k846-03d");
  expect(await submitSignup(page, d), "登録の口が受ける").toBe(201);
  const link = verifyLink(await nthMailTo(d.email, 1));
  expect(link, "確認のメールにリンクがある").not.toBeNull();
  await enterWithTwoFactor(page, link!, d);

  // 顔の写真（関門 C4・今いる会社だけに効く・D-154.50・D-154.57）
  await openAccount(page);
  expect(await uploadAvatarOnScreen(page), "顔の写真の口が受ける").toBe(201);
  const me = (await readAs(page, "/me")).data as {
    member?: { avatar?: { kind?: string; url?: string | null } };
  } | null;
  expect(me?.member?.avatar?.kind, "読み直すと顔は写真").toBe("image");
  expect(typeof me?.member?.avatar?.url, "顔に期限つきの住所がある").toBe("string");
  const face = await fetchStored(page, me!.member!.avatar!.url!);
  expect(face.status, "置き場から読める").toBe(200);
  expect(face.type, "置いた種類のまま").toMatch(/^image\/png/);
  expect(face.head, "置いた中身のまま（PNG の先頭の印）").toBe(PNG_SIGNATURE);
  await openAccount(page);
  expect(await resetAvatarOnScreen(page), "文字に戻す口が受ける").toBe(201);
  const back = (await readAs(page, "/me")).data as {
    member?: { avatar?: { kind?: string; url?: string | null } };
  } | null;
  expect(back?.member?.avatar?.kind, "読み直すと顔は文字").toBe("text");
  expect(back?.member?.avatar?.url ?? null, "顔の住所は無い").toBeNull();

  // ロゴ（関門 C4・D-154.45）
  expect(await uploadLogoOnScreen(page), "ロゴの口が受ける").toBe(201);
  const ws = (await readAs(page, "/workspace")).data as {
    workspace?: { logo?: { kind?: string; url?: string | null } };
  } | null;
  expect(ws?.workspace?.logo?.kind, "読み直すとロゴは画像").toBe("image");
  const logo = await fetchStored(page, ws!.workspace!.logo!.url!);
  expect(logo.status, "置き場から読める").toBe(200);
  expect(logo.type).toMatch(/^image\/png/);
  expect(logo.head, "置いた中身のまま").toBe(PNG_SIGNATURE);

  // 会社の分け（接続の束ね役ごし・TP-PERM-03）
  expect(shared.removedOf02, "02 で外した人の id を受け取っている（02 が赤ならここも赤）").not.toBeNull();
  const other = await readAs(page, `/members/${shared.removedOf02}`);
  expect(other.status, "ほかの会社のメンバーは 404（在るかどうかも見せない）").toBe(404);
  expect(JSON.stringify(other.data ?? null), "中身に何も載らない").toBe("null");
});

test("K846-STG-04 メールを変える：新しいアドレスにだけ本物の確かめのメールが届き、リンクで変わると古いアドレスに知らせが届き、同じリンクは 2 回目に使えない", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const e = person("k846-04e");
  const next = person("k846-04n").email;
  const keyE = await signUpKeepingKey(page, e);

  // 頼む（本人確認の取り直し・新しいアドレスにだけ送る・D-154.58）
  const asked = await requestEmailOnScreen(page, next, e, keyE);
  expect(asked.status, "メールを変える口が受ける").toBe(201);
  const pending = (await readAs(page, "/me")).data as {
    member?: { email?: string; email_pending?: string | null };
  } | null;
  expect(pending?.member?.email, "リンクを押すまでは今のメールのまま").toBe(e.email);
  expect(pending?.member?.email_pending, "確かめ待ちの新しいアドレス").toBe(next);
  const mail = await nthMailTo(next, 1);
  const link = emailConfirmLink(mail);
  expect(link, "確かめのメールにリンクがある").not.toBeNull();
  expect(`${mail.text}${mail.html}`, "本文に 24 時間と書く（D-154.12）").toContain("24 時間");
  const oldBefore = await countTo(e.email);

  // リンクで変わる（1 回だけ・D-154.77）
  expect((await page.goto(link!))?.status(), "リンクの先が開ける").toBe(200);
  await expect(page.getByRole("heading", { name: MSG.emailChanged, exact: true })).toBeVisible();
  const changed = (await readAs(page, "/me")).data as {
    member?: { email?: string; email_pending?: string | null };
  } | null;
  expect(changed?.member?.email, "ログインのメールが新しいアドレスになる").toBe(next);
  expect(changed?.member?.email_pending ?? null, "確かめ待ちは無くなる").toBeNull();

  // 古いアドレスへの知らせ（リンクなし）・2 回目は使えない
  await expect
    .poll(() => countTo(e.email), { message: "古いアドレスに知らせが届く", timeout: 90_000, intervals: [2_000] })
    .toBeGreaterThan(oldBefore);
  const told = await latestTo(e.email);
  expect(told, "古いアドレスの知らせが記録に在る").not.toBeNull();
  expect(emailConfirmLink(await readMail(told!.id)), "古いアドレスへの知らせにリンクは無い").toBeNull();
  expect((await page.goto(link!))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: MSG.emailUsed, exact: true }), "同じリンクの 2 回目").toBeVisible();
  expect((await readAs(page, "/me")).status, "メールを変えただけでは今の端末は切れない").toBe(200);
  expect(await countTo(next), "新しいアドレスへのメールは確かめの 1 通のまま").toBe(1);
});
