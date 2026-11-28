// ほかのグループに共有しているか（K-681 が置いた器・K-719 が中身を差し替えた）。
//   ページ自身か上のフォルダ（app.kn_folder_chain）に生きている共有（ended_at・deleted_at が空）があれば true。
//   承認待ちの共有の頼みは hasPendingRequest（K-687）が先に止めるので数えない。K-681 の消す口（051）と K-687 の上げる口（106）が呼ぶ
import type pg from "pg";

const SQL = `select exists (select 1 from knowledge_pages p
  join knowledge_shares s on s.tenant_id = p.tenant_id and s.ended_at is null and s.deleted_at is null
   and (s.page_id = p.id or s.folder_id in (select app.kn_folder_chain(p.folder_id)))
  where p.id = $1 and p.tenant_id = app.tenant_id()) as hit`;

export async function isSharedOut(cl: pg.PoolClient, pageId: string): Promise<boolean> {
  const r = (await cl.query<{ hit: boolean }>(SQL, [pageId])).rows[0];
  return r?.hit === true;
}
