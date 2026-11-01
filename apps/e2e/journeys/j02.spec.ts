// 流れ J-02「P1 はじめの設定 ── PCをつないで、自分のAIと作る」（L2）：J02-01 PC をつなぐ → J02-02 自分のAI に答える → J02-03 たたき台を見る → J02-04 違うところを言う
//   → J02-05 ログイン情報を入れる → J02-06 試しに動かす → J02-07 本番に切り替える。1 本の物語として順に通す。
//   自分のAI は本物の Bridge の輪（apps/bridge）で、CLI だけ偽物（scripts/dev/fake-claude-demo.mjs）。本人のサブスクは使わない。
//   偽の Claude ができないこと（違うところを言って直させる・AI社員をテストで動かす＝T-I-01）は BLOCKED（理由つき）にし、流れを進める前提だけ QA が置く
import { expect, test } from "@playwright/test";
import { admin, api, hideRealBridge, loginAs, signupViaApi } from "../../web/tests/_lib/api";
import { startAgentBridge, type AgentBridge } from "../../web/tests/_lib/agent-bridge";
import { localBridge } from "../../web/tests/_lib/local-bridge";

test.describe.serial("J-02 はじめの設定", () => {
  let u: Awaited<ReturnType<typeof signupViaApi>>;
  let bridge: AgentBridge | null = null;
  test.beforeAll(async () => {
    u = await signupViaApi("通しの会社 J02");
  });
  test.afterAll(() => bridge?.stop());
  test.beforeEach(async ({ page }) => {
    await hideRealBridge(page);
    await loginAs(page, u.token);
  });
  const step = async () =>
    (await admin<{ s: number }>("select setup_step as s from members where id = $1", [u.memberId]))[0]!.s;

  test("J02-01 Bridge を入れて開き、つなぐ → 端末を登録、トークン発行。段 1 を通し、帯の「次へ：2. 話す」で話すへ（bridge-setup）", async ({
    page,
  }) => {
    await page.goto("/setup/bridge");
    await expect(page.locator("h1").first()).toHaveText("自分のPCをつなぐ", { timeout: 20_000 });
    await expect(page.locator("[data-state='ok']"), "まだつながっていない").toHaveCount(0);
    // この PC の Bridge を起こす（接続コードを本物の口で引き取り、輪を回す＝知らせが届く）。画面は開いている間ずっと新しい接続コードを出すので、いったん閉じてから引き取る。
    // この PC の口（/ping）は試験のブラウザの中だけで演じる（Playwright の Chrome には Bridge の口が無い）
    await page.goto("about:blank");
    bridge = await startAgentBridge(u.token);
    await localBridge(page, { label: "MacBook Pro（QA）" });
    await page.goto("/setup/bridge");
    await expect(page.locator("[data-state='ok']")).toBeVisible({ timeout: 30_000 });
    const s = await admin<{ n: string }>(
      "select count(*)::text as n from sessions where member_id = $1 and kind_id = 'bridge' and revoked_at is null",
      [u.memberId],
    );
    expect(s[0]!.n).toBe("1");
    await expect.poll(step, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    const go = page.locator("[data-wiz-next-go]");
    await expect(go).toHaveText("次へ：2. 話す");
    await go.click();
    await expect(page).toHaveURL(/\/onboard\/interview/, { timeout: 15_000 });
  });

  test("J02-02 自分のAI の質問に答える → 会話が積まれ、覚えてと言った業種の手がかりが記憶に残る。段 2 を通す（onboard-interview）", async ({
    page,
  }) => {
    await page.goto("/onboard/interview");
    const first = page.locator("[data-opening]");
    await expect(first).toBeVisible({ timeout: 20_000 });
    await first
      .getByRole("group", { name: "答えの候補" })
      .getByRole("button", { name: "受託・制作", exact: true })
      .click();
    const n = page.locator("[data-state='n']");
    await expect(n).toContainText("受託・制作", { timeout: 15_000 });
    // 本物の Bridge の輪が仕事を取り、CLI（偽物）が返す
    await expect(n.locator("[data-who='ai']").last()).toBeVisible({ timeout: 40_000 });
    await expect.poll(step, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    const box = page.getByRole("textbox", { name: "自分のAIに書く" });
    await box.fill("うちは受託制作の会社って覚えて");
    await page.getByRole("button", { name: "送る" }).click();
    await expect(n).toContainText("次から「うちは受託制作の会社」でいきます", { timeout: 40_000 });
    await expect
      .poll(
        async () =>
          (
            await admin<{ n: string }>(
              "select count(*)::text as n from memories where tenant_id = $1 and body like '%受託制作%' and deleted_at is null",
              [u.tenantId],
            )
          )[0]!.n,
        { timeout: 15_000 },
      )
      .toBe("1");
    const msgs = await admin<{ n: string }>(
      "select count(*)::text as n from messages m join conversations c on c.id = m.conversation_id where c.tenant_id = $1",
      [u.tenantId],
    );
    expect(Number(msgs[0]!.n)).toBeGreaterThanOrEqual(4);
  });

  test("J02-03 出てきたたたき台を見る → 自分のAI が Kaname の道具で目標・台帳・担当業務とAI社員を置き（証跡つき）、たたき台の画面に並ぶ（onboard-draft）", async ({
    page,
  }) => {
    await page.goto("/onboard/interview");
    const box = page.getByRole("textbox", { name: "自分のAIに書く" });
    await expect(box).toBeVisible({ timeout: 20_000 });
    await box.fill("たたき台を置いて");
    await page.getByRole("button", { name: "送る" }).click();
    await expect(page.locator("[data-state='n']")).toContainText(
      "たたき台に置きました：今期の売上・案件台帳・見積の下書き",
      { timeout: 60_000 },
    );
    const au = await admin<{ action: string }>(
      "select action from audit_events where tenant_id = $1 and action like 'agent.%' order by created_at",
      [u.tenantId],
    );
    expect(au.map((a) => a.action)).toEqual(
      expect.arrayContaining(["agent.goal_created", "agent.ledger_created", "agent.duty_created"]),
    );
    await page.goto("/onboard/draft");
    const n = page.locator("[data-state='n']");
    await expect(n).toBeVisible({ timeout: 20_000 });
    await expect(n.locator("[data-card='goals']")).toContainText("今期の売上");
    await expect(n.locator("[data-card='ledgers']")).toContainText("案件台帳");
    await expect(n.locator("[data-card='duties']")).toContainText("見積の下書き");
    await expect(n.locator("[data-card='duties']")).toContainText("見積さん");
  });

  test("J02-04 違うところを言う → 会社モデルの下書きを更新（onboard-draft）", async () => {
    test.skip(
      true,
      "違うところを言って自分のAI に直させるのは本物の Claude Code（T-I-01）。偽の CLI は置くことしかできない。画面の「違うところを言う」の切り替えは SCR-ONBOARD-DRAFT-025 で押している",
    );
  });

  test("J02-05 「これでいく」→ 使うサービスを選びログイン情報を入れる → 預かり先の番号だけが残る（中身は無い）。段 4 を通し、帯の「次へ：5. テスト」で テストへ（credentials）", async ({
    page,
  }) => {
    await page.goto("/onboard/draft");
    await expect(page.locator("[data-state='n']")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "これでいく" }).click();
    await expect(page).toHaveURL(/\/settings\/credentials/, { timeout: 20_000 });
    await expect.poll(step, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
    await expect(page.locator("[data-state='ge']")).toBeVisible({ timeout: 20_000 });
    await page.locator("[data-state='ge']").getByRole("button", { name: "追加する" }).click();
    await page.getByLabel("サービス").fill("freee");
    await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
    await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
    await page.getByLabel("パスワード", { exact: true }).fill("S3cret-Plain!");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.locator("[data-state='n']")).toContainText("freee", { timeout: 20_000 });
    const c = await admin<{ vault_ref: string; service_name: string }>(
      "select vault_ref, service_name from credentials where owner_member_id = $1 and deleted_at is null",
      [u.memberId],
    );
    expect(c).toHaveLength(1);
    expect(c[0]!.vault_ref).toBeTruthy();
    expect(JSON.stringify(c)).not.toMatch(/S3cret|me@example\.com/);
    await expect.poll(step, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
    const go = page.locator("[data-wiz-next-go]");
    await expect(go).toHaveText("次へ：5. テスト");
    await go.click();
    await expect(page).toHaveURL(/\/onboard\/testrun/, { timeout: 20_000 });
  });

  test("J02-06 試しに動かして結果を見る → テスト実行の証跡を残す（onboard-testrun）", async () => {
    test.skip(
      true,
      "AI社員をテストモードで動かす結線（実行ループ）は T-I-01。画面は「作っています」と出して押せない（SCR-ONBOARD-TESTRUN-030〜033 も同じ理由で BLOCKED）",
    );
  });

  test("（前提）テストの実行の記録を置いて「本番に切り替える」を押す → 段 5 を通し、6 本番へ（onboard-testrun → onboard-golive）", async ({
    page,
  }) => {
    // 自分のAI が置いた AI社員（見積さん）に、テストの実行の記録を 1 つ置く（作るのは T-I-01。QA が作ったデータだけを触る）
    const e = await admin<{ id: string; duty_id: string; scope_id: string }>(
      "select a.id, d.id as duty_id, a.scope_id from ai_employees a join duties d on d.ai_employee_id = a.id where a.tenant_id = $1 and a.deleted_at is null and d.deleted_at is null",
      [u.tenantId],
    );
    expect(e).toHaveLength(1);
    await admin(
      "insert into action_runs (tenant_id, scope_id, ai_employee_id, duty_id, mode_id, status_id, started_at, finished_at, created_by) values ($1, $2, $3, $4, 'test', 'done', now() - interval '2 minutes', now(), $5)",
      [u.tenantId, e[0]!.scope_id, e[0]!.id, e[0]!.duty_id, u.memberId],
    );
    await page.goto("/onboard/testrun");
    const n = page.locator("[data-state='n']");
    await expect(n).toBeVisible({ timeout: 20_000 });
    await expect(n.locator("[data-row-employee][data-run-status='done']")).toContainText("見積さん");
    const go = page.locator("[data-wiz-next-go]");
    await expect(go).toHaveText("本番に切り替える");
    await expect(go).toBeEnabled();
    await go.click();
    await expect(page).toHaveURL(/\/onboard\/golive/, { timeout: 20_000 });
    await expect.poll(step, { timeout: 15_000 }).toBeGreaterThanOrEqual(5);
  });

  test("J02-07 本番に切り替える → 切り替える前の確認（会社モデル・Bridge・承認・AI社員の目標）。足りない AI社員は止めたまま本番へ。切り替えると会社モデルを確定、自動実行を有効化（tenants.live_at・段 6・証跡）（onboard-golive）", async ({
    page,
  }) => {
    await page.goto("/onboard/golive");
    const n = page.locator("[data-state='n']");
    await expect(n).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-check='model']")).toHaveAttribute("data-level", "ok");
    await expect(page.locator("[data-check='model']")).toContainText("目標 1・担当業務 1・AI社員 1");
    await expect(
      page.locator("[data-check='bridge']"),
      "この PC の Bridge（本物の輪）がつながっている",
    ).toHaveAttribute("data-level", "ok");
    await expect(page.locator("[data-check='approval']")).toHaveAttribute("data-level", "ok");
    // 自分のAI はまだ目標を配っていない（T-I-01）→ 赤。E-DEP-004 の一手「止めたまま本番へ」
    const goal = page.locator("[data-check^='goal:']");
    await expect(goal).toHaveAttribute("data-level", "red");
    await expect(page.locator("[data-ai-note]")).toContainText("本番に切り替える前に 1 つ足りません：見積さんの目標");
    await expect(page.locator("[data-golive-switch]")).toHaveCount(0);
    await goal.locator("[data-pause]").click();
    await expect(page.locator("[data-check^='paused:']")).toContainText("見積さんは止めたまま本番へ", {
      timeout: 15_000,
    });
    await expect(page.locator("[data-card='schedule']")).toContainText(
      "見積さんが見積の下書き（止めたまま。動かしません）",
    );
    const go = page.locator("[data-golive-switch]");
    await expect(go).toHaveText("切り替える");
    await go.click();
    await expect(page.locator("[data-state='ok']")).toContainText("本番で動いています", { timeout: 20_000 });
    const t = (
      await admin<{ live_at: string | null; live_by: string | null }>(
        "select live_at, live_by from tenants where id = $1",
        [u.tenantId],
      )
    )[0]!;
    expect(t.live_at).toBeTruthy();
    expect(t.live_by).toBe(u.memberId);
    expect(await step()).toBe(6);
    const au = await admin<{ action: string }>(
      "select action from audit_events where tenant_id = $1 and action like 'golive.%' order by created_at",
      [u.tenantId],
    );
    expect(au.map((a) => a.action)).toEqual(["golive.employee_paused", "golive.switched"]);
    // 通し終えた人の入口は、はじめの設定へ戻さない（D-089）
    const st = await api<{ data: { step: number; total: number } }>("/api/auth-ext/setup-state", undefined, u.token);
    expect(st.json.data).toEqual({ step: 6, total: 6 });
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/(setup|onboard)\//, { timeout: 20_000 });
  });
});
