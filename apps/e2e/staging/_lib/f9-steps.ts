// 統合テスト（staging）の段 10 の画面の 1 歩（K-716）：ナレッジ（木・ページを書く・書き終える・必ず守る・写して直す・見直すページ）・AI に任せる側の画面
//   （PC をつなぐ・任せる・承認・確認項目・完了が止まる小窓）・チケットの設定（種別・状態・項目）・作る面（種別を選ぶ・項目の欄）・メンバー（グループの行）と、口を読み直す道具。
//   操作と選び方は各画面の葉（K-682〜K-684・K-691・K-693・K-696・K-702・K-703・K-707〜K-710・K-720）の仕様の表と下絵 v2（/dev/mock/f9）から。
//   実装から書かない。staging の最初の回で名前が違えば、直すのはこの道具（試験は変えない）。写しを置いた訳は steps.ts と同じ
//   （画面の試験の道具 apps/web/tests/_lib は DB・手元の受け箱・送り元の付け替えを前提にする。staging では DB を読まない・K-65 の PM の決め 2）。
//   環境の値は読まない（住所と鍵は site.ts と resend.ts だけが読む）。ここは進むための 1 歩だけを持ち、行の期待結果の確かめは試験に書く。
//   グループを作る道は無い（段 11・K-70）ので、この道具は会社の棚と自分の棚だけを扱う（グループの棚・上げる・共有は staging では作れない：K716-STG-05）
import { expect, type Locator, type Page, type Response } from "@playwright/test";
import type { StagingPc } from "./bridge";
import { completeNow, showSpecs, specBox, startDoing, toggleSpec } from "./f4-steps";
import { codeOnScreen, h1, liveOn, openConnect, pathOf, readAs, type Person } from "./steps";

export { completeNow, showSpecs, specBox, startDoing, toggleSpec };

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const apiPath = (url: string): string => new URL(url).pathname;
const answered = (page: Page, method: string, re: RegExp): Promise<Response> =>
  page.waitForResponse((r) => r.request().method() === method && re.test(apiPath(r.url())));

