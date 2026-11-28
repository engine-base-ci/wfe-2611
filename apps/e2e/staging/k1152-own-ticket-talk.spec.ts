// K-1152 統合テスト（段 7・F6 自分で進める・話す・決める）：自分でやるチケットを作業中にし、やり取りに書き、書き込みを決定にし、実績を入れ、完了の小窓で終え、
//   完了の後も書く。F5 とまたぐ（承認待ちの間は段を変えられず、書き込みはできる）。staging（本番と同じ形・D-128.144）の上で端から端まで通す。
//   中の分岐は単体（K-383〜K-398）と統合テスト K-399（開発の環境）が持つ。ここで見るのは 2 つだけ：
//   ① 操作が 1 人の上で、本物の口・本物の PC の輪の上でつながること ② staging でしか出ないもの（口と画面が別の住所でやり取り・決定・段が通る・接続の束ね役ごしの会社の分け）。
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204・K-65・K-596 と同じ）。「できた」はその回の JUnit で決める。チケットの CI（枝）では流れない。
//   ★試験のための抜け道を作らない：page.route を使わない・製品に試験用の分かれ道を足さない・DB は読みも書きもしない（確かめは画面・同じブラウザからの口の読み直しだけ）・固定の待ちを置かない。
//   ★記録に出さない：住所・宛先・確認のリンク・パスワード・認証アプリの鍵（_lib/scrub-reporter.ts が伏せ直す）。
//   人は steps.ts の person。2 段階は画面で付ける（_lib/enter-steps.ts）。PC は組み立てた Bridge（K-97・_lib/bridge.ts）の輪。AI は偽の Claude Code（D-141.1）。
//   試験が作った人・会社・PC・チケットは staging に残す（名前に「統合テスト」）。1 回の通しで登録 2 人・メール 4 通前後。
//   行 ID（K1152-STG-NN）を試験の名前の頭に持つ。04（@ と同僚の保留）・05（実行中は段を変えられない）は staging では作れないので試験を持たない（チケットの judge-skip）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。直すのは道具（_lib）と設定の側
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { stagingPc, type StagingPc } from "./_lib/bridge";
import { patchAs, pressAndAnswer, sendAs, signUpAndEnter } from "./_lib/enter-steps";
import { WEB } from "./_lib/site";
import {
  DELEGATE_RE,
  clickAndAnswer,
  codeOnScreen,
  createTicket,
  delegateBtn,
  execBand,
  liveOn,
  openConnect,
  pathOf,
  person,
  readAs,
  type Person,
} from "./_lib/steps";

/** 文（代表の答え ㉒・各葉の md と K-399 の文の表から。実装から書かない） */
const MSG = {
  stageLine: "が状態を 未着手 → 作業中 に変えた", // ㉒ 更新の記録の 1 行
  timeLine: "が実績を 1 時間 に変えた", // ㉒
  decisionLine: "が決定を足した", // ㉒
  waitingMe: "あなたの承認を待っています", // K-63 の帯
  notFound: "見つかりませんでした。消されたか、見る権限が無いかもしれません", // E-PAGE-001
} as const;
const BODY = {
  purpose: "先方に請求書を送る",
  done: "先方が請求書を受け取った",
  todo: "- 請求書を作る\n- 先方に送る",
} as const;
const LIMIT = { toApproval: 120_000, firstView: 30_000 } as const;
const POST_RE = /^\/api\/v1\/tickets\/[^/]+\/messages$/;

const pcs: StagingPc[] = [];
const contexts: BrowserContext[] = [];
test.afterAll(async () => {
  for (const pc of pcs.splice(0)) pc.close();
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});
async function device(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    baseURL: WEB,
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Tokyo",
  });
  contexts.push(ctx);
  return ctx.newPage();
}
/** 1 本目が 2 本目・3 本目へ渡すもの（同じ働き手の中だけ・書き出さない） */
const held: { page: Page | null; me: Person | null; ticket: string | null; key: string | null } = {
  page: null,
  me: null,
  ticket: null,
  key: null,
};

// ---------------------------------------------------------------- 画面の 1 歩（この試験の中だけ・K-399 と同じ選び方）
const meta = (page: Page) => page.locator(".k-detail-meta");
const stageBtn = (page: Page) => meta(page).getByRole("button", { name: /^状態：/ });
const stagePart = (page: Page) => meta(page).locator('[data-part="stage"]');
const panel = (page: Page) => page.getByRole("complementary", { name: "チケットのパネル", exact: true });
const tab = (page: Page, name: RegExp) =>
  panel(page).getByRole("navigation", { name: "パネルのタブ", exact: true }).getByRole("button", { name });
const stageItem = (page: Page, key: string) =>
  page.getByRole("menuitem").filter({ has: page.locator(`.k-detail-stage[data-stage="${key}"]`) });
