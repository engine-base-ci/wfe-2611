// 統合テスト（staging）の段 5 の画面の 1 歩（K-456）：本文を直す（K-447）・確認項目を足す／チェックする（K-450）・複製（K-446）・親（K-443）・つながり（K-452）・
//   版と差分の頁で戻す（K-449）・完了にする（K-572）と、口を読み直す道具。操作と選び方は中間テスト（apps/web/tests/skeleton の k454・k455 と _lib/f4-flow.ts）と同じ
//   （写しを置いた訳は steps.ts と同じ：あちらは DB・手元の受け箱・送り元の付け替えを前提にする。staging では DB を読まない・PM の決め 2）。
//   環境の値は読まない（住所と鍵は site.ts と resend.ts だけが読む）。ここは進むための 1 歩だけを持ち、行の期待結果の確かめは試験に書く。
//   画面の名前は K-442〜K-452・K-571・K-572 の md と、その画面の試験（apps/web/tests/k/k4NN-*.spec.ts・k57N-*.spec.ts）から（実装から書かない）。staging の最初の回で違えば、ここを直す
import { expect, type Locator, type Page, type Response } from "@playwright/test";
import { API } from "./site";
import { h1, readAs } from "./steps";

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const apiPath = (url: string): string => new URL(url).pathname;
const answered = (page: Page, method: string, re: RegExp): Promise<Response> =>
  page.waitForResponse((r) => r.request().method() === method && re.test(apiPath(r.url())));
const UPDATE_RE = /^\/api\/v1\/tickets\/[^/]+$/;
const BODY_RE = /^\/api\/v1\/tickets\/[^/]+\/body$/;
const SPEC_ADD_RE = /^\/api\/v1\/tickets\/[^/]+\/test-specs$/;
const SPEC_ROW_RE = /^\/api\/v1\/test_specs\/[^/]+$/;
const RESTORE_RE = /^\/api\/v1\/tickets\/[^/]+\/versions\/\d+\/restore$/;
const LINK_RE = /^\/api\/v1\/tickets\/[^/]+\/links$/;
const CREATE_RE = /^\/api\/v1\/tickets$/;
const COMPLETE_RE = /^\/api\/v1\/tickets\/[^/]+\/complete$/;

export const openTicket = async (page: Page, id: string, title: string): Promise<void> => {
  expect((await page.goto(`/tickets/${id}`))?.status()).toBe(200);
  await expect(h1(page, title)).toBeVisible();
};
const idOf = (page: Page): string => new URL(page.url()).pathname.split("/").pop()!;

// ---------------------------------------------------------------- 口を読み直す（同じブラウザから・GET だけ）
/** 口の読み直し：本文の今の版と素の字（本文の行がまだ無ければ版 0・空） */
export async function bodyOf(page: Page, ticketId: string): Promise<{ version: number; text: string }> {
  const r = await readAs(page, `/tickets/${ticketId}`);
  expect(r.status, "詳細の読み直し").toBe(200);
  const b = (r.data as { body?: { version?: number; text?: string } } | null)?.body;
  return { version: b?.version ?? 0, text: b?.text ?? "" };
}
interface SpecRead {
  title: string;
  checked: boolean;
}
/** 口の読み直し：確認項目（古い順）の文とチェックの有無 */
export async function specsRead(page: Page, ticketId: string): Promise<SpecRead[]> {
  const r = await readAs(page, `/tickets/${ticketId}/test-specs`);
  expect(r.status, "確認項目の読み直し").toBe(200);
  return ((r.data as SpecRead[] | null) ?? []).map((x) => ({ title: x.title, checked: x.checked }));
}
/** 口の読み直し：つながりの種類の並び */
export async function linkKinds(page: Page, ticketId: string): Promise<string[]> {
  const r = await readAs(page, `/tickets/${ticketId}/links`);
  expect(r.status, "つながりの読み直し").toBe(200);
  return ((r.data as { kind: string }[] | null) ?? []).map((x) => x.kind);
}
/** 口の読み直し：親の id（無ければ null）と段の鍵 */
export async function stateOf(
  page: Page,
  ticketId: string,
): Promise<{ parent: string | null; stage: string | null; completed: boolean }> {
  const r = await readAs(page, `/tickets/${ticketId}`);
  expect(r.status, "詳細の読み直し").toBe(200);
  const d = (r.data ?? {}) as {
    parent?: { id?: string } | null;
    stage?: { key?: string } | null;
    completed_at?: string | null;
  };
  return { parent: d.parent?.id ?? null, stage: d.stage?.key ?? null, completed: Boolean(d.completed_at) };
}
/** 段を作業中にする（口 updateTicket の段の組・段 7）。人が作業中にする画面は段 7 の物なので、この通しは同じ口を同じブラウザから呼ぶ。口の答えの番号を返す */
export async function startDoing(page: Page, ticketId: string): Promise<number> {
  return page.evaluate(
    async ([url]) => {
      const token = window.localStorage.getItem("kaname.token") ?? "";
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "idempotency-key": `k456-${Math.random().toString(36).slice(2)}`,
        },
        body: JSON.stringify({ stage_key: "doing" }),
      });
      return res.status;
    },
    [`${API}/api/v1/tickets/${ticketId}`] as const,
  );
}

