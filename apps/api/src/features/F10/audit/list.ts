// 記録を探す口（K-823）：listAuditEvents（GET /api/v1/audit_events）。読むだけ（DB に書かない・外へ送らない）。
//   誰が読めるかは DB の関数 app.audit_list が見る（管理者は会社の全部・マネージャーは自分のグループの分・それ以外は 42501 → 403）。
//   取引は 1 つ（withTenant）・文は 2 つ（一覧・答えの scope）。1 行余分に読んで続きの印を作る。件数の合計は返さない（範囲の外を漏らさない）。
//   文（text）は取引の外で作る（lines.ts）。Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける。ログに payload を出さない
//   ことば（q・K-850）が在れば search.ts の道：同じ app.audit_list を 1 つの取引の中で 500 行ずつ最大 5000 行読み、口の側で当たりを選ぶ。
//   答えに scan_capped を足す（q が在るときだけ）。q が無ければこの葉の道のまま。走査の途中の DB の失敗も 503（途中までの答えを返さない）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { lineOf } from "./lines.js";
import { encodeAuditCursor, parseAuditQuery, type AuditKind, type AuditQuery } from "./patterns.js";
import { searchAudit } from "./search.js";

const LIST_SQL = `
select l.id, l.occurred_at, l.action, l.kind, l.actor_id, l.actor_name, l.target_type, l.target_id, l.target_label, l.payload,
       to_char(l.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as occurred_key
  from app.audit_list($1::text, $2::uuid, $3::uuid, $4::timestamptz, $5::timestamptz, $6::timestamptz, $7::uuid, $8::int) l`;
const SCOPE_SQL = "select app.audit_scope_kind() as scope";

interface Row {
  id: string;
  occurred_at: Date;
  action: string;
  kind: string | null;
  actor_id: string | null;
  actor_name: string | null;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  payload: Record<string, unknown> | null;
  occurred_key: string;
}

/** 画面が使う 1 行の形（K-825 の正本） */
export interface AuditEntry {
  id: string;
  occurred_at: string;
  kind: AuditKind | null;
  action: string;
  actor: { id: string; name: string } | null;
  target: { type: string; id: string; label: string | null } | null;
  text: string;
  reason: string | null;
  device: string | null;
  step_up: boolean;
  deleted: boolean;
}

const textOf = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export function toEntry(r: Row): AuditEntry {
  const payload = r.payload ?? {};
  return {
    id: r.id,
    occurred_at: r.occurred_at.toISOString(),
    kind: r.kind as AuditKind | null,
    action: r.action,
    actor: r.actor_id ? { id: r.actor_id, name: r.actor_name ?? "" } : null,
    target: r.target_id ? { type: r.target_type, id: r.target_id, label: r.target_label } : null,
    text: lineOf({ action: r.action, target_label: r.target_label, payload }),
    reason: textOf(payload["reason"]),
    device: textOf(payload["device"]),
    step_up: payload["step_up"] === true,
    deleted: r.kind === "deleted",
  };
}

/** app.audit_list に渡す値（絞りはそのまま・続きの位置と読む数は呼ぶ側が決める） */
const listParams = (q: AuditQuery, after: { at: string; id: string } | null, n: number): unknown[] => [
  q.kind,
  q.memberId,
  q.ticketId,
  q.from,
  q.to,
  after?.at ?? null,
  after?.id ?? null,
  n,
];

/** ことばで探す（K-850）：1 つの取引の中で走査し、答えの scope も同じ取引で読む */
async function searchInTenant(appPool: pg.Pool, a: HookArgs, q: AuditQuery & { words: string[] }) {
  return withTenant(appPool, a.ctx, async (cl) => {
    const found = await searchAudit<Row>(
      async (after, n) => (await cl.query<Row>(LIST_SQL, listParams(q, after, n))).rows,
      toEntry,
      q,
    );
    const s = await cl.query<{ scope: string | null }>(SCOPE_SQL);
    return {
      entries: found.entries,
      next_cursor: found.next_cursor,
      scope: s.rows[0]?.scope ?? null,
      scan_capped: found.scan_capped,
    };
  });
}

export function createListAuditEvents(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const parsed = parseAuditQuery(a.c.req.query());
    if (!parsed.ok)
      return { status: 422, body: { error: "validation_failed", code: parsed.code, details: parsed.details } };
    const q = parsed.value;
    try {
      if (q.words) return { status: 200, body: { data: await searchInTenant(appPool, a, { ...q, words: q.words }) } };
      const { rows, scope } = await withTenant(appPool, a.ctx, async (cl) => {
        const list = await cl.query<Row>(LIST_SQL, listParams(q, q.after, q.limit));
        const s = await cl.query<{ scope: string | null }>(SCOPE_SQL);
        return { rows: list.rows, scope: s.rows[0]?.scope ?? null };
      });
      const page = rows.slice(0, q.limit);
      const last = page[page.length - 1];
      const next = rows.length > q.limit && last ? encodeAuditCursor(last.occurred_key, last.id) : null;
      return { status: 200, body: { data: { entries: page.map(toEntry), next_cursor: next, scope } } };
    } catch (ex) {
      if ((ex as { code?: unknown }).code === "42501")
        return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
      console.error("[audit] 記録を読めなかった");
      return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
    }
  };
}
