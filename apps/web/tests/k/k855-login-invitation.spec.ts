// K-855「招待のリンクから来たログインは、口に招待の印を一緒に送る」の試験（実 Chrome・本物の口と DB）。的：/login（LoginForm・K-316 の部品）。
//   next が招待の画面（/invite/<印>）のときだけ、パスワードの段（signInWithPassword）と 6 けたの段（verifySignInCode）の体に invitation=<印> を足し、
//   パスキーの確かめの要求（部品の口 /api/auth/passkey/verify-authentication）の頭 x-kaname-invitation にも同じ印を付ける（D-154.88・D-154.89）。
//   口（K-852）は、使える会社が無い人でも、その招待が本人宛てで使えるときだけログインの印を渡す（D-154.86・D-154.87）。
//   画面の字と状態は増やさない：断られたときは今の止めの形（E-AUTH-007・E-AUTH-011 の正本の文）のまま。
//   外した印は K-849 の app.member_erase と同じ形を DB に直に置く（外す口の通しは K-845 の中間テスト）。招待の行は DB に直に入れる（K-336 の試験と同じ道）。
//   口の答えは作らない（page.route は本人の Bridge の口 38617 を閉じるのと、届く頭 x-forwarded-for を足すだけ）。固定の待ちは置かない。
//   ただし K855-UI-007（パスキー）だけは、パスキーの 2 つの部品の口を網の手前で差し替える（本物の鍵を作れないため・K-317 と同じ。口の側の振る舞いは K852-API-028・029 が本物の DB で持つ）。
//   WebAuthn は IP の宛先で動かないので、その行は localhost で開き、Chrome の仮の認証器（CDP WebAuthn）で本物のブラウザの手順を通す。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { PW, admin, enableTotpViaApi, sha256, signupViaApi, totp } from "../_lib/api";
import { ownIp } from "../_lib/newcomer";

type Owner = Awaited<ReturnType<typeof signupViaApi>>;

/** 文言（正本 errors.json の E-AUTH-007・E-AUTH-011 と K-316 の止めの形・K-336 の招待の画面。実装から書かない） */
const MSG = {
  gone: "このアカウントは、会社の登録が見つからないため使えません",
  suspended: "このアカウントは、いま止められています。ワークスペースの管理者に聞いてください",
  join: "今のアカウントで参加する",
} as const;
const SIGN_IN = "/api/v1/auth/sign-in";
const VERIFY = "/api/v1/auth/two-factor/verify";

async function guard(page: Page): Promise<void> {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await ownIp(page.context(), 55);
}
/** その人の唯一の会社から外す（K-849 の外した印と同じ形）。招き直しは、外した会社（その人が作った会社）が同じメールで招く（invite(me, …)） */
async function removed(u: Owner): Promise<void> {
  await admin("update members set deleted_at = now() where id = $1", [u.memberId]);
  await admin("update tenant_memberships set status = 'left' where member_id = $1", [u.memberId]);
  await admin(
    "update scope_memberships set deleted_at = (select deleted_at from members where id = $1) where member_id = $1 and deleted_at is null",
    [u.memberId],
  );
  await admin("update sessions set revoked_at = now() where member_id = $1 and revoked_at is null", [u.memberId]);
}
async function invite(host: Owner, email: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await admin(
    `insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, created_by)
     values ($1, $2, $3, 'member', $4, now() + interval '7 days', $5)`,
    [host.tenantId, email, host.scopeId, sha256(token), host.memberId],
  );
  return token;
}
async function fillLogin(page: Page, email: string): Promise<void> {
  await page.getByLabel("メールアドレス", { exact: true }).fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
}
/** ログインの口に届いた体（POST の JSON）を貯める */
function bodiesOf(page: Page, path: string): Record<string, unknown>[] {
  const got: Record<string, unknown>[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === path)
      got.push((r.postDataJSON() ?? {}) as Record<string, unknown>);
  });
  return got;
}
const tokenOf = (page: Page) => page.evaluate(() => window.localStorage.getItem("kaname.token"));
const authSessions = async (u: Owner) =>
  (await admin<{ n: number }>('select count(*)::int as n from kaname_auth.session where "userId" = $1', [u.userId]))[0]!
    .n;

let host: Owner;
test.beforeAll(async () => {
  host = await signupViaApi("株式会社招き直す側");
});

test("K855-UI-001 その会社しか持たない外した人 × 招待の画面から来たログイン（next=/invite/<印>）：パスワードの口の体に invitation=<印> が 1 回届き、/invite/<印> に移り、印を持ち、招待の画面が「今のアカウントで参加する」を出す", async ({
  page,
}) => {
  await guard(page);
  const me = await signupViaApi("株式会社外された側一");
  await removed(me);
  const t = await invite(me, me.email);
  const sent = bodiesOf(page, SIGN_IN);
  await page.goto(`/login?next=${encodeURIComponent(`/invite/${t}`)}`);
  await fillLogin(page, me.email);
  await page.waitForURL((u) => u.pathname === `/invite/${t}`);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ email: me.email, invitation: t });
  expect(await tokenOf(page), "招待の画面へは印を持って移る").toBeTruthy();
  await expect(page.getByRole("button", { name: MSG.join, exact: true })).toBeVisible();
});

