// K-54 中間テスト 1：登録（K-51）→ メールの確認（K-52）→ 規約の同意（K-53）を、本物のブラウザ・本物の DB・本物の口でつなぐ（D-128.131）。
//   中の 1 本 1 本の分岐は単体の試験（apps/api/test/features/F1/・apps/web/tests/features/F1/）が持つ。ここは「つないだときにだけ出るもの」を見る：
//   前の画面の状態が次の画面に渡るか・届いたメールのリンクが本当に開けるか・時刻の進みでつなぎ目が切れないか。
//   口は網の手前で差し替えない（page.route で答えを作らない）。届いたメールは試験用の受け箱（_lib/mailbox.ts）から本文のリンクを取り出して開く。
//   時刻は DB の時刻を進める（_lib/clock.ts・待たない）。規約の新しい版は DB に直に出し、試験の終わりに必ず取り下げる（ほかの試験の人を止めない・G-10）。
//   ★前提：API を RESEND_API_KEY（試験の値）と RESEND_BASE_URL=http://127.0.0.1:<QA_MAILBOX_PORT> で立てる（CI の web の組の G59）
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API, PW, addTestEntry, admin, uniq, uniqEmail } from "../_lib/api";
import { elapseSignup } from "../_lib/clock";
import { Mailbox, linkIn } from "../_lib/mailbox";

const box = new Mailbox();
test.beforeAll(() => box.open());
test.afterAll(() => box.close());

const API_ORIGIN = new URL(API).origin;
const TERMS_STEP = /\/login\?step=terms/;
const MSG = {
  expired: "リンクの期限が切れました。もう一度登録してください",
  oldLink: "このリンクは使えません。新しく届いたメールのリンクを開いてください",
  done: "このメールアドレスの登録は確認まで終わっています。ログインしてください",
};

/** 利用者ごとに別の IP にする（口の回数の制限は IP ごと・10 回/分。回数の制限そのものは単体の試験が持つ）。
 *  答えは作らない：届く頭だけを足して、本物の口へそのまま流す */
async function ownIp(ctx: BrowserContext): Promise<void> {
  const ip = `10.54.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
  await ctx.route(
    (u) => u.origin === API_ORIGIN,
    (r) => r.continue({ headers: { ...r.request().headers(), "x-forwarded-for": ip } }),
  );
}
/** 別のブラウザ（cookie も localStorage も sessionStorage も別） */
async function browserOf(b: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ownIp(ctx);
  return { ctx, page: await ctx.newPage() };
}
interface Who {
  email: string;
  name: string;
  company: string;
}
const person = (tag: string): Who => ({
  email: uniqEmail(),
  name: `中間 ${tag}`,
  company: `中間テストの会社 ${tag} ${uniq()}`,
});

/** 登録の画面で入れて送る → 待つ画面（確認メールを送りました） */
async function signUpByForm(page: Page, w: Who): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("メール", { exact: true }).fill(w.email);
  await page.getByLabel("名前", { exact: true }).fill(w.name);
  await page.getByLabel("会社・チームの名前", { exact: true }).fill(w.company);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ（メールを確かめる）" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "確認メールを送りました" })).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email$/);
}
/** 受け箱に届いた n 通目の確認のメールから、本文のリンクを取り出す */
const linkOf = async (w: Who, n = 1): Promise<string> => linkIn(await box.waitFor(w.email, n), "/verify-email");
/** メールのリンクを開く（本文のリンクのまま。宛先の画面の場所もメールが決める） */
async function openLink(page: Page, url: string): Promise<void> {
  const res = await page.goto(url);
  expect(res?.status(), "メールのリンクの先が開ける").toBe(200);
}
const heading = (page: Page, name: string | RegExp) => page.getByRole("heading", { level: 1, name });
const tokenOf = (page: Page) => page.evaluate(() => window.localStorage.getItem("kaname.token"));

/** 確定した本人（DB）：本人・会社・自分・同意した版。無ければ空 */
const confirmed = (email: string) =>
  admin<{
    user_id: string;
    user_name: string;
    verified: boolean;
    company: string;
    member_id: string;
    display_name: string;
  }>(
    `select u.id as user_id, u.name as user_name, u."emailVerified" as verified, t.name as company, m.id as member_id, m.display_name
       from kaname_auth."user" u join members m on m.auth_user_id = u.id join tenants t on t.id = m.tenant_id
      where u.email = $1 and m.deleted_at is null`,
    [email],
  );
/** 今の版（利用規約とプライバシーポリシー） */
const currentTerms = () =>
  admin<{ id: string; kind: string }>(
    "select id, kind from app.current_terms() where kind in ('terms', 'privacy') order by kind",
  );
/** その人が同意した版 */
const agreedVersions = (userId: string) =>
  admin<{ terms_version_id: string; agreed_at: Date }>(
    "select terms_version_id, agreed_at from terms_consents where auth_user_id = $1 and deleted_at is null order by terms_version_id",
    [userId],
  );

/** 規約とプライバシーポリシーの新しい版を出す（運営の画面 F12 はまだ無いので DB に直に）。返した ids は必ず withdraw に渡す */
async function publishNewTerms(tag: string): Promise<string[]> {
  const ops = (await admin<{ id: string }>("select app.ops_tenant_id() as id"))[0]!.id;
  const v = `k54-${tag}-${uniq()}`;
  const ids: string[] = [];
  for (const kind of ["terms", "privacy"])
    ids.push(
      (
        await admin<{ id: string }>(
          "insert into terms_versions (tenant_id, kind, version, url, published_at) values ($1, $2, $3, $4, now()) returning id",
          [ops, kind, v, `https://kaname.example/${kind}/${v}`],
        )
      )[0]!.id,
    );
  return ids;
}
const withdraw = (ids: string[]) =>
  ids.length
    ? admin("update terms_versions set deleted_at = now() where id = any($1::uuid[])", [ids])
    : Promise.resolve([]);

