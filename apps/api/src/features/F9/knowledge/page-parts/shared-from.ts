// 共有された側の帯（K-677 が置いた器・K-719 が中身を差し替えた）。
//   グループの棚のページで、呼んだ人がそのグループに入っていない（見えているのは共有のおかげ）なら
//   { group_name: 元のグループの名前, manager_names: 元のグループのマネージャーの表示名（コードポイント順）, writable: false }。それ以外は null
import type { PagePartCtx, SharedFrom } from "./types.js";

// 名前は security definer の関数で読む（人の行の守りは見えるグループの人だけを通すので、共有先の人には元のグループのマネージャーが見えない・統合の枝で直した）
const SQL = "select app.kn_in_group($1, $2) as inside, app.kn_group_manager_names($2) as names";

export async function readSharedFrom(p: PagePartCtx): Promise<SharedFrom | null> {
  const g = p.shelf.groupId;
  if (p.shelf.kind !== "group" || !g) return null;
  const r = (await p.cl.query<{ inside: boolean; names: string[] }>(SQL, [p.memberId, g])).rows[0];
  if (!r || r.inside) return null;
  return { group_name: p.shelf.name, manager_names: r.names, writable: false };
}
