// K-336「招待の画面を口につなぐ：アカウントがある人・ログイン中（今のアカウントで参加・別のメール・もう入っている）」の試験（実 Chrome・本物の口と DB）。
//   的：/invite/:token。正の絵はモック /dev/mock/f2/<状態>（inv-account・inv-signed・inv-other・inv-member）。代表の答え answer=becc3d3aa526 ②③④・7fe1f09fdab4 ⑦。
//   口：getInvitation（K-331）・acceptInvitation（K-333）・signOut（K-306）。ログインの画面は今の /login（next は同じ出どころの道だけ・lib/after-login.ts）。
//   準備（書く段で直した・2026-11-19・K-335 の試験で見つかったのと同じ形）：口の回数の上限は IP ごと（下見・ログイン・登録とも 10 回／分）なので、
//     開くページごとに別の IP の頭を付ける（ownIp・口の答えは作らない）。登録は試験の機械から呼ぶので IP が 1 つになる：
//     招く側と本人はこのファイルで 1 回だけ登録して使い回し、ワークスペースの名前を見る試験（003・005・009）だけが招く側を自分で登録する
//     （このファイルで 5 回。前後に流れる招待の画面の試験の登録と同じ 1 分に入っても 10 回を超えない）。招待の行は試験ごとに新しく入れる。
//     本人のセッションを変える・消す試験（003・004・010・012・013）は、使い回す本人の印（me.token）を壊さないように、
//     ログインの口で新しいセッションを作って使う（freshToken・登録は増やさない）。期待結果は変えていない
//   足した行（書く段・2026-11-19）：010 押す前にログインが切れた・011 と 012 口のほかの断り・013 別のアカウントへ入り直してから押した・014 二度押し
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { randomBytes } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";
import { API, PW, admin, loginAs, sha256, signupViaApi } from "../_lib/api";
import { ownIp } from "../_lib/newcomer";
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
/** 口の上限の IP の網（10.36.x.x）。利用者ごとに別の IP にする道具 ownIp（K-58）に渡す */
const IP_NET = 36;
async function guard(page: Page) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await ownIp(page.context(), IP_NET); // 下見・参加・ログインの口は 10 回／分／IP。ページごとに別の IP の頭にする（口の答えは作らない）
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
const randomIp = () => `10.${IP_NET}.${(randomBytes(1)[0]! % 250) + 1}.${(randomBytes(1)[0]! % 250) + 1}`;
/** その人の新しいセッションを 1 つ作る（ログインの口を試験の機械から呼ぶ）。セッションを消す試験が、使い回す本人の印（me.token）の代わりに使う。
 *  ログインで作ったセッションは作った端末（user-agent）に結ばれ、別の端末から使うと口が閉じる（D-128.120）ので、この試験のブラウザと同じ名乗りで作る */
async function freshToken(page: Page, u: Owner): Promise<string> {
  const ua = await page.evaluate(() => navigator.userAgent);
  const res = await fetch(`${API}/api/v1/auth/sign-in`, {
    method: "POST",
    // 試験の機械からのログインは IP が 1 つ（上限 10 回／分）なので、ここも呼ぶたびに別の IP の頭にする
    headers: { "content-type": "application/json", "user-agent": ua, "x-forwarded-for": randomIp() },
    body: JSON.stringify({ email: u.email, password: PW }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { token?: string | null } };
  const token = body.data?.token;
  if (res.status !== 201 || !token) throw new Error(`sign-in ${res.status} ${JSON.stringify(body)}`);
  return token;
}
/** 印を 1 回だけ入れて招待を開く（loginAs は読み込みのたびに入れ直す。印が消える・替わるのを見る試験はこちら） */
async function openAs(page: Page, sessionToken: string, inviteToken: string) {
  await guard(page);
  await page.goto("/help");
  await page.evaluate((t) => window.localStorage.setItem("kaname.token", t), sessionToken);
  await open(page, inviteToken);
}
const json = (status: number, body: unknown) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});
const ACCEPT = /\/api\/v1\/auth\/invitations\/[^/]+\/accept$/;
const SIGN_OUT = /\/api\/v1\/auth\/sign-out$/;
const DOWN_AGAIN = "いま Kaname の調子が悪くなっています。少し待ってから、もう一度押してください";
const storedToken = (page: Page) => page.evaluate(() => window.localStorage.getItem("kaname.token"));
/** その印のセッションを消す（別の所でログアウトした・切れた） */
const dropSession = (token: string) => admin("delete from kaname_auth.session where token = $1", [token]);

