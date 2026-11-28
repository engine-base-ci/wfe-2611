// 段 6 の画面の葉（K-734・K-735・K-740・K-743・K-745・K-747・K-749・K-751 ほか）の試験の道具（K-730 が持つ・葉は読むだけで書き換えない）。
//   前からの土台 tests/features/F5/approve-complete.harness.ts の mockApi の上に、葉の口だけを網の手前で重ねる（後から足した網が先に当たり、
//   当たらない要求は route.fallback() で土台へ落ちる）。口の答えの文は正本 07_qa/test-specs/errors.json から引く（画面で文を作らない）。
//   固定の待ちは使わない（書く口の答えは hold() で止め、返した関数で答える）。本人の Bridge（127.0.0.1:38617）には届かせない
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { API_RE, RUN_ID, TICKET, type Reply } from "../features/F5/approve-complete.harness";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
export const WIDTHS = [375, 768, 1440] as const;
export { RUN_ID, TICKET };
export const TARGET = "EG-133 11 月分の請求書を送る";

const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
/** 正本（errors.json）の文。無ければ字で分かる印（試験が赤になる） */
export const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;
/** 口の断りの答え（{ error, code }） */
export const refuse = (status: number, code: string, error = "conflict"): Reply => ({ status, body: { error, code } });
export const NOT_FOUND = refuse(404, "NOT_FOUND", "not_found");
export const DOWN = refuse(503, "E-PAGE-003", "unavailable");
export const TOO_MANY = refuse(429, "E-RATE-001", "rate_limited");

/** 日本時間の「MM/DD HH:MM」（帯の下の 1 行・止めた時刻） */
export const jstStamp = (iso: string): string => {
  const d = new Date(Date.parse(iso) + 9 * 3600_000).toISOString();
  return `${d.slice(5, 7)}/${d.slice(8, 10)} ${d.slice(11, 16)}`;
};
export const STOPPED_AT = "2026-11-01T01:40:00.000Z"; // 日本時間 11/01 10:40

export type Layer = (req: Request, path: string) => Reply | null | Promise<Reply | null>;
export interface Writes {
  /** 書く口（POST・PATCH・PUT・DELETE）の道と体（飛んだ順） */
  all: { method: string; path: string; body: unknown }[];
  of: (re: RegExp) => { path: string; body: unknown }[];
  /** 書く口の答えを止める。返した関数を呼ぶと答える */
  hold: () => () => void;
  /** 次の書く口の答えを順に差し替える（積まれていれば layer の fn を走らせずにその答え・空なら fn の答え） */
  next: Reply[];
  /** 問い合わせの数（GET の道ごと・頭が同じ物） */
  reads: (prefix: string) => number;
}

/**
 * 葉の口を重ねる。layer が null を返した要求は土台（mockApi）へ落とす。書く口は全部 Writes に控え、hold の間は答えない。
 * 本人の Bridge も止める。mockApi を呼んだ後に呼ぶ
 */
export async function layer(page: Page, fn: Layer): Promise<Writes> {
  const all: Writes["all"] = [];
  const gets: string[] = [];
  let gate: Promise<void> = Promise.resolve();
  const w: Writes = {
    all,
    of: (re) => all.filter((x) => re.test(x.path)),
    hold: () => {
      let open = () => {};
      gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    next: [],
    reads: (prefix) => gets.filter((p) => p.startsWith(prefix)).length,
  };
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(API_RE, async (route: Route, req: Request) => {
    const path = new URL(req.url()).pathname;
    const write = req.method() !== "GET";
    if (!write) gets.push(path);
    if (write) {
      all.push({ method: req.method(), path, body: req.postData() ? req.postDataJSON() : null });
      await gate;
      // 差し替えの答え（断る回）が積まれていれば、葉の偽の口（fn）を走らせずにそれで答える（断った回に状態を書き換えない）
      const forced = w.next.shift();
      if (forced) {
        await route.fulfill({
          status: forced.status,
          contentType: "application/json",
          body: JSON.stringify(forced.body),
        });
        return;
      }
    }
    const r = await fn(req, path);
    if (r === null) return route.fallback();
    const reply = r;
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return w;
}

/** 帯の上の知らせ（K-730 の TicketNotice・NoticeBox tone warn） */
export const noticeOf = (page: Page) => page.locator('.k-band-notice[data-tone="warn"]');
/** 帯の下の 1 行（K-730 の TicketTrail） */
export const trailOf = (page: Page) => page.locator(".k-more-trail");
/** 小窓（components/k の Dialog・役 dialog）。確かめの小窓（Confirm）は confirmOf */
export const dialogOf = (page: Page) => page.getByRole("dialog");
/** 確かめの小窓（components/k の Confirm＝@base-ui の AlertDialog・役 alertdialog） */
export const confirmOf = (page: Page) => page.getByRole("alertdialog");
/** スマホ（375）の下から出す小窓の下の余白（more.css の .k-more-sheetmark の決まり・var(--k-s-md)） */
export const SHEET_GAP = 16;
export const overflowX = (page: Page) =>
  page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
export const noOverflow = async (page: Page, w: number) => expect(await overflowX(page), `幅 ${w} の横溢れ`).toBe(0);

const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "font-weight", "color", "line-height"];
/** 帯の箱と小窓と帯の下の 1 行の突き合わせ（字の中身は番号・名前・時刻が違うので比べない） */
export const BAND_PAIRS: FidelityPair[] = [
  pair("band", ".k-band", ["width", "background-color", "border-top-color", "border-top-left-radius", "padding-top"]),
  pair("band-title", ".k-band h3", TXT),
  pair("band-sub", ".k-band-sub", TXT),
  pair("band-acts", ".k-band-acts .k-btn", ["height", "font-size", "color", "background-color", "border-top-color"]),
  pair("trail", ".k-more-trail", TXT),
];
export const DIALOG_PAIRS: FidelityPair[] = [
  pair("dialog", ".k-dialog", ["width", "background-color", "border-top-left-radius"]),
  pair("dialog-title", ".k-dialog-title", [...TXT, "texts"]),
  pair("dialog-acts", ".k-dialog-actions .k-btn", [
    "height",
    "font-size",
    "color",
    "background-color",
    "border-top-color",
    "texts",
  ]),
];

/** 作る段・承認の後の実行の 1 件（getActionRun・listTicketRuns の行） */
export const runRow = (o: Record<string, unknown> = {}) => ({
  id: RUN_ID,
  ticket_id: TICKET,
  phase: "make",
  status: "running",
  by: { member_id: "11111111-0000-4000-8000-000000000002", display_name: "山田" },
  pc: "live",
  silent: false,
  last_event_at: null,
  progress: null,
  stopped_reason: null,
  return_reason: null,
  started_at: new Date(Date.now() - 180_000).toISOString(),
  finished_at: null,
  checks: { state: "none" },
  ...o,
});
/** 実行の一覧と 1 件を同じ実行で答える layer の部品（run が null なら土台へ落とす） */
export const runReplies =
  (run: () => Record<string, unknown> | null) =>
  (path: string): Reply | null => {
    const r = run();
    if (!r) return null;
    if (path === `/api/v1/tickets/${TICKET}/runs`) return { status: 200, body: { data: [r], meta: { limit: 50 } } };
    if (/^\/api\/v1\/action_runs\/[^/]+$/.test(path)) return { status: 200, body: { data: r } };
    return null;
  };
