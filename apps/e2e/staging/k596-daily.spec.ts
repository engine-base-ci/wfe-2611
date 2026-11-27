// K-596 統合テスト（段 8・F7）：毎日見る を、staging（本番と同じ形・D-128.144）の上で端から端まで通す。
//   登録 → 2 段階を付ける → PC をつなぐ → チケットを作る → AI に任せる → 承認待ちのお知らせが鈴に出る → 押してチケットへ（既読）→ 探す → 絞って保存 → 期限を変える → 消す → 元に戻す。
//   中の分岐は単体（K-461〜K-490）と中間テスト（K-591〜K-595・開発の環境）が持つ。ここで見るのは 2 つだけ：
//   ① 7 つの操作が 1 人の上で、本物の口・本物の PC の輪の上でつながること ② staging でしか出ないもの（口と画面が別の住所で鈴・探す・保存した条件が通る・接続の束ね役ごしの会社の分け）。
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204・K-65・K-418 と同じ）。「できた」はその回の JUnit で決める。チケットの CI（枝）では流れない。
//   ★試験のための抜け道を作らない：page.route を使わない・製品に試験用の分かれ道を足さない・DB は読みも書きもしない（確かめは画面・同じブラウザからの口の読み直し・Resend の記録だけ）・固定の待ちを置かない。
//   ★記録に出さない：住所・宛先・確認のリンク・鍵・パスワード・認証アプリの鍵（_lib/scrub-reporter.ts が伏せ直す）。
//   人は steps.ts の person。2 段階は画面で付ける（_lib/daily-steps.ts）。PC は組み立てた Bridge（K-97・_lib/bridge.ts）の輪。AI は偽の Claude Code（D-141.1）。
//   試験が作った人・会社・PC・チケットは staging に残す（名前に「統合テスト」）。1 回の通しで登録 2 人・メール 4 通（登録の確認 2・登録完了 2）。
//   行 ID（K596-STG-NN）を試験の名前の頭に持つ。03（期限切れの炎・今日までの札）・04（権限を外した直後）は staging では作れないので試験を持たない（チケットの judge-skip）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。直すのは道具（_lib）と設定の側
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { stagingPc, type StagingPc } from "./_lib/bridge";
import {
  NOTICE_RE,
  RESTORE_RE,
  bell,
  changeDue,
  deleteHere,
  noticeBox,
  openBell,
  pressAndAnswer,
  saveNotDoneView,
  searchFor,
  signUpAndEnter,
} from "./_lib/daily-steps";
import { WEB } from "./_lib/site";
import {
  DELEGATE_RE,
  clickAndAnswer,
  codeOnScreen,
  createTicket,
  delegateBtn,
  execBand,
  h1,
  liveOn,
  openConnect,
  pathOf,
  person,
  readAs,
} from "./_lib/steps";

/** 文言（K-467・K-471・K-478・K-479・K-484・K-590 の仕様の表・モックから。実装から書かない） */
const MSG = {
  waitingMe: "あなたの承認を待っています", // K-63 の帯
  approvalText: "の確認が終わり、あなたの承認を待っています", // K-467 の文の表
  deleted: "を消しました",
  restored: "を元に戻しました",
  notFound: "見つかりませんでした。消されたか、見る権限が無いかもしれません", // E-PAGE-001
  noHit: "に合うものがありません",
} as const;
const BODY = {
  purpose: "先方に出す見積のたたき台を作って送る",
  done: "先方が見積を受け取った",
  todo: "- 見積を作る\n- 先方に送る",
} as const;
const LIMIT = { toApproval: 120_000, firstView: 30_000 } as const;

const pcs: StagingPc[] = [];
const contexts: BrowserContext[] = [];
test.afterEach(async () => {
  for (const pc of pcs.splice(0)) pc.close();
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});
async function device(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: WEB, viewport: { width: 1440, height: 1000 } });
  contexts.push(ctx);
  return ctx.newPage();
}
/** 1 本目が 2 本目へ渡すもの（チケットの id と題名の頭。書き出さない・同じ働き手の中だけ） */
const handoff: { id: string | null; key: string | null } = { id: null, key: null };

test.describe.configure({ mode: "serial" });

