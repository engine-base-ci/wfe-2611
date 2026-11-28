// 段 8（F7 毎日見る・探す・片付ける）の中間・またぐ試験の道具（K-460 が持ち込む・K-591〜K-595・K-597・K-598 が読む）：
//   同じ会社の 2 人目を自分のブラウザで入れる・お知らせの行を DB に直に置く・鈴を開く・チケットの番号と区画を引く・子チケットを口で作る・
//   期限と完了を DB で動かす・口の答えを待つ。人の 1 人目は newcomer.ts（画面とメール）、2 人目は prep.ts の teammate にブラウザを持たせる。
//   口は網の手前で差し替えない（page.route で答えを作らない。1 人目だけ届く頭 x-forwarded-for を足す・K-64 と同じ）。
//   探したが無かった：目録（03_architecture/catalog.json）と apps/web/tests/_lib に、お知らせの行を置く・鈴を開く・2 人目をブラウザで動かす道具は無い。
//   似たもの：段 9 の f8-flow.ts の mateOf（c/段9・本線にまだ無いので読まず、同じ形を持つ）・prep.ts の teammate（ブラウザを返さない）・api.ts の loginAs。
//   prep.ts・api.ts・newcomer.ts は変えない（読む試験が多い・K-64 の申し送り）。
//   画面の字は K-467・K-471・K-478・K-479・K-481〜K-484・K-590 の仕様の表から（実装から書かない）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
import { expect, type Browser, type BrowserContext, type Locator, type Page, type Response } from "@playwright/test";
import { admin, loginAs } from "./api";
import type { Newcomer } from "./newcomer";
import { asPerson, bodyOf, teammate, type TicketSections } from "./prep";

/** 2 人目（同じ会社のメンバー）。自分のブラウザ（別の印・別の文脈）を持つ */
export interface Mate {
  memberId: string;
  token: string;
  name: string;
  ctx: BrowserContext;
  page: Page;
}
/** 同じ会社の 2 人目を作り、別のブラウザの文脈でログインした画面を返す（送り元の付け替えはしない） */
export async function mateOf(browser: Browser, me: Newcomer, name: string): Promise<Mate> {
  const t = await teammate(me, name);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(page, t.token);
  expect((await page.goto("/tickets"))?.status(), "2 人目がチケットの画面を開ける").toBe(200);
  return { memberId: t.memberId, token: t.token, name, ctx, page };
}

/** 口の答えを待つ（押した後に DB を読むと、口が書く前に読んでしまう・時間では待たない） */
export const answered = (page: Page, method: string, re: RegExp): Promise<Response> =>
  page.waitForResponse((r) => r.request().method() === method && re.test(new URL(r.url()).pathname));
export const NOTICE_RE = /^\/api\/v1\/notifications\/[^/]+$/;
export const READ_ALL_RE = /^\/api\/v1\/notifications\/read-all$/;
export const SEARCH_RE = /^\/api\/v1\/search$/;
export const TICKET_RE = /^\/api\/v1\/tickets\/[^/]+$/;
export const RESTORE_RE = /^\/api\/v1\/tickets\/[^/]+\/restore$/;
export const SAVED_RE = /^\/api\/v1\/saved_views$/;

// ---------------------------------------------------------------- DB（準備と確かめ・管理の接続）
/** チケットの番号（EG-128 の形）と、そのグループ */
export async function ticketFacts(ticketId: string): Promise<{ number: string; scopeId: string; title: string }> {
  const [r] = await admin<{ n: string; s: string; t: string }>(
    "select number as n, scope_id as s, title as t from tickets where id = $1",
    [ticketId],
  );
  return { number: r!.n, scopeId: r!.s, title: r!.t };
}
export const scopeOf = async (memberId: string): Promise<string> =>
  (await admin<{ s: string }>("select scope_id as s from members where id = $1", [memberId]))[0]!.s;
const tenantOf = async (memberId: string): Promise<string> =>
  (await admin<{ t: string }>("select tenant_id as t from members where id = $1", [memberId]))[0]!.t;

