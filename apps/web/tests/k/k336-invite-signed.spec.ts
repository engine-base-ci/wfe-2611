// K-336「招待の画面を口につなぐ：アカウントがある人・ログイン中（今のアカウントで参加・別のメール・もう入っている）」の試験（実 Chrome・本物の口と DB）。
//   的：/invite/:token。正の絵はモック /dev/mock/f2/<状態>（inv-account・inv-signed・inv-other・inv-member）。代表の答え answer=becc3d3aa526 ②③④・7fe1f09fdab4 ⑦。
//   口：getInvitation（K-331）・acceptInvitation（K-333）・signOut（K-306）。ログインの画面は今の /login（next は同じ出どころの道だけ・lib/after-login.ts）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PW, admin, loginAs, sha256, signupViaApi } from "../_lib/api";
import { K336_EXPIRED_SESSION_TOKEN } from "../../test/_fake/secrets";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

type Owner = Awaited<ReturnType<typeof signupViaApi>>;

async function invite(o: Owner, email: string): Promise<{ token: string; id: string }> {
  const token = randomBytes(24).toString("base64url");
  const r = await admin<{ id: string }>(
    `insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, created_by)
     values ($1, $2, $3, 'member', $4, now() + interval '7 days', $5) returning id`,
    [o.tenantId, email, o.scopeId, sha256(token), o.memberId],
  );
  return { token, id: r[0]!.id };
}
async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
}
async function open(page: Page, token: string) {
  await guard(page);
  expect((await page.goto(`/invite/${token}`))?.status()).toBe(200);
  await expect(page.locator('[data-auth="invite"]')).toBeVisible();
}
/** 入り方を 1 つ持つ人にする（段 2 の K-321 の addTestEntry と同じ「試験の鍵」・付けるまで進めないの印を下ろす）。
 *  段 2 の表・列がまだ無ければ何もしない。ログイン中の試験の本人は付けるまで進めないの画面に止められずにこの画面へ戻れる */
async function withEntry(u: Owner): Promise<Owner> {
  const [t] = await admin<{ t: string | null }>("select to_regclass('kaname_auth.passkey')::text as t");
  if (t?.t)
    await admin(
      `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
       values (gen_random_uuid()::text, '試験の鍵', 'test-entry', $1, 'test-entry-' || gen_random_uuid()::text, 0, 'singleDevice', false, 'internal', now())`,
      [u.userId],
    );
  const col = await admin(
    "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sessions' and column_name = 'mfa_pending'",
  );
  if (col.length) await admin("update sessions set mfa_pending = false where member_id = $1", [u.memberId]);
  return u;
}
/** その印の sessions の行のワークスペース */
const sessionTenant = async (token: string) =>
  (
    await admin<{ t: string }>(
      "select x.tenant_id as t from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1",
      [token],
    )
  )[0]?.t;

