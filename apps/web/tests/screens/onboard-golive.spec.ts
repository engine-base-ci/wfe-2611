// T-U-12 本番に切り替える（A12・D-028.4・D-116.5・E-DEP-004）。テストの名前に正本の行 ID を持つ（op_gate.py）。
//   2 状態（確認・切り替えた）は本物の記録（会社モデル・Bridge の行・担当業務の使うサービスと預けたログイン情報・目標の配分・tenants.live_at）から出る。
//   赤が 1 件でもあれば「切り替える」を出さない。黄は承知のうえで押せる。足りない AI社員は「止めたまま本番へ」にできる（E-DEP-004 の一手）
import { expect, test, type Page } from "@playwright/test";
import { admin, api, bridgeRow, ensureGoalKind, loginAs, noOverflow, setupStep, signupViaApi } from "../_lib/api";

type U = Awaited<ReturnType<typeof signupViaApi>>;
/** 5 テスト を通した人（6 が開く・D-089）。Bridge の行は bridge=true のときだけ */
async function person(bridge = true) {
  const u = await signupViaApi();
  await setupStep(u.memberId, 5);
  if (bridge) await bridgeRow(u);
  return u;
}
/** AI社員（members kind=ai_employee → ai_employees）と担当業務を 1 つ置く。services＝その担当業務が使うサービス（constraints.services） */
async function employee(u: U, name: string, duty: string, services: string[] = []) {
  const m = await admin<{ id: string }>(
    "insert into members (tenant_id, scope_id, kind_id, display_name, role_id) values ($1, $2, 'ai_employee', $3, 'staff') returning id",
    [u.tenantId, u.scopeId, name],
  );
  const a = await admin<{ id: string }>(
    "insert into ai_employees (tenant_id, scope_id, member_id, created_by) values ($1, $2, $3, $4) returning id",
    [u.tenantId, u.scopeId, m[0]!.id, u.memberId],
  );
  await admin(
    "insert into duties (tenant_id, scope_id, ai_employee_id, name, definition_md, constraints, created_by) values ($1, $2, $3, $4, $5, $6, $7)",
    [u.tenantId, u.scopeId, a[0]!.id, duty, `${duty}\n読むだけ`, JSON.stringify({ services }), u.memberId],
  );
  return { aiId: a[0]!.id, memberId: m[0]!.id };
}
/** 目標を 1 つ置き、AI社員に配る */
async function goal(u: U, to: { memberId: string }[]) {
  const kind = await ensureGoalKind();
  const g = await admin<{ id: string }>(
    "insert into goals (tenant_id, scope_id, kind_id, period_start, period_end, target_value, created_by) values ($1, $2, $3, '2026-10-01', '2026-12-31', 100, $4) returning id",
    [u.tenantId, u.scopeId, kind, u.memberId],
  );
  for (const t of to)
    await admin(
      "insert into goal_allocations (tenant_id, goal_id, assignee_member_id, allocated_value, created_by) values ($1, $2, $3, 50, $4)",
      [u.tenantId, g[0]!.id, t.memberId, u.memberId],
    );
  return g[0]!.id;
}
const check = (page: Page, id: string) => page.locator(`[data-check='${id}']`);
const golive = (u: U) =>
  api<{
    data: {
      red: number;
      warn: number;
      ready: boolean;
      shortfall: string | null;
      live: { at: string; by: string } | null;
      checks: { id: string; level: string }[];
    };
  }>("/api/auth-ext/onboard/golive", undefined, u.token, "GET");

