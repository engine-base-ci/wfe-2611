// K-877「ゲストの参加と、参加の後の振り分け（ゲストはゲストの場所へ）・役割の呼び名「ゲスト」」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f11/mb-join（段 3 の招待を受けて参加する画面・役割「ゲスト」。本番と同じ部品 features/F2/invite/views.tsx・代表の答え answer=4961f0280e9a・6ba09f587792）。
//   招待の下見 getInvitation（GET /api/v1/auth/invitations/:token）・参加 acceptInvitation（POST …/accept）・自分のこと /api/auth-ext/me・
//   はじめの設定の進み具合 /api/auth-ext/setup-state だけを網の手前で差し替える。ログインの印は本物（signupViaApi・loginAs）。
//   ゲストの口の答え（role_id が requester・参加の後の行き先 next）の形は 11_tickets/K-875.md（違えば下の meReply・ACCEPT だけを合わせる）。
//   本人の Bridge（127.0.0.1:38617）には届かせない。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { loginAs, signupViaApi } from "../_lib/api";
import { ROOT } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const SEIKO = "セイコー株式会社（ゲスト）";
const TOKEN = "k877-guest-invite-token";
const WEB = join(ROOT, "apps/web");

interface M {
  setupReads: number;
  meReads: number;
  accepts: Record<string, unknown>[];
  internal: string[];
  role: string;
}
const preview = (group: string | null, over: Record<string, unknown> = {}) => ({
  data: {
    state: "ok",
    workspace_name: "株式会社ENGINE BASE",
    inviter_name: "高本 聖斗",
    group_name: group,
    role: "requester",
    message: "請求書のご確認と、ご依頼の受け付けをこちらでお願いします",
    email: "sano@seiko.example",
    expires_at: "2026-11-30T09:00:00Z",
    account_exists: false,
    ...over,
  },
});
/** 招待の下見・参加・自分のこと・はじめの設定を差し替える。社内の口（メンバー・チケット・承認）を呼んだら internal に残す */
async function mockGuest(
  page: Page,
  role = "requester",
  group: string | null = "営業",
  over: Record<string, unknown> = {},
): Promise<M> {
  const m: M = { setupReads: 0, meReads: 0, accepts: [], internal: [], role };
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const send = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "GET" && p === `/api/v1/auth/invitations/${TOKEN}`) return send(200, preview(group, over));
    if (req.method() === "POST" && p === `/api/v1/auth/invitations/${TOKEN}/accept`) {
      m.accepts.push((req.postDataJSON() ?? {}) as Record<string, unknown>);
      return send(201, { data: { token: "k877-session-token", next: "/mfa-setup" } });
    }
    if (p === "/api/auth-ext/me") {
      m.meReads++;
      return send(200, {
        data: { member_id: "m877", tenant_id: "t877", display_name: "佐野", role_id: m.role, scope_id: null },
        meta: {},
      });
    }
    if (p === "/api/auth-ext/setup-state") {
      m.setupReads++;
      return send(200, { data: { step: 2, total: 6 }, meta: {} });
    }
    if (/\/api\/v1\/(workspace\/members|tickets|approvals|scopes)/.test(p)) {
      m.internal.push(p);
      return send(403, { error: "forbidden", code: "FORBIDDEN", details: [] });
    }
    return route.fallback();
  });
  return m;
}
async function openInvite(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  expect((await page.goto(`/invite/${TOKEN}`))?.status()).toBe(200);
  await expect(page.locator('[data-auth="invite"]')).toBeVisible();
}

let owner: Awaited<ReturnType<typeof signupViaApi>>;
test.beforeAll(async () => {
  owner = await signupViaApi("株式会社ENGINE BASE");
});

