// 詳細の本文を直す（K-447）の画面の試験の道具。詳細の読む口は K-571 の道具 detail-body-mock.ts の mockDetail で差し替え、
//   本文を書き終える口 updateTicketBody（PATCH /api/v1/tickets/:id/body・K-432）だけを、その後に足した差し替えで答える（後に足した差し替えが先に効く）。
//   答えの形は 11_tickets/K-432.md の「実施事項」：200 { data: { version, changed, edited_at } }／409 { error, code, message }（field・details なし）。
//   本文の「本物の持ち主」は BodyServer（版と木）。同じ BodyServer を 2 つの画面に付ければ、別のタブで同じ本文を直す動きも作れる。
//   本人の Bridge（127.0.0.1:38617）は届かせない（mockDetail が止める）。固定の待ちは使わない（口の答えは hold() で止め、返した関数を呼ぶと答える）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page, type Request, type Route } from "@playwright/test";
import {
  TID,
  answer,
  doc,
  mockDetail,
  openDetail,
  overflowX,
  P,
  H2,
  type DetailAnswer,
  type DetailMock,
} from "./detail-body-mock";

export { TID, answer, doc, openDetail, overflowX, P, H2 };
export type { DetailMock };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
/** 正本 errors.json の文（無ければ見つからない印の文字列を返し、試験が落ちる） */
export const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;

const API_RE = /\/api\/(v1|auth-ext|auth)\//;
export const WIDTHS = [375, 768, 1440] as const;
/** この PC の書きかけの写しの鍵（K-447.md「前提と制約」・ログアウトとほかの 401 の clearDraftCopies が消す頭 kaname.ticket-draft で始める） */
export const COPY_KEY = `kaname.ticket-draft.body.${TID}`;
/** 下絵 f4v2-detail-editing と同じ「自動で保存しました（10:42）」にそろえる固定の時刻（日本時間 10:42） */
export const SAVED_AT = "2026-11-21T01:42:00Z";
export const SAVED_TEXT = "自動で保存しました（10:42）";
/** 先に直されたの帯（決定 D-150.13・名前なしの固定の字） */
export const BAND_TITLE = "ほかの人が先に直しました";
export const BAND_SUB = "読み直してから、もう一度直してください。";
/** ログインが切れたの赤い帯（前の下絵 f4-edit-session-lost の字） */
export const LOST_TITLE = "ログインが切れました";
export const LOST_SUB = "入り直すと、いま書いている内容は消えます。必要なら、先に別の場所へ写してください。";
export const CONFLICT_TEXT = "先に直されました。読み直してから、もう一度直してください";

/** 本文の見本：見出し「目的」と段落 1 つ（最後が段落なので、末尾に打つと段落に入る） */
export const BASE_DOC = doc(H2("目的"), P("セイコー商事に 11 月分の請求を間違いなく届ける。"));
/** ほかの人が先に直した本文 */
export const OTHER_DOC = doc(H2("目的"), P("セイコー商事に 11 月分の請求を、期日までに届ける。"));

export type Reply = { status: number; body: unknown } | "network";
export const conflict409 = (code: "E-SEC-004" | "E-SEC-005" = "E-SEC-004"): Reply => ({
  status: 409,
  body: { error: "conflict", code, message: code === "E-SEC-004" ? CONFLICT_TEXT : msg("E-SEC-005") },
});
export const fail = (status: number, code: string, error = code.toLowerCase()): Reply => ({
  status,
  body: { error, code },
});

export interface PatchCall {
  version: unknown;
  doc: unknown;
  /** 体の鍵（text が混ざっていないかを見る） */
  keys: string[];
  idempotencyKey: string | undefined;
}
export interface BodyServer {
  /** 本文の今の版（本文の行がまだ無いチケットは 0） */
  version: number;
  doc: unknown;
  /** 飛んできた PATCH（飛んだ順） */
  calls: PatchCall[];
  /** 先に使う台本の答え（無ければ版を合わせて本物のように答える） */
  replies: Reply[];
  /** 答えを止める（返した関数を呼ぶと答える） */
  hold: () => () => void;
  /** ほかの人が先に直した（版が 1 つ進み、中身が替わる） */
  elsewhere: (d?: unknown) => void;
}
export function bodyServer(version = 3, d: unknown = BASE_DOC): BodyServer {
  let gate: Promise<void> | null = null;
  const s: BodyServer & { _gate: () => Promise<void> | null } = {
    version,
    doc: d,
    calls: [],
    replies: [],
    hold: () => {
      let open!: () => void;
      gate = new Promise<void>((r) => (open = r));
      return () => {
        open();
        gate = null;
      };
    },
    elsewhere: (nd = OTHER_DOC) => {
      s.version += 1;
      s.doc = nd;
    },
    _gate: () => gate,
  };
  return s;
}

