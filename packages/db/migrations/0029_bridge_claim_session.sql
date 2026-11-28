-- 0029 claim が bridge の session id を返す（D-090）。
-- API から生の select で sessions を読むと行レベルの制御に弾かれて黙って null になる（0026 の取りこぼし）。
-- 作った本人（security definer の中）が返すのが確実。
create or replace function app.bridge_claim(p_code text, p_device_label text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_member uuid; v_session uuid;
begin
  update app.bridge_pairings set claimed_at = now(), device_label = p_device_label
    where code = p_code and claimed_at is null and expires_at > now()
    returning tenant_id, member_id into v_tenant, v_member;
  if v_member is null then return null; end if;
  insert into sessions (tenant_id, member_id, kind_id, device_label)
    values (v_tenant, v_member, 'bridge', coalesce(p_device_label, 'この PC'))
    returning id into v_session;
  perform app.setup_step_done(v_member, 1::smallint);
  return v_session;   -- Bridge はこの id を鍵に、生存の知らせ／仕事の受け取り／結末 を話す
end $$;
grant execute on function app.bridge_claim(text, text) to kaname_app;
