// 段 12（F11 先方の人（ゲスト）と回す）の中間テストの道具（K-918 が持ち込む・K-920 も読む）：ゲストのグループを画面で作る・画面で招く・招待のリンクで参加する・
//   ゲストを別のブラウザで持つ・依頼を画面で出す・社内で受けてチケットにする・DB を読む・見せる相手を動かす。
//   口は網の手前で差し替えない（page.route で答えを作らない）。社内の 1 人目は newcomer.ts（画面とメール）、ゲストは招待のリンクを画面で開く道（guestByLink）か、
//   招待の行を置いて受ける口を通す道（guestBySql・prep.ts の teammate と同じ）。
//   探したが無かった：ゲストのグループ・ゲストを動かす道具は apps/web/tests/_lib に無い（似た物は prep.ts の teammate＝社内の人 1 人を口で作る・ブラウザもメールも返さない）。
//   画面の字は K-874・K-877・K-898・K-905・K-911・K-912・K-913・K-928 の仕様の表とモック /dev/mock/f11 から（実装から書かない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { randomBytes } from "node:crypto";
import { expect, type Browser, type BrowserContext, type Locator, type Page, type Response } from "@playwright/test";
import { API, PW, addTestEntry, admin, api, loginAs, sha256, uniqEmail } from "./api";
import type { Newcomer } from "./newcomer";

const SEC = 'section[aria-labelledby="members-title"]';
const DLG = ".k-dialog";

/** ゲスト 1 人（自分のブラウザ・別の印・別の文脈を持つ） */
export interface Guest {
  memberId: string;
  authUserId: string;
  email: string;
  name: string;
  token: string;
  ctx: BrowserContext;
  page: Page;
}

// ---------------------------------------------------------------- 社内：ゲストのグループを作る・招く（段 9 の本物の画面・K-874）
export const guestTabs = (page: Page): Locator =>
  page.getByRole("navigation", { name: "メンバーとゲスト", exact: true });
/** メンバーの画面 → 「ゲスト」のタブ */
export async function openGuests(page: Page): Promise<void> {
  expect((await page.goto("/members"))?.status(), "メンバーの画面が開ける").toBe(200);
  await guestTabs(page)
    .getByRole("link", { name: /^ゲスト \d+$/ })
    .click();
  await expect(page.locator(SEC).getByRole("heading", { name: "ゲスト", level: 1, exact: true })).toBeVisible();
}
/** ゲストのタブの「＋ ゲストのグループを作る」→ 名前と届け先（先頭の社内のグループ）→「作る」。グループの id を返す */
export async function createGroupOnScreen(page: Page, name: string): Promise<string> {
  await page.locator(SEC).getByRole("button", { name: "＋ ゲストのグループを作る", exact: true }).first().click();
  const d = page.locator(DLG);
  await d.getByLabel("名前 必須", { exact: true }).fill(name);
  await d.getByLabel("依頼が届く社内のグループ 必須", { exact: true }).selectOption({ index: 0 });
  const res = page.waitForResponse(
    (r) => r.request().method() === "POST" && /\/api\/v1\/guest-groups$/.test(new URL(r.url()).pathname),
  );
  await d.getByRole("button", { name: "作る", exact: true }).click();
  expect((await res).status(), "ゲストのグループを作る口が受ける").toBe(201);
  return groupIdOf(name);
}
/** グループの行の「このゲストのグループに招く」→ メールを足す →「招く」。招待の口の答えの番号を返す */
export async function inviteGuestOnScreen(page: Page, groupName: string, email: string): Promise<number> {
  const row = page.locator(".k-inv-group").filter({ hasText: groupName });
  await row.getByRole("button", { name: "＋ このゲストのグループに招く", exact: true }).click();
  const d = page.locator(DLG);
  await d.getByLabel("メール 必須", { exact: true }).fill(email);
  await d.getByRole("button", { name: "足す", exact: true }).click();
  const res = page.waitForResponse(
    (r) => r.request().method() === "POST" && /\/api\/v1\/invitations$/.test(new URL(r.url()).pathname),
  );
  await d.getByRole("button", { name: /^(\d+ 人を)?招く$/ }).click();
  return (await res).status();
}

