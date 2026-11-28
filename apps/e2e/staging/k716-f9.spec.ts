// K-716 統合テスト（段 10・F9）：ナレッジ（会社の棚に書く → 必ず守る → 読むだけの人 → 写して直す）・AI が読んで守る（任せる → 確認項目に入る → やり取りに残る → 完了が止まる →
//   付けて完了 → 破られた数が見直すページに出る）・チケットの設定が作る面に効く（種別・状態・項目）・メンバーをグループごとに見る を、staging（本番と同じ形・D-128.144）の上で端から端まで通す。
//   中の分岐は単体（K-674〜K-720）と中間テスト（K-713・K-714・K-715）が開発の環境で持つ。ここで見るのは 2 つだけ：
//   ① 画面 → 別の住所の口 → 本物の DB → 本物の Bridge の輪（偽の AI）が、2〜3 人のブラウザでつながること
//   ② staging でしか出ないもの（日本語の似たページが本物の DB で見つかる・口と画面が別の住所で 2 人目のログインの印が通る・接続の束ね役ごしの会社の分け）
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204・K-65 と同じ）。「できた」はその回の JUnit の記録で決める。チケットの CI（枝）では流れない。
//   ★グループを作る道が無い（段 11・K-70）ので、グループの棚・上げる・承認・共有・グループの上限は staging では作れない（K716-STG-05・チケットの judge-skip）。
//   ★偽の AI は道具を使わないので、AI がページを開く・チェックを付ける筋は staging では作れない（K716-STG-06・07）。重さの実測は DB を書けないので人が確かめる（K716-H-003）。
//   ★試験のための抜け道を作らない：page.route を使わない・製品に試験用の分かれ道を足さない・DB は読みも書きもしない（確かめは画面・同じブラウザからの口の読み直し・Resend の記録だけ）・固定の待ちを置かない。
//   ★記録に出さない：住所・宛先・確認と招待のリンク・鍵・パスワード・認証アプリの鍵（_lib/scrub-reporter.ts が伏せ直す）。
//   人は steps.ts の person（宛先は Resend の試験用・名前に「統合テスト」・その回のパスワード）。2 段階は画面で付ける（_lib/handover-steps.ts の throughTwoFactor）。
//   試験が作った人・会社・ページ・チケット・設定は staging に残す（名前に「統合テスト」）。1 回の通しで登録 4 人・招待 2 人・メール 10 通前後（無料の枠は 1 日 100 通）。
//   行 ID（K716-STG-NN）を試験の名前の頭に持つ。テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。直すのは道具（_lib）と設定の側
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { FAKE_REPLY_HEAD, stagingPc, type StagingPc } from "./_lib/bridge";
import {
  addField,
  addKind,
  addStage,
  blockedDialog,
  chooseKind,
  completeNow,
  connectPc,
  copyToMine,
  createPlainTicket,
  fieldInput,
  fillCreateBasics,
  groupRow,
  kindsOf,
  openKnowledge,
  openMembers,
  openPage,
  openReview,
  openSettings,
  pageOf,
  renameStage,
  reviewOf,
  shelfOf,
  showSpecs,
  showThread,
  specBox,
  specRowsOf,
  stagesOf,
  startDoing,
  startEdit,
  threadFieldsOf,
  ticketOf,
  toggleMust,
  toggleSpec,
  treeOf,
  typeBody,
  writeAndPublish,
  writeTemplate,
  finishPage,
} from "./_lib/f9-steps";
import { enterWithTwoFactor, inviteLink, inviteOnScreen, joinByInvite, nthMailTo } from "./_lib/handover-steps";
import { verifyLink } from "./_lib/resend";
import { scrub } from "./_lib/scrub.mjs";
import { WEB } from "./_lib/site";
import {
  APPROVE_RE,
  DELEGATE_RE,
  approveBtn,
  clickAndAnswer,
  completeBtn,
  delegateBtn,
  execBand,
  h1,
  pathOf,
  person,
  submitSignup,
  type Person,
} from "./_lib/steps";

