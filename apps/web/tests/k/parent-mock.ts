// K-443「親を決める小窓」の画面の試験の道具（K-443 の試験だけが読む・切る段で作り carry しない・2026-11-20）。
//   口は網の手前で差し替える。まだ作っていない口（K-440 の updateTicket の親の組・K-92 の一覧の口に足す scope・getTicket に足す parent）は、
//   口の葉の md の答えの形にそろえた：
//     GET   /api/v1/tickets?q=…&view=all&limit=20 → { data: 行[], meta: { next_cursor } }（K-92。行に scope: { id, name } を足す＝K-560 が足す口）
//     GET   /api/v1/tickets/:id（getTicket）       → 前からの答え ＋ parent（{ id, number, title, due_on } か null）＋ child_count（K-560 が足す口）
//     PATCH /api/v1/tickets/:id（updateTicket）    ← { parent_ticket_id: uuid | null }（頭 idempotency-key）→ 200 { data: { ticket: { id, number, updated_at, parent_ticket_id }, changed, message_id } }（K-440）
//     失敗は KanameError の形 { error, code, message }（K-440：親にできない＝409 E-TKT-001〜004・無い・選べない親＝404 E-PAGE-001・書けない＝403。404・409 に field・details は付けない＝控え帳）
//   作る面の口（createTicket・下書き）は前からの土台 create-mock.ts の mockCreate をそのまま使う（ここは親の候補の一覧だけを足す）。
//   置き場所（2026-11-21・新しい形）：作る面は見出しの上の入口と項目の表の「親」の行の 2 か所（K-442 の ParentSlot）・詳細は右のパネル「関連」の区の「親」の行（K-571）。道具は置き場所を知らない（呼ぶ側の試験が絞る）。
//   名前と日付は下絵 /dev/mock/f4 の見本（f4-parent-dialog・f4-parent-none・f4-parent-limit）と同じにする（matchMock で字を比べるため）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page, Request, Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
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
import { BOSS, MATE, ME, SCOPE, TASK } from "./create-mock";
import { ROOT } from "./kit";

// ---------------------------------------------------------------- 正本の文
const ERRORS = JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
  errors: { id: string; message: string }[];
};
/** 正本の文（全部）。正本に無い番号は番号のまま返す（試験が赤になる） */
export const msgOf = (id: string): string => ERRORS.errors.find((e) => e.id === id)?.message ?? id;
/** 正本の文の 1 文目（口の答えの番号が正本に無いときの、ページ共通の断りの出し方） */
export const firstOf = (id: string): string => {
  const m = msgOf(id);
  const i = m.indexOf("。");
  return i < 0 ? m : m.slice(0, i + 1);
};

export const ok = (data: unknown, meta?: Record<string, unknown>): Reply => ({
  status: 200,
  body: { data, ...(meta ? { meta } : {}) },
});
/** 口の断り（正本の番号つき）。field があれば欄の理由も付ける */
export const errReply = (status: number, code: string, field?: string): Reply => ({
  status,
  body: {
    error: status === 409 ? "conflict" : status === 404 ? "not_found" : "validation_failed",
    code,
    message: msgOf(code),
    // 控え帳の決め：404・409 は欄も details も付けない（422 だけ欄の理由を持つ）。欄を特定できないので画面は 1 つの文を赤い箱に出す
    ...(field ? { field } : {}),
    ...(field && status === 422 ? { details: [{ field, message: msgOf(code) }] } : {}),
  },
});
export const SERVER_ERROR: Reply = { status: 500, body: { error: "server_error", code: "INTERNAL" } };

// ---------------------------------------------------------------- 親の候補（下絵の見本と同じ名前・グループ・段・期限）
export interface Row {
  id: string;
  number: string;
  title: string;
  /** 候補の段（親子の何段目か。3 の下には作れない） */
  depth: 1 | 2 | 3;
  stage: string;
  scope: { id: string; name: string };
  due_on: string | null;
  assignee: { id: string; display_name: string } | null;
}
const EG = { id: SCOPE, name: "営業" };
const JD = { id: "22222222-0000-4000-8000-000000000002", name: "受託開発" };
const who = (id: string, name: string) => ({ id, display_name: name });
export const R124: Row = {
  id: "0193c5a0-0000-7000-8000-00000000c4a1",
  number: "EG-124",
  title: "【親】セイコー様 保守契約の更新",
  depth: 1,
  stage: "作業中",
  scope: EG,
  due_on: "2026-11-30",
  assignee: who(MATE, "山田"),
};
export const R097: Row = {
  id: "0193c5a0-0000-7000-8000-00000000c4a2",
  number: "EG-097",
  title: "セイコー様 保守契約の見積",
  depth: 1,
  stage: "完了",
  scope: EG,
  due_on: "2026-10-31",
  assignee: who(ME, "高本"),
};
export const J150: Row = {
  id: "0193c5a0-0000-7000-8000-00000000c4a3",
  number: "JD-150",
  title: "京蟻 保守運用（年間）",
  depth: 1,
  stage: "作業中",
  scope: JD,
  due_on: "2026-12-20",
  assignee: who(BOSS, "佐藤"),
};
export const R131: Row = {
  id: "0193c5a0-0000-7000-8000-00000000c4a4",
  number: "EG-131",
  title: "請求の確認（EG-124 の下）",
  depth: 2,
  stage: "作業中",
  scope: EG,
  due_on: "2026-12-10",
  assignee: null,
};
export const R141: Row = {
  id: "0193c5a0-0000-7000-8000-00000000c4a5",
  number: "EG-141",
  title: "請求書の宛名を確かめる",
  depth: 3,
  stage: "作業中",
  scope: EG,
  due_on: "2026-12-10",
  assignee: null,
};
export const ROWS: Row[] = [R124, R097, J150, R131, R141];

