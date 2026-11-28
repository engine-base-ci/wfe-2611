-- 20261128032900 請求書を出したときの PDF を付けたメールの宛先（K-1109・issueOpsInvoices が出し終えた後・D-156.53・関門 C2）
--   app.ops_invoice_mail_targets(会社の並び)：渡した会社ごとに、管理者（tenant_memberships の role admin・status active・消していない・
--   members も消していない）の { member_id, email } を返す。メールは members.auth_user_id の認証の人（kaname_auth."user"）の物。
--   ゲスト（役割 requester）・プランと支払いの人・ふつうの人・抜けた管理者は入らない。メールの無い人は入らない
--   答え：[{ tenant_id, admins: [{ member_id, email }] }]（渡した順・重なりは 1 つ）。書かないので運営の記録は付けない
create or replace function app.ops_invoice_mail_targets(p_tenants uuid[]) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_rows jsonb;
begin
  perform app.ops_require('money');
  with t as (
    select x.id, min(x.ord) as ord
      from unnest(coalesce(p_tenants, array[]::uuid[])) with ordinality as x(id, ord)
     where x.id is not null
     group by x.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'tenant_id', t.id,
           'admins', coalesce((
             select jsonb_agg(jsonb_build_object('member_id', a.member_id, 'email', a.email) order by a.email, a.member_id)
               from (select distinct m.id as member_id, u.email
                       from tenant_memberships tm
                       join members m on m.id = tm.member_id
                       join kaname_auth."user" u on u.id = m.auth_user_id
                      where tm.tenant_id = t.id and tm.role = 'admin' and tm.status = 'active'
                        and tm.deleted_at is null and m.deleted_at is null
                        and u.email is not null and u.email <> '') a), '[]'::jsonb))
         order by t.ord), '[]'::jsonb)
    into v_rows
    from t;
  return v_rows;
end $$;
revoke all on function app.ops_invoice_mail_targets(uuid[]) from public;
grant execute on function app.ops_invoice_mail_targets(uuid[]) to kaname_app;
