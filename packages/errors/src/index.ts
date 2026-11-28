// エラーは正本（errors.json）から引く。文言と次の一手をコードに書かない。出せないエラーはデッドコード（ci:errors-used が数える）。D-069。
import { CATALOG, type CatalogEntry } from "./catalog.js";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";

/** class → HTTP の状態。正本の class は 14 の普遍の類型 */
export const STATUS_OF: Record<string, number> = {
  auth: 401,
  permission: 403,
  gate: 403,
  validation: 422,
  data: 422,
  conflict: 409,
  dependency: 503, // 外の調子が悪い（E-PAGE-003 も）は 503。中で別の数になる道を残さない（D-129.42・PM の決め 2026-11-28）
  limit: 429,
  payment: 402,
  external: 502,
  connectivity: 503,
  timeout: 504,
  no_signal: 502,
  not_found: 404,
};

export class KanameError extends Error {
  readonly code: string;
  readonly entry: CatalogEntry;
  readonly status: number;
  readonly detail: Record<string, unknown>;
  constructor(code: string, detail: Record<string, unknown> = {}) {
    const entry = CATALOG[code];
    if (!entry) throw new Error(`正本に無いエラー: ${code}（07_qa/test-specs/errors.json に足してから使う）`);
    super(entry.message);
    this.name = "KanameError";
    this.code = code;
    this.entry = entry;
    this.status = STATUS_OF[entry.cls] ?? 400;
    this.detail = detail;
  }
  /** API の応答（文言と次の一手は正本のまま。detail は画面が差し込む値） */
  toJSON() {
    return {
      error: this.entry.cls,
      code: this.code,
      message: this.entry.message,
      action: this.entry.action,
      undo: this.entry.undo,
      support_code: this.entry.support_code,
      detail: this.detail,
    };
  }
}
export const kanameError = (code: string, detail?: Record<string, unknown>) => new KanameError(code, detail);
export const isKnown = (code: string) => code in CATALOG;
export { CATALOG };

/** 出た記録（error_events）。文言はここに書かない（正本を引く）。誰が・どの画面で・いつ */
export async function recordErrorEvent(
  repo: Repository,
  ctx: TenantContext,
  code: string,
  screenId: string | null,
  context: Record<string, unknown> = {},
): Promise<string | null> {
  if (!ctx.tenantId || !CATALOG[code]) return null;
  const row = await repo
    .table("error_events")
    .create(ctx, { error_code: code, member_id: ctx.userId, screen_id: screenId, context: JSON.stringify(context) });
  return String(row["id"]);
}
export async function markNextActionTaken(repo: Repository, ctx: TenantContext, eventId: string): Promise<boolean> {
  const row = await repo.table("error_events").update(ctx, eventId, { next_action_taken_at: new Date() });
  return row !== null;
}
