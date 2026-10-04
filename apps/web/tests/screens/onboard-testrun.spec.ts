// T-U-11 テストで動かす（A11・D-028・D-116.4）。テストの名前に正本の行 ID を持つ（op_gate.py）。
//   3 状態は本物の記録（ai_employees・duties・action_runs・artifacts）から出る。AI社員を実際に動かす結線は T-I-01（「動かす」等は押せない形で出す）。
//   前提（AI社員・担当業務・テストの実行）は DB に直接置く（作るのは自分のAI＝T-I-01）
import { expect, test, type Page } from "@playwright/test";
import { admin, api, loginAs, noOverflow, setupStep, signupViaApi } from "../_lib/api";

type U = Awaited<ReturnType<typeof signupViaApi>>;
async function person(step = 4) {
  const u = await signupViaApi();
  await setupStep(u.memberId, step); // 4 ログイン情報 を通した人（5 が開く・D-089）
  return u;
}
/** AI社員（members kind=ai_employee → ai_employees）と担当業務を 1 つ置く */
async function employee(u: U, name: string, duty: string) {
  const m = await admin<{ id: string }>(
    "insert into members (tenant_id, scope_id, kind_id, display_name, role_id) values ($1, $2, 'ai_employee', $3, 'staff') returning id",
    [u.tenantId, u.scopeId, name],
  );
  const a = await admin<{ id: string }>("insert into ai_employees (tenant_id, scope_id, member_id, created_by) values ($1, $2, $3, $4) returning id", [u.tenantId, u.scopeId, m[0]!.id, u.memberId]);
  const d = await admin<{ id: string }>(
    "insert into duties (tenant_id, scope_id, ai_employee_id, name, definition_md, created_by) values ($1, $2, $3, $4, $5, $6) returning id",
    [u.tenantId, u.scopeId, a[0]!.id, duty, `${duty}\n読むだけ`, u.memberId],
  );
  return { aiId: a[0]!.id, dutyId: d[0]!.id, memberId: m[0]!.id };
}
/** テストの実行の記録（status：done／stopped／running）。done には本人の PC の仕事と成果物を 1 つ結ぶ */
async function run(u: U, e: { aiId: string; dutyId: string }, status: "done" | "stopped" | "running", reason: string | null = null, artifactTitle: string | null = null) {
  let jobId: string | null = null;
  if (artifactTitle) {
    const j = await admin<{ id: string }>("insert into bridge_jobs (tenant_id, member_id, prompt, state_id, started_at, finished_at) values ($1, $2, $3, 'done', now(), now()) returning id", [u.tenantId, u.memberId, "テストで動かす"]);
    jobId = j[0]!.id;
    const ar = await admin<{ id: string }>(
      "insert into artifacts (tenant_id, scope_id, format_id, storage_ref, title, owner_member_id, current_version, source_job_id, created_by) values ($1, $2, 'md', $3, $4, $5, 1, $6, $5) returning id",
      [u.tenantId, u.scopeId, `test/${Date.now()}`, artifactTitle, u.memberId, jobId],
    );
    await admin("insert into artifact_versions (tenant_id, scope_id, artifact_id, version, storage_ref, size_bytes, owner_member_id, note) values ($1, $2, $3, 1, $4, 10, $5, 'テスト')", [u.tenantId, u.scopeId, ar[0]!.id, `test/${Date.now()}`, u.memberId]);
  }
  const r = await admin<{ id: string }>(
    "insert into action_runs (tenant_id, scope_id, ai_employee_id, duty_id, mode_id, status_id, started_at, finished_at, error_summary, bridge_job_id, created_by) values ($1, $2, $3, $4, 'test', $5, now() - interval '2 minutes', case when $5 = 'running' then null else now() end, $6, $7, $8) returning id",
    [u.tenantId, u.scopeId, e.aiId, e.dutyId, status, reason, jobId, u.memberId],
  );
  return r[0]!.id;
}
const band = (page: Page) => page.locator("[data-wiz-next]");

