// K-446「複製（詳細の複製の小窓・作る面の「過去のチケットから複製」の元を選ぶ小窓）」の画面の試験の道具（K-446 の試験だけが読む・2026-11-20・2026-11-22 に新しい形へ）。
//   口は網の手前で差し替える。まだ作っていない口の形は、口の葉の md の答えと、K-560 が足す口にそろえた：
//     POST /api/v1/tickets（createTicket）← { scope_id, kind_id, title, assignee_member_id, due_on, duplicate_of, copy: 写す物の名前の並び }（K-438。頭 idempotency-key）
//                                          → 201 { data: { id, number, title } }。写す物の名前は body・assignee・fields・specs・links・children の 6 つ（添付は無い・D-150.9）
//     失敗は KanameError の形 { error, code, message, field? }（K-438：元が無い＝404 E-DUP-001（欄なし）・親子が 3 段を超える＝409 E-DUP-002（欄なし）・
//       会社が必須にした項目が元にも入力にも空＝409 E-FLD-004（欄なし・K-437・K-564 の番号）・選び先（担当者・種別）が選べない＝404 E-PAGE-001（欄なし・控え帳）・
//       過去の期限＝409 E-VAL-012（欄なし・今日で決まる物）・書けない＝403。必須の区画が空の E-VAL-013 は無くなった（本文は 1 枚で空でも作れる））
//     GET /api/v1/tickets?q=…&view=all&limit=20 → 行（K-92。行に scope: { id, name } を足す＝K-560 が足す口）
//     GET /api/v1/tickets/:id（getTicket）       → K-560 の答え（body・fields・spec_count・spec_unchecked・no_spec_reason・parent・child_count・link_count・results）。元の ticket に scope_id・kind_id・due_on・title がある
//   作る面の口（下書き・グループの一覧）は前からの土台 create-mock.ts の mockCreate、詳細は前からの土台 mockApi をそのまま使う。
//   名前と日付は下絵 /dev/mock/f4 の見本（f4-dup-pick・f4-dup-dialog・f4-dup-error）と同じにする（matchMock で字を比べるため）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page, Request, Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  API_RE,
  mockApi,
  ticketOf,
  withBand,
  type Band,
  type Mock,
  type Reply,
} from "../features/F5/approve-complete.harness";
import { BOSS, ME, NEW_ID, SCOPE, TASK, WS } from "./create-mock";
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
/** 口の断り（正本の番号つき）。field は 422（契約に書ける形の誤り）のときだけ欄の理由として付ける（404・409 は付けない） */
export const errReply = (status: number, code: string, field?: string): Reply => ({
  status,
  body: {
    error: status === 409 ? "conflict" : status === 404 ? "not_found" : "validation_failed",
    code,
    message: msgOf(code),
    // 控え帳の決め：404・409 は欄も details も付けない（422 だけ欄の理由を持つ）。欄を特定できないので画面は 1 つの文を赤い箱に出す
    ...(field && status === 422 ? { field, details: [{ field, message: msgOf(code) }] } : {}),
  },
});
/** 入口の「無い・見えない」（getTicket の 404・code は NOT_FOUND。口の中で消えた・無い物の E-PAGE-001 とは別） */
export const NOT_FOUND: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
export const SERVER_ERROR: Reply = { status: 500, body: { error: "server_error", code: "INTERNAL" } };
/** K-560 が足す getTicket の列のうち、複製が読まない物の既定（本文は空・会社の項目は 0 件・確認項目は 0 件・親なし・結果なし）。前の形の sections は空 */
export const NEW_FORM = {
  body: { doc: { type: "doc", content: [] }, text: "", version: 0 },
  fields: [],
  spec_count: 0,
  spec_unchecked: 0,
  no_spec_reason: null,
  parent: null,
  link_count: 0,
  results: {},
  sections: [],
};
/** 下絵の失敗の状態（f4-dup-error）の文：口が落ちた・つながらないときの、小窓の上の赤い知らせ */
export const FAILED_TEXT =
  "複製できませんでした。ネットがつながっていないか、Kaname が混み合っています。もう一度「複製して開く」を押してください";