test("K596-STG-01 毎日見る（本物のメール・本物の PC の輪）：登録 → PC をつなぐ → チケット → AI に任せる → 鈴に承認待ちのお知らせ → 押してチケットへ・既読 → 探す → 絞って保存 → 期限を変える → 消す → 元に戻す", async ({
  page,
}) => {
  test.setTimeout(420_000);
  const me = person("毎日");
  const key = `毎日${Date.now().toString(36)}`;
  const title = `見積を送る 統合テスト ${key}`;
  expect(await signUpAndEnter(page, me), "登録の口が受ける（201）").toBe(201);
  // PC をつなぐ（画面のコードを組み立てた Bridge が引き取り、輪を回す）
  const pc = stagingPc(`統合テストの PC (${key})`);
  pcs.push(pc);
  expect(await openConnect(page), "PC をつなぐの画面が開く（200）").toBe(200);
  expect(await pc.claim(await codeOnScreen(page)), "画面のコードを組み立てた Bridge が引き取る").toEqual({
    ok: true,
    message: null,
  });
  pc.startLoop();
  await expect(liveOn(page), "輪の最初の合図で画面が自分で変わる").toContainText(pc.label, {
    timeout: LIMIT.firstView,
  });
  // チケットを作る → AI に任せる → 承認待ち
  await page.goto("/tickets");
  const t = await createTicket(page, me, title, BODY);
  handoff.id = t;
  handoff.key = key;
  expect(await clickAndAnswer(page, delegateBtn(page), DELEGATE_RE), "任せる口が受ける（201）").toBe(201);
  await expect(execBand(page), "承認待ちの帯が自分で出る").toContainText(MSG.waitingMe, { timeout: LIMIT.toApproval });
  // 鈴：承認待ちのお知らせが出る → 押す → チケットの詳細・既読
  await page.goto("/tickets");
  await expect(bell(page), "鈴に未読の数が付く").toHaveAttribute("aria-label", /^お知らせ（\d+ 件）$/);
  await openBell(page);
  const row = noticeBox(page)
    .getByRole("link")
    .or(noticeBox(page).getByRole("button"))
    .filter({ hasText: MSG.approvalText });
  await expect(row, "承認待ちの行が 1 つ").toHaveCount(1);
  // 数は「押す前から 1 減る」で比べる：PC をつなぐと本物の口が「PC をつなぎました」のお知らせ（bridge.connected・未読）を書くので、押した後の数は 0 にならない。staging では DB を触れず消せない
  const unreadBefore = unreadOf(await readAs(page, "/shell"));
  expect(await pressAndAnswer(page, row, "PATCH", NOTICE_RE), "既読の口が受ける（200）").toBe(200);
  await expect.poll(() => pathOf(page), "押した行のチケットの詳細へ").toBe(`/tickets/${t}`);
  await expect(h1(page, title)).toBeVisible();
  expect(unreadBefore, "押す前の数は承認待ちのお知らせを含む").toBeGreaterThanOrEqual(1);
  expect(unreadOf(await readAs(page, "/shell")), "外枠の数が押す前から 1 減る（別の GET の読み直し）").toBe(
    unreadBefore - 1,
  );
  // 探す：題名で見つけて開く
  await page.goto("/tickets");
  const found = await searchFor(page, key);
  const hit = found.getByRole("link").filter({ hasText: title });
  await expect(hit, "探すで見つかる").toHaveCount(1);
  await hit.click();
  await expect.poll(() => pathOf(page), "探した行のチケットへ").toBe(`/tickets/${t}`);
  // 絞って保存：グループの一覧で「完了以外」→ 保存 → 左のメニューに並ぶ
  // getTicket の答えは { ticket, sections, kind, stage, … }。グループの id は ticket.scope_id（最上段に scope_id は無い）
  const detail = (await readAs(page, `/tickets/${t}`)).data as { ticket?: { scope_id?: string } } | null;
  const scope = detail?.ticket?.scope_id ?? "";
  expect(scope, "チケットのグループが分かる").not.toBe("");
  await page.goto(`/tickets?view=all&scope=${scope}`);
  const viewName = `統合 ${key}`;
  expect(await saveNotDoneView(page, viewName), "保存の口が受ける（201）").toBe(201);
  await expect(
    page.getByRole("navigation", { name: "メニュー", exact: true }).getByRole("link", { name: viewName }),
  ).toHaveCount(1);
  expect(JSON.stringify((await readAs(page, "/saved_views")).data), "口の読み直しに 1 件").toContain(viewName);
  // 期限を変える（理由つき）
  await page.goto(`/tickets/${t}`);
  await expect(h1(page, title)).toBeVisible();
  expect(await changeDue(page, "明日", "先方の返事待ちで 1 日待ちます"), "期限の口が受ける（200）").toBe(200);
  await expect(page.getByText(/期限を \d{2}\/\d{2} に変えました/)).toBeVisible();
  // 消す → 直後のお知らせの「元に戻す」
  expect(await deleteHereAndUndo(page, t, title), "戻す口が受ける（201）").toBe(201);
  await expect(h1(page, title), "戻した詳細に題名が出る").toBeVisible();
  expect((await readAs(page, `/tickets/${t}`)).status, "別の GET で読める").toBe(200);
});