test("SCR-ONBOARD-TESTRUN-002 SCR-ONBOARD-TESTRUN-004 SCR-ONBOARD-TESTRUN-005 SCR-ONBOARD-TESTRUN-013 SCR-ONBOARD-TESTRUN-012 SCR-ONBOARD-TESTRUN-007 SCR-ONBOARD-TESTRUN-008 SCR-ONBOARD-TESTRUN-009 SCR-ONBOARD-TESTRUN-011 SCR-ONBOARD-TESTRUN-022 SCR-ONBOARD-TESTRUN-023 SCR-ONBOARD-TESTRUN-024 SCR-ONBOARD-TESTRUN-025 SCR-ONBOARD-TESTRUN-026 最初：AI社員がいなければたたき台へ、いれば「〇〇を動かす」（仕組みは作っている、と書いて押せない）。帯は押せず理由。段の帯の 1〜4 は実在ルートへ", async ({
  page,
}) => {
  const u = await person();
  await loginAs(page, u.token);
  await noOverflow(page, "/onboard/testrun");
  await expect(page.locator("h1")).toHaveText("テストで動かす");
  const z = page.locator("[data-state='0']");
  await expect(z).toContainText("まだ何も動かしていません", { timeout: 15_000 });
  await expect(z).toContainText("たたき台に AI社員がまだいません");
  await expect(band(page).locator("[data-wiz-next-go]")).toBeDisabled();
  await expect(band(page).locator("[data-wiz-next-note]")).toContainText("たたき台に AI社員がいると試せます");
  await z.getByRole("link", { name: "たたき台を確かめる" }).click();
  await expect(page).toHaveURL(/\/onboard\/draft/);
  // AI社員ができると「〇〇を動かす」。動かす仕組みは T-I-01 なので押せない形で、そう書く
  await employee(u, "営業社員", "発注ナビの新着を台帳に入れる");
  await employee(u, "経理社員", "納品済み案件の請求書を下書きする");
  await page.goto("/onboard/testrun");
  await expect(page.locator("[data-state='0']")).toContainText("AI社員を1体選んで", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "営業社員を動かす" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "経理社員を動かす" })).toBeDisabled();
  await expect(page.locator("[data-not-yet]")).toContainText("AI社員を動かす仕組みは作っています");
  await expect(band(page).locator("[data-wiz-next-note]")).toContainText("AI社員を全員 1 回ずつテストで動かすと切り替えられます");
  // 段の帯（1〜4 は通した段・5 はいま。6 はまだ無いのでリンクにしない）
  for (const [label, re] of [
    ["1. PCをつなぐ", /\/setup\/bridge/],
    ["2. 話す", /\/onboard\/interview/],
    ["3. たたき台", /\/onboard\/draft/],
    ["4. ログイン情報", /\/settings\/credentials/],
  ] as const) {
    await page.goto("/onboard/testrun");
    await page.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(re);
  }
  await page.goto("/onboard/testrun");
  await page.getByRole("link", { name: "5. テスト" }).click(); // いまの段（自分自身）
  await expect(page).toHaveURL(/\/onboard\/testrun/);
  await expect(page.getByRole("link", { name: "6. 本番へ" })).toHaveCount(0);
  // 役割：R1 R2 で同じ中身（モックの role-same 宣言どおり。役割で変わる中身は無い）
  await expect(page.locator("[data-roles]")).toHaveCount(0);
});

