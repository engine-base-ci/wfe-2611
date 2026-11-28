-- 20261126002300 記録を探す（K-823・契約の口 listAuditEvents・D-154.11・D-154.15・D-154.25・D-150.40）
--   新しい表・列は作らない。読む関数を 4 つ足す（書かない）。記録の表 audit_events（0003・追記専用）と書く関数 app.record_audit は変えない。
--
-- ① app.audit_kind(a)：action の頭から画面の札（perm・out・device・ai・deleted）を決める。どれにも当たらなければ null（札なし）。
--      運営の札 ops は会社の記録に行が無い（ops_audit_events は出さない・F12）ので、どの action も ops にはならない。
--      消した（deleted・30 日は戻せる）はチケットの消し tickets.delete だけ。端末の鍵・チケットのつながりの消しは戻せないので札なし。
--      札を足すときはこの関数 1 つを直す（書く側が新しい action を足しても、ここに無ければ札なしで出る）
-- ② app.audit_scopes()：呼んだ人が管理するグループ（その下を含む・app.manages_scope と同じ条件）。管理者は会社の全部。どちらでもなければ 0 行
-- ③ app.audit_list(...)：会社の記録を新しい順（occurred_at 降順・同じ時刻は id 降順）に p_limit + 1 行まで読む（1 行余分は続きの有無）。
--      管理者は会社の全部。マネージャーは (a) 自分が管理するグループのチケットの行 (b) 自分が管理するグループに入っている人（主・兼務・消していない
--      scope_memberships、か members.scope_id）が起こした行。どちらでもなければ 42501（口が 403）。範囲の外の行は絞りで指しても出ない。
--      人の名前は members から消した人・止めた人もそのまま引く。対象の名前は target_type で引く（tickets＝番号・members＝名前・scopes＝名前・layers＝層の名前）
-- ④ app.audit_scope_kind()：'all'＝管理者・'groups'＝マネージャー・それ以外は null（口の答えの scope）

create or replace function app.audit_kind(a text) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case
    when a = 'tickets.delete' then 'deleted'
    when a = 'session.new_device' then 'device'
    when split_part(a, '.', 1) = 'external' then 'out'
    when split_part(a, '.', 1) = 'clone' then 'ai'
    when split_part(a, '.', 1) in ('permission', 'member', 'scope', 'layer', 'invitation', 'workspace') then 'perm'
    else null
  end
$$;
revoke all on function app.audit_kind(text) from public;
grant execute on function app.audit_kind(text) to kaname_app;

create or replace function app.audit_scopes() returns setof uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select s.id from scopes s where s.tenant_id = app.tenant_id() and app.manages_scope(s.id)
$$;
revoke all on function app.audit_scopes() from public;
grant execute on function app.audit_scopes() to kaname_app;

create or replace function app.audit_scope_kind() returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case
    when app.tenant_id() is null then null
    when app.is_admin(app.user_id()) then 'all'
    when exists (select 1 from app.audit_scopes()) then 'groups'
    else null
  end
$$;
revoke all on function app.audit_scope_kind() from public;
grant execute on function app.audit_scope_kind() to kaname_app;

create or replace function app.audit_list(
  p_kind text, p_member uuid, p_ticket uuid, p_from timestamptz, p_to timestamptz,
  p_after_at timestamptz, p_after_id uuid, p_limit int
) returns table (
  id uuid, occurred_at timestamptz, action text, kind text, actor_id uuid, actor_name text,
  target_type text, target_id text, target_label text, payload jsonb
)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
#variable_conflict use_column
declare
  v_tenant uuid := app.tenant_id();
  v_all boolean;
  v_scopes uuid[];
begin
  if v_tenant is null then
    raise exception '記録を読む権限がありません' using errcode = '42501';
  end if;
  v_all := app.is_admin(app.user_id());
  if not v_all then
    select coalesce(array_agg(s), '{}'::uuid[]) into v_scopes from app.audit_scopes() s;
    if cardinality(v_scopes) = 0 then
      raise exception '記録を読む権限がありません' using errcode = '42501';
    end if;
  end if;
  if p_kind = 'ops' then
    return; -- 運営の記録は会社の記録に出さない（常に 0 件）
  end if;
  return query
    select e.id, e.occurred_at, e.action, app.audit_kind(e.action), e.actor_member_id, am.display_name,
           e.target_type, e.target_id,
           case e.target_type
             when 'tickets' then (select t.number from tickets t where t.tenant_id = v_tenant and t.id::text = e.target_id)
             when 'members' then (select m.display_name from members m where m.tenant_id = v_tenant and m.id::text = e.target_id)
             when 'scopes' then (select sc.name from scopes sc where sc.tenant_id = v_tenant and sc.id::text = e.target_id)
             when 'layers' then (select l.label from layers l where l.tenant_id = v_tenant and l.id::text = e.target_id)
             else null
           end,
           e.payload
      from audit_events e
      left join members am on am.id = e.actor_member_id and am.tenant_id = v_tenant
     where e.tenant_id = v_tenant
       and (p_kind is null or app.audit_kind(e.action) = p_kind)
       and (p_member is null or e.actor_member_id = p_member)
       and (p_ticket is null or (e.target_type = 'tickets' and e.target_id = p_ticket::text))
       and (p_from is null or e.occurred_at >= p_from)
       and (p_to is null or e.occurred_at < p_to)
       and (p_after_at is null or (e.occurred_at, e.id) < (p_after_at, p_after_id))
       and (
         v_all
         or (e.target_type = 'tickets' and exists (
               select 1 from tickets t
                where t.tenant_id = v_tenant and t.id::text = e.target_id and t.scope_id = any (v_scopes)))
         or exists (
               select 1 from scope_memberships sm
                where sm.tenant_id = v_tenant and sm.member_id = e.actor_member_id and sm.deleted_at is null
                  and sm.scope_id = any (v_scopes))
         or exists (
               select 1 from members mm
                where mm.tenant_id = v_tenant and mm.id = e.actor_member_id and mm.scope_id = any (v_scopes))
       )
     order by e.occurred_at desc, e.id desc
     limit greatest(p_limit, 0) + 1;
end $$;
revoke all on function app.audit_list(text, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, int) from public;
grant execute on function app.audit_list(text, uuid, uuid, timestamptz, timestamptz, timestamptz, uuid, int) to kaname_app;
