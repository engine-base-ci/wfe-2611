// K-65 統合テスト：歩く骨格を端から端まで（登録 → 本物のメール → 規約 → PC をつなぐ → チケットを作る → AI に任せる → 承認して完了）を staging で通す（D-128.131・D-128.144）。
//   中の 1 本 1 本の分岐は単体（K-51〜K-63）と中間テスト（K-54 の m1・K-58 の m2・K-64 の m3）が開発の環境で持つ。ここで見るのは 2 つだけ：
//   ① 7 つの操作が、1 人の上で、本物の外のサービスの上でつながること ② staging でしか出ないもの（本物のメール・本物の置き場・口と画面が別の住所・
//   接続の束ね役ごしの会社の分け・本物の PC の輪の間合い）。
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204）。「できた」はその回の JUnit の記録で決める（PM の決め 1）。チケットの CI（枝）では流れない。
//   ★試験のための抜け道を作らない：口の答えを網の手前で作らない（page.route を使わない）・製品に試験用の分かれ道を足さない・DB は読みも書きもしない
//     （確かめは画面・同じブラウザからの口の読み直し・Resend の記録だけ・PM の決め 2）・固定の待ちを置かない（画面と記録が変わるのを待つ）。
//   ★記録に出さない：staging の住所・試験の宛先・確認のリンク・鍵・PC の印。確かめの文は自分で付け、住所は道（pathname）だけを比べる。
//     Playwright が落ちた文に付ける URL は、報告（_lib/scrub-reporter.ts）が JUnit と標準出力から伏せる。画面の写し・trace は残さない（設定）。
//   ★人と PC：メールは Resend の試験用の宛先へ本当に送り、Resend の記録を読む（D-140.1）。PC は組み立てた Bridge（K-97）。正常の 1 本は輪そのものを回し、
//     AI は偽の Claude Code（D-141.1）。試験が作った人・会社・PC・チケットは staging に残す（名前に「統合テスト」）。1 回の通しで登録は 9 人（1 分に 10 回の上限の中）。
//   行 ID（K65-STG-NN）を試験の名前の頭に持つ。08（外のサービスが落ちる）と 09（リンクの期限）は staging では作れないので試験を持たない（チケットの judge-skip）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。直すのは道具（_lib）と設定の側。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { FAKE_REPLY_HEAD, stagingPc, type Job, type StagingPc } from "./_lib/bridge";
import { countTo, latestTo, readMail, verifyLink } from "./_lib/resend";
import { scrub } from "./_lib/scrub.mjs";
import { WEB } from "./_lib/site";
import {
  APPROVE_RE,
  COMPLETE_RE,
  DELEGATE_RE,
  aiBand,
  aiOf,
  approveBtn,
  clickAndAnswer,
  codeOnScreen,
  completeBtn,
  createTicket,
  delegateBtn,
  enterByLink,
  execBand,
  h1,
  hasLoginMark,
  liveOn,
  loginByForm,
  openConnect,
  pathOf,
  person,
  readAs,
  submitSignup,
  type Person,
} from "./_lib/steps";