// ---------------------------------------------------------------- 複製の元の候補（下絵の見本と同じ名前・グループ・段・期限）
export interface Src {
  id: string;
  number: string;
  title: string;
  stage: string;
  due_on: string;
  scope: { id: string; name: string };
  assignee: { id: string; display_name: string };
  /** 直接の子の数（getTicket の child_count） */
  children: number;
}
const EG = { id: SCOPE, name: "営業" };
const KR = { id: "22222222-0000-4000-8000-000000000003", name: "経理" };
export const D128: Src = {
  id: "0193c5a0-0000-7000-8000-00000000c4b1",
  number: "EG-128",
  title: "セイコー様へ 11月分の請求書を送る",
  stage: "完了",
  due_on: "2026-11-01",
  scope: EG,
  assignee: { id: BOSS, display_name: "佐藤" },
  children: 2,
};
export const D103: Src = {
  id: "0193c5a0-0000-7000-8000-00000000c4b2",
  number: "EG-103",
  title: "セイコー様へ 10月分の請求書を送る",
  stage: "完了",
  due_on: "2026-10-01",
  scope: EG,
  assignee: { id: BOSS, display_name: "佐藤" },
  children: 0,
};
export const K024: Src = {
  id: "0193c5a0-0000-7000-8000-00000000c4b3",
  number: "KR-024",
  title: "10月分 請求書をまとめて出す",
  stage: "完了",
  due_on: "2026-10-25",
  scope: KR,
  assignee: { id: ME, display_name: "高本" },
  children: 0,
};
export const SOURCES: Src[] = [D128, D103, K024];

const HYPHENS = /[‐‑‒–—―ー−－]/g;
const hit = (r: Src, q: string): boolean => {
  const n = q.normalize("NFKC").trim().toLowerCase();
  return (
    r.title.normalize("NFKC").toLowerCase().includes(n) || r.number.toLowerCase().includes(n.replace(HYPHENS, "-"))
  );
};
const item = (r: Src) => ({
  id: r.id,
  number: r.number,
  title: r.title,
  kind: { id: TASK, name: "タスク" },
  stage: { id: "0193c5a0-0000-7000-8000-00000000c4f2", name: r.stage, key: "done" },
  assignee: r.assignee,
  delegated_to_clone: false,
  due_on: r.due_on,
  overdue: false,
  updated_at: "2026-11-15T00:00:00Z",
  parent_ticket_id: null,
  depth: 1,
  scope: r.scope,
});
const detailOf = (r: Src) => ({
  ticket: {
    id: r.id,
    number: r.number,
    title: r.title,
    due_on: r.due_on,
    start_on: null,
    priority: "mid",
    scope_id: r.scope.id,
    kind_id: TASK,
  },
  ...NEW_FORM,
  kind: { id: TASK, name: "タスク" },
  stage: { name: r.stage, key: "done" },
  assignee: r.assignee,
  can: {},
  approval: null,
  completed: null,
  child_count: r.children,
});

export interface SrcState {
  rows: Src[];
  /** 一覧の口（探す）に届いた問い合わせ */
  calls: URLSearchParams[];
  /** 一覧の口の答えの状態。200 以外なら体はエラー */
  status: number;
  /** 元の getTicket の答え。null なら 200。数字ならその状態で断る */
  detailStatus: number | null;
  /** 元の getTicket を読んだ回数 */
  reads: number;
}

