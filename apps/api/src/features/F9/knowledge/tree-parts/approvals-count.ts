// 自分が承認できる待ちの数（K-676 が置いた器。K-688 が中身を差し替えた）。
//   今の人が承認する人（app.kn_request_approver）の承認待ちを全部数える（一覧の 50 行では切らない）。
//   承認する人でない人には K-676 が admin_counts を null にするので、この関数は呼ばれない
import type pg from "pg";

const COUNT_SQL = `select count(*)::integer as n from knowledge_requests r
  where r.tenant_id = app.tenant_id() and r.state = 'pending' and r.deleted_at is null and app.kn_request_approver(r.id)`;

export async function countApprovals(cl: pg.PoolClient): Promise<number> {
  const r = await cl.query<{ n: number }>(COUNT_SQL);
  return r.rows[0]?.n ?? 0;
}