// 口の道（契約・08_api/endpoints.json の形）
export const PAGE_CREATE_RE = /^\/api\/v1\/knowledge_pages$/;
export const DRAFT_RE = /^\/api\/v1\/knowledge_pages\/[^/]+\/draft$/;
export const PUBLISH_RE = /^\/api\/v1\/knowledge_pages\/[^/]+\/publish$/;
export const MUST_RE = /^\/api\/v1\/knowledge_pages\/[^/]+\/must$/;
export const COPY_RE = /^\/api\/v1\/knowledge_pages\/[^/]+\/copy$/;
const KIND_ADD_RE = /^\/api\/v1\/ticket_kinds$/;
const KIND_EDIT_RE = /^\/api\/v1\/ticket_kinds\/[^/]+$/;
const STAGE_ADD_RE = /^\/api\/v1\/ticket_stages$/;
const STAGE_EDIT_RE = /^\/api\/v1\/ticket_stages\/[^/]+$/;
const FIELD_ADD_RE = /^\/api\/v1\/ticket-fields$/;
const TICKET_CREATE_RE = /^\/api\/v1\/tickets$/;
const jst = (days: number): string => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- 口を読み直す（同じブラウザから・GET だけ）
export interface TreeAnswer {
  company_name: string;
  company_nodes: { kind: string; id: string; title?: string; name?: string; must?: boolean; mark?: string | null }[];
  groups: unknown[];
  my_nodes: { kind: string; id: string; title?: string; must?: boolean; mark?: string | null }[];
  can_write: { company: boolean; group_ids: string[]; me: boolean };
  admin_counts: { approvals: number; review: number } | null;
  truncated: boolean;
}
export interface PageAnswer {
  id: string;
  title: string;
  desc: string;
  state: string;
  must: boolean;
  acts: string[];
  place: { shelf: string };
  body: { doc: unknown; text: string } | null;
  copied_from: { title: string; shelf_name: string; must: boolean; gone: boolean } | null;
  foot: unknown;
}
export async function treeOf(page: Page): Promise<{ status: number; tree: TreeAnswer | null }> {
  const r = await readAs(page, "/knowledge/tree");
  return { status: r.status, tree: (r.data as TreeAnswer | null) ?? null };
}
export async function pageOf(
  page: Page,
  id: string,
): Promise<{ status: number; page: PageAnswer | null; code: string | null }> {
  const r = await readAs(page, `/knowledge_pages/${id}`);
  return { status: r.status, page: (r.data as PageAnswer | null) ?? null, code: r.code };
}
export interface ReviewAnswer {
  unused: { id: string; title: string }[];
  conflicts: unknown[];
  broken: { id: string; title: string; count: number; how: string }[];
}
export async function reviewOf(page: Page): Promise<{ status: number; review: ReviewAnswer | null }> {
  const r = await readAs(page, "/knowledge/review");
  return { status: r.status, review: (r.data as ReviewAnswer | null) ?? null };
}
export interface SpecRow {
  id: string;
  title: string;
  checked: boolean;
  source: string;
  source_page: { id: string; title: string } | null;
}
/** 口の読み直し：確認項目（出どころと、ナレッジの行のページ）。ナレッジから入った行だけ source_page を持つ */
export async function specRowsOf(page: Page, ticketId: string): Promise<SpecRow[]> {
  const r = await readAs(page, `/tickets/${ticketId}/test-specs`);
  expect(r.status, "確認項目の読み直し").toBe(200);
  return (r.data as SpecRow[] | null) ?? [];
}
/** 口の読み直し：やり取り（段 7 の読む口）の変更の行の field の並び（guard_list・knowledge_open・knowledge_breach） */
export async function threadFieldsOf(
  page: Page,
  ticketId: string,
): Promise<{ field: string; from: string | null; to: string | null }[]> {
  const r = await readAs(page, `/tickets/${ticketId}/timeline`);
  expect(r.status, "やり取りの読み直し").toBe(200);
  const items =
    (r.data as { changes?: { field?: string; from?: string | null; to?: string | null }[] | null }[] | null) ?? [];
  return items
    .flatMap((it) => it.changes ?? [])
    .map((c) => ({ field: c.field ?? "", from: c.from ?? null, to: c.to ?? null }));
}
/** 口の読み直し：種別の一覧（名前・色の鍵・ひな形の有無・会社の項目の名前の並び） */
export async function kindsOf(
  page: Page,
): Promise<{ id: string; name: string; color_key: string | null; hasTemplate: boolean; fields: string[] }[]> {
  const r = await readAs(page, "/ticket_kinds");
  expect(r.status, "種別の読み直し").toBe(200);
  const rows =
    (r.data as
      | { id: string; name: string; color_key?: string | null; body_template?: unknown; fields?: { name?: string }[] }[]
      | null) ?? [];
  return rows.map((k) => ({
    id: k.id,
    name: k.name,
    color_key: k.color_key ?? null,
    hasTemplate: k.body_template !== null && k.body_template !== undefined,
    fields: (k.fields ?? []).map((f) => f.name ?? ""),
  }));
}
/** 口の読み直し：状態の一覧（名前・色の鍵・鍵） */
export async function stagesOf(
  page: Page,
): Promise<{ id: string; key: string; name: string; color_key: string | null }[]> {
  const r = await readAs(page, "/ticket_stages");
  expect(r.status, "状態の読み直し").toBe(200);
  const rows = (r.data as { id: string; key: string; name: string; color_key?: string | null }[] | null) ?? [];
  return rows.map((s) => ({ id: s.id, key: s.key, name: s.name, color_key: s.color_key ?? null }));
}
/** 口の読み直し：チケットの詳細（段の名前・会社の項目の値の名前と値） */
export async function ticketOf(
  page: Page,
  id: string,
): Promise<{ status: number; stage: string | null; completed: boolean; fields: { name: string; value: unknown }[] }> {
  const r = await readAs(page, `/tickets/${id}`);
  const d = (r.data ?? {}) as {
    stage?: { name?: string } | null;
    completed_at?: string | null;
    fields?: { name?: string; value?: unknown }[] | null;
  };
  return {
    status: r.status,
    stage: d.stage?.name ?? null,
    completed: Boolean(d.completed_at),
    fields: (d.fields ?? []).map((f) => ({ name: f.name ?? "", value: f.value ?? null })),
  };
}

// ---------------------------------------------------------------- ナレッジ：木・ページを書く・書き終える（K-682〜K-684・K-691）
export const shelfOf = (page: Page, shelf: "会社の棚" | "自分の棚"): Locator =>
  page.getByRole("region", { name: shelf, exact: true });