/** ログインの画面から入る */
async function loginByForm(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await page.waitForURL((u) => u.pathname !== "/login" || u.searchParams.get("step") === "terms", { timeout: 30_000 });
}
/** 同意し直しの画面に居て、同意の前に他の画面（チャット）へ行けない */
async function stuckOnTerms(page: Page): Promise<void> {
  await expect(page).toHaveURL(TERMS_STEP);
  await expect(heading(page, "利用規約とプライバシーポリシーが新しくなりました")).toBeVisible();
  await page.goto("/ai/chat");
  await expect(page, "同意の前に他の画面へ行けない").toHaveURL(TERMS_STEP, { timeout: 15_000 });
}
/** 同意し直しの画面で同意する → 同意し直しの画面を出る */
async function agreeOnTerms(page: Page): Promise<void> {
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "同意して続ける" }).click();
  await expect(page).not.toHaveURL(TERMS_STEP, { timeout: 15_000 });
}
/** 入り方を 1 つ持つ人にする（試験の鍵を置き、今のセッションの「付けるまで進めない」の印を下ろす・K-321）。
 *  この試験は登録と同意し直しを見るもので、付けるまで進めない（K-319）は見ないので、「続ける」・中へ入る前に呼ぶ */
async function readyToEnter(email: string): Promise<void> {
  const [u] = await admin<{ id: string }>('select id from kaname_auth."user" where email = $1', [email]);
  await addTestEntry(u!.id);
}
/** 中へ入れる（チャットの画面を開いても同意し直しへ戻されない。はじめの設定が済んでいない人は、はじめの設定へ移る・D-089）。
 *  入る前に、その人を入り方を 1 つ持つ人にする（readyToEnter） */
async function canEnter(page: Page, email: string): Promise<void> {
  await readyToEnter(email);
  await page.goto("/ai/chat");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/(ai\/chat|setup\/bridge)$/);
  await expect(page).not.toHaveURL(TERMS_STEP);
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await ownIp(context);
});