/** 文言（K-51・K-57・K-62・K-63 の仕様の表・errors.json・決定から。実装から書かない。中間テストと同じ文） */
const MSG = {
  sent: "確認メールを送りました", // K-51 の待つ画面の見出し
  queuedLive: "PC が受け取るのを待っています", // K-62 の帯・任せた直後（D-133.1）
  checkNone: "検査なし（まだ流していません）", // D-128.138
  waitingMe: "あなたの承認を待っています", // K-63 の帯
  irreversible: "取り消せません", // D-128.177
  running: "実行中", // K-63 の帯
  completeHint: "完了の条件を確かめて完了にしてください", // K-63 の帯
  empty: "いま決めるものはありません", // K-63 の承認待ちの画面・空
  notFound: "見つかりませんでした。消されたか、見る権限が無いかもしれません", // E-PAGE-001（別の会社のチケットの詳細）
  loadFailed: "読み込めませんでした", // E-PAGE-007（配布物の目録が読めない・K-133）
  todo: "未着手",
} as const;
/** メールの決まり（D-096・packages/config の既定と同じ。staging は既定のまま） */
const MAIL = {
  from: "Kaname <noreply@engine-base.com>",
  replyTo: "info@engine-base.com",
  subject: "Kaname｜メールアドレスの確認（登録を確定する）",
  /** 確定の後の 1 通（K-52・D-128.146）。数えるときは件名で分ける（K-208） */
  doneSubject: "【Kaname】登録が完了しました",
  operator: /運営：.+（代表 .+）/,
  contact: "お問い合わせ：info@engine-base.com",
  /** 電話は載せない（D-096.3）：「電話」「TEL」の字と、番号の形 */
  phone: /電話|TEL|ＴＥＬ|0\d{1,4}[-‐ー−(（]\d{1,4}[-‐ー−)）]\d{3,4}/i,
} as const;
/** 本文から、リンクの行を除いた文（リンクの乱数の字に「tel」などが当たって、電話の確かめが誤って赤にならないように） */
const proseOf = (text: string): string =>
  text
    .split("\n")
    .filter((line) => !/https?:\/\//.test(line))
    .join("\n");
/** チケットの区画（実施事項は 2 項目＝完了の小窓のチェック 2 つ・K-64 と同じ形）。偽の AI の合図の語（聞いて・消して・長く・落ちて など）を入れない。
 *  実施事項の「- 」の行は、仕事の文に全文で入る（区画は切らない）。偽の AI は「- 」で始まる行を見ると、その行を並べた答え（FAKE_REPLY_HEAD）を返す */
const BODY = {
  purpose: "先方に出す見積のたたき台を作って送る",
  done: "先方が見積を受け取った",
  todo: "- 見積を作る\n- 先方に送る",
} as const;
/** 実施事項の 2 項目（偽の AI の答えに並ぶ行・完了の小窓のチェックの名前） */
const TODO_ITEMS = ["見積を作る", "先方に送る"] as const;
const titleOf = (tag: string): string => `見積を送る 統合テスト ${tag}`;
/** K65-STG-05 で、輪を回さない PC が返す決まった結果（AI は呼ばない） */
const RESULT_A = "見積のたたき台：合計 120,000 円（統合テスト）";

/** 時間の上限（ミリ秒）。根拠はチケットの「時間の上限」の表。試験ごとの上限は test.setTimeout（どれも 8 分以下）。回の上限は 30 分（K-204） */
const LIMIT = {
  mailRecord: 90_000, // 登録の口の答えから、Resend の記録に出るまで（筋を進めるための待ち）
  mailDelivered: 60_000, // K65-STG-02 の期待結果（60 秒以内に delivered）
  toApproval: 120_000, // K65-STG-01 の期待結果（任せてから承認待ちの帯まで・手で読み直さない）
  toExecuted: 120_000, // 承認から、実行が終わって完了の案内が出るまで
  afterApprove: 40_000, // K65-STG-04 の期待結果（輪の待ち受け 20 秒＋空の後の 5 秒＋余裕）
  firstView: 30_000, // staging の最初の 1 回は口の起き上がりが遅い（無料の枠）
} as const;

/** K65-STG-04 が読む、K65-STG-01 の測った秒（数だけ。秘密は書かない）。01 が落ちても残るように、台の一時の置き場に書く
 *  （Playwright は落ちた試験の後に作業の子を作り直すので、変数では渡らない。親の番号で回を分ける） */
const EVIDENCE = join(process.env["RUNNER_TEMP"] ?? tmpdir(), `k65-stg-${process.ppid}`, "after-approve.json");
function saveAfterApprove(ms: number): void {
  mkdirSync(join(EVIDENCE, ".."), { recursive: true });
  writeFileSync(EVIDENCE, JSON.stringify({ ms }), "utf8");
}
function loadAfterApprove(): number | null {
  try {
    const v = (JSON.parse(readFileSync(EVIDENCE, "utf8")) as { ms?: unknown }).ms;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

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
function pcOf(tag: string): StagingPc {
  const pc = stagingPc(`統合テストの PC (${tag})`);
  pcs.push(pc);
  return pc;
}
/** 別のブラウザ（cookie も localStorage も別） */
async function device(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ baseURL: WEB, viewport: { width: 1440, height: 1000 } });
  contexts.push(ctx);
  return { ctx, page: await ctx.newPage() };
}

/** 登録の画面 → Resend の記録に出た確認のメール → リンクを開く →「続ける」→ 使い始めの画面。歩く骨格の頭（K-51・K-52・K-53 の正常の筋） */
async function signUpAndEnter(page: Page, me: Person): Promise<void> {
  expect(await submitSignup(page, me), "登録の口が受ける（201）").toBe(201);
  await expect(h1(page, MSG.sent)).toBeVisible();
  // 記録の一覧は 2 秒おきに 1 回だけ読み、見つけた 1 通の id をそのまま使う（Resend の口の回数の上限に当てない）
  const found: { mail: Awaited<ReturnType<typeof latestTo>> } = { mail: null };
  await expect
    .poll(async () => (found.mail ??= await latestTo(me.email)) !== null, {
      message: "確認のメールが Resend の記録に出る",
      timeout: LIMIT.mailRecord,
      intervals: [2_000],
    })
    .toBe(true);
  const mail = await readMail(found.mail!.id);
  const link = verifyLink(mail);
  expect(link !== null, "メールの本文に確認のリンクがある").toBe(true);
  expect(await enterByLink(page, link!), "メールのリンクの先が開ける（200）").toBe(200);
  expect(await hasLoginMark(page), "ログインの印を持つ").toBe(true);
}
/** PC をつなぐの画面のコードを、組み立てた Bridge の引き取りに渡す（まだ知らせは送らない） */
async function claimOnScreen(page: Page, pc: StagingPc): Promise<void> {
  expect(await openConnect(page), "PC をつなぐの画面が開く（200）").toBe(200);
  const claimed = await pc.claim(await codeOnScreen(page));
  expect(claimed, "画面に出たコードを、組み立てた Bridge の引き取りが通す").toEqual({ ok: true, message: null });
}
/** 試験が 1 回ずつ知らせる PC（輪は回さない）を、画面のコードでつなぐ → 画面が自分で「つながっています」に変わる */
async function connectQuietPc(page: Page, pc: StagingPc): Promise<void> {
  await claimOnScreen(page, pc);
  expect(await pc.beat(), "生きている知らせが通る（201）").toBe(201);
  await expect(liveOn(page), "画面が自分で気づく（再読み込みしない）").toContainText(pc.label, {
    timeout: LIMIT.firstView,
  });
}
const openTicket = async (page: Page, id: string, title: string): Promise<void> => {
  const res = await page.goto(`/tickets/${id}`);
  expect(res?.status(), "チケットの詳細が開く（200）").toBe(200);
  await expect(h1(page, title)).toBeVisible({ timeout: LIMIT.firstView });
};
/** 実行の記録（新しい順）の段と状態と、任せた人の名前 */
async function runsOf(page: Page, id: string): Promise<{ status: number; runs: [string, string, string][] }> {
  const r = await readAs(page, `/tickets/${id}/runs`);
  const rows = Array.isArray(r.data)
    ? (r.data as { phase?: string; status?: string; by?: { display_name?: string } }[])
    : [];
  return {
    status: r.status,
    runs: rows.map((x) => [x.phase ?? "", x.status ?? "", x.by?.display_name ?? ""]),
  };
}
/** その人の PC の一覧（名前と生死） */
async function devicesOf(page: Page): Promise<{ status: number; pcs: [string, string][] }> {
  const r = await readAs(page, "/bridge/devices");
  const rows = Array.isArray(r.data) ? (r.data as { device_label?: string | null; state?: string }[]) : [];
  return { status: r.status, pcs: rows.map((d) => [d.device_label ?? "", d.state ?? ""]) };
}

test("K65-STG-01 正常・端から端（本物のメール・本物の PC の輪）：登録 → メールのリンク → 続ける → PC をつなぐ → チケットを作る → AI に任せる → 輪が作る段を終える → 承認して送る → 同じ輪が実行の段を終える → 完了にする", async ({
  page,
}) => {
  test.setTimeout(480_000);
  const me = person("正常");
  const title = titleOf("正常");
  await signUpAndEnter(page, me);

  // PC をつなぐ：画面のコードを、組み立てた Bridge が引き取り、輪を回し始める。輪の最初の知らせで画面が自分で変わる
  const pc = pcOf("正常");
  await claimOnScreen(page, pc);
  pc.startLoop();
  await expect(liveOn(page), "輪の最初の知らせで、画面が自分で「つながっています」に変わる").toContainText(pc.label, {
    timeout: LIMIT.firstView,
  });
  await page.getByRole("link", { name: "戻る" }).click();
  await expect.poll(() => pathOf(page), "開いた画面（チケットの画面）へ戻る").toBe("/tickets");

  // チケットを作る → AI に任せる
  const t = await createTicket(page, me, title, BODY);
  await expect(page.getByText(MSG.todo, { exact: true }), "作った直後は未着手").toBeVisible();
  expect(await clickAndAnswer(page, delegateBtn(page), DELEGATE_RE), "任せる口が受ける（201）").toBe(201);

  // 輪が作る段を取り、偽の AI の答えで終える → 開いたままの画面が承認待ちの帯に替わる（手で読み直さない）
  await expect(execBand(page), "任せてから 120 秒以内に、承認待ちの帯が自分で出る").toContainText(MSG.waitingMe, {
    timeout: LIMIT.toApproval,
  });
  await expect(execBand(page), "輪が動かした AI の答えが、成果物として帯に出る").toContainText(FAKE_REPLY_HEAD);
  for (const item of TODO_ITEMS)
    await expect(execBand(page), `画面で書いた実施事項（${item}）が、輪の仕事を通って成果物に出る`).toContainText(item);
  await expect(execBand(page)).toContainText(MSG.checkNone);
  await expect(execBand(page)).toContainText(MSG.irreversible);
  // 承認するまで実行の段は動かない（TP-AI-01）：承認の前の実行の記録は、終わった作る段の 1 件だけ
  expect(await runsOf(page, t), "承認の前：実行の記録は作る段の 1 件だけ（実行の段はまだ無い）").toEqual({
    status: 200,
    runs: [["make", "done", me.name]],
  });

  // 承認待ちの画面に 1 行（取り消せない扱いなので行では決めず「中身を見る」・D-128.36・D-128.177）
  await page.goto("/approvals");
  const line = page.getByRole("row").filter({ hasText: title });
  await expect(line, "承認待ちの画面に 1 行").toHaveCount(1);
  await expect(line).toContainText(aiOf(me));
  await line.getByRole("link", { name: "中身を見る" }).click();
  await expect.poll(() => pathOf(page), "行からチケットの詳細の帯へ").toBe(`/tickets/${t}`);

  // 承認して送る → 同じ輪が実行の段を取って終える。押してから帯が替わるまでの秒を測る（K65-STG-04 が読む）
  // 押すと確かめの小窓（K-229・D-143.4）。成果物を目で見たに印を付け、小窓の「承認して送る」で口を呼ぶ
  await approveBtn(page).click();
  const sure = page.getByRole("alertdialog");
  await sure.getByRole("checkbox", { name: "成果物を目で見た" }).check();
  expect(
    await clickAndAnswer(page, sure.getByRole("button", { name: "承認して送る", exact: true }), APPROVE_RE),
    "承認の口が受ける（201）",
  ).toBe(201);
  const approvedAt = Date.now();
  await expect(approveBtn(page), "決めた承認を二度は押させない").toHaveCount(0);
  const moved = execBand(page).getByText(MSG.running, { exact: true }).or(execBand(page).getByText(MSG.completeHint));
  await expect(moved.first(), "承認の後、輪が実行の段を受け取って帯が替わる").toBeVisible({
    timeout: LIMIT.toExecuted,
  });
  saveAfterApprove(Date.now() - approvedAt);
  await expect(execBand(page).getByText(MSG.completeHint), "実行が終わると完了の案内に替わる").toBeVisible({
    timeout: LIMIT.toExecuted,
  });

  // 完了にする（実施事項 2 つと完了の条件を確かめる）
  await completeBtn(page).click();
  const d = page.getByRole("dialog");
  for (const item of TODO_ITEMS) await d.getByRole("checkbox", { name: item }).check();
  await d.getByRole("checkbox", { name: "完了の条件を満たしたことを確かめました" }).check();
  expect(
    await clickAndAnswer(page, d.getByRole("button", { name: "確かめて完了にする" }), COMPLETE_RE),
    "完了の口が受ける（201）",
  ).toBe(201);
  await expect(
    execBand(page).getByText(/完了しました（.+・\d{1,2}\/\d{1,2} \d{1,2}:\d{2}）/),
    "最後に「完了しました（名前・日時）」が出る",
  ).toBeVisible();
  await expect(execBand(page)).toContainText(me.name);
  await expect(completeBtn(page), "完了したら「完了にする」は出ない").toHaveCount(0);
  await expect(delegateBtn(page), "完了したチケットは任せられない").toHaveCount(0);

  // 別の GET で読み直す：再読み込みしても完了のまま。実行の記録は 作る → 実行 の 2 件がどちらも終わっていて、任せた人は本人。PC は 1 台で生きている。承認待ちは空
  await page.reload();
  await expect(execBand(page).getByText(/完了しました（.+）/), "読み直しても完了のまま").toBeVisible({
    timeout: LIMIT.firstView,
  });
  expect(await runsOf(page, t), "実行の記録（新しい順）：実行・作る の 2 件が終わっている").toEqual({
    status: 200,
    runs: [
      ["execute", "done", me.name],
      ["make", "done", me.name],
    ],
  });
  expect(await devicesOf(page), "この人の PC は、画面でつないだ 1 台で、つながっている").toEqual({
    status: 200,
    pcs: [[pc.label, "live"]],
  });
  // 確定の後には「登録が完了しました」の 1 通も届く（K-52・決まりどおり）。件名で分けて、それぞれ 1 通（K-208）
  expect(await countTo(me.email, MAIL.subject), "確認のメールは 1 通だけ（二重に送っていない）").toBe(1);
  expect(await countTo(me.email, MAIL.doneSubject), "登録が完了しましたのメールも 1 通だけ").toBe(1);
  await page.goto("/approvals");
  await expect(page.getByText(MSG.empty), "決め終わったら承認待ちは空").toBeVisible();
});

test("K65-STG-02 本物のメールの到達と中身：登録の直後に Resend の記録を読む。60 秒以内に delivered・差出人・返信先・署名（電話なし）・リンクの頭が staging の画面", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const me = person("メール");
  expect(await submitSignup(page, me), "登録の口が受ける（201）").toBe(201);
  await expect(h1(page, MSG.sent)).toBeVisible();
  const found: { mail: Awaited<ReturnType<typeof latestTo>> } = { mail: null };
  await expect
    .poll(async () => (found.mail = await latestTo(me.email))?.lastEvent ?? "まだ無い", {
      message: "送ってから 60 秒以内に、Resend の記録が delivered になる",
      timeout: LIMIT.mailDelivered,
      intervals: [2_000],
    })
    .toBe("delivered");
  const mail = await readMail(found.mail!.id);
  expect(
    { from: mail.from, replyTo: mail.replyTo, subject: mail.subject, toCount: mail.to.length },
    "差出人・返信先・件名（D-096）。宛先は登録した 1 件だけ",
  ).toEqual({ from: MAIL.from, replyTo: [MAIL.replyTo], subject: MAIL.subject, toCount: 1 });
  expect(MAIL.operator.test(mail.text), "本文に運営者の署名（運営：会社（代表 名前））").toBe(true);
  expect(mail.text.includes(MAIL.contact), "本文にお問い合わせの届け先").toBe(true);
  expect(MAIL.phone.test(proseOf(mail.text)), "本文（リンクの行のほか）に電話番号は出ない（D-096.3）").toBe(false);
  const link = verifyLink(mail);
  expect(link !== null, "本文に確認のリンクがある").toBe(true);
  expect(new URL(link!).origin === WEB, "リンクの頭が staging の画面の住所と同じ（WEB_BASE_URL）").toBe(true);
  expect(mail.text.includes(me.password), "本文にパスワードは出ない").toBe(false);
  expect(await countTo(me.email), "同じ宛先に 1 通だけ").toBe(1);
});

