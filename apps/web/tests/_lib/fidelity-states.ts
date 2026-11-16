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
interface ShellOpts {
  /** PC の一覧の答え（無ければ live の 1 台） */
  devices?: unknown[];
  /** この PC の中だけの口（127.0.0.1:38617）の差し替え（無ければ 404＝Bridge は居ない）。本人の Bridge には届かせない */
  local?: (route: Route) => Promise<void>;
}
async function shellApi(page: Page, approvals: number, o: ShellOpts = {}): Promise<void> {
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  await page.route(/127\.0\.0\.1:38617/, (route) =>
    o.local ? o.local(route) : route.fulfill({ status: 404, body: "" }),
  );
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
      r = ok(
        o.devices ?? [
          { id: "d0", device_label: "Mac", state: "live", last_seen_at: "2026-11-15T00:00:00Z", version: "1.0.0" },
        ],
      );
    else if (p === "/api/v1/bridge/pairing-codes" && req.method() === "POST")
      r = { status: 201, body: { data: { code: "KQ7M2X", expires_at: "2099-01-01T00:00:00Z" } } };
    else if (p === "/api/v1/ticket_kinds") r = ok([], { limit: 50 });
    else if (p === "/api/v1/members") r = ok([{ id: ME, display_name: "高本", kind_id: "human" }], { limit: 200 });
    else if (p === "/api/v1/tickets" && req.method() === "GET")
      r = { status: 501, body: { error: "not_implemented", code: "NOT_IMPLEMENTED" } };
    else if (p === "/api/v1/me/ticket-drafts") r = ok([]);
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
}

/** 入口（登録・待つ）の口を差し替える（K-255）。ログインしていない人・規約の今の版は空・申し込みは pending。
 *  hold の口は答えない（確かめ中・読み込み中の状態を作る） */
const SIGNUP_EMAIL = "takamoto@engine-base.example";
const SIGNUP_TOKEN = "st_fidelity_0123456789abcdefghijklmnopqrstuvwxyz";
async function authApi(page: Page, hold: { me?: boolean; status?: boolean } = {}): Promise<void> {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    let r: { status: number; body: unknown } = {
      status: 401,
      body: { error: "unauthenticated", code: "UNAUTHENTICATED" },
    };
    if (/\/me$/.test(p) && hold.me) return; // 答えない（確かめ中のまま）
    if (p === "/api/v1/auth/sign-up/status") {
      if (hold.status) return; // 答えない（読み込み中のまま）
      r = { status: 200, body: { data: { state: "pending", email: SIGNUP_EMAIL } } };
    } else if (p === "/api/v1/auth/terms/current") r = { status: 200, body: { data: [] } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
}
/** 待つ画面の申し込みの印をこのタブに置く（登録の答えと同じ形・features/F1/sign-up/store.ts） */
async function putTicket(page: Page): Promise<void> {
  await page.addInitScript(
    ([t, e]) =>
      window.sessionStorage.setItem(
        "kaname.signup",
        JSON.stringify({ token: t, email: e, sent: true, mailError: null }),
      ),
    [SIGNUP_TOKEN, SIGNUP_EMAIL] as const,
  );
}
/** 確認のリンクと同意し直しの口を差し替える（K-256）。verify：hold＝確定の口が答えない（確定中のまま）・expired＝410・used＝409。
 *  同意し直しは本人（/me）と今の版（利用規約・プライバシーポリシーの 2 つ）を返す */
const VERIFY_TOKEN = "vt_fidelity_0123456789abcdefghijklmnopqrstuvwxyz";
const TERMS_AT = "2026-11-01T00:00:00.000Z";
async function verifyApi(page: Page, verify: "hold" | "expired" | "used" | "none"): Promise<void> {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    let r: { status: number; body: unknown } = {
      status: 401,
      body: { error: "unauthenticated", code: "UNAUTHENTICATED" },
    };
    if (req.method() === "POST" && p === "/api/v1/auth/sign-up/verify") {
      if (verify === "hold") return; // 答えない（確定中のまま）
      if (verify === "expired")
        r = {
          status: 410,
          body: { code: "E-AUTH-003", message: "リンクの期限が切れました。もう一度登録してください" },
        };
      else if (verify === "used")
        r = {
          status: 409,
          body: {
            code: "E-CONF-011",
            message: "このメールアドレスの登録は確認まで終わっています。ログインしてください",
          },
        };
    } else if (p === "/api/v1/auth/terms/current")
      r = {
        status: 200,
        body: {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000301",
              kind: "terms",
              version: "第2版",
              url: "/legal/terms?v=2",
              published_at: TERMS_AT,
            },
            {
              id: "00000000-0000-4000-8000-000000000302",
              kind: "privacy",
              version: "第2版",
              url: "/legal/privacy?v=2",
              published_at: TERMS_AT,
            },
          ],
        },
      };
    else if (/\/me$/.test(p) && verify === "none")
      r = { status: 200, body: { data: { id: ME, email: SIGNUP_EMAIL, name: "高本" } } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
}
const withToken = (path: string) => `${path}${path.includes("?") ? "&" : "?"}token=${VERIFY_TOKEN}`;

/** 3 秒たっても終わらないときに出る文（D-144.8）が出るまで待つ（決めた秒数では待たない） */
async function untilStatusText(page: Page, text: string): Promise<void> {
  await expect(page.locator('[data-part="auth-box"]').getByRole("status")).toContainText(text, { timeout: 15_000 });
}

