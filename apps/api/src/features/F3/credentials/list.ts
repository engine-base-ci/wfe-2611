// 預けたログイン情報の一覧の口（K-351）：listCredentials。読むだけ（DB に書かない・金庫も外も呼ばない）。
//   見えるのは、自分の個人の物と、自分のワークスペースの物。消した物・失効した物は出さない。
//   守りは 2 重：行の守り（credentials_read）の上で読み、口の文でも同じ条件（ワークスペースの物か、自分が持ち主）で絞る
//   （守りの作り直しで行の守りが緩んでも、他人の個人の物を一覧に出さない）。
//   並び：名前の順。同じ名前は個人が先（近い層が勝つ・D-125.149）。数が少ない一覧なので全部を返す（上限 500 行・超えたら切ってログに 1 行）。
//   取引は 1 つ（withTenant）・文は 2 つ（edit の有無・一覧）。行ごとに引かない。ログに名前・参照・人の id を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { CREDENTIAL_SELECT, toCredential, type CredentialRow } from "./shape.js";

/** 一覧で返す行の上限 */
export const LIST_MAX = 500;

const LIST_SQL = `${CREDENTIAL_SELECT}
 where c.tenant_id = app.tenant_id() and c.deleted_at is null and c.revoked_at is null
   and (c.layer = 'workspace' or c.owner_member_id = app.user_id())
 order by c.name, (c.layer = 'workspace'), c.created_at
 limit $1`;

/** ワークスペースの物を直せるか（credentials のワークスペース全体の edit・既定は管理者の束） */
const CAN_EDIT_SQL = "select has_permission(app.user_id(), 'credentials', null, 'edit') as ok";

export function createListCredentials(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const { rows, canEdit } = await withTenant(appPool, a.ctx, async (cl) => {
      const perm = await cl.query<{ ok: boolean }>(CAN_EDIT_SQL);
      const list = await cl.query<CredentialRow>(LIST_SQL, [LIST_MAX + 1]);
      return { rows: list.rows, canEdit: perm.rows[0]?.ok === true };
    });
    if (rows.length > LIST_MAX) console.warn(`[credentials] 一覧を ${LIST_MAX} 行で切った`);
    return { status: 200, body: { data: rows.slice(0, LIST_MAX).map((r) => toCredential(r, canEdit)) } };
  };
}
