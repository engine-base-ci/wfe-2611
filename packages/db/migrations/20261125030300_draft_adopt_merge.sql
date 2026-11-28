-- 20261125030300 作った直後に右のパネルで先に話していたら、作る時の会話を先に在る会話へ時間の順にまとめる（K-783・D-153.36・関門 C2）
--   K-776 の app.draft_adopt（20261125025600）を写して直す。新しい表・列・索引は作らない。
--   先に在る会話＝呼んだ人の・そのチケットの・種類 ticket・消していない会話（人 × チケットで 1 つ・K-757 の索引）。
--   在れば：作る画面の会話の行と仕事をそこへ移し（行の時刻はそのまま＝読む口が時刻の順に並べる）、作る画面の会話は消えた印にし、
--     知らせの 1 行と証跡（payload に merged_into）を書く → { conversation_id: 先に在る会話の id, ticket_id }
--   無ければ：K-776 の道（作る画面の会話そのものをチケットの会話にする）。
--   同じ人 × 同じチケットの移しは錠で 1 つずつ。錠を取らない右のパネルの最初の一言とぶつかったら（一意の索引）、読み直してまとめる。
--   答え：{ conversation_id, ticket_id } ／ { error: not_member | not_found | forbidden | not_draft | moved }（断るときは何も書かない）
create or replace function app.draft_adopt(p_conv uuid, p_ticket uuid)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_me uuid := app.user_id(); v_tenant uuid := app.tenant_id(); c conversations%rowtype; t tickets%rowtype;
        v_into uuid; v_clash boolean := false;
begin
  if v_me is null or v_tenant is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 会話（自分の・消していない）。同じ会話を同時に移す 2 つを 1 つずつにする
  select * into c from conversations x
   where x.id = p_conv and x.tenant_id = v_tenant and x.owner_member_id = v_me and x.deleted_at is null
   for update;
  if c.id is null then return jsonb_build_object('error', 'not_found'); end if;
  -- 同じ人 × 同じチケットへの移しを 1 つずつにする（2 つ目は 1 つ目が作ったチケットの会話へまとめる）
  perform pg_advisory_xact_lock(hashtextextended('draft_adopt:' || v_me::text || ':' || p_ticket::text, 0));
  -- チケット（無い・消した・別の会社・見えない）。作った人かより先に見る（見えないチケットは在るかを漏らさない）
  select * into t from tickets x where x.id = p_ticket and x.tenant_id = v_tenant and x.deleted_at is null;
  if t.id is null or not app.ticket_visible(p_ticket) then return jsonb_build_object('error', 'not_found'); end if;
  if t.created_by is distinct from v_me then return jsonb_build_object('error', 'forbidden'); end if;
  if c.talk_kind = 'ticket' then return jsonb_build_object('error', 'moved'); end if;
  if c.talk_kind is distinct from 'draft' then return jsonb_build_object('error', 'not_draft'); end if;

  select x.id into v_into from conversations x
   where x.tenant_id = v_tenant and x.owner_member_id = v_me and x.talk_kind = 'ticket' and x.ticket_id = p_ticket
     and x.deleted_at is null;
  if v_into is null then
    begin
      update conversations set talk_kind = 'ticket', ticket_id = p_ticket, updated_at = now(), updated_by = v_me
       where id = p_conv;
    exception when unique_violation then
      -- 錠を取らない右のパネルの最初の一言が、上の「無い」を見た後に先に確定した。この update だけが戻る
      v_clash := true;
    end;
    if not v_clash then
      insert into messages (tenant_id, conversation_id, sender_member_id, body, kind)
        values (v_tenant, p_conv, null, 'このチケットを作りました（' || t.number || '）。作る時の会話はここに続きます', 'note');
      insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
        values (v_tenant, v_me, 'member', 'conversation.adopt', 'conversations', p_conv::text, 'C2',
                jsonb_build_object('ticket_id', p_ticket), v_me);
      return jsonb_build_object('conversation_id', p_conv, 'ticket_id', p_ticket);
    end if;
    -- 読み直す（確定した右のパネルの会話）。見つからない（消された直後）ときは止める側に倒す（口が 503）
    select x.id into v_into from conversations x
     where x.tenant_id = v_tenant and x.owner_member_id = v_me and x.talk_kind = 'ticket' and x.ticket_id = p_ticket
       and x.deleted_at is null;
    if v_into is null then
      raise exception 'draft_adopt: 一意の索引がぶつかったのに、先に在る会話が見つからない';
    end if;
  end if;

  -- まとめる：行と仕事を先に在る会話へ（時刻はそのまま）。作る画面の会話は消えた印
  update messages set conversation_id = v_into where conversation_id = p_conv;
  update bridge_jobs set conversation_id = v_into where conversation_id = p_conv;
  update conversations set deleted_at = now(), updated_at = now(), updated_by = v_me where id = p_conv;
  update conversations set updated_at = now(), updated_by = v_me where id = v_into;
  insert into messages (tenant_id, conversation_id, sender_member_id, body, kind)
    values (v_tenant, v_into, null,
            'このチケットを作りました（' || t.number || '）。作る時の会話を、ここに時間の順にまとめました', 'note');
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, v_me, 'member', 'conversation.adopt', 'conversations', p_conv::text, 'C2',
            jsonb_build_object('ticket_id', p_ticket, 'merged_into', v_into), v_me);
  return jsonb_build_object('conversation_id', v_into, 'ticket_id', p_ticket);
end $$;
revoke all on function app.draft_adopt(uuid, uuid) from public;
grant execute on function app.draft_adopt(uuid, uuid) to kaname_app;
