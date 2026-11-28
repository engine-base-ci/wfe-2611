-- 0033 「新しい会話」（D-062）。会話は 1 本で、押すまで続く。押したらその会話を閉じ、次に言ったことが新しい 1 本になる。
-- 閉じても消さない（前の版・前のやりとりは残る。D-066 の「前の版は消えない」と同じ）。
create or replace function app.agent_close_conversation(p_member uuid, p_conv uuid) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update conversations set closed_at = now()
    where owner_member_id = p_member and closed_at is null and deleted_at is null
      and (p_conv is null or id = p_conv);
  get diagnostics n = row_count; return n > 0;
end $$;
grant execute on function app.agent_close_conversation(uuid, uuid) to kaname_app;
