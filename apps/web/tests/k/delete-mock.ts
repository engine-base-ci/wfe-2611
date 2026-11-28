// 段 8（F7）の画面の葉 K-590「詳細の「…」から消す・消した直後の「元に戻す」」が読む試験の道具（K-590 の切る段で作る・2026-11-20）。
//   口は網の手前で差し替える。土台は前からの tests/features/F5/approve-complete.harness.ts の mockApi（詳細・実行・me）で、
//   ここはその上に「消す前の下見・消す・戻す・チケットの一覧（消した後に出ない）」を足す（後から足した page.route が先に当たる。
//   道が違えば route.fallback() で土台へ回す）。口の形は口の葉の md（K-487・K-488・K-489。2026-11-20 に同時に書かれた）に合わせる。形が変わったらここだけを直す：
//     GET    /api/v1/tickets/:id/delete-preview → 200 { data: { children, descendants, attachments, artifacts, pending_approvals, links, running_runs, descendant_pending_approvals, descendant_running_runs, restorable_until } }
//                                                 （K-487・件数は整数・鍵は 10 個ちょうど。子と孫の数え方は消す口と同じ＝見えない子も入る。descendant_* は「一緒に消す」を選んだときだけ増える子・孫の分。つながりの番号・承認の宛先の名前は答えに無い）
//     DELETE /api/v1/tickets/:id?children=move|cascade|detach&parent_id=<uuid>&reason=<字> → 200 { data: { id, deleted_count, withdrawn_approvals, stopped_runs, restorable_until } }
//                                                 （K-488・問い合わせは children・parent_id・reason だけ。子・孫が無いときは children を付けない。理由は 400 字まで）
//     POST   /api/v1/tickets/:id/restore  ← {} → 201 { data: { id, restored_count } }（K-489・POST の既定で 201。30 日以内・消した本人かそのグループのマネージャー・管理者）
//     GET    /api/v1/tickets/:id（getTicket）→ 消した後は 404（E-PAGE-001）
//     失敗は KanameError の形 { error, code, message, detail }。番号（K-487・K-488・K-489 の表）：
//        E-DEL-001 消せない人（下見も消す口も・403）／E-DEL-010 子・孫がいるのに扱いを選んでいない（409）／E-DEL-011 移し先が自分か自分の子孫（409）／
//        E-DEL-012 移し先に移すと 3 段を超える（409）／E-DEL-013 一緒に消す子・孫に消せない物がある（403）／E-DEL-014 移し先が見つからない（404）／
//        E-DEL-040 戻せる人でない（403）／E-DEL-041 もう戻っている（409）／E-DEL-042 30 日を過ぎた（409）／E-DEL-043 親が消えている（409）
//   名前と件数はモック（apps/web/app/(dev)/dev/mock/f7/states/stopped.tsx）と同じにする（matchMock で字を比べるため）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  A_OPEN,
  API_RE,
  ME,
  TICKET,
  mockApi,
  pending,
  ticketOf,
  withBand,
  type Band,
  type Mock,
  type Reply,
} from "../features/F5/approve-complete.harness";
import { idOf, item } from "./list-mock";

export { ME, TICKET };
/** 移す先の候補（モックの EG-097 保守契約の見積） */
export const PARENT = idOf(97);
export const AT = "2026-11-20T01:12:00.000Z";
export const UNTIL = "2026-12-20T01:12:00.000Z";

export interface Preview {
  children: number;
  descendants: number;
  attachments: number;
  artifacts: number;
  pending_approvals: number;
  links: number;
  running_runs: number;
  /** 子・孫の決まっていない承認（「一緒に消す」を選んだときだけ一緒に取り下げられる分） */
  descendant_pending_approvals: number;
  /** 子・孫の走っている AI の実行（「一緒に消す」を選んだときだけ一緒に止まる分） */
  descendant_running_runs: number;
  restorable_until: string;
}
/** 子・孫が無い EG-128（モック f7-delete-confirm と同じ件数：承認待ち 1・つながり 2・添付 1・成果物 1・走っている実行 0） */
export const PLAIN: Preview = {
  children: 0,
  descendants: 0,
  attachments: 1,
  artifacts: 1,
  pending_approvals: 1,
  links: 2,
  running_runs: 0,
  descendant_pending_approvals: 0,
  descendant_running_runs: 0,
  restorable_until: UNTIL,
};
/** 子 4・孫 2 の親 EG-124（モック f7-delete-children） */
export const PARENT_OF: Preview = {
  children: 4,
  descendants: 6,
  attachments: 0,
  artifacts: 0,
  pending_approvals: 0,
  links: 1,
  running_runs: 0,
  descendant_pending_approvals: 0,
  descendant_running_runs: 0,
  restorable_until: UNTIL,
};
/** 子 4・孫 2 の親で、自分にも承認待ち 1・走っている実行 1 があり、子・孫に承認待ち 2・走っている実行 1 がある（「一緒に消す」を選ぶと取り下げ 3・止まる 2 に増える） */
export const PARENT_OF_BUSY: Preview = {
  ...PARENT_OF,
  pending_approvals: 1,
  running_runs: 1,
  descendant_pending_approvals: 2,
  descendant_running_runs: 1,
};