/** 文言（K-682〜K-684・K-691・K-693・K-696・K-702・K-703・K-707〜K-710・K-720 の仕様の表と下絵 v2 から。実装から書かない。モックに無い字は仮） */
const MSG = {
  mustLine: /^必ず守る：AI に毎回このページを全部渡します/, // 下絵 kn-must の 1 行
  noAccess: "この画面を見る権限がありません", // E-PAGE-002（K-707・K-708・K-709）
  notSeen: "見られない", // E-PAGE-002 ではなくナレッジの「見られない」（K-682）
  waitingMe: "あなたの承認を待っています", // K-63 の帯
  blockedNote: "これにチェックが付くと、完了にできます。", // K-703 の小窓
  doneBand: /完了しました（.+・\d{1,2}\/\d{1,2} \d{1,2}:\d{2}）/,
  members: /^1 つのグループ ・ \d+ 人。グループを押すと、そのグループのメンバーが出ます$/,
} as const;
/** 時間の上限（ミリ秒）。根拠はチケットの「時間の上限」の表 */
const LIMIT = {
  mailRecord: 90_000,
  firstView: 30_000,
  toApproval: 120_000,
  toExecuted: 120_000,
  breachCounted: 60_000,
} as const;
/** 偽の AI の合図の語（聞いて・消して・長く・落ちて・考えて・成果物にして など）と箇条書きの「- 」の行を入れない（偽の AI の答えを決まった形に保つ） */
const MUST_TEXT = "請求書は月末に締めて、翌月 5 日までに先方へ送ります。送り先は先方の経理の窓口です。";
const SAME_TEXT = "請求書の送り方の補足です。月末に締めた請求書を、翌月 5 日までに先方の経理の窓口へ送ります。";
const T1 = "請求書の送り方 統合テスト k716-01";
const D1 = "請求書を月末に締めて先方の経理へ送るときの決まり";
const T1B = "請求書の送り方 統合テスト k716-01（補足）";

/** 別の試験へ渡す物（同じ働き手の中だけ・書き出さない）。01 が赤なら、それを使う 04 のその確かめも赤になる（緑と言わない） */
const shared: { pageOf01: { id: string; title: string } | null; kindOf03: string | null } = {
  pageOf01: null,
  kindOf03: null,
};

/** 立てた PC と開いたブラウザは、筋の終わりに必ず閉じる（自分で立てた分だけ・G-10）。輪の最後の様子は、伏せてから記録に残す */
const pcs: StagingPc[] = [];
const contexts: BrowserContext[] = [];
test.afterEach(async () => {
  const info = test.info();
  for (const pc of pcs.splice(0)) {
    if (info.status !== info.expectedStatus)
      info.annotations.push({ type: `PC の様子（${pc.label}）`, description: scrub(pc.loopState()) });
    pc.close();
  }
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});
/** 別のブラウザ（cookie も localStorage も別） */
async function device(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: WEB, viewport: { width: 1440, height: 1000 } });
  contexts.push(ctx);
  return ctx.newPage();
}
/** 登録の画面 → Resend の記録の確認のメールのリンク →（2 段階）→ /tickets */
async function signUp(page: Page, p: Person): Promise<void> {
  expect(await submitSignup(page, p), "登録の口が受ける").toBe(201);
  const link = verifyLink(await nthMailTo(p.email, 1));
  expect(link, "確認のメールにリンクがある").not.toBeNull();
  await enterWithTwoFactor(page, link!, p);
}
/** 招く人の画面で招き、Resend の記録の招待のメールのリンクから、別のブラウザで参加させる */
async function invited(browser: Browser, owner: Page, p: Person): Promise<Page> {
  await inviteOnScreen(owner, p.email, "メンバー");
  const link = inviteLink(await nthMailTo(p.email, 1));
  expect(link, "招待のメールに招待のリンクがある").not.toBeNull();
  const page = await device(browser);
  await joinByInvite(page, link!, p);
  return page;
}

