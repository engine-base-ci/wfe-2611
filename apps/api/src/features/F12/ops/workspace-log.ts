// 運営が 1 社の問い合わせと記録を読む口（K-1011・関門 C2・D-156.3・D-156.12・D-156.17・D-156.25・D-125.129・D-128.108）：
//   listOpsWorkspaceInquiries（GET /api/v1/ops/workspaces/:id/inquiries）… 問い合わせの 7 欄の並び（K-1006）。内容（本文・やり取り）は出さない
//   listOpsWorkspaceAudit（GET /api/v1/ops/workspaces/:id/audit）… 運営の記録の 7 欄の並び（K-1006）。from・to（日本時間の日付・両端を含む）と limit
//   読むだけ（DB に書かない・運営の記録も書かない）。振る舞いの本体は DB の関数 app.ops_workspace_inquiries・app.ops_workspace_audit
//   （20261128015100_ops_workspace_log.sql）。上限・認証・運営の人だけ（ops:any／ops:inquiry）・道の id と問い合わせの値の形は契約の入口（op.ts）が
//   先に確かめる。ここでも形を確かめ（入口に頼らない 2 層目）、opsTx の 1 取引で関数を 1 回呼ぶ。DB の断りは opsErrorReply（K-947）
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

/** 件数の既定と上限（上限は契約の LIST_DETAILS["listOpsWorkspaceAudit"].limit_max と同じ・持ち主は K-1006 の断片） */
export const AUDIT_LIMIT_DEFAULT = 50;
export const AUDIT_LIMIT_MAX = 100;

interface Issue {
  field: string;
  message: string;
}
export interface AuditQuery {
  from: string | null;
  to: string | null;
  limit: number;
}

/** 契約の問い合わせの名前（listOpsWorkspaceAudit） */
const AUDIT_QUERY_KEYS: ReadonlySet<string> = new Set(["from", "to", "limit", "cursor"]);

const DATE_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

/** YYYY-MM-DD の暦に在る日付か（2026-13-01・2026-02-30 は違う） */
export function isDate(v: string): boolean {
  const m = DATE_RE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

const dateOf = (raw: string | undefined, field: string, issues: Issue[]): string | null => {
  if (raw === undefined || raw === "") return null;
  if (isDate(raw)) return raw;
  issues.push({ field, message: "YYYY-MM-DD" });
  return null;
};

/** 問い合わせの値を整える。空の値は指定なし（from・to は絞らない・limit は 50）。cursor は形だけ（読まない） */
export function parseAuditQuery(
  raw: Record<string, string>,
): { ok: true; value: AuditQuery } | { ok: false; details: Issue[] } {
  const issues: Issue[] = [];
  // 契約に無い問い合わせの名前は 422（入口の zod は問い合わせを見ない）
  for (const k of Object.keys(raw))
    if (!AUDIT_QUERY_KEYS.has(k)) issues.push({ field: k, message: "知らない問い合わせ" });
  const from = dateOf(raw["from"], "from", issues);
  const to = dateOf(raw["to"], "to", issues);
  const limitRaw = raw["limit"] ?? "";
  let limit = AUDIT_LIMIT_DEFAULT;
  if (limitRaw !== "") {
    limit = /^[0-9]{1,3}$/.test(limitRaw) ? Number(limitRaw) : NaN;
    if (!Number.isInteger(limit) || limit < 1 || limit > AUDIT_LIMIT_MAX)
      issues.push({ field: "limit", message: `1〜${AUDIT_LIMIT_MAX} の整数` });
  }
  if (issues.length) return { ok: false, details: issues };
  return { ok: true, value: { from, to, limit } };
}

const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

/** 道の id（入口が先に止めるので、ここに来るのは入口が抜けたときだけ） */
const idOf = (a: HookArgs): string => a.id ?? a.c.req.param("id") ?? "";

export function createListOpsWorkspaceInquiries(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const id = idOf(a);
    if (!isUuid(id)) return invalid([{ field: "id", message: "uuid" }]);
    try {
      const data = await opsTx(appPool, a.ctx, async (cl: pg.PoolClient) => {
        const r = await cl.query<{ j: unknown }>("select app.ops_workspace_inquiries($1::uuid) as j", [id]);
        return r.rows[0]!.j;
      });
      return { status: 200, body: { data } };
    } catch (e) {
      return opsErrorReply(e, "workspace-inquiries");
    }
  };
}

export function createListOpsWorkspaceAudit(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const id = idOf(a);
    if (!isUuid(id)) return invalid([{ field: "id", message: "uuid" }]);
    const parsed = parseAuditQuery(a.c.req.query());
    if (!parsed.ok) return invalid(parsed.details);
    const v = parsed.value;
    try {
      const data = await opsTx(appPool, a.ctx, async (cl: pg.PoolClient) => {
        const r = await cl.query<{ j: unknown }>(
          "select app.ops_workspace_audit($1::uuid, $2::date, $3::date, $4::integer) as j",
          [id, v.from, v.to, v.limit],
        );
        return r.rows[0]!.j;
      });
      return { status: 200, body: { data } };
    } catch (e) {
      return opsErrorReply(e, "workspace-audit");
    }
  };
}
