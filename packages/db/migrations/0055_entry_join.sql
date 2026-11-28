-- 0055 同じ返答の文は 1 つの吹き出しに（D-115）。Bridge は、同じ返答の中で文が 2 行に分かれたとき（考える が挟まった等）、
--   最初の文の id のまま、つないだ文を送り直す。受ける側は、同じ id の吹き出しの中身を、その続きになっている文でだけ書き換える
--   （短い文・前の文から始まらない文では上書きしない＝写しを壊さない）。
create or replace function app.bridge_entries(p_session uuid, p_conv uuid, p_job uuid, p_entries jsonb) returns integer
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; c conversations%rowtype; e jsonb; n int := 0; k int; v_job uuid; t text;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return 0; end if;
  select * into c from conversations where id = p_conv and owner_member_id = v_member and deleted_at is null;
  if c.id is null or jsonb_typeof(p_entries) <> 'array' then return 0; end if;
  select id into v_job from bridge_jobs where id = p_job and member_id = v_member and conversation_id = p_conv;
  for e in select * from jsonb_array_elements(p_entries) loop
    continue when coalesce(e->>'uuid', '') !~ '^[0-9a-f-]{8,64}$' or coalesce(trim(e->>'text'), '') = '';
    t := left(e->>'text', 200000);
    if exists (select 1 from messages m where m.conversation_id = c.id and m.transcript_uuid = e->>'uuid') then
      -- 同じ返答の続きが届いた：前の文から始まり、それより長いときだけ書き換える
      update messages set body = t
       where conversation_id = c.id and transcript_uuid = e->>'uuid' and deleted_at is null
         and length(t) > length(body) and left(t, length(body)) = body;
      get diagnostics k = row_count;
      n := n + k;
      continue;
    end if;
    -- 写す前からある同じ文（id を持たない前の答え）は、その吹き出しに id を付けるだけ（履歴を二重にしない）
    update messages set transcript_uuid = e->>'uuid'
     where id = (select m.id from messages m
                  where m.conversation_id = c.id and m.kind = 'ai' and m.transcript_uuid is null and m.deleted_at is null
                    and btrim(m.body) = btrim(t)
                  order by m.created_at limit 1);
    continue when found;
    insert into messages (tenant_id, conversation_id, body, kind, job_id, transcript_uuid, created_at)
      values (c.tenant_id, c.id, t, 'ai', v_job, e->>'uuid',
              coalesce(case when e->>'at' ~ '^\d{4}-\d{2}-\d{2}T' then (e->>'at')::timestamptz end, now()))
      on conflict (conversation_id, transcript_uuid) where transcript_uuid is not null do nothing;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end $$;
grant execute on function app.bridge_entries(uuid, uuid, uuid, jsonb) to kaname_app;