test("K716-STG-01 ナレッジ：会社の棚に書く → 似たページの小窓 → 必ず守る → 読むだけの人が読む・写して直す → 管理は管理者だけ", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const a = person("k716-01a");
  const b = person("k716-01b");
  await signUp(page, a);
  const pb = await invited(browser, page, b);

  // 木：会社の棚・自分の棚が出て、管理者は会社の棚に書ける・管理の数を持つ。グループは無い
  await openKnowledge(page);
  await expect(shelfOf(page, "会社の棚")).toBeVisible();
  await expect(shelfOf(page, "自分の棚")).toBeVisible();
  const tree0 = await treeOf(page);
  expect(tree0.status, "木の口が答える").toBe(200);
  expect(tree0.tree?.can_write.company, "管理者は会社の棚に書ける").toBe(true);
  expect(tree0.tree?.groups, "グループはまだ無い（作る道は段 11）").toEqual([]);
  expect(tree0.tree?.admin_counts, "管理者は管理の数を持つ").not.toBeNull();

  // 書く → 書き終える：作る口 201・自動で保存 200・公開 200。読む形・版 1
  const w = await writeAndPublish(page, "会社の棚", { title: T1, desc: D1, text: MUST_TEXT });
  expect(w.created, "作る口が受ける").toBe(201);
  expect(w.saved, "自動で保存の口が受ける").toBe(200);
  expect(w.published.status, "公開の口が受ける").toBe(200);
  expect(w.published.similar, "最初のページに似たページは無い").toEqual([]);
  shared.pageOf01 = { id: w.id, title: T1 };
  await expect(h1(page, T1)).toBeVisible();
  const p1 = await pageOf(page, w.id);
  expect(p1.status, "口の読み直し").toBe(200);
  expect(p1.page?.state, "公開済み").toBe("published");
  expect(p1.page?.must, "まだ必ず守るではない").toBe(false);
  expect(p1.page?.place.shelf, "会社の棚").toBe("company");
  expect(p1.page?.body?.text ?? "", "本文が入っている").toContain("翌月 5 日");

  // 日本語の似たページが本物の DB で見つかる（pg_trgm・K-686 の G-11）：2 枚目の書き終えるで小窓が出て、中に 1 枚目の題名がある
  const second = await writeAndPublish(page, "会社の棚", { title: T1B, desc: D1, text: SAME_TEXT });
  expect(second.published.similar.join("\n"), "似たページの小窓に 1 枚目の題名が並ぶ").toContain(T1);
  expect(second.published.status, "「このまま作る」で公開の口が受ける").toBe(200);

  // 必ず守る：つまみを押す → 押し込み・1 行・口の読み直し・木の印
  await openPage(page, w.id, T1);
  expect(await toggleMust(page, true), "必ず守るの口が受ける").toBe(200);
  await expect(page.getByText(MSG.mustLine)).toBeVisible();
  expect((await pageOf(page, w.id)).page?.must, "口の読み直しで必ず守る").toBe(true);
  await expect(shelfOf(page, "会社の棚").getByLabel("必ず守る", { exact: true }).first()).toBeVisible();

  // 読むだけの人（2 人目・メンバー）：読める・直せない・必ず守るを付け外せない・写して直せる・管理は無い
  await openKnowledge(pb);
  const treeB = await treeOf(pb);
  expect(treeB.tree?.can_write.company, "メンバーは会社の棚に書けない").toBe(false);
  expect(treeB.tree?.admin_counts, "メンバーは管理の数を持たない").toBeNull();
  await expect(pb.getByRole("tab", { name: /^管理/ })).toHaveCount(0);
  await openPage(pb, w.id, T1);
  await expect(pb.getByText(MSG.mustLine), "付いている必ず守るの 1 行は読むだけの人にも出る").toBeVisible();
  await expect(pb.getByRole("button", { name: "直す", exact: true })).toHaveCount(0);
  await expect(pb.getByRole("button", { name: "必ず守る", exact: true })).toHaveCount(0);
  const readB = await pageOf(pb, w.id);
  expect(readB.page?.acts, "操作は写して直すだけ（直す・上げる・共有・必ず守るは無い）").toEqual(["copy"]);

  // 写して直す：自分の棚に写しができ（元を残す）、写しを直しても元は変わらない
  const copied = await copyToMine(pb);
  expect(copied.status, "写す口が受ける").toBe(201);
  await expect(h1(pb, T1)).toBeVisible();
  const copy = await pageOf(pb, copied.id);
  expect(copy.page?.place.shelf, "自分の棚").toBe("me");
  expect(copy.page?.must, "写しに必ず守るは付かない").toBe(false);
  expect(copy.page?.copied_from?.title, "写しの元が残る").toBe(T1);
  await expect(shelfOf(pb, "自分の棚").getByLabel("写し", { exact: true }).first()).toBeVisible();
  await startEdit(pb);
  await typeBody(pb, " 写しだけに足した一文です。");
  const copyDone = await finishPage(pb);
  expect(copyDone.status, "写しの書き終えるが通る").toBe(200);
  const copyAfter = await pageOf(pb, copied.id);
  expect(copyAfter.page?.body?.text ?? "", "写しに足した字が入る").toContain("写しだけに足した");
  const origAfter = await pageOf(page, w.id);
  expect(origAfter.page?.body?.text ?? "", "元の本文は変わらない").not.toContain("写しだけに足した");

  // 管理：見直すページは管理者だけ（メンバーは 403）
  expect((await reviewOf(page)).status, "管理者は見直すページを読める").toBe(200);
  expect((await reviewOf(pb)).status, "メンバーは見直すページを読めない").toBe(403);
});

