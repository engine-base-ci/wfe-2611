// 作る画面の右の AI との会話（K-767・K-777）の試験の道具（K-767 が持つ。K-777 は読むだけ）。
//   作る画面（/tickets?new=1）は段 5 の K-442 の道具 tests/k/create-mock.ts の mockCreate（種別・人・下書き・作る口）。
//   その上に、次の口だけを網の手前で重ねる（後から足した route が先に当たる・当たらない道は fallback で土台へ）：
//     POST /api/v1/ticket_draft_conversations                 … startDraftConversation（K-774）体なし → 201 { data: { id } }／403 E-TALK-062（K-782）
//     POST /api/v1/ticket_draft_conversations/:id/messages    … sendDraftMessage ← { text, draft: { title, body, checks[] }, edited? } → 201 { data: { id, conversation_id, job_id } }
//                                                                  ／409 E-TALK-060（PC がまだ）・E-TALK-061（作る画面の会話でない）・E-TALK-012／403 E-TALK-062
//     POST /api/v1/ticket_draft_conversations/:id/adopt       … adoptDraftConversation（K-776・K-783）← { ticket_id } → 201 { data: { conversation_id } }
//     GET  /api/v1/conversations/:id ・ /stream ・ /stop     … 会話を読む・流れ・止める（K-757〜K-759）
//     GET  /api/v1/clones/me                                  … getMyClone（PC の状態・K-753）
//   会話の行の組み立ては talk-mock.ts（K-762）の msgOf・view・working。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page, Request, Route } from "@playwright/test";
import { mockCreate, NEW_ID, type CreateMock } from "./create-mock";
import { cloneMe, type PcState, type Reply } from "./room-mock";
import { JOB, at, msgOf, sse, view, working } from "./talk-mock";

export const DCONV = "0193c5a0-0000-7000-8000-0000000c0201";
export const ADOPTED = "0193c5a0-0000-7000-8000-0000000c0202";
export { NEW_ID, working, JOB };
/** 下絵 create-talk-* の人の言葉 */
export const CT_SAY = "セイコー様に 12 月分の作業報告書を年内に送りたい。形は 11 月と同じ";
export const draftView = (o: Record<string, unknown> = {}) =>
  view({ messages: [], ...o }, { id: DCONV, title: "新しい会話", talk_kind: "draft", ticket_id: null });
export const ME_LINE = (o: Record<string, unknown> = {}) =>
  msgOf({ who: "me", at: at(0, "10:40"), text: CT_SAY, ...o });
export const AI_LINE = (text: string, o: Record<string, unknown> = {}) =>
  msgOf({ who: "ai", at: at(0, "10:40"), text, ...o });

export interface CreateTalkMock {
  create: CreateMock;
  starts: number;
  says: { id: string; body: Record<string, unknown> }[];
  adopts: { id: string; body: Record<string, unknown> }[];
  reads: number;
  stops: number;
  streams: number;
  on: {
    start: () => Reply;
    say: (body: Record<string, unknown>) => Reply;
    adopt: (body: Record<string, unknown>) => Reply;
    view: () => Reply;
    stream: () => string | null;
  };
  hold: () => () => void;
  gate: Promise<void>;
}

export async function mockCreateTalk(page: Page, o: { pc?: PcState } = {}): Promise<CreateTalkMock> {
  const create = await mockCreate(page);
  const pc = o.pc ?? "live";
  let said = false;
  const t: CreateTalkMock = {
    create,
    starts: 0,
    says: [],
    adopts: [],
    reads: 0,
    stops: 0,
    streams: 0,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      t.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      start: () => ({ status: 201, body: { data: { id: DCONV } } }),
      say: () => {
        said = true;
        return {
          status: 201,
          body: { data: { id: "0193c5a0-0000-7000-8000-0000000d0201", conversation_id: DCONV, job_id: JOB } },
        };
      },
      adopt: () => ({ status: 201, body: { data: { conversation_id: ADOPTED } } }),
      view: () => ({
        status: 200,
        body: {
          data: draftView(
            said
              ? {
                  messages: [ME_LINE()],
                  running_job_id: JOB,
                  work: working({ status: "考えています…（EG-098 11 月分を見ています）" }),
                }
              : {},
          ),
        },
      }),
      stream: () => sse("ready"),
    },
  };
  const json = (route: Route, r: Reply) =>
    route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  await page.route(
    /\/api\/v1\/(ticket_draft_conversations|conversations\/|clones\/me$)/,
    async (route: Route, req: Request) => {
      const p = new URL(req.url()).pathname;
      const post = req.method() === "POST";
      const body = (req.postData() ? req.postDataJSON() : {}) as Record<string, unknown>;
      if (p === "/api/v1/clones/me") return json(route, { status: 200, body: { data: cloneMe(pc) } });
      if (p === "/api/v1/ticket_draft_conversations" && post) {
        t.starts++;
        await t.gate;
        return json(route, t.on.start());
      }
      let m = /^\/api\/v1\/ticket_draft_conversations\/([^/]+)\/messages$/.exec(p);
      if (m && post) {
        t.says.push({ id: m[1]!, body });
        await t.gate;
        return json(route, t.on.say(body));
      }
      m = /^\/api\/v1\/ticket_draft_conversations\/([^/]+)\/adopt$/.exec(p);
      if (m && post) {
        t.adopts.push({ id: m[1]!, body });
        return json(route, t.on.adopt(body));
      }
      if (/^\/api\/v1\/conversations\/[^/]+$/.test(p)) {
        t.reads++;
        return json(route, t.on.view());
      }
      if (/\/stop$/.test(p) && post) {
        t.stops++;
        return json(route, { status: 201, body: { data: { state: "stopping" } } });
      }
      if (/\/stream$/.test(p)) {
        t.streams++;
        const s = t.on.stream();
        return s === null
          ? json(route, { status: 503, body: { error: "error", code: "E-TALK-020" } })
          : route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: s });
      }
      return route.fallback();
    },
  );
  return t;
}

export const chatSide = (p: Page) => p.getByRole("region", { name: "AI との会話", exact: true });
export const chatBox = (p: Page) => chatSide(p).getByRole("textbox", { name: "高本のAI に話す", exact: true });
export const chatSend = (p: Page) => chatSide(p).getByRole("button", { name: "送る", exact: true });
export const howAi = (p: Page) =>
  p.locator(".k-create-how").getByRole("button", { name: "AI と話して作る", exact: true });
