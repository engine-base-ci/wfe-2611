// 会話の口の試験の道具（K-762 が持つ。K-764・K-767・K-777 は会話の答えを組む builder を読むだけ）。
//   部屋の頭・外枠は room-mock.ts（K-755）の mockRoom。その上に会話の口を重ねる（道は 08_api/openapi.yaml・答えの形は 11_tickets/K-757.md）：
//     GET  /api/v1/conversations                 … listConversations   { data: ConversationRow[], meta: { limit, cursor? } }
//     POST /api/v1/conversations                 … createConversation  201 { data: { id, conversation_id } }（K-73）
//     GET  /api/v1/conversations/:id             … getConversation     { data: ConversationView }
//     GET  /api/v1/conversations/:id/messages    … listConversationMessages（古い行の続き）{ data: MessageView[], meta: { cursor? } }
//     POST /api/v1/conversations/:id/messages    … sendConversationMessage  ← { text } → 201 { data: { id, conversation_id, job_id } }（K-758）
//     POST /api/v1/conversations/:id/stop        … stopConversation    201 { data: { state: "stopping"|"cancelled"|"none" } }（K-758）
//     GET  /api/v1/conversations/:id/stream      … streamConversation  text/event-stream の合図（ready・change・down・end）（K-759）
//   流れは「合図の列」を本文に入れて返す（試験が stream を差し替える）。固定の待ちは使わない（時間は page.clock で進める）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page, Request } from "@playwright/test";
import { mockRoom, todayJst, type PcState, type Reply, type RoomMock } from "./room-mock";

export const C1 = "0193c5a0-0000-7000-8000-0000000c0001";
export const C2 = "0193c5a0-0000-7000-8000-0000000c0002";
export const C3 = "0193c5a0-0000-7000-8000-0000000c0003";
export const C_NEW = "0193c5a0-0000-7000-8000-0000000c0009";
export const JOB = "0193c5a0-0000-7000-8000-0000000b0001";
/** 日本時間の「今日から d 日前の HH:mm」 */
export const at = (daysAgo: number, hhmm: string): string =>
  new Date(new Date(`${todayJst()}T${hhmm}:00+09:00`).getTime() - daysAgo * 86400_000).toISOString();

export const msgOf = (o: Record<string, unknown>) => ({
  id: `0193c5a0-0000-7000-8000-${String(1000000000000 + Math.floor(Math.random() * 1e9)).slice(1)}`,
  who: "me",
  text: "",
  at: at(0, "09:40"),
  job_id: null,
  passed: [],
  proposal: null,
  took: null,
  ...o,
});
/** 下絵 talk-convs の会話（来月の営業の段取り）の 2 行 */
export const LIST_MSGS = () => [
  msgOf({
    who: "me",
    at: at(0, "09:40"),
    text: "12 月は既存のお客さんの保守更新と、新規を 3 件取りたい。何から手を付ける？",
  }),
  msgOf({
    who: "ai",
    at: at(0, "09:41"),
    text: "今月の数字から見ると、保守更新は 3 社が 12 月に期限です。新規は発注ナビの応募の採用率が 18% なので、3 件取るには 17 件ほど応募が要ります。順番の案です。",
  }),
];
export const ME_Q2 = () =>
  msgOf({ who: "me", at: at(0, "09:44"), text: "保守更新の更新案は、セイコー様から先に出したい", job_id: JOB });

export const ROWS = () => [
  {
    id: C1,
    title: "来月の営業の段取りを考えたい",
    updated_at: at(0, "09:40"),
    last_text: "12 月は既存のお客さんの保守更新と…",
  },
  { id: C2, title: "保守更新 3 社の更新案", updated_at: at(1, "15:00"), last_text: null },
  { id: C3, title: "応募文の書き出しを柔らかく", updated_at: at(3, "11:00"), last_text: null },
];
export const view = (o: Record<string, unknown> = {}, conv: Record<string, unknown> = {}) => ({
  conversation: {
    id: C1,
    title: "来月の営業の段取りを考えたい",
    talk_kind: "clone",
    ticket_id: null,
    updated_at: at(0, "09:41"),
    ...conv,
  },
  messages: LIST_MSGS(),
  has_more: false,
  running_job_id: null,
  work: null,
  stopped: null,
  ...o,
});
export const working = (o: Record<string, unknown> = {}) => ({
  job_id: JOB,
  state: "running",
  status: "考えています…（EG-124 の見積を確かめています）",
  partial: null,
  elapsed_ms: 12_000,
  stopping: false,
  last_at: at(0, "09:44"),
  ...o,
});

