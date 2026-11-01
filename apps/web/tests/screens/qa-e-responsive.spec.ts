// 1179 以下の会話画面（D-064.7・2026-10-01 user「レスポンシブ全くできていない」）。
//   直す前の実測：768〜1179 で分類の引き出し（216px・fixed）が開きっぱなしで会話に重なり、会話の一覧は高さ 70px の帯に押し込まれていた。375 でも一覧は帯。
//   期待：どの幅でも、何も開いていないときは本文に重なる固定の箱が無い。一覧は「会話の一覧」で開く引き出し。選ぶ・外を押す・Esc で閉じる。
//   レールの分類の引き出しも既定は閉じ、押したときだけ出て、外を押す・Esc で閉じる。1180 以上は左の列のまま（ボタンは出ない）
import { expect, test, type Page } from "@playwright/test";
import { loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridges: AgentBridge[] = [];
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});
async function ready(page: Page, width: number) {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token, {}));
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/ai/chat");
  await expect(page.locator('[data-part="conversation"]')).toBeVisible({ timeout: 30_000 });
  return u;
}
/** 本文（会話）に重なっている、位置が固定の見える箱。何も開いていなければ 0 */
async function overlapping(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const chat = document.querySelector(".kc")!.getBoundingClientRect();
    const hits: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const cs = getComputedStyle(el);
      // 見えない・触れないもの（閉じた引き出し・消えた幕）は重なっていない
      if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0" || cs.pointerEvents === "none") continue;
      if (el.closest(".tabbar") || el.closest("[popover]") || el.closest(".kc")) continue; // 下タブ・入力欄の箱・会話の中は除く
      const b = el.getBoundingClientRect();
      if (b.width < 8 || b.height < 8) continue;
      const over = Math.min(b.right, chat.right) - Math.max(b.left, chat.left);
      if (over > 2 && Math.min(b.bottom, chat.bottom) - Math.max(b.top, chat.top) > 2)
        hits.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} x${Math.round(b.left)} w${Math.round(b.width)}`);
    }
    return hits;
  });
}

for (const w of [375, 768, 955, 1024, 1100]) {
  test(`SCR-CLONE-CHAT-295 幅 ${w}：会話の一覧は「会話の一覧」で開く引き出し。既定は閉じていて本文に重なる箱が無い。選ぶ・外を押す・Esc で閉じる`, async ({ page }) => {
    await ready(page, w);
    expect(await overlapping(page), "何も開いていないのに本文に重なる固定の箱").toEqual([]);
    const chat = page.locator(".kc");
    // 会話の箱は最大 920（中央寄せ）。それより狭い幅では、レールと余白を引いた分がそのまま会話（引き出しの分だけ狭くなっていない）
    expect((await chat.boundingBox())!.width, "会話が幅いっぱい（引き出しの分だけ狭くなっていない）").toBeGreaterThan(Math.min(w - (w >= 768 ? 72 : 0) - 120, 880));
    const toggle = page.getByRole("button", { name: "会話の一覧" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const list = page.locator('[data-part="conversation-list"]');
    await expect(list).toBeHidden();
    // 開く → 一覧が見え、本文に幕がかかる
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(list).toBeVisible();
    await expect(page.locator("[data-sub-scrim]")).toBeVisible();
    // 新しく話す → 閉じる
    await list.locator("[data-new-conversation]").click();
    await expect(list).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // 外（幕）を押す → 閉じる
    await toggle.click();
    await expect(list).toBeVisible();
    await page.locator("[data-sub-scrim]").click({ position: { x: w - 10, y: 450 } });
    await expect(list).toBeHidden();
    // Esc → 閉じる
    await toggle.click();
    await expect(list).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    // 一覧から会話を選ぶ → 閉じる（新しく話したので 1 件ある）
    await toggle.click();
    await list.locator(".tl-open").first().click();
    await expect(list).toBeHidden();
    expect(await overlapping(page)).toEqual([]);
  });
}

test("SCR-CLONE-CHAT-295 幅 1180 以上：一覧は左の列。「会話の一覧」のボタンは出ない（押しても何も起きないボタンを作らない）", async ({ page }) => {
  await ready(page, 1180);
  await expect(page.locator('[data-part="conversation-list"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "会話の一覧" })).toBeHidden();
  const box = (await page.locator('[data-part="conversation-list"]').boundingBox())!;
  expect(box.x, "左の列（レールの右）").toBeGreaterThanOrEqual(216);
  expect(box.x).toBeLessThan(300);
  expect(await overlapping(page)).toEqual([]);
});

test("D-064.7 幅 955：レールの分類の引き出しは既定で閉じ、押すと 1 つ出て、外を押す・Esc で閉じる", async ({ page }) => {
  await ready(page, 955);
  const drawer = page.locator(".side-sub[data-last]");
  await expect(drawer).toHaveCount(0); // 一度も押していなければ無い
  await page.locator(".side-grp", { hasText: "自分のAI" }).click();
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS("position", "fixed");
  // 引き出しは貼り付けた見出しの上に出る（下に潜って頭が切れない・2026-10-01 実機）
  const top = await page.evaluate(() => document.elementFromPoint(150, 30)?.closest(".side-sub") !== null);
  expect(top, "引き出しの頭が見出しの下に潜っている").toBe(true);
  // 会話の一覧を開いてから分類を押すと、一覧は閉じる（左に 2 枚重ねない）
  await page.locator("[data-side-scrim]").click({ position: { x: 700, y: 300 } });
  await expect(page.locator(".side-sub[data-last]")).toBeHidden();
  await page.getByRole("button", { name: "会話の一覧" }).click();
  await expect(page.locator('[data-part="conversation-list"]')).toBeVisible();
  await page.locator(".side-grp", { hasText: "自分のAI" }).click();
  await expect(page.locator('[data-part="conversation-list"]')).toBeHidden();
  await expect(page.locator(".side-sub[data-last]")).toBeVisible();
  // 外を押す（引き出しの外は幕が受ける）→ 閉じる
  await expect(page.locator("[data-side-scrim]")).toBeVisible();
  await page.locator("[data-side-scrim]").click({ position: { x: 700, y: 300 } });
  await expect(drawer).toBeHidden(); // 閉じたあとも滑って消えるために残る（見えない）
  await page.locator(".side-grp", { hasText: "仕事" }).click();
  await expect(page.locator(".side-sub[data-last]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".side-sub[data-last]")).toBeHidden();
  expect(await overlapping(page)).toEqual([]);
});
