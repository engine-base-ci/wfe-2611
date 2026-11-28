-- 0024 はじめの設定の進み具合（D-089）。
-- 由来：はじめの設定（1 PCをつなぐ → 6 本番へ）をどこまで通ったかを、どこにも記録していなかった。
-- そのため「毎度、進んだところまで戻す」ができず、ログインするとまだ無い画面（今日）へ飛んでいた。
-- 人ごとに持つ（Bridge はその人の PC・ログイン情報はその人が預ける）。0＝まだ何もしていない、6＝通し終わり。

create table if not exists setup_steps (n smallint primary key, label text not null);
insert into setup_steps (n, label) values
  (1, 'PCをつなぐ'), (2, '話す'), (3, 'たたき台'), (4, 'ログイン情報'), (5, 'テスト'), (6, '本番へ')
on conflict do nothing;

alter table members add column if not exists setup_step smallint not null default 0;
alter table members drop constraint if exists members_setup_step_range;
alter table members add constraint members_setup_step_range check (setup_step between 0 and 6);

-- 進み具合は「戻らない」。押した段より小さい値で上書きしない（連打・戻るボタンで巻き戻らないように）
create or replace function app.setup_step_done(p_member uuid, p_step smallint) returns smallint
language plpgsql security definer set search_path = public, app as $$
declare v smallint;
begin
  if p_step is null or p_step < 1 or p_step > 6 then raise exception '段は 1〜6' using errcode = '22003'; end if;
  update members set setup_step = greatest(setup_step, p_step) where id = p_member returning setup_step into v;
  return v;
end $$;
grant execute on function app.setup_step_done(uuid, smallint) to kaname_app;

-- 既に通っている人を取り残さない：生きている Bridge があれば 1 以上、目標があれば 3 以上
update members m set setup_step = greatest(m.setup_step, 1)
  where exists (select 1 from sessions s where s.member_id = m.id and s.kind_id = 'bridge' and s.revoked_at is null);
update members m set setup_step = greatest(m.setup_step, 3)
  where exists (select 1 from goals g where g.tenant_id = m.tenant_id and g.deleted_at is null);
