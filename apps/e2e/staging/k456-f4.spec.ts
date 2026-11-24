// K-456 統合テスト（段 5・F4）：登録した人が、作る面でチケットを作る（K-442）→ 本文を直す（K-447）→ 確認項目を足してチェックする（K-450）→ 複製する（K-446）→ 親・つながりを決める
//   （K-443・K-452）→ 版と差分の頁で本文を戻す（K-449）→ 完了にする（K-572）を、staging（本番と同じ形・D-128.144）の上で端から端まで通す。AI と PC は使わない（段 5 は AI を呼ばない）。
//   中の分岐は単体（K-430〜K-453・K-458・K-560〜K-579）と中間テスト（K-454・K-455）が開発の環境で持つ。ここで見るのは 2 つだけ：
//   ① 作る → 直す → 確認項目 → 複製 → 親・つながり → 版を戻す → 完了 が、本物のメールで入った 1 人の上で、別の住所の口と画面でつながること
//   ② staging でしか出ないもの（口と画面が別の住所でログインの印が通る・接続の束ね役ごしの会社の分け：別の会社の人は、このチケットを開けず、親・つながり・複製の元にも選べない）。
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204・K-65 と同じ）。「できた」はその回の JUnit の記録で決める。チケットの CI（枝）では流れない。
//   ★会社が足す項目（custom_fields）のマスタは作る画面が段 10 まで無く、staging では DB を書けないので、この通しは会社の項目を押さない（K456-STG-03・チケットの judge-skip に訳）。
//   ★試験のための抜け道を作らない：page.route を使わない・製品に試験用の分かれ道を足さない・DB は読みも書きもしない（確かめは画面・同じブラウザからの口の読み直し・
//     Resend の記録だけ）・固定の待ちを置かない。★記録に出さない：住所・宛先・確認のリンク・鍵・パスワード・認証アプリの鍵（_lib/scrub-reporter.ts が伏せ直す）。
//   人は steps.ts の person（宛先は Resend の試験用・名前に「統合テスト」・その回のパスワード）。2 段階は画面で付ける（_lib/auth-steps.ts の throughTwoFactor）。
//   試験が作った人・会社・チケットは staging に残す（名前に「統合テスト」）。1 回の通しで登録 2 人・メールは 4 通前後（無料の枠は 1 日 100 通）。
//   行 ID（K456-STG-NN）を試験の名前の頭に持つ。03（会社の項目）と 04（外のサービスが落ちる）は staging では作れないので試験を持たない（チケットの judge-skip）。
//   ★完了にするために段を作業中にする口（段 7 の K-387）は同じ口を同じブラウザから呼ぶ（_lib/f4-steps.ts の startDoing）。段 7 が入っていない staging では赤になる（緑と言わない）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。直すのは道具（_lib）と設定の側
import { expect, test, type Page } from "@playwright/test";
import { enterWithTwoFactor, nthMailTo } from "./_lib/auth-steps";
import {
  addSpec,
  appendAndFinish,
  bodyOf,
  completeNow,
  duplicateOnDetail,
  execBand,
  goVersions,
  linkCandidates,
  linkKinds,
  linkRow,
  openLinkDialog,
  openTicket,
  parentCandidates,
  parentChip,
  readBody,
  restoreBody,
  setParentOnDetail,
  showLinks,
  showSpecs,
  specBox,
  specsRead,
  startDoing,
  stateOf,
  submitLink,
  toggleSpec,
} from "./_lib/f4-steps";
import { verifyLink } from "./_lib/resend";
import { createTicket, person, readAs, submitSignup, type Person } from "./_lib/steps";

/** 文言（K-442〜K-452・K-572 の md・画面の試験・errors.json の正本から。実装から書かない） */
const MSG = {
  notFound: "見つかりませんでした。消されたか、見る権限が無いかもしれません", // E-PAGE-001
  completed: "完了しました", // K-63 の帯
} as const;
const BODY = { purpose: "先方に出す見積のたたき台を作って送る", done: "先方が見積を受け取った", todo: "見積を作る" };
/** 02 が 01 の会社のチケットを開こうとするため、01 のチケットの id を渡す（同じ働き手の中だけ・書き出さない） */
const shared: { id01: string | null } = { id01: null };

