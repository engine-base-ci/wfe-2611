// 共有しているフォルダは消せない、の確かめ（K-678 が置いた器・K-719 が中身を差し替えた）。
//   そのフォルダ自身に、生きている共有（ended_at・deleted_at が空）か、承認待ちの共有の頼みがあれば true（消す口は 409 E-KNW-051）。
//   上のフォルダの共有は見ない。承認待ちの頼みも数えるのは、承認する前に物が消えて頼みが宙に浮くのを防ぐため
import type pg from "pg";

const SQL = `select exists (select 1 from knowledge_shares s
                where s.folder_id = $1 and s.tenant_id = app.tenant_id() and s.ended_at is null and s.deleted_at is null)
         or exists (select 1 from knowledge_requests r
                where r.folder_id = $1 and r.tenant_id = app.tenant_id() and r.kind = 'share' and r.state = 'pending'
                  and r.deleted_at is null) as hit`;

export async function shareBlocksFolder(cl: pg.PoolClient, folderId: string): Promise<boolean> {
  const r = (await cl.query<{ hit: boolean }>(SQL, [folderId])).rows[0];
  return r?.hit === true;
}
