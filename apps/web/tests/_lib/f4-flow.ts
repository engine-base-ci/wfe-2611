// 段 5（F4 チケットを作って中身を決める）の中間テストの道具（K-454 が持つ・K-455 も読む）：作る面を画面で通す・本文を直す・版と差分の頁で戻す・確認項目を足す／チェックする・
//   会社の項目を直す・完了にする・AI に任せる・複製・親・つながり の 1 歩と、DB を読む・準備の行を DB に直に入れる道具。
//   口は網の手前で差し替えない（page.route で答えを作らない）。人は newcomer.ts（画面とメール）。チケットは口 createTicket の新しい形（body.doc・fields・specs）で、この道具が直に呼ぶ
//   （prep.ts の ticketOf は引数の形を変えずに中で 1 枚の本文に組み直す物＝K-437 の持ち物。確認項目と会社の項目を付けて作る口はここで持つ）。
//   探したが無かった：目録（03_architecture/catalog.json）と apps/web/tests/_lib に、段 5 の画面（作る面の本文・項目の表・確認項目・本文を直す・版と差分の頁・複製・親・つながり）を
//   実ブラウザで押す道具は無い。似たもの：apps/web/tests/k の *-mock.ts は口を網の手前で差し替える単体の道具（本物の口に使えない・名前の字だけ読み合わせた）・
//   skeleton/m2-bridge-ticket.spec.ts の createTicket（その試験の中だけ）。prep.ts・api.ts・newcomer.ts・f5-flow.ts は読むだけで変えない（変えると範囲の台本が読んでいる試験を全部選ぶ・K-64 の申し送り）。
//   画面の名前は K-442〜K-452・K-571・K-572・K-573・K-574 の md と、その画面の試験（apps/web/tests/k/k4NN-*.spec.ts・k57N-*.spec.ts）から（実装から書かない）。
//   会社の項目のマスタを作る・直す画面は段 10 まで無いので、準備は DB に直に入れる（custom_fields・まだ無い口を準備に使わない・段 3 の決め）。業務の型は保留（D-150.54）で、この道具は読まない・書かない。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page, type Response } from "@playwright/test";
import { admin, uniq } from "./api";
import type { Newcomer } from "./newcomer";
import { asPerson } from "./prep";

export const jstDay = (days = 0): string =>
  new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
export const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** チケットの番号（EG-12）に当たり、その後ろに数字が続く別の番号（EG-123）には当たらない */
export const numRe = (number: string): RegExp => new RegExp(`${esc(number)}(?!\\d)`);
/** 試験ごとに別の目印（題名の中に入れ、探す欄にも入れる。別の試験・別の回のチケットと混ざらない） */
export const tagOf = (what: string): string => `${what}-${uniq()}`;

// ---------------------------------------------------------------- 口の答えを待つ
/** 押した後に DB を読むと、口が書く前に読んでしまう（時間では待たない）。押す前に呼んで、押した後に await する */
export const answered = (page: Page, method: string, re: RegExp): Promise<Response> =>
  page.waitForResponse((r) => r.request().method() === method && re.test(new URL(r.url()).pathname));
export const CREATE_TICKET_RE = /^\/api\/v1\/tickets$/;
export const UPDATE_TICKET_RE = /^\/api\/v1\/tickets\/[^/]+$/;
export const BODY_RE = /^\/api\/v1\/tickets\/[^/]+\/body$/;
export const SPEC_ADD_RE = /^\/api\/v1\/tickets\/[^/]+\/test-specs$/;
export const SPEC_ROW_RE = /^\/api\/v1\/test_specs\/[^/]+$/;
export const RESTORE_RE = /^\/api\/v1\/tickets\/[^/]+\/versions\/\d+\/restore$/;
export const LINK_ADD_RE = /^\/api\/v1\/tickets\/[^/]+\/links$/;
export const LINK_ROW_RE = /^\/api\/v1\/ticket_links\/[^/]+$/;
export const DELEGATE_RE = /^\/api\/v1\/tickets\/[^/]+\/delegate$/;
export const COMPLETE_RE = /^\/api\/v1\/tickets\/[^/]+\/complete$/;