/** お知らせの行を 1 つ直に置く（受け箱・channel inapp）。チケットに結ぶ種類は ticket を渡す（番号と題名は DB から引く）。置いた行の id を返す */
export async function noteRow(
  to: string,
  kind: string,
  o: { ticket?: string; by?: string; extra?: Record<string, unknown> } = {},
): Promise<string> {
  const facts = o.ticket ? await ticketFacts(o.ticket) : null;
  const payload = facts
    ? { ticket_id: o.ticket, number: facts.number, title: facts.title, ...(o.extra ?? {}) }
    : { ...(o.extra ?? {}) };
  const r = await admin<{ id: string }>(
    `insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
     values ($1, $2, 'inapp', $3, $4::jsonb, $5, $6) returning id`,
    [
      await tenantOf(to),
      to,
      kind,
      JSON.stringify(payload),
      `k7flow:${kind}:${o.ticket ?? "none"}:${to}:${Math.random().toString(36).slice(2)}`,
      o.by ?? null,
    ],
  );
  return r[0]!.id;
}
/** PC をつないだ直後にその人の受け箱へ入る「PC をつなぎました」のお知らせ（bridge.connected・未読・設定の札）を消す（deleted_at を立てる）。
 *  本線の app.bridge_code_claim（0089）が PC を引き取るたびに必ず書き、K-461 の種類の表では鈴にも数にも出る。始めの受け箱を空にして、鈴の数・行の数を
 *  試験が起こしたお知らせだけで数えるための準備。読んだ印だけでは足りない（読んだ行も箱に 30 日残る）。消した行の数を返す */
export async function dropPcNotice(memberId: string): Promise<number> {
  const rows = await admin(
    `update notifications set deleted_at = now()
      where member_id = $1 and event_kind_id = 'bridge.connected' and channel_id = 'inapp' and deleted_at is null returning id`,
    [memberId],
  );
  return rows.length;
}
/** その人の受け箱の行（inapp・新しい順）。種類と読んだ時刻 */
export const notesOf = (memberId: string) =>
  admin<{ id: string; kind: string; read_at: Date | null; ticket_id: string | null }>(
    `select id, event_kind_id as kind, read_at, payload->>'ticket_id' as ticket_id from notifications
      where member_id = $1 and channel_id = 'inapp' and deleted_at is null order by created_at desc, id desc`,
    [memberId],
  );

/** チケットの期限・完了・消した・親（DB の今） */
export const ticketRow = async (ticketId: string) =>
  (
    await admin<{
      due_on: string | null;
      completed_at: Date | null;
      deleted_at: Date | null;
      parent_ticket_id: string | null;
      assignee_member_id: string | null;
    }>(
      `select to_char(due_on, 'YYYY-MM-DD') as due_on, completed_at, deleted_at, parent_ticket_id, assignee_member_id
         from tickets where id = $1`,
      [ticketId],
    )
  )[0]!;
/** 期限を「今日から days 日後（日本時間）」に DB で置く（days が負なら期限切れ）。口を通さない準備 */
export async function setDueDays(ticketId: string, days: number): Promise<string> {
  const day = jst(days);
  await admin("update tickets set due_on = $2::date where id = $1", [ticketId, day]);
  return day;
}
/** 完了にする（DB で段と時刻を置く準備。完了の口の道は F5 の試験が持つ） */
export async function completeByDb(ticketId: string): Promise<void> {
  await admin(
    `update tickets t set completed_at = now(),
            stage_id = (select s.id from ticket_stages s where s.tenant_id = t.tenant_id and s.key = 'done')
      where t.id = $1`,
    [ticketId],
  );
}
/** 日本時間の今日から days 日後の日付（YYYY-MM-DD） */
export const jst = (days: number): string =>
  new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

/** チケットを口で 1 枚作る（種類「タスク」・担当は assignee・親は parent・期限は dueDays 日後）。作る画面は K-60 が持つ */
export async function ticketFor(
  page: Page,
  me: Newcomer,
  o: {
    title: string;
    assignee?: string;
    parent?: string;
    scope?: string;
    dueDays?: number | null;
    sections?: TicketSections;
  },
): Promise<string> {
  const scope = o.scope ?? (await scopeOf(me.memberId));
  const kinds = await asPerson(page, me.token, "GET", "/ticket_kinds");
  const kind = ((kinds.data as unknown as { id: string; name: string }[] | null) ?? []).find(
    (k) => k.name === "タスク",
  );
  if (!kind) throw new Error(`チケットの種類「タスク」が無い（口は ${kinds.status}）`);
  const r = await asPerson(page, me.token, "POST", "/tickets", {
    scope_id: scope,
    kind_id: kind.id,
    title: o.title,
    assignee_member_id: o.assignee ?? me.memberId,
    ...(o.parent ? { parent_ticket_id: o.parent } : {}),
    ...(o.dueDays === null ? {} : { due_on: jst(o.dueDays ?? 3) }),
    body: bodyOf(o.sections ?? { purpose: "毎日見る試験の準備", done: "確かめた", todo: "- 確かめる" }),
  });
  if (r.status !== 201) throw new Error(`チケットを作る口が ${r.status}`);
  const id = (r.data?.["id"] ?? (r.data?.["ticket"] as Record<string, unknown> | undefined)?.["id"]) as
    string | undefined;
  if (!id) throw new Error("作ったチケットの id が答えに無い");
  return id;
}

