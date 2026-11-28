// 段 8（F7）の画面の葉 K-486「止まった帯（理由ごとの一手・自分で直す）」が読む試験の道具（K-486 の切る段で作る・2026-11-20）。
//   口は網の手前で差し替える。土台は前からの tests/features/F5/approve-complete.harness.ts の mockApi（詳細・実行・me）で、
//   ここはその上に「実行の記録（reason_kind と taken_over_at を足した 16 の鍵）」と「自分で直す」「AI に任せる」の口を足す
//   （後から足した page.route が先に当たる。道が違えば route.fallback() で土台へ回す）。
//   口の形は口の葉 K-485 の md に合わせる（形が変わったらここだけを直す）：
//     GET  /api/v1/tickets/:id/runs        → { data: RunJson[], meta: { limit: 50 } }（K-62 の listTicketRuns に reason_kind・taken_over_at が足される・新しい順）
//     GET  /api/v1/action_runs/:id         → { data: RunJson }（getActionRun。同じ 16 の鍵）
//     POST /api/v1/action_runs/:id/takeover ← {}（体は空）→ 201 { data: RunJson（taken_over_at が立つ）}（K-485 の takeoverActionRun）
//     POST /api/v1/tickets/:id/delegate    ← {} → 201 { data: { run_id } }（K-62 の delegateTicket・もう一度の「AI に任せる」）
//     GET  /api/v1/tickets/:id（getTicket）→ 前からの答え。担当者は { id, display_name }・can.delegate は K-62 の ticket_can_delegate
//     失敗は KanameError の形 { error, code, message }。自分で直すの番号は K-485 の E-STP-001〜004（001 担当者でない 403／002 いまは切り替えられない 409／
//        003 もう自分で進めている 409／004 新しい実行に替わった 409）
//   名前と文はモック（apps/web/app/(dev)/dev/mock/f7/states/stopped.tsx）と同じにする（matchMock で字を比べるため）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page, Request, Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  API_RE,
  ME,
  RUN_ID,
  TICKET,
  mockApi,
  ticketOf,
  withBand,
  type Band,
  type Mock,
  type Reply,
} from "../features/F5/approve-complete.harness";

export { ME, RUN_ID, TICKET };
/** 担当者でない見ている人（鈴木・モックの f7-stop-denied と同じ） */
export const SUZUKI = "11111111-0000-4000-8000-000000000004";
/** 任せ直した新しい実行 */
export const RUN2 = "0193c5a0-0000-7000-8000-0000000e0002";
export const AT = "2026-11-20T01:12:00.000Z";
/** モックの「高本のAI」・確認で落ちた理由の全文（口が返した字のまま） */
export const WHO = "高本のAI";
export const FAILED = "金額が見積 EG-097 の月額と合いませんでした";
/** D-129.47・D-131.4：理由が届かないとき */
export const NO_REASON = "AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます";
/** D-129.47：実行中に Bridge が止まったとき */
export const BRIDGE_STOPPED =
  "PC の Kaname Bridge が途中で止まったので、ここで止まりました。Bridge を開き直してから、もう一度「AI に任せる」を押してください";

export type ReasonKind =
  | "pc_closed"
  | "approval_expired"
  | "bridge_outdated"
  | "claude_missing"
  | "claude_login"
  | "browser_unreachable"
  | "unknown"
  | null;

/** 実行の記録（K-62 の ActionRunView 14 の鍵 ＋ K-485 が足す reason_kind・taken_over_at ＝ 16） */
export interface RunJson {
  id: string;
  ticket_id: string;
  phase: "make" | "execute";
  status: string;
  by: { member_id: string; display_name: string } | null;
  pc: string | null;
  silent: boolean;
  last_event_at: string | null;
  progress: string | null;
  stopped_reason: string | null;
  return_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
  checks: { state: string } | null;
  reason_kind: ReasonKind;
  taken_over_at: string | null;
}

