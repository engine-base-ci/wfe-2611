// 自分のAIとの会話は、どこで開いても同じ 1 本・同じ部品（D-103）。テストの名前に正本の行 ID を持つ（op_gate.py）。
// 右パネルは、まだ本物の作業画面が少ないので、見本の画面を ?live=1（本物の右パネル＝共通の枠が出すもの）で開いて確かめる
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { admin, claimBridge, ensureGoalKind, loginAs, setupStep, signupViaApi } from "../_lib/api";

const lastPrompt = async (memberId: string) =>
  (
    await admin<{ prompt: string }>(
      "select prompt from bridge_jobs where member_id = $1 order by created_at desc limit 1",
      [memberId],
    )
  )[0]?.prompt ?? "";
test("SCR-ONBOARD-DRAFT-047 SCR-ONBOARD-DRAFT-048 たたき台の画面で違うところを言える。同じ会話に積まれ、自分のAI には確かめているたたき台が添えられる（D-103.1・D-103.2）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await claimBridge(u.token);
  await setupStep(u.memberId, 3);
  await loginAs(page, u.token);
  await ensureGoalKind();
  await admin(
    "insert into goals (tenant_id, scope_id, kind_id, period_start, period_end, target_value, created_by) values ($1, $2, 'seed', '2026-10-01', '2026-12-31', 12000000, $3)",
    [u.tenantId, u.scopeId, u.memberId],
  );
  await page.goto("/onboard/draft");
  await page.getByRole("button", { name: "違うところを言う" }).click(); // モックの「会話で直す」の状態へ（D-108.5）
  const chat = page.locator("[data-draft-chat]");
  await expect(chat.locator('[data-part="conversation"]')).toBeVisible({ timeout: 15_000 });
  await chat.getByPlaceholder("違うところを言う").fill("目標は四半期ごとにして");
  await chat.getByRole("button", { name: "送る" }).click();
  await expect(chat.locator('[data-who="me"]').last()).toContainText("目標は四半期ごとにして");
  const p = await lastPrompt(u.memberId);
  expect(p).toContain("いま見ている画面：たたき台を確かめる");
  expect(p).toContain("目標 1 件");
  await page.goto("/onboard/interview");
  await expect(page.locator('[data-who="me"]').last(), "聞き取りの画面でも同じ 1 本").toContainText(
    "目標は四半期ごとにして",
    { timeout: 15_000 },
  );
});
test("USH-02-025 別の会話の作りは検査で赤になる（chat_one の自己検査：何も無ければ緑・7 種の違反を赤・片付けると緑。いまのコードとモックは緑）", async () => {
  const root = join(process.cwd(), "..", "..");
  const self = execFileSync(process.execPath, [join(root, "scripts/ci/chat_one.test.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  expect(self).toContain("OK");
  const now = execFileSync(process.execPath, [join(root, "scripts/ci/chat_one.mjs")], { cwd: root, encoding: "utf8" });
  expect(now).toContain("PASS");
});
