// K-1151 統合テスト（段 4・F3 使い始めの準備）：PC をつなぐ・AI が使うブラウザを選ぶ・ログイン情報を預ける／上書き／消す・PC を外す を、
//   staging（本番と同じ形・D-128.144）の上で端から端まで通す。中の分岐は単体（K-348〜K-379）と中間テスト（K-1150・開発の環境）が持つ。ここで見るのは 2 つだけ：
//   ① 操作が 1 人の上で、本物の口・本物の金庫（staging の Infisical・D-101）・組み立てた Bridge の上でつながること
//   ② staging でしか出ないもの（口と画面が別の住所で PC の行・預けた物が通る・接続の束ね役ごしの会社の分け）。
//   流れるのは main から手で起こす staging-e2e.yml の回だけ（K-204・K-65・K-596 と同じ）。「できた」はその回の JUnit で決める。チケットの CI（枝）では流れない。
//   ★PC の輪は回さない：預けた時点で確かめの仕事が積まれ（PC がある＝外していない Bridge の行が在る・K-355）、輪を回すとその仕事を取って staging で本物の Chrome を開こうとする（的のサイトが staging に無い）。
//     画面のコードを組み立てた Bridge が引き取り、知らせを 1 回ずつ送るだけで、積まれた仕事は取らせない（ログインの確かめを本物の Chrome で通すのは K-370 が CI の G73 で持つ）。
//   ★試験のための抜け道を作らない：page.route を使わない・製品に試験用の分かれ道を足さない・DB は読みも書きもしない（確かめは画面・同じブラウザからの口の読み直しだけ）・固定の待ちを置かない。
//   ★記録に出さない：住所・宛先・確認のリンク・鍵・パスワード・認証アプリの鍵・預けた値（預ける値にも伏せる形の尻の印を付け、_lib/scrub-reporter.ts が形で伏せる）。
//   人は steps.ts の person。2 段階は画面で付ける（_lib/enter-steps.ts）。PC は組み立てた Bridge（K-97・_lib/bridge.ts）。
//   試験が作った人・会社・PC は staging に残す（名前に「統合テスト」）。預けた物は 03 で消す。1 回の通しで登録 2 人・メール 4 通前後。
//   行 ID（K1151-STG-NN）を試験の名前の頭に持つ。04（本物の Chrome でログインの確かめ）・05（古い Bridge の入れ直し）は staging では作れないので試験を持たない（チケットの judge-skip）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。直すのは道具（_lib）と設定の側
import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { stagingPc, type StagingPc } from "./_lib/bridge";
import { patchAs, pressAndAnswer, pressThroughStepUp, signUpAndEnter, stepUpIfAsked } from "./_lib/enter-steps";
import { WEB } from "./_lib/site";
import { codeOnScreen, liveOn, openConnect, person, readAs, type Person } from "./_lib/steps";

/** 文（K-356・K-357・K-363・K-368・K-372 の仕様の表・モックから。実装から書かない） */
const MSG = {
  saved: "変えました。次の仕事から使います", // K-368
  checking: "確かめている", // K-356 の札（pending）
  removed: "外しました。もう一度つなぐときは、この画面からつなぎ直してください", // K-363
  empty: "まだありません", // K-363 の PC が無い形
} as const;
const LIMIT = { firstView: 30_000 } as const;
/** 預ける値（回ごとの作り物）。尻の印は steps.ts の person のパスワードと同じ形：落ちた文（fill の Call log）に乗っても、伏せる台本（scrub.mjs）が形で伏せる */
const secretValue = (): string => `${randomBytes(18).toString("base64url")}-k65pw-aA1`;
const CRED_SEC = 'section[aria-labelledby="credentials-title"]';
const PC_SEC = 'section[aria-labelledby="pc-list-title"]';
const CRED_RE = /^\/api\/v1\/credentials$/;
const CRED_ONE_RE = /^\/api\/v1\/credentials\/[^/]+$/;
const DEVICE_RE = /^\/api\/v1\/bridge\/devices\/[^/]+$/;

const pcs: StagingPc[] = [];
const contexts: BrowserContext[] = [];
test.afterAll(async () => {
  for (const pc of pcs.splice(0)) pc.close();
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});
async function device(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: WEB, viewport: { width: 1440, height: 1000 } });
  contexts.push(ctx);
  return ctx.newPage();
}
/** 1 本目が 2 本目・3 本目へ渡すもの（同じ働き手の中だけ・書き出さない） */
const held: {
  page: Page | null;
  me: Person | null;
  secret: string | null;
  pc: StagingPc | null;
  credId: string | null;
  deviceId: string | null;
  name: string | null;
} = { page: null, me: null, secret: null, pc: null, credId: null, deviceId: null, name: null };