test("K855-UI-002 同じ形の人 × next が無いログイン：体に invitation は入らず、今の止めの形（E-AUTH-007 の文）でログインの画面のまま。印を持たず、部品のセッションも残らない", async ({
  page,
}) => {
  await guard(page);
  const me = await signupViaApi("株式会社外された側二");
  await removed(me);
  await invite(me, me.email);
  const before = await authSessions(me);
  const sent = bodiesOf(page, SIGN_IN);
  await page.goto("/login");
  await fillLogin(page, me.email);
  await expect(page.locator('[data-auth="blocked"]')).toContainText(MSG.gone);
  expect(sent).toHaveLength(1);
  expect(sent[0], "next が無ければ招待の印を送らない").not.toHaveProperty("invitation");
  expect(new URL(page.url()).pathname).toBe("/login");
  expect(await tokenOf(page)).toBeFalsy();
  await expect.poll(() => authSessions(me)).toBe(before);
});

test("K855-UI-003 next が招待の画面でない（/tickets）：体に invitation は入らず、同じ止めの形で /tickets へ移らない", async ({
  page,
}) => {
  await guard(page);
  const me = await signupViaApi("株式会社外された側三");
  await removed(me);
  await invite(me, me.email);
  const sent = bodiesOf(page, SIGN_IN);
  await page.goto(`/login?next=${encodeURIComponent("/tickets")}`);
  await fillLogin(page, me.email);
  await expect(page.locator('[data-auth="blocked"]')).toContainText(MSG.gone);
  expect(sent[0]).not.toHaveProperty("invitation");
  expect(new URL(page.url()).pathname).toBe("/login");
  expect(await tokenOf(page)).toBeFalsy();
});

test("K855-UI-004 2 段階を付けた外した人 × next=/invite/<印>：パスワードの段と 6 けたの段の両方の体に invitation=<印> が届き、6 けたがそろうと /invite/<印> に移り「今のアカウントで参加する」が出る", async ({
  page,
}) => {
  await guard(page);
  const me = await signupViaApi("株式会社外された側四");
  const tf = await enableTotpViaApi(me.token);
  await removed(me);
  const t = await invite(me, me.email);
  const pw = bodiesOf(page, SIGN_IN);
  const code = bodiesOf(page, VERIFY);
  await page.goto(`/login?next=${encodeURIComponent(`/invite/${t}`)}`);
  await fillLogin(page, me.email);
  const digit1 = page.getByRole("textbox", { name: "確認のコード 1 けた目", exact: true });
  await expect(digit1).toBeVisible();
  await digit1.focus();
  await page.keyboard.type(totp(tf.secret)); // 6 つそろうと自動で進む（K-316）
  await page.waitForURL((u) => u.pathname === `/invite/${t}`);
  expect(pw[0]).toMatchObject({ invitation: t });
  expect(code).toHaveLength(1);
  expect(code[0]).toMatchObject({ invitation: t });
  await expect(page.getByRole("button", { name: MSG.join, exact: true })).toBeVisible();
});

test("K855-UI-005 会社の人がいるふつうの人 × next=/invite/<印>（本人宛て）：今までどおり /invite/<印> に移り、印を持つ（招待の印を送っても振る舞いは変わらない）", async ({
  page,
}) => {
  await guard(page);
  const me = await signupViaApi("株式会社ふつう");
  const t = await invite(host, me.email);
  await page.goto(`/login?next=${encodeURIComponent(`/invite/${t}`)}`);
  await fillLogin(page, me.email);
  await page.waitForURL((u) => u.pathname === `/invite/${t}`);
  expect(await tokenOf(page)).toBeTruthy();
  await expect(page.locator('[data-auth="blocked"]')).toHaveCount(0);
});

test("K855-UI-006 使える会社で止められている人 × next=/invite/<印>（本人宛て）：今の止めの形（E-AUTH-011 の文）でログインの画面のまま。印を持たない（止められている人は招待で通らない・D-154.85）", async ({
  page,
}) => {
  await guard(page);
  const me = await signupViaApi("株式会社止められた側");
  await admin("update members set suspended_at = now(), suspended_by = id where id = $1", [me.memberId]);
  const t = await invite(host, me.email);
  await page.goto(`/login?next=${encodeURIComponent(`/invite/${t}`)}`);
  await fillLogin(page, me.email);
  await expect(page.locator('[data-auth="blocked"]')).toContainText(MSG.suspended);
  expect(new URL(page.url()).pathname).toBe("/login");
  expect(await tokenOf(page)).toBeFalsy();
});

