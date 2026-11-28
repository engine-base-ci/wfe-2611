// ページを作る口（K-679・契約の口 createKnowledgePage・POST /api/v1/knowledge_pages・201）。
//   1 つの取引で：棚を決める（見えない・無い棚は 404）→ 書けるか（403）→ フォルダ（見えない・無い・消した・別の棚は 404）→ 並び
//   → 下書きのページ（state draft・版 0・持ち主は自分）→ 空の下書きの版（version 1）→ 証跡。DB の失敗は 503。ログに題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { checkKnowledgeInput } from "./input.js";
import { forbidden, notFound } from "./reply.js";
import { resolveShelf, type ShelfRef } from "./shelf.js";
import type { ShelfKind } from "./shape.js";
import {
  PAGE_COLS,
  auditPage,
  draftFailure,
  nextPagePosition,
  readPlaceOf,
  toPageStub,
  type DraftPageRow,
} from "./draft-shape.js";

const WRITABLE_SQL = "select app.kn_shelf_writable($1, $2, app.user_id()) as ok";
const FOLDER_SQL = `select f.scope_id, f.is_personal, f.owner_member_id from knowledge_folders f
 where f.id = $1 and f.tenant_id = app.tenant_id() and f.deleted_at is null and app.kfolder_visible(f.id)`;
const INSERT_SQL = `with p as (
  insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, title, summary, folder_id, position,
                               current_version, created_by, updated_by)
  values (app.tenant_id(), $1, $2, app.user_id(), 'draft', $3, $4, $5, $6, 0, app.user_id(), app.user_id())
  returning *) select ${PAGE_COLS} from p`;
const VERSION_SQL = `insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, created_by, updated_by)
  values (app.tenant_id(), $1, 1, 'draft', $2::jsonb, app.user_id(), app.user_id(), app.user_id())`;
/** 空の本文（K-674 の app.kn_body_from_text('') と同じ形） */
const EMPTY_BODY = JSON.stringify({ doc: { type: "doc", content: [] }, text: "" });

interface CreateInput {
  shelf: ShelfKind;
  group_id?: string | null;
  folder_id?: string | null;
  title: string;
  desc?: string;
}

/** フォルダが見えて同じ棚か（自分の棚は持ち主も自分） */
async function folderFits(cl: pg.PoolClient, shelf: ShelfRef, folderId: string, me: string): Promise<boolean> {
  const f = (
    await cl.query<{ scope_id: string; is_personal: boolean; owner_member_id: string }>(FOLDER_SQL, [folderId])
  ).rows[0];
  if (!f) return false;
  return (
    f.scope_id === shelf.scopeId && f.is_personal === shelf.isPersonal && (!f.is_personal || f.owner_member_id === me)
  );
}

export function createCreateKnowledgePage(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const bad = checkKnowledgeInput("createKnowledgePage", a.input);
    if (bad) return bad;
    const input = a.input as unknown as CreateInput;
    try {
      return await withTenant(appPool, a.ctx, async (cl): Promise<HookReply> => {
        const shelf = await resolveShelf(cl, { shelf: input.shelf, group_id: input.group_id ?? null });
        if (!shelf) return notFound();
        const ok = (await cl.query<{ ok: boolean }>(WRITABLE_SQL, [shelf.scopeId, shelf.isPersonal])).rows[0]?.ok;
        if (ok !== true) return forbidden();
        const folderId = input.folder_id ?? null;
        if (folderId && !(await folderFits(cl, shelf, folderId, a.ctx.userId ?? ""))) return notFound();
        const position = await nextPagePosition(cl, shelf, folderId);
        const row = (
          await cl.query<DraftPageRow>(INSERT_SQL, [
            shelf.scopeId,
            shelf.isPersonal,
            input.title,
            input.desc ?? "",
            folderId,
            position,
          ])
        ).rows[0]!;
        await cl.query(VERSION_SQL, [row.id, EMPTY_BODY]);
        await auditPage(cl, "knowledge.page.create", row.id);
        return { status: 201, body: { data: toPageStub(row, await readPlaceOf(cl, row)) } };
      });
    } catch (e) {
      return draftFailure(e, "ページを作れなかった");
    }
  };
}
