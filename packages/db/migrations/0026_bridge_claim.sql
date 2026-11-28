-- 0026 Bridge が接続コードを引き取る（D-015・D-089）。
-- Bridge 本体（apps/bridge）から呼ぶ本番の口。ログインしていない状態で呼ばれる（Bridge はまだ誰か分からない）ので、
-- 「10 分以内の・まだ使われていない接続コード」だけを鍵にして、その人の端末として sessions に 1 行作る。
-- 書き込みは行レベルの制御を越えるため security definer に寄せる（関門 C2 の外に生の insert を置かない）。
create or replace function app.bridge_claim(p_code text, p_device_label text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_member uuid;
begin
  update app.bridge_pairings set claimed_at = now(), device_label = p_device_label
    where code = p_code and claimed_at is null and expires_at > now()
    returning tenant_id, member_id into v_tenant, v_member;
  if v_member is null then return null; end if;
  insert into sessions (tenant_id, member_id, kind_id, device_label)
    values (v_tenant, v_member, 'bridge', coalesce(p_device_label, 'この PC'));
  perform app.setup_step_done(v_member, 1::smallint);
  return v_member;
end $$;
grant execute on function app.bridge_claim(text, text) to kaname_app;
