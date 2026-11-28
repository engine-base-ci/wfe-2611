-- 20261126003400 自分の顔の写真（K-834・契約の口 uploadAvatar・D-154.50・D-154.55・D-154.56・D-154.57）
--   新しい表・列は作らない（members.avatar_ref は 0078）。関数を 1 つ足す（書く・関門 C2）。
--
-- app.me_avatar_set(p_ref)：1 つの取引の中で、今の会社の自分の行（app.user_id()）の avatar_ref を p_ref にし、前の ref を返す。
--   p_ref が null なら文字に戻す（avatar_ref を空に）。null でなければ今の会社の置き場の ref（tenants/<今の会社>/…）でなければ 42501。
--   顔は会社ごとの置き場なので、同じログインの別の会社の行・ほかの人の行は変えない（D-154.56）。
--   自分の行を for update で取るので、同時の置き換えは順に通り、後に通った方が残る。
--   顔の保存は会社の記録（audit_events）に載せない（D-154.55）。
create or replace function app.me_avatar_set(p_ref text) returns text
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id();
  v_tenant uuid := app.tenant_id();
  v_old text;
begin
  if v_me is null or v_tenant is null or not app.member_ok() then
    raise exception 'me_avatar_set: forbidden' using errcode = '42501';
  end if;
  if p_ref is not null and p_ref not like 'tenants/' || v_tenant::text || '/%' then
    raise exception 'me_avatar_set: ref outside tenant' using errcode = '42501';
  end if;
  select avatar_ref into v_old from members
   where id = v_me and tenant_id = v_tenant and deleted_at is null
   for update;
  if not found then
    raise exception 'me_avatar_set: no member row' using errcode = '42501';
  end if;
  update members set avatar_ref = p_ref, updated_at = now(), updated_by = v_me
   where id = v_me and tenant_id = v_tenant and deleted_at is null;
  return v_old;
end;
$$;

revoke all on function app.me_avatar_set(text) from public;
grant execute on function app.me_avatar_set(text) to kaname_app;