const post = (page: Page, text: string) => panel(page).locator("article.k-talk-post").filter({ hasText: text });
const logSec = (page: Page) => page.locator("section:has(#sec-decisions)").first();
/** やり取りのタブで書いて、書き込みの口の答えの番号を返す */
async function write(page: Page, text: string): Promise<number> {
  await tab(page, /^やり取り/).click();
  await panel(page).getByRole("textbox", { name: "書き込み", exact: true }).fill(text);
  return pressAndAnswer(page, panel(page).getByRole("button", { name: "書き込む", exact: true }), "POST", POST_RE);
}
type Detail = {
  stage?: { key?: string } | null;
  ticket?: { actual_minutes?: number | null; completed_at?: string | null };
};
const stageOf = async (page: Page, t: string): Promise<string> =>
  ((await readAs(page, `/tickets/${t}`)).data as Detail | null)?.stage?.key ?? "";

test.describe.configure({ mode: "serial" });

test("K1152-STG-01 自分でやるチケット（本物のメール）：登録 → チケットを作る → 段の札で作業中 → やり取りに書く → 書き込みを決定にする → 実績 1 時間 → 完了の小窓で完了 → 完了の後も書ける", async ({
  browser,
}) => {
  test.setTimeout(360_000);
  const page = await device(browser);
  const me = person("進める");
  const key = `進める${Date.now().toString(36)}`;
  const title = `請求書を送る 統合テスト ${key}`;
  expect((await signUpAndEnter(page, me)).status, "登録の口が受ける（201）").toBe(201);
  const t = await createTicket(page, me, title, BODY);
  held.page = page;
  held.me = me;
  held.ticket = t;
  held.key = key;
  // 段の札で作業中
  await expect(stagePart(page)).toHaveText("未着手");
  await stageBtn(page).click();
  await stageItem(page, "doing").click();
  await expect(stagePart(page)).toHaveText("作業中");
  expect(await stageOf(page, t), "口の読み直しで段が doing").toBe("doing");
  // やり取りに書く → 決定にする
  expect(await write(page, "宛名を確かめます"), "書き込みの口が受ける（201）").toBe(201);
  await expect(post(page, "宛名を確かめます")).toContainText(me.name);
  await expect(panel(page)).toContainText(MSG.stageLine);
  await post(page, "宛名を確かめます").getByRole("button", { name: "決定にする", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "決定にする", exact: true });
  await dlg.getByRole("textbox", { name: /決めたこと/ }).fill("宛名は経理部 山田様");
  await dlg.getByRole("textbox", { name: "理由", exact: true }).fill("先方の指定");
  await dlg.getByRole("button", { name: "決定にする", exact: true }).click();
  await expect(dlg).toHaveCount(0);
  await expect(post(page, "宛名を確かめます")).toContainText("✓ 決定にした");
  await expect(logSec(page).locator("#sec-decisions")).toHaveText("決定ログ（1）");
  await expect(panel(page)).toContainText(MSG.decisionLine);
  const decs = await readAs(page, `/tickets/${t}/decisions`);
  expect(decs.status).toBe(200);
  expect(JSON.stringify(decs.data), "口の読み直しに決定が 1 件").toContain("宛名は経理部 山田様");
  // 実績 1 時間
  await tab(page, /^属性/).click();
  const actual = panel(page)
    .getByRole("region", { name: "日付と時間", exact: true })
    .locator(".k-detail-field")
    .filter({ hasText: "実績" })
    .locator("dd");
  await actual.getByRole("button", { name: "直す", exact: true }).click();
  await panel(page).getByRole("textbox", { name: "時間", exact: true }).fill("1");
  await panel(page).getByRole("textbox", { name: "分", exact: true }).fill("0");
  await panel(page).getByRole("button", { name: "保存", exact: true }).click();
  await expect(actual.locator(".k-prog-time")).toContainText("1 時間");
  expect(
    ((await readAs(page, `/tickets/${t}`)).data as Detail | null)?.ticket?.actual_minutes,
    "口の読み直しで 60 分",
  ).toBe(60);
  // 完了の小窓で終える
  await stageBtn(page).click();
  await page.getByRole("menuitem").filter({ hasText: "確かめて完了にする" }).click();
  const done = page.getByRole("dialog", { name: "完了にする", exact: true });
  await expect(done).toBeVisible();
  for (const c of await done.getByRole("checkbox").all()) await c.check();
  await done.getByRole("button", { name: "確かめて完了にする", exact: true }).click();
  await expect(done).toHaveCount(0);
  await expect(stagePart(page)).toHaveText("完了");
  expect(await stageOf(page, t), "口の読み直しで段が done").toBe("done");
  // 完了の後も書ける（段は done のまま）
  expect(await write(page, "送付済みです。ありがとうございました"), "完了の後の書き込みも受ける（201）").toBe(201);
  await expect(post(page, "送付済みです。ありがとうございました")).toBeVisible();
  expect(await stageOf(page, t), "書いても段は done のまま").toBe("done");
  const line = await readAs(page, `/tickets/${t}/timeline`);
  expect(line.status).toBe(200);
  const text = JSON.stringify(line.data);
  expect(text, "やり取りの読み直しに 1 つ目の書き込み").toContain("宛名を確かめます");
  expect(text, "やり取りの読み直しに完了の後の書き込み").toContain("送付済みです。ありがとうございました");
  await expect(panel(page), "実績の変更の 1 行が残る").toContainText(MSG.timeLine);
});

