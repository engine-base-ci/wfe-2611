-- 0025 dev だけ：Bridge の代わりに接続コードを引き取る（D-089）。
-- Bridge 本体（インストーラ）は T-I-02 でまだ配布していないため、これが無いと はじめの設定 を 1 段目から先へ一度も通せない。
-- 書き込みは行レベルの制御を越えるので、他の登録まわりと同じく security definer の関数に寄せる（関門 C2 の外に生の insert を置かない）。
-- 口（POST /api/auth-ext/bridge/dev-claim）は本番では生やさない。関数だけあっても呼ぶ道が無い。
create or replace function app.bridge_dev_claim(p_member uuid, p_code text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid;
begin
  update app.bridge_pairings set claimed_at = now()
    where code = p_code and member_id = p_member and claimed_at is null and expires_at > now()
    returning tenant_id into v_tenant;
  if v_tenant is null then return false; end if;
  insert into sessions (tenant_id, member_id, kind_id, device_label)
    values (v_tenant, p_member, 'bridge', 'この PC（dev の代わり）');
  perform app.setup_step_done(p_member, 1::smallint);
  return true;
end $$;
grant execute on function app.bridge_dev_claim(uuid, text) to kaname_app;
