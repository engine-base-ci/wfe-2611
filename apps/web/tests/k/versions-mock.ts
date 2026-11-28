// 「版と差分」の頁（/tickets/:id/versions・K-449）の試験の道具（K-449 が持つ）。
//   外枠・詳細の読み込みは前からの土台 tests/features/F5/approve-complete.harness.ts の mockApi（getTicket・自分の情報など）。
//   その上に、口の葉 K-433 の 3 本だけを網の手前で差し替える。答えの形は 11_tickets/K-433.md の「実施事項」と同じ：
//     GET  /api/v1/tickets/:id/versions?from=&to=
//       → 200 { data: { versions: [{ version, edited_by: { id, name } | null, edited_by_ai, edited_at, is_current, restored_from, summary }（新しい順）],
//                       from: { version, text } | null, to: { version, text } | null }, meta: { limit, truncated, can_restore } }
//       from・to を省くと to は今の版・from はその 1 つ前（版が 1 つだけなら from は null）。無い版は 404・E-PAGE-001
//       meta.can_restore は書ける人か（listTestSpecs の meta.can_edit と同じ形・K-433 に頼んだ足し）
//     POST /api/v1/tickets/:id/versions/:v/restore ← { current_version }（頭 Idempotency-Key）
//       → 201 { data: { version, changed, edited_at } }／409 E-SEC-004（先に直された）・E-SEC-005（完了後）・E-SEC-020（もう同じ中身）／403／404／503
//     GET  /api/v1/tickets/:id/item-changes?from=&to=
//       → 200 { data: { points: [{ n, at, by: { id, name } | null, by_ai, summary }（新しい順）], from: n | null, to: n,
//                       diff: [{ field, name, from, to, restorable, why }] }, meta: { limit, truncated } }
//   getTicket は mockApi の答えに、完了（completed）を足すだけ。本人の Bridge（127.0.0.1:38617）にも届かせない（mockApi が網の手前で止める）。
//   固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page, type Request, type Route } from "@playwright/test";
import {
  API_RE,
  TICKET,
  mockApi,
  ticketOf,
  withBand,
  type Band,
  type Mock,
  type Reply,
} from "../features/F5/approve-complete.harness";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
export const WIDTHS = [375, 768, 1440] as const;
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
/** 正本（errors.json）の文。画面で文を作らない */
export const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;
export const NUMBER = "EG-133";
export const TITLE = "11 月分の請求書を送る";
export const ME_ID = "11111111-0000-4000-8000-000000000001";
export const MATE_ID = "11111111-0000-4000-8000-000000000002";
export { TICKET };

// ---------------------------------------------------------------- 本文の版
export interface VerRow {
  version: number;
  text: string;
  /** 直した人の名前（人が直した版）。AI が直した版は null で ai が true */
  by: string | null;
  ai?: boolean;
  /** ISO の時刻（日本時間 11/21 09:40 は 2026-11-21T00:40:00Z） */
  at: string;
  restoredFrom?: number | null;
  /** 口の答えの summary（渡さなければ 作成／版 N に戻した／本文を直した） */
  summary?: string;
}
export const L1 = "目的：セイコー商事に 11 月分の請求を間違いなく届ける";
export const L2 = "完了の条件：請求書が送られ、宛先が登録した連絡先と合っている";
export const L3 = "完了の条件：支払期日が 12/15 になっている";
export const L4_OLD = "☐ 請求書を作る";
export const L4_NEW = "☐ 請求書を作って佐藤さんに確かめてもらう";
export const L5 = "表：保守費用（11 月分）1 × 80,000 円 ／ 追加対応 2 × 15,000 円";
export const L6 = "画像：先月の請求書の見本.png";
/** 版 2 → 版 3 の差分が下絵（/dev/mock/f4v2/f4v2-versions）と同じ数になる 3 つの本文（同じ 1・削除 1・追加 5） */
export const V1 = `目的：11 月分の請求を送る\n${L4_OLD}`;
export const V2 = `${L1}\n${L4_OLD}`;
export const V3 = `${L1}\n${L2}\n${L3}\n${L4_NEW}\n${L5}\n${L6}`;
/** 日本時間 11/21 09:40・10:05・10:42 の 3 つの版（版 1 は高本・版 2 は鈴木・版 3 は高本） */
export const DEFAULT_ROWS = (): VerRow[] => [
  { version: 1, text: V1, by: "高本", at: "2026-11-21T00:40:00Z" },
  { version: 2, text: V2, by: "鈴木", at: "2026-11-21T01:05:00Z" },
  { version: 3, text: V3, by: "高本", at: "2026-11-21T01:42:00Z" },
];