test("K1152-STG-02 F5 とまたぐ（本物の PC の輪）：PC をつなぐ → 新しいチケットを AI に任せる → 承認待ちの帯 → 段の札は鍵の札「承認待ち」・口で直に段を変えると 409 → やり取りには書ける（段は承認待ちのまま）", async () => {
  test.setTimeout(360_000);
  expect(held.page !== null && held.me !== null, "1 本目が先に通っていること（赤なら緑と言わない）").toBe(true);
  const page = held.page!;
  const me = held.me!;
  const pc = stagingPc(`統合テストの PC (${held.key})`);
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
  const title = `見積を送る 統合テスト ${held.key}`;
  const t = await createTicket(page, me, title, BODY);
  expect(await clickAndAnswer(page, delegateBtn(page), DELEGATE_RE), "任せる口が受ける（201）").toBe(201);
  await expect(execBand(page), "承認待ちの帯が自分で出る").toContainText(MSG.waitingMe, { timeout: LIMIT.toApproval });
  expect(await stageOf(page, t), "口の読み直しで段が awaiting_approval").toBe("awaiting_approval");
  await expect(meta(page).locator(".k-prog-stage-locked"), "段の札は鍵の札").toHaveText("承認待ち");
  await expect(stageBtn(page), "段のメニューを開く札は出ない").toHaveCount(0);
  const r = await patchAs(page, `/tickets/${t}`, {
    stage_key: "hold",
    hold_reason: "止めたい",
    resume_condition: "あとで",
  });
  expect(r.status, "仕組みの段の間は口が断る（409）").toBe(409);
  expect(await write(page, "確認お願いします"), "承認待ちの間も書ける（201）").toBe(201);
  await expect(post(page, "確認お願いします")).toBeVisible();
  expect(await stageOf(page, t), "書いても段は awaiting_approval のまま").toBe("awaiting_approval");
  await expect(execBand(page), "承認待ちの帯のまま").toContainText(MSG.waitingMe);
});

test("K1152-STG-03 会社の分け：別の会社の人は、1 本目のチケットのやり取りも決定も読めず、画面でも開けず、書き込めない（接続の束ね役ごしでも会社が分かれる）", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  expect(held.ticket !== null && held.key !== null && held.page !== null, "1 本目が先に通っていること").toBe(true);
  const page = await device(browser);
  const other = person("別会社");
  expect((await signUpAndEnter(page, other)).status, "別の会社の登録の口が受ける（201）").toBe(201);
  const t = held.ticket!;
  for (const path of [`/tickets/${t}`, `/tickets/${t}/timeline`, `/tickets/${t}/decisions`]) {
    expect([403, 404], `${path.replace(t, "［id］")} の口は 403 か 404`).toContain((await readAs(page, path)).status);
  }
  const typed = (await sendAs(page, "POST", `/tickets/${t}/messages`, { body: "別の会社から書く" })).status;
  expect([403, 404], "別の会社からの書き込みの口は 403 か 404").toContain(typed);
  const res = await page.goto(`/tickets/${t}`);
  expect(res?.status(), "画面は開く").toBe(200);
  // 文は題（h2）と続き（p）に分かれて出るので、囲む物の字（部分一致）で当てる
  await expect(page.getByText(new RegExp(MSG.notFound)), "見つかりませんでしたの画面").toBeVisible();
  await expect(page.locator("body"), "画面のどこにも 1 本目の印が出ない").not.toContainText(held.key!);
  expect(pathOf(page)).toBe(`/tickets/${t}`);
  // 1 本目のやり取りは増えていない（1 本目の人の口の読み直し。読めたこと〔200・1 本目の書き込みが在る〕を先に確かめ、空振りで通さない）
  const mine = await readAs(held.page!, `/tickets/${t}/timeline`);
  expect(mine.status, "1 本目の人はやり取りを読める（200）").toBe(200);
  const mineText = JSON.stringify(mine.data);
  expect(mineText, "読み直しに 1 本目の書き込みが在る").toContain("宛名を確かめます");
  expect(mineText, "別の会社の字は入っていない").not.toContain("別の会社から書く");
});