test("SCR-ONBOARD-GOLIVE-001 SCR-ONBOARD-GOLIVE-002 SCR-ONBOARD-GOLIVE-005 SCR-ONBOARD-GOLIVE-021 SCR-ONBOARD-GOLIVE-028 E-DEP-004-A E-DEP-004-C E-DEP-004-B 確認：足りないもの（ログイン情報・目標）は赤で、文言と一手（連携を直す・止めたまま本番へ）が出る。赤がある間は「切り替える」が出ない。止めたまま本番へ にすると出て、押すと切り替わる（別 GET・DB・証跡）", async ({
  page,
}) => {
  const u = await person();
  const sales = await employee(u, "営業社員", "発注ナビの新着を台帳に入れる", ["freee"]);
  const acct = await employee(u, "経理社員", "納品済み案件の請求書を下書きする");
  await goal(u, [acct]); // 経理社員には配られている・営業社員には無い
  await loginAs(page, u.token);
  await page.goto("/onboard/golive");
  const n = page.locator("[data-state='n']");
  await expect(n).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("h1")).toHaveText("本番に切り替える");
  // 通っているもの（本物の記録から）
  await expect(check(page, "model")).toHaveAttribute("data-level", "ok");
  await expect(check(page, "model")).toContainText("目標 1・担当業務 2・AI社員 2");
  await expect(check(page, "bridge")).toHaveAttribute("data-level", "ok");
  await expect(check(page, "bridge")).toContainText("MacBook Pro（QA）");
  await expect(check(page, "approval")).toHaveAttribute("data-level", "ok");
  await expect(check(page, `goal:${acct.aiId}`)).toHaveAttribute("data-level", "ok");
  // 足りないもの＝赤（E-DEP-004-A）。文言は「本番に切り替える前に N つ足りません：…。埋めると切り替えられます」
  const cred = check(page, `cred:${sales.aiId}:freee`);
  await expect(cred).toHaveAttribute("data-level", "red");
  await expect(cred).toContainText("営業社員の freee のログイン情報を預けていません");
  await expect(check(page, `goal:${sales.aiId}`)).toHaveAttribute("data-level", "red");
  await expect(page.locator("[data-ai-note]")).toContainText(
    "本番に切り替える前に 2 つ足りません：営業社員の freee のログイン情報／営業社員の目標。埋めると切り替えられます",
  );
  await expect(page.locator("[data-golive-switch]"), "赤がある間は主アクションを出さない（D-116.5）").toHaveCount(0);
  await expect(page.locator("[data-golive-blocked]")).toContainText("赤を全部直す");
  // API も同じ所で止める（UI を壊しても通らない・2 層目）
  const blocked = await api<{ code: string; message: string }>(
    "/api/auth-ext/onboard/golive",
    { accept_warnings: true },
    u.token,
  );
  expect(blocked.status).toBe(409);
  expect(blocked.json.code).toBe("GOLIVE_BLOCKED");
  expect(blocked.json.message).toContain("2 つ足りません");
  // 明日から動くもの（担当業務から）
  const sched = page.locator("[data-card='schedule']");
  await expect(sched.locator("[data-schedule]")).toHaveCount(2);
  await expect(sched).toContainText("営業社員が発注ナビの新着を台帳に入れる");
  await expect(sched).toContainText("自分のAIが上がってきたものを一次確認し、承認待ちを作る");
  // 一手（E-DEP-004-C）：連携を直す → ログイン情報。戻って「止めたまま本番へ」
  await cred.locator("[data-fix]").click();
  await expect(page).toHaveURL(/\/settings\/credentials/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: "預けたログイン情報" })).toBeVisible(); // K-356：新しい画面の見出し
  await page.goto("/onboard/golive");
  await expect(check(page, `goal:${sales.aiId}`)).toBeVisible({ timeout: 15_000 });
  await check(page, `goal:${sales.aiId}`).locator("[data-pause]").click();
  const paused = check(page, `paused:${sales.aiId}`);
  await expect(paused).toBeVisible({ timeout: 10_000 });
  await expect(paused).toContainText("営業社員は止めたまま本番へ（動かしません）");
  await expect(check(page, `cred:${sales.aiId}:freee`), "止めた AI社員の行は見ない").toHaveCount(0);
  await expect(sched.locator("[data-schedule='paused']")).toContainText("止めたまま。動かしません");
  const au1 = await admin<{ action: string }>(
    "select action from audit_events where target_type = 'ai_employees' and target_id = $1 order by created_at",
    [sales.aiId],
  );
  expect(au1.map((a) => a.action)).toEqual(["golive.employee_paused"]);
  // 動かす で戻せる（赤に戻る）→ もう一度 止めたまま本番へ
  await paused.locator("[data-resume]").click();
  await expect(check(page, `goal:${sales.aiId}`)).toHaveAttribute("data-level", "red", { timeout: 10_000 });
  await check(page, `goal:${sales.aiId}`).locator("[data-pause]").click();
  await expect(check(page, `paused:${sales.aiId}`)).toBeVisible({ timeout: 10_000 });
  // 赤が消えた＝「切り替える」が出る（警告は無いので素の文言・E-DEP-004-B）
  const go = page.locator("[data-golive-switch]");
  await expect(go).toHaveText("切り替える");
  await expect(page.locator("[data-ai-note]")).toContainText("準備ができています");
  await go.click();
  // 切り替えた：画面が変わる（別 GET で読み直し）・DB（tenants.live_at・段 6）・証跡
  const ok = page.locator("[data-state='ok']");
  await expect(ok).toBeVisible({ timeout: 15_000 });
  await expect(ok).toContainText("本番で動いています");
  await expect(ok.locator("[data-live-note]")).toContainText("明日の朝、自分のAIの申し送りから始まります");
  await expect(ok.locator("[data-live-note]")).toContainText("が切り替えました");
  const t = (
    await admin<{ live_at: string | null; live_by: string | null }>(
      "select live_at, live_by from tenants where id = $1",
      [u.tenantId],
    )
  )[0]!;
  expect(t.live_at).toBeTruthy();
  expect(t.live_by).toBe(u.memberId);
  expect(
    (await admin<{ setup_step: number }>("select setup_step from members where id = $1", [u.memberId]))[0]!.setup_step,
  ).toBe(6);
  await expect
    .poll(
      async () =>
        (await api<{ data: { step: number } }>("/api/auth-ext/setup-state", undefined, u.token)).json.data.step,
      { timeout: 10_000 },
    )
    .toBe(6);
  const g = await golive(u);
  expect(g.json.data.live?.at).toBeTruthy();
  const au = await admin<{ action: string; payload: { paused: string[]; warnings: string[] } }>(
    "select action, payload from audit_events where action = 'golive.switched' and tenant_id = $1",
    [u.tenantId],
  );
  expect(au).toHaveLength(1);
  expect(au[0]!.payload.paused).toEqual([sales.aiId]);
  expect(au[0]!.payload.warnings).toEqual([]);
  // 開き直しても「切り替えた」。今日 の画面がまだ無ければ押せない形で、Kaname を開く で行き止まりにしない
  await page.goto("/onboard/golive");
  await expect(page.locator("[data-state='ok']")).toBeVisible({ timeout: 15_000 });
  if ((await page.locator("[data-today-not-yet]").count()) > 0) {
    await expect(page.getByRole("button", { name: "今日の画面へ" })).toBeDisabled();
    await page.getByRole("link", { name: "Kaname を開く" }).click();
    await expect(page).not.toHaveURL(/\/onboard\/golive/, { timeout: 15_000 });
  } else {
    await page.getByRole("link", { name: "今日の画面へ" }).click();
    await expect(page).toHaveURL(/\/today/, { timeout: 15_000 });
  }
});

