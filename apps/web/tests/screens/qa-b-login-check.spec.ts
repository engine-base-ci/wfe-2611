// K-370「預けたログイン情報の通しの画面の試験を、新しい画面と契約の口で書き直す」の試験（1/2：預けたらその場で 1 回ログインだけ試す・鍵は実行の間だけ）。
//   T-B-38（D-117.1・D-117.6）と T-B-05（D-102.2・D-017.1）を、新しい画面（/settings/credentials・K-356／K-372）→ 本物の API（createCredential・K-352／確かめの仕事・K-355）
//   → 本物の Bridge の輪（apps/bridge/dist・取り出しと結果の知らせは契約の口・K-354）→ 本物の Chrome → 的のログイン画面（/dev/fake-login）で通す。
//   的に向ける所（使える場所と仕事の開く先の直置き）は共通の道具 credential-e2e.ts の aimAtFake の注のとおり。
//   名前の頭は 11_tickets/K-370.md の行 ID、続けて正本の行 ID（op_gate.py が読む）。本人の Bridge は使わない。固定の待ちは使わない。
//   流すのは CI の画面の組の専用の段 G73（Bridge を組み立てた後・scripts/ci/web_run.py gate 73・K-379）。e2e:k の一覧（G48）には入れない（Bridge の組み立てが要る）。
//   ファイルを読むだけの 2 行（K370-SRC-001・K370-DOC-001）は G48 が流す apps/web/tests/k/k370-credential-e2e-docs.spec.ts に在る。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { admin } from "../_lib/api";
import { row } from "../k/credentials-mock";
// 作り物の秘密の値は apps/web/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K370_WRONG_PASSWORD } from "../../test/_fake/secrets";
import {
  PASSWORD,
  aimAtFake,
  cleanUp,
  deposit,
  fakeUrl,
  jobsOf,
  openFresh,
  runBridge,
  settled,
} from "./credential-e2e";

// 1 本の試験で本物の Chrome のログインを 1〜2 回通す（1 回 10〜20 秒）
test.setTimeout(240_000);
test.afterEach(() => cleanUp());

function filesContain(dir: string, needle: string): string[] {
  const hits: string[] = [];
  const walk = (p: string): void => {
    let names: string[];
    try {
      names = readdirSync(p);
    } catch (e) {
      // 置き場がまだ無い（輪が一度も Chrome を開いていない）なら探す物が無い。ほかの誤りは試験を落とす
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
    for (const f of names) {
      const q = join(p, f);
      const st = statSync(q, { throwIfNoEntry: false });
      if (!st) continue; // 見ている間に Chrome が消した一時ファイル
      if (st.isDirectory()) walk(q);
      else if (st.size < 50 * 1024 * 1024 && readFileSync(q).includes(needle)) hits.push(q);
    }
  };
  walk(dir);
  return hits;
}

test("K370-E2E-001 CHT-38-001 BRG-05-004 正しいログイン情報を新しい画面で預けると、行の札が「確かめている」→ Bridge が 1 回だけ入って「使える」。読み直しても同じ。仕事は 1 件で閉じ、証跡は 取り出し（credential.bridge_resolve）→ 確かめ（credential.login_check）の順に 1 つずつ", async ({
  page,
}) => {
  const u = await openFresh(page);
  const id = await deposit(page, { name: "K370_OK" });
  await expect(row(page, "K370_OK")).toContainText("確かめている");
  await aimAtFake(id, fakeUrl("ok"));
  await runBridge(u);
  expect(await settled(page, id, "K370_OK")).toBe("ok");
  await expect(row(page, "K370_OK")).toContainText("使える");
  await page.reload();
  await expect(row(page, "K370_OK")).toContainText("使える");
  const jobs = await jobsOf(u);
  expect(jobs.map(({ kind, state_id, result, browser }) => ({ kind, state_id, result, browser }))).toEqual([
    { kind: "login_check", state_id: "done", result: "ok", browser: "dedicated" },
  ]);
  const a = await admin<{ action: string }>(
    "select action from audit_events where tenant_id = $1 and action in ('credential.bridge_resolve', 'credential.login_check') order by created_at",
    [u.tenantId],
  );
  expect(a.map((x) => x.action)).toEqual(["credential.bridge_resolve", "credential.login_check"]);
});

test("K370-E2E-002 CHT-38-002 パスワードが違う → 行の札が「パスワードが違う」で「もう一度確かめる」が押せる。仕事は 1 件だけで done・bad_password（勝手に試し直さない）", async ({
  page,
}) => {
  const u = await openFresh(page);
  const id = await deposit(page, { name: "K370_BAD", password: K370_WRONG_PASSWORD });
  await aimAtFake(id, fakeUrl("ok"));
  await runBridge(u);
  expect(await settled(page, id, "K370_BAD")).toBe("bad_password");
  await expect(row(page, "K370_BAD")).toContainText("パスワードが違う");
  await expect(row(page, "K370_BAD").getByRole("button", { name: "もう一度確かめる", exact: true })).toBeEnabled();
  const jobs = await jobsOf(u);
  expect(jobs.map(({ state_id, result }) => ({ state_id, result }))).toEqual([
    { state_id: "done", result: "bad_password" },
  ]);
});

test("K370-E2E-003 CHT-38-002 2 段階を「なし」で預けたのに的が 2 段階を求める → 札は「止まった」（needs_2fa）。CAPTCHA の的 → 札は「画像の確認で止まった」（captcha）。どちらも仕事は 1 件ずつ", async ({
  page,
}) => {
  const u = await openFresh(page);
  const a = await deposit(page, { name: "K370_TWOSTEP" });
  await aimAtFake(a, fakeUrl("2fa"));
  const b = await deposit(page, { name: "K370_CAPTCHA" });
  await aimAtFake(b, fakeUrl("captcha"));
  await runBridge(u);
  expect(await settled(page, a, "K370_TWOSTEP")).toBe("needs_2fa");
  await expect(row(page, "K370_TWOSTEP")).toContainText("止まった");
  expect(await settled(page, b, "K370_CAPTCHA")).toBe("captcha");
  await expect(row(page, "K370_CAPTCHA")).toContainText("画像の確認で止まった");
  expect((await jobsOf(u)).length).toBe(2);
});

test("K370-E2E-004 CHT-38-003 BRG-05-004 鍵は実行の間だけ：入った後、画面・DB（仕事・預けたログイン情報・証跡・仕事の出来事）・Bridge の置き場（試験の輪の tmp/kaname-bridge）のどこにもパスワードの字が無い", async ({
  page,
}) => {
  const u = await openFresh(page);
  const id = await deposit(page, { name: "K370_SECRET" });
  await aimAtFake(id, fakeUrl("ok"));
  await runBridge(u);
  expect(await settled(page, id, "K370_SECRET")).toBe("ok");
  expect(await page.locator("body").innerText()).not.toContain(PASSWORD);
  const dump = JSON.stringify([
    await admin("select * from bridge_jobs where member_id = $1", [u.memberId]),
    await admin("select * from credentials where tenant_id = $1", [u.tenantId]),
    await admin("select * from audit_events where tenant_id = $1", [u.tenantId]),
    await admin("select * from bridge_job_events where member_id = $1", [u.memberId]),
  ]);
  expect(dump).not.toContain(PASSWORD);
  const hits = filesContain(join(tmpdir(), "kaname-bridge"), PASSWORD).map((x) => x.replace(tmpdir(), ""));
  expect(hits, `Bridge の置き場に値が残っている: ${hits.join(", ")}`).toEqual([]);
});