test.describe("K-336 招待の画面：見た目はモックどおり", () => {
  for (const w of MATCH_WIDTHS) {
    test(`K336-UI-001 幅 ${w}：ログイン中・同じメール（inv-signed）が、モックと同じ役の値（箱・見出し・主ボタン・注・px は ±2）`, async ({
      browser,
    }) => {
      const host = await signupViaApi("株式会社ENGINE BASE");
      await admin("update members set display_name = '高本 聖斗' where id = $1", [host.memberId]);
      await admin("update scopes set name = '経理グループ' where id = $1", [host.scopeId]);
      const me = await withEntry(await signupViaApi("株式会社わたし"));
      const inv = await invite(host, me.email);
      await admin("update invitations set message = $2, expires_at = '2099-11-25T12:00:00+09:00' where id = $1", [
        inv.id,
        "経理の月次をいっしょに回してもらいます。よろしくお願いします",
      ]);
      const { bad } = await matchMock(
        browser,
        "inv-signed",
        w,
        async (p) => {
          await loginAs(p, me.token);
          await open(p, inv.token);
        },
        { base: "/dev/mock/f2" },
      );
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
});

test.describe("K-336 招待の画面：ログインの状態 × 招待", () => {
  test("K336-UI-002 宛てのメールにアカウントがある × ログインしていない：「ログインして参加する」だけ（名前とパスワードの欄は出さない）。押すと /login?next=/invite/<token>、ログインするとこの画面に戻り「今のアカウントで参加する」が出る", async ({
    page,
  }) => {
    const host = await signupViaApi("株式会社招く側");
    const me = await withEntry(await signupViaApi("株式会社わたし"));
    const inv = await invite(host, me.email);
    await open(page, inv.token);
    await expect(page.getByLabel("名前")).toHaveCount(0);
    await page.getByRole("link", { name: "ログインして参加する" }).click();
    await page.waitForURL((u) => u.pathname === "/login" && u.searchParams.get("next") === `/invite/${inv.token}`);
    // ログインの画面の欄と送るボタン（段 2 の K-316 が見た目を載せ替えても同じ役：メールの欄・パスワードの欄・form の submit）
    await page
      .getByLabel(/メール/)
      .first()
      .fill(me.email);
    await page.getByLabel("パスワード", { exact: true }).fill(PW);
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForURL(new RegExp(`/invite/${inv.token}$`));
    await expect(page.getByRole("button", { name: "今のアカウントで参加する" })).toBeVisible();
  });

  test("K336-UI-003 ログイン中・同じメール：「今のアカウントで参加する」→ 参加の口が 201 → 招かれたワークスペースに切り替わって「/」へ（answer=becc3d3aa526 ④）。その印の sessions の行は招かれたワークスペース", async ({
    page,
  }) => {
    const host = await signupViaApi("株式会社切り替え先");
    const me = await withEntry(await signupViaApi("株式会社もとの場所"));
    const inv = await invite(host, me.email);
    await loginAs(page, me.token);
    await open(page, inv.token);
    await expect(page.getByText(/参加すると 株式会社切り替え先 に切り替わります/)).toBeVisible();
    await page.getByRole("button", { name: "今のアカウントで参加する" }).click();
    await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/today" || u.pathname === "/mine");
    const token = await page.evaluate(() => window.localStorage.getItem("kaname.token"));
    expect(await sessionTenant(token!)).toBe(host.tenantId);
  });

  test("K336-UI-004 ログイン中・別のメール宛て：「この招待は a@… 宛てです。いまは b@… でログインしています」と「ログアウトして開き直す」（answer=becc3d3aa526 ②）。押すとログアウトの口でその印のセッションが消え、画面の印（kaname.token）も消え、同じ招待の画面がログインしていない形（新しく作って参加）で開き直る", async ({
    page,
  }) => {
    const host = await signupViaApi();
    const me = await withEntry(await signupViaApi());
    const someoneElse = `${randomBytes(4).toString("hex")}-other@example.com`;
    const inv = await invite(host, someoneElse);
    // 印は 1 回だけ入れる（loginAs は読み込みのたびに入れ直すので、ログアウトした後も印が戻り、確かめにならない）
    await guard(page);
    await page.goto("/help");
    await page.evaluate((t) => window.localStorage.setItem("kaname.token", t), me.token);
    await open(page, inv.token);
    await expect(
      page.getByText(new RegExp(`この招待は ${someoneElse} 宛てです。いまは ${me.email} でログインしています`)),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /参加する/ })).toHaveCount(0);
    await page.getByRole("button", { name: "ログアウトして開き直す" }).click();
    await expect(page.getByRole("button", { name: "参加する" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
    expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeNull();
    const left = await admin<{ n: number }>("select count(*)::int as n from kaname_auth.session where token = $1", [
      me.token,
    ]);
    expect(left[0]!.n, "その印のセッションは消えた").toBe(0);
  });

  test("K336-UI-005 ログイン中・もう入っているワークスペース：「〈ワークスペース〉にはもう入っています」と「〈ワークスペース〉を開く」（answer=7fe1f09fdab4 ⑦）。参加の口は呼ばず、招待は使われないまま", async ({
    page,
  }) => {
    const host = await withEntry(await signupViaApi("株式会社もういる"));
    const inv = await invite(host, host.email);
    await loginAs(page, host.token);
    const seen: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/")) seen.push(`${r.method()} ${new URL(r.url()).pathname}`);
    });
    await open(page, inv.token);
    await expect(page.locator("h1")).toHaveText("株式会社もういる にはもう入っています");
    await expect(page.getByRole("link", { name: "株式会社もういる を開く" })).toBeVisible();
    expect(seen.filter((s) => s.endsWith("/accept"))).toEqual([]);
    const a = await admin<{ a: string | null }>("select accepted_member_id as a from invitations where id = $1", [
      inv.id,
    ]);
    expect(a[0]!.a).toBeNull();
  });

  test("K336-UI-006 ログインの印が切れている（口の答えで signed_in が null）：ログインしていない形で出し、401 でログインの画面へ飛ばさない", async ({
    page,
  }) => {
    const host = await signupViaApi();
    const inv = await invite(host, `${randomBytes(4).toString("hex")}-new@example.com`);
    await loginAs(page, K336_EXPIRED_SESSION_TOKEN);
    await open(page, inv.token);
    await expect(page.getByRole("button", { name: "参加する" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
  });

  for (const w of MATCH_WIDTHS) {
    test(`K336-UI-007 幅 ${w}：アカウントがある（inv-account）・別のメール（inv-other）・もう入っている（inv-member）の 3 つとも横のはみ出し 0・h1 は真ん中`, async ({
      page,
    }) => {
      const host = await withEntry(await signupViaApi("株式会社幅"));
      const me = await withEntry(await signupViaApi());
      await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
      const cases: [string, string, string | null][] = [
        ["account", me.email, null],
        ["other", `${randomBytes(4).toString("hex")}-x@example.com`, me.token],
        ["member", host.email, host.token],
      ];
      for (const [st, email, tok] of cases) {
        const ctx = await page
          .context()
          .browser()!
          .newContext({ viewport: { width: w, height: w === 375 ? 812 : 900 } });
        const p = await ctx.newPage();
        if (tok) await loginAs(p, tok);
        const inv = await invite(host, email);
        await open(p, inv.token);
        await expect(p.locator(`[data-state="${st}"]`)).toBeVisible();
        expect(
          await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
          st,
        ).toBe(0);
        expect(await p.locator("h1").evaluate((e) => getComputedStyle(e).textAlign), st).toBe("center");
        await ctx.close();
      }
    });
  }
  test("K336-UI-008 外に影響する手順の失敗：「今のアカウントで参加する」の口が 503、「ログアウトして開き直す」の口が 503：どちらもページは移らず、赤の知らせ「いま Kaname の調子が悪くなっています。少し待ってから、もう一度押してください」が出て、同じボタンをもう一度押せる", async ({
    page,
  }) => {
    const host = await signupViaApi("株式会社失敗");
    const me = await withEntry(await signupViaApi());
    const same = await invite(host, me.email);
    const other = await invite(host, `${randomBytes(4).toString("hex")}-y@example.com`);
    await loginAs(page, me.token);
    await page.route(/\/api\/v1\/auth\/(invitations\/[^/]+\/accept|sign-out)$/, (r) =>
      r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "E-PAGE-003" }) }),
    );
    for (const [tok, button] of [
      [same.token, "今のアカウントで参加する"],
      [other.token, "ログアウトして開き直す"],
    ] as const) {
      await open(page, tok);
      await page.getByRole("button", { name: button }).click();
      await expect(page.getByRole("alert").filter({ hasText: "いま Kaname の調子が悪くなっています" })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/invite/${tok}$`));
      await expect(page.getByRole("button", { name: button })).toBeEnabled();
    }
  });
  test("K336-UI-009 下見の後に参加の口が断った：409・E-INV-007 → 「〈ワークスペース〉にはもう入っています」へ、403・E-INV-005 → 「ログアウトして開き直す」の形（別のメール宛て）へ。ページの URL は /invite/<token> のまま", async ({
    page,
  }) => {
    const host = await signupViaApi("株式会社断り");
    const me = await withEntry(await signupViaApi());
    await loginAs(page, me.token);
    for (const [status, code, see] of [
      [409, "E-INV-007", "株式会社断り にはもう入っています"],
      [403, "E-INV-005", "ログアウトして開き直す"],
    ] as const) {
      const inv = await invite(host, me.email);
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await guard(page);
      await page.route(/\/api\/v1\/auth\/invitations\/[^/]+\/accept$/, (r) =>
        r.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: "refused", code }) }),
      );
      await open(page, inv.token);
      await page.getByRole("button", { name: "今のアカウントで参加する" }).click();
      await expect(page.getByText(see).first()).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
    }
  });
});