// ---------------------------------------------------------------- ゲストを持つ
/** 招待のメールの本文の招待のリンク（/invite/<印>）。無ければ落とす */
export function inviteLinkIn(text: string): string {
  const m = text.match(/https?:\/\/[^\s<>"）)]+\/invite\/[A-Za-z0-9_-]+/);
  if (!m) throw new Error(`招待のメールに /invite/ のリンクが無い:\n${text}`);
  return m[0];
}
/** メールのリンクを画面で開き、名前とパスワードで参加する → 入り方を足して先方の場所（/portal）へ。ゲストのブラウザを返す */
export async function guestByLink(browser: Browser, link: string, email: string, name: string): Promise<Guest> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  expect((await page.goto(link))?.status(), "招待のリンクの先が開ける").toBe(200);
  await page.getByLabel("名前", { exact: true }).fill(name);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "参加する", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname, { message: "招待の画面を離れる" }).not.toMatch(/^\/invite\//);
  const [u] = await admin<{ id: string }>('select id from kaname_auth."user" where email = $1', [email]);
  await addTestEntry(u!.id); // 入り方を 1 つ持つ人にする（付けるまで進めない・K-321）
  await page.goto("/portal");
  const token = await page.evaluate(() => window.localStorage.getItem("kaname.token"));
  expect(token, "ログインの印を持つ").toBeTruthy();
  const [m] = await admin<{ id: string }>(
    "select m.id from members m where m.auth_user_id = $1 and m.deleted_at is null",
    [u!.id],
  );
  return { memberId: m!.id, authUserId: u!.id, email, name, token: token!, ctx, page };
}
/** 招待の行を置いて受ける口を通し（画面の招く・メールは通らない）、ゲストのブラウザを返す（prep.ts の teammate のゲスト版） */
export async function guestBySql(browser: Browser, me: Newcomer, groupId: string, name: string): Promise<Guest> {
  const [t] = await admin<{ t: string }>("select tenant_id as t from members where id = $1", [me.memberId]);
  const token = randomBytes(24).toString("base64url");
  const email = uniqEmail();
  await admin(
    "insert into invitations (tenant_id, email, role_id, guest_group_id, token_hash, expires_at, created_by) values ($1, $2, 'requester', $3, $4, now() + interval '7 days', $5)",
    [t!.t, email, groupId, sha256(token), me.memberId],
  );
  const r = await api<{ data: { token: string } }>(`/api/v1/auth/invitations/${token}/accept`, { name, password: PW });
  if (r.status !== 201) throw new Error(`招待を受ける口が ${r.status}`);
  const [u] = await admin<{ id: string }>('select id from kaname_auth."user" where email = $1', [email]);
  await addTestEntry(u!.id);
  const [m] = await admin<{ id: string }>("select id from members where auth_user_id = $1 and deleted_at is null", [
    u!.id,
  ]);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(page, r.json.data.token);
  expect((await page.goto("/portal"))?.status(), "ゲストが先方の場所を開ける").toBe(200);
  return { memberId: m!.id, authUserId: u!.id, email, name, token: r.json.data.token, ctx, page };
}

// ---------------------------------------------------------------- ゲストの画面（先方の場所・K-911〜K-913）
export const answered = (page: Page, method: string, re: RegExp): Promise<Response> =>
  page.waitForResponse((r) => r.request().method() === method && re.test(new URL(r.url()).pathname));
export const REQ_CREATE_RE = /^\/api\/v1\/portal\/requests$/;
export const REQ_MSG_RE = /^\/api\/v1\/portal\/requests\/[^/]+\/messages$/;
export const TICKET_READ_RE = /^\/api\/v1\/portal\/tickets\/[^/]+$/;
export const TICKET_MSG_RE = /^\/api\/v1\/portal\/tickets\/[^/]+\/messages$/;
/** ゲストの画面の「＋ 依頼を出す」→ 何をしてほしいかを書く →「依頼を出す」。依頼を出す口の答えの番号と、できた依頼の id を返す */
export async function requestOnScreen(page: Page, text: string): Promise<{ status: number; id: string | null }> {
  await page.goto("/portal");
  await page
    .getByRole("link", { name: /^＋ 依頼を出す$/ })
    .or(page.getByRole("button", { name: /^＋ 依頼を出す$/ }))
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "依頼を出す", exact: true })).toBeVisible();
  await page.getByLabel("何をしてほしいか*", { exact: true }).fill(text);
  const res = answered(page, "POST", REQ_CREATE_RE);
  await page.getByRole("button", { name: "依頼を出す", exact: true }).click();
  const r = await res;
  const id = r.status() === 201 ? ((await r.json()) as { data: { id: string } }).data.id : null;
  return { status: r.status(), id };
}
/** ゲストの画面に出ている字全部（期限・担当などが出ていないことを見る） */
export const textOf = (page: Page): Promise<string> => page.locator("body").innerText();