/** その印の sessions の行のワークスペース */
const sessionTenant = async (token: string) =>
  (
    await admin<{ t: string }>(
      "select x.tenant_id as t from sessions x join kaname_auth.session a on a.id = x.auth_session_id where a.token = $1",
      [token],
    )
  )[0]?.t;

// 招く側のワークスペース（本番の値をモックの値にそろえる：名前・招いた人・グループ）と、アカウントのある本人。このファイルで 1 回だけ登録する。
//   この 2 人の印（host.token・me.token）のセッションは、どの試験も変えない・消さない（002 は画面からログインして新しいセッションを作るだけ・
//   008・009・011・014 の参加とログアウトの口は作り物の答え・セッションを変える試験は freshToken の新しいセッションを使う）。
//   003 で本人は「株式会社切り替え先」の所属が 1 つ増えるが、ほかの試験の招待は別のワークスペースの物なので、下見の形（同じメール・別のメール）は変わらない
let host: Owner;
let me: Owner;
test.beforeAll(async () => {
  host = await withEntry(await signupViaApi("株式会社ENGINE BASE"));
  await admin("update members set display_name = '高本 聖斗' where id = $1", [host.memberId]);
  await admin("update scopes set name = '経理グループ' where id = $1", [host.scopeId]);
  me = await withEntry(await signupViaApi("株式会社わたし"));
});

