// 完了にする小窓の注意（K-572）の試験の道具（K-572 が持つ）。
//   詳細と帯は前からの土台 tests/features/F5/approve-complete.harness.ts の mockApi（getTicket・実行・自分の情報・完了の口）。
//   その上に、次の 3 つだけを網の手前で重ねる：
//     GET  /api/v1/tickets/:id            … K-560 が足す body（{ doc, text }）・spec_count・spec_unchecked を載せる
//     GET  /api/v1/tickets/:id/test-specs … K-434 の listTestSpecs：200 { data: [{ id, title, checked, position, source }], meta: { count, limit, can_edit } }
//     POST /api/v1/tickets/:id/complete   … K-566：201 { data: { ticket, knowledge_candidates, skipped_reason, unchecked: { body, specs } } }
//                                           （todo_checked・todo_version は送らなくてよい・conditions_confirmed だけ要る）
//   完了を押すと getTicket の答えが「完了」に替わる（帯が「完了しました」になる）。口の振る舞いそのものは K-566 の試験が持つ。
//   本人の Bridge（127.0.0.1:38617）にも届かせない（mockApi が網の手前で止める）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, type Request, type Route } from "@playwright/test";
import {
  API_RE,
  ME,
  TICKET,
  executedBand,
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
export { TICKET };
export const CHILD = "0193c5a0-0000-7000-8000-00000000c064";

// ---------------------------------------------------------------- 文書の木（K-561 の形）
export type Node = Record<string, unknown>;
const text = (t: string): Node => ({ type: "text", text: t });
const para = (t: string): Node => ({ type: "paragraph", content: t ? [text(t)] : [] });
/** attrs を持たない箱の印（未チェックに数える形） */
export const NO_ATTRS = Symbol("no-attrs");
/** チェックの箱。checked が true／false 以外（"true"・null・NO_ATTRS）も作れる（真偽の true でなければ未チェックに数える） */
export const task = (t: string, checked: unknown = false, nested: Node[] = []): Node => ({
  type: "taskItem",
  ...(checked === NO_ATTRS ? {} : { attrs: { checked } }),
  content: [para(t), ...(nested.length ? [{ type: "taskList", content: nested }] : [])],
});
export const taskList = (items: Node[]): Node => ({ type: "taskList", content: items });
export const docOf = (...blocks: Node[]): Node => ({ type: "doc", content: blocks });
/** 本文の素の字（口が docToText で作る物の代わり。この試験では見ない） */
const textOf = (_doc: Node): string => "本文";

/** K-566 の数え方（口と画面が同じ定義）：taskItem で attrs.checked が真偽の true でない物の数（入れ子も数える・段落の字の「[ ]」は数えない） */
export function serverCount(node: unknown): number {
  if (typeof node !== "object" || node === null) return 0;
  const n = node as { type?: unknown; attrs?: { checked?: unknown }; content?: unknown };
  const own = n.type === "taskItem" && n.attrs?.checked !== true ? 1 : 0;
  return own + (Array.isArray(n.content) ? n.content.reduce((s: number, c: unknown) => s + serverCount(c), 0) : 0);
}

/** 下絵 f4v2-complete と同じ本文：チェックの無い 2 つ */
export const T1 = "請求書を作って佐藤さんに確かめてもらう";
export const T2 = "送ったあとに入金の予定日を控える";
export const S1 = "請求額が明細の合計と合っている";
export const DEFAULT_DOC = (): Node => docOf(para("目的：請求書を送る"), taskList([task(T1), task(T2)]));
export const ALL_DONE_DOC = (): Node => docOf(para("目的：請求書を送る"), taskList([task(T1, true), task(T2, true)]));
export const NO_TASK_DOC = (): Node => docOf(para("目的：請求書を送る"));

export interface SpecLite {
  id: string;
  title: string;
  checked: boolean;
}
export const spec = (n: number, title: string, checked = false): SpecLite => ({
  id: `0193c5a0-0000-7000-8000-0000000500${String(n).padStart(2, "0")}`,
  title,
  checked,
});

export interface CompleteMock {
  api: Mock;
  /** getTicket の本文（null なら body を載せない＝前の口） */
  doc: Node | null;
  specs: SpecLite[];
  /** listTestSpecs に飛んだ数 */
  specReads: number;
  /** 次の listTestSpecs の答えを順に差し替える */
  nextSpecs: (Reply | null)[];
  ticketReads: number;
  /** 完了の口を処理した後の getTicket の答えを「完了」に替える */
  done: boolean;
  /** 書く口（POST・PATCH・PUT・DELETE）のうち、完了の口以外 */
  otherWrites: string[];
}

export async function mockComplete(
  page: Page,
  o: Partial<Pick<CompleteMock, "doc" | "specs">> & { band?: Band } = {},
): Promise<CompleteMock> {
  const band: Band = o.band ?? executedBand;
  const api = await mockApi(page, band);
  const m: CompleteMock = {
    api,
    doc: o.doc === undefined ? DEFAULT_DOC() : o.doc,
    specs: o.specs ?? [],
    specReads: 0,
    nextSpecs: [],
    ticketReads: 0,
    done: false,
    otherWrites: [],
  };
  const unchecked = () => ({ body: m.doc ? serverCount(m.doc) : 0, specs: m.specs.filter((s) => !s.checked).length });
  api.on.ticket = () => {
    const base = ticketOf(m.done ? { stage: "done", completed: { at: "2026-11-21T03:00:00Z", by: "高本" } } : band);
    return {
      status: 200,
      body: {
        data: withBand(band, {
          ...(base as unknown as Record<string, unknown>),
          body: m.doc ? { doc: m.doc, text: textOf(m.doc) } : undefined, // 前の口の答えは body を持たない（harness の既定の body を消す）
          spec_count: m.specs.length,
          spec_unchecked: m.specs.filter((s) => !s.checked).length,
          no_spec_reason: null,
        }),
      },
    };
  };
  api.on.complete = () => ({
    status: 201,
    body: {
      data: {
        ticket: {
          id: TICKET,
          number: "EG-133",
          stage_key: "done",
          completed_at: "2026-11-21T03:00:00Z",
          completed_by: ME,
        },
        knowledge_candidates: [],
        skipped_reason: "候補はまだ出していません",
        unchecked: unchecked(),
      },
    },
  });
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const get = req.method() === "GET";
    const fulfill = (r: Reply) =>
      route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    if (get && p === `/api/v1/tickets/${TICKET}`) {
      m.ticketReads += 1;
      return route.fallback();
    }
    if (get && p === `/api/v1/tickets/${TICKET}/test-specs`) {
      m.specReads += 1;
      return fulfill(
        m.nextSpecs.shift() ?? {
          status: 200,
          body: {
            data: m.specs.map((s, i) => ({
              id: s.id,
              title: s.title,
              checked: s.checked,
              position: i + 1,
              source: "manual",
            })),
            meta: { count: m.specs.length, limit: 200, can_edit: true },
          },
        },
      );
    }
    if (req.method() === "POST" && p === `/api/v1/tickets/${TICKET}/complete`) {
      api.completes.push(req.postDataJSON() as Record<string, unknown>);
      await api.gate;
      const r = await api.on.complete(req);
      if (r.status === 201) m.done = true;
      return fulfill(r);
    }
    if (!get && !/\/auth\//.test(p)) m.otherWrites.push(`${req.method()} ${p}`);
    return route.fallback();
  });
  return m;
}

// ---------------------------------------------------------------- 断りの答え
const err = (status: number, error: string, code: string, extra: Record<string, unknown> = {}): Reply => ({
  status,
  body: { error, code, ...extra },
});
export const failed = (): Reply => err(503, "server_error", "E-PAGE-003");
export const notFound = (): Reply => err(404, "not_found", "E-PAGE-001");
export const conflict = (code: string, message: string): Reply => err(409, "conflict", code, { message });
/** 終わっていない子（422・E-VAL-024・詳細に子の番号と題名と id） */
export const childrenLeft = (): Reply => ({
  status: 422,
  body: {
    error: "validation_failed",
    code: "E-VAL-024",
    message: "終わっていない子のチケットがあります。先に子を完了にしてください",
    details: [{ field: "children", message: "EG-134 宛名を確かめる", id: CHILD }],
  },
});

// ---------------------------------------------------------------- 画面の道具
export const noOverflow = async (page: Page, w: number): Promise<void> => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, `幅 ${w} の横溢れ`).toBe(0);
};
