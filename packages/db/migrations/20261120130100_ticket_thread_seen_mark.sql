-- 20261120130100 最後にやり取りを開いた時刻を書く関数（K-384・契約の新しい口 markTicketTimelineSeen・D-128.45・D-136.2・関門 C2）
--   人ごと・チケットごとの 1 行（app.ticket_thread_seen・20261120130000）を書く。見ている人は app.user_id() で引く（引数で人を受けない）。
--   書く値：least(coalesce(p_at, now()), now())。前の行が在れば greatest(前の値, 新しい値)（前には戻さない・これからの時刻は今に直す）。
--   見られないチケット（別の会社・消した・グループの外）と会社から外れた人は null（口は 404）。知らせ・証跡は書かない（自分の画面の都合の値）
-- 中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形（create or replace）

create or replace function app.ticket_thread_seen_mark(p_ticket uuid, p_at timestamptz) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_seen timestamptz;
begin
  if app.tenant_id() is null or app.user_id() is null or p_ticket is null then return null; end if;
  if not app.member_ok() or not app.ticket_visible(p_ticket) then return null; end if;
  insert into app.ticket_thread_seen (tenant_id, ticket_id, member_id, seen_at)
  values (app.tenant_id(), p_ticket, app.user_id(), least(coalesce(p_at, now()), now()))
  on conflict (tenant_id, ticket_id, member_id)
  do update set seen_at = greatest(app.ticket_thread_seen.seen_at, excluded.seen_at), updated_at = now()
  returning seen_at into v_seen;
  return jsonb_build_object('ticket_id', p_ticket, 'seen_at', v_seen);
end $$;
revoke all on function app.ticket_thread_seen_mark(uuid, timestamptz) from public;
grant execute on function app.ticket_thread_seen_mark(uuid, timestamptz) to kaname_app;
