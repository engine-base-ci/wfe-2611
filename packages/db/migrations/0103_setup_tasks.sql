-- 0103 はじめにやることの口（K-250・D-125.146・D-128.62・D-145.11〜.15・D-128.137）
--   ① members.setup_skipped_keys：本人が「あとで」で飛ばした任意の項目（今は credentials だけ）。閉じた時刻は前からの setup_dismissed_at（0078）
--   ② app.setup_pc_done：PC を一度でもつないだか（最初の知らせ alive_at が届いた Bridge の行が在る）。外しても済みのまま（D-145.12）。
--      PC はアカウント全体のもの（D-128.137）なので、同じログインの人の別の会社でつないだ PC も数える。sessions の行の守りは今の会社だけなので security definer で数える
--   ③ app.setup_dismiss・app.setup_skip：自分の今の会社の members の行だけを書く（members の書く守りは edit の権限が要るため・policies/0002）。
--      別の会社の自分の行は書かない（p_member = app.user_id() かつ その行の tenant_id = app.tenant_id()）

-- ---------------------------------------------------------------- ①
alter table members add column if not exists setup_skipped_keys text[] not null default '{}';
-- 飛ばせるのは任意の項目だけ（口が先に 422 で断る。DB でも 2 重に守る）
do $$ begin
  alter table members add constraint members_setup_skipped_keys_check check (setup_skipped_keys <@ array['credentials']::text[]);
exception when duplicate_object then null;
end $$;

-- 一度でも知らせが届いた Bridge の行を人ごとに引く（外した行も数えるので revoked_at で絞らない）
create index if not exists sessions_bridge_alive_member_idx on sessions (member_id) where kind_id = 'bridge' and alive_at is not null;

-- ---------------------------------------------------------------- ②
create or replace function app.setup_pc_done(p_member uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select p_member is not null and p_member = app.user_id()
     and exists (select 1 from sessions s
                  where s.kind_id = 'bridge' and s.alive_at is not null
                    and s.member_id in (select app.account_members(p_member)))
$$;
revoke all on function app.setup_pc_done(uuid) from public;
grant execute on function app.setup_pc_done(uuid) to kaname_app;

-- ---------------------------------------------------------------- ③
-- 箱を閉じる。最初の 1 回だけ時刻を立てる（2 回目は変えない）。自分の今の会社の行が無ければ false
create or replace function app.setup_dismiss(p_member uuid) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if p_member is null or p_member is distinct from app.user_id() or app.tenant_id() is null then return false; end if;
  update members set setup_dismissed_at = coalesce(setup_dismissed_at, now())
   where id = p_member and tenant_id = app.tenant_id() and deleted_at is null;
  return found;
end $$;
revoke all on function app.setup_dismiss(uuid) from public;
grant execute on function app.setup_dismiss(uuid) to kaname_app;

-- 任意の項目を「あとで」で飛ばす（重ねて足さない）。任意でない項目・自分の今の会社の行が無ければ false
create or replace function app.setup_skip(p_member uuid, p_key text) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if p_member is null or p_member is distinct from app.user_id() or app.tenant_id() is null then return false; end if;
  if p_key is distinct from 'credentials' then return false; end if;
  update members
     set setup_skipped_keys = case when p_key = any(setup_skipped_keys) then setup_skipped_keys
                                   else setup_skipped_keys || p_key end
   where id = p_member and tenant_id = app.tenant_id() and deleted_at is null;
  return found;
end $$;
revoke all on function app.setup_skip(uuid, text) from public;
grant execute on function app.setup_skip(uuid, text) to kaname_app;
