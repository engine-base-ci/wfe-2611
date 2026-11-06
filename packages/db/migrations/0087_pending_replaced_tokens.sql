-- 0087 メールを確かめる（K-52・D-128.146・D-128.167）の DB の足し分
--   ① 送り直しで上書きされた前のリンクの手がかりを残す（replaced_token_hashes）。同じメールでもう一度登録した（putPending）・
--      待つ画面で「もう一度送る」を押した（renewPendingLink）ときに、前の token_hash をここへ移す。前のリンクを開いた人に
--      「期限切れ」や「でたらめ」と違う案内（E-AUTH-008「新しく届いたメールのリンクを開いてください」）を出すため。
--      置くのはハッシュだけ（平文の手がかりは持たない）。残すのは最後の数件だけ（送り直しで伸び続けない・アプリが切り詰める）。行は 1 日で sweepPending が消す
--   ② 確定したら包んだパスワードを空にする（TP-REG-14）。行は「確定済み」と「期限切れ」を分けるために残すので、列は空を許す
--   ③ 確定の途中で落ちたときの作りかけの会社は消さずに「作りかけで止めた」印（tenants.half_made_at）を付け、中身だけを片付ける
--      関数 app.drop_half_made_company（D-128.167）。監査の記録（security_events・audit_events）は消さない
--   ④ 別のアカウントでログイン中に確定したとき、新しい本人のセッションを閉じる理由 signup_other_account（ログアウトと分ける・D-128.137）
alter table kaname_auth.pending_signup add column if not exists replaced_token_hashes text[] not null default '{}';
create index if not exists pending_signup_replaced_tokens on kaname_auth.pending_signup using gin (replaced_token_hashes);
alter table kaname_auth.pending_signup alter column pw_iv drop not null;
alter table kaname_auth.pending_signup alter column pw_tag drop not null;
alter table kaname_auth.pending_signup alter column pw_data drop not null;

insert into revoke_reasons (key, label) values ('signup_other_account', '別のアカウントでログイン中に登録を確定した')
  on conflict do nothing;

-- 作りかけで止めた会社の印。印の付いた会社はどの画面の読み出しにも出さない：中身（人）を片付けるので、会社の人の読み出し
--   （tenants_tenant_read は、その会社の人であること）にも、運営の読み出し（tenants_ops_read_with_grant は、その会社が許可した
--   調べる許可があること。人のいない会社は許可を出せない）にも出ない。行の守りは仕様（entities.json）から作るので、ここでは足さない
alter table tenants add column if not exists half_made_at timestamptz;

-- 作りかけの会社を片付ける（K-52・D-128.167）。確定の途中（signUp の hook の app.create_company の後）で落ちたときだけ、確定の処理が呼ぶ。
--   守りは 3 重：① その会社が作られて 5 分以内（DB の now() で比べる）② 人（members）がその本人 1 人だけ ③ 運営の会社でない。
--   1 つでも外れたら何もしない（0 を返す）。呼べるのは確定の処理の役（認証の接続 kaname_auth）だけ。
--   会社（tenants）の行は消さずに印を付け、中身を子の行から先に片付ける：セッション・知らせ・同意・自分のAI・権限 → 人 → 層。
--   作ったときに入る初めの行（チケットの種類など）と、監査の記録（security_events・audit_events）は残す。片付けたら 1 を返す
create or replace function app.drop_half_made_company(p_tenant_id uuid, p_auth_user_id text) returns int
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid;
begin
  if p_tenant_id is null or p_auth_user_id is null or p_auth_user_id = '' then return 0; end if;
  if p_tenant_id = app.ops_tenant_id() then return 0; end if;
  perform 1 from tenants t where t.id = p_tenant_id and t.created_at >= now() - interval '5 minutes' for update;
  if not found then return 0; end if;
  if (select count(*) from members m where m.tenant_id = p_tenant_id) <> 1 then return 0; end if;
  select m.id into v_member from members m where m.tenant_id = p_tenant_id and m.auth_user_id = p_auth_user_id;
  if v_member is null then return 0; end if;
  update tenants set half_made_at = coalesce(half_made_at, now()) where id = p_tenant_id;
  delete from sessions where tenant_id = p_tenant_id;
  delete from notifications where tenant_id = p_tenant_id;
  delete from terms_consents where tenant_id = p_tenant_id;
  delete from clones where tenant_id = p_tenant_id;
  delete from permissions where tenant_id = p_tenant_id;
  delete from members where tenant_id = p_tenant_id;
  delete from scopes where tenant_id = p_tenant_id;
  return 1;
end $$;
revoke all on function app.drop_half_made_company(uuid, text) from public;
grant execute on function app.drop_half_made_company(uuid, text) to kaname_auth;
-- 認証の本人を消してよいか（その本人の会社の人が、どの会社にも残っていないとき）。確定の処理の役だけが読む
create or replace function app.auth_user_has_members(p_auth_user_id text) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from members m where m.auth_user_id = p_auth_user_id)
$$;
revoke all on function app.auth_user_has_members(text) from public;
grant execute on function app.auth_user_has_members(text) to kaname_auth;
-- 確定の処理の役（kaname_auth）が上の 2 つを呼べるように、app のスキーマを使えるようにする（呼べる関数は execute で決まる）
grant usage on schema app to kaname_auth;

insert into app.schema_migrations (name) values ('0087_pending_replaced_tokens.sql') on conflict do nothing;
