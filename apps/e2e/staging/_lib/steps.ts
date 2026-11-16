// 統合テスト（staging）の画面の 1 歩（K-65）：登録・メールのリンクで入る・PC をつなぐの画面・画面でチケットを作る・帯とボタン・ログイン。
//   操作と選び方は中間テスト（apps/web/tests/skeleton の m1・m2・m3 と _lib/newcomer.ts・prep.ts）と同じ。写しを置いた訳：
//   あちらの道具は _lib/api.ts を読み、手元の DB の管理者の接続（pg）・手元の受け箱・届く頭 x-forwarded-for の付け替えを前提にする。
//   staging では DB を読まず（PM の決め 2）、受け箱も頭の付け替えも使えない。口は網の手前で差し替えない（page.route を使わない）。
//   ここは進むための 1 歩だけを持つ。行の期待結果の確かめは試験（k65-walking-skeleton.spec.ts）に書く
import { randomBytes } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { API } from "./site";

export interface Person {
  email: string;
  name: string;
  company: string;
  password: string;
}
/** 初めての人（毎回別の物）。宛先は Resend の試験用の宛先（届いたことになる・D-140.1）。名前と会社に「統合テスト」の印（staging に残す）。
 *  パスワードは回ごとに作る（staging は漏れたパスワードの照合が本物なので、決まった文字を使わない）。どこにも書き出さない。
 *  尻に決まった印（-k65pw-aA1）を付ける：落ちた文（fill の Call log）に乗っても、伏せる台本（scrub.mjs の SHAPES）が形で伏せる。
 *  作るのは試験の子の側・記録を伏せ直すのは親の側なので、値そのものは渡せない（書き出さない）。だから形で伏せる */
export function person(tag: string): Person {
  const mark = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  return {
    email: `delivered+k65-${mark}@resend.dev`,
    name: `統合テスト ${tag}`,
    company: `統合テストの会社 ${tag} ${mark}`,
    password: `${randomBytes(18).toString("base64url")}-k65pw-aA1`,
  };
}
export const aiOf = (p: Person): string => `${p.name}のAI`;
/** いま開いている画面の道（住所は返さない：落ちた文に staging の住所を出さない） */
export const pathOf = (page: Page): string => new URL(page.url()).pathname;
export const h1 = (page: Page, name: string): Locator => page.getByRole("heading", { level: 1, name });
const apiPath = (url: string): string => new URL(url).pathname;

/** 登録の画面に書いて「次へ」を押す。登録の口（POST /api/v1/auth/sign-up）の答えの番号を返す */
export async function submitSignup(page: Page, p: Person): Promise<number> {
  await page.goto("/signup");
  await page.getByLabel("メール", { exact: true }).fill(p.email);
  await page.getByLabel("名前", { exact: true }).fill(p.name);
  await page.getByLabel("会社・チームの名前", { exact: true }).fill(p.company);
  await page.getByLabel("パスワード", { exact: true }).fill(p.password);
  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && apiPath(r.url()) === "/api/v1/auth/sign-up",
  );
  await page.getByRole("button", { name: "次へ（メールを確かめる）" }).click();
  return (await answered).status();
}
/** メールのリンクを開く →「登録できました」→「続ける」→ 使い始めの画面（/tickets）。リンクの先の番号を返す */
export async function enterByLink(page: Page, link: string): Promise<number | null> {
  const res = await page.goto(link);
  await expect(h1(page, "登録できました")).toBeVisible();
  await page.getByRole("button", { name: "続ける", exact: true }).click();
  await expect.poll(() => pathOf(page), "使い始めの画面（チケットの画面）へ入る").toBe("/tickets");
  return res?.status() ?? null;
}
/** ブラウザが持つログインの印（kaname.token）があるか。印そのものは返さない */
export const hasLoginMark = (page: Page): Promise<boolean> =>
  page.evaluate(() => Boolean(window.localStorage.getItem("kaname.token")));

/** その人の画面と同じブラウザから、本人のログインの印で契約の口を読む（GET だけ）。別の GET で読み直す確かめに使う
 *  （試験の側から直に呼ぶと端末の印が変わり、ログインの印が通らない・D-128.120。K-58 の devicesFor と同じ呼び方） */
export async function readAs(
  page: Page,
  path: string,
): Promise<{ status: number; data: unknown; code: string | null }> {
  return page.evaluate(
    async ([url]) => {
      const token = window.localStorage.getItem("kaname.token") ?? "";
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      const json = (await res.json().catch(() => ({}))) as { data?: unknown; code?: string };
      return { status: res.status, data: json.data ?? null, code: json.code ?? null };
    },
    [`${API}/api/v1${path}`] as const,
  );
}

