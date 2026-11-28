// K-1150 段 4 の中間テスト（M1）：「PC と使った量」の PC の行の操作と、預けたログイン情報を、1 人・1 台の試験の PC の上でつなぐ（D-128.131）。
//   中の 1 本 1 本の分岐は各葉の単体（口 K-352・K-355・K-362・K-364・K-365、画面 K-356・K-357・K-363・K-368・K-372）が持つ。ここは「つないだときにだけ出るもの」を見る：
//   ① PC の無いときに預けた物は、PC をつないだ最初の知らせで確かめの仕事が積まれ、その PC に渡る（K-352 × K-355 × K-357 × K-360）
//   ② 画面で選んだ AI が使うブラウザが、その PC の生きている知らせの答えに届く（K-368 × K-364 × K-360）
//   ③ Chrome ✗ の自己診断 → 画面の一手「もう一度確かめる」→ その PC が確かめの仕事を取る → ✓ の自己診断で画面が「つながりました」（K-368 × K-365 × K-360）
//   ④ AI に任せている間に、その PC を画面から外す（F3 × F5 の流れをまたぐ）：仕事は止まり、チケットは作業中に戻り、PC の印は使えない（K-363 × K-362 × K-62）
//   口は網の手前で差し替えない（page.route で答えを作らない。届く頭 x-forwarded-for を足す ownIp と、本人の Bridge 38617 を画面から隠す hideRealBridge だけ）。
//   人は _lib/newcomer.ts、PC は _lib/prep.ts の pairedPc と _lib/f5-flow.ts の workOf（K-64・K-399 と同じ）。前からある道具は変えない。
//   自己診断を載せた生きている知らせは、試験の PC の beat が health を空でしか送らないので、ここで同じ形（頭 x-bridge-session・Bridge の名乗り・本文 { health, protocol }）で送る。
//   置き場は tests/skeleton（CI の web の組の G59）。固定の待ちは使わない（expect が画面・DB・口の答えの変わるのを待つ）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { API, PW, admin, hideRealBridge, setupStep } from "../_lib/api";
import { ticketState, workOf, type Job, type PcWork } from "../_lib/f5-flow";
import { Mailbox } from "../_lib/mailbox";
import { newcomer, ownIp, type Newcomer } from "../_lib/newcomer";
import { pairedPc, pressDelegate, ticketOf } from "../_lib/prep";
import type { TestPc } from "../_lib/test-pc";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());
// 1 本の上限：登録（画面とメール）・PC の引き取り・一覧の読み直し（5 秒ごと）を待つ切り替わりが 1 本に数回ある（K-64・K-399 と同じ 120 秒）
test.describe.configure({ timeout: 120_000 });

/** 文（各葉の md と正本から。実装から書かない） */
const MSG = {
  noPc: "PC がつながると確かめる", // K-356 の札（no_bridge）
  checking: "確かめている", // K-356 の札（pending・running・waiting）
  saved: "変えました。次の仕事から使います", // K-368
  ok: "つながりました。AI は Chrome を使えます", // K-368
  removed: "外しました。もう一度つなぐときは、この画面からつなぎ直してください", // K-363
  stopped: "PC を外したので止まりました", // K-362 の止めた訳
} as const;
const CHROME_CHECK = "AI が Chrome を使える（Claude in Chrome）"; // K-360・K-368 の自己診断の行の名前
const CRED = "K1150_PORTAL_LOGIN";
const SECTIONS = {
  purpose: "先方に見積を送る",
  done: "先方が見積を受け取った",
  todo: "- 見積を作る\n- 先方に送る",
} as const;

// ---------------------------------------------------------------- 道具（この試験の中だけ）
const CRED_SEC = 'section[aria-labelledby="credentials-title"]';
const PC_SEC = 'section[aria-labelledby="pc-list-title"]';
const credRow = (page: Page) => page.locator(`${CRED_SEC} .k-set-row`, { hasText: CRED });
const pcRow = (page: Page, label: string) => page.locator(`${PC_SEC} .k-pc-row`, { hasText: label });
const pick = (page: Page, label: string) => pcRow(page, label).locator("[data-browser-pick]");
const radio = (page: Page, label: string, v: string) => pick(page, label).locator(`input[type="radio"][value="${v}"]`);
const fix = (page: Page, label: string) => pcRow(page, label).locator('[data-part="browser-fix"]');
const checkDlg = (page: Page) => page.getByRole("dialog", { name: "本人か確かめます", exact: true });