test("K65-STG-03 本物の置き場：PC をつなぐの画面の配布物。署名つきのリンクは読めて、署名を外すと読めない", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const me = person("置き場");
  await signUpAndEnter(page, me);
  expect(await openConnect(page), "PC をつなぐの画面が開く（200）").toBe(200);
  await expect(page.getByTestId("pairing-code"), "画面が読み終わっている（コードが出ている）").toBeVisible({
    timeout: LIMIT.firstView,
  });
  await expect(page.getByText(MSG.loadFailed), "配布物の目録を読めている").toHaveCount(0);
  const latest = await readAs(page, "/bridge/releases/latest?os=mac&arch=arm64");
  const data = (latest.data ?? {}) as { released?: boolean; update?: { url?: string } | null };
  expect(
    { status: latest.status, released: data.released, hasLink: typeof data.update?.url === "string" },
    "配布物の口：staging の置き場に配布物が在り、受け取りのリンクが付く",
  ).toEqual({ status: 200, released: true, hasLink: true });
  const signed = new URL(data.update!.url!);
  expect(signed.search.length > 1, "受け取りのリンクは署名つき").toBe(true);
  const head = async (url: URL): Promise<number> => {
    const res = await fetch(url, { headers: { range: "bytes=0-0" }, signal: AbortSignal.timeout(30_000) });
    await res.body?.cancel();
    return res.status;
  };
  expect([200, 206].includes(await head(signed)), "署名つきのリンクは読める（200。頭だけ読むので 206 も）").toBe(true);
  const bare = new URL(signed);
  bare.search = "";
  expect([200, 206].includes(await head(bare)), "同じリンクから署名を外すと読めない（200 以外）").toBe(false);
});