// ---------------------------------------------------------------- 詳細の本文を直す（K-447）
export const readBody = (page: Page): Locator => page.locator(".k-detail-doc");
const editor = (page: Page): Locator => page.getByRole("textbox", { name: "本文", exact: true });
/** 「本文を直す」→ 字を足す → 「書き終える」。口 updateTicketBody の答えの番号を返す。編集の形が閉じるまで待つ */
export async function appendAndFinish(page: Page, text: string): Promise<number> {
  await page.getByRole("button", { name: "本文を直す", exact: true }).click();
  await expect(editor(page)).toBeVisible();
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(text);
  const res = answered(page, "PATCH", BODY_RE);
  await page.getByRole("button", { name: "書き終える", exact: true }).click();
  const status = (await res).status();
  await expect(editor(page)).toHaveCount(0);
  return status;
}

// ---------------------------------------------------------------- 確認項目（K-450・K-435）
const specsBlock = (page: Page): Locator => page.getByRole("group", { name: "確認項目の欄", exact: true });
export const specBox = (page: Page, title: string): Locator =>
  specsBlock(page).getByRole("checkbox", { name: title, exact: true });
/** 詳細の確認項目を開く（「開く」が在るときだけ押す）。確認項目を足す入口が出るまで待つ */
export async function showSpecs(page: Page): Promise<void> {
  await expect(specsBlock(page)).toBeVisible();
  const open = specsBlock(page).getByRole("button", { name: "開く", exact: true });
  if ((await open.count()) > 0) await open.click();
  await expect(specsBlock(page).getByRole("button", { name: "＋ 確認項目を足す", exact: true })).toBeVisible();
}
/** 「＋ 確認項目を足す」→ 確認項目を足す小窓に文 → 足す。口 createTestSpec の答えの番号を返す */
export async function addSpec(page: Page, title: string): Promise<number> {
  await specsBlock(page).getByRole("button", { name: "＋ 確認項目を足す", exact: true }).click();
  const d = page.getByRole("dialog", { name: "確認項目を足す", exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("textbox").fill(title);
  const res = answered(page, "POST", SPEC_ADD_RE);
  await d.getByRole("button", { name: /足す$/ }).click();
  const status = (await res).status();
  await expect(d).toHaveCount(0);
  return status;
}
/** 箱を押してチェックを付ける（外す）。口 updateTestSpec の答えの番号を返す */
export async function toggleSpec(page: Page, title: string): Promise<number> {
  const res = answered(page, "PATCH", SPEC_ROW_RE);
  await specBox(page, title).click();
  return (await res).status();
}

// ---------------------------------------------------------------- 版と差分の頁（K-449）
/** 詳細の題の行の「版と差分」から頁へ移る（頁の見出しが出るまで待つ）。頁の道は /tickets/<id>/versions */
export async function goVersions(page: Page, ticketId: string): Promise<void> {
  const head = page.locator("header.k-page-head");
  await head
    .getByRole("button", { name: "版と差分", exact: true })
    .or(head.getByRole("link", { name: "版と差分", exact: true }))
    .click();
  await expect.poll(() => new URL(page.url()).pathname, "版と差分の頁へ移る").toBe(`/tickets/${ticketId}/versions`);
  await expect(h1(page, "版と差分")).toBeVisible();
}
/** 頁で「本文を版 n に戻す」を押す（確かめの小窓は挟まない）。口 restoreTicketVersion の答えの番号を返す */
export async function restoreBody(page: Page, n: number): Promise<number> {
  const res = answered(page, "POST", RESTORE_RE);
  await page.getByRole("button", { name: `本文を版 ${n} に戻す`, exact: true }).click();
  return (await res).status();
}

// ---------------------------------------------------------------- 完了にする（K-572）
/** 「完了にする」を押す（未チェックが無い形で呼ぶ：小窓は出ない）。口の答えの番号を返す */
export async function completeNow(page: Page): Promise<number> {
  const res = answered(page, "POST", COMPLETE_RE);
  await page.getByRole("button", { name: "完了にする", exact: true }).click();
  return (await res).status();
}
export const execBand = (page: Page): Locator => page.getByRole("region", { name: "承認と実行" });

// ---------------------------------------------------------------- 複製（K-446）
/** 開いている詳細の「複製」→ 小窓で題名を直す → 複製して開く。口（作る口）の答えの番号と、移った先の id を返す */
export async function duplicateOnDetail(page: Page, title: string): Promise<{ status: number; id: string }> {
  await page.getByRole("button", { name: "複製", exact: true }).click();
  const d = page.getByRole("dialog", { name: "複製する", exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("textbox", { name: "題名", exact: true }).fill(title);
  const made = answered(page, "POST", CREATE_RE);
  await d.getByRole("button", { name: "複製して開く", exact: true }).click();
  const status = (await made).status();
  await expect(h1(page, title)).toBeVisible();
  return { status, id: idOf(page) };
}

// ---------------------------------------------------------------- 親（K-443）
const PARENT_ENTRY = "親チケットを決める";
/** 項目の表の「親」の行（名前の字で探す） */
export const parentRow = (page: Page): Locator =>
  page.locator(".k-f4d-pair").filter({ has: page.locator(".k-f4d-name", { hasText: /^親/ }) });
export const parentChip = (page: Page): Locator => page.getByRole("button", { name: /^親：/ });
/** 詳細：項目の表の「親チケットを決める」→ 探して選び「親にする」。口 updateTicket の答えの番号を返す */
export async function setParentOnDetail(page: Page, search: string, title: string): Promise<number> {
  await parentRow(page).getByRole("button", { name: PARENT_ENTRY, exact: true }).click();
  const d = page.getByRole("dialog", { name: PARENT_ENTRY, exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("textbox", { name: "番号か題名で探す", exact: true }).fill(search);
  await d.getByRole("radio", { name: new RegExp(esc(title)) }).click();
  const res = answered(page, "PATCH", UPDATE_RE);
  await d.getByRole("button", { name: "親にする", exact: true }).click();
  return (await res).status();
}
/** 親の小窓を開いて探し、候補に title が出るかを数える（「親にする」は押さない）。小窓（閉じる前）と候補を返す */
export async function parentCandidates(
  page: Page,
  search: string,
  title: string,
): Promise<{ dialog: Locator; hits: Locator }> {
  await parentRow(page).getByRole("button", { name: PARENT_ENTRY, exact: true }).click();
  const d = page.getByRole("dialog", { name: PARENT_ENTRY, exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("textbox", { name: "番号か題名で探す", exact: true }).fill(search);
  return { dialog: d, hits: d.getByRole("radio", { name: new RegExp(esc(title)) }) };
}
// ---------------------------------------------------------------- つながり・子（K-452）
export const linkCard = (page: Page): Locator => page.getByRole("region", { name: "子チケット・つながり" });
/** カードを画面に入れる（見えたとき 1 回読む）。見出しが出るまで待つ */
export async function showLinks(page: Page): Promise<void> {
  await expect(linkCard(page)).toBeVisible();
  await linkCard(page).scrollIntoViewIfNeeded();
  await expect(linkCard(page).getByRole("heading", { level: 3, name: /^つながり \d+$/ })).toBeVisible();
}
export const linkRow = (page: Page, text: string): Locator =>
  linkCard(page).getByRole("listitem").filter({ hasText: text });
/** 「つながりを足す」→ 種類 → 探して題名で選ぶ（「つなぐ」は押さない）。小窓を返す */
export async function openLinkDialog(
  page: Page,
  kind: "関連" | "派生元",
  search: string,
  title: string,
): Promise<Locator> {
  await linkCard(page).getByRole("button", { name: "つながりを足す", exact: true }).click();
  const d = page.getByRole("dialog", { name: "つながりを足す", exact: true });
  await expect(d).toBeVisible();
  await d.getByRole("radio", { name: new RegExp(`^${kind}`) }).check();
  await d.getByLabel("チケットを探す", { exact: true }).fill(search);
  await d.getByRole("list", { name: "候補", exact: true }).getByRole("button").filter({ hasText: title }).click();
  return d;
}
/** 小窓の「つなぐ」。口の答えの番号を返す */
export async function submitLink(page: Page, d: Locator): Promise<number> {
  const res = answered(page, "POST", LINK_RE);
  await d.getByRole("button", { name: "つなぐ", exact: true }).click();
  return (await res).status();
}
/** 候補の小窓（つながり）を開いて探し、候補の行を返す（「つなぐ」は押さない） */
export async function linkCandidates(page: Page, search: string): Promise<{ dialog: Locator; items: Locator }> {
  await linkCard(page).getByRole("button", { name: "つながりを足す", exact: true }).click();
  const d = page.getByRole("dialog", { name: "つながりを足す", exact: true });
  await expect(d).toBeVisible();
  await d.getByLabel("チケットを探す", { exact: true }).fill(search);
  return { dialog: d, items: d.getByRole("list", { name: "候補", exact: true }).getByRole("button") };
}
