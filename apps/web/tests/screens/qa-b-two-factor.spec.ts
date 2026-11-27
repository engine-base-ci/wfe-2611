// K-370「預けたログイン情報の通しの画面の試験を、新しい画面と契約の口で書き直す」の試験（2/2：2 段階認証）。
//   T-B-39（D-117.2〜D-117.5・D-017.2・D-017.4）を、新しい画面（預ける小窓 K-372・コードを入れる小窓 K-357）→ 本物の API（K-352・K-355）
//   → 本物の Bridge の輪（apps/bridge/dist・頼む・待つ・結果は契約の口・K-354）→ 本物の Chrome → 的（/dev/fake-login）で通す。
//   認証アプリは鍵から Bridge が 6 桁を作って入れる（頼まない）／SMS は画面でコードを入れる（Bridge だけに渡る）／一度通したら次は聞かれない／スマホのアプリで承認。
//   選ぶ欄の形（認証アプリのときだけ鍵の欄）は K372-UI-004、返事が無いときに止まるのは K354-BRG-008・K355-API-019・K357-UI-012 が受ける（ここでは通さない）。
//   名前の頭は 11_tickets/K-370.md の行 ID、続けて正本の行 ID（op_gate.py が読む）。本人の Bridge は使わない。固定の待ちは使わない。
//   流すのは CI の画面の組の専用の段 G73（Bridge を組み立てた後・scripts/ci/web_run.py gate 73・K-379）。e2e:k の一覧（G48）には入れない（Bridge の組み立てが要る）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { admin, signupViaApi } from "../_lib/api";
import { row } from "../k/credentials-mock";
import {
  SMS_CODE,
  TOTP_KEY,
  aimAtFake,
  cleanUp,
  deposit,
  dev,
  fakeUrl,
  openFresh,
  runBridge,
  settled,
  stopBridges,
} from "./credential-e2e";

// 1 本の試験で本物の Chrome のログインを 1〜3 回通す（1 回 10〜20 秒）
test.setTimeout(300_000);
test.afterEach(() => cleanUp());

const codeDialog = (page: Page, name: string) => page.getByRole("dialog", { name: `${name} のコードを入れる` });
/** 行の札が「コードが要る」になるまで待ち（画面は 3 秒ごとに読み直す・K357-UI-004）、「コードを入れる」で小窓を開く */
async function openCode(page: Page, name: string) {
  await expect(row(page, name)).toContainText("コードが要る", { timeout: 90_000 });
  await row(page, name).getByRole("button", { name: "コードを入れる", exact: true }).click();
  await expect(codeDialog(page, name)).toBeVisible();
  return codeDialog(page, name);
}
const asksOf = async (memberId: string) =>
  Number(
    (
      await admin<{ n: string }>("select count(*) as n from bridge_job_events where member_id = $1 and kind = 'ask'", [
        memberId,
      ])
    )[0]!.n,
  );

test("K370-E2E-005 CHT-39-001 SCR-CREDENTIALS-054 SCR-CREDENTIALS-055 2 段階「認証アプリ（鍵を預ける）」で鍵ごと預けると、行は two_factor totp で、Bridge が鍵から 6 桁を作って入る：本人に頼まない（頼みの出来事 0・コードを入れる が出ない）で「使える」", async ({
  page,
}) => {
  const u = await openFresh(page);
  const id = await deposit(page, { name: "K370_TOTP", twoFactor: "認証アプリ（鍵を預ける）", totp: TOTP_KEY });
  expect(
    (await admin<{ two_factor_id: string }>("select two_factor_id from credentials where id = $1", [id]))[0],
  ).toEqual({ two_factor_id: "totp" });
  await aimAtFake(id, fakeUrl("totp"));
  await runBridge(u);
  expect(await settled(page, id, "K370_TOTP")).toBe("ok");
  await expect(row(page, "K370_TOTP")).toContainText("使える");
  await expect(row(page, "K370_TOTP").getByRole("button", { name: "コードを入れる", exact: true })).toHaveCount(0);
  expect(await asksOf(u.memberId)).toBe(0);
});