export interface DeleteOptions {
  /** 見ているチケット（既定は EG-128 セイコー様へ 11月分の請求書を送る・承認待ち） */
  number?: string;
  title?: string;
  stage?: string;
  /** 下見の答え（件数） */
  preview?: Preview;
  /** 承認する人の名前（approval.approver_name）。null なら承認の行が無い */
  approver?: string | null;
}

export interface DeleteMock {
  api: Mock;
  number: string;
  title: string;
  /** 消した後は true（getTicket が 404・一覧に出ない）。戻すと false */
  deleted: boolean;
  previews: number;
  deletes: { q: Record<string, string>; key: string | undefined }[];
  restores: { id: string }[];
  ticketReads: number;
  listReads: number;
  gate: Promise<void>;
  /** 消す・戻すの答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
  hold: () => () => void;
  on: {
    preview: (req: Request) => Reply | Promise<Reply>;
    remove: (req: Request) => Reply | Promise<Reply>;
    restore: (req: Request) => Reply | Promise<Reply>;
  };
}

const ok = (data: unknown, status = 200, meta: Record<string, unknown> = {}): Reply => ({
  status,
  body: { data, meta },
});
/** 口の失敗の答え（正本の番号つき） */
export const errReply = (status: number, code: string, detail: Record<string, unknown> = {}): Reply => ({
  status,
  body: {
    error: status === 403 ? "permission" : status === 404 ? "not_found" : "conflict",
    code,
    message: code,
    detail,
  },
});

/** 詳細（消す口）を差し替えて立てる。開くのは openDetail */
export async function mockDelete(page: Page, o: DeleteOptions = {}): Promise<DeleteMock> {
  const stage = o.stage ?? "awaiting_approval";
  const approver = o.approver === undefined ? "高本" : o.approver;
  const band: Band = {
    stage,
    approval: approver === null ? null : pending({ id: A_OPEN, approver_name: approver }),
  };
  const api = await mockApi(page, band);
  const d: DeleteMock = {
    api,
    number: o.number ?? "EG-128",
    title: o.title ?? "セイコー様へ 11月分の請求書を送る",
    deleted: false,
    previews: 0,
    deletes: [],
    restores: [],
    ticketReads: 0,
    listReads: 0,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      d.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      preview: () => ok(o.preview ?? PLAIN),
      remove: () => {
        d.deleted = true;
        return ok({ id: TICKET, deleted_count: 1, withdrawn_approvals: 0, stopped_runs: 0, restorable_until: UNTIL });
      },
      restore: () => {
        d.deleted = false;
        return ok({ id: TICKET, restored_count: 1 }, 201);
      },
    },
  };
  // getTicket を読んだ数は本当の要求で数える（土台は実行の一覧の答えを作るときにも on.ticket を読む・同じ形を数えない）
  page.on("request", (r) => {
    if (r.method() === "GET" && new URL(r.url()).pathname === `/api/v1/tickets/${TICKET}`) d.ticketReads++;
  });
  api.on.ticket = () => {
    if (d.deleted) return errReply(404, "E-PAGE-001");
    const base = ticketOf(band) as unknown as { ticket: Record<string, unknown> } & Record<string, unknown>;
    return ok(
      withBand(band, {
        ...base,
        ticket: { ...base.ticket, number: d.number, title: d.title, start_on: "2026-11-01", due_on: "2026-11-30" },
        kind: { id: "k1", name: "タスク", color: "#186F69" },
        stage: { key: stage, name: stage === "awaiting_approval" ? "承認待ち" : "作業中" },
        assignee: { id: ME, display_name: "高本" },
      }),
    );
  };
  const base = `/api/v1/tickets/${TICKET}`;
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    const m = req.method();
    let reply: Reply | null = null;
    if (m === "GET" && p === `${base}/delete-preview`) {
      d.previews++;
      reply = await d.on.preview(req);
    } else if (m === "DELETE" && p === base) {
      d.deletes.push({ q: Object.fromEntries(u.searchParams), key: req.headers()["idempotency-key"] });
      await d.gate;
      reply = await d.on.remove(req);
    } else if (m === "POST" && p === `${base}/restore`) {
      d.restores.push({ id: TICKET });
      await d.gate;
      reply = await d.on.restore(req);
    } else if (m === "GET" && p === "/api/v1/tickets") {
      d.listReads++;
      // 親を選ぶ欄（q つき）は候補 1 件・一覧は消していなければ見ているチケットを含む
      const rows = u.searchParams.get("q")
        ? [item(97, { id: PARENT, number: "EG-097", title: "保守契約の見積" })]
        : [
            ...(d.deleted ? [] : [item(1, { id: TICKET, number: d.number, title: d.title })]),
            item(2, { title: "更新の見積を作る" }),
          ];
      reply = ok(rows, 200, { limit: 20, next_cursor: null });
    }
    if (!reply) return route.fallback();
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return d;
}

