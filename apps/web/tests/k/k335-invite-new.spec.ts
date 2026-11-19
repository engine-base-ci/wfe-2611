// K-335「招待の画面を口につなぐ：新しく作って参加・使えない招待・送り直し」の試験（実 Chrome・本物の口と DB）。
//   的：/invite/:token（ログインしていない人）。正の絵はモック /dev/mock/f2/<状態>（代表 OK answer=65b51ba7b8ba）。本番は同じ部品（features/F2/invite/views.tsx）。
//   口：getInvitation（K-331）・acceptInvitation（K-332）・requestInvitationResend（K-334）。前の道すじの口 /api/auth-ext/invitations/* を消すのは K-337（この葉は画面から呼ぶのをやめる）。
//   招く側（F10）はまだ無いので、招待の行は DB に直に入れる（前からの試験 prep.ts と同じ道）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { API, PW, admin, sha256, signupViaApi, uniqEmail } from "../_lib/api";
import { K335_DOWN_INVITE_TOKEN, K335_SHORT_PASSWORD, K335_WAIT_INVITE_TOKEN } from "../../test/_fake/secrets";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

type Owner = Awaited<ReturnType<typeof signupViaApi>>;
interface Inv {
  token: string;
  id: string;
  email: string;
}

async function invite(
  o: Owner,
  opt: { expired?: boolean; revoked?: boolean; used?: boolean; message?: string | null; email?: string } = {},
): Promise<Inv> {
  const token = randomBytes(24).toString("base64url");
  const email = opt.email ?? uniqEmail();
  const r = await admin<{ id: string }>(
    `insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, created_by, revoked_at, accepted_member_id, message)
     values ($1, $2, $3, 'member', $4, now() + ($5::text)::interval, $6, $7, $8, $9) returning id`,
    [
      o.tenantId,
      email,
      o.scopeId,
      sha256(token),
      opt.expired ? "-1 minute" : "7 days",
      o.memberId,
      opt.revoked ? new Date() : null,
      opt.used ? o.memberId : null,
      opt.message === undefined ? "月次をいっしょに回してもらいます" : opt.message,
    ],
  );
  return { token, id: r[0]!.id, email };
}

async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
}
async function open(page: Page, token: string) {
  await guard(page);
  const res = await page.goto(`/invite/${token}`);
  expect(res?.status()).toBe(200);
  await expect(page.locator('[data-auth="invite"]')).toBeVisible();
}
const apiCalls = (page: Page) => {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) seen.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  return seen;
};

