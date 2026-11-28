// 消したチケットを戻す口（K-489）：restoreTicket（POST /api/v1/tickets/:id/restore・体は空）。
//   戻せるのは deleted_at から 30 日以内（D-128.84・D-128.116）。判定と書き込みは 1 つの DB の関数 app.ticket_restore の 1 取引の中（関門 C2）：
//   戻せる人（消した本人・そのグループのマネージャー・管理者）・30 日の期限・親が消えていないか・一緒に消えた子・孫（親と同じ deleted_at・deleted_by）の巻き戻し・証跡 1 枚ごと。
//   口は関数の答えを断りの番号に写すだけ。関数が例外（権限・DB・証跡の書き込み失敗）なら取引ごと戻り、503・E-PAGE-003。
//   上限・認証・同意し直しの止め・uuid の形・体が空（知らない項目は 422）は契約の入口（op.ts）が先に確かめる。
//   この口は入口の行の確かめを持たない（消したチケットは行の守りで見えず、入口で読むと必ず 404・scripts/ci/row_rules.mjs の ROW_EXEMPT_FIELDS で :id を名指しして外す）。
//   Cache-Control: private, no-store は入口が全部の答えに付ける。ログに本文・人の id を出さない。
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { down, notFound } from "./shared.js";

type Answer = { ok?: boolean; code?: string; id?: string; restored_count?: number };

const SQL = "select app.ticket_restore($1) as v";

/** 関数が返した断りの印 → 答え。404・409 には field・details を付けない（在るかを漏らさない） */
const refusal = (code: string | undefined): HookReply => {
  switch (code) {
    case "NOT_FOUND":
      return notFound();
    case "FORBIDDEN":
      return { status: 403, body: kanameError("E-DEL-040").toJSON() };
    case "NOT_DELETED":
      return { status: 409, body: kanameError("E-DEL-041").toJSON() };
    case "EXPIRED":
      return { status: 409, body: kanameError("E-DEL-042").toJSON() };
    case "PARENT_DELETED":
      return { status: 409, body: kanameError("E-DEL-043").toJSON() };
    default:
      return down("戻す（知らない答え）", new Error("unknown answer"));
  }
};

export function createRestoreTicket(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    let v: Answer | undefined;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => (await cl.query<{ v: Answer }>(SQL, [a.id])).rows[0]?.v);
    } catch (e) {
      return down("戻す", e);
    }
    if (!v || v.ok !== true || !v.id) return refusal(v?.code);
    return { status: 201, body: { data: { id: v.id, restored_count: Number(v.restored_count ?? 0) } } };
  };
}