// ---------------------------------------------------------------- 項目の変更
export interface DiffRow {
  field: string;
  name: string;
  from: string | null;
  to: string | null;
  restorable: boolean;
  why: string | null;
}
export interface PointRow {
  n: number;
  at: string;
  by: string | null;
  ai?: boolean;
  summary: string;
}
/** 日本時間 09:40 作成（高本）・10:05 予定時間を変えた（鈴木）・10:42 期限・担当者・支払期日を変えた（高本） */
export const DEFAULT_POINTS = (): PointRow[] => [
  { n: 1, at: "2026-11-21T00:40:00Z", by: "高本", summary: "作成" },
  { n: 2, at: "2026-11-21T01:05:00Z", by: "鈴木", summary: "予定時間を変えた" },
  { n: 3, at: "2026-11-21T01:42:00Z", by: "高本", summary: "期限・担当者・支払期日を変えた" },
];
const WHY_ASSIGNEE = "担当者は「渡す」の流れで変えます";
const DUE: DiffRow = {
  field: "due_on",
  name: "期限",
  from: "11/27（金）",
  to: "12/01（火）",
  restorable: true,
  why: null,
};
const ASSIGNEE: DiffRow = {
  field: "assignee",
  name: "担当者",
  from: "鈴木 一郎",
  to: "高本 聖斗",
  restorable: false,
  why: WHY_ASSIGNEE,
};
const PAY: DiffRow = {
  field: "field:6f000000-0000-4000-8000-000000000001",
  name: "支払期日",
  from: null,
  to: "12/15（火）",
  restorable: true,
  why: null,
};
const EST: DiffRow = {
  field: "estimate_minutes",
  name: "予定時間",
  from: null,
  to: "2 時間",
  restorable: true,
  why: null,
};
/** 比べる 2 つの点の正味の変わり（鍵は「元-先」）。口は変わった項目だけを返す（変わらない項目の「同じ行」は無い） */
export const DEFAULT_DIFFS = (): Record<string, DiffRow[]> => ({
  "2-3": [DUE, ASSIGNEE, PAY],
  "1-2": [EST],
  "1-3": [EST, DUE, ASSIGNEE, PAY],
});

export interface RestoreCall {
  v: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}