/** 口 /shell の答えの未読の数（getShell の notifications_unread） */
const unreadOf = (r: { data: unknown }): number =>
  (r.data as { notifications_unread?: number } | null)?.notifications_unread ?? -1;

/** 消す → 一覧へ移る → お知らせ「…を消しました」の「元に戻す」を押す。戻す口の答えの番号を返す */
async function deleteHereAndUndo(page: Page, t: string, title: string): Promise<number> {
  expect(await deleteHere(page), "消す口が受ける（200）").toBe(200);
  await expect.poll(() => pathOf(page), "消したら一覧へ").toBe("/tickets");
  await expect(page.getByText(MSG.deleted)).toBeVisible();
  expect((await readAs(page, `/tickets/${t}`)).status, "消した後の口は 404").toBe(404);
  await expect(page.getByRole("row").filter({ hasText: title }), "一覧に出ない").toHaveCount(0);
  return pressAndAnswer(page, page.getByRole("button", { name: "元に戻す", exact: true }), "POST", RESTORE_RE);
}

test("K596-STG-02 会社の分け：別の会社の人は、1 本目の会社のチケットを探せず、鈴にも出ず、開けない（接続の束ね役ごしでも会社が分かれる）", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  expect(handoff.id !== null && handoff.key !== null, "1 本目が先に通っていること（赤なら緑と言わない）").toBe(true);
  const page = await device(browser);
  const other = person("別会社");
  expect(await signUpAndEnter(page, other), "別の会社の登録の口が受ける（201）").toBe(201);
  const found = await searchFor(page, handoff.key!);
  await expect(found, "探すに 1 本目の会社のチケットは出ない").toContainText(MSG.noHit);
  const hits = await readAs(page, `/search?q=${encodeURIComponent(handoff.key!)}`);
  expect(hits.status).toBe(200);
  expect(Array.isArray(hits.data) ? (hits.data as unknown[]).length : -1, "口の答えも 0 件").toBe(0);
  const other404 = await readAs(page, `/tickets/${handoff.id}`);
  expect([403, 404], "別の会社のチケットの口は 403 か 404").toContain(other404.status);
  const res = await page.goto(`/tickets/${handoff.id}`);
  expect(res?.status(), "画面は開く").toBe(200);
  await expect(page.getByText(MSG.notFound), "見つかりませんでしたの画面").toBeVisible();
  await page.goto("/tickets");
  // 鈴の数 0 は期待しない：登録の直後の最初のログインは新しい端末のお知らせを出さない（K52-API-025）が、2 段階を付ける道で設定のお知らせが増えるかは
  // K-319・K-321 に書いていない。守りたいのは「1 本目の会社のお知らせが混ざらない」ことなので、箱を開いて 1 本目の行・題名が無いことを見る
  const theirBox = await openBell(page);
  await expect(theirBox.getByText(MSG.approvalText), "別の会社の鈴に 1 本目の承認待ちのお知らせは出ない").toHaveCount(
    0,
  );
  await expect(page.getByText(handoff.key!), "別の会社の画面のどこにも 1 本目の印が出ない").toHaveCount(0);
});
