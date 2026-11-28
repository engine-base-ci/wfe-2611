-- 許可の既定を読む（D-104.14）。members を読む側で生の select をすると行レベルの制御に弾かれて黙って既定値になるので、関数の中で読む
create or replace function app.agent_default_mode(p_member uuid) returns text
language sql stable security definer set search_path = public, app as $$
  select coalesce((select agent_permission_mode from members where id = p_member and deleted_at is null), 'manual');
$$;
grant execute on function app.agent_default_mode(uuid) to kaname_app;

-- 資料の署名 URL（D-104.11）：証跡に「誰に出したか」を残すため、仕事の持ち主（その Bridge の本人）も返す
create or replace function app.bridge_attachment(p_session uuid, p_job uuid, p_attachment uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v jsonb;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  select jsonb_build_object('storage_ref', a.storage_ref, 'name', a.name, 'mime', a.mime, 'size', a.size, 'tenant_id', a.tenant_id, 'member_id', j.member_id) into v
    from bridge_jobs j join attachments a on a.id = p_attachment and a.id = any(coalesce(j.attachment_ids, '{}'))
   where j.id = p_job and j.member_id = v_member and j.state_id in ('running', 'asking');
  return v;
end $$;

-- 署名 URL の受け口が、その置き場の資料を付けた本人を引く（証跡の主語。署名と期限の判定は API 側）
create or replace function app.attachment_owner(p_ref text) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select jsonb_build_object('tenant_id', a.tenant_id, 'member_id', a.uploaded_by)
    from attachments a where a.storage_ref = p_ref and a.deleted_at is null limit 1;
$$;
grant execute on function app.attachment_owner(text) to kaname_app;

-- 会話の一覧（D-104.1）：探したときの中身は、見つけた語のまわりを返す（先頭 120 字だと語が切れて見えない）
create or replace function app.agent_conversations(p_member uuid, p_q text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v jsonb; q text := nullif(trim(coalesce(p_q, '')), '');
begin
  select coalesce(jsonb_agg(x order by (x->>'starred')::boolean desc, x->>'updated_at' desc), '[]'::jsonb) into v from (
    select jsonb_build_object(
      'id', c.id, 'title', coalesce(c.title, '新しい会話'), 'title_auto', c.title_auto,
      'starred', c.starred_at is not null, 'incognito', c.incognito, 'updated_at', c.updated_at,
      'unread', (select count(*) from messages m where m.conversation_id = c.id and m.deleted_at is null and m.kind = 'ai'
                   and m.created_at > coalesce(c.last_read_at, 'epoch'::timestamptz)),
      'hit', case when q is null then null else
              (select substr(m.body, greatest(1, strpos(lower(m.body), lower(q)) - 60), 160 + length(q))
                 from messages m where m.conversation_id = c.id and m.deleted_at is null
                 and m.body ilike '%' || q || '%' order by m.created_at desc limit 1) end) as x
      from conversations c
     where c.owner_member_id = p_member and c.deleted_at is null
       and (q is null or c.title ilike '%' || q || '%'
            or exists (select 1 from messages m where m.conversation_id = c.id and m.deleted_at is null and m.body ilike '%' || q || '%'))
     order by c.updated_at desc limit 200
  ) t;
  return v;
end $$;

-- 直して送り直す（D-104.17）：その時点から新しいセッション。元の会話は残し、直した文より前のやりとりは新しい会話にも写す
--   （写さないと、画面では前の話が消え、自分のAI も何の続きか分からない）
create or replace function app.agent_open_conversation(p_member uuid, p_conv uuid, p_branch_from uuid, p_title text)
returns table (conv_id uuid, agent_session text)
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_id uuid; v_sess text; v_parent uuid; v_at timestamptz;
begin
  select tenant_id, scope_id into v_tenant, v_scope from members where id = p_member;
  if p_branch_from is not null then
    select m.conversation_id, m.created_at into v_parent, v_at from messages m join conversations c on c.id = m.conversation_id
      where m.id = p_branch_from and c.owner_member_id = p_member and c.deleted_at is null;
    if v_parent is not null then
      insert into conversations (tenant_id, scope_id, owner_member_id, title, title_auto, parent_conversation_id, branched_from_message_id, incognito, created_by)
        select v_tenant, v_scope, p_member, c.title, c.title_auto, v_parent, p_branch_from, c.incognito, p_member from conversations c where c.id = v_parent
        returning conversations.id into v_id;
      insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, quote, attachments, work, created_at)
        select m.tenant_id, v_id, m.sender_member_id, m.body, m.kind, m.quote, m.attachments, m.work, m.created_at
          from messages m where m.conversation_id = v_parent and m.deleted_at is null and m.created_at < v_at and m.kind in ('human', 'ai')
          order by m.created_at;
      return query select v_id, null::text;
      return;
    end if;
    return;   -- 直す元の文が無い（消した・他人の）。黙って別の会話に書かない
  end if;
  if p_conv is not null then
    select c.id, c.agent_session_id into v_id, v_sess from conversations c
      where c.id = p_conv and c.owner_member_id = p_member and c.deleted_at is null;
    if v_id is not null then return query select v_id, v_sess; return; end if;
    return;   -- 指定された会話が無い（消した・他人の）。黙って別の会話に書かない
  end if;
  select c.id, c.agent_session_id into v_id, v_sess from conversations c
    where c.owner_member_id = p_member and c.closed_at is null and c.deleted_at is null
    order by c.updated_at desc limit 1;
  if v_id is null then
    insert into conversations (tenant_id, scope_id, owner_member_id, title, title_auto, created_by)
      values (v_tenant, v_scope, p_member, p_title, true, p_member) returning conversations.id into v_id;
  end if;
  return query select v_id, v_sess;
end $$;
