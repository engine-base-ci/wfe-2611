-- 0045 成果物は会話の横で開いて直し、版を残して戻す（D-106・T-B-23）。
--   返事から書き出すと版 1 ができる。直す・戻すは版を 1 つ足すだけで、どの版も消さない（D-106.3・D-106.4）。
--   中身は会社の置き場（関門 C4）。ここに持つのは置き場の参照だけ。読む・書くは下の関数を通す（行レベルの制御があるので生の select をしない）

alter table artifacts add column if not exists title text;
alter table artifacts add column if not exists owner_member_id uuid references members(id);
alter table artifacts add column if not exists current_version int;
alter table artifacts add column if not exists source_conversation_id uuid references conversations(id);
create index if not exists artifacts_owner_member_id_idx on artifacts (owner_member_id);
create index if not exists artifacts_source_conversation_id_idx on artifacts (source_conversation_id);

-- E-051 artifact_versions（gen_ddl.py の出力＋必須の列）
create table if not exists artifact_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  artifact_id uuid not null references artifacts(id),
  version int not null,
  storage_ref text not null,
  size_bytes bigint,
  owner_member_id uuid references members(id),
  reverted_from int,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (artifact_id, version)
);
create index if not exists artifact_versions_tenant_idx on artifact_versions (tenant_id);
create index if not exists artifact_versions_scope_idx on artifact_versions (tenant_id, scope_id);
create index if not exists artifact_versions_artifact_id_idx on artifact_versions (artifact_id);
create index if not exists artifact_versions_owner_member_id_idx on artifact_versions (owner_member_id);
create index if not exists artifact_versions_storage_ref_idx on artifact_versions (storage_ref);
drop trigger if exists artifact_versions_updated_at on artifact_versions; create trigger artifact_versions_updated_at before update on artifact_versions for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('artifact_versions', 'artifact_versions') on conflict do nothing;
grant select, insert, update, delete on artifact_versions to kaname_app;

-- 形：直せるのは文書（md）と表（csv）。画像・PDF・動画・音声は見るだけ（D-106.5）
create or replace function app.artifact_editable(p_format text) returns boolean
language sql immutable as $$ select coalesce(p_format, '') in ('md', 'csv') $$;

-- 1 件と版の一覧（本人の物だけ。置き場の参照は API が中身を引くために返す・画面には出さない）
create or replace function app.artifact_get(p_member uuid, p_id uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object(
    'id', a.id, 'title', a.title, 'format', a.format_id, 'current_version', a.current_version,
    'editable', app.artifact_editable(a.format_id), 'conversation_id', a.source_conversation_id,
    'message_id', a.source_message_id, 'tenant_id', a.tenant_id, 'updated_at', a.updated_at,
    'storage_ref', (select v.storage_ref from artifact_versions v where v.artifact_id = a.id and v.version = a.current_version),
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object('version', v.version, 'at', v.created_at, 'by', coalesce(m.display_name, ''),
                                          'reverted_from', v.reverted_from, 'size', v.size_bytes, 'note', v.note) order by v.version desc)
        from artifact_versions v left join members m on m.id = v.owner_member_id
       where v.artifact_id = a.id and v.deleted_at is null), '[]'::jsonb))
    from artifacts a where a.id = p_id and a.owner_member_id = p_member and a.deleted_at is null
$$;
grant execute on function app.artifact_get(uuid, uuid) to kaname_app;

-- 会話の成果物（開き直すためのカード・D-106.2）。会話を指さなければ本人の全部（新しい順・100 件まで）
create or replace function app.artifact_list(p_member uuid, p_conv uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(x order by x->>'updated_at' desc), '[]'::jsonb) from (
    select jsonb_build_object('id', a.id, 'title', a.title, 'format', a.format_id, 'current_version', a.current_version,
                              'message_id', a.source_message_id, 'conversation_id', a.source_conversation_id, 'updated_at', a.updated_at) as x
      from artifacts a
     where a.owner_member_id = p_member and a.deleted_at is null and (p_conv is null or a.source_conversation_id = p_conv)
     order by a.updated_at desc limit 100) s
$$;
grant execute on function app.artifact_list(uuid, uuid) to kaname_app;

