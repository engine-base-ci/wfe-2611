-- 20261126000000 段 11（F10 人とアカウントを管理する）の口の置き場（K-800・D-154.18〜D-154.21・D-154.25・D-128.97・関門 C2）
--   束 G（グループ・層）・束 A（招くの残り）・束 C（メンバー）の書く DB の関数（後ろの葉 K-802〜K-815・K-848）が頭で使う共通の確かめを 1 回だけ置く。
--   書く関数の頭の決まり：perform app.admin_lock() → app.admin_can(…) で権限 → app.admin_target(…) で相手 → 状態を見る → 書く → app.record_audit(…)。
--   どの関数も security definer・search_path に pg_temp。public から外し、kaname_app には渡さない（口ごとの書く関数が中から呼ぶ）。
--   会社は app.tenant_id()、呼んだ人は app.user_id()。DB の一意の索引は置かない（前からの種が同じ会社に同じ頭のグループを何本も直に入れる）。
--   中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形にする。

-- ---------------------------------------------------------------- 会社ごとの錠（D-154.21・G-16）
--   同じ会社の書き込みは順に通り、別の会社は待たない。取引が終われば外れる
create or replace function app.admin_lock() returns void
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id();
begin
  if v_tenant is null then
    raise exception '会社の文脈が無い' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('f10:' || v_tenant::text, 0));
end $$;

-- ---------------------------------------------------------------- 相手のメンバーを読む
--   人（kind human）・同じ会社・消していない・所属の status が active か suspended の人だけ。
--   外した人（left）・消した人・別の会社の人・AI・無い id・招待中の人（行ごと）は null（口は 404・E-MEM-002）。
--   状態の判定は段 9 の app.handover_member_state（K-401）をそのまま使う（同じ判定を 2 か所に書かない）
create or replace function app.admin_target(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  m members%rowtype;
  v_state text;
  v_role text;
begin
  if p_member is null then return null; end if;
  v_state := app.handover_member_state(p_member);
  if v_state is null or v_state not in ('active', 'suspended') then return null; end if;
  select * into m from members x
   where x.id = p_member and x.tenant_id = app.tenant_id() and x.deleted_at is null;
  if not found or m.kind_id <> 'human' then return null; end if;
  select tm.role into v_role from tenant_memberships tm
   where tm.member_id = p_member and tm.tenant_id = m.tenant_id and tm.deleted_at is null;
  if not found then
    v_role := case when m.role_id = 'owner' then 'admin' else 'member' end;
  end if;
  return jsonb_build_object(
    'id', m.id,
    'name', m.display_name,
    'state', v_state,
    'role', v_role,
    'is_admin', v_role = 'admin' and v_state = 'active',
    'is_self', m.id = app.user_id(),
    'is_owner', m.role_id = 'owner',
    'primary_scope', m.scope_id
  );
end $$;

-- ---------------------------------------------------------------- 管理者の数（D-154.19）
--   管理者＝所属の行の role が admin で status が active の人と、所属の行を持たない owner（会社を作った人・0111）。
--   止めた管理者は数えない。人（human）・消していない・同じ会社
create or replace function app.admin_admin_count() returns integer
language sql stable security definer set search_path = public, app, pg_temp as $$
  select count(*)::integer
    from members m
   where m.tenant_id = app.tenant_id()
     and m.deleted_at is null
     and m.kind_id = 'human'
     and m.suspended_at is null
     and (
       exists (select 1 from tenant_memberships tm
                where tm.member_id = m.id and tm.tenant_id = m.tenant_id and tm.deleted_at is null
                  and tm.role = 'admin' and tm.status = 'active')
       or (m.role_id = 'owner'
           and not exists (select 1 from tenant_memberships tm
                            where tm.member_id = m.id and tm.tenant_id = m.tenant_id and tm.deleted_at is null))
     )
$$;

-- ---------------------------------------------------------------- 最後の管理者か（役割を下げる・止める・外す・抜けるは 409・E-MEM-004）
create or replace function app.admin_is_last_admin(p_member uuid) returns boolean
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v jsonb := app.admin_target(p_member);
begin
  return coalesce((v ->> 'is_admin')::boolean, false) and app.admin_admin_count() = 1;
end $$;

-- ---------------------------------------------------------------- 呼んだ人の権限（入口の op.ts と 2 層・G-02）
--   書く関数の頭で「members の edit」「scopes の edit」「members の invite」を見る（会社全体）
create or replace function app.admin_can(p_target text, p_ability text) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(has_permission(app.user_id(), p_target, null, p_ability), false)
$$;

revoke all on function app.admin_lock() from public;
revoke all on function app.admin_target(uuid) from public;
revoke all on function app.admin_admin_count() from public;
revoke all on function app.admin_is_last_admin(uuid) from public;
revoke all on function app.admin_can(text, text) from public;
