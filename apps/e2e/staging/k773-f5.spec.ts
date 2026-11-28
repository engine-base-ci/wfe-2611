// K-773 統合テスト（段 6・F5）：AI に任せて、確かめて、終える を、staging（本番と同じ形・D-128.144）の上で端から端まで通す。
//   登録 → 2 段階を付ける → PC をつなぐ → チケットを作って確認項目を足す → AI に任せる → 承認待ち（確認の表「0 ／ 1 済み」）→ 承認の確かめの小窓にチェックの無い確認項目の注意
//   → 承認 → 実行 → 完了（STG-01）／分身の部屋で見る・話す・やったことからチケットへ（STG-03）。
//   中の分岐は単体（K-731〜K-780）と中間テスト（K-770〜K-772・開発の環境）が持つ。ここで見るのは 2 つだけ：
//   ① F5 の操作が 1 人の上で、本物の口・本物の PC の輪の上でつながること ② staging でしか出ないもの（口と画面が別の住所・接続の束ね役ごし・組み立てた Bridge の輪の間合い）。
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204・K-65・K-596 と同じ）。「できた」はその回の JUnit で決める。チケットの CI（枝）では流れない。
//   ★試験のための抜け道を作らない：page.route を使わない・製品に試験用の分かれ道を足さない・DB は読みも書きもしない（確かめは画面・同じブラウザからの口の読み直し・Resend の記録だけ）・固定の待ちを置かない。
//   ★記録に出さない：住所・宛先・確認のリンク・鍵・パスワード・認証アプリの鍵（_lib/scrub-reporter.ts が伏せ直す）。
//   人は steps.ts の person。2 段階は画面で付ける（_lib/f5-steps.ts）。PC は組み立てた Bridge（K-97・_lib/bridge.ts）の輪。AI は偽の Claude Code（D-141.1）：
//   受けた文に「- 」で始まる行が在れば「資料を受け取りました：」の後にその行を並べて返し、無ければ決まった長い返事を返す。道具（spec_check など）は呼ばない。
//   2 本は 1 人・1 台の PC を受け渡す（登録 1 人・メール 2 通・PC 1 台）。1 本目が落ちると 2 本目は実行されず skip になり、judge が skip を赤にする（緑と言わない）。先頭の ready の確かめは、1 本目が最後まで通っていないときの保険。試験が作った人・会社・PC・チケットは staging に残す（名前に「統合テスト」）。
//   行 ID（K773-STG-NN）を試験の名前の頭に持つ。02（止める）・04（AI がチェックを付ける）・05（動いている AI を止める・取り下げ・本物のメールの試し打ち）は staging では作れないので試験を持たない（チケットの judge-skip）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。直すのは道具（_lib）と設定の側
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { FAKE_REPLY_HEAD, stagingPc, type StagingPc } from "./_lib/bridge";
import {
  addSpecOnScreen,
  approveWithNote,
  completeOnScreen,
  delegateOnScreen,
  roomTab,
  sendTalk,
  signUpAndEnter,
  thread,
} from "./_lib/f5-steps";
import { WEB } from "./_lib/site";
import {
  aiOf,
  codeOnScreen,
  createTicket,
  execBand,
  h1,
  liveOn,
  openConnect,
  pathOf,
  person,
  readAs,
  type Person,
} from "./_lib/steps";

/** 文言（K-731・K-734・K-740・K-755・K-762 の仕様の表と下絵 /dev/mock/f5 から。実装から書かない） */
const MSG = {
  waitingMe: "あなたの承認を待っています", // K-63 の帯
  running: "実行中",
  completeHint: "完了の条件を確かめて完了にしてください", // K-63 の帯
  checksNone: /確認 0 ／ 1 済み/, // 下絵 checks-table・D-153.3（数だけ）
  pendingNote: /チェックの無い確認項目が 1 件あります/, // 承認の確かめの小窓・D-153.5
  talkReply: /9 月の請求のまとめ|資料を受け取りました/, // 偽の AI の返事（決まった長い返事か、「- 」の行がある文への返事）
} as const;
const BODY = {
  purpose: "先方に出す見積のたたき台を作って送る",
  done: "先方が見積を受け取った",
  todo: "- 見積を作る\n- 先方に送る",
} as const;
const SPEC = "宛名が先方の正式名称になっている";
const LIMIT = { toApproval: 120_000, toExecuted: 120_000, firstView: 30_000, talkReply: 120_000 } as const;

