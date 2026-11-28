// 預けたログイン情報の通しの画面の試験（K-370）の共通の道具：新しい画面（/settings/credentials・K-356／K-372／K-357）で預け、
//   本物の API（createCredential・K-352）→ 確かめの仕事（K-355）→ 本物の Bridge の輪（apps/bridge/dist・K-354 の契約の口）→ 本物の Chrome → 的のログイン画面（/dev/fake-login）を通す。
//   的は 127.0.0.1 の開発用の画面なので、預ける口は使える場所に通さない（IP は E-CRED-002・K352-API-009）。そこで、画面で「本物の名前」で預けた後、
//   Bridge の輪を回す前に、その行の使える場所と確かめの仕事の開く先だけを行の直置きで的に向ける（aimAtFake）。値・金庫・取り出し・結果の知らせは本物のまま。
//   本人の Bridge は使わない（試験の輪は tmp の kaname-bridge）。固定の待ちは使わない（行の札と DB の状態を待つ）。
//   流すのは CI の画面の組の専用の段 G73（Bridge を組み立てた後・scripts/ci/web_run.py gate 73・K-379）。
//   セッションの見張り（端末が変わると閉じる・K-20）とぶつからない形にしてある：ブラウザのログインの印を Node から使わない（下の nodeLogin の注）。
//   Bridge の印（x-bridge-session）で口を叩くのは Bridge の輪だけ（試験の側から直には叩かない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { PW, admin, api, loginAs, setupDone, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";
import { PATH, SEC, addDialog, choose, openAdd, row, save } from "../k/credentials-mock";
// 作り物の秘密の値は apps/web/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K370_PASSWORD, K370_TOTP_KEY } from "../../test/_fake/secrets";

export const WEB = process.env["BASE_URL"] ?? "http://127.0.0.1:3124";
/** 的（/dev/fake-login）が通すログイン名とパスワード（apps/web/app/(dev)/dev/fake-login/page.tsx の頭の注） */
export const LOGIN = "me@example.com";
export const PASSWORD = K370_PASSWORD;
export const SMS_CODE = "246810";
export const TOTP_KEY = K370_TOTP_KEY;

export type User = Awaited<ReturnType<typeof signupViaApi>>;
/** 預ける小窓の「2 段階の種類」の選び（K-372 の小窓の字） */
export type TwoFactor = "なし" | "認証アプリ（鍵を預ける）" | "SMS" | "メール" | "スマホのアプリで承認";

/** 試験ごとに止める Bridge の輪 */
export const bridges: AgentBridge[] = [];
export function stopBridges(): void {
  for (const b of bridges.splice(0)) b.stop();
}

/** 的の「端末」を試験ごとに分ける（覚えた Cookie がほかの試験に効かないように） */
export const dev = (): string => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
export const fakeUrl = (mode: string, device = dev()): string => `${WEB}/dev/fake-login?mode=${mode}&dev=${device}`;

/** 登録 → はじめの設定を済ませた人（Bridge の行が 1 つある＝PC あり。輪はまだ回さない）→ 新しい画面を開く */
export async function openFresh(page: Page, u?: User): Promise<User> {
  const who = u ?? (await signupViaApi());
  await setupDone(who);
  await loginAs(page, who.token);
  const listed = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/credentials");
  expect((await page.goto(PATH))?.status()).toBe(200);
  await listed;
  await expect(page.locator(`${SEC} h1`)).toHaveText("預けたログイン情報");
  return who;
}

/** 預ける小窓でログイン情報を 1 件預ける（名前・本物らしい使える場所・ID・パスワード・2 段階）。POST が 201 で返り小窓が閉じるまで待つ */
export async function deposit(
  page: Page,
  o: { name: string; password?: string; twoFactor?: TwoFactor; totp?: string },
): Promise<string> {
  await openAdd(page);
  const d = addDialog(page);
  await d.getByLabel("名前", { exact: true }).fill(o.name);
  await d.getByLabel("ログイン ID").fill(LOGIN);
  await d.getByLabel("パスワード", { exact: true }).fill(o.password ?? PASSWORD);
  if (o.twoFactor && o.twoFactor !== "なし") await choose(page, "2 段階の種類", o.twoFactor);
  if (o.totp) await d.getByLabel(/認証アプリの鍵/).fill(o.totp);
  await d.getByLabel("使える場所").fill(`${o.name.toLowerCase().replace(/_/g, "-")}.example`);
  const created = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/v1/credentials" && r.request().method() === "POST",
  );
  await save(page).click();
  const res = await created;
  expect(res.status(), `預ける口の答え：${await res.text()}`).toBe(201);
  await expect(addDialog(page)).toHaveCount(0);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