test("K716-STG-02 AI が読んで守る：必ず守るのページがある会社で、PC をつなぎ → 任せる → 確認項目に入る・やり取りに残る → 完了が止まる → 付けて完了 → 破られた数が見直すページに出る", async ({
  page,
}) => {
  test.setTimeout(480_000);
  const c = person("k716-02c");
  await signUp(page, c);
  await openKnowledge(page);
  const t = `請求書の送り方 統合テスト k716-02`;
  const made = await writeAndPublish(page, "会社の棚", { title: t, desc: "請求書を送るときの決まり", text: MUST_TEXT });
  expect(made.published.status, "ページを書き終える").toBe(200);
  await openPage(page, made.id, t);
  expect(await toggleMust(page, true), "必ず守るを付ける").toBe(200);

  // PC をつなぐ（偽の AI の輪）→ チケットを作る → AI に任せる
  const pc = stagingPc("統合テストの PC (k716-02)");
  pcs.push(pc);
  await connectPc(page, pc, LIMIT.firstView);
  const title = "見積を送る 統合テスト k716-02";
  const id = await createPlainTicket(page, c, title);
  expect(await clickAndAnswer(page, delegateBtn(page), DELEGATE_RE), "任せる口が受ける（201）").toBe(201);

  // 任せた直後：必ず守るのページが確認項目に 1 行入る（出どころ ナレッジ・チェックなし・ページの印）。やり取りに「守る物」の 1 行
  const specLine = `『${t}』を守った`;
  const specs = await specRowsOf(page, id);
  const mine = specs.filter((s) => s.source === "knowledge");
  expect(
    mine.map((s) => s.title),
    "必ず守るのページごとに 1 行",
  ).toEqual([specLine]);
  expect(mine[0]?.checked, "入った行はまだ付いていない").toBe(false);
  expect(mine[0]?.source_page?.title, "出どころのページの題名が付く").toBe(t);
  expect(
    (await threadFieldsOf(page, id)).map((f) => f.field),
    "やり取りに「守る物」の行",
  ).toContain("guard_list");
  await showThread(page);
  await expect(page.getByText(/守る物/).first(), "やり取りの画面に「守る物」が出る").toBeVisible();

  // 輪が作る段を終える → 承認待ち → 承認して送る → 輪が実行の段を終える
  await expect(execBand(page), "任せてから承認待ちの帯が自分で出る").toContainText(MSG.waitingMe, {
    timeout: LIMIT.toApproval,
  });
  await expect(execBand(page), "偽の AI の答えが成果物に出る").toContainText(FAKE_REPLY_HEAD);
  await approveBtn(page).click();
  const sure = page.getByRole("alertdialog");
  await sure.getByRole("checkbox", { name: "成果物を目で見た" }).check();
  expect(
    await clickAndAnswer(page, sure.getByRole("button", { name: "承認して送る", exact: true }), APPROVE_RE),
    "承認の口が受ける（201）",
  ).toBe(201);
  await expect(completeBtn(page), "実行が終わると完了にできる形になる").toBeVisible({ timeout: LIMIT.toExecuted });

  // 破られた数：AI が終わりを知らせたのに必ず守るの行にチェックが無い → やり取りに「守れていなかった決まり」
  await expect
    .poll(async () => (await threadFieldsOf(page, id)).filter((f) => f.field === "knowledge_breach").length, {
      message: "守れていなかった決まりがやり取りに残る",
      timeout: LIMIT.breachCounted,
    })
    .toBeGreaterThanOrEqual(1);

  // 完了が止まる：必ず守るから入った行が付くまで完了にできない（小窓・完了の口は呼ばれない）
  let completeCalls = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/v1\/tickets\/[^/]+\/complete$/.test(new URL(r.url()).pathname))
      completeCalls += 1;
  });
  await completeBtn(page).click();
  const blocked = blockedDialog(page);
  await expect(blocked, "まだ完了にできませんの小窓が出る").toBeVisible();
  await expect(blocked).toContainText(specLine);
  await expect(blocked).toContainText(`ナレッジ：${t}`);
  await expect(blocked).toContainText(MSG.blockedNote);
  expect(completeCalls, "止めた間、完了の口は呼ばれない").toBe(0);
  await blocked.getByRole("button", { name: "確認項目に戻る", exact: true }).click();
  await expect(blocked).toHaveCount(0);

  // 付けて完了：確認項目の印がページへのリンクで、箱にチェックを付けると完了にできる
  await showSpecs(page);
  await expect(page.getByRole("link", { name: `ナレッジ：${t}`, exact: true }).first()).toHaveAttribute(
    "href",
    `/knowledge/${made.id}`,
  );
  expect(await toggleSpec(page, specLine), "チェックを付ける口が受ける").toBe(200);
  await expect(specBox(page, specLine)).toBeChecked();
  expect(await completeNow(page), "完了の口が受ける（201）").toBe(201);
  await expect(execBand(page).getByText(MSG.doneBand), "完了しました（名前・日時）").toBeVisible();
  expect((await ticketOf(page, id)).completed, "口の読み直しで完了").toBe(true);

  // 管理 › 見直すページ：よく破られる決まりにこのページが 1 回以上で出る。木の管理の数にも出る
  const rv = await reviewOf(page);
  expect(rv.status, "見直すページの口が答える").toBe(200);
  const hit = rv.review?.broken.find((x) => x.id === made.id);
  expect(hit?.count ?? 0, "破られた数").toBeGreaterThanOrEqual(1);
  await openReview(page);
  await expect(page.getByRole("region", { name: /よく破られる決まり/ })).toContainText(t);
  expect((await treeOf(page)).tree?.admin_counts?.review ?? 0, "木の管理の数に出る").toBeGreaterThanOrEqual(1);
});

