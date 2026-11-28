-- 0036 Bridge の鍵が生きているか（登録されていて・切れていない・消えていない）を関数で返す。
-- API 側で sessions を生の select で見ると、行レベルの制御に弾かれて「0 件」になる（0026・0027・0030・0032 に続き 5 回目）。
-- 判定は定義の中でやり、結果だけ返す。鍵が死んでいれば API は 410 を返し、Bridge は鍵を捨ててつなぎ直しを促す（G-14）。
create or replace function app.bridge_session_alive(p_session uuid) returns boolean
language sql security definer stable set search_path = public, app as $$
  select exists (select 1 from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null and deleted_at is null);
$$;
grant execute on function app.bridge_session_alive(uuid) to kaname_app;
