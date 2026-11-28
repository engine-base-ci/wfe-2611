// 帯の操作「共有する（share）」（K-677 が置いた器・K-719 が中身を差し替えた）。
//   書ける人・グループの棚・公開済み・承認待ちの「上げる」頼みが無いときだけ ["share"]。
//   承認待ちの「共有」の頼みがあっても出す（ほかのグループを足せる）
import type { PageAct, PagePartCtx } from "./types.js";

const PENDING_RAISE_SQL = `select exists (select 1 from knowledge_requests r
  where r.page_id = $1 and r.tenant_id = app.tenant_id() and r.kind = 'raise' and r.state = 'pending'
    and r.deleted_at is null) as hit`;

export async function shareActs(p: PagePartCtx): Promise<readonly PageAct[]> {
  if (!p.writable || p.shelf.kind !== "group" || p.page.state !== "published") return [];
  const r = (await p.cl.query<{ hit: boolean }>(PENDING_RAISE_SQL, [p.page.id])).rows[0];
  return r?.hit === true ? [] : ["share"];
}
