// 成果物を会話の横で開いて直し、版を残して戻す（D-106・T-B-23）を実ブラウザで押して確かめる。テストの名前に正本の行 ID を持つ（op_gate.py）。
// Bridge は本物の輪（apps/bridge の loop）を回し、CLI だけ偽物（scripts/dev/fake-claude-demo.mjs）に差す。置き場は手元の .dev-storage（関門 C4）
import { chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { admin, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridge: AgentBridge | null = null;
test.afterEach(() => {
  bridge?.stop();
  bridge = null;
});

async function ready(page: Page, width = 1440) {
  const u = await signupViaApi();
  bridge = await startAgentBridge(u.token);
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/ai/chat");
  await expect(page.locator('[data-part="conversation"]')).toBeVisible({ timeout: 20_000 });
  return u;
}
const box = (page: Page) => page.getByRole("textbox", { name: "自分のAIに書く" });
const say = async (page: Page, text: string) => {
  await box(page).fill(text);
  await box(page).press("Enter");
};
const lastAi = (page: Page) => page.locator('.msg[data-who="ai"]:not([data-streaming])').last();
const panel = (page: Page) => page.locator("[data-artifact]");
const versions = (memberId: string) =>
  admin<{ version: number; reverted_from: number | null }>(
    "select v.version, v.reverted_from from artifact_versions v join artifacts a on a.id = v.artifact_id where a.owner_member_id = $1 order by v.version",
    [memberId],
  );
/** 返事を 1 つもらって、書き出して横に開く */
async function exported(page: Page) {
  const u = await ready(page);
  await say(page, "9 月の請求をまとめて");
  await expect(lastAi(page)).toContainText("9 月の請求のまとめ", { timeout: 20_000 });
  await lastAi(page).locator("[data-export]").click();
  await expect(panel(page)).toBeVisible({ timeout: 10_000 });
  return u;
}

test("CHT-23-001 CHT-23-002 返事の「書き出す」で成果物ができて横に開く。名前は返事の見出し。閉じても会話のカードから開き直せる", async ({
  page,
}) => {
  const u = await exported(page);
  await expect(panel(page).locator("[data-art-title]")).toHaveText("9 月の請求のまとめ");
  await expect(panel(page).locator(".ah .v")).toHaveText("版 1");
  await expect(panel(page)).toContainText("セイコーの着手金は、契約時に 3 割です。");
  expect(await versions(u.memberId)).toEqual([{ version: 1, reverted_from: null }]);
  // 広い画面は右に寄せ、会話は狭めて隠れない
  const dock = await page.locator(".artdock").boundingBox();
  expect(dock!.x + dock!.width).toBeCloseTo(1440, 0);
  expect(dock!.width).toBeLessThanOrEqual(460);
  const chat = await page.locator(".chat").boundingBox();
  expect(chat!.x + chat!.width, "会話は成果物の下に隠れない").toBeLessThanOrEqual(dock!.x + 1);
  // 閉じても残り、カードから開き直せる
  await panel(page).locator("[data-art-close]").click();
  await expect(panel(page)).toHaveCount(0);
  const card = lastAi(page).locator("[data-art-card]");
  await expect(card).toContainText("9 月の請求のまとめ");
  await expect(card).toContainText("文書 · 版 1 · 成果物");
  await card.locator("[data-art-open]").click();
  await expect(panel(page).locator("[data-art-title]")).toHaveText("9 月の請求のまとめ");
  // Esc でも閉じる
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
});

test("CHT-23-003 CHT-23-004 CHT-23-007 直して保存すると新しい版。前の版を開いて戻すと、その中身で新しい版になり、どの版も残る。落とすのは今の版", async ({
  page,
}) => {
  const u = await exported(page);
  await panel(page).locator("[data-art-edit]").click();
  const ed = panel(page).locator("[data-art-text]");
  const v1 = await ed.inputValue();
  expect(v1).toContain("## 9 月の請求のまとめ");
  await expect(panel(page).locator("[data-art-save]"), "直すまで保存は押せない").toBeDisabled();
  await ed.fill(`${v1}\n\n追記：京蟻は 10/5 に入金予定`);
  await panel(page).locator("[data-art-save]").click();
  await expect(panel(page).locator(".ah .v")).toHaveText("版 2", { timeout: 10_000 });
  await expect(panel(page)).toContainText("追記：京蟻は 10/5 に入金予定");
  expect(await versions(u.memberId)).toEqual([
    { version: 1, reverted_from: null },
    { version: 2, reverted_from: null },
  ]);
  // 版 1 を開く → 前の中身が見え、その版に戻す
  await panel(page).locator("[data-art-version='1'] .vopen").click();
  await expect(panel(page).locator("[data-art-old]")).toContainText("版 1 を見ています（いまは版 2）");
  await expect(panel(page)).not.toContainText("追記：京蟻は 10/5 に入金予定");
  await panel(page).locator("[data-art-revert-here]").click();
  await expect(panel(page).locator(".ah .v")).toHaveText("版 3", { timeout: 10_000 });
  await expect(panel(page).locator("[data-art-old]")).toHaveCount(0);
  await expect(panel(page).locator("[data-art-version='3']")).toContainText("版 1 に戻した");
  await expect(panel(page).locator("[data-art-version]")).toHaveCount(3);
  await expect(panel(page)).not.toContainText("追記：京蟻は 10/5 に入金予定");
  expect(await versions(u.memberId)).toEqual([
    { version: 1, reverted_from: null },
    { version: 2, reverted_from: null },
    { version: 3, reverted_from: 1 },
  ]);
  // 一覧の「この版に戻す」でも戻せる（版 2 → 版 4）
  await panel(page).locator("[data-art-revert='2']").click();
  await expect(panel(page).locator(".ah .v")).toHaveText("版 4", { timeout: 10_000 });
  await expect(panel(page)).toContainText("追記：京蟻は 10/5 に入金予定");
  // 落とす：今の版（版 4）の中身
  const [dl] = await Promise.all([page.waitForEvent("download"), panel(page).locator("[data-art-download]").click()]);
  expect(dl.suggestedFilename()).toBe("9 月の請求のまとめ_v4.md");
  expect(readFileSync((await dl.path())!, "utf8")).toContain("追記：京蟻は 10/5 に入金予定");
});

test("表は表として書き出せ、横で並べ替えて見られ、直すと新しい版（csv）", async ({ page }) => {
  const u = await ready(page);
  await say(page, "9 月の請求をまとめて");
  await expect(lastAi(page)).toContainText("9 月の請求のまとめ", { timeout: 20_000 });
  await lastAi(page).locator("[data-export-table]").click();
  await expect(panel(page).locator("[data-art-table]")).toBeVisible({ timeout: 10_000 });
  await expect(panel(page).locator("[data-art-title]")).toHaveText("取引先,金額,期日");
  const firstCol = () => panel(page).locator("[data-art-table] tbody tr td:first-child").allInnerTexts();
  expect(await firstCol()).toEqual(["セイコー", "京蟻", "SOICO"]);
  await panel(page).locator("[data-art-table] th button", { hasText: "金額" }).click();
  expect(await firstCol(), "金額の小さい順").toEqual(["京蟻", "SOICO", "セイコー"]);
  // 名前を直す
  await panel(page).locator("[data-art-title]").click();
  await panel(page).getByRole("textbox", { name: "成果物の名前" }).fill("9 月の請求の表");
  await panel(page).getByRole("textbox", { name: "成果物の名前" }).press("Enter");
  await expect(panel(page).locator("[data-art-title]")).toHaveText("9 月の請求の表");
  await expect(lastAi(page).locator("[data-art-card]")).toContainText("9 月の請求の表");
  await expect(lastAi(page).locator("[data-art-card]")).toContainText("表 · 版 1");
  // 表も直せる
  await panel(page).locator("[data-art-edit]").click();
  await panel(page).locator("[data-art-text]").fill("取引先,金額\nセイコー,990000\n京蟻,130000");
  await panel(page).locator("[data-art-save]").click();
  await expect(panel(page).locator(".ah .v")).toHaveText("版 2", { timeout: 10_000 });
  expect(await firstCol()).toEqual(["セイコー", "京蟻"]);
  const a = await admin<{ format_id: string; title: string }>(
    "select format_id, title from artifacts where owner_member_id = $1",
    [u.memberId],
  );
  expect(a).toEqual([{ format_id: "csv", title: "9 月の請求の表" }]);
});

test("CHT-23-006 E-ART-001-A E-ART-001-B E-ART-001-C E-ART-002-A E-ART-002-B E-ART-002-C 大きすぎる中身は保存せず理由を出し（E-ART-001）、置き場に置けなければ直した中身を残す（E-ART-002）", async ({
  page,
}) => {
  const u = await exported(page);
  await panel(page).locator("[data-art-edit]").click();
  const ed = panel(page).locator("[data-art-text]");
  await ed.fill("あ".repeat(360_000)); // 1 MB を超える
  await panel(page).locator("[data-art-save]").click();
  await expect(page.getByText("大きすぎて成果物にできません（1 MB まで）。分けて書き出してください")).toBeVisible({
    timeout: 10_000,
  });
  await expect(panel(page).locator(".ah .v")).toHaveText("版 1");
  // 置き場に書けない
  const tenant = (
    await admin<{ tenant_id: string }>("select tenant_id from artifacts where owner_member_id = $1", [u.memberId])
  )[0]!.tenant_id;
  const dir = join(process.cwd(), "..", "..", ".dev-storage", "tenants", tenant);
  chmodSync(dir, 0o555);
  try {
    await ed.fill("# 直した中身");
    await panel(page).locator("[data-art-save]").click();
    await expect(
      page.getByText(
        "成果物を保存できませんでした（保存先が応答しません）。直した中身は残っているので、もう一度保存してください",
      ),
    ).toBeVisible({ timeout: 10_000 });
    await expect(ed, "直した中身は消えない").toHaveValue("# 直した中身");
    await expect(panel(page).locator(".ah .v")).toHaveText("版 1");
  } finally {
    chmodSync(dir, 0o755);
  }
  await panel(page).locator("[data-art-save]").click();
  await expect(panel(page).locator(".ah .v")).toHaveText("版 2", { timeout: 10_000 });
  expect((await versions(u.memberId)).length).toBe(2);
});

test("CHT-23-002 狭い画面では成果物が全面に開き、横にはみ出さない", async ({ page }) => {
  await ready(page, 375);
  await say(page, "9 月の請求をまとめて");
  await expect(lastAi(page)).toContainText("9 月の請求のまとめ", { timeout: 20_000 });
  await lastAi(page).locator("[data-export]").click();
  await expect(panel(page)).toBeVisible({ timeout: 10_000 });
  const dock = await page.locator(".artdock").boundingBox();
  expect(Math.round(dock!.width)).toBe(375);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(0);
  await panel(page).locator("[data-art-close]").click();
  await expect(panel(page)).toHaveCount(0);
});