/** 登録の画面 → Resend の記録の確認のメールのリンク →（2 段階）→ /tickets */
async function signUp(page: Page, p: Person): Promise<void> {
  expect(await submitSignup(page, p), "登録の口が受ける").toBe(201);
  const link = verifyLink(await nthMailTo(p.email, 1));
  expect(link, "確認のメールにリンクがある").not.toBeNull();
  await enterWithTwoFactor(page, link!, p);
}

test("K456-STG-01 F4 の通し：作る面で作る → 本文を直す → 確認項目を足してチェックする → 複製する → 親・つながりを決める → 版を戻す → 完了にする（本物のメールで入った 1 人・口の読み直しで確かめる）", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const a = person("k456-01");
  await signUp(page, a);
  const title = "見積を送る 統合テスト k456-01";
  const id = await createTicket(page, a, title, BODY);
  shared.id01 = id;
  // ① 本文を直す：字を足して書き終える → 版が 1 つ増える（口の読み直しで確かめる）
  const v1 = await bodyOf(page, id);
  expect(v1.version, "作った直後は版 1").toBe(1);
  expect(v1.text, "作る面で書いた本文が入っている").toContain(BODY.purpose);
  expect(await appendAndFinish(page, "（控えを残す）"), "本文を書き終える口が受ける").toBe(200);
  const v2 = await bodyOf(page, id);
  expect(v2.version, "版 2").toBe(2);
  expect(v2.text, "足した字が入った本文").toContain("（控えを残す）");
  await expect(readBody(page)).toContainText("（控えを残す）");
  // ② 確認項目を足してチェックする：口の読み直しに出て、チェックが付く
  const spec = "送る前に文面を目で見る 統合テスト k456-01";
  await showSpecs(page);
  expect(await addSpec(page, spec), "確認項目を足す口が受ける").toBe(201);
  expect(
    (await specsRead(page, id)).map((s) => s.title),
    "口の読み直しに足した項目が出る",
  ).toContain(spec);
  expect(await toggleSpec(page, spec), "チェックを付ける口が受ける").toBe(200);
  await expect(specBox(page, spec)).toBeChecked();
  expect((await specsRead(page, id)).find((s) => s.title === spec)?.checked, "口の読み直しでチェックが付いている").toBe(
    true,
  );
  // ③ 複製する：元へのつながり・本文・確認項目が写る（チェックは外れる）。元は変わらない
  const dupTitle = "複製した見積 統合テスト k456-01";
  const dup = await duplicateOnDetail(page, dupTitle);
  expect(dup.status, "複製の口（作る口）が受ける").toBe(201);
  expect(dup.id).not.toBe(id);
  expect(await linkKinds(page, dup.id), "元へのつながり（派生元）が残る").toContain("derived_from");
  expect(await bodyOf(page, dup.id), "本文（直した版）が写る・複製は版 1").toEqual({ version: 1, text: v2.text });
  expect(
    (await specsRead(page, dup.id)).find((s) => s.title === spec),
    "確認項目が写り、チェックは外れる",
  ).toEqual({ title: spec, checked: false });
  expect(await bodyOf(page, id), "元は変わらない").toEqual(v2);
  // ④ 親：複製の詳細で、親を元にする（複製の期限は元と同じ日で、親の期限より後ではないので通る）
  expect(await setParentOnDetail(page, "k456-01", title), "親を決める口（updateTicket）が受ける").toBe(200);
  await expect(parentChip(page).first()).toContainText(title);
  expect((await stateOf(page, dup.id)).parent, "口の読み直しで親が元").toBe(id);
  // ④ つながり：別のチケットを作り、元の詳細で関連をつなぐ。元の詳細の子チケットに複製が出る
  const third = "つなぐ先 統合テスト k456-01";
  await createTicket(page, a, third, BODY);
  await openTicket(page, id, title);
  await showLinks(page);
  await expect(linkRow(page, dupTitle), "複製は元の子チケットに出る").toBeVisible();
  const d = await openLinkDialog(page, "関連", "k456-01", third);
  expect(await submitLink(page, d), "つながりを足す口が受ける").toBe(201);
  await expect(linkRow(page, third)).toContainText("関連");
  expect(await linkKinds(page, id), "口の読み直しに関連が出る").toContain("related");
  // ⑤ 版を戻す：版と差分の頁で本文を版 1 に戻す → 新しい版 3 が足され、中身は版 1・確認項目と複製は変わらない
  await goVersions(page, id);
  expect(await restoreBody(page, 1), "戻す口が受ける").toBeLessThan(300);
  expect(await bodyOf(page, id), "版 3・中身は版 1").toEqual({ version: 3, text: v1.text });
  expect(
    (await specsRead(page, id)).map((s) => s.title),
    "本文を戻しても確認項目は変わらない",
  ).toContain(spec);
  expect(await bodyOf(page, dup.id), "複製は変わらない").toEqual({ version: 1, text: v2.text });
  // ⑥ 完了にする：段を作業中にして「完了にする」。本文にチェックの箱が無く確認項目も付いているので小窓なしで完了する
  await openTicket(page, id, title);
  expect(await startDoing(page, id), "段を作業中にする口が受ける").toBeLessThan(300);
  await openTicket(page, id, title);
  expect(await completeNow(page), "完了の口が受ける").toBeLessThan(300);
  await expect(execBand(page)).toContainText(MSG.completed);
  expect((await stateOf(page, id)).completed, "口の読み直しで完了").toBe(true);
});

