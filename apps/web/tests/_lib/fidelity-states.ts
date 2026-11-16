// キャンバスとの見た目の突き合わせで、画面をその組の状態に整える道具（K-216）。
//   鍵は 04_design/fidelity.json の組の state。値は (page, path) => Promise<void>：path（組の app）を開き、組の状態（人・データ・開いた小窓）にする。
//   最初は空（入れた組が 0）。組を入れる（enrolled: true）画面のチケットが、ここに鍵を足す。
//   enrolled の組の鍵がここに無いと scripts/ci/fidelity_config.py が赤にする（"<鍵>": の字で探す）。
//   キャンバスの書体の差し替え（routeCanvasFonts・K-238）は比べ方の部品に 1 つだけ置き、ここは出し直す（道具 visual_fidelity.mjs と同じ物を使う）。
//   外枠の組（shell-nav・shell-tabs・K-138）：口は網の手前（page.route）で差し替え、本人の Bridge（127.0.0.1:38617）にも届かせない。
//     後から届く口の値（承認待ちの数の印・自分の札・グループ・PC）が描かれるまで待ってから返す（届く前の値で比べない）
import { expect, type Page, type Route } from "@playwright/test";

export { routeCanvasFonts } from "../../../../scripts/ci/fidelity_compare.mjs";

const WS = "aaaaaaaa-0000-4000-8000-000000000001";
const ME = "11111111-0000-4000-8000-000000000001";

/** 外枠の口を差し替える：役 owner・名前 高本・会社 ENGINE BASE・承認待ち n・グループ 営業 EG・受託開発 JD・経理 KR・PC live（キャンバス Main と同じ人とデータ） */
async function shellApi(page: Page, approvals: number): Promise<void> {
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const ok = (data: unknown, meta: Record<string, unknown> = {}) => ({ status: 200, body: { data, meta } });
    let r: { status: number; body: unknown } = { status: 404, body: { code: "NOT_FOUND" } };
    if (p === "/api/auth/get-session")
      r = {
        status: 200,
        body: {
          session: { id: "s1", userId: ME, token: "t", expiresAt: "2099-01-01T00:00:00Z" },
          user: { id: ME, email: "me@example.com", name: "高本", emailVerified: true },
        },
      };
    else if (p === "/api/auth-ext/me")
      r = ok({
        member_id: ME,
        tenant_id: WS,
        display_name: "高本",
        role_id: "owner",
        scope_id: null,
        workspace_name: "ENGINE BASE",
      });
    else if (p === "/api/v1/scopes")
      r = ok(
        [
          { id: "22222222-0000-4000-8000-000000000001", name: "営業", ticket_prefix: "EG", tenant_id: WS },
          { id: "22222222-0000-4000-8000-000000000002", name: "受託開発", ticket_prefix: "JD", tenant_id: WS },
          { id: "22222222-0000-4000-8000-000000000003", name: "経理", ticket_prefix: "KR", tenant_id: WS },
        ],
        { limit: 200, writable: ["22222222-0000-4000-8000-000000000001"] },
      );
    else if (p === "/api/v1/approvals/queue") r = ok([], { limit: 20, counts: { total: approvals }, cursor: null });
    else if (p === "/api/v1/bridge/devices")
      r = ok([
        { id: "d0", device_label: "Mac", state: "live", last_seen_at: "2026-11-15T00:00:00Z", version: "1.0.0" },
      ]);
    else if (p === "/api/v1/ticket_kinds") r = ok([], { limit: 50 });
    else if (p === "/api/v1/members") r = ok([{ id: ME, display_name: "高本", kind_id: "human" }], { limit: 200 });
    else if (p === "/api/v1/tickets" && req.method() === "GET")
      r = { status: 501, body: { error: "not_implemented", code: "NOT_IMPLEMENTED" } };
    else if (p === "/api/v1/me/ticket-drafts") r = ok([]);
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
}

export const FIDELITY_STATES: Record<string, (page: Page, path: string) => Promise<void>> = {
  "shell-nav": async (page, path) => {
    await shellApi(page, 2);
    await page.goto(path);
    const nav = page.locator(".k-nav");
    await expect(nav.locator(".k-nav-badge")).toHaveText("2");
    await expect(nav.locator(".k-group-mark")).toHaveCount(3);
    await expect(nav.locator(".k-pc")).toHaveText("PC つながっている");
    await expect(page.locator(".k-bar .k-me .k-avatar")).toHaveText("高");
  },
  // 自分の設定の外枠（K-220・キャンバス MePC）：外枠の口と PC の一覧（つながっている 1 台）を返して /setup/bridge を開き、
  //   第 2 ナビと本文の見出し・左のメニューの PC の状態が描かれるまで待つ
  "bridge-shell": async (page, path) => {
    await shellApi(page, 2);
    await page.goto(path);
    await expect(page.locator('[aria-label="自分の設定の中"] .k-me-sub-t')).toHaveCount(5);
    await expect(page.locator(".k-nav .k-pc")).toHaveText("PC つながっている");
    await expect(page.locator("#connect-pc-title")).toHaveText("PC と使った量");
  },
  "shell-tabs": async (page, path) => {
    await shellApi(page, 9);
    await page.goto(path);
    const tabs = page.locator(".k-tabs");
    await expect(tabs.locator(".k-nav-badge")).toHaveText("9");
    await expect(tabs.locator(".k-tab-create")).toBeVisible();
  },
};
