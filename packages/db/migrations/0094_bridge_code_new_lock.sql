-- K-171：PC をつなぐコードを同時に出しても、アカウントで生きたコードは 1 つだけ（app.bridge_code_new の取り合いを直す）
-- 0089 では「前の使っていないコードを無効にしてから 1 行足す」を、同時に呼ばれた 2 つの取引が相手の行が見えないうちに行い、2 つ生きることがあった。
-- アカウントごとの鍵（pg_advisory_xact_lock・取引の終わりで外れる）を先に取り、後から来た取引は前の取引の確定を待ってから無効にする。
-- 鍵の数：(171, アカウントの印のハッシュ)。171 はこの関数専用（他の鍵と混ざらない）。アカウントの印は app.account_members と同じ見方
-- （members.auth_user_id → 無ければ tenant_memberships の auth_user_id → どちらも無ければ member の id）。別のアカウントは待たせない。
-- 振る舞い（D-128.93：10 分・1 回だけ・前のコードは使えなくする）は変えない。
create or replace function app.bridge_code_new(p_tenant uuid, p_member uuid, p_code_hash text) returns timestamptz
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_exp timestamptz; v_account text;
begin
  if p_code_hash is null or length(p_code_hash) < 32 then raise exception 'コードはハッシュで渡す' using errcode = '22023'; end if;
  select coalesce(m.auth_user_id, (select tm.auth_user_id from tenant_memberships tm where tm.member_id = m.id and tm.auth_user_id is not null limit 1))::text
    into v_account from members m where m.id = p_member and m.deleted_at is null;
  perform pg_advisory_xact_lock(171, hashtext(coalesce(v_account, p_member::text)));
  update bridge_pairing_codes set deleted_at = now()
    where member_id in (select app.account_members(p_member)) and used_at is null and deleted_at is null;
  insert into bridge_pairing_codes (tenant_id, member_id, code_hash, created_by)
    values (p_tenant, p_member, p_code_hash, p_member)
    returning expires_at into v_exp;
  return v_exp;
end $$;
revoke all on function app.bridge_code_new(uuid, uuid, text) from public;
grant execute on function app.bridge_code_new(uuid, uuid, text) to kaname_app;
