// 試し打ちの口（K-746・契約の口 dryRunTicket・POST /api/v1/tickets/:id/dry-run・体は空・D-153.6・関門 C2・C5）。
//   承認待ちの成果物を、宛先を押した人のログインのメールアドレスに差し替えて 1 回だけ実行する仕事を積む（任意・何回でも）。
//   書くのは DB の関数 app.ticket_dry_run の 1 取引だけ（仕事・実行の記録 phase dry_run・やり取りの 1 行・証跡）。承認・段・旗・成果物は変えない。
//   押せるのは担当者（承認する人）だけ（関数が判定する）。結末は仕事が閉じたときの引き金（app.dry_run_job_closed）が書く。
//   失敗（関数が使えない・書き込みが落ちた・知らない答え）は取引ごと戻り、503・E-PAGE-003。ログに本文・メールアドレスを出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

type DryRun =
  | { ok: true; run_id: string; job_id: string; pc: string }
  | { ok: false; code: string; run_id?: string; reason?: string };

const fromCatalog = (code: string, status: number, extra: Record<string, unknown> = {}): HookReply => ({
  status,
  body: { ...kanameError(code).toJSON(), ...extra },
});
const down = (e: unknown): HookReply => {
  console.error(`[dry-run] 試し打ち：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
  return fromCatalog("E-PAGE-003", 503);
};

/** DB の関数の答え → HTTP。知らない言葉は止める側（503） */
function replyOfDryRun(r: DryRun): HookReply {
  if (r.ok) {
    return { status: 201, body: { data: { run_id: r.run_id, job_id: r.job_id, status: "queued", pc: r.pc } } };
  }
  switch (r.code) {
    case "NOT_DRY_RUNNABLE":
      return fromCatalog("E-RUN-003", 409);
    case "RUNNING":
      return fromCatalog("E-CONF-013", 409, { run_id: r.run_id });
    case "UNUSABLE":
      return { status: 409, body: kanameError("E-RUN-004", { reason: String(r.reason ?? "") }).toJSON() };
    case "NO_MAIL":
      return fromCatalog("E-RUN-005", 409);
    case "NOT_FOUND":
      return { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    case "FORBIDDEN":
      return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
    default:
      return down(new Error("unknown"));
  }
}

export function createDryRun(pool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    let r: DryRun | undefined;
    try {
      r = await withTenant(
        pool,
        a.ctx,
        async (cl) => (await cl.query<{ v: DryRun }>("select app.ticket_dry_run($1) as v", [a.id])).rows[0]?.v,
      );
    } catch (e) {
      return down(e);
    }
    if (!r) return down(new Error("empty"));
    return replyOfDryRun(r);
  };
}
