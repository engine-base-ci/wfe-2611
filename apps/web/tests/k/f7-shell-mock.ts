// 段 8 の外枠の葉（K-466 外枠の数・K-467 ベルのお知らせ・K-471 探す欄）の画面の試験が読む、口の差し替えの道具（K-466 が切る段で作り carry で運ぶ・2026-11-20）。
//   土台は前からの tests/k/list-mock.ts（mockList：一覧・承認待ち・me・はじめにやること）か tests/features/F5/approve-complete.harness.ts（mockApi：詳細・承認待ち）。
//   ここはその上に、外枠の口（getShell）・お知らせの口・探すの口を足す。後から足した page.route が先に当たる（外枠の道でなければ route.fallback() で土台へ回す）。
//   口の形は口の葉の md・試験に合わせた。形が変わったらここだけを直す：
//     GET   /api/v1/shell                → { data: Shell }（K-465・shell-answer.ts の shellData）
//     GET   /api/v1/notifications        → { data: Item[], meta: { next_cursor, actors: [{ id, name }] } }（K-461。問い合わせ unread=true・actor_member_id・limit・cursor。
//                                           Item の鍵は 12 個：id・kind・tag・href・ticket_id・number・title・actor {id,name}|null・params・read・read_at・created_at）
//     PATCH /api/v1/notifications/:id    ← { read: boolean } → 200 { data: Item }（K-462。別人・無い行は 404）
//     POST  /api/v1/notifications/read-all ← {} → 200 { data: { read: 動いた行数 } }（K-462）
//     GET   /api/v1/search               → { data: SearchHit[] }（K-468〜K-470。SearchHit は kind・id・title・snippet・url の 5 つ。問い合わせ q・kinds・limit。
//                                           q が空なら data は空。kinds の名前は ticket・decision・conversation・knowledge）
//     失敗は { error, code } の体（文は正本の E-PAGE-007 など）。口に飛んだ要求は calls に "METHOD /path?query" で残す
//   お知らせの params の欄（reply_due・reason ほか）は K-461 の kinds.ts の `PARAM_KEYS`（全体の 11 個の集まり。K-461 の md の「params に通す欄」の表）に合わせた。`due_on` は
//   入れない（期限の変更のお知らせは日付を持たない・P13）。差があればここと画面の文の表（features/F7/notice/notice-text.ts）の 2 か所を直す。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page, Request, Route } from "@playwright/test";
import { shellData, type ShellOpts } from "./shell-answer";

export { ME, SALES, WS, shellData, shellReply, type ShellOpts } from "./shell-answer";

const API_RE = /\/api\/(v1|auth-ext|auth)\//;
export type Reply = { status: number; body: unknown };
export const ok = (data: unknown, meta: Record<string, unknown> = {}, status = 200): Reply => ({
  status,
  body: { data, meta },
});
export const fail = (status: number, code = "INTERNAL"): Reply => ({ status, body: { error: "server_error", code } });

export const SATO = "11111111-0000-4000-8000-000000000003";
export const SUZUKI = "11111111-0000-4000-8000-000000000004";
export const TICKET_A = "0193c5a0-0000-7000-8000-000000000128"; // EG-128
export const TICKET_B = "0193c5a0-0000-7000-8000-000000000119"; // EG-119
export const TICKET_C = "0193c5a0-0000-7000-8000-000000000127"; // EG-127

/** お知らせの種類 → 札（K-461 の kinds.ts の表） */
const TAG: Record<string, string> = {
  "handover.requested": "handover",
  "approval.requested": "approval",
  "ticket.mentioned": "mention",
  "ticket.stopped": "stopped",
  "ticket.due_changed": "write",
  "ticket.message": "write",
  "security.new_device": "setting",
};
const TICKET_KIND = (k: string) => !k.startsWith("security.") && k !== "bridge.connected";
const PEOPLE = { [SATO]: "佐藤 花子", [SUZUKI]: "鈴木 一郎" } as const;

