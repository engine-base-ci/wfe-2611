-- 同じ端末でつなぎ直すたびに sessions が 1 行増えていた（画面の「端末」が 3 行になる）。
-- 端末は 1 台 1 行にする：同じ人・同じ端末の古い行は、つなぎ直した時点で無効にする。
-- 由来 2026-09-23 user「なんで繋がっているはずなのにないってなるわけ？」の調査で発覚（G-07 の類）
create or replace function app.bridge_claim(p_code text, p_device_label text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_member uuid; v_session uuid; v_label text;
begin
  update app.bridge_pairings set claimed_at = now(), device_label = p_device_label
    where code = p_code and claimed_at is null and expires_at > now()
    returning tenant_id, member_id into v_tenant, v_member;
  if v_member is null then return null; end if;
  v_label := coalesce(p_device_label, 'この PC');
  -- 同じ端末の古い接続は切る（1 台 1 行。古い鍵も同時に無効になる）
  update sessions set revoked_at = now()
    where member_id = v_member and kind_id = 'bridge' and revoked_at is null
      and device_label is not distinct from v_label;
  insert into sessions (tenant_id, member_id, kind_id, device_label)
    values (v_tenant, v_member, 'bridge', v_label)
    returning id into v_session;
  perform app.setup_step_done(v_member, 1::smallint);
  return v_session;
end $$;
grant execute on function app.bridge_claim(text, text) to kaname_app;

-- 既にできてしまった重複を畳む（端末ごとに最後の 1 行だけ残す）。何度流しても同じ結果になる
update sessions s set revoked_at = now()
where s.kind_id = 'bridge' and s.revoked_at is null
  and exists (
    select 1 from sessions t
    where t.kind_id = 'bridge' and t.revoked_at is null
      and t.member_id = s.member_id
      and t.device_label is not distinct from s.device_label
      and (t.last_seen_at, t.id) > (s.last_seen_at, s.id)
  );