test("K716-STG-03 設定が作る面と詳細に効く：種別（色・ひな形）を足す → 作る面でひな形が入る／状態の名前を直す・足す → 詳細の段に効く／項目を足す（必須）→ 作るとき止まる・値が詳細に出る", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const d = person("k716-03d");
  await signUp(page, d);
  const kind = "見積 統合テスト k716-03";
  shared.kindOf03 = kind;

  // 種別：足す（珊瑚）→ ひな形を書く → 口の読み直しで色の鍵とひな形
  await openSettings(page, "kinds");
  expect(await addKind(page, kind, "珊瑚"), "種別を足す口が受ける").toBe(201);
  expect(await writeTemplate(page, kind, "宛先と金額を書きます。"), "ひな形を保存する口が受ける").toBe(200);
  const k = (await kindsOf(page)).find((x) => x.name === kind);
  expect(k?.color_key, "色の鍵").toBe("coral");
  expect(k?.hasTemplate, "ひな形が入っている").toBe(true);

  // 作る面：この種別を選ぶと、ひな形が入っている旨が出る
  await fillCreateBasics(page, "ひな形を見る 統合テスト k716-03", d.name);
  await chooseKind(page, kind);
  await expect(page.getByText(new RegExp(`種別「${kind}」のひな形が入っています`))).toBeVisible();

  // 状態：名前を直す・足す → 口の読み直し・詳細の段の名前に効く
  const doingName = "進行中 統合テスト";
  await openSettings(page, "stages");
  expect(await renameStage(page, "作業中", doingName), "状態を直す口が受ける").toBe(200);
  expect(await addStage(page, "確認待ち 統合テスト"), "状態を足す口が受ける").toBe(201);
  const stages = await stagesOf(page);
  expect(stages.find((s) => s.key === "doing")?.name, "鍵 doing の名前が替わる（鍵は変わらない）").toBe(doingName);
  expect(
    stages.some((s) => s.name === "確認待ち 統合テスト"),
    "足した状態が一覧に出る",
  ).toBe(true);

  // 項目：足す（必須・この種別だけ）→ 作る面で止まる・値を入れて作る・詳細に値が出る
  const field = "先方の担当者名 統合テスト";
  await openSettings(page, "fields");
  expect(await addField(page, field, kind), "項目を足す口が受ける").toBe(201);
  expect((await kindsOf(page)).find((x) => x.name === kind)?.fields, "この種別の読みに項目が出る").toContain(field);
  await fillCreateBasics(page, "項目を見る 統合テスト k716-03", d.name);
  await chooseKind(page, kind);
  await expect(fieldInput(page, field), "作る面にこの項目の欄が出る").toBeVisible();
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect(page.getByText(new RegExp(`${field}.*ください`)), "必須の項目が空だと止まる").toBeVisible();
  expect(pathOf(page), "止まったので作る面のまま").toBe("/tickets");
  await fieldInput(page, field).fill("鈴木 一郎");
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect.poll(() => pathOf(page), "値を入れたら作れて詳細へ移る").toMatch(/^\/tickets\/[0-9a-f-]{36}$/);
  const id = pathOf(page).split("/").pop()!;
  const td = await ticketOf(page, id);
  expect(td.fields.find((f) => f.name === field)?.value, "詳細の口に値が出る").toBe("鈴木 一郎");
  await expect(page.getByText("鈴木 一郎").first(), "詳細の画面に値が出る").toBeVisible();

  // 状態の名前の効き：作業中にすると、詳細の段の名前が新しい名前になる
  expect(await startDoing(page, id), "段を作業中にする口が受ける").toBeLessThan(300);
  expect((await ticketOf(page, id)).stage, "詳細の段の名前が新しい名前").toBe(doingName);
});

