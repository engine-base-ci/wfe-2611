// チケットの右のパネル「〈名〉のAI」タブと帯の［AI と話す］［直し方を AI に伝える］（K-764）の試験の道具（K-764 が持つ）。
//   詳細と帯は前からの土台 tests/features/F5/approve-complete.harness.ts の mockApi（getTicket・実行の一覧・自分の情報）。
//   その上に、次の口だけを網の手前で重ねる（後から足した route が先に当たる・当たらない道は fallback で土台へ）：
//     GET  /api/v1/tickets/:id/agent-session           … getTicketAgentSession（K-763）ConversationView と同じ 6 つの鍵（会話が無ければ conversation null）
//     POST /api/v1/tickets/:id/agent-session/messages  … sendTicketAgentMessage ← { text } → 201 { data: { id, conversation_id, job_id } }／409 E-TALK-050 ほか
//     POST /api/v1/conversations/:id/stop              … stopConversation（K-758）
//     GET  /api/v1/conversations/:id/messages          … listConversationMessages（K-757・古い行）
//     GET  /api/v1/conversations/:id/stream            … streamConversation（K-759）
//     GET  /api/v1/clones/me                           … getMyClone（PC の状態と名前・K-753）
//   会話の行の組み立ては talk-mock.ts（K-762）の msgOf・view・working を使う。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page, Request, Route } from "@playwright/test";
import { TICKET, mockApi, type Band, type Mock, type Reply } from "../features/F5/approve-complete.harness";
import { cloneMe, type PcState } from "./room-mock";
import { JOB, at, msgOf, sse, view, working } from "./talk-mock";

export { TICKET };
export const TCONV = "0193c5a0-0000-7000-8000-0000000c0101";
/** 下絵 tk-talk-panel の 2 行（10/19 の追加対応を外す相談） */
export const PANEL_MSGS = () => [
  msgOf({
    who: "me",
    at: at(0, "10:41"),
    text: "鈴木さんの書き込みのとおり、10/19 の追加対応は無償だったので外して作り直して",
  }),
  msgOf({
    who: "ai",
    at: at(0, "10:41"),
    text: "10/19 分（30,000 円）を外すと、合計は 1,716,000 円から 1,683,000 円になります。成果物を作り直してよければ、続けて任せてください。",
  }),
];
export const EMPTY_SESSION = {
  conversation: null,
  messages: [],
  has_more: false,
  running_job_id: null,
  work: null,
  stopped: null,
};
export const session = (o: Record<string, unknown> = {}) =>
  view(
    { messages: PANEL_MSGS(), ...o },
    { id: TCONV, title: "10/19 の追加対応を外す", talk_kind: "ticket", ticket_id: TICKET },
  );

export interface TicketTalkMock {
  api: Mock;
  reads: number;
  says: Record<string, unknown>[];
  stops: string[];
  streams: string[];
  writes: string[];
  on: {
    session: () => Reply;
    say: (body: Record<string, unknown>) => Reply;
    stop: () => Reply;
    stream: () => string | null;
  };
  hold: () => () => void;
  gate: Promise<void>;
  /** 流れの口に答えず、開いたままにする（閉じると requestfailed が起きる） */
  hang: boolean;
}

export async function mockTicketTalk(
  page: Page,
  o: { band?: Band; pc?: PcState; session?: Record<string, unknown> } = {},
): Promise<TicketTalkMock> {
  const api = await mockApi(page, o.band);
  const pc = o.pc ?? "live";
  const t: TicketTalkMock = {
    api,
    reads: 0,
    says: [],
    stops: [],
    streams: [],
    writes: [],
    gate: Promise.resolve(),
    hang: false,
    hold: () => {
      let open = () => {};
      t.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      session: () => ({ status: 200, body: { data: o.session ?? EMPTY_SESSION } }),
      say: () => ({
        status: 201,
        body: { data: { id: "0193c5a0-0000-7000-8000-0000000d0101", conversation_id: TCONV, job_id: JOB } },
      }),
      stop: () => ({ status: 201, body: { data: { state: "stopping" } } }),
      stream: () => sse("ready"),
    },
  };
  const json = (route: Route, r: Reply) =>
    route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  await page.route(
    /\/api\/v1\/(tickets\/[^/]+\/agent-session|conversations\/|clones\/me$)/,
    async (route: Route, req: Request) => {
      const p = new URL(req.url()).pathname;
      const post = req.method() === "POST";
      if (post) t.writes.push(`POST ${p}`);
      if (p === "/api/v1/clones/me") return json(route, { status: 200, body: { data: cloneMe(pc) } });
      if (p === `/api/v1/tickets/${TICKET}/agent-session` && !post) {
        t.reads++;
        return json(route, t.on.session());
      }
      if (p === `/api/v1/tickets/${TICKET}/agent-session/messages` && post) {
        const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
        t.says.push(body);
        await t.gate;
        return json(route, t.on.say(body));
      }
      if (/\/conversations\/[^/]+\/stop$/.test(p) && post) {
        t.stops.push(p.split("/").at(-2)!);
        await t.gate;
        return json(route, t.on.stop());
      }
      if (/\/conversations\/[^/]+\/stream$/.test(p)) {
        t.streams.push(p.split("/").at(-2)!);
        // 流れを開いたまま（答えを返さない）にする：区画を閉じたときに画面が要求を取り消すかを見る（K764-UI-013）
        if (t.hang) return;
        const body = t.on.stream();
        return body === null
          ? json(route, { status: 503, body: { error: "error", code: "E-TALK-020" } })
          : route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body });
      }
      if (/\/conversations\/[^/]+\/messages$/.test(p))
        return json(route, { status: 200, body: { data: [], meta: { limit: 50 } } });
      return route.fallback();
    },
  );
  return t;
}

export const panel = (p: Page) => p.getByRole("complementary", { name: "チケットのパネル", exact: true });
export const aiTab = (p: Page) =>
  panel(p)
    .getByRole("navigation", { name: "パネルのタブ", exact: true })
    .getByRole("button", { name: "高本のAI", exact: true });
export const aiRegion = (p: Page) => p.getByRole("region", { name: "AI と話す", exact: true });
export const panelBox = (p: Page) => aiRegion(p).getByRole("textbox", { name: "高本のAI に話す", exact: true });
export { working };
