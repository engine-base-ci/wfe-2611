// 承認待ちを見る（K-161）の読む口：listApprovalQueue（自分が決める承認待ち）・getApproval（承認の 1 件）。読むだけ（書かない）。
//   一覧は 1 回 20 件（既定・最大 200）。続きは鍵の文字列（最後に返した行の due_on・created_at・id を | でつないで base64url）で、
//   その行の次から読む（間に新しい行が入っても重複・飛びを出さない）。絞るのも切るのも DB の関数（G-16・D-131.9）。数は DB の count。
//   読む前の片付け（24 時間を過ぎた待ちの仕事を止める）は K-164 が足す
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import { withTenant } from "@kaname/db/context";
import type { Hook, HookArgs } from "../../../contract/deps.js";
import { invalid, replyOf } from "./errors.js";

export const LIMIT_DEFAULT = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

/** 続きの鍵（期限なしの行は due が null） */
export interface QueueKey {
  due: string | null;
  created: string;
  id: string;
}

const realDate = (s: string) =>
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** 鍵の文字列を読む。読めない（復号できない・3 つに分かれない・日付や時刻や uuid でない）なら null */
export function decodeKey(cursor: string): QueueKey | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) return null;
  const text = Buffer.from(cursor, "base64url").toString("utf8");
  if (Buffer.from(text, "utf8").toString("base64url") !== cursor) return null; // 復号して戻らない＝壊れている
  const parts = text.split("|");
  if (parts.length !== 3) return null;
  const [due, created, id] = parts as [string, string, string];
  if (due !== "" && !(DATE_RE.test(due) && realDate(due))) return null;
  if (!TIME_RE.test(created) || Number.isNaN(Date.parse(created))) return null;
  if (!isUuid(id)) return null;
  return { due: due === "" ? null : due, created, id };
}
export const encodeKey = (k: QueueKey): string =>
  Buffer.from(`${k.due ?? ""}|${k.created}|${k.id}`, "utf8").toString("base64url");

interface QueueItem {
  id: string;
  due_on: string | null;
  created_at: string;
}

async function listQueue(pool: pg.Pool, a: HookArgs) {
  const q = a.c.req.query();
  // limit は入口（op.ts）が 1〜200 の整数と確かめ済み。cursor は入口が base64url の形だけ確かめ、中身はここで確かめる
  const limit = q["limit"] ? Number(q["limit"]) : LIMIT_DEFAULT;
  const key = q["cursor"] ? decodeKey(q["cursor"]) : null;
  if (q["cursor"] && !key) return invalid("cursor", "続きの印が不正です");
  const { rows, total } = await withTenant(pool, a.ctx, async (cl) => {
    const r = await cl.query<{ v: QueueItem[] }>("select app.approval_queue($1, $2, $3, $4) as v", [
      limit + 1,
      key?.due ?? null,
      key?.created ?? null,
      key?.id ?? null,
    ]);
    const n = await cl.query<{ n: number }>("select app.approval_queue_count() as n");
    return { rows: r.rows[0]?.v ?? [], total: Number(n.rows[0]?.n ?? 0) };
  });
  const data = rows.slice(0, limit);
  const last = data.at(-1);
  const more = rows.length > limit && last;
  return {
    status: 200,
    body: {
      data,
      meta: {
        limit,
        ...(more ? { cursor: encodeKey({ due: last.due_on, created: last.created_at, id: last.id }) } : {}),
        counts: { total },
      },
    },
  };
}

async function getOne(pool: pg.Pool, a: HookArgs) {
  const v = await withTenant(pool, a.ctx, async (cl) => {
    const r = await cl.query<{ v: Record<string, unknown> | null }>("select app.approval_detail($1) as v", [a.id]);
    return r.rows[0]?.v ?? null;
  });
  // 読めない・成果物の承認でない（D-131.11）・消された は、どれも同じ 404（中身を返さない）
  if (!v) return replyOf({ error: "not_found" }, "getApproval");
  return { status: 200, body: { data: v } };
}

export function queueHooks(pool: pg.Pool): Record<string, Hook> {
  return {
    listApprovalQueue: { before: (a) => listQueue(pool, a) },
    getApproval: { before: (a) => getOne(pool, a) },
  };
}