export interface VersionsMock {
  api: Mock;
  rows: VerRow[];
  points: PointRow[];
  diffs: Record<string, DiffRow[]>;
  /** meta.can_restore（書ける人か） */
  canRestore: boolean;
  /** getTicket に completed を入れるか（完了したチケット） */
  completed: boolean;
  /** 版の一覧の口に飛んだ要求の query（飛んだ順） */
  lists: URLSearchParams[];
  /** 項目の変更の口に飛んだ要求の query */
  itemLists: URLSearchParams[];
  restores: RestoreCall[];
  ticketReads: number;
  /** 書く口以外で「書く」要求（POST・PATCH・PUT・DELETE）が飛んだ数（restore を除く） */
  otherWrites: string[];
  /** 次の答えを順に差し替える（null・無くなった後は既定） */
  nextList: (Reply | null)[];
  nextItems: (Reply | null)[];
  next: (Reply | null)[];
  /** 次の戻すを何回、網ごと切るか */
  abort: number;
  /** 戻すを処理する前に呼ぶ（n 回目）。別の人の直しを割り込ませる */
  before: ((n: number, m: VersionsMock) => void) | null;
  /** 戻す口の答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
  hold: () => () => void;
  gate: Promise<void>;
}

const err = (status: number, error: string, code: string, message?: string): Reply => ({
  status,
  body: { error, code, ...(message ? { message } : {}) },
});
export const conflict = (code: string): Reply => err(409, "conflict", code, msg(code));
/** 先に直されたときの文（D-150.13・口の文そのまま。画面は口の message を出す） */
export const CONFLICT_TEXT = "高本さんが先に直しました。読み直してから、もう一度直してください";
export const conflictBody = (): Reply => err(409, "conflict", "E-SEC-004", CONFLICT_TEXT);
export const notFound = (code: "E-PAGE-001" | "NOT_FOUND" = "E-PAGE-001"): Reply => err(404, "not_found", code);
export const forbidden = (): Reply => err(403, "forbidden", "FORBIDDEN");
export const failed = (): Reply => err(503, "server_error", "E-PAGE-003");

const currentOf = (m: VersionsMock): VerRow => [...m.rows].sort((a, b) => b.version - a.version)[0]!;
const who = (r: VerRow): { id: string; name: string } | null => (r.by === null ? null : { id: ME_ID, name: r.by });
const summaryOf = (r: VerRow): string =>
  r.summary ?? (r.version === 1 ? "作成" : r.restoredFrom ? `版 ${r.restoredFrom} に戻した` : "本文を直した");
/** 道の問い合わせの番号（1 以上の整数の字だけ。違う形は null） */
const pick = (raw: string | null): number | null | "bad" =>
  raw === null ? null : /^[1-9][0-9]{0,8}$/.test(raw) ? Number(raw) : "bad";

function listReply(m: VersionsMock, q: URLSearchParams): Reply {
  const cur = currentOf(m);
  const rawTo = pick(q.get("to"));
  const rawFrom = pick(q.get("from"));
  if (rawTo === "bad" || rawFrom === "bad") return notFound();
  const to = rawTo ?? cur.version;
  const from = rawFrom ?? (to > 1 ? to - 1 : null);
  const find = (n: number | null): VerRow | null => (n === null ? null : (m.rows.find((r) => r.version === n) ?? null));
  if (find(to) === null || (from !== null && find(from) === null)) return notFound();
  const sorted = [...m.rows].sort((a, b) => b.version - a.version);
  return {
    status: 200,
    body: {
      data: {
        versions: sorted.map((r) => ({
          version: r.version,
          edited_by: who(r),
          edited_by_ai: r.ai === true,
          edited_at: r.at,
          is_current: r.version === cur.version,
          restored_from: r.restoredFrom ?? null,
          summary: summaryOf(r),
        })),
        from: from === null ? null : { version: from, text: find(from)!.text },
        to: { version: to, text: find(to)!.text },
      },
      meta: { limit: 200, truncated: false, can_restore: m.canRestore },
    },
  };
}

function itemsReply(m: VersionsMock, q: URLSearchParams): Reply {
  const top = Math.max(...m.points.map((p) => p.n));
  const rawTo = pick(q.get("to"));
  const rawFrom = pick(q.get("from"));
  if (rawTo === "bad" || rawFrom === "bad") return notFound();
  const to = rawTo ?? top;
  const from = rawFrom ?? (to > 1 ? to - 1 : null);
  const has = (n: number | null): boolean => n === null || m.points.some((p) => p.n === n);
  if (!has(to) || !has(from)) return notFound();
  const sorted = [...m.points].sort((a, b) => b.n - a.n);
  return {
    status: 200,
    body: {
      data: {
        points: sorted.map((p) => ({
          n: p.n,
          at: p.at,
          by: p.by === null ? null : { id: ME_ID, name: p.by },
          by_ai: p.ai === true,
          summary: p.summary,
        })),
        from,
        to,
        diff: from === null ? [] : (m.diffs[`${from}-${to}`] ?? []),
      },
      meta: { limit: 200, truncated: false },
    },
  };
}

function restoreReply(m: VersionsMock, v: string, b: Record<string, unknown>): Reply {
  const cur = currentOf(m);
  const target = pick(v) === "bad" ? undefined : m.rows.find((r) => String(r.version) === v);
  if (!target) return notFound();
  if (m.completed) return conflict("E-SEC-005");
  if (b["current_version"] !== cur.version) return conflictBody();
  if (target.text === cur.text) return conflict("E-SEC-020");
  const made: VerRow = {
    version: cur.version + 1,
    text: target.text,
    by: "高本",
    at: "2026-11-21T02:30:00Z",
    restoredFrom: target.version,
  };
  m.rows.push(made);
  return { status: 201, body: { data: { version: made.version, changed: true, edited_at: made.at } } };
}

export async function mockVersions(
  page: Page,
  o: Partial<Pick<VersionsMock, "rows" | "points" | "diffs" | "canRestore" | "completed">> = {},
): Promise<VersionsMock> {
  const band: Band = { stage: "doing" };
  const api = await mockApi(page, band);
  const m: VersionsMock = {
    api,
    rows: o.rows ?? DEFAULT_ROWS(),
    points: o.points ?? DEFAULT_POINTS(),
    diffs: o.diffs ?? DEFAULT_DIFFS(),
    canRestore: o.canRestore ?? true,
    completed: o.completed ?? false,
    lists: [],
    itemLists: [],
    restores: [],
    ticketReads: 0,
    otherWrites: [],
    nextList: [],
    nextItems: [],
    next: [],
    abort: 0,
    before: null,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      m.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
  };
  api.on.ticket = () => ({
    status: 200,
    body: {
      data: withBand(band, {
        ...(ticketOf(band) as unknown as Record<string, unknown>),
        completed: m.completed ? { at: "2026-11-21T03:00:00Z", by: "高本" } : null,
      }),
    },
  });
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    const fulfill = (r: Reply) =>
      route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    const get = req.method() === "GET";
    if (get && p === `/api/v1/tickets/${TICKET}`) {
      m.ticketReads += 1;
      return route.fallback();
    }
    if (get && p === `/api/v1/tickets/${TICKET}/versions`) {
      m.lists.push(u.searchParams);
      return fulfill(m.nextList.shift() ?? listReply(m, u.searchParams));
    }
    if (get && p === `/api/v1/tickets/${TICKET}/item-changes`) {
      m.itemLists.push(u.searchParams);
      return fulfill(m.nextItems.shift() ?? itemsReply(m, u.searchParams));
    }
    const hit = /^\/api\/v1\/tickets\/[^/]+\/versions\/([^/]+)\/restore$/.exec(p);
    if (hit && req.method() === "POST") {
      const v = decodeURIComponent(hit[1]!);
      const body = req.postDataJSON() as Record<string, unknown>;
      m.restores.push({ v, body, headers: req.headers() });
      const n = m.restores.length;
      await m.gate;
      if (m.abort > 0) {
        m.abort -= 1;
        return route.abort("failed");
      }
      m.before?.(n, m);
      return fulfill(m.next.shift() ?? restoreReply(m, v, body));
    }
    if (!get && !/\/auth\//.test(p)) m.otherWrites.push(`${req.method()} ${p}`);
    return route.fallback();
  });
  return m;
}

