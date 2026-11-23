// ページを消す口（K-681・契約の口 deleteKnowledgePage・DELETE /api/v1/knowledge_pages/:id）。元に戻す画面は作らない。
//   見えない → 404・書けない → 403・消せない（承認待ちの頼み E-KNW-011 → 必ず守る E-KNW-050 → 共有している E-KNW-051 の順）→ 409。
//   生きている下書きの版（だれの物でも・app.kn_page_drop_drafts）とページに消した印を入れる。公開の版は履歴として残す。写しは残る。
//   ページの行に錠をかけてから確かめて書く。証跡は同じ取引。答え 200 { id }。DB の失敗は 503。ログに題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { conflict, notFound, unavailable } from "./reply.js";
import { deleteBlocker } from "./page-guards/index.js";
import { auditPageEdit, lockWritablePage } from "./page-move.js";

const DROP_DRAFTS_SQL = "select app.kn_page_drop_drafts($1)";
const DELETE_SQL = `update knowledge_pages set deleted_at = now(), updated_by = app.user_id()
 where id = $1 and tenant_id = app.tenant_id() and deleted_at is null`;

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

async function run(cl: pg.PoolClient, id: string): Promise<HookReply> {
  const page = await lockWritablePage(cl, id);
  if ("status" in page) return page;
  const blocked = await deleteBlocker(cl, page);
  if (blocked) return conflict(blocked);
  await cl.query(DROP_DRAFTS_SQL, [id]); // ページに書ける間に消す（消した後は書けない）
  const r = await cl.query(DELETE_SQL, [id]);
  if (r.rowCount !== 1) return notFound();
  await auditPageEdit(cl, "knowledge.page.delete", id);
  return { status: 200, body: { data: { id } } };
}

export function createDeleteKnowledgePage(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    try {
      return await withTenant(appPool, a.ctx, (cl) => run(cl, a.id!));
    } catch (e) {
      console.error(`[knowledge] ページを消せなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}