const credRow = (page: Page, name: string) => page.locator(`${CRED_SEC} .k-set-row`, { hasText: name });
const pcRow = (page: Page, label: string) => page.locator(`${PC_SEC} .k-pc-row`, { hasText: label });
type Listed = { id?: string; name?: string; device_label?: string; browser?: string };
const listOf = (r: { data: unknown }): Listed[] => (Array.isArray(r.data) ? (r.data as Listed[]) : []);

test.describe.configure({ mode: "serial" });

test("K1151-STG-01 使い始めの準備（本物のメール・組み立てた Bridge・本物の金庫）：登録 → PC をつなぐ → AI が使うブラウザを Bridge 専用に → ログイン情報を預ける（本人確認）→ 上書き", async ({
  browser,
}) => {
  test.setTimeout(360_000);
  const page = await device(browser);
  const me = person("準備");
  const key = `準備${Date.now().toString(36)}`;
  const entered = await signUpAndEnter(page, me);
  expect(entered.status, "登録の口が受ける（201）").toBe(201);
  held.page = page;
  held.me = me;
  held.secret = entered.totpSecret;
  // PC をつなぐ（画面のコードを組み立てた Bridge が引き取り、知らせを 1 回）
  const pc = stagingPc(`統合テストの PC (${key})`);
  pcs.push(pc);
  held.pc = pc;
  expect(await openConnect(page), "PC をつなぐの画面が開く（200）").toBe(200);
  expect(await pc.claim(await codeOnScreen(page)), "画面のコードを組み立てた Bridge が引き取る").toEqual({
    ok: true,
    message: null,
  });
  expect(await pc.beat(), "最初の知らせが受かる（201）").toBe(201);
  await expect(liveOn(page), "知らせで画面が自分で変わる").toContainText(pc.label, { timeout: LIMIT.firstView });
  // AI が使うブラウザを Bridge 専用に（口の読み直しで揃う）
  const res = await page.goto("/setup/bridge");
  expect(res?.status(), "PC と使った量の画面が開く").toBe(200);
  await expect(pcRow(page, pc.label)).toHaveCount(1);
  const choice = pcRow(page, pc.label).locator("[data-browser-pick] .k-pc-choice", {
    hasText: "Bridge 専用のブラウザ",
  });
  expect(await pressAndAnswer(page, choice, "PATCH", DEVICE_RE), "選ぶ口が受ける（200）").toBe(200);
  await expect(pcRow(page, pc.label).getByRole("status").filter({ hasText: MSG.saved })).toBeVisible();
  const mine = listOf(await readAs(page, "/bridge/devices")).filter((d) => d.device_label === pc.label);
  expect(
    mine.map((d) => d.browser),
    "口の読み直しで browser が dedicated",
  ).toEqual(["dedicated"]);
  held.deviceId = mine[0]?.id ?? null;
  // ログイン情報を預ける（本物の金庫に入れてから行を作る・本人確認して保存）
  const name = `K1151_${randomBytes(3).toString("hex").toUpperCase()}`;
  held.name = name;
  expect((await page.goto("/settings/credentials"))?.status(), "預けたログイン情報の画面が開く").toBe(200);
  await expect(page.locator(`${CRED_SEC} h1`)).toHaveText("預けたログイン情報");
  await page.locator(`${CRED_SEC} .k-page-head`).getByRole("button", { name: "預ける", exact: true }).click();
  const d = page.getByRole("dialog", { name: "ログイン情報を預ける", exact: true });
  await d.getByLabel("名前", { exact: true }).fill(name);
  await d.getByLabel("ログイン ID", { exact: true }).fill(`k1151-${key}`);
  await d.getByLabel("パスワード", { exact: true }).fill(secretValue());
  await d.getByLabel("使える場所", { exact: true }).fill("k1151-portal.example");
  // 取り直しを求められた回（1 回目の答えが 403）は小窓を通し、やり直しの答えを取る
  const save = d.getByRole("button", { name: "本人確認して保存", exact: true });
  const c = await pressThroughStepUp(page, save, "POST", CRED_RE, me, entered.totpSecret);
  expect(c.status(), "預ける口が受ける（201）").toBe(201);
  held.credId = ((await c.json()) as { data: { id: string } }).data.id;
  await expect(credRow(page, name).locator(".k-set-pill"), "PC があるので確かめを待つ札").toHaveText(MSG.checking);
  const listed = await readAs(page, "/credentials");
  expect(
    listOf(listed).map((x) => x.name),
    "口の読み直しに 1 件",
  ).toContain(name);
  expect(JSON.stringify(listed.data), "答えに金庫の置き場の印を出さない").not.toContain("vault_ref");
  // 上書き（値を替えるときは新しいログイン ID と新しいパスワードの両方・answer=e34268dbfbac・本人確認して上書き）
  await credRow(page, name).getByRole("button", { name: "上書き", exact: true }).click();
  const e = page.getByRole("dialog", { name: `${name} を上書きする`, exact: true });
  await e.getByLabel("新しいログイン ID", { exact: true }).fill(`k1151-${key}-2`);
  await e.getByLabel("新しいパスワード", { exact: true }).fill(secretValue());
  const overwrite = e.getByRole("button", { name: "本人確認して上書き", exact: true });
  const updated = await pressThroughStepUp(page, overwrite, "PATCH", CRED_ONE_RE, me, entered.totpSecret);
  expect(updated.status(), "上書きの口が受ける（200）").toBe(200);
  await expect(e).toHaveCount(0);
  expect(
    listOf(await readAs(page, "/credentials")).map((x) => x.name),
    "上書きの後も 1 件",
  ).toEqual([name]);
});

