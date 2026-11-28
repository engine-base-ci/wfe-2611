// 分身の部屋「やったこと」（/ai/done・K-756）の試験の道具（K-756 が持つ）。部屋の口（頭・外枠）は room-mock.ts（K-755）の mockRoom。
//   その上に GET /api/v1/clones/me/activity（listCloneActivity・答えの形は 11_tickets/K-754.md の「答えの形」）を重ねる：
//     ← kind（ran・made・stopped）・from・to（YYYY-MM-DD）・limit・cursor
//     → { data: [{ id, at, kind, ticket_id, ticket_number, title, result, detail }], meta: { limit, cursor?, summary: { total, passed, fixed, stopped, waiting } } }
//   行の字は下絵 done-list と同じ（題名＝チケットの題名に下絵の字を入れる）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page, Request } from "@playwright/test";
import { mockRoom, ok, todayJst, type Reply, type RoomMock } from "./room-mock";

const T = (n: number) => `0193c5a0-0000-7000-8000-${String(1000000000000 + n).slice(1)}`;
/** 日本時間の「今日から d 日前の HH:mm」の時刻（ISO・UTC） */
export const jstAt = (daysAgo: number, hhmm: string): string => {
  const day = new Date(`${todayJst()}T${hhmm}:00+09:00`).getTime() - daysAgo * 86400_000;
  return new Date(day).toISOString();
};
export const row = (o: Record<string, unknown>) => ({
  id: T(Math.floor(Math.random() * 1e9)),
  at: jstAt(0, "10:42"),
  kind: "ran",
  ticket_id: T(124),
  ticket_number: "EG-124",
  title: "請求書の PDF を先方にメールで送った",
  result: "done",
  detail: {},
  ...o,
});
/** 下絵 done-list の 7 行（今日 3・1 日前 3・2 日前 1）。detail は K-754 の鍵の形 */
export const DONE_ROWS = () => [
  row({ id: T(1), at: jstAt(0, "10:42"), detail: { approved: { by: "高本", at: jstAt(0, "10:30") } } }),
  row({
    id: T(2),
    at: jstAt(0, "10:20"),
    kind: "made",
    ticket_id: T(128),
    ticket_number: "EG-128",
    title: "請求書を作り、承認待ちに出した",
    result: "awaiting",
    detail: { checks: { ai: 3, total: 3 } },
  }),
  row({
    id: T(3),
    at: jstAt(0, "10:05"),
    kind: "made",
    ticket_id: T(133),
    ticket_number: "EG-133",
    title: "打ち合わせのまとめを書いた",
    result: "passed",
    detail: { checks: { ai: 0, total: 0 } },
  }),
  row({
    id: T(4),
    at: jstAt(1, "16:20"),
    kind: "made",
    ticket_id: T(131),
    ticket_number: "EG-131",
    title: "見積の下書きを作った",
    result: "fixed",
    detail: { checks: { ai: 1, total: 2 }, edited: { by: "高本", version: 3 } },
  }),
  row({
    id: T(5),
    at: jstAt(1, "14:02"),
    kind: "stopped",
    ticket_id: T(130),
    ticket_number: "EG-130",
    title: "経費の申請が止まった",
    result: "stopped",
    detail: { stopped_reason: "領収書の日付が読めませんでした" },
  }),
  row({
    id: T(6),
    at: jstAt(1, "11:15"),
    kind: "made",
    ticket_id: T(127),
    ticket_number: "EG-127",
    title: "求人の応募文を 3 本書いた",
    result: "passed",
    detail: { checks: { ai: 2, total: 2 } },
  }),
  row({
    id: T(7),
    at: jstAt(2, "18:40"),
    kind: "ran",
    ticket_id: T(98),
    ticket_number: "EG-098",
    title: "提案書の骨組みが差し戻された",
    result: "returned",
    detail: { returned: { by: "佐藤", reason: "結論が先に見えない" } },
  }),
];
export const SUMMARY = { total: 23, passed: 19, fixed: 3, stopped: 1, waiting: 0 };

export interface DoneMock {
  room: RoomMock;
  /** 読んだ問い合わせ（読んだ順） */
  queries: Record<string, string>[];
  on: (q: Record<string, string>, req: Request) => Reply | Promise<Reply>;
}

export async function mockDone(page: Page, rows = DONE_ROWS(), cursor: string | null = "Y3Vyc29y"): Promise<DoneMock> {
  const room = await mockRoom(page);
  const d: DoneMock = {
    room,
    queries: [],
    on: (q) => {
      const data = q["kind"] ? rows.filter((r) => r["kind"] === q["kind"]) : rows;
      return {
        status: 200,
        body: { data, meta: { limit: 50, ...(cursor && !q["cursor"] ? { cursor } : {}), summary: SUMMARY } },
      };
    },
  };
  room.on.other = async (req, p) => {
    if (p !== "/api/v1/clones/me/activity") return null;
    const q = Object.fromEntries(new URL(req.url()).searchParams.entries());
    d.queries.push(q);
    await room.gate;
    return d.on(q, req);
  };
  return d;
}
export { ok };
