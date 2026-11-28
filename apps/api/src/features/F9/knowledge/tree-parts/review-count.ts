// 見直すページの数（K-676 が置いた器。K-695 が中身を差し替えた）。
//   使われていない・食い違っている・よく破られる の 3 つを、口（getKnowledgeReview）と同じ上限 50 で数えた行数の合計（app.kn_review_count）。
//   管理者・マネージャーでない人には K-676 が admin_counts を null にするので、この関数は呼ばれない
import type pg from "pg";

export async function countReview(cl: pg.PoolClient): Promise<number> {
  const r = await cl.query<{ n: number }>("select app.kn_review_count() as n");
  return r.rows[0]?.n ?? 0;
}
