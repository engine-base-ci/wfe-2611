// やり取りを読む口（K-383）：listTicketTimeline（GET /api/v1/tickets/:id/timeline）。読むだけ（DB に書かない・最後に開いた時刻も書かない＝K-384）。
//   書き込み・変更の 1 行・仕組みの行・AI の実行 1 回＝1 枚を 1 本の時系列で返す（D-128.45）。新しい方から limit 件を古い順に。
//   前は before_at と before_id（いちばん古い行の時刻と id）。汎用の cursor は受けない（向きが逆・決定の 3）。
//   取引は 1 つ（withTenant）・文は 1 つ（app.ticket_timeline を 1 回）。行ごとに口から引かない。
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける。見られないチケットは関数が null → 404。守りの判定・読む所で例外 → 503・E-PAGE-003（D-136.1）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { down, invalid, notFound, type Issue } from "./reply.js";

export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 100;
export const FILTERS = ["all", "talk", "mine"] as const;
export type Filter = (typeof FILTERS)[number];

const TIME_RE = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

/** 日時として読めるか（字のまま DB に渡すので、日付が暦に在るかまで見る） */
function isTime(s: string): boolean {
  const m = TIME_RE.exec(s);
  if (!m || Number.isNaN(Date.parse(s))) return false;
  const day = m[1]!;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(day);
}

export interface TimelineQuery {
  limit: number;
  /** 確かめた字のまま（JS の Date を通さない：答えの at はマイクロ秒まで持つ・K383-API-003） */
  beforeAt: string | null;
  beforeId: string | null;
  filter: Filter;
}

/** 問い合わせを確かめる。空の値（?x=）は指定なし。before_id の uuid は入口が確かめ済み */
export function parseTimelineQuery(raw: Record<string, string>): { query: TimelineQuery } | { issues: Issue[] } {
  const q = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ""));
  const issues: Issue[] = [];
  const limit = q["limit"] === undefined ? LIMIT_DEFAULT : Number(q["limit"]);
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX)
    issues.push({ field: "limit", message: `1〜${LIMIT_MAX} の整数` });
  const beforeAt = q["before_at"] ?? null;
  const beforeId = q["before_id"] ?? null;
  if (beforeAt !== null && !isTime(beforeAt)) issues.push({ field: "before_at", message: "日時" });
  if (beforeAt !== null && beforeId === null) issues.push({ field: "before_id", message: "before_at と一緒に渡す" });
  if (beforeId !== null && beforeAt === null) issues.push({ field: "before_at", message: "before_id と一緒に渡す" });
  const filter = (q["filter"] ?? "all") as Filter;
  if (!FILTERS.includes(filter)) issues.push({ field: "filter", message: "all・talk・mine" });
  if (q["cursor"] !== undefined) issues.push({ field: "cursor", message: "before_at と before_id で前を読む" });
  return issues.length ? { issues } : { query: { limit, beforeAt, beforeId, filter } };
}

interface TimelineResult {
  items: unknown[];
  older_count: number;
  new_count: number;
  mine_count: number;
  post_count: number;
  people?: unknown[];
}

export function createListTicketTimeline(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const parsed = parseTimelineQuery(a.c.req.query());
    if ("issues" in parsed) {
      const [first, ...rest] = parsed.issues;
      return invalid(first!.field, first!.message, "VALIDATION_ERROR", rest);
    }
    const { limit, beforeAt, beforeId, filter } = parsed.query;
    let v: TimelineResult | null;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: TimelineResult | null }>(
          "select app.ticket_timeline($1, $2, $3::timestamptz, $4::uuid, $5) as v",
          [a.id, limit, beforeAt, beforeId, filter],
        );
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      return down("やり取りを読む", e);
    }
    if (!v) return notFound();
    const { items, people, ...counts } = v;
    return {
      status: 200,
      body: { data: items, meta: { limit, ...counts, ...(people === undefined ? {} : { people }) } },
    };
  };
}