// ---------------------------------------------------------------- モックと本番の突き合わせ
const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
const PAIRS = (
  [
    ["box", '[data-part="auth-box"]', BOX],
    ["h1", '[data-part="auth-box"] h1', ["x", "y", ...TEXT]],
    ["lead", '[data-part="auth-box"] .k-auth-lead', ["x", "y", "width", "font-size", "color", "line-height", "texts"]],
    ["note", '[data-part="auth-box"] .k-auth-note', ["x", "y", ...TEXT]],
    ["primary", '[data-part="auth-box"] button[data-variant="primary"]', CTRL],
    ["input", '[data-part="auth-box"] input', CTRL.filter((p) => p !== "texts")],
    ["alt", '[data-part="auth-box"] .k-auth-alt', ["x", "y", ...TEXT]],
  ] as const
).map(([role, sel, props]) => ({ name: role, role, canvas: sel, app: sel, props: [...props] }));
for (const w of MATCH_WIDTHS) {
  test(`K877-UI-001 mb-join 幅 ${w}：役割「ゲスト」の参加の画面の位置と大きさと字がモックと合う（導入の行の「セイコー株式会社（ゲスト）の ゲスト として」も字を比べる）`, async ({
    browser,
  }) => {
    const { bad, rows } = await matchMock(
      browser,
      "mb-join",
      w,
      async (page) => {
        await mockGuest(page, "requester", SEIKO);
        await openInvite(page, w);
      },
      { pairs: PAIRS, base: "/dev/mock/f11", blur: true },
    );
    expect(new Set(rows.map((r) => r.part)), "本文の役で比べた").toContain("h1");
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test("K877-UI-002 ゲストの招待の画面：「高本 聖斗 さんから ・ セイコー株式会社（ゲスト）の ゲスト として」（社内のグループの名前でなくゲストのグループの名前）・「依頼する側」「取引先」の字が無い", async ({
  page,
}) => {
  await mockGuest(page, "requester", SEIKO);
  await openInvite(page);
  await expect(page.locator(".k-auth-lead[data-kind='sub']")).toHaveText(
    `高本 聖斗 さんから ・ ${SEIKO}の ゲスト として`,
  );
  await expect(page.locator('[data-part="invite-message"]')).toContainText("請求書のご確認と");
  await expect(page.locator("body")).not.toContainText("依頼する側");
  await expect(page.locator("body")).not.toContainText("取引先");
});

test("K877-UI-003 新しく作って参加：名前とパスワードを入れて参加を押すと acceptInvitation を 1 回呼び、口が返した行き先 /mfa-setup へ移る（社内の人と同じログインの強さ・付けるまで進めない）", async ({
  page,
}) => {
  const m = await mockGuest(page, "requester", SEIKO);
  await openInvite(page);
  await page.getByLabel("名前", { exact: true }).fill("佐野 太郎");
  await page.getByLabel("パスワード", { exact: true }).fill("K877-pass-Strong-0001");
  const moved = page.waitForRequest((r) => new URL(r.url()).pathname === "/mfa-setup");
  await page.locator('[data-auth="invite"] button[data-variant="primary"]').click();
  await moved;
  expect(m.accepts).toHaveLength(1);
  expect(Object.keys(m.accepts[0]!).sort()).toEqual(["name", "password"]);
});

// ---------------------------------------------------------------- 参加の後の振り分け（入口 /）
test("K877-UI-004 入口 / ：役割がゲストの人はゲストの場所 /portal へ送る・はじめの設定の進み具合の口と、社内の口（メンバー・チケット・承認）は呼ばない", async ({
  page,
}) => {
  const m = await mockGuest(page, "requester");
  await loginAs(page, owner.token);
  await page.goto("/");
  await expect(page).toHaveURL(/\/portal(\?|$)/);
  expect(m.setupReads, "ゲストにはじめの設定は無い").toBe(0);
  expect(m.internal, "社内の口を呼ばない").toEqual([]);
  expect(m.meReads, "自分のことは 1 回だけ読む").toBe(1);
});

test("K877-UI-005 入口 / ：社内の人（役割 owner）は今までどおり・ゲストの場所へは送らず、はじめの設定の続き（途中の段）へ。進み具合の口を 1 回読む", async ({
  page,
}) => {
  const m = await mockGuest(page, "owner");
  await loginAs(page, owner.token);
  await page.goto("/");
  await expect.poll(() => m.setupReads).toBe(1);
  await expect(page).not.toHaveURL(/\/portal/);
});

test("K877-UI-006 入口 / ：ログインしていない人はログインの画面へ（ゲストの振り分けより前に決まる・自分のことの口を呼ばない）", async ({
  page,
}) => {
  const m = await mockGuest(page, "requester");
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  expect(m.meReads).toBe(0);
});

test("K877-UI-007 ゲストが社内の画面（/members）を直に開く：「いまの権限では開けません」・戻る先はゲストの場所 /portal・メンバーの口は呼ばない（役割が社内の物にならない）", async ({
  page,
}) => {
  const m = await mockGuest(page, "requester");
  await loginAs(page, owner.token);
  await page.goto("/members");
  await expect(page.locator('[data-state="forbidden"]')).toBeVisible();
  await expect(page.locator('[data-state="forbidden"]')).toContainText("いまの権限では開けません");
  await expect(page.locator('[data-state="forbidden"] a')).toHaveAttribute("href", "/portal");
  expect(m.internal).toEqual([]);
});

test("K877-UI-008 ゲストが /portal を開いても入口に弾き返されない（/portal のまま。振り分けは入口 / だけ）", async ({
  page,
}) => {
  await mockGuest(page, "requester");
  await loginAs(page, owner.token);
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/portal(\?|$)/);
});

// ---------------------------------------------------------------- 幅・折れ・部品
test("K877-UI-009 幅 320・375・768・1024・1440：参加の画面で横のはみ出し 0・文の中のリンク「ログインして入る」が 1 行に収まる（折れない）", async ({
  page,
}) => {
  await mockGuest(page, "requester", SEIKO, { account_exists: true });
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openInvite(page, w);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `幅 ${w}`,
    ).toBeLessThanOrEqual(0);
    const rects = await page
      .locator(".k-auth-alt a")
      .first()
      .evaluate((a) => a.getClientRects().length);
    expect(rects, `「ログインして入る」の行の数 幅 ${w}`).toBe(1);
  }
});

