// T-B-38 ログイン情報を預けたらその場で 1 回ログインだけ試す（D-117.1・D-117.6）を、画面 → API → 本物の Bridge の輪（apps/bridge/dist）→ 本物の Chrome → 的のログイン画面（/dev/fake-login）で通す。
//   預けた直後に行が「順番待ち／試しています」になり、Bridge が 1 回だけ入って（入れたらそのまま出て）、結果が行に出る。
//   入れなければ理由と一手（パスワードが違う／2 段階／CAPTCHA／規約で禁止／PC が無い）。値は画面・DB・証跡・Bridge の置き場のどこにも残らない。
//   テストの名前に正本の行 ID を持つ（op_gate.py）。本人の Bridge は使わない
import { expect, test, type Page } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { admin, api, loginAs, setupDone, setupStep, signupViaApi, uniq } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

const WEB = process.env["BASE_URL"] ?? "http://127.0.0.1:3124";
const PASSWORD = "S3cret-Plain!";
let bridges: AgentBridge[] = [];
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});
/** 登録 → はじめの設定を済ませた人 → （bridge なら）本物の Bridge の輪を回す → 画面を開く */
async function open(page: Page, opts: { bridge?: boolean } = { bridge: true }) {
  const u = await signupViaApi();
  // PC をつないでいない人は、Bridge の行（sessions）を置かずにはじめの設定だけ済ませる（setupDone は Bridge の行を置く）
  if (opts.bridge) {
    await setupDone(u);
    bridges.push(await startAgentBridge(u.token, {}));
  } else await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.goto("/settings/credentials");
  await expect(page.locator("[data-state='ge']")).toContainText("まだ資格情報がありません", { timeout: 15_000 });
  return u;
}
/** 画面で 1 件預ける（サービスは的の URL か名前） */
async function store(page: Page, service: string, password = PASSWORD) {
  await page.getByRole("button", { name: "追加する" }).click();
  await page.getByLabel("サービス").fill(service);
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill(password);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='n']")).toContainText("預かり先の番号", { timeout: 15_000 });
}
const cell = (page: Page) => page.locator("[data-login-check]").first();
/** Bridge が終えるまで待つ（本物の Chrome で 1 回入るので 60 秒まで） */
async function settled(page: Page) {
  await expect(cell(page)).not.toHaveAttribute("data-login-check", /pending|running/, { timeout: 60_000 });
  return (await cell(page).getAttribute("data-login-check")) ?? "";
}
function filesContain(dir: string, needle: string): string[] {
  const hits: string[] = [];
  const walk = (p: string): void => {
    let names: string[];
    try {
      names = readdirSync(p);
    } catch {
      return;
    }
    for (const f of names) {
      const q = join(p, f);
      try {
        const st = statSync(q);
        if (st.isDirectory()) walk(q);
        else if (st.size < 50 * 1024 * 1024 && readFileSync(q).includes(needle)) hits.push(q);
      } catch {
        /* ロック等 */
      }
    }
  };
  walk(dir);
  return hits;
}

test("CHT-38-001 正しいログイン情報を預けると、行が「順番待ち→試しています」になり、Bridge が 1 回だけ入って「ログインできました」が出る。仕事は 1 件で閉じる", async ({
  page,
}) => {
  const u = await open(page);
  await store(page, `${WEB}/dev/fake-login?mode=ok`);
  // 預けた直後：試している最中の文（PC が取る前は順番待ち）
  await expect(cell(page)).toHaveAttribute("data-login-check", /pending|running|ok/);
  expect(await settled(page)).toBe("ok");
  await expect(cell(page)).toContainText("ログインできました");
  // 読み直しても同じ（画面の中だけで持たない）
  await page.reload();
  await expect(page.locator("[data-login-check='ok']")).toContainText("ログインできました", { timeout: 15_000 });
  const jobs = await admin<{ kind: string; state_id: string; result: string | null; browser: string }>(
    "select kind, state_id, result, browser from bridge_jobs where member_id = $1",
    [u.memberId],
  );
  expect(jobs).toEqual([{ kind: "login_check", state_id: "done", result: "ok", browser: "dedicated" }]);
  // 証跡：関門 C8（鍵を解いた）と C1（外のサービスに入った）が 1 行ずつ
  const a = await admin<{ action: string; choke_point_id: string }>(
    "select action, choke_point_id from audit_events where tenant_id = $1 and action in ('credential.bridge_resolve', 'credential.login_check') order by created_at",
    [u.tenantId],
  );
  expect(a).toEqual([
    { action: "credential.bridge_resolve", choke_point_id: "C8" },
    { action: "credential.login_check", choke_point_id: "C1" },
  ]);
});