/** 詳細（K-571 の差し替え）に、本文を書き終える口を足す。server を 2 つの画面に付ければ同じ本文を共有する */
export async function mockBodyEdit(
  page: Page,
  server: BodyServer,
  o: Partial<DetailAnswer> & { status?: number } = {},
): Promise<DetailMock> {
  const m = await mockDetail(page, { ...o });
  const sync = () => {
    (m.a as unknown as { body: unknown }).body =
      server.version === 0 ? undefined : { doc: server.doc, text: "（text は口が作る）", version: server.version };
  };
  sync();
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    if (req.method() === "GET" && p === `/api/v1/tickets/${TID}`) {
      sync();
      return route.fallback();
    }
    if (req.method() !== "PATCH" || p !== `/api/v1/tickets/${TID}/body`) return route.fallback();
    const raw = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
    server.calls.push({
      version: raw.version,
      doc: raw.doc,
      keys: Object.keys(raw).sort(),
      idempotencyKey: req.headers()["idempotency-key"],
    });
    const g = (server as unknown as { _gate: () => Promise<void> | null })._gate();
    if (g) await g;
    const scripted = server.replies.shift();
    if (scripted === "network") return route.abort("failed");
    const reply = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (scripted) return reply(scripted.status, scripted.body);
    if (raw.version !== server.version) {
      const c = conflict409();
      return reply(c === "network" ? 409 : c.status, c === "network" ? {} : c.body);
    }
    if (JSON.stringify(raw.doc) === JSON.stringify(server.doc))
      return reply(200, { data: { version: server.version, changed: false, edited_at: SAVED_AT }, meta: {} });
    server.version += 1;
    server.doc = raw.doc;
    return reply(200, { data: { version: server.version, changed: true, edited_at: SAVED_AT }, meta: {} });
  });
  return m;
}

// ---------------------------------------------------------------- 画面の部品の探し方（名前は 11_tickets/K-447.md の「画面の形」）
export const enterBtn = (page: Page): Locator => page.getByRole("button", { name: "本文を直す", exact: true });
export const editor = (page: Page): Locator => page.getByRole("textbox", { name: "本文", exact: true });
export const finishBtn = (page: Page): Locator => page.getByRole("button", { name: "書き終える", exact: true });
export const cancelBtn = (page: Page): Locator => page.getByRole("button", { name: "やめる", exact: true });
/** 上の帯（自動保存の印の入れ物・role=status） */
export const statusOf = (page: Page): Locator =>
  page.locator(".k-f4d-editband").getByRole("status").or(page.locator('.k-f4d-editband[role="status"]'));
export const frame = (page: Page): Locator => page.locator(".k-f4d-editor");
export const readBody = (page: Page): Locator => page.locator(".k-detail-doc");
export const conflictBand = (page: Page): Locator => page.getByRole("alert").filter({ hasText: BAND_TITLE });
export const lostBand = (page: Page): Locator => page.getByRole("alert").filter({ hasText: LOST_TITLE });
/** 口の失敗の赤い箱（role=alert・帯の題を含まない物） */
export const failBox = (page: Page, text: string): Locator => page.getByRole("alert").filter({ hasText: text });
export const titleActs = (page: Page): Locator => page.locator("header.k-page-head .k-page-acts");

export const copyOf = (page: Page) =>
  page.evaluate((k) => {
    const v = window.localStorage.getItem(k);
    return v === null ? null : (JSON.parse(v) as { savedAt: string; doc: unknown; base: number });
  }, COPY_KEY);

/** 詳細を開き、「本文を直す」を押して、編集の部品が出るまで待つ */
export async function startEdit(page: Page, width = 1440): Promise<void> {
  await openDetail(page, width);
  await enterBtn(page).click();
  await expect(editor(page)).toBeVisible();
}
/** 本文の最後に字を足す（日本語の変換は通さず、打った字をそのまま入れる） */
export async function typeAtEnd(page: Page, text: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(text);
}
/** 書きかけの写しを置けないようにする（鍵の頭 kaname.ticket-draft の書き込みだけ例外を投げる） */
export async function breakCopyStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (String(k).startsWith("kaname.ticket-draft")) throw new DOMException("full", "QuotaExceededError");
      return orig.call(this, k, v);
    };
  });
}
/** 開く前に、この PC の書きかけの写しを置いておく（鍵が無いときだけ置くので、消した後の開き直しで戻らない） */
export async function seedCopy(page: Page, value: unknown): Promise<void> {
  await page.addInitScript(
    ([k, v]) => {
      if (window.localStorage.getItem(k as string) === null) window.localStorage.setItem(k as string, v as string);
    },
    [COPY_KEY, typeof value === "string" ? value : JSON.stringify(value)],
  );
}
