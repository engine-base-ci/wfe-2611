// 試験の前提：登録した人の PC を 1 台つなぐ（K-57 の関門の関数で、画面と Bridge の 2 回の呼び出しの代わり）。
//   つなぐ操作そのもの（コードを出す・引き取る・生きている知らせ）は apps/api/test/features/F3/connect-pc.test.ts が持つ。
//   ここで返す token は本物の PC の印（"kpc_…"）。頭 x-bridge-session に載せれば、Bridge の口は本物の解決（app.bridge_device_check）で通る
import type pg from "pg";
import { newCode, newDeviceToken, sha256 } from "../src/features/F3/connect-pc/code.js";

export interface PairedForTest {
  /** PC の印（x-bridge-session に載せる） */
  token: string;
  /** PC の行（sessions.id・画面の一覧の番号） */
  sid: string;
  member: string;
  tenant: string;
}

/** メールで登録した人に PC をつなぐ（管理者の接続で関門の関数を呼ぶ） */
export async function pairForTest(admin: pg.Pool, email: string, label = "QA の PC"): Promise<PairedForTest> {
  const m = await admin.query<{ id: string; tenant_id: string }>(
    'select m.id, m.tenant_id from members m join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1 and m.deleted_at is null',
    [email],
  );
  const me = m.rows[0];
  if (!me) throw new Error(`登録した人が見つからない: ${email}`);
  return pairMemberForTest(admin, me.id, label);
}

/** メンバーの id で PC をつなぐ（招いた人など、メールが手元に無いとき） */
export async function pairMemberForTest(admin: pg.Pool, memberId: string, label = "QA の PC"): Promise<PairedForTest> {
  const m = await admin.query<{ id: string; tenant_id: string }>("select id, tenant_id from members where id = $1", [
    memberId,
  ]);
  const me = m.rows[0];
  if (!me) throw new Error(`メンバーが見つからない: ${memberId}`);
  const code = newCode();
  const token = newDeviceToken();
  await admin.query("select app.bridge_code_new($1, $2, $3)", [me.tenant_id, me.id, sha256(code)]);
  const r = await admin.query<{ session_id: string }>("select * from app.bridge_code_claim($1, $2, $3)", [
    sha256(code),
    label,
    sha256(token),
  ]);
  return { token, sid: r.rows[0]!.session_id, member: me.id, tenant: me.tenant_id };
}
