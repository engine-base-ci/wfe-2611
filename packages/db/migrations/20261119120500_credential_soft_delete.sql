-- 20261119120500 預けたログイン情報を消す・前の確かめを止める（K-353・契約の口 deleteCredential・updateCredential・D-128.57・D-128.84・関門 C2）
--   新しい表・列は作らない。関数を 2 つ足す（どちらも行の守りの外・security definer。呼んだ人は app.user_id() で引き、引数で人を受けない）。
--
-- ① app.credential_soft_delete：行に deleted_at と revoked_at を立て、その資格情報の確かめの途中の仕事（queued・running・asking）を cancelled にする（1 つの取引）。
--      共通の softDelete（行の守りの中の update）にしない訳：ワークスペースの物を別の管理者が消すとき、前の持ち主の仕事は bridge_jobs の行の守り
--      （自分の仕事か bridge_jobs の edit を持つ人だけが直せる）で 0 行になり、黙って止まらないため。チケットを消す app.ticket_soft_delete（0102）と同じ形。
--      答え：('ok', 行の金庫の参照)／('not_found', null)＝無い・別の会社・消した・失効しただけ（一覧に出ない物・代表の答え answer=449e72553c59）・他人の個人
--            ／('forbidden', null)＝ワークスペースの物で credentials の edit が無い。金庫の失効と証跡は口（apps/api/src/features/F3/credentials/delete.ts）が同じ取引で書く
-- ② app.credential_cancel_checks：上書きで中身を替えるとき、前の値で動いている確かめの仕事（kind login_check・queued・running・asking）を cancelled にする。
--      行を書ける人（個人は持ち主・ワークスペースは credentials の edit を持つ人）だけ。書けない人・見えない物は何もせず 0。止めた数を返す。
--      止めた仕事は 0065 の引き金（app.login_check_job_stopped）が行の login_check_state を stopped に写し、続けて積む確かめが pending に直す

create or replace function app.credential_soft_delete(p_id uuid) returns table (status text, vault_ref text)
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_me uuid := app.user_id(); c credentials%rowtype;
begin
  if v_me is null or app.tenant_id() is null or not app.member_ok() then
    return query select 'not_found'::text, null::text; return;
  end if;
  select * into c from credentials x
   where x.id = p_id and x.tenant_id = app.tenant_id() and x.deleted_at is null and x.revoked_at is null for update;
  if c.id is null or (c.layer = 'personal' and c.owner_member_id is distinct from v_me) then
    return query select 'not_found'::text, null::text; return;
  end if;
  if c.layer = 'workspace' and not has_permission(v_me, 'credentials', null, 'edit') then
    return query select 'forbidden'::text, null::text; return;
  end if;
  update credentials x set deleted_at = now(), revoked_at = coalesce(x.revoked_at, now()), updated_by = v_me where x.id = c.id;
  update bridge_jobs j set state_id = 'cancelled', finished_at = now()
   where j.credential_id = c.id and j.state_id in ('queued', 'running', 'asking') and j.deleted_at is null;
  return query select 'ok'::text, c.vault_ref;
end $$;
revoke all on function app.credential_soft_delete(uuid) from public;
grant execute on function app.credential_soft_delete(uuid) to kaname_app;

create or replace function app.credential_cancel_checks(p_id uuid) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_me uuid := app.user_id(); c credentials%rowtype; v_n integer;
begin
  if v_me is null or app.tenant_id() is null or not app.member_ok() then return 0; end if;
  select * into c from credentials x
   where x.id = p_id and x.tenant_id = app.tenant_id() and x.deleted_at is null and x.revoked_at is null for update;
  if c.id is null then return 0; end if;
  if (c.layer = 'personal' and c.owner_member_id is distinct from v_me)
     or (c.layer = 'workspace' and not has_permission(v_me, 'credentials', null, 'edit')) then
    return 0;
  end if;
  update bridge_jobs j set state_id = 'cancelled', finished_at = now()
   where j.credential_id = c.id and j.kind = 'login_check' and j.state_id in ('queued', 'running', 'asking') and j.deleted_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function app.credential_cancel_checks(uuid) from public;
grant execute on function app.credential_cancel_checks(uuid) to kaname_app;
