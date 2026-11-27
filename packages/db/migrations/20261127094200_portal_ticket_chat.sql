-- 20261127094200 見せたチケットのチャット（K-882・契約の口 postPortalTicketMessage・D-155.53・D-155.41・D-155.44・D-155.45・関門 C2・C6）
--   ① ticket_messages.from_request（依頼から来た書き込み・既定 false・K-894 が true で入れる）と ticket_messages.guest_visible（ゲストに見える書き込みか・null でない）
--   ② 引き金 ticket_messages_guest_visible：入れる行の guest_visible が null なら「post で、そのチケットに今も生きている見せる相手が在る」で決める（明示の値はそのまま）
--   ③ app.portal_ticket_messages(tid)：ゲストに見えるチケットの印の付いた post（社内の人と自分のグループのゲストの物）を古い順に。見えなければ null
--   ③の2 app.ticket_timeline_item を作り直す（20261120130000 の物に、from_request が true の行の message にだけ鍵 from_request を足す）
--   ④ app.portal_ticket_message_post(tid, body)：ゲストが見せたチケットのチャットに書く（担当者の受け箱に 1 件・証跡・メールは送らない・1 つの取引）
--   ⑤ ゲストは ticket_messages を表では読めず書けない（行の守りは足さない）
--
-- どれも security definer・search_path に pg_temp・public から外し kaname_app にだけ渡す（引き金の関数と ticket_timeline_item は渡さない）

alter table ticket_messages add column if not exists from_request boolean not null default false;
alter table ticket_messages add column if not exists guest_visible boolean;
update ticket_messages set guest_visible = false where guest_visible is null;
-- null でない印は、検査の制約を not valid で足して確かめてから付ける（表を読む間止めない・G58 Squawk の adding-not-nullable-field・PM の決め 2026-11-28）。検査の制約は NOT NULL と同じ意味で残す（消すと ban-drop-constraint）
alter table ticket_messages add constraint ticket_messages_guest_visible_nn check (guest_visible is not null) not valid;
alter table ticket_messages validate constraint ticket_messages_guest_visible_nn;
alter table ticket_messages alter column guest_visible set not null;
comment on column ticket_messages.guest_visible is 'ゲストに見える書き込みか。見せたチケットに見せた後で書いた post に引き金が true を付ける（K-882）';
comment on column ticket_messages.from_request is '依頼から来た書き込み（K-894 が true で入れる・K-882）';
create index if not exists ticket_messages_guest_idx on ticket_messages (ticket_id, created_at, id) where guest_visible and deleted_at is null;

-- ② 印を決める（入れる側が明示すればそのまま）
create or replace function app.ticket_message_guest_visible() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if new.guest_visible is null then
    new.guest_visible := new.kind = 'post' and exists (
      select 1 from ticket_guest_shares s where s.ticket_id = new.ticket_id and s.deleted_at is null);
  end if;
  return new;
end $$;
revoke all on function app.ticket_message_guest_visible() from public;
drop trigger if exists ticket_messages_guest_visible on ticket_messages;
create trigger ticket_messages_guest_visible before insert on ticket_messages
  for each row execute function app.ticket_message_guest_visible();