// ---------------------------------------------------------------- 社内の画面（届いた依頼・K-898）
/** 届いた依頼の 1 件を開く（/requests/:id）。題が見えるまで待つ */
export async function openRequest(page: Page, id: string, title: RegExp | string): Promise<void> {
  expect((await page.goto(`/requests/${id}`))?.status(), "届いた依頼が開ける").toBe(200);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}
/** 期限の欄に入れる形（「12/26」＝月/日・頭の 0 は付けない）。due は YYYY-MM-DD（DB の due_on と比べる形） */
export const dueField = (due: string): string => {
  const [, m, d] = due.split("-").map(Number);
  return `${m}/${d}`;
};
/** 「チケットを作る」→ 小窓：担当（先頭の人）・期限を入れて「作る」。口の答えの番号を返す（見せる相手は最初から入っている）。
 *  担当は Base UI の Select（combobox を押して option を選ぶ・<select> ではない）。期限の欄は「M/D」の形だけを受ける（K-930）ので、
 *  due（YYYY-MM-DD・今日より後の日）を「M/D」に直して入れる。画面は次のその日付の YYYY-MM-DD にして送るので、DB の due_on は due と同じ日 */
export async function acceptOnScreen(page: Page, due: string): Promise<number> {
  await page.getByRole("button", { name: "チケットを作る", exact: true }).click();
  const d = page.getByRole("dialog", { name: "チケットを作る", exact: true });
  await d.getByRole("combobox", { name: "担当", exact: true }).click();
  await page.getByRole("option").first().click();
  await d.getByRole("textbox", { name: "期限", exact: true }).fill(dueField(due));
  const res = answered(page, "POST", /^\/api\/v1\/client_requests\/[^/]+\/accept$/);
  await d.getByRole("button", { name: "作る", exact: true }).click();
  return (await res).status();
}

// ---------------------------------------------------------------- DB を読む・動かす
export const groupIdOf = async (name: string): Promise<string> => {
  const [g] = await admin<{ id: string }>("select id from guest_groups where name = $1 and deleted_at is null", [name]);
  if (!g) throw new Error(`ゲストのグループ「${name}」が DB に無い`);
  return g.id;
};
export const requestsOf = (groupId: string) =>
  admin<{ id: string; state: string; ticket_id: string | null; title: string; body: string; guest_group_id: string }>(
    "select id, state, ticket_id, title, body, guest_group_id from client_requests where guest_group_id = $1 and deleted_at is null order by created_at, id",
    [groupId],
  );