/** 確かめの仕事（積まれたまま・まだ誰も取っていない）を的に向ける：行の使える場所に 127.0.0.1 を足し、仕事の開く先を的の URL に */
export async function aimAtFake(credentialId: string, url: string): Promise<string> {
  await admin("update credentials set destinations = array['127.0.0.1'] where id = $1", [credentialId]);
  const jobs = await admin<{ id: string }>(
    "update bridge_jobs set prompt = $2 where credential_id = $1 and kind = 'login_check' and state_id = 'queued' returning id",
    [credentialId, url],
  );
  expect(jobs.length, "積まれた確かめの仕事がちょうど 1 つ").toBe(1);
  return jobs[0]!.id;
}

/** Node から口を叩くための、この人の別のログイン。ブラウザのログインの印（u.token）は Node から使わない。
 *  セッションの見張り（app.session_check・K-20）は、セッションごとに最初に来た要求の端末（User-Agent から読むブラウザの種類と OS）を覚え、
 *  同じ印が違う端末から来たら「端末が変わった」でそのセッションを閉じる。ブラウザが使っている印を Node（名乗りが違う）から 1 回でも使うと、
 *  画面のセッションが閉じて画面の口が 401 になる（2026-11-19 の CI のお試しで本線の版が落ちた訳）。
 *  別のログイン＝別のセッションで、そちらは Node だけが使うので、どちらも閉じない（同じ人が別の端末からもログインしているのと同じ形） */
async function nodeLogin(u: User): Promise<string> {
  const r = await api<{ data?: { token?: string | null } }>("/api/v1/auth/sign-in", { email: u.email, password: PW });
  const token = r.json.data?.token;
  if (r.status !== 201 || !token) throw new Error(`Node 用のログインができない（sign-in ${r.status}）`);
  return token;
}

/** この人の PC で本物の Bridge の輪を回し始める（積まれた確かめの仕事を取る）。
 *  接続コード（この PC を登録するコード）は Node 用のログインで出す（startAgentBridge が Node から本人の印で口を叩くため）。Bridge の印で口を叩くのは輪だけ */
export async function runBridge(u: User): Promise<AgentBridge> {
  const b = await startAgentBridge(await nodeLogin(u), {});
  bridges.push(b);
  return b;
}

/** 試験の後片付け：輪を止め、落ちた試験なら手がかりを CI の記録に出す（口の記録 api.log に Bridge の行は出ない）。
 *  出すのは、この 15 分の確かめの仕事（login_check）とセッションの状態だけ（種類・結果・端末・閉じた訳。値は出さない） */
export async function cleanUp(): Promise<void> {
  stopBridges();
  const info = test.info();
  if (info.status === info.expectedStatus) return;
  const jobs = await admin(
    "select kind, state_id, result, browser from bridge_jobs where kind = 'login_check' and created_at > now() - interval '15 minutes' order by created_at",
  );
  const sessions = await admin(
    "select kind_id, device, revoke_reason_id from sessions where issued_at > now() - interval '15 minutes' order by issued_at",
  );
  console.log(
    `[K-370] 落ちた試験の手がかり\n  仕事：${JSON.stringify(jobs)}\n  セッション：${JSON.stringify(sessions)}`,
  );
}

/** 画面の行（名前で引く）の札が、確かめの途中（確かめている）から抜けるまで待ち、DB の結果を返す（本物の Chrome で 1 回入るので 90 秒まで） */
export async function settled(page: Page, credentialId: string, name: string): Promise<string> {
  await expect
    .poll(
      async () =>
        (
          await admin<{ s: string | null }>("select login_check_state as s from credentials where id = $1", [
            credentialId,
          ])
        )[0]?.s ?? "",
      { timeout: 90_000, intervals: [1_000] },
    )
    .not.toMatch(/^(|pending|running|asking|waiting)$/);
  await expect(row(page, name)).not.toContainText("確かめている", { timeout: 15_000 });
  return (
    (await admin<{ s: string }>("select login_check_state as s from credentials where id = $1", [credentialId]))[0]
      ?.s ?? ""
  );
}

/** 確かめの仕事の行（この人の分） */
export const jobsOf = (u: User) =>
  admin<{ id: string; kind: string; state_id: string; result: string | null; browser: string }>(
    "select id, kind, state_id, result, browser from bridge_jobs where member_id = $1 order by created_at",
    [u.memberId],
  );