/** 詳細を開き、実行の一覧の答えが届くまで待つ */
export async function openDetail(page: Page, d: DeleteMock, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
  const runs = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/v1/tickets/${TICKET}/runs`);
  const res = await page.goto(`/tickets/${TICKET}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: d.title })).toBeVisible();
  await runs;
  await expect(page.locator('#k-main [aria-busy="true"]')).toHaveCount(0);
}

export const moreBtn = (page: Page) => page.getByRole("button", { name: "ほかの操作", exact: true });
export const menuOf = (page: Page) => page.getByRole("menu");
export const deleteItem = (page: Page) => menuOf(page).getByRole("menuitem", { name: "消す", exact: true });
export const dlg = (page: Page) => page.getByRole("dialog", { name: "このチケットを消しますか", exact: true });
export const caution = (page: Page) => dlg(page).locator(".k-dialog-caution");
export const reasonInput = (page: Page) => dlg(page).locator("input[name='reason']");
export const cancelBtn = (page: Page) => dlg(page).getByRole("button", { name: "やめる", exact: true });
export const goBtn = (page: Page) => dlg(page).getByRole("button", { name: "消す", exact: true });
export const noticeOf = (page: Page) => dlg(page).locator(".k-band-notice");
export const choice = (page: Page, label: string) => dlg(page).getByRole("radio", { name: new RegExp(`^${label}`) });
export const parentBox = (page: Page) => dlg(page).getByRole("combobox", { name: "親のチケット", exact: true });
export const undoBtn = (page: Page) => page.getByRole("button", { name: "元に戻す", exact: true });
/** 「…」を開いて「消す」を押し、下見を読んで確認の小窓が開くまで */
export async function openConfirm(page: Page): Promise<void> {
  await moreBtn(page).click();
  await deleteItem(page).click();
  await expect(dlg(page)).toBeVisible();
}
/** 「一緒に起きること」の行（「・ 」を除いた字の並び） */
export async function togetherOf(page: Page): Promise<string[]> {
  const lines = await caution(page).locator("p").allTextContents();
  return lines.map((t) => t.replace(/^・ /, "")).filter((t) => t !== "一緒に起きること");
}

const BOX = ["width", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = ["height", "font-size", "color", "background-color", "border-top-color", "opacity", "texts"];
/** 消す・元に戻すの役（モック /dev/mock/f7 と本番で同じセレクタ・同じ部品）。小窓は画面に重なるので位置も比べる。
 *  「…」の箱は段 5 の K-458 の物（箱の突き合わせは K458-UI-015）なので、この葉の役には入れない */
export const DELETE_PAIRS: FidelityPair[] = [
  ["dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]],
  ["dialog-title", ".k-dialog-title", ["x", "y", ...TEXT]],
  ["dialog-caution", ".k-dialog-caution", [...BOX, "texts"]],
  ["dialog-note", ".k-f7-del-note", TEXT],
  ["dialog-choice", ".k-f7-del-choice", ["height", "texts"]],
  ["dialog-notice", ".k-dialog .k-band-notice", [...BOX, ...TEXT]],
  ["dialog-btn", ".k-dialog button[data-variant]", ["x", "y", ...CTRL]],
  ["toast", ".k-toast", [...BOX, "texts"]],
  ["toast-undo", ".k-toast-action", CTRL],
].map(([role, sel, props]) => ({
  name: String(role),
  role: String(role),
  canvas: String(sel),
  app: String(sel),
  props: props as string[],
}));