/** 本物の Bridge の名乗りと約束の版（test-pc.ts・f5-flow.ts と同じ読み方） */
function bridgeWords(): { ua: string; protocol: number } {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  const from = createRequire(join(root, "apps/bridge/src/main.ts"));
  return {
    ua: (from("./pairing.ts") as { BRIDGE_UA: string }).BRIDGE_UA,
    protocol: (from("./loop.ts") as { BRIDGE_PROTOCOL: number }).BRIDGE_PROTOCOL,
  };
}
type Check = { name: string; ok: boolean; detail: string };
/** 自己診断を載せた生きている知らせを 1 回送る（輪の知らせと同じ形）。口の番号と答えの browser を返す */
async function beatWith(pc: TestPc, health: Check[]): Promise<{ status: number; browser: string | null }> {
  const w = bridgeWords();
  const token = pc.token();
  if (!token) throw new Error("まだつながっていない PC は知らせない");
  const r = await fetch(`${API}/api/v1/bridge/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bridge-session": token, "user-agent": w.ua },
    body: JSON.stringify({ health, protocol: w.protocol }),
  });
  const j = (await r.json().catch(() => ({}))) as { data?: { browser?: string } };
  return { status: r.status, browser: j.data?.browser ?? null };
}
const chrome = (ok: boolean): Check[] => [
  {
    name: CHROME_CHECK,
    ok,
    detail: ok ? "つながっています（中間テスト）" : "つながっていません（中間テスト）。Chrome を開いてください",
  },
];
/** 本人確認の取り直しを求められたら、パスワードで通す（求められなければ何もしない）。done は取り直しが要らなかったときに出る物 */
async function passStepUpIfAsked(page: Page, done: Locator): Promise<void> {
  await expect(checkDlg(page).or(done).first(), "取り直しの小窓か、終わった印のどちらかが出る").toBeVisible();
  if (!(await checkDlg(page).isVisible())) return;
  await checkDlg(page).getByLabel("パスワード", { exact: true }).fill(PW);
  await checkDlg(page).getByRole("button", { name: "確かめる", exact: true }).click();
  await expect(checkDlg(page)).toHaveCount(0);
}
async function openPcPage(page: Page, label: string): Promise<void> {
  const res = await page.goto("/setup/bridge");
  expect(res?.status()).toBe(200);
  await expect(pcRow(page, label)).toHaveCount(1);
}
async function openVault(page: Page): Promise<void> {
  const res = await page.goto("/settings/credentials");
  expect(res?.status()).toBe(200);
  await expect(page.locator(`${CRED_SEC} h1`)).toHaveText("預けたログイン情報");
}
const credJobs = (credentialId: string) =>
  admin<{ id: string; state_id: string; target: string | null; taken: string | null }>(
    "select id, state_id, target_session_id::text as target, taken_session_id::text as taken from bridge_jobs where credential_id = $1 and kind = 'login_check' order by created_at",
    [credentialId],
  );

// ---------------------------------------------------------------- 1 人・1 台の上でつなぐ
test.describe.serial("中間 M1：PC の行と預けたログイン情報を、1 人・1 台の試験の PC の上でつなぐ", () => {
  let ctx: BrowserContext;
  let page: Page;
  let me: Newcomer;
  let pc: TestPc;
  let w: PcWork;
  let credId = "";
  const label = `段 4 の MacBook ${randomUUID().slice(0, 4)}`;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({ timezoneId: "Asia/Tokyo" });
    await ownIp(ctx, 71);
    page = await ctx.newPage();
    await hideRealBridge(page);
    me = await newcomer(page, box, `段4 ${randomUUID().slice(0, 6)}`);
    // はじめの設定の段の門（RequireSetup・D-089）は、まだの人を今の段（1 PC をつなぐ）へ戻す。預けたログイン情報は段 4 なので、
    //   PC をつながずに 1〜3 を通したことにする（PC の行は作らない＝「PC の無いときに預ける」のまま）
    await setupStep(me.memberId, 3);
  });
  test.afterAll(async () => {
    await pc?.close();
    await ctx.close();
  });

  test("K1150-M1-01 PC の無いときに預ける → 札「PC がつながると確かめる」・確かめの仕事 0 → PC をつないで最初の知らせ → 仕事がちょうど 1 つ積まれ、開き直すと札「確かめている」・その PC が取る仕事はこの預けた物の login_check", async () => {
    await openVault(page);
    await page.locator(`${CRED_SEC} .k-page-head`).getByRole("button", { name: "預ける", exact: true }).click();
    const d = page.getByRole("dialog", { name: "ログイン情報を預ける", exact: true });
    await expect(d).toBeVisible();
    await d.getByLabel("名前", { exact: true }).fill(CRED);
    await d.getByLabel("ログイン ID", { exact: true }).fill("k1150@example.com");
    await d.getByLabel("パスワード", { exact: true }).fill(`k1150-${randomUUID()}`);
    await d.getByLabel("使える場所", { exact: true }).fill("k1150-portal.example");
    const created = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/v1/credentials" && r.request().method() === "POST" && r.status() === 201,
    );
    await d.getByRole("button", { name: "本人確認して保存", exact: true }).click();
    await passStepUpIfAsked(page, credRow(page));
    credId = ((await (await created).json()) as { data: { id: string } }).data.id;
    await expect(credRow(page).locator(".k-set-pill")).toHaveText(MSG.noPc);
    expect(await credJobs(credId), "PC の無いうちは確かめの仕事を積まない").toEqual([]);
    // PC をつなぐ（引き取りと最初の知らせ 1 回）→ 最初の知らせで確かめの仕事が積まれる（K-355 の引き金）
    pc = await pairedPc(page, me.token, label);
    w = workOf(pc);
    const deviceId = await pc.deviceId();
    await expect.poll(async () => (await credJobs(credId)).length, "最初の知らせで仕事がちょうど 1 つ").toBe(1);
    await openVault(page);
    await expect(credRow(page).locator(".k-set-pill")).toHaveText(MSG.checking);
    let got: Job | null = null;
    await expect.poll(async () => (got ??= await w.take()), "その PC が仕事を取る").not.toBeNull();
    expect(got!.kind, "渡った仕事はログインの確かめ").toBe("login_check");
    const [job] = await credJobs(credId);
    expect(job!.state_id, "取った仕事は動いている").toBe("running");
    expect(job!.id).toBe(got!.job_id);
    expect(job!.taken, "仕事を取ったのはその PC").toBe(deviceId);
  });

  test("K1150-M1-02 PC の行の「AI が使うブラウザ」で「Bridge 専用のブラウザ」→「変えました」・DB の browser が dedicated・その PC の次の知らせの答えも dedicated。「自分の Chrome」に戻すと知らせの答えも chrome", async () => {
    await openPcPage(page, label);
    await expect(radio(page, label, "chrome"), "つないだばかりの PC は自分の Chrome").toBeChecked();
    await pick(page, label).locator(".k-pc-choice", { hasText: "Bridge 専用のブラウザ" }).click();
    await expect(pcRow(page, label).getByRole("status").filter({ hasText: MSG.saved })).toBeVisible();
    await expect(radio(page, label, "dedicated")).toBeChecked();
    const [s] = await admin<{ b: string }>("select browser as b from sessions where id = $1", [await pc.deviceId()]);
    expect(s!.b).toBe("dedicated");
    expect(await beatWith(pc, []), "PC の次の知らせの答えに届く").toEqual({ status: 201, browser: "dedicated" });
    await page.reload();
    await expect(radio(page, label, "dedicated"), "開き直しても dedicated").toBeChecked();
    await pick(page, label).locator(".k-pc-choice", { hasText: "自分の Chrome" }).click();
    await expect(radio(page, label, "chrome")).toBeChecked();
    await expect.poll(async () => (await beatWith(pc, [])).browser, "戻した値も PC に届く").toBe("chrome");
  });

  test("K1150-M1-03 PC が Chrome ✗ の自己診断を送る → 行に一手 →「もう一度確かめる」→ その PC 宛ての確かめの仕事が 1 つ・その PC が取る → ✓ の自己診断を送ると一手が消え「つながりました。AI は Chrome を使えます」", async () => {
    expect((await beatWith(pc, chrome(false))).status).toBe(201);
    await openPcPage(page, label);
    await expect(fix(page, label), "Chrome ✗ の行に一手が出る").toBeVisible();
    const asked = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        /\/api\/v1\/bridge\/devices\/[^/]+\/browser-check$/.test(new URL(r.url()).pathname),
    );
    await fix(page, label).locator("[data-browser-check]").click();
    const res = await asked;
    expect(res.status(), "確かめの口が受ける").toBe(201);
    const jobId = ((await res.json()) as { data: { job_id: string } }).data.job_id;
    const [queued] = await admin<{ target: string; state: string }>(
      "select target_session_id::text as target, state_id as state from bridge_jobs where id = $1",
      [jobId],
    );
    expect(queued).toEqual({ target: await pc.deviceId(), state: "queued" });
    let got: Job | null = null;
    await expect.poll(async () => (got ??= await w.take()), "その PC が確かめの仕事を取る").not.toBeNull();
    expect(got!.job_id).toBe(jobId);
    expect((await w.finish(jobId, { state: "done", result: "Chrome とつながりました" })).status).toBe(201);
    expect((await beatWith(pc, chrome(true))).status).toBe(201);
    await expect(pcRow(page, label).getByRole("status").filter({ hasText: MSG.ok })).toBeVisible({ timeout: 30_000 });
    await expect(fix(page, label)).toHaveCount(0);
  });

  test("K1150-M1-04 AI に任せている間（PC が作る段の仕事を取った）に、画面の「…」→「この PC を外す」→ 確かめの小窓で「外す」（取り直しが要れば通す）→ 行が消え「外しました…」。仕事は止まり、チケットは作業中・AI に任せた印は外れ、やり取りに止めた訳。外した PC の知らせと仕事の取りは 401", async () => {
    const title = `見積を送る 段4 中間 ${randomUUID().slice(0, 6)}`;
    const t = await ticketOf(page, me, title, SECTIONS);
    const r = await page.goto(`/tickets/${t}`);
    expect(r?.status()).toBe(200);
    await pressDelegate(page);
    let job: Job | null = null;
    await expect.poll(async () => (job ??= await w.take()), "任せた仕事がその PC に渡る").not.toBeNull();
    expect(job!.ticket_id).toBe(t);
    expect((await ticketState(t)).stage).toBe("running");
    // 画面から外す
    await openPcPage(page, label);
    await pcRow(page, label).getByRole("button", { name: /^…/ }).click();
    await page.getByRole("menuitem", { name: "この PC を外す", exact: true }).click();
    const confirm = page.getByRole("alertdialog", { name: `「${label}」を外しますか？`, exact: true });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "外す", exact: true }).click();
    const done = page.getByRole("status").filter({ hasText: MSG.removed });
    await passStepUpIfAsked(page, done);
    await expect(done).toBeVisible();
    await expect(pcRow(page, label)).toHaveCount(0);
    // F5 側に効く：仕事は止まり、チケットは作業中に戻り、やり取りに訳が残る
    const [j] = await admin<{ state: string; reason: string | null }>(
      "select state_id as state, stopped_reason as reason from bridge_jobs where id = $1",
      [job!.job_id],
    );
    expect(j).toEqual({ state: "stopped", reason: MSG.stopped });
    expect((await ticketState(t)).stage, "チケットは作業中に戻る").toBe("doing");
    const [mark] = await admin<{ d: boolean }>("select delegated_to_clone as d from tickets where id = $1", [t]);
    expect(mark!.d, "AI に任せた印は外れる").toBe(false);
    const lines = await admin<{ body: string }>(
      "select body from ticket_messages where ticket_id = $1 and kind = 'system' and deleted_at is null",
      [t],
    );
    expect(lines.map((x) => x.body).join("\n"), "やり取りに止めた訳").toContain("PC を外した");
    // 外した PC の印は使えない
    expect(await pc.beat(), "外した PC の知らせは 401").toBe(401);
    await expect(w.take(), "外した PC は仕事を取れない").rejects.toThrow("401");
  });
});