/** パスキーの行は localhost で開く（WebAuthn の宛先は IP にできない） */
const local = (baseURL: string | undefined) => String(baseURL).replace("127.0.0.1", "localhost");
const INVITATION_HEAD = "x-kaname-invitation";
/** パスキーの 2 つの部品の口だけを網の手前で差し替え、届いた頭を貯める（K-317 と同じ形・ほかの口は本物へ） */
async function mockPasskey(
  page: Page,
): Promise<{ optionsHeads: (string | undefined)[]; verifyHeads: (string | undefined)[] }> {
  const got = { optionsHeads: [] as (string | undefined)[], verifyHeads: [] as (string | undefined)[] };
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "set-auth-token",
  };
  await page.route(/\/api\/auth\/passkey\//, async (route: Route, req: Request) => {
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
    const p = new URL(req.url()).pathname;
    if (p.endsWith("/generate-authenticate-options")) {
      got.optionsHeads.push(req.headers()[INVITATION_HEAD]);
      return route.fulfill({
        status: 200,
        headers: cors,
        contentType: "application/json",
        body: JSON.stringify({
          challenge: randomBytes(32).toString("base64url"),
          challenge_token: "ch-k855",
          rpId: "localhost",
          timeout: 60_000,
          allowCredentials: [],
          userVerification: "preferred",
        }),
      });
    }
    got.verifyHeads.push(req.headers()[INVITATION_HEAD]);
    return route.fulfill({
      status: 200,
      headers: { ...cors, "set-auth-token": "tok-k855" },
      contentType: "application/json",
      body: JSON.stringify({ session: { token: "tok-k855" }, user: { id: "u-k855" } }),
    });
  });
  return got;
}
/** Chrome の仮の認証器に鍵を 1 つ置く。internal ＝この PC・usb ＝この PC の外（スマホや鍵と同じ cross-platform） */
async function authenticator(page: Page, transport: "internal" | "usb" = "internal"): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: {
      credentialId: randomBytes(16).toString("base64"),
      isResidentCredential: true,
      rpId: "localhost",
      privateKey: (privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).toString("base64"),
      userHandle: Buffer.from("u-k855").toString("base64"),
      signCount: 0,
    },
  });
}

test("K855-UI-007 パスキーで入る（仮の認証器）：next が招待の画面なら、確かめの要求 1 回の頭 x-kaname-invitation が <印>（問いの要求には付かない）で /invite/<印> に移る。next が /tickets なら頭を付けない", async ({
  page,
  baseURL,
}) => {
  await guard(page);
  const got = await mockPasskey(page);
  await authenticator(page);
  const t = randomBytes(24).toString("base64url");
  await page.goto(`${local(baseURL)}/login?next=${encodeURIComponent(`/invite/${t}`)}`);
  await page.locator('[data-act="passkey"]').click();
  await page.waitForURL((u) => u.pathname === `/invite/${t}`);
  expect(got.optionsHeads).toEqual([undefined]);
  expect(got.verifyHeads).toEqual([t]);

  await page.evaluate(() => window.localStorage.removeItem("kaname.token"));
  await page.goto(`${local(baseURL)}/login?next=${encodeURIComponent("/tickets")}`);
  await page.locator('[data-act="passkey"]').click();
  await expect.poll(() => got.verifyHeads.length).toBe(2);
  expect(got.verifyHeads[1], "next が招待の画面でなければ頭を付けない").toBeUndefined();
});

test("K855-UI-008 X だけに入っていて外された人 × 別の会社 Y の本人宛ての招待の画面から来たログイン（next=/invite/<印>）：パスワードの口の体に invitation=<印> が 1 回届き、/invite/<印> に移り、印を持ち「今のアカウントで参加する」が出る（D-154.88）", async ({
  page,
}) => {
  await guard(page);
  const me = await signupViaApi("株式会社外された側八");
  await removed(me);
  const t = await invite(host, me.email);
  const sent = bodiesOf(page, SIGN_IN);
  await page.goto(`/login?next=${encodeURIComponent(`/invite/${t}`)}`);
  await fillLogin(page, me.email);
  await page.waitForURL((u) => u.pathname === `/invite/${t}`);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ email: me.email, invitation: t });
  expect(await tokenOf(page)).toBeTruthy();
  await expect(page.getByRole("button", { name: MSG.join, exact: true })).toBeVisible();
});

test("K855-UI-009 この PC の外の認証器（仮の認証器 usb）で入る × next=/invite/<印>：確かめの要求 1 回の頭 x-kaname-invitation が <印>・「入れました」の段を出さずに /invite/<印> へ移る", async ({
  page,
  baseURL,
}) => {
  await guard(page);
  const got = await mockPasskey(page);
  await authenticator(page, "usb");
  const t = randomBytes(24).toString("base64url");
  await page.goto(`${local(baseURL)}/login?next=${encodeURIComponent(`/invite/${t}`)}`);
  await page.locator('[data-act="passkey"]').click();
  await page.waitForURL((u) => u.pathname === `/invite/${t}`);
  expect(got.verifyHeads).toEqual([t]);
  await expect(page.getByRole("heading", { name: "入れました" })).toHaveCount(0);
});