test("K54-M1-01 正常：登録 → 受け箱のメールのリンク → 使い始めの画面。申し込みの名前・会社名・同意の版が確定後の本人に移る", async ({
  page,
}) => {
  const w = person("正常");
  const started = new Date((await admin<{ t: Date }>("select now() as t"))[0]!.t).getTime(); // DB の時刻で、試験を始めた時刻
  const before = await currentTerms();
  await signUpByForm(page, w);
  expect(await confirmed(w.email), "メールを確かめる前は本人を作らない").toEqual([]);
  const mail = await box.waitFor(w.email);
  expect(mail.subject).toContain("メールアドレスの確認");
  await openLink(page, linkIn(mail, "/verify-email"));
  await expect(heading(page, "登録できました")).toBeVisible();
  await readyToEnter(w.email);
  await page.getByRole("button", { name: "続ける", exact: true }).click();
  await expect(page, "使い始めの画面（チケットの画面）へ入る").toHaveURL(/\/tickets$/);
  expect(await tokenOf(page), "ログインの印を持つ").toBeTruthy();
  await canEnter(page, w.email);
  const me = await confirmed(w.email);
  expect(me, "本人は 1 人").toHaveLength(1);
  expect(me[0]).toMatchObject({ verified: true, company: w.company, display_name: w.name, user_name: w.name });
  const agreed = await agreedVersions(me[0]!.user_id);
  expect(agreed.map((a) => a.terms_version_id).sort(), "登録で同意した今の版が本人に移る").toEqual(
    before.map((b) => b.id).sort(),
  );
  for (const a of agreed) {
    expect(a.agreed_at, "同意の時刻が残る（空でない）").not.toBeNull();
    expect(new Date(a.agreed_at).getTime(), "同意の時刻は試験を始めた後（登録のときの同意）").toBeGreaterThanOrEqual(
      started,
    );
  }
});