/** キャンバス MePC の 2 台（最後に見えたは日本時間で 10/30 18:40） */
const BRIDGE_TWO = [
  { id: "d0", device_label: "高本の MacBook Pro", state: "live", last_seen_at: "2026-11-15T00:00:00Z", version: "1.4" },
  { id: "d1", device_label: "事務所の Windows", state: "asleep", last_seen_at: "2026-10-30T09:40:00Z", version: "1.4" },
];
/** この PC の中だけの口：ping は版を返し、つなぐ（pair）は別のアカウントでつながっている（409） */
async function localBridgeOtherAccount(route: Route): Promise<void> {
  const req = route.request();
  const cors = {
    "access-control-allow-origin": req.headers()["origin"] ?? "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  };
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
  const path = new URL(req.url()).pathname;
  if (path === "/ping")
    return route.fulfill({
      status: 200,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({ app: "kaname-bridge", version: "1.4", device_label: "この PC", connected: false }),
    });
  if (path === "/pair")
    return route.fulfill({
      status: 409,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({
        reason: "other_account",
        message: "この PC の Bridge は別のアカウントでつながっています",
      }),
    });
  return route.fulfill({ status: 404, headers: cors, body: "" });
}

export const FIDELITY_STATES: Record<string, (page: Page, path: string) => Promise<void>> = {
  // 鍵は "<鍵>": の字で探される（scripts/ci/fidelity_config.py）。整形が引用符を外さないようにする
  // prettier-ignore
  "signup": async (page, path) => {
    await authApi(page);
    await page.goto(path);
    await expect(page.getByLabel("名前", { exact: true })).toBeVisible();
  },
  "signup-waiting": async (page, path) => {
    await authApi(page);
    await putTicket(page);
    await page.goto(path);
    await expect(page.getByRole("button", { name: "送り直す" })).toBeVisible();
  },
  "signup-checking": async (page, path) => {
    await authApi(page, { me: true });
    await page.addInitScript(() => window.localStorage.setItem("kaname.token", "tok-fidelity"));
    await page.goto(path);
    await untilStatusText(page, "確かめています…");
  },
  "signup-waiting-loading": async (page, path) => {
    await authApi(page, { status: true });
    await putTicket(page);
    await page.goto(path);
    await untilStatusText(page, "読み込んでいます…");
  },
  // 確認のリンクを開いた後（K-256・キャンバス AuthVerifying・AuthVerifyExpired・AuthVerifyUsed）：手がかりつきで開き、状態の見出しか文が出るまで待つ
  "verify-confirming": async (page, path) => {
    await verifyApi(page, "hold");
    await page.goto(withToken(path));
    await untilStatusText(page, "登録を確定しています…");
  },
  "verify-expired": async (page, path) => {
    await verifyApi(page, "expired");
    await page.goto(withToken(path));
    await expect(page.locator('[data-part="auth-box"] h1')).toHaveText("リンクの期限が切れました");
  },
  "verify-used": async (page, path) => {
    await verifyApi(page, "used");
    await page.goto(withToken(path));
    await expect(page.locator('[data-part="auth-box"] h1')).toHaveText("登録は終わっています");
  },
  // 規約の同意し直し（K-256・キャンバス AuthConsent）：ログインの印を置き、本人と今の版を返して開き、チェックが出るまで待つ
  "consent-terms": async (page, path) => {
    await verifyApi(page, "none");
    await page.addInitScript(() => window.localStorage.setItem("kaname.token", "tok-fidelity"));
    await page.goto(path);
    await expect(page.getByRole("checkbox", { name: "利用規約とプライバシーポリシーに同意します" })).toBeVisible();
  },
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
  // PC をつなぐの中身（K-230・キャンバス EdPC・MePC・MePCInstalled）。口とこの PC の中だけの口は網の手前で差し替える（本人の Bridge に届かせない）
  //   bridge-code：PC 無し・Bridge 無し → つなぐ小窓が開き、コード（キャンバスと同じ KQ7M2X）が出るまで待つ
  "bridge-code": async (page, path) => {
    await shellApi(page, 2, { devices: [] });
    await page.goto(path);
    await expect(page.getByRole("dialog", { name: "PC をつなぐ" }).getByTestId("pairing-code")).toHaveText("KQ7M2X");
  },
  //   bridge-connected：キャンバス MePC の 2 行（つながっている 1 台と切れている 1 台）
  "bridge-connected": async (page, path) => {
    await shellApi(page, 2, { devices: BRIDGE_TWO });
    await page.goto(path);
    await expect(page.locator(".k-pc-card .k-pc-row")).toHaveCount(2);
    await expect(page.locator('[data-act="wake"]')).toBeVisible();
  },
  //   bridge-installed：この PC の口が答え（版 1.4）、つなぐと「別のアカウントでつながっている」（409）。押して「切り替える」が出るまで待つ
  "bridge-installed": async (page, path) => {
    await shellApi(page, 2, { devices: [], local: localBridgeOtherAccount });
    await page.goto(path);
    await page.getByRole("button", { name: "この PC の Bridge につなぐ" }).click();
    await expect(page.locator('button[data-act="switch-account"]')).toBeVisible();
  },
  "shell-tabs": async (page, path) => {
    await shellApi(page, 9);
    await page.goto(path);
    const tabs = page.locator(".k-tabs");
    await expect(tabs.locator(".k-nav-badge")).toHaveText("9");
    await expect(tabs.locator(".k-tab-create")).toBeVisible();
  },
};