/** 3 本が受け渡す物（人・窓・PC・1 本目のチケット）。書き出さない・同じ働き手の中だけ */
const shared: {
  ready: boolean;
  me: Person | null;
  ctx: BrowserContext | null;
  page: Page | null;
  pc: StagingPc | null;
  ticketId: string | null;
  title: string | null;
} = { ready: false, me: null, ctx: null, page: null, pc: null, ticketId: null, title: null };
test.afterAll(async () => {
  shared.pc?.close();
  await shared.ctx?.close();
});
async function device(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: WEB, viewport: { width: 1440, height: 1000 } });
  shared.ctx = ctx;
  return ctx.newPage();
}
/** 実行の記録（新しい順）の [phase, status]。口の読み直し（別の GET） */
async function runsOf(page: Page, id: string): Promise<{ status: number; runs: [string, string][] }> {
  const r = await readAs(page, `/tickets/${id}/runs`);
  const rows = Array.isArray(r.data) ? (r.data as { phase?: string; status?: string }[]) : [];
  return { status: r.status, runs: rows.map((x) => [x.phase ?? "", x.status ?? ""]) };
}

test.describe.configure({ mode: "serial" });

test("K773-STG-01 AI に任せて確かめて終える（本物のメール・本物の PC の輪）：登録 → PC をつなぐ → チケット・確認項目 → AI に任せる → 承認待ち・確認の表 → 承認の確かめに注意 → 承認 → 実行 → 完了", async ({
  browser,
}) => {
  test.setTimeout(480_000);
  const page = await device(browser);
  const me = person("通し");
  const key = `通し${Date.now().toString(36)}`;
  const title = `見積を送る 統合テスト ${key}`;
  shared.me = me;
  shared.page = page;
  shared.title = title;
  expect(await signUpAndEnter(page, me), "登録の口が受ける（201）").toBe(201);
  // PC をつなぐ（画面のコードを組み立てた Bridge が引き取り、輪を回す）
  const pc = stagingPc(`統合テストの PC (${key})`);
  shared.pc = pc;
  expect(await openConnect(page), "PC をつなぐの画面が開く（200）").toBe(200);
  expect(await pc.claim(await codeOnScreen(page)), "画面のコードを組み立てた Bridge が引き取る").toEqual({
    ok: true,
    message: null,
  });
  pc.startLoop();
  await expect(liveOn(page), "輪の最初の合図で画面が自分で変わる").toContainText(pc.label, {
    timeout: LIMIT.firstView,
  });
  // チケットを作る → 確認項目を 1 つ足す → AI に任せる
  await page.goto("/tickets");
  const t = await createTicket(page, me, title, BODY);
  shared.ticketId = t;
  expect(await addSpecOnScreen(page, SPEC), "確認項目を足す口が受ける（201）").toBe(201);
  expect(await delegateOnScreen(page), "任せる口が受ける（201）").toBe(201);
  // 輪が作る段を取り、偽の AI の答えで終える → 開いたままの画面が承認待ちの帯に替わる。確認の表は数だけ（偽の AI は道具を呼ばないのでチェックは 0）
  await expect(execBand(page), "承認待ちの帯が自分で出る").toContainText(MSG.waitingMe, { timeout: LIMIT.toApproval });
  await expect(execBand(page), "偽の AI の返事が成果物に出る").toContainText(FAKE_REPLY_HEAD);
  await expect(execBand(page), "確認の表の数だけ（K-740・D-153.3）").toContainText(MSG.checksNone);
  await expect(page.getByRole("table", { name: "確認の結果", exact: true }), "確認の行は文だけ").toContainText(SPEC);
  const runsBefore = await runsOf(page, t);
  expect(runsBefore, "承認の前：実行の記録は作る段の 1 件だけ").toEqual({ status: 200, runs: [["make", "done"]] });
  // 承認：確かめの小窓にチェックの無い確認項目の注意が出るが、承認はできる（D-153.5）
  expect(await approveWithNote(page, MSG.pendingNote), "承認の口が受ける（201）").toBe(201);
  const moved = execBand(page).getByText(MSG.running, { exact: true }).or(execBand(page).getByText(MSG.completeHint));
  await expect(moved.first(), "承認の後、輪が実行の段を受け取って帯が替わる").toBeVisible({
    timeout: LIMIT.toExecuted,
  });
  await expect(execBand(page).getByText(MSG.completeHint), "実行が終わると完了の案内に替わる").toBeVisible({
    timeout: LIMIT.toExecuted,
  });
  // 完了にする
  expect(await completeOnScreen(page), "完了の口が受ける（201）").toBe(201);
  await expect(
    execBand(page).getByText(/完了しました（.+・\d{1,2}\/\d{1,2} \d{1,2}:\d{2}）/),
    "最後に「完了しました（名前・日時）」が出る",
  ).toBeVisible();
  await expect(execBand(page)).toContainText(me.name);
  // 別の GET で読み直す：再読み込みしても完了のまま・実行の記録は 実行・作る の 2 件が終わっている・承認待ちは空
  await page.reload();
  await expect(execBand(page).getByText(/完了しました（.+）/), "読み直しても完了のまま").toBeVisible({
    timeout: LIMIT.firstView,
  });
  expect(await runsOf(page, t), "実行の記録（新しい順）：実行・作る の 2 件が終わっている").toEqual({
    status: 200,
    runs: [
      ["execute", "done"],
      ["make", "done"],
    ],
  });
  await page.goto("/approvals");
  await expect(page.getByText("いま決めるものはありません"), "決め終わったら承認待ちは空").toBeVisible();
  shared.ready = true;
});

