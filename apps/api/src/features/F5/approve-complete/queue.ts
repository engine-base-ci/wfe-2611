// 承認して完了する（K-63）の読む口：listApprovalQueue（自分が決める承認待ち）・getApproval（承認の 1 件）。
//   読む口で書くのは例外として、何度呼んでも同じになる片付けだけ（期限を過ぎた・使えなくなった待ちの実行を止め、24 時間なら聞き直す）。
//   一覧は「呼んだ人が今の担当者のチケット」の待っている実行を全部（app.ticket_execute_sweep_mine）、1 件はそのチケット 1 枚（app.ticket_execute_sweep）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Hook, HookArgs } from "../../../contract/deps.js";
import { notFound } from "./errors.js";

const LIMIT_DEFAULT = 50;

export function queueHooks(pool: pg.Pool): Record<string, Hook> {
  return {
    listApprovalQueue: {
      before: async (a: HookArgs) => {
        const rows = await withTenant(pool, a.ctx, async (cl) => {
          await cl.query("select app.ticket_execute_sweep_mine()");
          return (
            (await cl.query<{ v: Record<string, unknown>[] }>("select app.approval_queue() as v")).rows[0]?.v ?? []
          );
        });
        // 一覧の問い合わせ（limit・cursor）は入口（op.ts）が形を確かめ済み
        const q = a.c.req.query();
        const limit = q["limit"] ? Number(q["limit"]) : LIMIT_DEFAULT;
        const offset = q["cursor"] ? Number(q["cursor"]) : 0;
        const data = rows.slice(offset, offset + limit);
        return {
          status: 200,
          body: {
            data,
            meta: {
              limit,
              ...(rows.length > offset + limit ? { cursor: String(offset + limit) } : {}),
              counts: { total: rows.length },
            },
          },
        };
      },
    },
    getApproval: {
      before: async (a: HookArgs) => {
        const v = await withTenant(pool, a.ctx, async (cl) => {
          const t = await cl.query<{ t: string | null }>(
            "select ticket_id as t from approvals where id = $1 and tenant_id = app.tenant_id()",
            [a.id],
          );
          if (t.rows[0]?.t) await cl.query("select app.ticket_execute_sweep($1)", [t.rows[0].t]);
          return (await cl.query<{ v: Record<string, unknown> | null }>("select app.approval_detail($1) as v", [a.id]))
            .rows[0]?.v;
        });
        if (!v) return notFound();
        return { status: 200, body: { data: v } };
      },
    },
  };
}