export async function openKnowledge(page: Page): Promise<void> {
  expect((await page.goto("/knowledge"))?.status(), "ナレッジの画面が開ける").toBe(200);
  await expect(page.getByRole("complementary", { name: "ナレッジの木", exact: true })).toBeVisible();
}
export async function openPage(page: Page, id: string, title: string): Promise<void> {
  expect((await page.goto(`/knowledge/${id}`))?.status(), "ページが開ける").toBe(200);
  await expect(h1(page, title)).toBeVisible();
}
/** 棚の「＋」→ 小窓「ページかフォルダを足す」で題名を入れて「書き始める」。作る口の答えの番号と、移った先の id を返す */
export async function startPage(
  page: Page,
  shelf: "会社の棚" | "自分の棚",
  title: string,
): Promise<{ status: number; id: string }> {
  await shelfOf(page, shelf)
    .getByRole("button", { name: /の棚にページかフォルダを足す$/ })
    .click();
  const d = page.getByRole("dialog", { name: "ページかフォルダを足す", exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  const made = answered(page, "POST", PAGE_CREATE_RE);
  await d.getByRole("button", { name: "書き始める", exact: true }).click();
  const status = (await made).status();
  await expect.poll(() => pathOf(page), "書き始めたら、そのページの画面へ移る").toMatch(/^\/knowledge\/[0-9a-f-]{36}$/);
  return { status, id: pathOf(page).split("/").pop()! };
}
const editorOf = (page: Page): Locator => page.getByRole("textbox", { name: "本文", exact: true });
/** 書いている画面で本文の終わりに字を足す（打ち終えて約 0.8 秒後の自動保存の答えまで待つ） */
export async function typeBody(page: Page, text: string): Promise<number> {
  await expect(editorOf(page)).toBeVisible();
  await editorOf(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  const saved = answered(page, "PATCH", DRAFT_RE);
  await page.keyboard.type(text);
  return (await saved).status();
}
/** 書いている画面で 1 行の説明を入れる（自動保存の答えまで待つ） */
export async function fillDesc(page: Page, desc: string): Promise<number> {
  const saved = answered(page, "PATCH", DRAFT_RE);
  await page.getByRole("textbox", { name: "1 行の説明", exact: true }).fill(desc);
  return (await saved).status();
}
/** 「書き終える」。似たページの小窓が出たら中の題名を返し、「このまま作る」で進める。公開の口の答えの番号を返す */
export async function finishPage(page: Page): Promise<{ status: number; similar: string[] }> {
  const published = answered(page, "POST", PUBLISH_RE).catch(() => null);
  const dialog = page.getByRole("dialog", { name: "似たページがあります", exact: true });
  await page.getByRole("button", { name: "書き終える", exact: true }).click();
  const first = await Promise.race([
    published.then(() => "published" as const),
    dialog
      .waitFor({ state: "visible" })
      .then(() => "similar" as const)
      .catch(() => null),
  ]);
  let similar: string[] = [];
  if (first === "similar") {
    similar = (
      await dialog.getByRole("list", { name: "似たページ", exact: true }).getByRole("listitem").allInnerTexts()
    ).map((t) => t.trim());
    await dialog.getByRole("button", { name: "このまま作る", exact: true }).click();
  }
  const res = await published;
  if (!res) throw new Error("公開の口の答えが来ない");
  await expect(page.getByRole("button", { name: "直す", exact: true }), "読む形に戻り「直す」が出る").toBeVisible();
  return { status: res.status(), similar };
}
/** 「直す」を押す（書いている画面に入る） */
export async function startEdit(page: Page): Promise<void> {
  await page.getByRole("button", { name: "直す", exact: true }).click();
  await expect(editorOf(page)).toBeVisible();
}
/** ページを新しく作って書き終える（題名・1 行の説明・本文）。ページの id と、書き終えるの結果を返す */
export async function writeAndPublish(
  page: Page,
  shelf: "会社の棚" | "自分の棚",
  p: { title: string; desc: string; text: string },
): Promise<{ id: string; created: number; saved: number; published: { status: number; similar: string[] } }> {
  const made = await startPage(page, shelf, p.title);
  await fillDesc(page, p.desc);
  const saved = await typeBody(page, p.text);
  const published = await finishPage(page);
  return { id: made.id, created: made.status, saved, published };
}
/** 「必ず守る」のつまみを押す。口の答えの番号を返す。押した後のつまみの押し込みが期待どおりになるまで待つ */
export async function toggleMust(page: Page, on: boolean): Promise<number> {
  const toggle = page.getByRole("button", { name: "必ず守る", exact: true });
  const res = answered(page, "PUT", MUST_RE);
  await toggle.click();
  const status = (await res).status();
  await expect(toggle).toHaveAttribute("aria-pressed", on ? "true" : "false");
  return status;
}
/** 読むだけの人の「写して直す」。写す口の答えの番号と、移った写しの id を返す */
export async function copyToMine(page: Page): Promise<{ status: number; id: string }> {
  const res = answered(page, "POST", COPY_RE);
  await page.getByRole("button", { name: "写して直す", exact: true }).click();
  const status = (await res).status();
  await expect.poll(() => pathOf(page), "写したら、写しのページへ移る").toMatch(/^\/knowledge\/[0-9a-f-]{36}$/);
  return { status, id: pathOf(page).split("/").pop()! };
}
/** 管理：見直すページ（道は /knowledge?view=admin&list=review） */
export async function openReview(page: Page): Promise<void> {
  expect((await page.goto("/knowledge?view=admin&list=review"))?.status(), "見直すページが開ける").toBe(200);
  await expect(h1(page, "見直すページ")).toBeVisible();
}

// ---------------------------------------------------------------- AI に任せる側（K-62・K-63・K-699・K-701・K-702・K-703）
/** PC をつなぐ（画面のコードを組み立てた Bridge が引き取り、輪を回す）→ 輪の最初の知らせで画面が「つながっています」に変わる → チケットの画面へ戻る */
export async function connectPc(page: Page, pc: StagingPc, firstViewMs: number): Promise<void> {
  expect(await openConnect(page), "PC をつなぐの画面が開く（200）").toBe(200);
  expect(await pc.claim(await codeOnScreen(page)), "画面に出たコードを、組み立てた Bridge の引き取りが通す").toEqual({
    ok: true,
    message: null,
  });
  pc.startLoop();
  await expect(liveOn(page), "輪の最初の知らせで、画面が自分で「つながっています」に変わる").toContainText(pc.label, {
    timeout: firstViewMs,
  });
  await page.getByRole("link", { name: "戻る" }).click();
  await expect.poll(() => pathOf(page), "開いた画面（チケットの画面）へ戻る").toBe("/tickets");
}
/** 作る面（左のメニューの「チケットを作る」）で、題名・担当者（自分）・期限だけ決めて作る → 詳細へ。できたチケットの id を返す。本文は書かない */
export async function createPlainTicket(page: Page, me: Person, title: string): Promise<string> {
  await fillCreateBasics(page, title, me.name);
  const made = answered(page, "POST", TICKET_CREATE_RE);
  await page.getByRole("button", { name: "作る", exact: true }).click();
  expect((await made).status(), "作る口が受ける").toBe(201);
  await expect.poll(() => pathOf(page), "作ったら詳細へ移る").toMatch(/^\/tickets\/[0-9a-f-]{36}$/);
  await expect(h1(page, title)).toBeVisible();
  return pathOf(page).split("/").pop()!;
}
/** 作る面を開き、題名・担当者・期限を入れる（「作る」は押さない） */
export async function fillCreateBasics(page: Page, title: string, assignee: string): Promise<void> {
  await page.goto("/tickets?new=1");
  await page.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  await page.getByRole("combobox", { name: "担当者", exact: true }).click();
  await page.getByRole("option", { name: assignee, exact: true }).click();
  await page.getByRole("textbox", { name: "期限", exact: true }).fill(jst(3));
}
/** 作る面の種別を選ぶ（選ぶ形が一覧でも、昔からの select でも通る） */
export async function chooseKind(page: Page, name: string): Promise<void> {
  const kind = page.getByRole("combobox", { name: "種別", exact: true });
  if ((await kind.evaluate((el) => el.tagName)) === "SELECT") {
    await kind.selectOption({ label: name });
    return;
  }
  await kind.click();
  await page.getByRole("option", { name, exact: true }).click();
}
/** 右のパネルの「やり取り」を開く（もう開いていれば何もしない） */
export async function showThread(page: Page): Promise<void> {
  const tab = page.getByRole("tab", { name: "やり取り", exact: true });
  if ((await tab.count()) > 0 && (await tab.first().getAttribute("aria-selected")) !== "true")
    await tab.first().click();
}
/** 完了の止め：小窓「まだ完了にできません」（K-703） */
export const blockedDialog = (page: Page): Locator =>
  page.getByRole("dialog", { name: "まだ完了にできません", exact: true });

// ---------------------------------------------------------------- チケットの設定（K-707〜K-709・K-720）
export type SettingsTab = "kinds" | "stages" | "fields";
export async function openSettings(page: Page, tab: SettingsTab): Promise<void> {
  expect((await page.goto(`/workspace/ticket-settings?tab=${tab}`))?.status(), "チケットの設定が開ける").toBe(200);
  await expect(h1(page, "チケットの設定")).toBeVisible();
}
/** 種別を足す（名前と色）。足す口の答えの番号を返す */
export async function addKind(page: Page, name: string, color: string): Promise<number> {
  await page.getByRole("button", { name: "種別を足す", exact: true }).click();
  const d = page.getByRole("dialog", { name: "種別を足す", exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("textbox", { name: "名前", exact: true }).fill(name);
  await d.getByRole("radio", { name: color, exact: true }).check({ force: true });
  const res = answered(page, "POST", KIND_ADD_RE);
  await d.getByRole("button", { name: "足す", exact: true }).click();
  const status = (await res).status();
  await expect(d).toHaveCount(0);
  return status;
}
/** 種別の一覧から種別を選び、本文のひな形に字を足して保存する。直す口の答えの番号を返す */
export async function writeTemplate(page: Page, kind: string, text: string): Promise<number> {
  await page
    .getByRole("list", { name: "種別", exact: true })
    .getByRole("link", { name: new RegExp(esc(kind)) })
    .click();
  const form = page.getByRole("form", { name: `種別「${kind}」を直す`, exact: true });
  await expect(form).toBeVisible();
  const editor = form.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.type(text);
  const res = answered(page, "PATCH", KIND_EDIT_RE);
  await form.getByRole("button", { name: "保存する", exact: true }).click();
  return (await res).status();
}
/** 状態の行の「…を直す」で名前を替えて保存する。直す口の答えの番号を返す */
export async function renameStage(page: Page, from: string, to: string): Promise<number> {
  await page.getByRole("button", { name: `${from}を直す`, exact: true }).click();
  const name = page.getByRole("textbox", { name: "名前", exact: true });
  await name.fill(to);
  const res = answered(page, "PATCH", STAGE_EDIT_RE);
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  return (await res).status();
}
/** 状態を足す（名前だけ。色は既定）。足す口の答えの番号を返す */
export async function addStage(page: Page, name: string): Promise<number> {
  await page.getByRole("button", { name: "状態を足す", exact: true }).click();
  const d = page.getByRole("dialog", { name: "状態を足す", exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("textbox", { name: "名前", exact: true }).fill(name);
  const res = answered(page, "POST", STAGE_ADD_RE);
  await d.getByRole("button", { name: "足す", exact: true }).click();
  const status = (await res).status();
  await expect(d).toHaveCount(0);
  return status;
}
/** 項目を足す（1 行の型・必須・出す種別は 1 つだけ）。足す口の答えの番号を返す */
export async function addField(page: Page, name: string, onlyKind: string): Promise<number> {
  await page.getByRole("button", { name: "項目を足す", exact: true }).first().click();
  const d = page.getByRole("dialog", { name: "項目を足す", exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("textbox", { name: "名前", exact: true }).fill(name);
  await d.getByRole("checkbox", { name: /^必須にする/ }).check();
  const kinds = d.getByRole("group", { name: "どの種別で出すか", exact: true });
  for (const box of await kinds.getByRole("checkbox").all()) await box.uncheck();
  await kinds.getByRole("checkbox", { name: onlyKind, exact: true }).check();
  const res = answered(page, "POST", FIELD_ADD_RE);
  await d.getByRole("button", { name: "足す", exact: true }).click();
  const status = (await res).status();
  await expect(d).toHaveCount(0);
  return status;
}
/** 作る面の項目の欄（名前で探す） */
export const fieldInput = (page: Page, name: string): Locator =>
  page.getByRole("textbox", { name: new RegExp(`^${esc(name)}`) });

// ---------------------------------------------------------------- メンバー（K-710）
/** グループの行（押すとその中のメンバーが出る）。aria-expanded を持つ */
export const groupRow = (page: Page): Locator => page.locator("button.k-f9m-head");
export async function openMembers(page: Page): Promise<void> {
  expect((await page.goto("/members"))?.status(), "メンバーの画面が開ける").toBe(200);
  await expect(h1(page, "メンバー")).toBeVisible();
}