/** 複製の元の一覧の口と、元 1 件の詳細の口を差し替える（作る面に足す） */
export async function routeSources(page: Page, rows: Src[] = SOURCES): Promise<SrcState> {
  const s: SrcState = { rows, calls: [], status: 200, detailStatus: null, reads: 0 };
  await page.route(API_RE, async (route: Route, req: Request) => {
    if (req.method() !== "GET") return route.fallback();
    const u = new URL(req.url());
    let reply: Reply | null = null;
    if (u.pathname === "/api/v1/tickets") {
      s.calls.push(u.searchParams);
      const q = u.searchParams.get("q") ?? "";
      reply =
        s.status !== 200
          ? SERVER_ERROR
          : ok(q.trim() === "" ? [] : s.rows.filter((r) => hit(r, q)).map(item), { next_cursor: null });
    } else {
      const one = s.rows.find((r) => u.pathname === `/api/v1/tickets/${r.id}`);
      if (one) {
        s.reads++;
        reply = s.detailStatus === null ? ok(detailOf(one)) : s.detailStatus === 404 ? NOT_FOUND : SERVER_ERROR;
      }
    }
    if (!reply) return route.fallback();
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return s;
}

// ---------------------------------------------------------------- 作る口（複製）
export interface DupPost {
  /** 作る口（createTicket）に届いた要求 */
  posts: { body: Record<string, unknown>; key: string | undefined }[];
  /** 書く口の答えを止めておく。返した関数を呼ぶと答える（時間で待たない・二度押しを見る） */
  hold: () => () => void;
  gate: Promise<void>;
  /** 成功の答え（201・新しいチケット） */
  ok: () => Reply;
  on: { create: (req: Request) => Reply | Promise<Reply> };
}
/** 作る口（POST /tickets）と、作った後の詳細（新しい id の getTicket・実行の一覧）を差し替える */
export async function routeCreate(page: Page): Promise<DupPost> {
  const p: DupPost = {
    posts: [],
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      p.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    ok: () => ({ status: 201, body: { data: { id: NEW_ID, number: "EG-133", title: "作った" } } }),
    on: { create: () => p.ok() },
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const path = new URL(req.url()).pathname;
    let reply: Reply | null = null;
    if (req.method() === "POST" && path === "/api/v1/tickets") {
      p.posts.push({ body: req.postDataJSON() as Record<string, unknown>, key: req.headers()["idempotency-key"] });
      await p.gate;
      reply = await p.on.create(req);
    } else if (req.method() === "GET" && path === `/api/v1/tickets/${NEW_ID}`) {
      reply = ok({
        ticket: { id: NEW_ID, number: "EG-133", title: "作った", due_on: null, start_on: null, priority: "mid" },
        ...NEW_FORM,
        kind: { name: "タスク" },
        stage: { name: "未着手" },
        assignee: { display_name: "高本" },
      });
    } else if (req.method() === "GET" && path === `/api/v1/tickets/${NEW_ID}/runs`) {
      reply = ok([]);
    }
    if (!reply) return route.fallback();
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return p;
}

// ---------------------------------------------------------------- 詳細（複製のボタン）
/** 下絵の見本と同じチケット（モックの TICKET） */
export const NUMBER = "EG-119";
export const TITLE = "問い合わせ（山田様）に一次返信する";

export interface DetailDup {
  /** getTicket（見ているチケット）を読んだ回数 */
  ticketReads: number;
  post: DupPost;
}
export interface DetailOptions {
  /** 直接の子の数（既定 2） */
  children?: number;
  /** 見ているチケットの期限（既定 2026-11-27。null なら期限が空の古いチケット） */
  due_on?: string | null;
  /** 見ているチケットの担当者（既定は佐藤。null なら担当者のいないチケット）。見ている人は高本 */
  assignee?: { id: string; display_name: string } | null;
  band?: Band;
}
/** 詳細（土台 mockApi）に、複製の小窓に要る答え（getTicket の scope_id・kind_id・担当者の id・child_count・グループの一覧・作る口）を足す */
export async function setupDetail(page: Page, o: DetailOptions = {}): Promise<{ api: Mock; d: DetailDup }> {
  const band: Band = o.band ?? { stage: "doing" };
  const api = await mockApi(page, band);
  const post = await routeCreate(page);
  const d: DetailDup = { ticketReads: 0, post };
  api.on.ticket = () => {
    d.ticketReads++;
    const base = ticketOf(band) as unknown as { ticket: Record<string, unknown> } & Record<string, unknown>;
    return ok(
      withBand(band, {
        ...base,
        ticket: {
          ...base.ticket,
          number: NUMBER,
          title: TITLE,
          due_on: o.due_on === undefined ? "2026-11-27" : o.due_on,
          start_on: "2026-11-20",
          scope_id: SCOPE,
          kind_id: TASK,
        },
        kind: { id: TASK, name: "タスク" },
        assignee: o.assignee === undefined ? { id: BOSS, display_name: "佐藤" } : o.assignee,
        // K-560 が足す getTicket の列（本文・会社の項目・確認項目の数・親・つながりの数・結果の場所は複製が読まないので空。直接の子の数だけ足す）
        ...NEW_FORM,
        child_count: o.children ?? 2,
      }),
    );
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    if (req.method() !== "GET" || new URL(req.url()).pathname !== "/api/v1/scopes") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ id: SCOPE, name: "営業", tenant_id: WS, ticket_prefix: "EG" }],
        meta: { limit: 200, writable: [SCOPE] },
      }),
    });
  });
  return { api, d };
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
export const DUP_PAIRS: FidelityPair[] = [
  ["dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]],
  ["head", ".k-dialog-head", ["x", "y", "width", "height", "texts"]],
  ["notice", ".k-dialog .k-band-notice", ["x", "width", "background-color", ...TEXT]],
  ["label", ".k-dialog .k-label", ["font-size", "font-weight", "texts"]],
  ["title-input", ".k-dialog input[name='dup_title']", ["width", "height", "x", "y", "border-top-color", "font-size"]],
  ["hint", ".k-dialog .k-hint, .k-dialog .k-desc", TEXT],
  ["due", ".k-f4-dup-due", ["width", "height", "x", "y", "border-top-color", "font-size", "texts"]],
  ["row", ".k-f4-dup-row", ["x", "height", "opacity", "texts"]],
  ["note", ".k-f4-dup-note", ["x", ...TEXT]],
  ["skip", ".k-f4-dup-skip", ["x", ...TEXT]],
  ["legend", ".k-dialog legend", TEXT],
  ["item", ".k-f4-pick-item", ["width", "height", "x", "opacity", "texts"]],
  ["search", ".k-dialog input[name='pick_query']", ["width", "height", "x", "y", "border-top-color", "font-size"]],
  ["btn", ".k-dialog-actions button", CTRL],
].map(([role, sel, props]) => ({
  name: String(role),
  role: String(role),
  canvas: String(sel),
  app: String(sel),
  props: props as string[],
}));
