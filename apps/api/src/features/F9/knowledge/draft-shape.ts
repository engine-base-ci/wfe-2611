// ページを作る・下書きを保存する・やめる口（K-679）が共有する読みと答えの形・DB の断りの番号への直し。
//   置き場の形 readPlaceOf はこの葉が持ち主（K-681・K-690 は作らずにこれを使う）。ログに題名・本文を出さない
import type pg from "pg";
import type { HookReply } from "../../../contract/deps.js";
import { conflict, unavailable } from "./reply.js";
import { toPlace, type PagePlace, type ShelfKind } from "./shape.js";

/** 口が読むページの行 */
export interface DraftPageRow {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly state: "draft" | "published";
  readonly is_must: boolean;
  readonly is_personal: boolean;
  readonly scope_id: string;
  readonly owner_member_id: string;
  readonly folder_id: string | null;
  readonly current_version: number;
  readonly updated_at: Date;
}

/** 作った答え KnowledgePageStub（鍵ちょうど 6） */
export interface PageStub {
  readonly id: string;
  readonly title: string;
  readonly desc: string;
  readonly state: "draft" | "published";
  readonly must: boolean;
  readonly place: PagePlace;
}

export const PAGE_COLS = `p.id, p.title, p.summary, p.state, p.is_must, p.is_personal, p.scope_id, p.owner_member_id,
       p.folder_id, p.current_version, p.updated_at`;
const PLACE_SQL = `select app.kn_shelf_kind($1, $2) as kind, app.kn_shelf_name($1, $2) as name,
       case when $3::uuid is null then '{}'::text[] else app.kn_folder_names($3::uuid) end as folders`;
const PAGE_SQL = `select ${PAGE_COLS}, app.kpage_writable(p.id) as writable from knowledge_pages p
 where p.id = $1 and p.tenant_id = app.tenant_id() and p.deleted_at is null
   and p.state in ('draft', 'published') and app.kpage_visible(p.id)`;
const MY_DRAFT_SQL = `select v.id from knowledge_page_versions v
 where v.page_id = $1 and v.tenant_id = app.tenant_id() and v.kind = 'draft' and v.deleted_at is null
   and v.author_member_id = app.user_id()
 order by v.version desc limit 1`;
const NEXT_SQL = `select coalesce(max(p.position), 0) + 10 as n from knowledge_pages p
 where p.tenant_id = app.tenant_id() and p.deleted_at is null and p.scope_id = $1 and p.is_personal = $2
   and (not $2 or p.owner_member_id = app.user_id())
   and p.folder_id is not distinct from $3::uuid`;
const AUDIT_SQL = "select app.record_audit($1, 'knowledge_pages', $2, 'C2', '{}'::jsonb)";

/** 置き場の形（棚の種類・名前・棚の直下からのフォルダ） */
export async function readPlaceOf(
  cl: pg.PoolClient,
  row: { scope_id: string; is_personal: boolean; folder_id: string | null },
): Promise<PagePlace> {
  const r = (
    await cl.query<{ kind: ShelfKind; name: string; folders: string[] }>(PLACE_SQL, [
      row.scope_id,
      row.is_personal,
      row.folder_id,
    ])
  ).rows[0]!;
  return toPlace(r.kind, r.name, r.kind === "group" ? row.scope_id : null, row.folder_id, r.folders);
}

/** 見えるページを読む（無い・消した・見えない・前の形の archived は null） */
export async function readPage(cl: pg.PoolClient, id: string): Promise<(DraftPageRow & { writable: boolean }) | null> {
  return (await cl.query<DraftPageRow & { writable: boolean }>(PAGE_SQL, [id])).rows[0] ?? null;
}

/** 自分の生きている下書きの版の id（無ければ null・他人の下書きの版は行の守りで見えない） */
export async function readMyDraft(cl: pg.PoolClient, pageId: string): Promise<string | null> {
  return (await cl.query<{ id: string }>(MY_DRAFT_SQL, [pageId])).rows[0]?.id ?? null;
}

/** 同じ棚・同じフォルダの中の最後の並び＋10（無ければ 10） */
export async function nextPagePosition(
  cl: pg.PoolClient,
  shelf: { scopeId: string; isPersonal: boolean },
  folderId: string | null,
): Promise<number> {
  return Number(
    (await cl.query<{ n: number }>(NEXT_SQL, [shelf.scopeId, shelf.isPersonal, folderId])).rows[0]?.n ?? 10,
  );
}

export async function auditPage(
  cl: pg.PoolClient,
  action: "knowledge.page.create" | "knowledge.page.retitle" | "knowledge.draft.discard",
  pageId: string,
): Promise<void> {
  await cl.query(AUDIT_SQL, [action, pageId]);
}

export function toPageStub(row: DraftPageRow, place: PagePlace): PageStub {
  return { id: row.id, title: row.title, desc: row.summary ?? "", state: row.state, must: row.is_must, place };
}

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

/** 取引の外で受けた例外を答えに直す：生きている下書きの版の部分一意の競り → 409 E-KNW-012、それ以外は 503（ログに種類だけ） */
export function draftFailure(e: unknown, what: string): HookReply {
  const err = e as { code?: string; constraint?: string };
  if (err?.code === "23505" && typeof err.constraint === "string" && err.constraint.includes("draft"))
    return conflict("E-KNW-012");
  console.error(`[knowledge] ${what}（${kindOf(e)}）`);
  return unavailable();
}