/** 止まった作る段の実行（既定：確認で落ちた・理由は全文・種類は unknown） */
export const run = (o: Partial<RunJson> = {}): RunJson => ({
  id: RUN_ID,
  ticket_id: TICKET,
  phase: "make",
  status: "stopped",
  by: { member_id: ME, display_name: "高本" },
  pc: "live",
  silent: false,
  last_event_at: null,
  progress: null,
  stopped_reason: FAILED,
  return_reason: null,
  started_at: "2026-11-20T00:50:00.000Z",
  finished_at: AT,
  checks: { state: "none" },
  reason_kind: "unknown",
  taken_over_at: null,
  ...o,
});

export interface StopOptions {
  /** 実行の一覧（新しい順）。既定は止まった 1 件 */
  runs?: RunJson[];
  /** 見ている人：assignee＝担当者の高本（既定）／other＝担当者でない鈴木（書ける人）／viewer＝見るだけの山口（can.delegate 偽） */
  viewer?: "assignee" | "other" | "viewer";
  /** チケットの段（既定は作業中） */
  stage?: string;
}

export interface StopMock {
  api: Mock;
  runs: RunJson[];
  takeovers: { id: string; body: unknown }[];
  delegates: unknown[];
  ticketReads: number;
  runsReads: number;
  gate: Promise<void>;
  /** 自分で直す・AI に任せるの答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
  hold: () => () => void;
  on: { takeover: (req: Request) => Reply | Promise<Reply>; delegate: (req: Request) => Reply | Promise<Reply> };
}

const ok = (data: unknown, status = 200): Reply => ({ status, body: { data } });
/** 口の失敗の答え（正本の番号つき） */
export const errReply = (status: number, code: string): Reply => ({
  status,
  body: { error: status === 403 ? "permission" : "conflict", code, message: code },
});

/** 止まった帯のある詳細を差し替えて立てる。開くのは harness の openTicketSettled */
export async function mockStopped(page: Page, o: StopOptions = {}): Promise<StopMock> {
  const viewer = o.viewer ?? "assignee";
  const stage = o.stage ?? "doing";
  const band: Band = { stage, can_delegate: viewer !== "viewer" };
  const api = await mockApi(page, band);
  const s: StopMock = {
    api,
    runs: o.runs ?? [run()],
    takeovers: [],
    delegates: [],
    ticketReads: 0,
    runsReads: 0,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      s.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      takeover: () => {
        s.runs = s.runs.map((r) => (r.id === RUN_ID ? { ...r, taken_over_at: AT } : r));
        return ok(
          s.runs.find((r) => r.id === RUN_ID),
          201,
        );
      },
      delegate: () => {
        s.runs = [
          run({
            id: RUN2,
            status: "queued",
            stopped_reason: null,
            reason_kind: null,
            started_at: null,
            finished_at: null,
          }),
          ...s.runs,
        ];
        return ok({ run_id: RUN2 }, 201);
      },
    },
  };
  // getTicket を読んだ数は本当の要求で数える（土台は実行の一覧の答えを作るときにも on.ticket を読む・同じ形を数えない）
  page.on("request", (r) => {
    if (r.method() === "GET" && new URL(r.url()).pathname === `/api/v1/tickets/${TICKET}`) s.ticketReads++;
  });
  api.on.ticket = () => {
    const base = ticketOf(band) as unknown as { ticket: Record<string, unknown> } & Record<string, unknown>;
    return ok(
      withBand(band, {
        ...base,
        ticket: { ...base.ticket, number: "EG-128" },
        stage: { key: stage, name: stage === "doing" ? "作業中" : stage },
        assignee: { id: ME, display_name: "高本" },
        can: { delegate: viewer !== "viewer", complete: false },
      }),
    );
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const m = req.method();
    let reply: Reply | null = null;
    if (m === "GET" && p === `/api/v1/tickets/${TICKET}/runs`) {
      s.runsReads++;
      reply = { status: 200, body: { data: s.runs, meta: { limit: 50 } } };
    } else if (m === "GET" && /^\/api\/v1\/action_runs\/[^/]+$/.test(p)) {
      const r = s.runs.find((x) => x.id === p.split("/").at(-1));
      reply = r ? ok(r) : { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    } else if (m === "POST" && /^\/api\/v1\/action_runs\/[^/]+\/takeover$/.test(p)) {
      s.takeovers.push({ id: p.split("/").at(-2)!, body: req.postDataJSON() });
      await s.gate;
      reply = await s.on.takeover(req);
    } else if (m === "POST" && p === `/api/v1/tickets/${TICKET}/delegate`) {
      s.delegates.push(req.postDataJSON());
      await s.gate;
      reply = await s.on.delegate(req);
    } else if (/\/me$/.test(p) && viewer !== "assignee") {
      const id = viewer === "other" ? SUZUKI : "11111111-0000-4000-8000-000000000007";
      const name = viewer === "other" ? "鈴木" : "山口";
      reply = ok({
        member_id: id,
        display_name: name,
        role_id: viewer === "other" ? "member" : "viewer",
        roles: ["member"],
        name,
      });
    }
    if (!reply) return route.fallback();
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return s;
}

/** 止まった理由の区画（F7 の帯）・帯の箱・題・ボタン */
export const stopSec = (page: Page) => page.getByRole("region", { name: "止まった理由", exact: true });
export const stopBox = (page: Page) => stopSec(page).locator(".k-band");
export const btn = (page: Page, name: string) => stopSec(page).getByRole("button", { name, exact: true });
export const setupLink = (page: Page, name: string) => stopSec(page).getByRole("link", { name, exact: true });
/** 自分で直すの確認の小窓（Confirm は alertdialog） */
export const takeoverDialog = (page: Page) =>
  page.getByRole("alertdialog", { name: "自分で直しますか？", exact: true });
/** AI に任せるの帯の区画（前からの帯・任せ直した後と、引き取った後の白い箱） */
export const delegateSec = (page: Page) => page.getByRole("region", { name: "AI に任せる", exact: true });

const BOX = ["background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["height", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
const pairs = (root: string, list: [string, string, string[]][]): FidelityPair[] =>
  list.map(([role, sel, props]) => ({
    name: role,
    role,
    canvas: `${root} ${sel}`,
    app: `${root} ${sel}`,
    props,
  }));
const DIALOG: [string, string, string[]][] = [
  ["dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]],
  ["dialog-title", ".k-dialog-title", ["x", "y", ...TEXT]],
  ["dialog-desc", ".k-dialog-desc", TEXT],
  ["dialog-btn", ".k-dialog button[data-variant]", ["x", "y", ...CTRL]],
];
/** 止まった帯の役（モック /dev/mock/f7 と本番で同じセレクタ・同じ部品）。位置は詳細の本文の量で変わるので帯では比べない。
 *  帯は 1 つ（モックの f7-stop-broken は 1 つの原因＝Bridge が古い だけを出す。ほかの 3 つの原因は reason_kind を替えて 1 つずつ K486-UI-002 が字を見る）。小窓は画面に重なるので位置も比べる */
export const STOP_PAIRS: FidelityPair[] = [
  ...pairs(".k-f7-stop:first-child", [
    ["band", ".k-band", [...BOX, "texts"]],
    ["band-title", ".k-band-title", TEXT],
    ["band-sub", ".k-band-sub", TEXT],
    ["band-line", ".k-band-line", TEXT],
    ["band-btn", ".k-band-acts :is(button, a.k-btn)", CTRL],
  ]),
  ...pairs("", DIALOG),
];
/** 「AI に任せる」を押した後の帯の役（本番は前からの帯の箱・モックは F7 の同じ形の箱） */
export const RETRY_PAIRS: FidelityPair[] = [
  ...pairs(".k-detail-bands", [
    ["band", ".k-band", [...BOX, "texts"]],
    ["band-title", ".k-band-title", TEXT],
    ["band-sub", ".k-band-sub", TEXT],
    ["band-btn", ".k-band-acts :is(button, a.k-btn)", CTRL],
  ]),
];