export interface TalkMock {
  room: RoomMock;
  /** 書く口の体（飛んだ順） */
  creates: number;
  says: { id: string; body: Record<string, unknown> }[];
  stops: string[];
  /** 読んだ会話の id（読んだ順） */
  reads: string[];
  olders: Record<string, string>[];
  streams: string[];
  lists: number;
  on: {
    list: () => Reply;
    view: (id: string) => Reply;
    older: (id: string, q: Record<string, string>) => Reply;
    create: () => Reply;
    say: (id: string, body: Record<string, unknown>) => Reply;
    stop: (id: string) => Reply;
    /** 流れの本文（合図の列）。null なら 503 E-TALK-020 */
    stream: (id: string) => string | null;
  };
}

export const sse = (...events: string[]): string =>
  events
    .map(
      (e) =>
        `event: ${e.split(":")[0]}\ndata: ${JSON.stringify(e.includes(":") ? { reason: e.split(":")[1] } : {})}\n\n`,
    )
    .join("");

export async function mockTalk(
  page: Page,
  o: { pc?: PcState; rows?: Record<string, unknown>[]; since?: string } = {},
): Promise<TalkMock> {
  const room = await mockRoom(page, { ...(o.pc ? { pc: o.pc } : {}), ...(o.since ? { since: o.since } : {}) });
  const rows = o.rows ?? ROWS();
  const t: TalkMock = {
    room,
    creates: 0,
    says: [],
    stops: [],
    reads: [],
    olders: [],
    streams: [],
    lists: 0,
    on: {
      list: () => ({ status: 200, body: { data: rows, meta: { limit: 30 } } }),
      view: (id) => ({
        status: 200,
        body: { data: view({}, { id, title: rows.find((r) => r["id"] === id)?.["title"] ?? "新しい会話" }) },
      }),
      older: () => ({ status: 200, body: { data: [], meta: { limit: 50 } } }),
      create: () => ({ status: 201, body: { data: { id: C_NEW, conversation_id: C_NEW } } }),
      say: (id) => ({
        status: 201,
        body: { data: { id: "0193c5a0-0000-7000-8000-0000000d0001", conversation_id: id, job_id: JOB } },
      }),
      stop: () => ({ status: 201, body: { data: { state: "stopping" } } }),
      stream: () => sse("ready"),
    },
  };
  room.on.other = async (req: Request, p: string) => {
    const post = req.method() === "POST";
    if (p === "/api/v1/conversations") {
      if (post) {
        t.creates++;
        await room.gate;
        return t.on.create();
      }
      t.lists++;
      return t.on.list();
    }
    const m = /^\/api\/v1\/conversations\/([^/]+)(\/[a-z]+)?$/.exec(p);
    if (!m) return null;
    const id = m[1]!;
    const tail = m[2] ?? "";
    if (tail === "" && !post) {
      t.reads.push(id);
      return t.on.view(id);
    }
    if (tail === "/messages" && post) {
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      t.says.push({ id, body });
      await room.gate;
      return t.on.say(id, body);
    }
    if (tail === "/messages") {
      const q = Object.fromEntries(new URL(req.url()).searchParams.entries());
      t.olders.push(q);
      return t.on.older(id, q);
    }
    if (tail === "/stop" && post) {
      t.stops.push(id);
      await room.gate;
      return t.on.stop(id);
    }
    return null;
  };
  // 流れは text/event-stream で返す（mockRoom は JSON で返すので、流れだけ先に横取りする）
  await page.route(/\/api\/v1\/conversations\/[^/]+\/stream$/, async (route, req) => {
    const id = new URL(req.url()).pathname.split("/").at(-2)!;
    t.streams.push(id);
    const body = t.on.stream(id);
    if (body === null)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "error", code: "E-TALK-020" }),
      });
    return route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "cache-control": "private, no-store" },
      body,
    });
  });
  return t;
}

export const composer = (p: Page) => p.getByRole("textbox", { name: "高本のAI に話す", exact: true });
export const convList = (p: Page) => p.getByRole("navigation", { name: "会話の一覧", exact: true });
export const thread = (p: Page) => p.getByRole("list", { name: "会話", exact: true });
