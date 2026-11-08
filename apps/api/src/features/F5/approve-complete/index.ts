// 承認して完了する（K-63）の契約の口の振る舞い。読む口は queue.ts、承認・差し戻しは decide.ts、完了は complete.ts、DB の答えの言葉は errors.ts。
//   チケットの詳細（getTicket）に、決まっていない承認待ち（approval）・完了にできるか（can.complete）・段の鍵（stage.key）を足す。
//   K-62 の can.delegate を足した詳細の上に重ねる（上書きするのは getTicket だけ）。今の実行は K-62 の listTicketRuns・getActionRun で読む
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Transport } from "@kaname/notify";
import type { Hook, HookArgs } from "../../../contract/deps.js";
import { delegateHooks } from "../delegate/index.js";
import { completeHooks } from "./complete.js";
import { decideHooks } from "./decide.js";
import { queueHooks } from "./queue.js";

interface Band {
  approval: Record<string, unknown> | null;
  can_complete: boolean;
  stage_key: string | null;
  completed_at: string | null;
  completed_by: Record<string, unknown> | null;
}

export function approveHooks(pool: pg.Pool, o: { inbox?: Transport } = {}): Record<string, Hook> {
  const base = delegateHooks(pool)["getTicket"];
  return {
    ...queueHooks(pool),
    ...decideHooks(pool),
    ...completeHooks(pool, o),
    getTicket: {
      ...base,
      before: async (a: HookArgs) => {
        // 読むときの片付け（そのチケット 1 枚）：期限を過ぎた・使えなくなった待ちの実行を止める（何度呼んでも同じ）
        await withTenant(pool, a.ctx, (cl) => cl.query("select app.ticket_execute_sweep($1)", [a.id]));
        const r = base?.before ? await base.before(a) : undefined;
        if (!r || r.status !== 200) return r;
        const body = r.body as { data: Record<string, unknown> };
        const band = await withTenant(
          pool,
          a.ctx,
          async (cl) => (await cl.query<{ v: Band | null }>("select app.ticket_band($1) as v", [a.id])).rows[0]?.v,
        );
        const prev = (body.data["can"] ?? {}) as Record<string, unknown>;
        const stage = (body.data["stage"] ?? null) as Record<string, unknown> | null;
        return {
          ...r,
          body: {
            ...body,
            data: {
              ...body.data,
              approval: band?.approval ?? null,
              completed: band?.completed_at ? { at: band.completed_at, by: band.completed_by } : null,
              stage: stage ? { ...stage, key: band?.stage_key ?? stage["key"] } : stage,
              can: { ...prev, complete: band?.can_complete === true },
            },
          },
        };
      },
    },
  };
}