const HYPHENS = /[‐‑‒–—―ー−－]/g;
/** 口の側の照合（K-92・D-128.157）：全角半角・大文字小文字・前後の空白をそろえ、番号はハイフンの種類もそろえる */
const hit = (r: Row, q: string): boolean => {
  const n = q.normalize("NFKC").trim().toLowerCase();
  return (
    r.title.normalize("NFKC").toLowerCase().includes(n) || r.number.toLowerCase().includes(n.replace(HYPHENS, "-"))
  );
};
const item = (r: Row) => ({
  id: r.id,
  number: r.number,
  title: r.title,
  kind: { id: TASK, name: "タスク" },
  stage: { id: "0193c5a0-0000-7000-8000-00000000c4f1", name: r.stage, key: r.stage === "完了" ? "done" : "doing" },
  assignee: r.assignee,
  delegated_to_clone: false,
  due_on: r.due_on,
  overdue: false,
  updated_at: "2026-11-15T00:00:00Z",
  parent_ticket_id: null,
  depth: r.depth,
  scope: r.scope,
});
const detailOf = (r: Row) => ({
  ticket: { id: r.id, number: r.number, title: r.title, due_on: r.due_on, start_on: null, priority: "mid" },
  // 新しい形の答え（K-560）：本文は 1 枚・会社の項目と確認項目の数・親と子とつながりの数。区画（sections）は持たない
  body: { doc: { type: "doc", content: [] }, text: "", version: 0 },
  fields: [],
  spec_count: 0,
  spec_unchecked: 0,
  no_spec_reason: null,
  parent: null,
  child_count: 0,
  link_count: 0,
  results: {},
  kind: { id: TASK, name: "タスク" },
  stage: { name: r.stage },
  assignee: r.assignee,
});
/** K-560 が足す getTicket の parent（6 つの鍵）。見えない親は番号だけ（id・title・due_on・stage は null・visible false） */
const parentOf = (r: Row | null, hidden = false) =>
  r
    ? hidden
      ? { id: null, number: r.number, title: null, due_on: null, stage: null, visible: false }
      : { id: r.id, number: r.number, title: r.title, due_on: r.due_on, stage: r.stage, visible: true }
    : null;

export interface ListState {
  rows: Row[];
  /** 一覧の口（探す）に届いた問い合わせ */
  calls: URLSearchParams[];
  /** 一覧の口の答えの状態。200 以外なら体はエラー */
  status: number;
  /** 親の候補の 1 件を getTicket で読んだ回数（下書きから戻した親の札を引く） */
  reads: number;
  /** 親の候補の 1 件の getTicket の答えの状態。null なら 200・404 なら入口の NOT_FOUND・500 なら落ちる（下書きの親が読めない） */
  readStatus: number | null;
}

