-- K-766：開き直して 2 回目に完了にしても、完了のお知らせが届く（D-128.92・K-388 の申し送り）。
--   0101 の app.ticket_completed_notice(uuid, boolean) の本体を写し、★ の 1 か所だけを変えた：
--   「同じ宛先に同じ鍵の行がもう在れば書かない」を「今の完了（tickets.completed_at）以後に書いた同じ鍵の行が在れば書かない」に。
--   鍵 ticket.completed:<id>・行の形・宛先の選び方・送れなかった印・守り（完了にした人か・段が完了か・行の for update）は 0101 のまま。
--   同じ完了の中の 2 度目の呼び出し（送り直し・同時の 2 つの口）は先に書いた行が completed_at 以後なので増えない。
--   前の完了の行は今の completed_at より前なので数えず、新しい行を 1 つ書く（1 回の完了につき 1 人に 1 つ）。
--   1 引数の形 app.ticket_completed_notice(uuid) は 0101 のまま（印 false でこの本体を呼ぶだけ）なので作り直さない。
create or replace function app.ticket_completed_notice(p_ticket uuid, p_failed boolean) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_me uuid := app.user_id(); v_key text; n integer := 0;
        v_failed boolean := coalesce(p_failed, false);   -- ★ K-166 が足した所
begin
  if v_me is null then return 0; end if;
  -- チケットの行で待ち合わせる（同時の 2 本が同じ人に 2 つ書かない）
  select x.* into t from tickets x
   where x.id = p_ticket and x.tenant_id = app.tenant_id() and x.deleted_at is null and x.completed_by = v_me
     and exists (select 1 from ticket_stages s where s.id = x.stage_id and s.key = 'done')
     for update;
  if t.id is null then return 0; end if;
  v_key := 'ticket.completed:' || t.id::text;
  -- ★ K-166 が直した所：sent_at を印で分け、failed_at・retry_count を足した（0100 は sent_at に now() だけ）
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, failed_at, retry_count, created_by)
    select t.tenant_id, r, 'inapp', 'ticket.completed',
           jsonb_build_object('ticket_id', t.id, 'number', t.number, 'url', '/tickets/' || t.id::text), v_key,
           case when v_failed then null else now() end, case when v_failed then now() end, case when v_failed then 1 end, v_me
      from app.ticket_completed_recipients(t.id) r
     where not exists (select 1 from notifications o
                        where o.tenant_id = t.tenant_id and o.member_id = r and o.dedupe_key = v_key
                          and o.created_at >= t.completed_at);   -- ★ K-766 が足した所：今の完了より後に書いた行だけを数える
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.ticket_completed_notice(uuid, boolean) from public;
grant execute on function app.ticket_completed_notice(uuid, boolean) to kaname_app;