test("K370-E2E-006 CHT-39-002 SCR-CREDENTIALS-052 SCR-CREDENTIALS-053 SMS：Bridge がコードの画面で止まり、行が「コードが要る」。小窓「K370_SMS のコードを入れる」に届いたコードを入れて「PC に渡す」→「使える」。コードは仕事の出来事・証跡・会話のどこにも残らず、証跡は 答えた → 確かめ の順", async ({
  page,
}) => {
  const u = await openFresh(page);
  const id = await deposit(page, { name: "K370_SMS", twoFactor: "SMS" });
  await aimAtFake(id, fakeUrl("sms"));
  await runBridge(u);
  const d = await openCode(page, "K370_SMS");
  await expect(d).toContainText("SMS で届いた");
  await d.getByLabel("コード").fill(SMS_CODE);
  await d.getByRole("button", { name: "PC に渡す" }).click();
  await expect(d).toHaveCount(0);
  expect(await settled(page, id, "K370_SMS")).toBe("ok");
  await expect(row(page, "K370_SMS")).toContainText("使える");
  const dump = JSON.stringify([
    await admin("select payload from bridge_job_events where member_id = $1", [u.memberId]),
    await admin("select payload from audit_events where tenant_id = $1", [u.tenantId]),
    await admin("select body from messages where tenant_id = $1", [u.tenantId]),
  ]);
  expect(dump).not.toContain(SMS_CODE);
  const a = await admin<{ action: string }>(
    "select action from audit_events where tenant_id = $1 and action in ('credential.two_factor_answered', 'credential.login_check') order by created_at",
    [u.tenantId],
  );
  expect(a.map((x) => x.action)).toEqual(["credential.two_factor_answered", "credential.login_check"]);
});

test("K370-E2E-007 CHT-39-003 一度通した的（同じ端末の印）は、次に預けたときコードを聞かれない（Bridge のブラウザがログインを覚えている）：2 人目の確かめは頼みの出来事 0 で「使える」", async ({
  page,
}) => {
  const device = dev();
  const first = await openFresh(page);
  const a = await deposit(page, { name: "K370_SMS_ONCE", twoFactor: "SMS" });
  await aimAtFake(a, fakeUrl("sms", device));
  await runBridge(first);
  const d = await openCode(page, "K370_SMS_ONCE");
  await d.getByLabel("コード").fill(SMS_CODE);
  await d.getByRole("button", { name: "PC に渡す" }).click();
  expect(await settled(page, a, "K370_SMS_ONCE")).toBe("ok");
  stopBridges();

  // 2 回目：別の口座で同じ的を預ける（同じ PC の試験の輪は同じログインの状態を持つ）
  const second = await openFresh(page, await signupViaApi());
  const b = await deposit(page, { name: "K370_SMS_AGAIN", twoFactor: "SMS" });
  await aimAtFake(b, fakeUrl("sms", device));
  await runBridge(second);
  expect(await settled(page, b, "K370_SMS_AGAIN")).toBe("ok");
  await expect(row(page, "K370_SMS_AGAIN")).toContainText("使える");
  expect(await asksOf(second.memberId)).toBe(0);
});

test("K370-E2E-008 CHT-39-003 スマホのアプリで承認：行が「コードが要る」になり、小窓は欄の無い「スマホのアプリで「承認」を押してから」で「PC に渡す」→「使える」", async ({
  page,
}) => {
  const u = await openFresh(page);
  const id = await deposit(page, { name: "K370_PUSH", twoFactor: "スマホのアプリで承認" });
  await aimAtFake(id, fakeUrl("push"));
  await runBridge(u);
  const d = await openCode(page, "K370_PUSH");
  await expect(d).toContainText("スマホのアプリで「承認」を押してから");
  await expect(d.getByLabel("コード")).toHaveCount(0);
  await d.getByRole("button", { name: "PC に渡す" }).click();
  expect(await settled(page, id, "K370_PUSH")).toBe("ok");
  await expect(row(page, "K370_PUSH")).toContainText("使える");
});