/** 親の候補の一覧の口と、候補 1 件の詳細の口を差し替える（作る面・詳細のどちらにも足せる） */
export async function routeParents(page: Page, rows: Row[] = ROWS): Promise<ListState> {
  const l: ListState = { rows, calls: [], status: 200, reads: 0, readStatus: null };
  await page.route(API_RE, async (route: Route, req: Request) => {
    if (req.method() !== "GET") return route.fallback();
    const u = new URL(req.url());
    let reply: Reply | null = null;
    if (u.pathname === "/api/v1/tickets") {
      l.calls.push(u.searchParams);
      const q = u.searchParams.get("q") ?? "";
      reply =
        l.status !== 200
          ? { status: l.status, body: { error: "server_error", code: "INTERNAL" } }
          : ok(q.trim() === "" ? [] : l.rows.filter((r) => hit(r, q)).map(item), { next_cursor: null });
    } else {
      const one = l.rows.find((r) => u.pathname === `/api/v1/tickets/${r.id}`);
      if (one) {
        l.reads++;
        reply =
          l.readStatus === null
            ? ok(detailOf(one))
            : l.readStatus === 404
              ? { status: 404, body: { error: "not_found", code: "NOT_FOUND" } }
              : SERVER_ERROR;
      }
    }
    if (!reply) return route.fallback();
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return l;
}

// ---------------------------------------------------------------- 詳細（親の行）
export interface DetailParent {
  /** 親を決める口（updateTicket）に届いた要求 */
  patches: { body: Record<string, unknown>; key: string | undefined }[];
  /** getTicket（見ているチケット）を読んだ回数 */
  ticketReads: number;
  /** いま親に決まっているもの（getTicket の parent） */
  parent: Row | null;
  /** 見ている人に親が見えない（getTicket の parent は番号だけ・visible false・K-560） */
  hidden: boolean;
  /** 書く口の答えを止めておく。返した関数を呼ぶと答える（時間で待たない・二度押しを見る） */
  hold: () => () => void;
  gate: Promise<void>;
  /** 成功の答え（200・changed true）。親を書き換える */
  ok: (req: Request) => Reply;
  on: { patch: (req: Request) => Reply | Promise<Reply> };
}
export interface DetailOptions {
  parent?: Row | null;
  /** 親が見えない人（番号だけ） */
  hidden?: boolean;
  /** 見ているチケットの期限（既定 2026-11-27） */
  due_on?: string;
  rows?: Row[];
  band?: Band;
}

/** 詳細（土台 mockApi）に、親の欄に要る答え（getTicket の parent・updateTicket の親の組・候補の一覧）を足す */
export async function setupDetail(
  page: Page,
  o: DetailOptions = {},
): Promise<{ api: Mock; p: DetailParent; l: ListState }> {
  const band: Band = o.band ?? { stage: "doing" };
  const api = await mockApi(page, band);
  const l = await routeParents(page, o.rows ?? ROWS);
  const p: DetailParent = {
    patches: [],
    ticketReads: 0,
    parent: o.parent ?? null,
    hidden: o.hidden ?? false,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      p.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    ok: (req) => {
      const b = req.postDataJSON() as { parent_ticket_id?: string | null };
      p.hidden = false;
      p.parent = b.parent_ticket_id ? (l.rows.find((r) => r.id === b.parent_ticket_id) ?? null) : null;
      return ok({
        ticket: {
          id: TICKET,
          number: "EG-133",
          updated_at: "2026-11-23T01:00:00.000Z",
          parent_ticket_id: p.parent?.id ?? null,
        },
        changed: true,
        message_id: "0193c5a0-0000-7000-8000-00000000c4e1",
      });
    },
    on: { patch: (req) => p.ok(req) },
  };
  api.on.ticket = () => {
    p.ticketReads++;
    const base = ticketOf(band) as unknown as { ticket: Record<string, unknown> } & Record<string, unknown>;
    return ok(
      withBand(band, {
        ...base,
        ticket: {
          ...base.ticket,
          due_on: o.due_on ?? "2026-11-27",
          scope_id: SCOPE,
          kind_id: TASK,
          parent_ticket_id: p.parent?.id ?? null,
        },
        // K-560 が足す getTicket の列（親の番号・題名・期限と、直接の子の数）
        parent: parentOf(p.parent, p.hidden),
        child_count: 0,
      }),
    );
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    if (req.method() !== "PATCH" || new URL(req.url()).pathname !== `/api/v1/tickets/${TICKET}`)
      return route.fallback();
    p.patches.push({ body: req.postDataJSON() as Record<string, unknown>, key: req.headers()["idempotency-key"] });
    await p.gate;
    const r = await p.on.patch(req);
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return { api, p, l };
}

// ---------------------------------------------------------------- モックとの突き合わせの役（小窓。モック /dev/mock/f4 と本番で同じセレクタ・同じ部品）
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
export const PARENT_PAIRS: FidelityPair[] = [
  ["dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]],
  ["title", ".k-dialog h2", ["x", "y", ...TEXT]],
  ["search", ".k-dialog input[name='pick_query']", ["width", "height", "x", "y", "border-top-color", "font-size"]],
  ["item", ".k-f4-pick-item", ["width", "height", "x", "opacity", "texts"]],
  ["why", ".k-f4-pick-why", ["x", ...TEXT]],
  ["none", ".k-f4-par-none", ["x", "width", ...TEXT]],
  ["note", ".k-f4-par-note", ["x", "width", ...TEXT]],
  ["callout", ".k-dialog .k-callout", ["x", "width", "background-color", ...TEXT]],
  ["check", ".k-dialog .k-dialog-check", ["x", "height", "font-size", "texts"]],
  ["btn", ".k-dialog button[data-variant]", CTRL],
].map(([role, sel, props]) => ({
  name: String(role),
  role: String(role),
  canvas: String(sel),
  app: String(sel),
  props: props as string[],
}));