// ---------------------------------------------------------------- 画面の 1 歩
export const openTicket = async (page: Page, ticketId: string, title: string): Promise<void> => {
  expect((await page.goto(`/tickets/${ticketId}`))?.status(), "チケットの詳細が開く").toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
};
/** 外枠の鈴（名前は「お知らせ」か「お知らせ（N 件）」・99 件を超えると「99 件以上」）。数は名前から読む（見える字は 99+ に丸まる） */
export const bell = (page: Page): Locator => page.getByRole("button", { name: /^お知らせ/ }).first();
/** 鈴の未読の数（名前に件数が無ければ 0・99 件以上は 99） */
export async function bellCount(page: Page): Promise<number> {
  // 数は外枠の口 getShell の答え（K-466）。開いた直後は答えの前なので、口が落ち着いて鈴が押せる形になってから読む
  await page.waitForLoadState("networkidle");
  await expect(bell(page)).toBeEnabled();
  const name = (await bell(page).getAttribute("aria-label")) ?? "";
  const m = /（(\d+) 件）/.exec(name);
  return m ? Number(m[1]) : /99 件以上/.test(name) ? 99 : 0;
}
/** お知らせの箱（広い幅は右上に重なる箱・題「お知らせ」） */
export const noticeBox = (page: Page): Locator => page.getByRole("region", { name: "お知らせ", exact: true });
/** 鈴を押してお知らせの箱を開く */
export async function openBell(page: Page): Promise<Locator> {
  await bell(page).click();
  await expect(noticeBox(page)).toBeVisible();
  return noticeBox(page);
}
/** お知らせの箱の行（文の一部で選ぶ） */
export const noticeRow = (page: Page, text: string | RegExp): Locator =>
  noticeBox(page).getByRole("link").or(noticeBox(page).getByRole("button")).filter({ hasText: text });
/** 左のメニューの「承認待ち」の数（無ければ 0） */
export async function approvalsBadge(page: Page): Promise<number> {
  const b = page
    .getByRole("navigation", { name: "メニュー", exact: true })
    .getByRole("link", { name: /^承認待ち/ })
    .locator(".k-nav-badge");
  return (await b.count()) === 0 ? 0 : Number((await b.first().innerText()).replace(/\D/g, "")) || 0;
}
/** 探す欄を開いて打つ（広い幅：帯の探す欄に焦点 → 箱の入力へ焦点が移る → 打つ）。箱を返す */
export async function searchFor(page: Page, q: string): Promise<Locator> {
  await page.getByPlaceholder("チケット・ナレッジ・決定を探す").click();
  const box = page.getByRole("region", { name: "探す", exact: true });
  await expect(box).toBeVisible();
  const answer = answered(page, "GET", /^\/api\/v1\/search$/);
  await page.keyboard.type(q);
  expect((await answer).status(), "探す口が受ける").toBe(200);
  return box;
}

/** 詳細を開き、「…」→「消す」→ 小窓の「消す」で消す（子・孫の扱いを選ばなくてよいチケット）。消す口の答えの番号を返す。画面の道は K-590・K-595 が持つ */
export async function deleteOnScreen(page: Page, ticketId: string, title: string): Promise<number> {
  await openTicket(page, ticketId, title);
  await page.getByRole("button", { name: "ほかの操作" }).click();
  await page.getByRole("menuitem", { name: "消す", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "このチケットを消しますか" });
  await expect(dialog).toBeVisible();
  const res = answered(page, "DELETE", TICKET_RE);
  await dialog.getByRole("button", { name: "消す", exact: true }).click();
  return (await res).status();
}
/** DB：そのチケットの渡しの行（古い順）。状態と種類 */
export const handoversOf = (ticketId: string) =>
  admin<{
    id: string;
    kind: string;
    state: string;
    from_member_id: string;
    to_member_id: string | null;
    decided_at: Date | null;
  }>(
    `select id, kind, state, from_member_id, to_member_id, decided_at from ticket_handovers where ticket_id = $1 order by created_at, id`,
    [ticketId],
  );