export const openTicket = async (page: Page, ticketId: string, title: string): Promise<void> => {
  expect((await page.goto(`/tickets/${ticketId}`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
};
export const idOfPage = (page: Page): string => new URL(page.url()).pathname.split("/").pop()!;
/** 押した口の要求の数を数える（口に届いたか・届いていないか） */
export function countRequests(page: Page, method: string, re: RegExp): { n: number } {
  const c = { n: 0 };
  page.on("request", (rq) => {
    if (rq.method() === method && re.test(new URL(rq.url()).pathname)) c.n += 1;
  });
  return c;
}

// ---------------------------------------------------------------- 文書の木（K-561 の形）
export type Node = Record<string, unknown>;
const textNode = (t: string): Node => ({ type: "text", text: t });
export const para = (t: string): Node => ({ type: "paragraph", content: t ? [textNode(t)] : [] });
export const docOf = (...blocks: Node[]): Node => ({ type: "doc", content: blocks });
/** チェックの箱の並び（済みの印つき）。完了の小窓が数える物 */
export const tasks = (...items: [string, boolean][]): Node => ({
  type: "taskList",
  content: items.map(([t, checked]) => ({ type: "taskItem", attrs: { checked }, content: [para(t)] })),
});

// ---------------------------------------------------------------- 準備（口の道・DB に直に）
type Row = Record<string, unknown>;
export interface MakeOpts {
  doc?: Node;
  /** 会社の項目の値（鍵は項目の id） */
  fields?: Record<string, unknown>;
  /** 確認項目の文（足す順） */
  specs?: string[];
  parent?: string;
  /** 期限は今日から何日後か（既定 3） */
  dueIn?: number;
}
/** チケットを口 createTicket（新しい形）で 1 枚作る（種別はタスク・担当は本人）。作る画面は K-442 が持つ */
export async function makeTicket(page: Page, me: Newcomer, title: string, o: MakeOpts = {}): Promise<string> {
  const [s] = await admin<{ s: string }>("select scope_id as s from members where id = $1", [me.memberId]);
  const kinds = await asPerson(page, me.token, "GET", "/ticket_kinds");
  const kind = ((kinds.data as unknown as { id: string; name: string }[] | null) ?? []).find(
    (k) => k.name === "タスク",
  );
  if (!kind) throw new Error(`チケットの種類「タスク」が無い（口は ${kinds.status}）`);
  const r = await asPerson(page, me.token, "POST", "/tickets", {
    scope_id: s!.s,
    kind_id: kind.id,
    title,
    assignee_member_id: me.memberId,
    due_on: jstDay(o.dueIn ?? 3),
    body: { doc: o.doc ?? docOf(para("先方に出す見積のたたき台を作って送る")) },
    ...(o.fields ? { fields: o.fields } : {}),
    ...(o.specs ? { specs: o.specs } : {}),
    ...(o.parent ? { parent_ticket_id: o.parent } : {}),
  });
  if (r.status !== 201) throw new Error(`チケットを作る口が ${r.status}（${r.code ?? "code なし"}）`);
  const id = (r.data?.["id"] ?? (r.data?.["ticket"] as Row | undefined)?.["id"]) as string | undefined;
  if (!id) throw new Error("作ったチケットの id が答えに無い");
  return id;
}
export interface FieldSeed {
  id: string;
  name: string;
  options: { id: string; name: string }[];
}
/** 会社の項目のマスタを 1 つ DB に直に入れる（全部の種別に出る・段 10 の画面ができるまでの準備）。人ごとに別の会社なので片付けは要らない */
export async function addField(
  me: Newcomer,
  name: string,
  fieldType: "short_text" | "long_text" | "number" | "date" | "select" | "multi_select" | "check",
  o: { required?: boolean; options?: string[]; position?: number } = {},
): Promise<FieldSeed> {
  const [t] = await admin<{ t: string }>("select tenant_id as t from members where id = $1", [me.memberId]);
  const options = (o.options ?? []).map((n) => ({ id: randomUUID(), name: n }));
  const [row] = await admin<{ id: string }>(
    `insert into custom_fields (tenant_id, name, field_type, required, options, position, created_by, updated_by)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7, $7) returning id`,
    [
      t!.t,
      name,
      fieldType,
      o.required ?? false,
      JSON.stringify(options.map((x, i) => ({ id: x.id, name: x.name, position: i + 1 }))),
      o.position ?? 1,
      me.memberId,
    ],
  );
  return { id: row!.id, name, options };
}
export const setDue = (ticketId: string, day: string): Promise<unknown[]> =>
  admin("update tickets set due_on = $2::date where id = $1", [ticketId, day]);
/** 段を作業中にする（完了の小窓の入口が出る形・K-63。人が作業中にする手は段 7 の物なので準備は DB に直に） */
export const setDoing = (ticketId: string): Promise<unknown[]> =>
  admin(
    "update tickets set stage_id = (select id from ticket_stages where tenant_id = tickets.tenant_id and key = 'doing') where id = $1",
    [ticketId],
  );

// ---------------------------------------------------------------- DB を読む
export const ticketRow = async (id: string) =>
  (
    await admin<{
      number: string;
      title: string;
      parent_ticket_id: string | null;
      due_on: string;
      assignee_member_id: string | null;
      priority: string;
      priority_reason: string | null;
      no_spec_reason: string | null;
      stage: string;
      completed_at: Date | null;
    }>(
      `select t.number, t.title, t.parent_ticket_id, t.due_on::text as due_on, t.assignee_member_id, t.priority, t.priority_reason,
              t.no_spec_reason, s.key as stage, t.completed_at
         from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1`,
      [id],
    )
  )[0]!;
/** 本文 1 枚の今（版・木・素の字・版の数）。鍵は body */
export const bodyNow = async (ticketId: string) =>
  (
    await admin<{ version: number; doc: Node; text: string; versions: number }>(
      `select s.version, s.body->'doc' as doc, s.body->>'text' as text,
              (select count(*)::int from ticket_section_versions v where v.section_id = s.id) as versions
         from ticket_sections s where s.ticket_id = $1 and s.section_key = 'body' and s.deleted_at is null`,
      [ticketId],
    )
  )[0]!;
/** 本文の版 n（木・素の字・どの版から戻したか） */
export const bodyAt = async (ticketId: string, version: number) =>
  (
    await admin<{ doc: Node; text: string; restored_from: number | null }>(
      `select v.body->'doc' as doc, v.body->>'text' as text, v.restored_from
         from ticket_section_versions v join ticket_sections s on s.id = v.section_id
        where s.ticket_id = $1 and s.section_key = 'body' and v.version = $2`,
      [ticketId, version],
    )
  )[0]!;
export const specsOf = (ticketId: string) =>
  admin<{ id: string; title: string; checked_at: Date | null; checked_by_member_id: string | null; source: string }>(
    `select id, title, checked_at, checked_by_member_id, source from test_specs
      where ticket_id = $1 and deleted_at is null order by created_at, id`,
    [ticketId],
  );
export const fieldValuesOf = (ticketId: string) =>
  admin<{ field_id: string; value: unknown }>(
    "select field_id, value from ticket_field_values where ticket_id = $1 and deleted_at is null order by created_at, id",
    [ticketId],
  );
export const linksOf = (ticketId: string) =>
  admin<{ from_ticket_id: string; to_ticket_id: string; kind: string }>(
    `select from_ticket_id, to_ticket_id, kind from ticket_links
      where (from_ticket_id = $1 or to_ticket_id = $1) and deleted_at is null order by created_at, id`,
    [ticketId],
  );
export const childrenOf = (ticketId: string) =>
  admin<{ id: string; title: string; assignee_member_id: string | null }>(
    "select id, title, assignee_member_id from tickets where parent_ticket_id = $1 and deleted_at is null order by created_at, id",
    [ticketId],
  );
export type ChangeRow = {
  author_member_id: string | null;
  body: string;
  changes: { field: string; from?: unknown; to?: unknown; note?: string }[];
};
/** やり取りの更新の行（古い順）。文は画面が changes から作る（K-574）ので、ここでは鍵と値を見る */
export const changeRowsOf = (ticketId: string) =>
  admin<ChangeRow>(
    `select author_member_id, body, changes from ticket_messages
      where ticket_id = $1 and kind = 'change' and deleted_at is null order by created_at, id`,
    [ticketId],
  );
/** その人の受け箱の行（inapp）のうち、期限・優先度・親を担当者以外が変えたときの知らせの数（自分で変えたら 0・K-440） */
export const sortNotesOf = async (memberId: string, ticketId: string): Promise<number> =>
  (
    await admin<{ n: number }>(
      `select count(*)::int as n from notifications
        where member_id = $1 and channel_id = 'inapp' and event_kind_id = 'ticket.sort_changed'
          and payload->>'ticket_id' = $2 and deleted_at is null`,
      [memberId, ticketId],
    )
  )[0]!.n;

// ---------------------------------------------------------------- 作る面（K-442・K-569・K-450・K-444・K-443）
export const makeBtn = (page: Page): Locator =>
  page.locator("header.k-page-head").getByRole("button", { name: "作る", exact: true });
export const bodyBox = (page: Page): Locator => page.getByRole("textbox", { name: "本文", exact: true });
/** 項目の表：作る面は group「項目」、詳細は右のパネル（K-1153 の形・aside「チケットのパネル」） */
export const itemsGrid = (page: Page): Locator =>
  page
    .getByRole("group", { name: "項目", exact: true })
    .or(page.getByRole("complementary", { name: "チケットのパネル", exact: true }));
/** 項目の表の行（名前の字で始まる組）。名前の列は読み上げから外れているので字で探す */
export const pairOf = (page: Page, name: string): Locator =>
  page
    .locator(".k-f4d-pair")
    .filter({ has: page.locator(".k-f4d-name", { hasText: new RegExp(`^${esc(name)}`) }) })
    // 詳細の右のパネルの行（K-1153：dt が名前の .k-detail-field）
    .or(page.locator(".k-detail-field").filter({ has: page.locator("dt", { hasText: new RegExp(`^${esc(name)}$`) }) }));
/** 左のメニューの「チケットを作る」で作る面を開く。本文の部品が出るまで待つ */
export async function openCreateFromMenu(page: Page): Promise<void> {
  await page.goto("/tickets");
  await page
    .getByRole("navigation", { name: "メニュー", exact: true })
    .getByRole("button", { name: "チケットを作る", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "チケットを作る", exact: true })).toBeVisible();
  await expect(bodyBox(page)).toBeVisible();
}
/** 本文に字を書く：薄い説明の節（ひな形）があれば最初のそこへ、無ければ先頭へ打つ（変換は通さない） */
export async function writeBody(page: Page, text: string): Promise<void> {
  const box = bodyBox(page);
  const ghost = box.locator('p[data-ghost="true"]').first();
  if ((await ghost.count()) > 0) await ghost.click();
  else await box.click();
  await page.keyboard.type(text);
}
/** 期限：日付の欄に直に打つ（D-150.53） */
export const typeDue = (page: Page, day: string): Promise<void> =>
  page.getByRole("textbox", { name: "期限", exact: true }).fill(day);
/** 期限：欄の右の「期限の早見」→ 小窓の「すぐ決める」の名前（来週の月曜など）→「〜にする」 */
export async function quickDue(page: Page, quick: string): Promise<void> {
  await page.getByRole("button", { name: "期限の早見", exact: true }).click();
  const dlg = page.getByRole("dialog", { name: "期限を決める", exact: true });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: new RegExp(`^${esc(quick)}`) }).click();
  await dlg.getByRole("button", { name: /にする$/ }).click();
  await expect(dlg).toHaveCount(0);
}
/** 題名・担当者（本人）・期限（3 日後）を入れる。本文・項目・確認項目は呼ぶ側が書く */
export async function fillRequired(page: Page, me: Newcomer, title: string, dueDay = jstDay(3)): Promise<void> {
  await page.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  await page.getByRole("combobox", { name: "担当者", exact: true }).click();
  await page.getByRole("option", { name: me.name, exact: true }).click();
  await typeDue(page, dueDay);
}
/** 作る面の項目の表で、文字の項目に値を入れる */
export const fillText = (page: Page, name: string, value: string): Promise<void> =>
  page.getByRole("textbox", { name, exact: true }).fill(value);
