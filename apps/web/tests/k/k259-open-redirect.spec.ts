// K-259「ログインの後の行き先（next）で外のサイトへ移れる（開いた転送）」の画面の試験（実 Chrome・実装より先に積む）。
//   ログインの画面と招待の受諾の画面を ?next=/%5Cevil.com などで開き、入って（参加して）移った先が
//   この画面と同じ出どころの既定の行き先 / であること・外の出どころ（evil.com）への要求も移動も 0 回であることを見る。
//   口（API）は網の手前（page.route）で差し替える（ログインと招待の口の振る舞いは口の試験が本物の DB で持つ）。
//   外の出どころへの要求は context.route で受けて数える（本物の外へは出ない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const EVIL_RE = /^https?:\/\/([^/]*\.)?evil\.(com|example)(:\d+)?\//i;
/** 画面が searchParams から受け取る next（?next=/%5Cevil.com は /\evil.com・?next=/%09/evil.com は /<タブ>/evil.com として届く） */
const BAD_NEXT = ["/\\evil.com", "/\t/evil.com", "//evil.com", "/%5Cevil.com"];
const TOKEN = "k259-invite-token";

/** 外の出どころへ出た要求（移動を含む）。どのタブからでも context.route で受けて数える（本物の外へは出ない） */
async function watchEvil(context: BrowserContext): Promise<string[]> {
  const evil: string[] = [];
  await context.route(EVIL_RE, async (route: Route) => {
    evil.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>evil</h1>" });
  });
  return evil;
}

/** 口の差し替え：ログイン・招待の下見・招待の受諾は成功。ほかは入っていない（401） */
async function mockApi(page: Page): Promise<void> {
  await page.route(API_RE, async (route, req) => {
    const p = new URL(req.url()).pathname;
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "POST" && p === "/api/auth-ext/sign-in")
      return json(200, { data: { token: "tok-k259", two_factor: false, two_factor_cookie: null } });
    if (req.method() === "GET" && p === `/api/auth-ext/invitations/${TOKEN}`)
      return json(200, {
        data: {
          tenant_name: "招く会社",
          role_id: "staff",
          email: "k259@example.com",
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          valid: true,
          reason: null,
        },
      });
    if (req.method() === "POST" && p === `/api/auth-ext/invitations/${TOKEN}/accept`)
      return json(200, { data: { token: "tok-k259", member_id: "00000000-0000-4000-8000-000000000259" } });
    if (p === "/api/auth/get-session") return json(200, null);
    return json(401, { error: "unauthenticated", code: "UNAUTHENTICATED", message: "ログインしてください" });
  });
}

/** 1 つの場合ごとに新しいタブを開く（前の場合の入口の振り分け（/ → /login）が後から届いて混ざらない）。
 *  開いた道 path を開いた後に移った先を、順に返す関数を返す */
async function openFresh(context: BrowserContext, path: string): Promise<{ page: Page; moved: () => URL[] }> {
  const page = await context.newPage();
  await mockApi(page);
  const navs: URL[] = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) navs.push(new URL(f.url()));
  });
  await page.goto(path);
  await expect(page.getByLabel("パスワード", { exact: true })).toBeVisible(); // 画面ができてから数え始める
  // 起点は開き終えた時点の記録の数（道の文字で探さない：入口や /tickets が /login?next=… へ戻すと、開いた道と同じ文字が後ろに出る）
  const base = navs.length;
  const opened = new URL(path, page.url());
  const same = (u: URL) => u.pathname === opened.pathname && u.search === opened.search;
  // 組み上がり（hydration）で Next が同じ道に replaceState を 1 回呼ぶ。起点の直後に続く「開いた道と同じ記録」だけは読み飛ばす
  const moved = (): URL[] => {
    const rest = navs.slice(base);
    let i = 0;
    while (i < rest.length && same(rest[i]!)) i++;
    return rest.slice(i);
  };
  return { page, moved };
}

async function signInOn(page: Page): Promise<void> {
  await page.getByLabel("メールアドレス").fill("k259@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("k259-password-x1");
  await page.getByRole("button", { name: "ログイン" }).click();
}

test("K259-UI-001 ログインの画面を ?next=/%5Cevil.com・/%09/evil.com・//evil.com・/%255Cevil.com で開いて入ると、同じ出どころの / へ移り、外の出どころへは要求も移動も 0 回", async ({
  context,
  baseURL,
}) => {
  const origin = new URL(String(baseURL)).origin;
  const evil = await watchEvil(context);
  for (const next of BAD_NEXT) {
    const { page, moved } = await openFresh(context, `/login?next=${encodeURIComponent(next)}`);
    await signInOn(page);
    await expect
      .poll(() => moved().map((u) => `${u.origin}${u.pathname}`), { message: JSON.stringify(next) })
      .toContain(`${origin}/`);
    expect(
      moved().filter((u) => u.origin !== origin),
      JSON.stringify(next),
    ).toEqual([]);
    expect(moved()[0]?.pathname, `最初に移った先（${JSON.stringify(next)}）`).toBe("/");
    await page.close();
  }
  expect(evil, "外の出どころへの要求").toEqual([]);
});

test("K259-UI-002 同じ出どころの next（/tickets?tab=1）はそのまま移る。招待の受諾の画面を ?next=/%5Cevil.com で開いて参加しても / へ移り、外へは 0 回", async ({
  context,
  baseURL,
}) => {
  const origin = new URL(String(baseURL)).origin;
  const evil = await watchEvil(context);

  // 同じ出どころの道は残る（直しで良い next まで捨てていないこと）
  const a = await openFresh(context, `/login?next=${encodeURIComponent("/tickets?tab=1")}`);
  await signInOn(a.page);
  await expect
    .poll(() => a.moved().map((u) => `${u.origin}${u.pathname}${u.search}`))
    .toContain(`${origin}/tickets?tab=1`);
  expect(a.moved()[0]?.pathname).toBe("/tickets");
  await a.page.close();

  // 招待の受諾：next を付けて開いても、参加した後の行き先は / （入口が振り分ける）
  const b = await openFresh(context, `/invite/${TOKEN}?next=/%5Cevil.com`);
  await b.page.getByLabel("お名前").fill("佐藤 健");
  await b.page.getByLabel("パスワード", { exact: true }).fill("k259-password-x1");
  await b.page.getByRole("button", { name: "参加する" }).click();
  await expect.poll(() => b.moved().map((u) => `${u.origin}${u.pathname}`)).toContain(`${origin}/`);
  expect(b.moved().filter((u) => u.origin !== origin)).toEqual([]);
  expect(b.moved()[0]?.pathname).toBe("/");
  expect(evil, "外の出どころへの要求").toEqual([]);
});
