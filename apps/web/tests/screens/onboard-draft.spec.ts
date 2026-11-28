// T-U-08 たたき台を確かめる。テストの名前に正本の行 ID を持つ（op_gate.py）。会話で直す・直接編集は T-I-01／T-U-24／T-U-30
import { expect, test } from "@playwright/test";
import { ensureGoalKind, admin, loginAs, noOverflow, signupViaApi, setupStep } from "../_lib/api";

test("SCR-ONBOARD-DRAFT-013 SCR-ONBOARD-DRAFT-012 SCR-ONBOARD-DRAFT-014 SCR-ONBOARD-DRAFT-015 SCR-ONBOARD-DRAFT-016 SCR-ONBOARD-DRAFT-017 SCR-ONBOARD-DRAFT-018 空：データが無ければ空の状態（入力欄は無い＝表記ゆらぎは該当なし）・4 幅で横溢れ 0・「自分のAIと話す」→ /onboard/interview", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/onboard/draft");
  await expect(page.locator("[data-state='empty']")).toContainText("まだたたき台がありません", { timeout: 15_000 });
  await expect(page.locator("main input, main textarea")).toHaveCount(0);
  await page.locator("[data-state='empty']").getByRole("link", { name: "自分のAIと話す" }).click();
  await expect(page).toHaveURL(/\/onboard\/interview/);
});
test("SCR-ONBOARD-DRAFT-001 SCR-ONBOARD-DRAFT-002 SCR-ONBOARD-DRAFT-006 SCR-ONBOARD-DRAFT-025 SCR-ONBOARD-DRAFT-032 SCR-ONBOARD-DRAFT-033 SCR-ONBOARD-DRAFT-008 たたき台：目標（今の版の名前）・台帳・担当業務・最初のルールがモックの 4 枚で並ぶ。「会話で直す」「違うところを言う」はその場で会話と直したところに切り替わり、「これでいく」→ /settings/credentials", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 3); // 「これでいく」の行き先（段 4）が開ける（D-089）
  await loginAs(page, u.token);
  // 作るのは自分のAI（T-I-01）。前提は DB に直接置く。目標の名前は版に持つ（D-108.1）
  await ensureGoalKind();
  const g = await admin<{ id: string }>(
    "insert into goals (tenant_id, scope_id, kind_id, period_start, period_end, target_value, created_by) values ($1, $2, 'seed', '2026-10-01', '2026-12-31', 12000000, $3) returning id",
    [u.tenantId, u.scopeId, u.memberId],
  );
  await admin(
    "insert into goal_versions (tenant_id, goal_id, version, name, snapshot, changed_at, changed_by) values ($1, $2, 1, '今期の売上', '{}', now(), $3)",
    [u.tenantId, g[0]!.id, u.memberId],
  );
  await admin(
    "insert into goals (tenant_id, scope_id, kind_id, period_start, period_end, target_value, created_by) values ($1, $2, 'seed', '2026-10-01', '2026-12-31', 8, $3)",
    [u.tenantId, u.scopeId, u.memberId],
  );
  await admin(
    "insert into ledger_definitions (tenant_id, scope_id, kind_id, name, json_schema, created_by) values ($1, $2, 'deal', '案件', $3, $4)",
    [u.tenantId, u.scopeId, JSON.stringify({ stages: ["問い合わせ", "提案", "成約"] }), u.memberId],
  );
  await page.goto("/onboard/draft");
  const n = page.locator("[data-state='n']");
  const goals = n.locator("[data-card='goals']");
  await expect(goals).toContainText("今期の売上", { timeout: 15_000 });
  await expect(goals).toContainText("12,000,000");
  await expect(goals, "名前の無い目標は種類の名前（内部の鍵は出さない）").toContainText("テストの目標の種類");
  await expect(goals).not.toContainText("seed");
  await expect(n.locator("[data-card='ledgers']")).toContainText("問い合わせ → 提案 → 成約");
  await expect(n.locator("[data-card='duties']")).toContainText("担当業務はまだありません");
  await expect(n.locator("[data-card='rules']")).toContainText("資格情報は自分のAIにもAI社員にも見えない");
  // 4 枚は幅の広い画面で 2 列
  const a = await goals.boundingBox();
  const b = await n.locator("[data-card='ledgers']").boundingBox();
  expect(Math.abs(a!.y - b!.y), "目標と台帳が横に並ぶ").toBeLessThan(4);
  // 会話で直す → その場で会話と直したところ
  await goals.getByRole("button", { name: "会話で直す" }).click();
  await expect(page.locator("[data-state='f']")).toContainText("直したところ");
  await expect(page.locator("[data-state='f'] [data-draft-chat]")).toBeVisible();
  await page.getByRole("button", { name: "たたき台に戻る" }).click();
  await expect(n).toBeVisible();
  await page.getByRole("button", { name: "違うところを言う" }).click();
  await expect(page.locator("[data-state='f']")).toBeVisible();
  await page.getByRole("button", { name: "たたき台に戻る" }).click();
  await page.getByRole("button", { name: "これでいく" }).click(); // 段 3 を記録してから進むのでボタン（D-089）
  await expect(page).toHaveURL(/\/settings\/credentials/);
});
test("SCR-ONBOARD-DRAFT-010 まだたたき台が無いときは「自分のAIと話す」→ /onboard/interview", async ({ page }) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 2);
  await loginAs(page, u.token);
  await page.goto("/onboard/draft");
  await page.locator("[data-state='empty']").getByRole("link", { name: "自分のAIと話す" }).click();
  await expect(page).toHaveURL(/\/onboard\/interview/);
});
test("SCR-ONBOARD-DRAFT-007 SCR-ONBOARD-DRAFT-026 SCR-ONBOARD-DRAFT-027 SCR-ONBOARD-DRAFT-028 SCR-ONBOARD-DRAFT-029 手順バーの 1〜4 → それぞれの画面が開く", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 3); // 段 4（ログイン情報）が今の段＝開ける（D-089）
  await loginAs(page, u.token);
  for (const [label, href] of [
    [/PCをつなぐ$/, "/setup/bridge"],
    [/話す$/, "/onboard/interview"],
    [/たたき台$/, "/onboard/draft"],
    [/ログイン情報$/, "/settings/credentials"],
  ] as const) {
    await page.goto("/onboard/draft");
    await page.getByRole("list", { name: "手順" }).getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/") + "$"));
  }
});