test("SCR-ONBOARD-GOLIVE-029 警告（黄）：ログインをまだ確かめていないログイン情報は警告で、「切り替える（1件の警告を承知のうえで）」になる。API は承知なしでは 409・承知すれば通り、証跡に警告が残る", async ({
  page,
}) => {
  const u = await person();
  const sales = await employee(u, "営業社員", "発注ナビの新着を台帳に入れる", ["freee"]);
  await goal(u, [sales]);
  // 預けた直後は「ログインできるか」をまだ確かめていない（Bridge の実物は無い）→ 警告
  // K-358：預ける前の道すじ（/api/auth-ext/vault/credentials）を消したので、行を直に置く（本番に切り替える判定は行の service_name と login_check_state だけを読む）
  const c = await admin<{ id: string }>(
    "insert into credentials (tenant_id, scope_id, owner_member_id, service_name, kind_id, vault_ref, created_by) values ($1, $2, $3, 'freee', 'basic', 'sec_golive_test', $3) returning id",
    [u.tenantId, u.scopeId, u.memberId],
  );
  expect(c).toHaveLength(1);
  await admin("update credentials set login_check_state = 'pending' where id = $1", [c[0]!.id]);
  await loginAs(page, u.token);
  await page.goto("/onboard/golive");
  const cred = check(page, `cred:${sales.aiId}:freee`);
  await expect(cred).toHaveAttribute("data-level", "warn", { timeout: 15_000 });
  await expect(cred).toContainText("freee にログインできるかをまだ確かめていません");
  await expect(check(page, `goal:${sales.aiId}`)).toHaveAttribute("data-level", "ok");
  const go = page.locator("[data-golive-switch]");
  await expect(go).toHaveText("切り替える（1件の警告を承知のうえで）");
  await expect(page.locator("[data-ai-note]")).toContainText("1 件の警告は、理由を見て承知のうえで切り替えられます");
  // API：承知なしは 409（黄は理由を見て承知すれば押せる・D-116.5）
  const r = await api<{ code: string }>("/api/auth-ext/onboard/golive", {}, u.token);
  expect(r.status).toBe(409);
  expect(r.json.code).toBe("GOLIVE_WARNINGS");
  expect((await golive(u)).json.data.live).toBeNull();
  await go.click();
  await expect(page.locator("[data-state='ok']")).toBeVisible({ timeout: 15_000 });
  const au = await admin<{ payload: { warnings_accepted: number; warnings: string[] } }>(
    "select payload from audit_events where action = 'golive.switched' and tenant_id = $1",
    [u.tenantId],
  );
  expect(au[0]!.payload.warnings_accepted).toBe(1);
  expect(au[0]!.payload.warnings).toEqual(["営業社員が使う freee のログイン情報と権限"]);
  // もう一度押しても壊れない（切り替えた日時は最初のまま）
  const again = await api<{ data: { ok: boolean } }>(
    "/api/auth-ext/onboard/golive",
    { accept_warnings: true },
    u.token,
  );
  expect(again.status).toBe(200);
  const t = await admin<{ live_at: string }>("select live_at from tenants where id = $1", [u.tenantId]);
  expect(new Date(t[0]!.live_at).getTime()).toBeLessThan(Date.now() - 100);
});