// ---------------------------------------------------------------- 画面の道具
export const versionsUrl = (query = ""): string => `/tickets/${TICKET}/versions${query}`;
/** 頁を開き、見出しと版の一覧（または読み込みの終わり）が出るまで待つ */
export async function openVersions(page: Page, query = "", width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  expect((await page.goto(versionsUrl(query)))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "版と差分", exact: true })).toBeVisible();
}
/** 差分が出るまで待ってから使う（「比べる元」の選びが出ている＝読み終わり） */
export const fromBox = (page: Page): Locator => page.getByRole("combobox", { name: "比べる元", exact: true });
export const toBox = (page: Page): Locator => page.getByRole("combobox", { name: "比べる先", exact: true });
export const pickBtn = (page: Page, name: "本文" | "項目の変更"): Locator =>
  page.getByRole("button", { name, exact: true });
export const diffOf = (page: Page): Locator => page.getByRole("list", { name: "差分", exact: true });
export const sideOf = (page: Page): Locator => page.getByRole("complementary", { name: "版の一覧", exact: true });
export const restoreBtn = (page: Page, field: "本文" | "項目の変更", n: number): Locator =>
  page.getByRole("button", { name: `${field}を版 ${n} に戻す`, exact: true });
export const copyBtn = (page: Page): Locator => page.getByRole("button", { name: "この差分をコピー", exact: true });
/** 差分の行を「種類:字」で読む（読み上げの頭「追加：」「削除：」「同じ：」は外す） */
export const lines = (page: Page): Promise<string[]> =>
  diffOf(page)
    .locator("li")
    .evaluateAll((ls) =>
      ls.map(
        (l) => `${l.getAttribute("data-kind")}:${(l.textContent ?? "").replace(/^(追加：|削除：|同じ：)/, "").trim()}`,
      ),
    );
/** 版の一覧の行（「版 3（いま）」から始まる字） */
export const verItems = (page: Page): Locator => sideOf(page).locator("ol li");
export const alertWith = (page: Page, text: string): Locator => page.getByRole("alert").filter({ hasText: text });
export const overflowX = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** 一覧の行の字（版 3（いま）＋小さい字） */
export const verTexts = (page: Page): Promise<string[]> =>
  verItems(page).evaluateAll((ls) => ls.map((l) => (l.textContent ?? "").replace(/\s+/g, " ").trim()));
