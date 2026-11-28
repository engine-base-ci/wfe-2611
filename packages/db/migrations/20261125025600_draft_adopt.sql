-- 20261125025600 作った後に、作る画面の会話をチケットの会話へ移す（K-776・D-153.17・関門 C2）
--   新しい表・列・索引は作らない（会話の種類 talk_kind・ticket_id・人 × チケットで 1 つの索引は K-757・20261125023700）。関数を 1 つ足す。
-- app.draft_adopt(p_conv, p_ticket)：作る画面の会話（draft）の持ち主で、そのチケットを作った人が呼ぶと、同じ会話の行を
--   種類 ticket・そのチケットの会話にし（会話の id・持ち主・今までの行は変えない）、最後に 1 行の知らせ（kind note）と証跡 conversation.adopt を書く（1 取引）。
--   答え：{ conversation_id, ticket_id } ／ { error: not_member | not_found | forbidden | not_draft | moved | has_talk }（断るときは何も書かない）
create or replace function app.draft_adopt(p_conv uuid, p_ticket uuid)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_me uuid := app.user_id(); v_tenant uuid := app.tenant_id(); c conversations%rowtype; t tickets%rowtype;
begin
  if v_me is null or v_tenant is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 会話（自分の・消していない）。同じ会話を同時に移す 2 つを 1 つずつにする
  select * into c from conversations x
   where x.id = p_conv and x.tenant_id = v_tenant and x.owner_member_id = v_me and x.deleted_at is null
   for update;
  if c.id is null then return jsonb_build_object('error', 'not_found'); end if;
  -- チケット（無い・消した・別の会社・見えない）。作った人かより先に見る（見えないチケットは在るかを漏らさない）
  select * into t from tickets x where x.id = p_ticket and x.tenant_id = v_tenant and x.deleted_at is null;
  if t.id is null or not app.ticket_visible(p_ticket) then return jsonb_build_object('error', 'not_found'); end if;
  if t.created_by is distinct from v_me then return jsonb_build_object('error', 'forbidden'); end if;
  if c.talk_kind = 'ticket' then return jsonb_build_object('error', 'moved'); end if;
  if c.talk_kind is distinct from 'draft' then return jsonb_build_object('error', 'not_draft'); end if;
  if exists (select 1 from conversations x
              where x.owner_member_id = v_me and x.talk_kind = 'ticket' and x.ticket_id = p_ticket and x.deleted_at is null) then
    return jsonb_build_object('error', 'has_talk');
  end if;
  begin
    update conversations set talk_kind = 'ticket', ticket_id = p_ticket, updated_at = now(), updated_by = v_me
     where id = p_conv;
  exception when unique_violation then
    -- 同じチケットへ同時に移した 2 つ目（人 × チケットで 1 つの索引）
    return jsonb_build_object('error', 'has_talk');
  end;
  insert into messages (tenant_id, conversation_id, sender_member_id, body, kind)
    values (v_tenant, p_conv, null, 'このチケットを作りました（' || t.number || '）。作る時の会話はここに続きます', 'note');
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, v_me, 'member', 'conversation.adopt', 'conversations', p_conv::text, 'C2',
            jsonb_build_object('ticket_id', p_ticket), v_me);
  return jsonb_build_object('conversation_id', p_conv, 'ticket_id', p_ticket);
end $$;
revoke all on function app.draft_adopt(uuid, uuid) from public;
grant execute on function app.draft_adopt(uuid, uuid) to kaname_app;
