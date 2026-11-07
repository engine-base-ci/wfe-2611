-- 0090 チケットを作る（K-60・D-125.30・D-125.33・D-125.38・D-125.41・D-125.50・D-125.51・D-125.53・D-125.60・D-128.25・D-128.92・D-128.115・D-128.117・D-128.138）
--   app.ticket_create：チケット・区画（版 1）・受け箱の知らせ（担当者と、知らせる人）・下書きの片付けを 1 つの処理で書く（途中で失敗したら全部戻る・関門 C2）。
--   呼ぶのは要求の文脈の中（withTenant が app.tenant_id／app.user_id を入れた後）。書けるかは has_permission で確かめる（security definer なので RLS には頼らない）。
--   番号は今の app.ticket_number（グループの頭＋連番・入ってきた番号は使わない）、親子 3 段は app.ticket_depth_check がそのまま守る。
--   担当者・種別・親・知らせる人が同じ会社か（DB に仕組みが無かったもの）は、ここで確かめる。
--   書きかけの下書きはサーバーに残す（D-128.138）：app.ticket_drafts（作った本人のワークスペースごと・本人にしか見えない）。

create table if not exists app.ticket_drafts (
  tenant_id uuid not null references tenants(id),
  member_id uuid not null references members(id),
  draft_id uuid not null,
  body jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (tenant_id, member_id, draft_id),
  check (pg_column_size(body) <= 200000)
);
-- アプリの役は表に直に触れない（下の関数だけ）
revoke all on app.ticket_drafts from kaname_app;

-- 同じワークスペースの、抜けていない・止められていない人か
create or replace function app.ticket_member_ok(p_tenant uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from members m
    where m.id = p_member and m.tenant_id = p_tenant and m.deleted_at is null and m.suspended_at is null
      and not exists (select 1 from tenant_memberships tm where tm.tenant_id = p_tenant and tm.member_id = m.id
                        and (tm.status in ('left', 'suspended') or tm.deleted_at is not null))
  )
$$;
revoke all on function app.ticket_member_ok(uuid, uuid) from public;
grant execute on function app.ticket_member_ok(uuid, uuid) to kaname_app;

-- 作る。答えは { ok, id, number } か { ok:false, status, code, field, detail }（確かめで止めたとき。何も書いていない）
create or replace function app.ticket_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id();
  v_scope uuid; v_kind uuid; v_assignee uuid; v_parent uuid; v_stage uuid; v_id uuid; v_number text;
  v_missing text[]; sec record; v_sid uuid; v_body jsonb; nm uuid; v_notify uuid[];
  fail jsonb;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN');
  end if;
  v_scope := nullif(p->>'scope_id', '')::uuid; v_kind := nullif(p->>'kind_id', '')::uuid;
  v_assignee := nullif(p->>'assignee_member_id', '')::uuid; v_parent := nullif(p->>'parent_ticket_id', '')::uuid;
  -- グループ：この会社のもので、書ける（閲覧のみ・グループの外の人は 403。別の会社のグループは「無い」と同じ 403）
  if not exists (select 1 from scopes s where s.id = v_scope and s.tenant_id = v_tenant and s.deleted_at is null)
     or not has_permission(v_me, 'tickets', v_scope, 'edit') then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN', 'field', 'scope_id');
  end if;
  -- 種別：この会社の、消していない種別（書いている間に消されたら選び直す）
  if not exists (select 1 from ticket_kinds k where k.id = v_kind and k.tenant_id = v_tenant and k.deleted_at is null) then
    return jsonb_build_object('ok', false, 'status', 422, 'code', 'KIND_GONE', 'field', 'kind_id');
  end if;
  -- 担当者：同じワークスペースの、抜けていない・止められていない人
  if not app.ticket_member_ok(v_tenant, v_assignee) then
    return jsonb_build_object('ok', false, 'status', 422, 'code', 'ASSIGNEE_GONE', 'field', 'assignee_member_id');
  end if;
  -- 親：同じ会社の、見える、消していないチケット（他の人の取り込みの下書き・別の会社は見つからない扱い）
  if v_parent is not null and not exists (
       select 1 from tickets t where t.id = v_parent and t.tenant_id = v_tenant and t.deleted_at is null and app.ticket_visible(t.id)) then
    return jsonb_build_object('ok', false, 'status', 404, 'code', 'PARENT_NOT_FOUND', 'field', 'parent_ticket_id');
  end if;
  -- 知らせる人：同じワークスペースの人だけ（別の会社の人は「無い」と同じ扱いで止める）
  select coalesce(array_agg(distinct x::uuid), '{}') into v_notify from jsonb_array_elements_text(coalesce(p->'notify_member_ids', '[]'::jsonb)) x;
  foreach nm in array v_notify loop
    if not app.ticket_member_ok(v_tenant, nm) then
      return jsonb_build_object('ok', false, 'status', 422, 'code', 'NOTIFY_GONE', 'field', 'notify_member_ids');
    end if;
  end loop;
  -- 種別の必須の区画（kind_sections.mode = required・種別のマスタ 1 か所から引く・D-125.53）
  select coalesce(array_agg(ks.section_key order by ks.position), '{}') into v_missing from kind_sections ks
    where ks.kind_id = v_kind and ks.tenant_id = v_tenant and ks.deleted_at is null and ks.mode = 'required'
      and coalesce(btrim(p->'sections'->>ks.section_key), '') = '';
  if array_length(v_missing, 1) > 0 then
    return jsonb_build_object('ok', false, 'status', 422, 'code', 'SECTION_REQUIRED', 'field', 'sections', 'detail', to_jsonb(v_missing));
  end if;
  -- 作った直後は「未着手」。仕組みの段（確認中・承認待ち・実行中）は選ばせない（D-125.38）
  select id into v_stage from ticket_stages where tenant_id = v_tenant and key = 'todo' and deleted_at is null;
  begin
    insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, parent_ticket_id,
                         start_on, due_on, priority, priority_reason, estimate_minutes, created_by, updated_by)
    values (v_tenant, v_scope, 'pending', v_kind, v_stage, p->>'title', v_assignee, v_parent,
            nullif(p->>'start_on', '')::date, (p->>'due_on')::date, coalesce(nullif(p->>'priority', ''), 'mid'),
            nullif(p->>'priority_reason', ''), nullif(p->>'estimate_minutes', '')::int, v_me, v_me)
    returning id, number into v_id, v_number;
  exception when sqlstate '22023' then
    if sqlerrm like '%3 段%' then return jsonb_build_object('ok', false, 'status', 422, 'code', 'PARENT_DEPTH', 'field', 'parent_ticket_id'); end if;
    raise;
  end;
  -- 区画：書かれたものを 1 行ずつ（版 1）。種別に無い鍵は入れない
  for sec in select ks.section_key, ks.position from kind_sections ks
             where ks.kind_id = v_kind and ks.tenant_id = v_tenant and ks.deleted_at is null and ks.mode <> 'hidden'
               and coalesce(btrim(p->'sections'->>ks.section_key), '') <> '' loop
    v_body := jsonb_build_object('text', p->'sections'->>sec.section_key);
    insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
      values (v_tenant, v_id, sec.section_key, sec.position, v_body, 1, v_me, v_me) returning id into v_sid;
    insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, created_by)
      values (v_tenant, v_id, v_sid, 1, v_body, v_me, v_me);
  end loop;
  -- 受け箱：担当者が自分でなければ「担当になりました」、知らせる人には「チケットができました」。同じ人には 1 通。本文は入れない（題名と番号だけ）
  if v_assignee <> v_me then
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
      values (v_tenant, v_assignee, 'inapp', 'ticket.assigned', jsonb_build_object('ticket_id', v_id, 'number', v_number, 'title', p->>'title'),
              'ticket_assigned:' || v_id || ':' || v_assignee, v_me);
  end if;
  foreach nm in array v_notify loop
    if nm <> v_me and nm <> v_assignee then
      insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
        values (v_tenant, nm, 'inapp', 'ticket.created', jsonb_build_object('ticket_id', v_id, 'number', v_number, 'title', p->>'title'),
                'ticket_created:' || v_id || ':' || nm, v_me);
    end if;
  end loop;
  -- 下書きを使って作ったなら、その下書きを片付ける
  if nullif(p->>'draft_id', '') is not null then
    delete from app.ticket_drafts where tenant_id = v_tenant and member_id = v_me and draft_id = (p->>'draft_id')::uuid;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'number', v_number);