/** 確認項目：「＋ 確認項目を足す」→ 小窓に文 →「足す」（作る面でも詳細でも同じ入口・口は呼ばれるか呼ばれないか＝呼ぶ側が見る） */
export async function addSpec(page: Page, text: string): Promise<void> {
  await page.getByRole("button", { name: "＋ 確認項目を足す", exact: true }).click();
  const d = page.getByRole("dialog", { name: "確認項目を足す", exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("textbox").fill(text);
  await d.getByRole("button", { name: /足す$/ }).click();
  await expect(d).toHaveCount(0);
}
/** 「作る」を押す。作る口が 201 を答え、詳細へ移るまで待つ。できたチケットの id を返す */
export async function submitCreate(page: Page, title: string): Promise<string> {
  const made = answered(page, "POST", CREATE_TICKET_RE);
  await makeBtn(page).click();
  expect((await made).status(), "作る口が受ける").toBe(201);
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
  return idOfPage(page);
}
export interface CreateOpts {
  body?: string;
  /** 会社の文字の項目 → 値 */
  texts?: Record<string, string>;
  specs?: string[];
  /** 担当者・期限の後、本文を書く前に呼ぶ（親・優先度を決める） */
  extra?: (page: Page) => Promise<void>;
  /** 期限の早見の名前（既定は直に打つ） */
  quick?: string;
}
/** 開いている作る面に書いて「作る」を押す（作る面は開いてあること）。できたチケットの id を返す */
export async function fillAndCreate(page: Page, me: Newcomer, title: string, o: CreateOpts = {}): Promise<string> {
  await page.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  await page.getByRole("combobox", { name: "担当者", exact: true }).click();
  await page.getByRole("option", { name: me.name, exact: true }).click();
  if (o.quick) await quickDue(page, o.quick);
  else await typeDue(page, jstDay(3));
  if (o.extra) await o.extra(page);
  if (o.body) await writeBody(page, o.body);
  for (const [name, v] of Object.entries(o.texts ?? {})) await fillText(page, name, v);
  for (const s of o.specs ?? []) await addSpec(page, s);
  return submitCreate(page, title);
}
export async function createOnScreen(page: Page, me: Newcomer, title: string, o: CreateOpts = {}): Promise<string> {
  await openCreateFromMenu(page);
  return fillAndCreate(page, me, title, o);
}

// ---------------------------------------------------------------- 詳細の本文を直す（K-447・K-571）
export const readBody = (page: Page): Locator => page.locator(".k-detail-doc");
export const enterBtn = (page: Page): Locator => page.getByRole("button", { name: "本文を直す", exact: true });
export const finishBtn = (page: Page): Locator => page.getByRole("button", { name: "書き終える", exact: true });
export const cancelBtn = (page: Page): Locator => page.getByRole("button", { name: "やめる", exact: true });
/** 先に直されたときの帯の題：409 の直後も開き直した後も、名前なしの固定（K-447・D-150.13） */
export const BAND_TITLE = "ほかの人が先に直しました";
export const conflictBand = (page: Page): Locator => page.getByRole("alert").filter({ hasText: BAND_TITLE });
/** 「本文を直す」を押し、編集の部品が出るまで待つ */
export async function startEdit(page: Page): Promise<void> {
  await enterBtn(page).click();
  await expect(bodyBox(page)).toBeVisible();
}
/** 本文の最後に字を足す（変換は通さず、打った字をそのまま入れる） */
export async function typeAtEnd(page: Page, text: string): Promise<void> {
  await bodyBox(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(text);
}
/** 書き終える。口 updateTicketBody の答えの番号を返す */
export async function finishBody(page: Page): Promise<number> {
  const res = answered(page, "PATCH", BODY_RE);
  await finishBtn(page).click();
  return (await res).status();
}
/** 詳細で本文に字を足して書き終える（口の答えの番号を返し、編集の形が閉じるまで待つ） */
export async function appendAndFinish(page: Page, text: string): Promise<number> {
  await startEdit(page);
  await typeAtEnd(page, text);
  const status = await finishBody(page);
  await expect(bodyBox(page)).toHaveCount(0);
  return status;
}

// ---------------------------------------------------------------- 会社の項目を詳細で直す（K-569・K-564）
export const editBtn = (page: Page, name: string): Locator =>
  itemsGrid(page).getByRole("button", { name: `${name}を直す`, exact: true });
/** 値の字を押して入力に替え、字を入れて Enter で決める（文字・数・日付）。口 updateTicket の答えの番号を返す */
export async function editItem(page: Page, name: string, text: string): Promise<number> {
  await editBtn(page, name).click();
  const input = itemsGrid(page).getByLabel(name, { exact: true });
  await input.fill(text);
  const res = answered(page, "PATCH", UPDATE_TICKET_RE);
  await input.press("Enter");
  return (await res).status();
}

// ---------------------------------------------------------------- 確認項目（詳細・K-450・K-435）
export const specsBlock = (page: Page): Locator => page.getByRole("group", { name: "確認項目の欄", exact: true });
export const specBox = (page: Page, title: string): Locator =>
  specsBlock(page).getByRole("checkbox", { name: title, exact: true });
export const specTextBtn = (page: Page, title: string): Locator =>
  specsBlock(page).getByRole("button", { name: `${title}を直す`, exact: true });
/** 詳細の確認項目の「開く」を押す（開いたときだけ読む）。行が出るまで待つ */
export async function openSpecs(page: Page, first: string): Promise<void> {
  await specsBlock(page).getByRole("button", { name: "開く", exact: true }).click();
  await expect(specBox(page, first)).toBeVisible();
}
/** 詳細で確認項目を足す。口 createTestSpec の答えの番号を返す */
export async function addSpecOnDetail(page: Page, text: string): Promise<number> {
  const res = answered(page, "POST", SPEC_ADD_RE);
  await addSpec(page, text);
  return (await res).status();
}
/** 箱を押してチェックを付ける（外す）。口 updateTestSpec の答えの番号を返す */
export async function toggleSpec(page: Page, title: string): Promise<number> {
  const res = answered(page, "PATCH", SPEC_ROW_RE);
  await specBox(page, title).click();
  return (await res).status();
}

// ---------------------------------------------------------------- 版と差分の頁（K-449）
export const versionsUrl = (ticketId: string): string => `/tickets/${ticketId}/versions`;
export const verList = (page: Page): Locator =>
  page.getByRole("complementary", { name: "版の一覧", exact: true }).locator("ol li");
export const diffList = (page: Page): Locator => page.getByRole("list", { name: "差分", exact: true });
export const restoreBtn = (page: Page, n: number): Locator =>
  page.getByRole("button", { name: `本文を版 ${n} に戻す`, exact: true });
/** 詳細の題の行の「版と差分」から頁へ移る（頁の見出しが出るまで待つ） */
export async function goVersionsFromDetail(page: Page, ticketId: string): Promise<void> {
  await page
    .locator("header.k-page-head")
    .getByRole("button", { name: "版と差分", exact: true })
    .or(page.locator("header.k-page-head").getByRole("link", { name: "版と差分", exact: true }))
    .click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}/versions$`));
  await expect(page.getByRole("heading", { level: 1, name: "版と差分", exact: true })).toBeVisible();
}
/** 頁で「本文を版 n に戻す」を押す（確かめの小窓は挟まない）。口 restoreTicketVersion の答えの番号を返す */
export async function restoreBody(page: Page, n: number): Promise<number> {
  const res = answered(page, "POST", RESTORE_RE);
  await restoreBtn(page, n).click();
  return (await res).status();
}

// ---------------------------------------------------------------- やり取りのタブ（段 7 の部品・K-574）
export const panel = (page: Page): Locator => page.getByRole("complementary", { name: "チケットのパネル" });
export const talkTab = (page: Page): Locator =>
  panel(page)
    .getByRole("navigation", { name: "パネルのタブ" })
    .getByRole("button", { name: /^やり取り/ });
export const itemsTab = (page: Page): Locator =>
  panel(page).getByRole("navigation", { name: "パネルのタブ" }).getByRole("button", { name: /^項目/ });
/** 「やり取り」のタブを開く（更新の行は `.k-talk-line`） */
export async function openTalk(page: Page): Promise<Locator> {
  await talkTab(page).click();
  await expect(talkTab(page)).toHaveAttribute("aria-current", "page");
  const lines = panel(page).locator(".k-talk-line");
  await expect(lines.first()).toBeVisible();
  return lines;
}

// ---------------------------------------------------------------- 完了・AI に任せる（F5・K-572・K-573）
export const completeBtn = (page: Page): Locator => page.getByRole("button", { name: "完了にする", exact: true });
export const completeDialog = (page: Page): Locator => page.getByRole("dialog", { name: "完了にする", exact: true });
export const execBand = (page: Page): Locator => page.getByRole("region", { name: "承認と実行" });
export const aiBand = (page: Page): Locator => page.getByRole("region", { name: "AI に任せる" });
export const delegateBtn = (page: Page): Locator => page.getByRole("button", { name: "AI に任せる", exact: true });
export const reasonBox = (page: Page): Locator =>
  page.getByRole("dialog").getByRole("textbox", { name: "確認項目を使わない理由", exact: true });
export const reasonGo = (page: Page): Locator =>
  page.getByRole("dialog").getByRole("button", { name: "理由を書いて任せる", exact: true });

// ---------------------------------------------------------------- 複製（K-446）
export const dupDialog = (page: Page): Locator => page.getByRole("dialog", { name: "複製する", exact: true });
export const dupCheck = (page: Page, name: string): Locator =>
  dupDialog(page).getByRole("checkbox", { name, exact: true });
/** 写すものの名前（小窓の字・K-446） */
export const COPY_LABELS = [
  "本文",
  "担当者・承認する人",
  "項目（期限・優先度・会社の項目）",
  "確認項目",
  "つながり",
] as const;
export interface DupResult {
  status: number;
  id: string;
}
/** 小窓「複製する」が開いている上で、題名を直して（外すチェックを外して）「複製して開く」。口 createTicket の答えと、移った先の id を返す */
export async function submitDuplicate(page: Page, title: string, uncheck: string[] = []): Promise<DupResult> {
  const d = dupDialog(page);
  await d.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  for (const n of uncheck) await dupCheck(page, n).uncheck();
  const made = answered(page, "POST", CREATE_TICKET_RE);
  await d.getByRole("button", { name: "複製して開く", exact: true }).click();
  const status = (await made).status();
  await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
  return { status, id: idOfPage(page) };
}
/** 開いている詳細の「複製」→ 小窓 → 複製して開く */
export async function duplicateOnDetail(page: Page, title: string, uncheck: string[] = []): Promise<DupResult> {
  await page.getByRole("button", { name: "複製", exact: true }).click();
  await expect(dupDialog(page)).toBeVisible();
  return submitDuplicate(page, title, uncheck);
}

// ---------------------------------------------------------------- 親・つながり（K-443・K-452）
export const PARENT_ENTRY = "親チケットを決める";
export const parentDialog = (page: Page): Locator => page.getByRole("dialog", { name: PARENT_ENTRY, exact: true });
/** 項目の表（作る面でも詳細でも）の「親」の行 */
export const parentRow = (page: Page): Locator => pairOf(page, "親");
/** 親の札（作る面は 2 か所に同じ物が出るので first を使う） */
export const parentChip = (page: Page): Locator => page.getByRole("button", { name: /^親：/ });
/** 開いている小窓「親チケットを決める」で、探して title の候補を選ぶ（「親にする」は押さない） */
export async function searchAndPickParent(page: Page, search: string, title: string): Promise<Locator> {
  const d = parentDialog(page);
  await expect(d).toBeVisible();
  await d.getByRole("textbox", { name: "番号か題名で探す", exact: true }).fill(search);
  const item = d.getByRole("radio", { name: new RegExp(esc(title)) });
  await item.click();
  return item;
}
/** 作る面：入口を押し、探して選び「親にする」。札が出るまで待つ */
export async function pickParentOnCreate(page: Page, search: string, title: string): Promise<void> {
  await page.getByRole("button", { name: PARENT_ENTRY, exact: true }).first().click();
  await searchAndPickParent(page, search, title);
  await parentDialog(page).getByRole("button", { name: "親にする", exact: true }).click();
  await expect(parentDialog(page)).toHaveCount(0);
  await expect(parentChip(page).first()).toContainText(title);
}
/** 詳細：パネルの入口（または今の親の札）を押し、探して選び「親にする」。口 updateTicket の答えの番号を返す */
export async function setParentOnDetail(page: Page, entry: Locator, search: string, title: string): Promise<number> {
  await entry.click();
  await searchAndPickParent(page, search, title);
  const res = answered(page, "PATCH", UPDATE_TICKET_RE);
  await parentDialog(page).getByRole("button", { name: "親にする", exact: true }).click();
  return (await res).status();
}
export const linkCard = (page: Page): Locator =>
  page.getByRole("region", { name: "子チケット・つながり", exact: true });
export const linkDialog = (page: Page): Locator => page.getByRole("dialog", { name: "つながりを足す", exact: true });
/** 詳細のカードを開く（閉じた形が既定で、「開く」で口を 1 回読む・K-452）。見出しが出るまで待つ */
export async function showLinks(page: Page): Promise<void> {
  await expect(linkCard(page)).toBeVisible();
  await linkCard(page).scrollIntoViewIfNeeded();
  const open = linkCard(page).getByRole("button", { name: "開く", exact: true });
  if (await open.isVisible()) await open.click();
  await expect(linkCard(page).getByRole("heading", { level: 3, name: /^つながり \d+$/ })).toBeVisible();
}
export const linkRow = (page: Page, text: string | RegExp): Locator =>
  linkCard(page).getByRole("listitem").filter({ hasText: text });
export const unlinkButton = (page: Page, number: string): Locator =>
  linkCard(page).getByRole("button", { name: `${number} とのつながりを外す`, exact: true });
/** 「つながりを足す」→ 種類 → 探して選ぶ（「つなぐ」は押さない）。小窓を返す */
export async function openLinkDialog(
  page: Page,
  kind: "関連" | "派生元",
  search: string,
  number: string,
): Promise<Locator> {
  await linkCard(page).getByRole("button", { name: "つながりを足す", exact: true }).click();
  const d = linkDialog(page);
  await expect(d).toBeVisible();
  await d.getByRole("radio", { name: new RegExp(`^${kind}`) }).check();
  await d.getByLabel("チケットを探す", { exact: true }).fill(search);
  await d
    .getByRole("list", { name: "候補", exact: true })
    .getByRole("button")
    .filter({ hasText: numRe(number) })
    .click();
  return d;
}
/** 小窓の「つなぐ」。口の答えを返す */
export async function submitLink(page: Page, d: Locator): Promise<Response> {
  const res = answered(page, "POST", LINK_ADD_RE);
  await d.getByRole("button", { name: "つなぐ", exact: true }).click();
  return res;
}