test("K1151-STG-02 会社の分け：別の会社の人には、1 本目の預けた物も PC も見えず、口で直に変えようとしても断られる（接続の束ね役ごしでも会社が分かれる）", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  expect(
    held.credId !== null && held.deviceId !== null && held.name !== null,
    "1 本目が先に通っていること（赤なら緑と言わない）",
  ).toBe(true);
  const page = await device(browser);
  const other = person("別会社");
  expect((await signUpAndEnter(page, other)).status, "別の会社の登録の口が受ける（201）").toBe(201);
  const creds = await readAs(page, "/credentials");
  expect(creds.status).toBe(200);
  expect(
    listOf(creds).map((x) => x.name),
    "預けた一覧に 1 本目の物は出ない",
  ).not.toContain(held.name);
  const devs = await readAs(page, "/bridge/devices");
  expect(devs.status).toBe(200);
  expect(
    listOf(devs).map((x) => x.id),
    "PC の一覧に 1 本目の PC は出ない",
  ).not.toContain(held.deviceId);
  expect(
    (await patchAs(page, `/credentials/${held.credId}`, { destinations: ["k1151-other.example"] })).status,
    "1 本目の預けた物を変える口は 404",
  ).toBe(404);
  expect(
    (await patchAs(page, `/bridge/devices/${held.deviceId}`, { browser: "off" })).status,
    "1 本目の PC を変える口は 404",
  ).toBe(404);
  expect((await page.goto("/settings/credentials"))?.status()).toBe(200);
  await expect(page.locator(`${CRED_SEC} h1`)).toHaveText("預けたログイン情報");
  await expect(page.locator("body"), "画面のどこにも 1 本目の預けた物の名前が出ない").not.toContainText(held.name!);
  // 1 本目の値は変わっていない（1 本目の人の口の読み直し）
  const mine = listOf(await readAs(held.page!, "/bridge/devices")).filter((d) => d.id === held.deviceId);
  expect(
    mine.map((d) => d.browser),
    "1 本目の PC の browser は dedicated のまま",
  ).toEqual(["dedicated"]);
});

test("K1151-STG-03 片付け：1 本目の人が預けた物を消す（読み直しで 0 件）→ PC を外す（確かめの小窓・本人確認）→ 一覧が空・外した PC の知らせは 401", async () => {
  test.setTimeout(240_000);
  expect(
    held.page !== null && held.me !== null && held.pc !== null && held.name !== null && held.secret !== null,
    "1 本目が先に通っていること",
  ).toBe(true);
  const page = held.page!;
  const pc = held.pc!;
  const name = held.name!;
  expect((await page.goto("/settings/credentials"))?.status()).toBe(200);
  await credRow(page, name).getByRole("button", { name: "消す", exact: true }).click();
  const rm = page.getByRole("alertdialog", { name: `${name} を消しますか？`, exact: true });
  expect(
    await pressAndAnswer(page, rm.getByRole("button", { name: "消す", exact: true }), "DELETE", CRED_ONE_RE),
    "消す口が受ける（200）",
  ).toBe(200);
  await expect(credRow(page, name)).toHaveCount(0);
  expect(
    listOf(await readAs(page, "/credentials")).map((x) => x.name),
    "口の読み直しで 0 件",
  ).not.toContain(name);
  // PC を外す
  expect((await page.goto("/setup/bridge"))?.status()).toBe(200);
  await pcRow(page, pc.label).getByRole("button", { name: /^…/ }).click();
  await page.getByRole("menuitem", { name: "この PC を外す", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: `「${pc.label}」を外しますか？`, exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "外す", exact: true }).click();
  const done = page.getByRole("status").filter({ hasText: MSG.removed });
  await stepUpIfAsked(page, held.me!, held.secret!, done);
  await expect(done).toBeVisible();
  await expect(pcRow(page, pc.label)).toHaveCount(0);
  await expect(page.locator(`${PC_SEC} .k-pc-empty`), "PC が無い形").toHaveText(MSG.empty);
  expect(
    listOf(await readAs(page, "/bridge/devices")).map((d) => d.id),
    "口の読み直しに出ない",
  ).not.toContain(held.deviceId);
  expect(await pc.beat(), "外した PC の知らせは 401").toBe(401);
});