test("K877-UI-010 呼び名と書き出し：features/F2/invite/views.tsx の ROLE_LABEL.requester は「ゲスト」で「依頼する側」が apps/web に無い・sign-up.css の `.k-auth-alt a` は折らない（white-space: nowrap）", async () => {
  const views = readFileSync(join(WEB, "features/F2/invite/views.tsx"), "utf8");
  expect(views).toMatch(/requester:\s*"ゲスト"/);
  expect(views).not.toContain("依頼する側");
  const css = readFileSync(join(WEB, "features/F1/sign-up/sign-up.css"), "utf8");
  expect(css).toMatch(/\.k-auth-alt a\s*\{[^}]*white-space:\s*nowrap/);
  const role = readFileSync(join(WEB, "lib/auth/role.tsx"), "utf8");
  expect(role, "ゲストは社内の役割（R1〜）に入れない").toMatch(/requester:\s*\[\s*\]/);
});

test("K877-UI-011 モックの持ち主：mocks.tsx で K-877 の状態は mb-join の 1 つだけで、頭の mock: と同じ", async () => {
  const src = readFileSync(join(WEB, "app/(dev)/dev/mock/f11/mocks.tsx"), "utf8");
  const mine = [...src.matchAll(/id:\s*"([^"]+)"[\s\S]*?ticket:\s*"(K-\d+)"/g)]
    .filter((x) => x[2] === "K-877")
    .map((x) => x[1]);
  expect(mine).toEqual(["mb-join"]);
  const head = readFileSync(join(ROOT, "11_tickets/K-877.md"), "utf8")
    .match(/^mock:\s*\[(.*)\]$/m)![1]!
    .split(",")
    .map((s) => s.trim());
  expect(head).toEqual(mine);
});