/** PC をつなぐの画面を開く。開いた先の番号を返す */
export async function openConnect(page: Page, from = "/tickets"): Promise<number | null> {
  const res = await page.goto(`/setup/bridge?from=${encodeURIComponent(from)}`);
  // 本文の h1 はキャンバスの字「PC と使った量」（K-220）。つなぐ小窓が開いている間は小窓の題「PC をつなぐ」
  await expect(page.getByRole("heading", { level: 1, name: /^(PC と使った量|PC をつなぐ)$/ })).toBeVisible();
  return res?.status() ?? null;
}
const CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
/** 画面に出ている接続コード（人が読んで Bridge の窓に入れるもの） */
export async function codeOnScreen(page: Page): Promise<string> {
  const c = page.getByTestId("pairing-code");
  await expect(c).toHaveText(CODE_RE);
  return (await c.innerText()).trim();
}
/** 「つながっています」の印（見出しが「つながっています」で始まる知らせ） */
export const liveOn = (page: Page): Locator =>
  page
    .getByRole("status")
    .filter({ hasText: /^つながっています/ })
    .first();

export interface TicketBody {
  purpose: string;
  done: string;
  /** 実施事項（`- ` の行が項目。完了の小窓のチェックになる） */
  todo: string;
}
const jst = (days: number): string => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
/** 左のメニューの「チケットを作る」から作る → 詳細へ。できたチケットの id を返す */
export async function createTicket(page: Page, me: Person, title: string, body: TicketBody): Promise<string> {
  await page.goto("/tickets");
  // 作る入口は左のメニューの「チケットを作る」（見出しの帯には主ボタンを置かない・K-138）
  await page
    .getByRole("navigation", { name: "メニュー", exact: true })
    .getByRole("button", { name: "チケットを作る" })
    .click();
  await expect(page.getByRole("region", { name: "チケットを作る" })).toBeVisible();
  await page.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  await page.getByRole("combobox", { name: "担当者" }).click();
  await page.getByRole("option", { name: me.name, exact: true }).click();
  await page.getByRole("textbox", { name: "期限", exact: true }).fill(jst(3));
  await page.getByRole("textbox", { name: "目的", exact: true }).fill(body.purpose);
  await page.getByRole("textbox", { name: "完了の条件", exact: true }).fill(body.done);
  await page.getByRole("textbox", { name: "実施事項", exact: true }).fill(body.todo);
  await page.getByRole("button", { name: "作る", exact: true }).click();
  await expect.poll(() => pathOf(page), "作ったら詳細へ移る").toMatch(/^\/tickets\/[0-9a-f-]{36}$/);
  await expect(h1(page, title)).toBeVisible();
  return pathOf(page).split("/").pop()!;
}

/** K-62 の帯（作る段の間） */
export const aiBand = (page: Page): Locator => page.getByRole("region", { name: "AI に任せる" });
/** K-63 の帯（承認待ち・実行待ち・実行中・止まった・完了の案内・完了のどの状態でも同じ名前） */
export const execBand = (page: Page): Locator => page.getByRole("region", { name: "承認と実行" });
export const delegateBtn = (page: Page): Locator => page.getByRole("button", { name: "AI に任せる", exact: true });
export const approveBtn = (page: Page): Locator =>
  execBand(page).getByRole("button", { name: "承認して送る", exact: true });
export const completeBtn = (page: Page): Locator => page.getByRole("button", { name: "完了にする", exact: true });

/** ボタンを押し、その口（POST・道が re に合う）の答えの番号を返す。押した結果を口の答えで確かめる */
export async function clickAndAnswer(page: Page, button: Locator, re: RegExp): Promise<number> {
  const answered = page.waitForResponse((r) => r.request().method() === "POST" && re.test(apiPath(r.url())));
  await button.click();
  return (await answered).status();
}
export const DELEGATE_RE = /^\/api\/v1\/tickets\/[^/]+\/delegate$/;
export const APPROVE_RE = /^\/api\/v1\/approvals\/[^/]+\/approve$/;
export const COMPLETE_RE = /^\/api\/v1\/tickets\/[^/]+\/complete$/;

/** ログインの画面から入る。ログインの画面を離れる（か、同意し直しの段に止まる）まで待つ */
export async function loginByForm(page: Page, p: Person): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(p.email);
  await page.getByLabel("パスワード", { exact: true }).fill(p.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect
    .poll(() => `${pathOf(page)}${new URL(page.url()).searchParams.get("step") === "terms" ? "?step=terms" : ""}`, {
      message: "ログインの画面を離れる",
      timeout: 30_000,
    })
    .not.toBe("/login");
}