test.describe("K-335 招待の画面：見た目はモックどおり", () => {
  for (const w of MATCH_WIDTHS) {
    test(`K335-UI-001 幅 ${w}：新しく作って参加（inv-new）が、モックと同じ役の値（箱・見出し・文・入力・主ボタン・px は ±2）`, async ({
      browser,
    }) => {
      // 本番の値をモックの値にそろえる（ワークスペース名・招いた人・グループ・ひとこと・期限の日 11/25）。メールの欄の文字は比べない（CTRL の input は texts を持たない）
      const o = await signupViaApi("株式会社ENGINE BASE");
      await admin("update members set display_name = '高本 聖斗' where id = $1", [o.memberId]);
      await admin("update scopes set name = '経理グループ' where id = $1", [o.scopeId]);
      const inv = await invite(o, { message: "経理の月次をいっしょに回してもらいます。よろしくお願いします" });
      await admin("update invitations set expires_at = '2099-11-25T12:00:00+09:00' where id = $1", [inv.id]);
      const { bad } = await matchMock(browser, "inv-new", w, (p) => open(p, inv.token), { base: "/dev/mock/f2" });
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
});

test.describe("K-335 招待の画面：招待の状態 × ログインしていない", () => {
  test("K335-UI-002 開くと下見の口を 1 回だけ呼ぶ（GET /api/v1/auth/invitations/<token>）。前の道すじ /api/auth-ext/invitations は呼ばない", async ({
    page,
  }) => {
    const o = await signupViaApi("株式会社下見");
    const inv = await invite(o);
    const seen = apiCalls(page);
    await open(page, inv.token);
    await expect(page.locator("h1")).toHaveText("株式会社下見 に招待されています");
    expect(seen.filter((s) => s.startsWith("GET /api/v1/auth/invitations/"))).toHaveLength(1);
    expect(seen.filter((s) => s.includes("/api/auth-ext/invitations"))).toEqual([]);
  });

  test("K335-UI-003 名前とパスワードで「参加する」：参加の口が 201 → 「付けるまで進めない」の画面（/mfa-setup）へ移る。DB に members と所属ができ、招待は使われる", async ({
    page,
  }) => {
    const o = await signupViaApi("株式会社参加");
    const inv = await invite(o);
    await open(page, inv.token);
    await page.getByLabel("名前").fill("木村 優");
    await page.getByLabel("パスワード", { exact: true }).fill(PW);
    await page.getByRole("button", { name: "参加する" }).click();
    await page.waitForURL(/\/mfa-setup/);
    const m = await admin<{ id: string; tenant_id: string }>(
      `select m.id, m.tenant_id from members m join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1`,
      [inv.email],
    );
    expect(m[0]?.tenant_id).toBe(o.tenantId);
    const used = await admin<{ a: string | null }>("select accepted_member_id as a from invitations where id = $1", [
      inv.id,
    ]);
    expect(used[0]!.a).toBe(m[0]!.id);
  });

  test("K335-UI-004 入力の誤り（口の 422 の文を欄の下に出す・ブラウザの止め required でなく noValidate）：① 名前が空・パスワードは正しい → 名前の下に「お名前を入れてください」② 名前あり・パスワード 11 文字 → パスワードの下に「パスワードは 12 文字以上にしてください」。どちらもページは移らない", async ({
    page,
  }) => {
    const o = await signupViaApi();
    const inv = await invite(o);
    await open(page, inv.token);
    await page.getByLabel("パスワード", { exact: true }).fill(PW);
    await page.getByRole("button", { name: "参加する" }).click();
    await expect(page.getByText("お名前を入れてください")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
    await page.getByLabel("名前").fill("木村 優");
    await page.getByLabel("パスワード", { exact: true }).fill(K335_SHORT_PASSWORD);
    await page.getByRole("button", { name: "参加する" }).click();
    await expect(page.getByText("パスワードは 12 文字以上にしてください")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
  });

  test("K335-UI-005 ひとことの無い招待：ひとことの箱（data-part=invite-message）を出さない", async ({ page }) => {
    const o = await signupViaApi();
    const inv = await invite(o, { message: null });
    await open(page, inv.token);
    await expect(page.locator('[data-part="invite-message"]')).toHaveCount(0);
  });

  test("K335-UI-006 期限切れ：「この招待は期限が過ぎました」→「送り直しを頼む」を押すと送り直しの口が 201 sent →「送り直しを頼みました」・ボタンは押せなくなる。開き直して押すと「今日はもう頼んであります」", async ({
    page,
  }) => {
    const o = await signupViaApi("株式会社期限");
    const inv = await invite(o, { expired: true });
    await open(page, inv.token);
    await expect(page.locator("h1")).toHaveText("この招待は期限が過ぎました");
    await page.getByRole("button", { name: "送り直しを頼む" }).click();
    await expect(page.getByText(/送り直しを頼みました/)).toBeVisible();
    await expect(page.getByRole("button", { name: "送り直しを頼む" })).toBeDisabled();
    await open(page, inv.token);
    await page.getByRole("button", { name: "送り直しを頼む" }).click();
    await expect(page.getByText("今日はもう頼んであります。新しい招待のメールを待ってください")).toBeVisible();
  });

  test("K335-UI-007 取り消し・使われた・見つからない：それぞれの見出しと文（モックの inv-revoked・inv-used・inv-notfound）。使われたは「ログインする」で /login へ", async ({
    page,
  }) => {
    const o = await signupViaApi();
    const rv = await invite(o, { revoked: true });
    await open(page, rv.token);
    await expect(page.locator("h1")).toHaveText("この招待は取り消されています");
    const us = await invite(o, { used: true });
    await open(page, us.token);
    await expect(page.locator("h1")).toHaveText("この招待はもう使われています");
    await expect(page.getByRole("link", { name: "ログインする" })).toHaveAttribute("href", "/login");
    await guard(page);
    await page.goto(`/invite/no-such-token-${randomBytes(4).toString("hex")}`);
    await expect(page.locator("h1")).toHaveText("この招待は見つかりません");
  });

  test("K335-UI-008 送りすぎ（下見の口が 429）：「少し待ってください」と口の retry_after_sec の秒が出る。Kaname の調子が悪い（503）：「いま Kaname の調子が悪くなっています」", async ({
    page,
  }) => {
    await guard(page);
    await page.route(new RegExp(`/api/v1/auth/invitations/${K335_WAIT_INVITE_TOKEN}$`), (r) =>
      r.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 37 }),
      }),
    );
    await page.goto(`/invite/${K335_WAIT_INVITE_TOKEN}`);
    await expect(page.locator("h1")).toHaveText("少し待ってください");
    await expect(page.getByText(/37 秒たってから/)).toBeVisible();
    await page.route(new RegExp(`/api/v1/auth/invitations/${K335_DOWN_INVITE_TOKEN}$`), (r) =>
      r.fulfill({ status: 503, body: "" }),
    );
    await page.goto(`/invite/${K335_DOWN_INVITE_TOKEN}`);
    await expect(page.locator("h1")).toHaveText("いま Kaname の調子が悪くなっています");
  });

  test("K335-UI-009 「ログインして入る」のリンクは /login?next=%2Finvite%2F<token>（ログインの後この画面に戻る・answer=becc3d3aa526 ③）。規約とプライバシーのリンクは今の版の url（K-53 の getCurrentTerms）", async ({
    page,
  }) => {
    const o = await signupViaApi();
    const inv = await invite(o);
    await open(page, inv.token);
    await expect(page.getByRole("link", { name: "ログインして入る" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(`/invite/${inv.token}`)}`,
    );
    const cur = (await (await fetch(`${API}/api/v1/auth/terms/current`)).json()) as {
      data: { kind: string; url: string }[];
    };
    const urlOf = (k: string) => cur.data.find((x) => x.kind === k)!.url;
    // 等しいこと（既定の /legal/terms は今の版の url の一部なので、含むでは既定のままでも緑になる）。toHaveAttribute は口の答えまで待つ
    await expect(page.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", urlOf("terms"));
    await expect(page.getByRole("link", { name: "プライバシー" })).toHaveAttribute("href", urlOf("privacy"));
  });

  test("K335-UI-010 幅 375：参加のあいだ二度押ししても参加の口は 1 回だけ（押している間は主ボタンが待ちの形で押せない）", async ({
    page,
  }) => {
    const o = await signupViaApi();
    const inv = await invite(o);
    const seen = apiCalls(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, inv.token);
    await page.getByLabel("名前").fill("二度押し");
    await page.getByLabel("パスワード", { exact: true }).fill(PW);
    const b = page.getByRole("button", { name: "参加する" });
    await b.dblclick();
    await page.waitForURL(/\/mfa-setup/);
    expect(seen.filter((s) => s.startsWith("POST /api/v1/auth/invitations/") && s.endsWith("/accept"))).toHaveLength(1);
  });
  // ---- 外に影響する手順（画面は口を呼ぶだけ）：参加の口・送り直しの口が失敗したとき
  test("K335-UI-011 参加の口が 503：ページは移らず、入れた名前は残り、赤の知らせ「いま Kaname の調子が悪くなっています。少し待ってから、もう一度押してください」が出て、「参加する」をもう一度押せる", async ({
    page,
  }) => {
    const o = await signupViaApi();
    const inv = await invite(o);
    await guard(page);
    await page.route(/\/api\/v1\/auth\/invitations\/[^/]+\/accept$/, (r) =>
      r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "E-PAGE-003" }) }),
    );
    await open(page, inv.token);
    await page.getByLabel("名前").fill("木村 優");
    await page.getByLabel("パスワード", { exact: true }).fill(PW);
    await page.getByRole("button", { name: "参加する" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "いま Kaname の調子が悪くなっています。少し待ってから、もう一度押してください" }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
    await expect(page.getByLabel("名前")).toHaveValue("木村 優");
    await expect(page.getByRole("button", { name: "参加する" })).toBeEnabled();
  });

  test("K335-UI-012 送り直しの口が result failed（メールが送れなかった）：赤の知らせ「送れませんでした。もう一度押してください」が出て、「送り直しを頼む」は押せるまま", async ({
    page,
  }) => {
    const o = await signupViaApi();
    const inv = await invite(o, { expired: true });
    await guard(page);
    await page.route(/\/api\/v1\/auth\/invitations\/[^/]+\/resend-request$/, (r) =>
      r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { result: "failed" } }) }),
    );
    await open(page, inv.token);
    await page.getByRole("button", { name: "送り直しを頼む" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "送れませんでした。もう一度押してください" })).toBeVisible();
    await expect(page.getByRole("button", { name: "送り直しを頼む" })).toBeEnabled();
  });
  test("K335-UI-013 下見の後に参加の口が断った：409・E-INV-006 → 「ログインして参加する」の形（account）へ、410・E-INV-003 → 「この招待は期限が過ぎました」へ。ページの URL は /invite/<token> のまま", async ({
    page,
  }) => {
    const o = await signupViaApi();
    for (const [status, code, see] of [
      [409, "E-INV-006", "ログインして参加する"],
      [410, "E-INV-003", "この招待は期限が過ぎました"],
    ] as const) {
      const inv = await invite(o);
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await guard(page);
      await page.route(/\/api\/v1\/auth\/invitations\/[^/]+\/accept$/, (r) =>
        r.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: "refused", code }) }),
      );
      await open(page, inv.token);
      await page.getByLabel("名前").fill("木村 優");
      await page.getByLabel("パスワード", { exact: true }).fill(PW);
      await page.getByRole("button", { name: "参加する" }).click();
      await expect(page.getByText(see).first()).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
    }
  });
});