test("SCR-ONBOARD-GOLIVE-003 SCR-ONBOARD-GOLIVE-004 SCR-ONBOARD-GOLIVE-012 SCR-ONBOARD-GOLIVE-006 SCR-ONBOARD-GOLIVE-007 SCR-ONBOARD-GOLIVE-008 SCR-ONBOARD-GOLIVE-009 SCR-ONBOARD-GOLIVE-010 SCR-ONBOARD-GOLIVE-022 SCR-ONBOARD-GOLIVE-023 SCR-ONBOARD-GOLIVE-024 SCR-ONBOARD-GOLIVE-025 SCR-ONBOARD-GOLIVE-026 SCR-ONBOARD-GOLIVE-027 PC をつないでいない・会社モデルが無い人：赤と一手（PC をつなぐ・たたき台を直す）。横溢れ 0・役割は同じ中身・段の帯 1〜6 は実在ルート", async ({
  page,
}) => {
  const u = await person(false);
  await loginAs(page, u.token);
  await noOverflow(page, "/onboard/golive");
  await expect(check(page, "model")).toHaveAttribute("data-level", "red", { timeout: 15_000 });
  await expect(check(page, "model")).toContainText("目標がありません・担当業務がありません・AI社員がいません");
  await expect(check(page, "bridge")).toHaveAttribute("data-level", "red");
  await expect(check(page, "bridge")).toContainText("まだ PC をつないでいません");
  await expect(page.locator("[data-golive-switch]")).toHaveCount(0);
  await expect(page.locator("[data-card='schedule']")).toContainText("担当業務がまだありません");
  // 役割：R1 R2 で同じ中身（モックの role-same 宣言どおり）
  await expect(page.locator("[data-roles]")).toHaveCount(0);
  // 一手は実在ルートへ
  await check(page, "bridge").locator("[data-fix]").click();
  await expect(page).toHaveURL(/\/setup\/bridge/, { timeout: 15_000 });
  await page.goto("/onboard/golive");
  await check(page, "model").locator("[data-fix]").click();
  await expect(page).toHaveURL(/\/onboard\/draft/, { timeout: 15_000 });
  // 段の帯：1〜5 は通した段（リンク）・6 はいま（自分自身）。すべて実在ルートで 200
  for (const [label, re] of [
    ["1. PCをつなぐ", /\/setup\/bridge/],
    ["2. 話す", /\/onboard\/interview/],
    ["3. たたき台", /\/onboard\/draft/],
    ["4. ログイン情報", /\/settings\/credentials/],
    ["5. テスト", /\/onboard\/testrun/],
    ["6. 本番へ", /\/onboard\/golive/],
  ] as const) {
    await page.goto("/onboard/golive");
    await page.getByRole("link", { name: new RegExp(`^(（済）)?${label}$`) }).click();
    await expect(page).toHaveURL(re, { timeout: 15_000 });
    expect((await page.request.get(page.url())).status(), "実在ルート（200）").toBe(200);
  }
  // 切れている Bridge（知らせが止まった）は、つないでいないのとは別の文で赤
  await bridgeRow(u);
  await admin(
    "update sessions set last_seen_at = now() - interval '5 minutes' where member_id = $1 and kind_id = 'bridge'",
    [u.memberId],
  );
  await page.goto("/onboard/golive");
  await expect(check(page, "bridge")).toContainText("からの知らせが止まっています", { timeout: 15_000 });
  await expect(check(page, "bridge")).toHaveAttribute("data-level", "red");
});

test("止めたまま本番へ は本人の会社の AI社員だけ（他社のものは 404・変わらない）。ログインしていなければ 401", async () => {
  const u = await person();
  const other = await signupViaApi("別の会社");
  const theirs = await employee(other, "営業社員", "x");
  expect(
    (await api("/api/auth-ext/onboard/golive/pause", { employee_id: theirs.aiId, paused: true }, u.token)).status,
  ).toBe(404);
  expect(
    (await admin<{ paused_at: string | null }>("select paused_at from ai_employees where id = $1", [theirs.aiId]))[0]!
      .paused_at,
  ).toBeNull();
  expect((await api("/api/auth-ext/onboard/golive/pause", { employee_id: "x", paused: true }, u.token)).status).toBe(
    422,
  );
  expect((await api("/api/auth-ext/onboard/golive", undefined, undefined, "GET")).status).toBe(401);
  expect((await api("/api/auth-ext/onboard/golive", {})).status).toBe(401);
});