test("K65-STG-04 承認の直後の間合い（K-194）：K65-STG-01 の中で測った「承認して送る」から帯が替わるまでが 40 秒以内", async () => {
  test.setTimeout(30_000);
  const info = test.info();
  const ms = loadAfterApprove();
  expect(ms !== null, "K65-STG-01 が承認の後の帯の替わりまで進んで、秒を測っている").toBe(true);
  info.annotations.push({
    type: "承認から帯が替わるまでの秒（K-194 に渡す）",
    description: String(Math.round(ms! / 1000)),
  });
  expect(ms!, "承認して送るから 40 秒以内に帯が替わる（輪の待ち受け 20 秒＋空の後の 5 秒＋余裕）").toBeLessThanOrEqual(
    LIMIT.afterApprove,
  );
});

test("K65-STG-05 別の会社に漏れない（接続の束ね役ごし）：別の 2 人が 登録（順に）→ 並んで つなぐ → 作る。A が任せても B の PC には渡らず、B の画面と口に A のものが出ない", async ({
  page,
  browser,
}) => {
  test.setTimeout(420_000);
  const a = person("会社A");
  const b = person("会社B");
  const other = await device(browser);
  // 登録だけは順に（Resend の記録を読む口の回数の上限に、2 人ぶんの読みを重ねない）。その後は 2 人が並んで進む（同じ時に別の会社の読み書きが束ね役を通る）
  await signUpAndEnter(page, a);
  await signUpAndEnter(other.page, b);
  const pcA = pcOf("会社A");
  const pcB = pcOf("会社B");
  await Promise.all([connectQuietPc(page, pcA), connectQuietPc(other.page, pcB)]);
  const [ta, tb] = await Promise.all([
    createTicket(page, a, titleOf("会社A"), BODY),
    createTicket(other.page, b, titleOf("会社B"), BODY),
  ]);

  // A が任せる → B の PC が取りに来ても空。A の PC には A のチケットの仕事が渡る
  expect(await pcA.beat(), "任せる直前に A の PC が生きている").toBe(201);
  expect(await clickAndAnswer(page, delegateBtn(page), DELEGATE_RE), "A の任せる口が受ける（201）").toBe(201);
  await expect(aiBand(page), "A の仕事が積まれている").toContainText(MSG.queuedLive);
  expect(await pcB.take(), "別の会社の PC の取りは空（201・job は null）").toEqual({ status: 201, job: null });
  let job: Job | null = null;
  await expect
    .poll(async () => (job ??= (await pcA.take()).job)?.ticket_id ?? null, { message: "A の仕事は A の PC に渡る" })
    .toBe(ta);
  await expect(aiBand(page), "A の PC が受け取ったことに、A の画面が自分で気づく").toContainText(
    `${aiOf(a)} が作っています`,
  );
  expect(await pcB.take(), "A の PC が動かしている間も、B の PC の取りは空").toEqual({ status: 201, job: null });
  // A の PC が作る段を中身のある結果で終える → A には承認待ちが 1 行できる（B に漏れないかを見る物を、先に作る）
  expect(await pcA.finish(job!.job_id, RESULT_A), "A の PC の終わりを口が受け、承認待ちになる").toEqual({
    status: 201,
    outcome: "awaiting_approval",
  });
  await expect(execBand(page), "A の画面は承認待ちの帯に替わる").toContainText(MSG.waitingMe);
  // 読みを 10 回ずつ並べる：隣の問い合わせに会社の文脈が残らない（A は自分のチケットが読め、B には A のチケットが無い）
  const rounds = await Promise.all(
    Array.from({ length: 10 }, async () => {
      const [mine, theirs, own] = await Promise.all([
        readAs(page, `/tickets/${ta}`),
        readAs(other.page, `/tickets/${ta}`),
        readAs(other.page, `/tickets/${tb}`),
      ]);
      return [mine.status, `${theirs.status} ${theirs.code}`, own.status];
    }),
  );
  expect(
    rounds,
    "10 回とも：A は自分のチケット 200・B は A のチケット 404（NOT_FOUND）・B は自分のチケット 200",
  ).toEqual(Array.from({ length: 10 }, () => [200, "404 NOT_FOUND", 200]));
  const theirRuns = await readAs(other.page, `/tickets/${ta}/runs`);
  expect({ status: theirRuns.status, code: theirRuns.code }, "B は A の実行の記録を読めない（404・NOT_FOUND）").toEqual(
    { status: 404, code: "NOT_FOUND" },
  );

  // B の画面：承認待ちは空で A の行が無い。A のチケットの詳細は「見つかりませんでした」
  await other.page.goto("/approvals");
  await expect(other.page.getByText(MSG.empty), "B の承認待ちの画面は空").toBeVisible({ timeout: LIMIT.firstView });
  await expect(other.page.getByRole("row").filter({ hasText: titleOf("会社A") }), "B に A の行は 0 件").toHaveCount(0);
  await other.page.goto(`/tickets/${ta}`);
  await expect(other.page.getByText(MSG.notFound), "B には A のチケットが「見つかりませんでした」").toBeVisible({
    timeout: LIMIT.firstView,
  });
  await expect(h1(other.page, titleOf("会社A")), "A の題名は B には出ない").toHaveCount(0);
  await expect(execBand(other.page), "B に A の承認の帯は出ない").toHaveCount(0);
  // A の画面：承認待ちは自分の 1 行だけ。A から B のチケットは口で見る（K-208：チケットの一覧の口 listTickets はまだ契約だけで 501。
  //   画面は 501 を空として「まだチケットがありません」を出すので、一覧では確かめられない。一覧での確かめは一覧のチケット K-92 に申し送り）
  await page.goto("/approvals");
  await expect(page.getByRole("row").filter({ hasText: titleOf("会社A") }), "A の承認待ちは自分の 1 行").toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: titleOf("会社B") }), "A に B の行は 0 件").toHaveCount(0);
  const [detailToB, runsToB] = [await readAs(page, `/tickets/${tb}`), await readAs(page, `/tickets/${tb}/runs`)];
  expect(
    [
      { status: detailToB.status, code: detailToB.code },
      { status: runsToB.status, code: runsToB.code },
    ],
    "A は B のチケットの詳細と実行の記録を読めない（どちらも 404・NOT_FOUND）",
  ).toEqual([
    { status: 404, code: "NOT_FOUND" },
    { status: 404, code: "NOT_FOUND" },
  ]);
  // 一覧の「live」は最後の知らせから 75 秒の窓。ここまでの画面の歩きで窓を越えないよう、読む直前に知らせ直す（06 と同じ）
  expect([await pcA.beat(), await pcB.beat()], "読む直前に、2 台とも知らせが通る（201）").toEqual([201, 201]);
  expect((await devicesOf(page)).pcs, "A の PC の一覧は自分の 1 台だけ").toEqual([[pcA.label, "live"]]);
  expect((await devicesOf(other.page)).pcs, "B の PC の一覧は自分の 1 台だけ").toEqual([[pcB.label, "live"]]);
});