test("K456-STG-02 会社の分け：別の会社の人は、01 のチケットを口と画面で開けず、自分の親・つながり・複製の元の候補にも出ない（接続の束ね役ごしに会社が分かれる）", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  expect(shared.id01, "01 が先に通ってチケットを作っている").not.toBeNull();
  const b = person("k456-02");
  const pb = await (await browser.newContext()).newPage();
  await signUp(pb, b);
  const parentTitle = "他社の親 統合テスト k456-02";
  const childTitle = "他社の子 統合テスト k456-02";
  await createTicket(pb, b, parentTitle, BODY);
  const mine = await createTicket(pb, b, childTitle, BODY);
  // 口と画面：01 の会社のチケットは「無い」答え（存在を漏らさない）
  const other = await readAs(pb, `/tickets/${shared.id01}`);
  expect([403, 404], "ほかの会社のチケットは読めない").toContain(other.status);
  expect(JSON.stringify(other.data ?? null)).not.toContain("k456-01");
  await pb.goto(`/tickets/${shared.id01}`);
  await expect(pb.getByText(MSG.notFound)).toBeVisible();
  // 親の候補：自分の会社の親は出る・01 の会社のチケットは出ない
  await openTicket(pb, mine, childTitle);
  const parents = await parentCandidates(pb, "統合テスト", parentTitle);
  await expect(parents.hits).toBeVisible();
  await expect(
    parents.dialog.getByRole("radio", { name: /k456-01/ }),
    "ほかの会社のチケットは親の候補に出ない",
  ).toHaveCount(0);
  await parents.dialog.getByRole("button", { name: "やめる", exact: true }).click();
  await expect(parents.dialog).toHaveCount(0);
  // つながりの候補：同じ
  await showLinks(pb);
  const links = await linkCandidates(pb, "統合テスト");
  await expect(links.items.filter({ hasText: parentTitle })).toBeVisible();
  await expect(links.items.filter({ hasText: "k456-01" }), "ほかの会社のチケットはつながりの候補に出ない").toHaveCount(
    0,
  );
  await links.dialog.getByRole("button", { name: "やめる", exact: true }).click();
  // 複製の元の候補（作る面の「過去のチケットから複製」）：同じ
  await pb.goto("/tickets?new=1");
  await pb.getByRole("button", { name: "過去のチケットから複製", exact: true }).click();
  const pick = pb.getByRole("dialog", { name: "過去のチケットから複製", exact: true });
  await pick.getByRole("textbox", { name: "番号か題名で探す", exact: true }).fill("統合テスト");
  await expect(pick.getByRole("radio", { name: new RegExp(parentTitle) })).toBeVisible();
  await expect(
    pick.getByRole("radio", { name: /k456-01/ }),
    "ほかの会社のチケットは複製の元の候補に出ない",
  ).toHaveCount(0);
  await pb.context().close();
});