-- ③ ゲストが読む（先方の口 getPortalTicket・K-906 の messages の元）。社内の人の物と自分のグループのゲストの物だけ
create or replace function app.portal_ticket_messages(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_group uuid;
begin
  if not app.guest_ok() or not app.guest_sees_ticket(p_ticket) then
    return null;
  end if;
  v_group := app.my_guest_group();
  return coalesce((
    select jsonb_agg(
             jsonb_build_object('id', x.id, 'side', x.side, 'name', x.name, 'at', x.created_at, 'text', x.body)
             || case when x.from_request then jsonb_build_object('from_request', true) else '{}'::jsonb end
             order by x.created_at, x.id)
      from (
        select m.id, m.created_at, m.body, m.from_request,
               case when g.is_guest then 'they' else 'we' end as side,
               coalesce(a.display_name, '') as name, g.is_guest, g.same_group
          from ticket_messages m
          left join members a on a.id = m.author_member_id
          cross join lateral (
            select exists (select 1 from tenant_memberships tm
                            where tm.tenant_id = m.tenant_id and tm.member_id = m.author_member_id
                              and tm.role = 'requester' and tm.deleted_at is null) as is_guest,
                   exists (select 1 from guest_group_members gm
                            where gm.tenant_id = m.tenant_id and gm.member_id = m.author_member_id
                              and gm.guest_group_id = v_group and gm.deleted_at is null) as same_group
          ) g
         where m.ticket_id = p_ticket and m.tenant_id = v_tenant
           and m.kind = 'post' and m.guest_visible and m.deleted_at is null
      ) x
     where not x.is_guest or x.same_group
  ), '[]'::jsonb);
end $$;
revoke all on function app.portal_ticket_messages(uuid) from public;
grant execute on function app.portal_ticket_messages(uuid) to kaname_app;

-- ③の2 社内の読みの 1 件（20261120130000 の物に from_request の鍵だけを足す）
create or replace function app.ticket_timeline_item(p_message uuid, p_seen timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  r ticket_messages%rowtype; v_me uuid := app.user_id(); v_scope uuid; v_kind text; v_stars jsonb; v_msg jsonb := null;
begin
  select * into r from ticket_messages where id = p_message and tenant_id = app.tenant_id();
  if r.id is null then return null; end if;
  v_kind := case when r.kind = 'post' and r.deleted_at is not null then 'deleted' else r.kind end;
  if v_kind in ('post', 'system') then
    select t.scope_id into v_scope from tickets t where t.id = r.ticket_id;
    v_stars := case when jsonb_typeof(r.reactions->'star') = 'array' then r.reactions->'star' else '[]'::jsonb end;
    v_msg := jsonb_build_object(
      'body', r.body,
      'mentions', app.ticket_timeline_whos(r.mentions),
      'notified', app.ticket_timeline_whos(r.notify_member_ids),
      'quote', case when r.quote_of_id is not null or r.quote_text is not null
                    then jsonb_build_object('id', r.quote_of_id, 'excerpt', r.quote_text) end,
      'edited_at', r.edited_at,
      'stars', jsonb_array_length(v_stars),
      'starred', v_me is not null and v_stars ? v_me::text,
      'is_new', r.kind = 'post' and r.author_member_id is distinct from v_me and (p_seen is null or r.created_at > p_seen),
      'decided', app.ticket_message_decided(r.id),
      'can_edit', r.kind = 'post' and r.author_member_id = v_me,
      'can_delete', r.kind = 'post' and (r.author_member_id = v_me or app.manages_scope(v_scope)))
      -- K-882：依頼から来た書き込み（K-894 が入れる）にだけ鍵 from_request を足す（ほかの行の鍵は今のまま）
      || case when r.from_request then jsonb_build_object('from_request', true) else '{}'::jsonb end;
  end if;
  return jsonb_build_object(
    'id', r.id,
    'kind', v_kind,
    'at', r.created_at,
    'actor', app.ticket_timeline_who(case when r.kind = 'system' then r.created_by else r.author_member_id end),
    'message', v_msg,
    'changes', r.changes,
    'run', null,
    'deleted', case when v_kind = 'deleted' then jsonb_build_object(
                 'by', app.ticket_timeline_who(r.deleted_by),
                 'author', app.ticket_timeline_who(r.author_member_id),
                 'by_manager', r.deleted_by is distinct from r.author_member_id) end);
end $$;
revoke all on function app.ticket_timeline_item(uuid, timestamptz) from public;

-- ④ ゲストが書く。見えなければ 42501・hint E-GST-060（在るかを漏らさない）。書き込み・担当者の受け箱・証跡は 1 つの取引
create or replace function app.portal_ticket_message_post(p_ticket uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_me uuid := app.user_id();
  t record;
  v_id uuid;
begin
  -- ゲストの文脈でない人（グループに入っていない・止めた・社内の人の client の文脈）は 42501（hint なし・口が 403）
  if v_tenant is null or v_me is null or not app.guest_ok() then
    raise exception 'ゲストでない' using errcode = 'insufficient_privilege';
  end if;
  if not app.guest_sees_ticket(p_ticket) then
    raise exception 'この仕事は見られない' using errcode = 'insufficient_privilege', hint = 'E-GST-060';
  end if;
  select x.id, x.number, x.title, x.assignee_member_id into t
    from tickets x where x.id = p_ticket and x.tenant_id = v_tenant and x.deleted_at is null;
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, guest_visible, created_by, updated_by)
    values (v_tenant, p_ticket, v_me, 'post', p_body, true, v_me, v_me)
    returning id into v_id;
  -- 担当者（止めていない・抜けていない人）に 1 件。書いたゲスト本人には知らせない。本文は入れない。メールは送らない
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, created_by)
  select v_tenant, t.assignee_member_id, 'inapp', 'ticket.message',
         jsonb_build_object('ticket_id', p_ticket, 'number', t.number, 'title', t.title, 'message_id', v_id, 'url', '/tickets/' || p_ticket),
         'ticket.message:' || v_id || ':' || t.assignee_member_id, now(), v_me
   where t.assignee_member_id is not null and t.assignee_member_id <> v_me
     and exists (select 1 from members m
                  where m.id = t.assignee_member_id and m.tenant_id = v_tenant and m.deleted_at is null and m.suspended_at is null)
     and exists (select 1 from tenant_memberships tm
                  where tm.tenant_id = v_tenant and tm.member_id = t.assignee_member_id
                    and tm.status = 'active' and tm.deleted_at is null);
  perform app.record_audit('ticket.guest_message_posted', 'tickets', p_ticket::text, 'C2',
                           jsonb_build_object('ticket_id', p_ticket, 'message_id', v_id));
  return jsonb_build_object('id', v_id);
end $$;
revoke all on function app.portal_ticket_message_post(uuid, text) from public;
grant execute on function app.portal_ticket_message_post(uuid, text) to kaname_app;
