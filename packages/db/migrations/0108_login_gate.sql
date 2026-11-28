-- K-303 止めの 1 か所（app.login_gate）。ログインの部品がセッションを作る直前（packages/auth の databaseHooks.session.create.before）だけが呼ぶ。
--   ログインの前は会社の文脈（app.tenant_id）が無く、members は行の守りの中なので、認証の本人の id（members.auth_user_id と、
--   所属の行の tenant_memberships.auth_user_id）から会社の人を引いて見る（security definer・0106 と同じ引き方）。
--   member の行と、同じ (tenant_id, member_id) の所属の行を組にして見る。招待中（invited）の所属の組は数えない（招待の受諾の途中は入れる）。
--     ① 組が 1 つも無い（登録の途中・招待の受諾の途中・会社を作らない登録）→ 'ok'
--     ② 使える組が 1 つも無い → 'member_left'（使える＝member が消えていない、かつ同じ組の所属が無いか、抜けた・消したでない）
--     ③ 使える組のうち、人が止められた（members.suspended_at か、同じ組の所属の status = 'suspended'）→ 'member_suspended'
--     ④ 使える組の会社が止められた（subscriptions.suspended_at が入った消していない行）→ 'workspace_suspended'
--     ⑤ どれでもない → 'ok'。人と会社の両方が止められていれば人の方（③が先）
--   断ったとき（③④）は、使える組の会社ごとの security_events に login_blocked（detail は理由だけ・メールや IP は入れない）を 1 行書く。
--   抜けた（②）ときは書かない（抜けた会社の管理者に見せない・0106 と同じ）。返すのは text だけ（会社の名前・id は返さない）。
create or replace function app.login_gate(p_auth_user_id text) returns text
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  r record;
  v_pairs int := 0;
  v_person boolean := false;
  v_workspace boolean := false;
  v_tenants uuid[] := '{}';
  v_members uuid[] := '{}';
  v_reason text;
begin
  if p_auth_user_id is null then return 'ok'; end if;
  for r in
    select m.tenant_id, m.id as member_id,
           m.deleted_at is null and coalesce(tm.status <> 'left' and tm.deleted_at is null, true) as usable,
           m.suspended_at is not null or coalesce(tm.status = 'suspended', false) as person_suspended,
           exists (select 1 from subscriptions s
                    where s.tenant_id = m.tenant_id and s.suspended_at is not null and s.deleted_at is null) as workspace_suspended
      from members m
      left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
     where (m.auth_user_id = p_auth_user_id   -- 会社を作った人・招待で入った人
            or exists (select 1 from tenant_memberships tb   -- 同じログインで別の会社にも入った人（D-125.150）
                       where tb.tenant_id = m.tenant_id and tb.member_id = m.id and tb.auth_user_id = p_auth_user_id))
       and not (coalesce(tm.status = 'invited', false) and tm.deleted_at is null)   -- 招待の受諾の途中は数えない
     order by m.tenant_id, m.id
  loop
    v_pairs := v_pairs + 1;
    continue when not r.usable;
    v_person := v_person or r.person_suspended;
    v_workspace := v_workspace or r.workspace_suspended;
    if not (r.tenant_id = any (v_tenants)) then
      v_tenants := v_tenants || r.tenant_id;
      v_members := v_members || r.member_id;
    end if;
  end loop;
  if v_pairs = 0 then return 'ok'; end if;
  if cardinality(v_tenants) = 0 then return 'member_left'; end if;
  if v_person then
    v_reason := 'member_suspended';
  elsif v_workspace then
    v_reason := 'workspace_suspended';
  else
    return 'ok';
  end if;
  -- 使える組の会社ごとに 1 行（理由だけ）
  insert into security_events (tenant_id, kind_id, member_id, detail)
  select t, 'login_blocked', mid, jsonb_build_object('reason', v_reason)
    from unnest(v_tenants, v_members) as u(t, mid);
  return v_reason;
end $$;
revoke all on function app.login_gate(text) from public;
grant execute on function app.login_gate(text) to kaname_app;

insert into app.schema_migrations (name) values ('0108_login_gate.sql') on conflict do nothing;