-- 書き出す（D-106.1）：本人の会話の自分のAI の返事からだけ作れる。中身は API が先に置き場に置いてから呼ぶ
create or replace function app.artifact_create(p_member uuid, p_message uuid, p_title text, p_format text, p_ref text, p_size bigint) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_conv uuid; v_id uuid;
begin
  select m.tenant_id, m.scope_id into v_tenant, v_scope from members m where m.id = p_member and m.deleted_at is null;
  if v_tenant is null then return null; end if;
  select c.id into v_conv from messages x join conversations c on c.id = x.conversation_id
   where x.id = p_message and x.kind = 'ai' and x.deleted_at is null and c.owner_member_id = p_member and c.deleted_at is null;
  if v_conv is null then return null; end if;
  if coalesce(p_format, '') not in ('md', 'csv') then raise exception '書き出せるのは文書（md）と表（csv）'; end if;
  insert into artifacts (tenant_id, scope_id, format_id, storage_ref, source_message_id, source_conversation_id, title, owner_member_id, current_version, created_by, updated_by)
    values (v_tenant, v_scope, p_format, p_ref, p_message, v_conv, left(coalesce(nullif(trim(p_title), ''), '成果物'), 80), p_member, 1, p_member, p_member)
    returning id into v_id;
  insert into artifact_versions (tenant_id, scope_id, artifact_id, version, storage_ref, size_bytes, owner_member_id, note, created_by, updated_by)
    values (v_tenant, v_scope, v_id, 1, p_ref, p_size, p_member, '書き出し', p_member, p_member);
  return v_id;
end $$;
grant execute on function app.artifact_create(uuid, uuid, text, text, text, bigint) to kaname_app;

-- 直す・戻す（D-106.3・D-106.4）：版を 1 つ足し、今の版を進める。前の版は消さない。直せるのは本人・文書と表だけ
create or replace function app.artifact_add_version(p_member uuid, p_id uuid, p_ref text, p_size bigint, p_reverted_from int) returns int
language plpgsql security definer set search_path = public, app as $$
declare a artifacts%rowtype; v_next int;
begin
  select * into a from artifacts where id = p_id and owner_member_id = p_member and deleted_at is null for update;
  if a.id is null then return null; end if;
  if not app.artifact_editable(a.format_id) then raise exception 'この種類は見るだけです（直せません）'; end if;
  if p_reverted_from is not null and not exists (select 1 from artifact_versions where artifact_id = p_id and version = p_reverted_from and deleted_at is null) then
    raise exception 'その版はありません';
  end if;
  v_next := coalesce((select max(version) from artifact_versions where artifact_id = p_id), 0) + 1;
  insert into artifact_versions (tenant_id, scope_id, artifact_id, version, storage_ref, size_bytes, owner_member_id, reverted_from, note, created_by, updated_by)
    values (a.tenant_id, a.scope_id, a.id, v_next, p_ref, p_size, p_member, p_reverted_from,
            case when p_reverted_from is null then '直した' else '版 ' || p_reverted_from || ' に戻した' end, p_member, p_member);
  update artifacts set current_version = v_next, storage_ref = p_ref, updated_by = p_member where id = a.id;
  return v_next;
end $$;
grant execute on function app.artifact_add_version(uuid, uuid, text, bigint, int) to kaname_app;

-- 名前を直す（D-106.1）
create or replace function app.artifact_rename(p_member uuid, p_id uuid, p_title text) returns boolean
language plpgsql security definer set search_path = public, app as $$
begin
  if nullif(trim(coalesce(p_title, '')), '') is null then return false; end if;
  update artifacts set title = left(trim(p_title), 80), updated_by = p_member where id = p_id and owner_member_id = p_member and deleted_at is null;
  return found;
end $$;
grant execute on function app.artifact_rename(uuid, uuid, text) to kaname_app;

-- ある版の置き場（中身を読む・戻す元・落とす）
create or replace function app.artifact_version_ref(p_member uuid, p_id uuid, p_version int) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object('storage_ref', v.storage_ref, 'format', a.format_id, 'title', a.title, 'version', v.version, 'tenant_id', a.tenant_id)
    from artifacts a join artifact_versions v on v.artifact_id = a.id and v.version = coalesce(p_version, a.current_version) and v.deleted_at is null
   where a.id = p_id and a.owner_member_id = p_member and a.deleted_at is null
$$;
grant execute on function app.artifact_version_ref(uuid, uuid, int) to kaname_app;

-- 署名つきの置き場（/files/:ref）を開くときの持ち主：資料に加えて成果物の版も引く（画像・PDF を横で見る・D-106.5）
create or replace function app.attachment_owner(p_ref text) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(
    (select jsonb_build_object('tenant_id', a.tenant_id, 'member_id', a.uploaded_by)
       from attachments a where a.storage_ref = p_ref and a.deleted_at is null limit 1),
    (select jsonb_build_object('tenant_id', v.tenant_id, 'member_id', v.owner_member_id)
       from artifact_versions v where v.storage_ref = p_ref and v.deleted_at is null limit 1))
$$;
grant execute on function app.attachment_owner(text) to kaname_app;