test("K65-STG-06 入り直し（口と画面が別の住所）：チケットを作った後にブラウザを閉じ、別のブラウザからログインの画面で入って、同じチケットを開いて任せる", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const me = person("入り直し");
  const title = titleOf("入り直し");
  const first = await device(browser);
  await signUpAndEnter(first.page, me);
  const pc = pcOf("入り直し");
  await connectQuietPc(first.page, pc);
  const t = await createTicket(first.page, me, title, BODY);
  await first.ctx.close(); // ブラウザを閉じる（cookie・localStorage のログインの印を捨てる）

  const again = await device(browser);
  await loginByForm(again.page, me);
  expect(pathOf(again.page) !== "/login", "ログインが通る（ログインの画面に残らない）").toBe(true);
  expect(await hasLoginMark(again.page), "入り直したブラウザがログインの印を持つ").toBe(true);
  await openTicket(again.page, t, title);
  // 行き先が決まった後（詳細の題名が出た後）に道を見る：同意し直しの段に送り返されていない
  expect(
    [pathOf(again.page), new URL(again.page.url()).searchParams.get("step")],
    "同意し直しの段には止まらない（規約の版は変わっていない）。開いたのはチケットの詳細",
  ).toEqual([`/tickets/${t}`, null]);
  await expect(again.page.getByText(MSG.todo, { exact: true }), "途中の状態（未着手）が残っている").toBeVisible();
  expect((await readAs(again.page, `/tickets/${t}`)).status, "画面と別の住所の口が、入り直した印を通す（200）").toBe(
    200,
  );
  expect(await pc.beat(), "前のブラウザでつないだ PC はつながったまま（知らせが 201）").toBe(201);
  expect((await devicesOf(again.page)).pcs, "入り直した人の PC の一覧に、前につないだ 1 台").toEqual([
    [pc.label, "live"],
  ]);
  expect(await clickAndAnswer(again.page, delegateBtn(again.page), DELEGATE_RE), "任せる口が受ける（201）").toBe(201);
  await expect(aiBand(again.page), "任せると、前につないだ PC が受け取るのを待つ").toContainText(MSG.queuedLive);
  await expect
    .poll(async () => (await pc.take()).job?.ticket_id ?? null, {
      message: "入り直してから任せた仕事が、前につないだ PC に渡る",
    })
    .toBe(t);
});

test("K65-STG-07 同じ送り元から続けて登録：同じ台から 3 人が続けて登録しても、3 人とも受け付けられる（429 は 0 回）", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const statuses: number[] = [];
  for (const tag of ["続けて1", "続けて2", "続けて3"]) {
    const one = await device(browser);
    statuses.push(await submitSignup(one.page, person(tag)));
    await expect(h1(one.page, MSG.sent), `${tag}：待つ画面へ進む`).toBeVisible();
  }
  expect(statuses, "3 人とも登録の口が 201（429 は 0 回）").toEqual([201, 201, 201]);
});