test.describe("K-336 招待の画面：見た目はモックどおり", () => {
  for (const w of MATCH_WIDTHS) {
    test(`K336-UI-001 幅 ${w}：ログイン中・同じメール（inv-signed）が、モックと同じ役の値（箱・見出し・主ボタン・注・px は ±2）`, async ({
      browser,
    }) => {
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
    const dest = await signupViaApi("株式会社切り替え先");
    const inv = await invite(dest, me.email);
    await loginAs(page, await freshToken(page, me));
    await open(page, inv.token);
    await expect(page.getByText(/参加すると 株式会社切り替え先 に切り替わります/)).toBeVisible();
    await page.getByRole("button", { name: "今のアカウントで参加する" }).click();
    await page.waitForURL((u) => u.pathname === "/" || u.pathname === "/today" || u.pathname === "/mine");
    const token = await page.evaluate(() => window.localStorage.getItem("kaname.token"));
    expect(await sessionTenant(token!)).toBe(dest.tenantId);
  });

  test("K336-UI-004 ログイン中・別のメール宛て：「この招待は a@… 宛てです。いまは b@… でログインしています」と「ログアウトして開き直す」（answer=becc3d3aa526 ②）。押すとログアウトの口でその印のセッションが消え、画面の印（kaname.token）も消え、同じ招待の画面がログインしていない形（新しく作って参加）で開き直る", async ({
    page,
  }) => {
    const leaving = await freshToken(page, me);
    const someoneElse = `${randomBytes(4).toString("hex")}-other@example.com`;
    const inv = await invite(host, someoneElse);
    // 印は 1 回だけ入れる（loginAs は読み込みのたびに入れ直すので、ログアウトした後も印が戻り、確かめにならない）
    await guard(page);
    await page.goto("/help");
    await page.evaluate((t) => window.localStorage.setItem("kaname.token", t), leaving);
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
      leaving,
    ]);
    expect(left[0]!.n, "その印のセッションは消えた").toBe(0);
  });

  test("K336-UI-005 ログイン中・もう入っているワークスペース：「〈ワークスペース〉にはもう入っています」と「〈ワークスペース〉を開く」（answer=7fe1f09fdab4 ⑦）。参加の口は呼ばず、招待は使われないまま", async ({
    page,
  }) => {
    const insider = await withEntry(await signupViaApi("株式会社もういる"));
    const inv = await invite(insider, insider.email);
    await loginAs(page, insider.token);
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
    const refuser = await signupViaApi("株式会社断り");
    await loginAs(page, me.token);
    for (const [status, code, see] of [
      [409, "E-INV-007", "株式会社断り にはもう入っています"],
      [403, "E-INV-005", "ログアウトして開き直す"],
    ] as const) {
      const inv = await invite(refuser, me.email);
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

  test("K336-UI-010 開いた後・押す前にログインが切れた（その印のセッションが消えた）：① 「今のアカウントで参加する」→ 口はログインしていない人として受けて 422 → 下見を読み直して「ログインして参加する」（アカウントがある形）が出る ② 「ログアウトして開き直す」→ 口が 401 → 通ったのと同じ（kaname.token が消え、新しく作って参加の形）。どちらも URL は /invite/<token> のまま", async ({
    page,
  }) => {
    // ① 同じメール宛て
    const first = await freshToken(page, me);
    const same = await invite(host, me.email);
    await openAs(page, first, same.token);
    const join = page.getByRole("button", { name: "今のアカウントで参加する" });
    await expect(join).toBeVisible();
    await dropSession(first);
    await join.click();
    await expect(page.getByRole("link", { name: "ログインして参加する" })).toBeVisible();
    await expect(join).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/invite/${same.token}$`));
    // ② 別のメール宛て
    const second = await freshToken(page, me);
    const other = await invite(host, `${randomBytes(4).toString("hex")}-z@example.com`);
    await openAs(page, second, other.token);
    const out = page.getByRole("button", { name: "ログアウトして開き直す" });
    await expect(out).toBeVisible();
    await dropSession(second);
    await out.click();
    await expect(page.getByRole("button", { name: "参加する" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/invite/${other.token}$`));
    expect(await storedToken(page)).toBeNull();
  });

  test("K336-UI-011 「今のアカウントで参加する」の口のほかの断り：429 → 赤の知らせに正本 E-LIM-005 の文（口の秒）／403・E-AUTH-012 → 赤の知らせに口の文／410・E-INV-003 → 期限切れ／410・E-INV-002 → 取り消し／410・E-INV-004 → 使われた／404 → 見つからない／409・E-INV-006 → ログインして参加／網が切れた → 赤の知らせで同じボタンを押せる。どれもページは移らない", async ({
    page,
  }) => {
    const STOPPED = "このワークスペースは、いま止められています。データは残っています。管理者か運営に連絡してください";
    const cases: [number, Record<string, unknown>, (see: Page) => Promise<void>][] = [
      [
        429,
        { error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 37 },
        async (p) =>
          expect(
            p.getByRole("alert").filter({ hasText: "送りすぎです。37秒たってから、もう一度お試しください" }),
          ).toBeVisible(),
      ],
      [
        403,
        { error: "forbidden", code: "E-AUTH-012", message: STOPPED },
        async (p) => expect(p.getByRole("alert").filter({ hasText: STOPPED })).toBeVisible(),
      ],
      [
        410,
        { error: "gone", code: "E-INV-003" },
        async (p) => expect(p.locator("h1")).toHaveText("この招待は期限が過ぎました"),
      ],
      [
        410,
        { error: "gone", code: "E-INV-002" },
        async (p) => expect(p.locator("h1")).toHaveText("この招待は取り消されています"),
      ],
      [
        410,
        { error: "gone", code: "E-INV-004" },
        async (p) => expect(p.locator("h1")).toHaveText("この招待はもう使われています"),
      ],
      [
        404,
        { error: "not_found", code: "E-INV-001" },
        async (p) => expect(p.locator("h1")).toHaveText("この招待は見つかりません"),
      ],
      [
        409,
        { error: "conflict", code: "E-INV-006" },
        async (p) => expect(p.getByRole("link", { name: "ログインして参加する" })).toBeVisible(),
      ],
    ];
    await loginAs(page, me.token);
    const join = page.getByRole("button", { name: "今のアカウントで参加する" });
    for (const [status, body, see] of cases) {
      const inv = await invite(host, me.email);
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.route(ACCEPT, (r) => r.fulfill(json(status, body)));
      await open(page, inv.token);
      await join.click();
      await see(page);
      await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
    }
    // 網が切れた（口が答えない）
    const inv = await invite(host, me.email);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.route(ACCEPT, (r) => r.abort());
    await open(page, inv.token);
    await join.click();
    await expect(page.getByRole("alert").filter({ hasText: DOWN_AGAIN })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
    await expect(join).toBeEnabled();
  });

  test("K336-UI-012 「ログアウトして開き直す」の口のほかの失敗：429 → 赤の知らせに正本 E-LIM-005 の文（口の秒）／網が切れた → 赤の知らせ。どちらもページは移らず、kaname.token は残り、同じボタンをもう一度押せる", async ({
    page,
  }) => {
    const token = await freshToken(page, me);
    const out = page.getByRole("button", { name: "ログアウトして開き直す" });
    for (const [reply, text] of [
      [
        json(429, { error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 41 }),
        "送りすぎです。41秒たってから、もう一度お試しください",
      ],
      [null, DOWN_AGAIN],
    ] as const) {
      const inv = await invite(host, `${randomBytes(4).toString("hex")}-w@example.com`);
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.route(SIGN_OUT, (r) => (reply ? r.fulfill(reply) : r.abort()));
      await openAs(page, token, inv.token);
      await out.click();
      await expect(page.getByRole("alert").filter({ hasText: text })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
      expect(await storedToken(page)).toBe(token);
      await expect(out).toBeEnabled();
    }
  });

  test("K336-UI-013 開いた後に別のアカウントへ入り直してから「今のアカウントで参加する」を押した（本物の口が 403・E-INV-005）：「ログアウトして開き直す」の形になり、文のログイン中のメールは入り直したアカウントの物（下見の時のメールではない）。招待は使われないまま", async ({
    page,
  }) => {
    const inv = await invite(host, me.email);
    const mine = await freshToken(page, me);
    const insider = await freshToken(page, host); // 入り直す先（宛てではないアカウント）
    await openAs(page, mine, inv.token);
    const join = page.getByRole("button", { name: "今のアカウントで参加する" });
    await expect(join).toBeVisible();
    // 別のタブで入り直した（同じ置き場の印が替わる）
    await page.evaluate((t) => window.localStorage.setItem("kaname.token", t), insider);
    await join.click();
    await expect(page.getByRole("button", { name: "ログアウトして開き直す" })).toBeVisible();
    await expect(
      page.getByText(new RegExp(`この招待は ${me.email} 宛てです。いまは ${host.email} でログインしています`)),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/invite/${inv.token}$`));
    const a = await admin<{ a: string | null }>("select accepted_member_id as a from invitations where id = $1", [
      inv.id,
    ]);
    expect(a[0]!.a).toBeNull();
  });

  test("K336-UI-014 二度押し：「今のアカウントで参加する」を二度押し（dblclick）しても参加の口は 1 回だけ、「ログアウトして開き直す」を二度押ししてもログアウトの口は 1 回だけ。口の答えを待つ間、ボタンは待ちの形で押せない", async ({
    page,
  }) => {
    const calls = { accept: 0, signOut: 0 };
    // 口の答えは試験が放すまで止めておき、放したら 503 にする（待ちの間の 2 回目の押しを数える。ページは移らないので、同じ本人で 2 つとも見られる）
    let release: () => void = () => undefined;
    const held = async (r: Route, key: keyof typeof calls) => {
      calls[key] += 1;
      await new Promise<void>((done) => (release = done));
      await r.fulfill(json(503, { code: "E-PAGE-003" }));
    };
    await loginAs(page, me.token);
    await page.route(ACCEPT, (r) => held(r, "accept"));
    await page.route(SIGN_OUT, (r) => held(r, "signOut"));
    for (const [email, name, key] of [
      [me.email, "今のアカウントで参加する", "accept"],
      [`${randomBytes(4).toString("hex")}-v@example.com`, "ログアウトして開き直す", "signOut"],
    ] as const) {
      const inv = await invite(host, email);
      await open(page, inv.token);
      const button = page.getByRole("button", { name });
      await button.dblclick();
      await expect(button).toBeDisabled();
      await expect.poll(() => calls[key]).toBe(1);
      release();
      await expect(page.getByRole("alert").filter({ hasText: DOWN_AGAIN })).toBeVisible();
      await expect(button).toBeEnabled();
      expect(calls[key], name).toBe(1);
    }
  });
});