test("K716-STG-04 メンバーをグループごとに・設定は管理者だけ・別の会社には何も見えない", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const e = person("k716-04e");
  const f = person("k716-04f");
  await signUp(page, e);
  const pf = await invited(browser, page, f);

  // メンバー：グループごとに 1 行・押すとその中のメンバー。「＋ グループ」は押せない形
  await openMembers(page);
  await expect(page.getByText(MSG.members)).toBeVisible();
  const row = groupRow(page).first();
  await expect(row, "自分の主のグループは初めから開いている").toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(f.name).first(), "開いた中に 2 人目が出る").toBeVisible();
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText(f.name), "閉じると人の行は画面に無い").toHaveCount(0);
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: "＋ グループ", exact: true }),
    "グループを作る道は無い",
  ).toHaveAttribute("aria-disabled", "true");

  // 設定は管理者だけ：メンバーが直に開くと権限なし
  expect((await pf.goto("/workspace/ticket-settings"))?.status(), "道は開く").toBe(200);
  await expect(pf.getByText(MSG.noAccess)).toBeVisible();
  await openSettings(page, "kinds");

  // 別の会社には何も見えない：01 のページは口で 403 か 404・木に出ない・画面は見られない。03 の種別は種別の一覧に出ない
  expect(shared.pageOf01, "01 が先に通ってページを作っている").not.toBeNull();
  const other = await pageOf(page, shared.pageOf01!.id);
  expect([403, 404], "ほかの会社のページは読めない").toContain(other.status);
  expect(JSON.stringify(other.page ?? null)).not.toContain("k716-01");
  const tree = await treeOf(page);
  expect(JSON.stringify(tree.tree ?? null), "木にほかの会社のページが出ない").not.toContain("k716-01");
  await page.goto(`/knowledge/${shared.pageOf01!.id}`);
  await expect(page.getByText(MSG.notSeen).first()).toBeVisible();
  expect(shared.kindOf03, "03 が先に通って種別を足している").not.toBeNull();
  expect(
    (await kindsOf(page)).map((x) => x.name),
    "ほかの会社の種別は出ない",
  ).not.toContain(shared.kindOf03);
});