test("K54-M1-02 期限切れ：30 分を過ぎてからリンク → 期限切れの案内 → もう一度登録すると新しいメールが届き、通れる", async ({
  page,
}) => {
  const w = person("期限切れ");
  await signUpByForm(page, w);
  const first = await linkOf(w, 1);
  expect(await elapseSignup(w.email, "30 minutes 1 second"), "DB の時刻を 30 分 1 秒進める").toBe(1);
  await openLink(page, first);
  await expect(page.getByText(MSG.expired)).toBeVisible();
  await page.getByRole("link", { name: "もう一度登録する", exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await signUpByForm(page, w); // 期限切れの申し込みが邪魔をしない
  const second = await linkOf(w, 2);
  expect(second, "新しいリンク").not.toBe(first);
  await openLink(page, second);
  await expect(heading(page, "登録できました")).toBeVisible();
  expect(await confirmed(w.email)).toHaveLength(1);
});

test("K54-M1-03 送り直し：送り直す → 前のメールのリンクは使えない案内。新しいリンクでは通れる", async ({
  page,
  browser,
}) => {
  const w = person("送り直し");
  await signUpByForm(page, w);
  const first = await linkOf(w, 1);
  await page.getByRole("button", { name: "送り直す", exact: true }).click();
  await expect(page.getByText("もう一度送りました")).toBeVisible();
  const second = await linkOf(w, 2);
  expect(second).not.toBe(first);
  const b = await browserOf(browser); // 前のメールを開く（確定はまだしない）
  try {
    await openLink(b.page, first);
    await expect(b.page.getByText(MSG.oldLink)).toBeVisible();
    expect(await confirmed(w.email), "前のリンクでは本人を作らない").toEqual([]);
  } finally {
    await b.ctx.close();
  }
  await openLink(page, second);
  await expect(heading(page, "登録できました")).toBeVisible();
  expect(await confirmed(w.email)).toHaveLength(1);
});

test("K54-M1-04 確定済みでもう一度：同じリンクをもう一度 → 「登録は済んでいます。ログインへ」。二重に本人ができない", async ({
  page,
  browser,
}) => {
  const w = person("二度目");
  await signUpByForm(page, w);
  const url = await linkOf(w);
  await openLink(page, url);
  await expect(heading(page, "登録できました")).toBeVisible();
  // ログインしていないブラウザで同じリンク
  const b = await browserOf(browser);
  try {
    await openLink(b.page, url);
    await expect(b.page.getByText(MSG.done)).toBeVisible();
    await b.page.getByRole("link", { name: "ログイン", exact: true }).click();
    await expect(b.page).toHaveURL(/\/login/);
  } finally {
    await b.ctx.close();
  }
  // 確定したブラウザ（ログイン中）で同じリンク → 二重に作らない（もう一度「登録できました」にしない）。
  //   行き先（中へ入るか・ログインの案内か）は K52-UI-010 が持つ。本物の口では自分の取得（GET /api/v1/me・K-70・K-121）が 501 なので、いまは案内が出る。
  //   今出る文言そのもので確かめる：K-70 が入って中へ入るようになったら、ここが赤になって気づける（そのときこの行を直す）
  await openLink(page, url);
  await expect(heading(page, "登録は終わっています")).toBeVisible();
  await expect(page.getByText(MSG.done)).toBeVisible();
  await expect(heading(page, "登録できました")).toHaveCount(0);
  expect(await confirmed(w.email), "本人は 1 人のまま").toHaveLength(1);
});

test("K54-M1-05 別のブラウザ：登録は A、リンクは B → B で確定できる。A の待つ画面は再読み込みで確定済みを出す", async ({
  page,
  browser,
}) => {
  const w = person("別のブラウザ");
  await signUpByForm(page, w); // A
  const b = await browserOf(browser);
  try {
    await openLink(b.page, await linkOf(w));
    await expect(heading(b.page, "登録できました")).toBeVisible();
    await readyToEnter(w.email);
    await b.page.getByRole("button", { name: "続ける", exact: true }).click();
    await expect(b.page).toHaveURL(/\/tickets$/);
  } finally {
    await b.ctx.close();
  }
  await page.reload();
  await expect(heading(page, "登録は終わっています")).toBeVisible();
  await expect(page.getByRole("link", { name: "ログイン", exact: true })).toBeVisible();
  expect(await confirmed(w.email), "端末をまたいでも申し込みは 1 つ・本人は 1 人").toHaveLength(1);
  expect(await box.mails(w.email, /確認/)).toHaveLength(1);
});

test("K54-M1-06 規約の新しい版：確定のあと新しい版を出してから入る → 同意し直しの画面。同意するまで先に進めない", async ({
  page,
}) => {
  const w = person("新しい版");
  await signUpByForm(page, w);
  await openLink(page, await linkOf(w));
  await expect(heading(page, "登録できました")).toBeVisible();
  const ids = await publishNewTerms("after-verify");
  try {
    await page.evaluate(() => window.localStorage.removeItem("kaname.token")); // 入り直す
    await loginByForm(page, w.email);
    await stuckOnTerms(page);
    await agreeOnTerms(page);
    await canEnter(page, w.email);
    const me = (await confirmed(w.email))[0]!;
    const agreed = (await agreedVersions(me.user_id)).map((a) => a.terms_version_id);
    for (const id of ids) expect(agreed, "新しい版への同意が残る").toContain(id);
  } finally {
    await withdraw(ids);
  }
});

test("K54-M1-07 途中でやめる：登録のあと新しい版 → リンク → 同意し直しの画面で閉じる → ログインし直すと同意し直しから再開。同意の前に他の画面へ行けない", async ({
  page,
  browser,
}) => {
  const w = person("途中");
  await signUpByForm(page, w);
  const url = await linkOf(w);
  const ids = await publishNewTerms("before-verify"); // 登録と確定の間に版が変わる
  try {
    await openLink(page, url);
    await expect(heading(page, "登録できました")).toBeVisible();
    await page.getByRole("button", { name: "続ける", exact: true }).click();
    await stuckOnTerms(page); // 確定した直後に同意し直しが要る（K53-API-009）
    await page.close(); // 閉じる
    const later = await browserOf(browser); // あとで（別の時に）ログインし直す
    try {
      await loginByForm(later.page, w.email);
      await stuckOnTerms(later.page);
      await agreeOnTerms(later.page);
      await canEnter(later.page, w.email);
    } finally {
      await later.ctx.close();
    }
    const me = (await confirmed(w.email))[0]!;
    const agreed = (await agreedVersions(me.user_id)).map((a) => a.terms_version_id);
    for (const id of ids) expect(agreed, "再開して同意した新しい版が残る").toContain(id);
  } finally {
    await withdraw(ids);
  }
});
