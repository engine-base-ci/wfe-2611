// 運営の請求の一覧の口（K-983・listOpsInvoices・GET /api/v1/ops/invoices・関門 C2・D-156.24・D-156.29・D-156.44・D-156.54）。
//   振る舞いの本体は DB の関数 app.ops_invoices（20261128012300_ops_invoices_list.sql）：同じ取引の中で、まだ知らせていない
//   期限を過ぎた請求書の管理者に鈴を 1 回だけ書き（時間で動く仕組みは作らない）、その月の請求書と、前の月の分でも期限を過ぎた物を上に返す。
//   上限・認証・お金を持つ運営の人だけ（ops:money）・問い合わせの値の形は契約の入口（op.ts）が先に確かめる。
//   ここでも値の形を確かめ（入口に頼らない 2 層目）、opsTx の 1 取引で関数を 1 回呼ぶ。DB の断りは opsErrorReply（K-947）：
//   落ちたら 503 E-PAGE-003（中身を返さない・鈴も印も記録も同じ取引で戻る）
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

export const INVOICE_STATES = ["unpaid", "paid", "overdue"] as const;
/** 一覧の件数の上限と既定（契約の LIST_DETAILS の limit_max と同じ） */
export const INVOICES_LIMIT_MAX = 100;
const MONTH = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

interface Issue {
  field: string;
  message: string;
}
export interface InvoicesQuery {
  /** YYYY-MM。null は日本の先月（関数が決める） */
  month: string | null;
  state: (typeof INVOICE_STATES)[number] | null;
  limit: number;
}

/** 問い合わせの値を整える。空の値は指定なし。cursor は形だけ（答えを変えない） */
export function parseInvoicesQuery(
  raw: Record<string, string>,
): { ok: true; value: InvoicesQuery } | { ok: false; details: Issue[] } {
  const issues: Issue[] = [];
  const month = raw["month"] ?? "";
  if (month !== "" && !MONTH.test(month)) issues.push({ field: "month", message: "YYYY-MM" });
  const state = raw["state"] ?? "";
  if (state !== "" && !(INVOICE_STATES as readonly string[]).includes(state))
    issues.push({ field: "state", message: INVOICE_STATES.join("・") });
  const limitRaw = raw["limit"] ?? "";
  let limit = INVOICES_LIMIT_MAX;
  if (limitRaw !== "") {
    limit = /^[0-9]{1,4}$/.test(limitRaw) ? Number(limitRaw) : NaN;
    if (!Number.isInteger(limit) || limit < 1 || limit > INVOICES_LIMIT_MAX)
      issues.push({ field: "limit", message: `1〜${INVOICES_LIMIT_MAX} の整数` });
  }
  if (issues.length) return { ok: false, details: issues };
  return {
    ok: true,
    value: {
      month: month === "" ? null : month,
      state: state === "" ? null : (state as InvoicesQuery["state"]),
      limit,
    },
  };
}

export function createListOpsInvoices(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const parsed = parseInvoicesQuery(a.c.req.query());
    if (!parsed.ok)
      return { status: 422, body: { error: "validation_failed", code: "VALIDATION_ERROR", details: parsed.details } };
    const v = parsed.value;
    try {
      const data = await opsTx(appPool, a.ctx, async (cl: pg.PoolClient) => {
        const r = await cl.query<{ j: { data: unknown[] } }>("select app.ops_invoices($1, $2, $3) as j", [
          v.month,
          v.state,
          v.limit,
        ]);
        return r.rows[0]!.j.data;
      });
      return { status: 200, body: { data } };
    } catch (e) {
      return opsErrorReply(e, "invoices-list");
    }
  };
}