test("CHT-38-002 パスワードが違う → 「ログイン名かパスワードが違うようです」と預け直しの一手。何度も試さない（仕事は 1 件だけ）", async ({
  page,
}) => {
  const u = await open(page);
  await store(page, `${WEB}/dev/fake-login?mode=ok`, "wrong-password-1234");
  expect(await settled(page)).toBe("bad_password");
  await expect(cell(page)).toContainText("ログイン名かパスワードが違うようです");
  await expect(cell(page)).toContainText("預け直して");
  await page.waitForTimeout(3_000); // もう一度試しに行かない
  const n = await admin<{ n: string }>("select count(*) as n from bridge_jobs where member_id = $1", [u.memberId]);
  expect(Number(n[0]!.n)).toBe(1);
});

test("CHT-38-002 2 段階認証を求められる → 「2 段階認証が要ります」。CAPTCHA → 「CAPTCHA が出ました」と一手", async ({
  page,
}) => {
  await open(page);
  await store(page, `${WEB}/dev/fake-login?mode=2fa`);
  expect(await settled(page)).toBe("needs_2fa");
  await expect(cell(page)).toContainText("2 段階認証が要ります");
  // 2 件目：CAPTCHA のサービス
  await page.locator("[data-state='n']").getByRole("button", { name: "追加する" }).click();
  await page.getByLabel("サービス").fill(`${WEB}/dev/fake-login?mode=captcha`);
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "保存する" }).click();
  const second = page.locator("[data-login-check]").nth(1);
  await expect(second).not.toHaveAttribute("data-login-check", /pending|running/, { timeout: 60_000 });
  await expect(second).toHaveAttribute("data-login-check", "captcha");
  await expect(second).toContainText("CAPTCHA が出ました");
  await expect(second).toContainText("ご自身でログインしてから預け直して");
});

test("CHT-38-002 規約で自動操作が禁止のサービスは試さない（仕事を積まない）。PC をつないでいなければ「PC をつなぐと試します」", async ({
  page,
}) => {
  // 禁止のサービス（台帳）を 1 件置く
  const name = `禁止サービス-${uniq()}`;
  await admin(
    "insert into service_registry (tenant_id, name, domain, automation_verdict_id) values (app.ops_tenant_id(), $1, $2, 'forbidden')",
    [name, `${uniq()}.example`],
  );
  try {
    const u = await open(page, { bridge: false });
    await store(page, name);
    await expect(cell(page)).toHaveAttribute("data-login-check", "forbidden");
    await expect(cell(page)).toContainText("規約で自動操作が禁止なので試しません");
    await page.locator("[data-state='n']").getByRole("button", { name: "追加する" }).click();
    await page.getByLabel("サービス").fill(`${WEB}/dev/fake-login?mode=ok`);
    await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
    await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
    await page.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "保存する" }).click();
    const second = page.locator("[data-login-check]").nth(1);
    await expect(second).toHaveAttribute("data-login-check", "no_bridge", { timeout: 15_000 });
    await expect(second).toContainText("PC をつなぐと試します");
    const n = await admin<{ n: string }>("select count(*) as n from bridge_jobs where member_id = $1", [u.memberId]);
    expect(Number(n[0]!.n)).toBe(0);
  } finally {
    await admin(
      "update credentials set service_id = null where service_id in (select id from service_registry where name = $1)",
      [name],
    );
    await admin("delete from service_registry where name = $1", [name]);
  }
});

test("CHT-38-003 鍵は実行の間だけ：入れた後、画面・DB・証跡・Bridge の置き場（ログインの状態）のどこにもパスワードが無い。仕事が閉じた後は鍵を受け取れない", async ({
  page,
}) => {
  const u = await open(page);
  await store(page, `${WEB}/dev/fake-login?mode=ok`);
  expect(await settled(page)).toBe("ok");
  const text = await page.locator("body").innerText();
  expect(text).not.toContain(PASSWORD);
  const dump = JSON.stringify([
    await admin("select * from bridge_jobs where member_id = $1", [u.memberId]),
    await admin("select * from credentials where tenant_id = $1", [u.tenantId]),
    await admin("select * from audit_events where tenant_id = $1", [u.tenantId]),
    await admin("select * from bridge_job_events where member_id = $1", [u.memberId]),
  ]);
  expect(dump).not.toContain(PASSWORD);
  // Bridge の置き場（試験の輪は tmp の kaname-bridge）：Chrome のログインの状態は残るが、値は残らない
  const hits = filesContain(join(tmpdir(), "kaname-bridge"), PASSWORD).map((x) => x.replace(tmpdir(), ""));
  expect(hits, `Bridge の置き場に値が残っている: ${hits.join(", ")}`).toEqual([]);
  // 閉じた仕事では受け取れない（403）
  const job = (
    await admin<{ id: string; credential_id: string }>(
      "select id, credential_id from bridge_jobs where member_id = $1",
      [u.memberId],
    )
  )[0]!;
  const r = await fetch(
    `${process.env["API_BASE"] ?? "http://127.0.0.1:3011"}/api/auth-ext/bridge/credentials/resolve`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-session": bridges[0]!.sid },
      body: JSON.stringify({ job_id: job.id, credential_id: job.credential_id }),
    },
  );
  expect(r.status).toBe(403);
  void api;
});
