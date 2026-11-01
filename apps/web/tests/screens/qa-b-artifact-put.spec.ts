// T-B-41 自分のAI が作ったファイル・調べた結果を道具 artifact_put で成果物として渡す（D-121）。
//   画面 → API → 本物の Bridge の輪（apps/bridge/dist）→ 偽の Claude Code（一時フォルダに png・pdf・csv・md・xlsx を作り、本物の道具のサーバーで渡す）→ API（置き場 C4・台帳 DB）→ 画面。
//   テストの名前に正本の行 ID を持つ（op_gate.py）。本人の本物の Bridge は止めない（hideRealBridge）
import { expect, test, type Page } from "@playwright/test";
import { admin, hideRealBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridges: AgentBridge[] = [];
test.beforeEach(({ page }) => hideRealBridge(page));
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});
const box = (page: Page) => page.getByRole("textbox", { name: "自分のAIに書く" });
async function ready(page: Page) {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai/chat");
  await expect(box(page)).toBeVisible({ timeout: 20_000 });
  return u;
}
const panel = (page: Page) => page.locator("[data-artifact]");

test("CHT-41-001 CHT-41-003 「成果物にして」→ 返事の下にカードが 5 枚。横で開くと 画像が見える・PDF が読める・CSV が表・文書が読める・xlsx は落として開く", async ({ page }) => {
  const u = await ready(page);
  await box(page).fill("請求のまとめを成果物にして");
  await box(page).press("Enter");
  const ai = page.locator('.msg[data-who="ai"]:not([data-streaming])').last();
  await expect(ai).toContainText("成果物を渡しました", { timeout: 60_000 });
  await expect(ai, "5 つとも渡せた").not.toContainText("渡せませんでした");
  await expect(page.locator("[data-working]")).toHaveCount(0);
  const cards = page.locator("[data-art-card]");
  await expect(cards).toHaveCount(5, { timeout: 15_000 });
  const open = async (title: string) => {
    await cards.filter({ hasText: title }).locator("[data-art-open]").click();
    await expect(panel(page)).toBeVisible({ timeout: 10_000 });
    await expect(panel(page)).toContainText(title);
  };
  await open("請求のグラフ");
  await expect(panel(page).locator("img.amedia"), "画像が見える").toBeVisible();
  await open("請求のまとめ（PDF）");
  await expect(panel(page).locator("iframe.apdf"), "PDF が枠の中で読める").toBeVisible();
  await open("請求台帳");
  await expect(panel(page).locator("table"), "CSV は表").toContainText("セイコー");
  await open("調べた結果");
  await expect(panel(page), "文書が読める").toContainText("セイコーの着手金は契約時に 3 割");
  await open("請求のまとめ（表計算）");
  await expect(panel(page), "xlsx は落として開く").toContainText("落として開いてください");
  await panel(page).locator("[data-art-close]").click();
  // 台帳：成果物 5・版 1・仕事に結び、結末の後は返事に結ぶ。中身は DB に無く置き場にある
  const jobs = await admin<{ id: string }>("select id from bridge_jobs where member_id = $1 order by created_at desc limit 1", [u.memberId]);
  const rows = await admin<{ title: string; format_id: string; source_message_id: string | null; current_version: number; storage_ref: string; size_bytes: string }>(
    "select a.title, a.format_id, a.source_message_id, a.current_version, v.storage_ref, v.size_bytes from artifacts a join artifact_versions v on v.artifact_id = a.id and v.version = a.current_version where a.source_job_id = $1 order by a.created_at",
    [jobs[0]!.id],
  );
  expect(rows.map((r) => r.format_id)).toEqual(["png", "pdf", "csv", "md", "xlsx"]);
  for (const r of rows) {
    expect(r.current_version).toBe(1);
    expect(r.source_message_id, "結末の後は返事に結ばれている").toBeTruthy();
    expect(r.storage_ref).toMatch(/\S/);
    expect(Number(r.size_bytes)).toBeGreaterThan(0);
  }
  const cols = (await admin<{ column_name: string }>("select column_name from information_schema.columns where table_name in ('artifacts','artifact_versions')")).map((c) => c.column_name);
  for (const plain of ["body", "content", "data", "bytes"]) expect(cols, "中身の列は無い（置き場にある）").not.toContain(plain);
  const au = await admin<{ payload: Record<string, unknown> }>("select payload from audit_events where action = 'agent.artifact_put' and target_type = 'artifact' and payload->>'job_id' = $1", [jobs[0]!.id]);
  expect(au).toHaveLength(5);
  expect(Object.keys(au[0]!.payload).sort(), "証跡は名前・種類・大きさ・仕事だけ").toEqual(["format", "job_id", "size", "title"]);
});

test("CHT-41-006 道具を呼ばない仕事では成果物は増えない（AI が読んだだけのファイルは渡らない）", async ({ page }) => {
  const u = await ready(page);
  await box(page).fill("請求台帳を読んでまとめて");
  await box(page).press("Enter");
  await expect(page.locator('.msg[data-who="ai"]:not([data-streaming])').last()).toContainText("9 月の請求のまとめ", { timeout: 40_000 });
  await expect(page.locator("[data-working]")).toHaveCount(0);
  const n = await admin<{ n: string }>("select count(*) as n from artifacts where owner_member_id = $1", [u.memberId]);
  expect(Number(n[0]!.n)).toBe(0);
  await expect(page.locator("[data-art-card]")).toHaveCount(0);
  const tools = await admin<{ n: string }>("select count(*) as n from bridge_job_events e join bridge_jobs j on j.id = e.job_id where j.member_id = $1 and e.kind = 'tool'", [u.memberId]);
  expect(Number(tools[0]!.n), "道具の行（Read）は残る").toBeGreaterThanOrEqual(1);
});
