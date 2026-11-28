// 試験の道具：招待を契約の口（acceptInvitation・POST /api/v1/auth/invitations/:token/accept・K-332）で受け、使える担当者にする（K-337 が前の道すじから移した）。
//   受諾は今の版の規約に同意したことにする（K-332）。入り方を 1 つ持つ人にして「付けるまで進めない」の印を下ろす（段 2 の K-321 の道具 _pending.ts の addTestEntry を使う。
//   パスキーの表・印の列がまだ無ければ何もしない）。答えに人の id は入らないので、名前で引く
import type pg from "pg";
import { addTestEntry } from "./_pending.js";

interface AppLike {
  request: (url: string, init?: RequestInit) => Response | Promise<Response>;
}

export async function joinByInvitation(
  app: AppLike,
  admin: pg.Pool,
  token: string,
  name: string,
  password: string,
): Promise<{ token: string; member_id: string }> {
  const r = await app.request(`http://localhost/api/v1/auth/invitations/${encodeURIComponent(token)}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  if (r.status !== 201) throw new Error(`招待の受諾が ${r.status}：${await r.text()}`);
  const d = ((await r.json()) as { data: { token: string; workspace_id: string } }).data;
  const m = await admin.query<{ id: string; auth_user_id: string }>(
    "select id, auth_user_id from members where tenant_id = $1 and display_name = $2 and deleted_at is null order by created_at desc limit 1",
    [d.workspace_id, name],
  );
  const me = m.rows[0];
  if (!me) throw new Error(`受諾した人が見つからない：${name}`);
  await addTestEntry(me.auth_user_id);
  return { token: d.token, member_id: me.id };
}