export interface NoticeSeed {
  id: string;
  kind: string;
  actor?: keyof typeof PEOPLE | null;
  ticket?: { id: string; number: string; title: string };
  params?: Record<string, unknown>;
  /** 作られた時刻（ISO） */
  at: string;
  read?: boolean;
  /** 押すと行く道（既定は種類の表のとおり） */
  href?: string | null;
}
const nid = (n: number) => `0193c5a0-0000-7000-8000-00000000${String(n).padStart(4, "0")}`;
export const NOTICE_IDS = Array.from({ length: 60 }, (_, i) => nid(i + 1));

/** お知らせの 1 件（口の答えの形・鍵 12 個） */
export function noticeItem(s: NoticeSeed, readAt: string | null = s.read ? s.at : null) {
  const tag = TAG[s.kind] ?? "write";
  const ticketId = TICKET_KIND(s.kind) ? (s.ticket?.id ?? null) : null;
  return {
    id: s.id,
    kind: s.kind,
    tag,
    href:
      s.href !== undefined
        ? s.href
        : ticketId
          ? `/tickets/${ticketId}`
          : s.kind === "security.new_device"
            ? "/mfa-setup"
            : null,
    ticket_id: ticketId,
    number: s.ticket?.number ?? null,
    title: s.ticket?.title ?? null,
    actor: s.actor ? { id: s.actor, name: PEOPLE[s.actor] } : null,
    params: s.params ?? {},
    read: readAt !== null,
    read_at: readAt,
    created_at: s.at,
  };
}

export interface NoticeMock {
  /** いまの行（読んだ印は PATCH・read-all で変わる） */
  rows: NoticeSeed[];
  readAt: Map<string, string>;
  /** 一覧の問い合わせ（新しい順に残す） */
  lists: URLSearchParams[];
  patches: { id: string; body: unknown }[];
  readAlls: number;
  /** 状態を変える：一覧・既読の口の答え（200 以外は失敗） */
  listStatus: number;
  patchStatus: number;
  readAllStatus: number;
  /** 一覧の答えを止めておく。返した関数を呼ぶと答える（読み込み中の形を見る・時間で待たない） */
  hold: () => () => void;
  gate: Promise<void>;
}

/** お知らせの口を差し替える（一覧は新しい順・unread・actor_member_id・limit（既定 20）・cursor（件数の目印）を見て返す） */
export async function mockNotices(page: Page, rows: NoticeSeed[], o: Partial<NoticeMock> = {}): Promise<NoticeMock> {
  const m: NoticeMock = {
    rows,
    readAt: new Map(rows.filter((r) => r.read).map((r) => [r.id, r.at])),
    lists: [],
    patches: [],
    readAlls: 0,
    listStatus: 200,
    patchStatus: 200,
    readAllStatus: 200,
    hold: () => {
      let open = () => {};
      m.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    gate: Promise.resolve(),
    ...o,
  };
  const itemOf = (s: NoticeSeed) => noticeItem(s, m.readAt.get(s.id) ?? null);
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    const send = (r: Reply) =>
      route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    if (req.method() === "GET" && p === "/api/v1/notifications") {
      m.lists.push(u.searchParams);
      await m.gate;
      if (m.listStatus !== 200) return send(fail(m.listStatus));
      const q = u.searchParams;
      let list = [...m.rows].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).map(itemOf);
      if (q.get("unread") === "true") list = list.filter((x) => !x.read);
      const who = q.get("actor_member_id");
      if (who) list = list.filter((x) => x.actor?.id === who);
      const limit = Number(q.get("limit") ?? 20);
      const from = Number(q.get("cursor") ? Buffer.from(q.get("cursor")!, "base64url").toString() : 0);
      const page1 = list.slice(from, from + limit);
      const next = from + limit < list.length ? Buffer.from(String(from + limit)).toString("base64url") : null;
      const actors = from === 0 ? Object.entries(PEOPLE).map(([id, name]) => ({ id, name })) : [];
      return send(ok(page1, { next_cursor: next, actors }));
    }
    if (req.method() === "PATCH" && /^\/api\/v1\/notifications\/[^/]+$/.test(p)) {
      const id = p.split("/").at(-1)!;
      const body = req.postDataJSON() as { read?: boolean };
      m.patches.push({ id, body });
      if (m.patchStatus !== 200) return send(fail(m.patchStatus));
      const s = m.rows.find((r) => r.id === id);
      if (!s) return send({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
      if (body.read === false) m.readAt.delete(id);
      else if (!m.readAt.has(id)) m.readAt.set(id, new Date().toISOString());
      return send(ok(itemOf(s)));
    }
    if (req.method() === "POST" && p === "/api/v1/notifications/read-all") {
      m.readAlls += 1;
      if (m.readAllStatus !== 200) return send(fail(m.readAllStatus));
      let n = 0;
      for (const s of m.rows)
        if (!m.readAt.has(s.id)) {
          m.readAt.set(s.id, new Date().toISOString());
          n += 1;
        }
      return send(ok({ read: n }));
    }
    return route.fallback();
  });
  return m;
}

