-- 0084 本人のものは本人だけ（KN-54 の本物の DB の権限の試験で見つけた穴・2026-11-03）
--   分身との会話・その発言・自分の記憶・自分の問い合わせは、前の形（ER の印からの当てはめ）だと
--   「同じグループなら他人のものも読める」「グループの権限があれば他人を持ち主にして作れる」になっていた。
--   会話の発言は、その会話を読める人（自分の会話・一緒に話している人）だけにする。守りの中身は policies/0084_private_rows.sql（05_flow/rls_policies.py から生成）。
create or replace function app.conversation_visible(cid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from conversations c
    where c.id = cid and c.tenant_id = app.tenant_id() and c.deleted_at is null
      and (c.owner_member_id = app.user_id() or app.user_id() = any(c.participant_member_ids))
  )
$$;
grant execute on function app.conversation_visible(uuid) to kaname_app;

insert into app.schema_migrations (name) values ('0084_private_rows.sql') on conflict do nothing;
