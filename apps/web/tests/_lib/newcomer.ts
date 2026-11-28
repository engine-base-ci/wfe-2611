// 使い始めた人（K-58）：中間テスト 1（K-54）の正常の筋と同じ道で、登録 → 受け箱のメールのリンク → 「続ける」 → 使い始めの画面（/tickets）まで通した人を作る。
//   準備の道具は K-54 と同じもの（受け箱 mailbox.ts・本物の口・本物の DB）。口は網の手前で差し替えない（届く頭 x-forwarded-for だけを足す）。
//   似たもの：K-54 の試験のファイルの中の signUpByForm（そのファイルの中だけ）・api.ts の signupViaApi（API のログからリンクを拾い、画面を通らない）。
//   ここは画面とメールを通して、ログインの印を持った人を返す（中間テスト 2 以降の筋の頭に置く）
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { API, PW, addTestEntry, admin, uniq, uniqEmail } from "./api";
import { linkIn, type Mailbox } from "./mailbox";

const API_ORIGIN = new URL(API).origin;

/** 利用者ごとに別の IP にする（口の回数の制限は IP ごと。回数の制限そのものは単体の試験が持つ）。答えは作らない */
export async function ownIp(ctx: BrowserContext, net = 58): Promise<void> {
  const ip = `10.${net}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
  await ctx.route(
    (u) => u.origin === API_ORIGIN,
    (r) => r.continue({ headers: { ...r.request().headers(), "x-forwarded-for": ip } }),
  );
}

export interface Newcomer {
  email: string;
  name: string;
  company: string;
  memberId: string;
  /** ブラウザが持つログインの印（kaname.token） */
  token: string;
}

/** 登録の画面から入り、届いたメールのリンクを開き、「続ける」で使い始めの画面（/tickets）に入った人 */
export async function newcomer(page: Page, box: Mailbox, tag: string): Promise<Newcomer> {
  const w = { email: uniqEmail(), name: `中間2 ${tag}`, company: `中間テスト 2 の会社 ${tag} ${uniq()}` };
  await page.goto("/signup");
  await page.getByLabel("メール", { exact: true }).fill(w.email);
  await page.getByLabel("名前", { exact: true }).fill(w.name);
  await page.getByLabel("会社・チームの名前", { exact: true }).fill(w.company);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ（メールを確かめる）" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "確認メールを送りました" })).toBeVisible();
  const res = await page.goto(linkIn(await box.waitFor(w.email), "/verify-email"));
  expect(res?.status(), "メールのリンクの先が開ける").toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "登録できました" })).toBeVisible();
  // 入り方を 1 つ持つ人にしてから進む（付けるまで進めない・K-321。付けるまで進めないを通す試験は K-319 が自分で人を作る）
  const [u] = await admin<{ id: string }>('select id from kaname_auth."user" where email = $1', [w.email]);
  await addTestEntry(u!.id);
  await page.getByRole("button", { name: "続ける", exact: true }).click();
  await expect(page, "使い始めの画面（チケットの画面）へ入る").toHaveURL(/\/tickets$/);
  const token = await page.evaluate(() => window.localStorage.getItem("kaname.token"));
  expect(token, "ログインの印を持つ").toBeTruthy();
  const m = await admin<{ id: string }>(
    `select m.id from members m join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1 and m.deleted_at is null`,
    [w.email],
  );
  expect(m, "本人は 1 人").toHaveLength(1);
  return { ...w, memberId: m[0]!.id, token: token! };
}
