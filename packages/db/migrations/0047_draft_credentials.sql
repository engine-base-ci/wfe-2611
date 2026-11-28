-- 0047 目標の名前は版に持つ・預けたログイン情報の一覧・たたき台は 1 回で読む（D-108）。
--   読む側で生の select をすると行レベルの制御に弾かれて黙って 0 件になるので、下の関数（security definer）を通す

alter table goal_versions add column if not exists name text;
alter table credentials add column if not exists service_name text;
alter table credentials add column if not exists service_domain text;

-- 目標の名前（D-108.1・D-108.2）：今の版の名前。無ければ種類の名前（内部の鍵は出さない）
create or replace function app.goal_name(p_goal uuid) returns text
language sql stable security definer set search_path = public, app as $$
  select coalesce(
    (select nullif(trim(v.name), '') from goal_versions v join goals g on g.id = v.goal_id
      where v.goal_id = p_goal and v.version = g.version and v.deleted_at is null order by v.created_at desc limit 1),
    (select k.label from goals g join goal_kinds k on k.key = g.kind_id where g.id = p_goal),
    '目標')
$$;
grant execute on function app.goal_name(uuid) to kaname_app;

-- たたき台（D-108.5）：目標・台帳・担当業務とAI社員を 1 回で。本人の会社のものだけ
create or replace function app.onboard_draft(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  with me as (select tenant_id from members where id = p_member and deleted_at is null)
  select jsonb_build_object(
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id, 'name', app.goal_name(g.id), 'target_value', g.target_value,
               'unit', coalesce(u.label, u.symbol, ''), 'scope', coalesce(s.name, ''),
               'period_start', g.period_start::text, 'period_end', g.period_end::text) order by g.created_at)
        from goals g join me on me.tenant_id = g.tenant_id
        left join units u on u.id = g.unit_id left join scopes s on s.id = g.scope_id
       where g.deleted_at is null and g.ended_at is null), '[]'::jsonb),
    'ledgers', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name,
               'stages', coalesce(l.json_schema->'stages', '[]'::jsonb),
               'fields', coalesce(l.json_schema->'fields', '[]'::jsonb)) order by l.created_at)
        from ledger_definitions l join me on me.tenant_id = l.tenant_id where l.deleted_at is null), '[]'::jsonb),
    'duties', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name,
               'staff', coalesce(m.display_name, ''),
               'summary', left(split_part(coalesce(d.definition_md, ''), E'\n', 1), 160),
               'origin', case when a.template_ref is not null then 'distributed' else 'company' end) order by d.created_at)
        from duties d join me on me.tenant_id = d.tenant_id
        left join ai_employees a on a.id = d.ai_employee_id left join members m on m.id = a.member_id
       where d.deleted_at is null), '[]'::jsonb))
$$;
grant execute on function app.onboard_draft(uuid) to kaname_app;

-- 預けるときのサービス（D-108.4）：台帳に名前か宛先が同じものがあればその id（無ければ null＝規約に記載なし）
create or replace function app.credential_service(p_name text, p_domain text) returns uuid
language sql stable security definer set search_path = public, app as $$
  select s.id from service_registry s
   where s.deleted_at is null
     and ((nullif(trim(p_domain), '') is not null and lower(regexp_replace(regexp_replace(coalesce(s.domain, ''), '^[a-z]+://', '', 'i'), '^www\.|/.*$', '', 'g')) = lower(trim(p_domain)))
          or (nullif(trim(p_name), '') is not null and lower(s.name) = lower(trim(p_name))))
   order by s.created_at limit 1
$$;
grant execute on function app.credential_service(text, text) to kaname_app;

-- 預けたものの一覧（D-108.3）：サービス名・宛先・台帳の可否・種類・状態・預かり先の番号の末尾だけ。中身は返さない
create or replace function app.my_credentials(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'service_name', coalesce(nullif(c.service_name, ''), s.name, '（名前なし）'),
           'service_domain', coalesce(nullif(c.service_domain, ''), s.domain, ''),
           'verdict', coalesce(s.automation_verdict_id, 'unspecified'),
           'kind', c.kind_id,
           'state', case when c.revoked_at is not null then 'revoked' when c.kind_id like 'oauth%' then 'connected' else 'stored' end,
           'ref_tail', right(c.vault_ref, 6),
           'created_at', c.created_at) order by c.created_at), '[]'::jsonb)
    from credentials c left join service_registry s on s.id = c.service_id
   where c.owner_member_id = p_member and c.deleted_at is null
$$;
grant execute on function app.my_credentials(uuid) to kaname_app;