export const ticketRow = async (id: string) =>
  (
    await admin<{ id: string; title: string; due_on: string | null; assignee_member_id: string | null }>(
      "select id, title, due_on::text, assignee_member_id from tickets where id = $1",
      [id],
    )
  )[0]!;
export const sharesOf = (ticketId: string) =>
  admin<{ guest_group_id: string }>(
    "select guest_group_id from ticket_guest_shares where ticket_id = $1 and deleted_at is null order by guest_group_id",
    [ticketId],
  );
/** その人の受け箱（inapp）の行の種類（古い順） */
export const inboxKinds = async (memberId: string): Promise<string[]> =>
  (
    await admin<{ k: string }>(
      "select event_kind_id as k from notifications where member_id = $1 and channel_id = 'inapp' and deleted_at is null order by created_at, id",
      [memberId],
    )
  ).map((r) => r.k);
export const inboxCount = async (memberId: string, kind: string): Promise<number> =>
  (await inboxKinds(memberId)).filter((k) => k === kind).length;
/** チケットの段を、仕組みの段の鍵で動かす（段の変え方の画面は段 5・7 の単体が持つ。ここは変わった後に先方が読み直すつなぎ目） */
export async function stageTo(ticketId: string, key: "doing" | "checking" | "done"): Promise<void> {
  await admin(
    "update tickets t set stage_id = (select id from ticket_stages s where s.tenant_id = t.tenant_id and s.key = $2) where t.id = $1",
    [ticketId, key],
  );
}

/** チケットの「詳細」の区画（鍵 detail）に字を入れる（K-906・まとめ役の決め 3：詳細は鍵 detail の区画の字。書く画面は無いので DB で置き、ゲストの画面に出ることを見る） */
export async function detailTo(ticketId: string, text: string): Promise<void> {
  await admin(
    "insert into ticket_sections (tenant_id, ticket_id, section_key, body) select tenant_id, id, 'detail', $2::jsonb from tickets where id = $1 on conflict (ticket_id, section_key) do update set body = excluded.body",
    [ticketId, JSON.stringify({ text })],
  );
}

// ---------------------------------------------------------------- 早く作る道（画面の道は M1 が通る・ここは M3 の頭の用意）
/** ゲストのグループを DB に 1 つ作る（画面で作る道は K-874・M1 が通る）。届け先は社内の 1 人目のグループ */
export async function groupBySql(me: Newcomer, name: string): Promise<string> {
  const [m] = await admin<{ t: string; s: string }>("select tenant_id as t, scope_id as s from members where id = $1", [
    me.memberId,
  ]);
  const [g] = await admin<{ id: string }>(
    "insert into guest_groups (tenant_id, name, request_scope_id) values ($1, $2, $3) returning id",
    [m!.t, name, m!.s],
  );
  return g!.id;
}
/** 社内の人として口を呼ぶ（DELETE・PATCH も。prep.ts の asPerson は GET と POST だけ）。体は JSON。ログインの印は渡した物 */
export async function callAs(
  page: Page,
  token: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, unknown> | null }> {
  const key = method === "POST" ? `f11-${randomBytes(8).toString("hex")}` : null;
  const r = await page.evaluate(
    async ([url, m, tok, k, b]) => {
      const res = await fetch(url, {
        method: m,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tok}`,
          ...(k ? { "idempotency-key": k } : {}),
        },
        ...(b ? { body: b } : {}),
      });
      return { status: res.status, json: (await res.json().catch(() => ({}))) as { data?: Record<string, unknown> } };
    },
    [`${API}/api/v1${path}`, method, token, key, body ? JSON.stringify(body) : null] as const,
  );
  return { status: r.status, data: r.json.data ?? null };
}
/** 社内の人がチケットのチャットに書く（段 7 の口。見せる前に書けば、見せても見えない・K-882） */
export const postTicketMessage = (page: Page, token: string, ticketId: string, text: string) =>
  callAs(page, token, "POST", `/tickets/${ticketId}/messages`, { body: text });
