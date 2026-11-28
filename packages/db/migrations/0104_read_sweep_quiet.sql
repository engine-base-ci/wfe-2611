-- K-236 読む口の片付けを 1 本の文にする。
--   読む口（チケットの詳細・承認待ちの一覧と 1 件）は、読む前に承認の後の実行の仕事を片付ける（K-164・0098）。
--   今までは API が savepoint・片付け・release の 3 本で包み、失敗したら片付けだけを戻していた。
--   その戻しを関数の中の例外の受け（DB の中の savepoint）に移し、読む口からは 1 本の文で呼べるようにする。
--   片付けの中身（app.ticket_execute_sweep・app.ticket_execute_sweep_mine）は変えない。
--   security invoker：呼んだ人の権限で動く（承認の行の守り approvals の RLS が今と同じく効く）。中の関数は前から security definer。
--   答え：片付けた件数。片付けが例外・時間切れ・取り消しで落ちたら -1（片付けだけが戻り、読む取引は続く）。種類が違えば 0。
create or replace function app.ticket_execute_sweep_read(p_kind text, p_id uuid) returns integer
language plpgsql security invoker set search_path = public, app, pg_temp as $$
begin
  if p_kind = 'ticket' then
    return app.ticket_execute_sweep(p_id);
  elsif p_kind = 'approval' then
    return app.ticket_execute_sweep(
      (select a.ticket_id from approvals a where a.id = p_id and a.tenant_id = app.tenant_id()));
  elsif p_kind = 'mine' then
    return app.ticket_execute_sweep_mine();
  end if;
  return 0;
exception
  -- plpgsql の others は query_canceled（時間切れ・取り消し）を含まないので名前で受ける
  when query_canceled then
    return -1;
  when others then
    return -1;
end;
$$;
revoke all on function app.ticket_execute_sweep_read(text, uuid) from public;
grant execute on function app.ticket_execute_sweep_read(text, uuid) to kaname_app;