test("K773-STG-03 分身の部屋：ようすを見る → 話す（偽の AI が返事を返す）→ やったことの行からチケットへ戻る", async () => {
  test.setTimeout(300_000);
  expect(shared.ready, "1 本目が先に通っていること（赤なら緑と言わない）").toBe(true);
  const page = shared.page!;
  const me = shared.me!;
  await page.goto("/ai");
  await expect(h1(page, aiOf(me)), "部屋の名前は「〈名〉のAI」").toBeVisible({ timeout: LIMIT.firstView });
  await expect(roomTab(page, "ようす"), "ようすのタブがある").toBeVisible();
  await expect(roomTab(page, "やったこと"), "やったことのタブがある").toBeVisible();
  // 話す：言った言葉が会話に出て、PC の輪が会話の仕事を取って偽の AI の返事が返る
  await roomTab(page, "話す").click();
  await expect.poll(() => pathOf(page), "話すの道へ移る（D-153.23）").toBe("/ai/talk");
  const said = `こんにちは 統合テスト ${Date.now().toString(36)}`;
  await sendTalk(page, me, said);
  await expect(thread(page), "言った言葉が会話に出る").toContainText(said);
  await expect(thread(page), "偽の AI の返事が会話に出る").toContainText(MSG.talkReply, { timeout: LIMIT.talkReply });
  // やったこと：1 本目のチケットの行が出て、押すとそのチケットへ
  await roomTab(page, "やったこと").click();
  await expect.poll(() => pathOf(page), "やったことの道へ移る（D-153.23）").toBe("/ai/done");
  const row = page.getByRole("link").or(page.getByRole("button")).filter({ hasText: shared.title! }).first();
  await expect(row, "1 本目のチケットの行が出る").toBeVisible({ timeout: LIMIT.firstView });
  await row.click();
  await expect.poll(() => pathOf(page), "行を押すとそのチケットの詳細へ").toBe(`/tickets/${shared.ticketId}`);
  await expect(h1(page, shared.title!)).toBeVisible();
});