/** 探す結果の 1 件（口の答えの形・鍵 5 つ） */
export interface Hit {
  kind: "ticket" | "decision" | "conversation" | "knowledge";
  id: string;
  title: string;
  snippet: string;
  url: string;
}
export interface SearchMock {
  /** 口に飛んだ問い合わせ（q・kinds・limit） */
  calls: URLSearchParams[];
  status: number;
  /** 問い合わせごとの答え（既定は rows を q の字で絞る） */
  answer: (q: URLSearchParams) => Reply | Promise<Reply>;
  hold: () => () => void;
  gate: Promise<void>;
}
/** 探すの口を差し替える。既定の答えは、rows のうち title か snippet に q の語（空白で分けた全部）を含む物を種類の順に上位 5 件まで */
export async function mockSearch(page: Page, rows: Hit[], o: Partial<SearchMock> = {}): Promise<SearchMock> {
  const ORDER = ["ticket", "decision", "conversation", "knowledge"];
  const m: SearchMock = {
    calls: [],
    status: 200,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      m.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    answer: (q) => {
      const terms = (q.get("q") ?? "").normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);
      const kinds = (q.get("kinds") ?? "").split(",").filter(Boolean);
      const hits = rows
        .filter((h) => (kinds.length === 0 || kinds.includes(h.kind)) && terms.length > 0)
        .filter((h) => terms.every((t) => `${h.title} ${h.snippet}`.normalize("NFKC").toLowerCase().includes(t)))
        .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
      const limit = Number(q.get("limit") ?? 5);
      const out = ORDER.flatMap((k) => hits.filter((h) => h.kind === k).slice(0, limit));
      return { status: 200, body: { data: out } };
    },
    ...o,
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    if (req.method() !== "GET" || u.pathname !== "/api/v1/search") return route.fallback();
    m.calls.push(u.searchParams);
    await m.gate;
    const r = m.status !== 200 ? fail(m.status) : await m.answer(u.searchParams);
    return route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}

export interface ShellMock {
  /** getShell を読んだ数 */
  reads: number;
  /** 口に飛んだ全部の要求（"GET /api/v1/shell" の形・問い合わせつき） */
  calls: string[];
  /** getShell の答えの状態（200 以外は失敗）と体（鍵を壊した答えを返す） */
  status: number;
  raw: unknown;
  opts: ShellOpts;
}
export const pathsOf = (m: ShellMock) => m.calls.map((c) => c.split(" ")[1]!.split("?")[0]!);

/** 外枠の口 getShell を差し替える。ほかの口は土台へ回す。すべての /api/ の要求を calls に残す */
export async function mockShell(
  page: Page,
  opts: ShellOpts = {},
  o: Partial<Pick<ShellMock, "status" | "raw">> = {},
): Promise<ShellMock> {
  const m: ShellMock = { reads: 0, calls: [], status: 200, raw: undefined, opts, ...o };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fallback();
    m.calls.push(`${req.method()} ${u.pathname}${u.search}`);
    if (!(req.method() === "GET" && u.pathname === "/api/v1/shell")) return route.fallback();
    m.reads += 1;
    if (m.status !== 200)
      return route.fulfill({
        status: m.status,
        contentType: "application/json",
        body: JSON.stringify(fail(m.status).body),
      });
    const body = m.raw !== undefined ? m.raw : { data: shellData(m.opts), meta: {} };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return m;
}
