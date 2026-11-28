-- 20261126001700_member_reinvite 招き直しで戻すグループの役割の上限（K-817・D-128.96・D-154.26・D-154.41・関門 C2）
--   app.restore_group_role(p_old, p_invited)：戻すグループの役割＝外す前の役割 p_old と、招いた役割 p_invited が許す上限の低いほう。
--   上限：admin・manager → manager／member → member／viewer・requester ほか → viewer。順は viewer < member < manager。p_old が null なら上限。
--   戻す振る舞いそのものは K-852 の参加の関数（security definer）がこの関数を使って受ける。引き金は作らない（案 x・.ticket-flow/out/K-817/F11-note.md）。
--   public と kaname_app には execute を渡さない。

create or replace function app.restore_group_role(p_old text, p_invited text) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  with r(cap) as (
    select case
             when p_invited in ('admin', 'manager') then 'manager'
             when p_invited = 'member' then 'member'
             else 'viewer'
           end
  )
  select case
           when p_old is null then r.cap
           when (case p_old when 'manager' then 3 when 'member' then 2 else 1 end)
                <= (case r.cap when 'manager' then 3 when 'member' then 2 else 1 end)
             then case when p_old in ('manager', 'member') then p_old else 'viewer' end
           else r.cap
         end
    from r
$$;
revoke all on function app.restore_group_role(text, text) from public;

insert into app.schema_migrations (name) values ('20261126001700_member_reinvite.sql') on conflict do nothing;