end $$;
revoke all on function app.ticket_create(jsonb) from public;
grant execute on function app.ticket_create(jsonb) to kaname_app;

-- 下書き：残す（同じ下書きの id なら上書き）・捨てる。1 人 1 ワークスペースで 20 件まで（古いものから消す）
create or replace function app.ticket_draft_save(p_draft uuid, p_body jsonb, p_discard boolean) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); r record;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then raise exception '本人の文脈が無い' using errcode = '42501'; end if;
  if p_discard then
    delete from app.ticket_drafts where tenant_id = v_tenant and member_id = v_me and draft_id = p_draft;
    return jsonb_build_object('draft_id', p_draft, 'body', null, 'saved_at', null);
  end if;
  insert into app.ticket_drafts (tenant_id, member_id, draft_id, body, saved_at)
    values (v_tenant, v_me, p_draft, coalesce(p_body, '{}'::jsonb), now())
    on conflict (tenant_id, member_id, draft_id) do update set body = excluded.body, saved_at = now()
    returning draft_id, body, saved_at into r;
  delete from app.ticket_drafts d where d.tenant_id = v_tenant and d.member_id = v_me and d.draft_id in (
    select draft_id from app.ticket_drafts where tenant_id = v_tenant and member_id = v_me order by saved_at desc offset 20);
  return jsonb_build_object('draft_id', r.draft_id, 'body', r.body, 'saved_at', r.saved_at);
end $$;
revoke all on function app.ticket_draft_save(uuid, jsonb, boolean) from public;
grant execute on function app.ticket_draft_save(uuid, jsonb, boolean) to kaname_app;

create or replace function app.ticket_drafts_mine() returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('draft_id', d.draft_id, 'body', d.body, 'saved_at', d.saved_at) order by d.saved_at desc), '[]'::jsonb)
  from app.ticket_drafts d
  where app.member_ok() and d.tenant_id = app.tenant_id() and d.member_id = app.user_id()
$$;
revoke all on function app.ticket_drafts_mine() from public;
grant execute on function app.ticket_drafts_mine() to kaname_app;

insert into app.schema_migrations (name) values ('0090_ticket_create.sql') on conflict do nothing;
