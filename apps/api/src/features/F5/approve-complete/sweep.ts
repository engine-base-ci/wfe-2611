// 読むときの片付け（K-164）：読む口（listApprovalQueue・getApproval・getTicket）が、読む前に待っている承認の後の実行の仕事を片付ける。
//   止めるのは、チケットが消された・任せた人が使えない・承認から 24 時間を過ぎた 仕事（24 時間は新しい承認待ちで聞き直す）。書くのは関門 C2 の関数だけ（0098）。
//   読む口で書くのは例外（何度呼んでも同じになる片付けだけ）。片付けが例外になったら、片付けだけを戻して（savepoint）読めたものを返す。
//   失敗は記録だけで答えに出さない（読む口を 503 にしない）。次に開いたときにまた片付ける（決める人の答え bf373f5b265a・K63-API-085）
import type pg from "pg";

/** そのチケット 1 枚（見える人だけ） */
export const SWEEP_TICKET = "select app.ticket_execute_sweep($1)";
/** 承認の id から、そのチケット 1 枚（承認が読めなければ何もしない） */
export const SWEEP_OF_APPROVAL =
  "select app.ticket_execute_sweep((select a.ticket_id from approvals a where a.id = $1 and a.tenant_id = app.tenant_id()))";
/** 呼んだ人が今の担当者のチケットを全部 */
export const SWEEP_MINE = "select app.ticket_execute_sweep_mine()";


/** 読む取引の中で片付けを 1 回流す。失敗しても投げない（片付けだけを戻す）。ログは場所と例外の種類だけ */
export async function sweepBeforeRead(cl: pg.PoolClient, sql: string, args: unknown[], where: string): Promise<void> {
  await cl.query("savepoint execute_sweep");
  try {
    await cl.query(sql, args);
    await cl.query("release savepoint execute_sweep");
  } catch (e) {
    await cl.query("rollback to savepoint execute_sweep");
    console.error(
      `[approve-complete] ${where}：読む前の片付けに失敗したので飛ばした（${(e as Error)?.name ?? "Error"}）`,
    );
  }
}