test("SCR-ONBOARD-TESTRUN-001 SCR-ONBOARD-TESTRUN-028 SCR-ONBOARD-TESTRUN-006 SCR-ONBOARD-TESTRUN-021 動かした：AI社員ごとの状態と出てきたもの。「見る」で横に開く。全員 完了 なら「本番に切り替える」が押せ、段 5 を通したと記録される（別 GET で反映）", async ({
  page,
}) => {
  const u = await person();
  const sales = await employee(u, "営業社員", "発注ナビの新着を台帳に入れる");
  const acct = await employee(u, "経理社員", "納品済み案件の請求書を下書きする");
  await run(u, sales, "done", null, "台帳「案件」に入れた 12 件");
  await run(u, sales, "done");
  await run(u, acct, "done", null, "請求書 下書き · 株式会社セイコー");
  await loginAs(page, u.token);
  await page.goto("/onboard/testrun");
  const n = page.locator("[data-state='n']");
  await expect(n).toBeVisible({ timeout: 15_000 });
  const rows = n.locator("[data-card='runs'] tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("営業社員");
  await expect(rows.nth(0)).toContainText("発注ナビの新着を台帳に入れる");
  await expect(rows.nth(0)).toContainText("完了");
  await expect(rows.nth(0), "2 回動かした").toContainText("2 回");
  await expect(rows.nth(1)).toContainText("経理社員");
  await expect(rows.nth(1)).toContainText("完了");
  await expect(n.locator("[data-card='runs']")).toContainText("テストモード · 外に出ない");
  const outs = n.locator("[data-output]");
  await expect(outs).toHaveCount(2);
  await expect(outs.first(), "新しい順").toContainText("請求書 下書き · 株式会社セイコー");
  await expect(outs.first()).toContainText("経理社員");
  await expect(n.locator("[data-ai-note]")).toContainText("2体を動かしました");
  await expect(page.getByRole("button", { name: "もう少し試す" })).toBeDisabled();
  // 見る → 成果物が横に開く（会話の横と同じ部品）
  await outs.first().locator("[data-art-open]").click();
  const panel = page.locator("[data-artifact]");
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await expect(panel).toContainText("請求書 下書き · 株式会社セイコー");
  await panel.locator("[data-art-close]").click();
  await expect(panel).toHaveCount(0);
  // 本番に切り替える（下の帯）→ 段 5 を通した記録。別 GET（setup-state）と DB で確かめる
  const go = band(page).locator("[data-wiz-next-go]");
  await expect(go).toBeEnabled();
  await expect(go).toHaveText(/本番に切り替える/);
  await go.click();
  await expect(page).not.toHaveURL(/\/onboard\/testrun/, { timeout: 15_000 });
  await expect.poll(async () => (await api<{ data: { step: number } }>("/api/auth-ext/setup-state", undefined, u.token)).json.data.step, { timeout: 10_000 }).toBe(5);
  expect((await admin<{ setup_step: number }>("select setup_step from members where id = $1", [u.memberId]))[0]!.setup_step).toBe(5);
});

test("SCR-ONBOARD-TESTRUN-003 SCR-ONBOARD-TESTRUN-034 止まった：止まった理由と一手。「ブラウザで開く」は仕組みができるまで押せない。「この仕事はやめる」で やめた になり、帯が押せるようになる", async ({ page }) => {
  const u = await person();
  const sales = await employee(u, "営業社員", "発注ナビの新着を台帳に入れる");
  const acct = await employee(u, "経理社員", "納品済み案件の請求書を下書きする");
  const stoppedId = await run(u, sales, "stopped", "発注ナビのログインで画像認証（CAPTCHA）が出ました");
  await run(u, acct, "done", null, "請求書 下書き · 京蟻");
  await loginAs(page, u.token);
  await page.goto("/onboard/testrun");
  const x = page.locator("[data-state='x']");
  await expect(x).toBeVisible({ timeout: 15_000 });
  await expect(x.locator("[data-row-employee][data-run-status='stopped']")).toContainText("止まった");
  const reason = x.locator(`[data-stopped-reason='${stoppedId}']`);
  await expect(reason).toContainText("営業社員");
  await expect(reason).toContainText("画像認証（CAPTCHA）が出ました");
  await expect(reason).toContainText("Kaname は CAPTCHA を突破しません");
  await expect(reason.getByRole("button", { name: "ブラウザで開く" })).toBeDisabled();
  await expect(band(page).locator("[data-wiz-next-go]")).toBeDisabled();
  await expect(band(page).locator("[data-wiz-next-note]")).toContainText("止まった AI社員を通すか「この仕事はやめる」を選ぶと");
  await reason.getByRole("button", { name: "この仕事はやめる" }).click();
  const n = page.locator("[data-state='n']");
  await expect(n).toBeVisible({ timeout: 15_000 });
  await expect(n.locator("[data-row-employee][data-run-status='cancelled']")).toContainText("やめた");
  await expect(band(page).locator("[data-wiz-next-go]")).toBeEnabled();
  const row = (await admin<{ status_id: string; finished_at: string | null }>("select status_id, finished_at from action_runs where id = $1", [stoppedId]))[0]!;
  expect(row.status_id).toBe("cancelled");
  expect(row.finished_at).toBeTruthy();
  const au = await admin<{ action: string }>("select action from audit_events where target_type = 'action_runs' and target_id = $1", [stoppedId]);
  expect(au.map((a) => a.action)).toEqual(["testrun.cancelled"]);
  // やめた後は 止まった理由 の箱は消える。もう一度 やめる は 404（本人の会社の、止まった・実行中のものだけ）
  const again = await api("/api/auth-ext/onboard/testrun/cancel", { run_id: stoppedId }, u.token);
  expect(again.status).toBe(404);
  // 別の会社の人は、この会社の実行をやめられない（404・あることも教えない）
  const other = await signupViaApi("別の会社");
  const o2 = await employee(other, "営業社員", "x");
  const theirs = await run(other, o2, "stopped", "止まった");
  expect((await api("/api/auth-ext/onboard/testrun/cancel", { run_id: theirs }, u.token)).status).toBe(404);
  expect((await admin<{ status_id: string }>("select status_id from action_runs where id = $1", [theirs]))[0]!.status_id).toBe("stopped");
});
