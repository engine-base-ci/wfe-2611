-- 0037 Bridge の問い合わせ 1 回ぶん（D-097）。画面も API も Vercel に置くので、問い合わせの回数と長さがそのまま費用になる。
-- 1 回の問い合わせで「生きている」も知らせる（別に 30 秒ごとに知らせなくてよい）。あわせて、いま仕事が動いている最中か（直近 5 分に
-- 仕事が入った・終わった）を返す。動いている最中だけ API は待ち受け（長めに待って、入ったらすぐ返す）、それ以外はすぐ返して間をあけてもらう。
-- 生の select は行レベルの制御に弾かれて 0 件になる（0036 と同じ）ので、判定は定義の中で行う。鍵が死んでいれば null（API は 410）。
create or replace function app.bridge_poll(p_session uuid) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid;
begin
  update sessions set last_seen_at = now()
   where id = p_session and kind_id = 'bridge' and revoked_at is null and deleted_at is null
   returning member_id into v_member;
  if v_member is null then return null; end if;
  return exists (select 1 from bridge_jobs j
                  where j.member_id = v_member and j.deleted_at is null
                    and (j.state_id in ('queued', 'running')
                         or j.created_at > now() - interval '5 minutes'
                         or j.finished_at > now() - interval '5 minutes'));
end $$;
grant execute on function app.bridge_poll(uuid) to kaname_app;
