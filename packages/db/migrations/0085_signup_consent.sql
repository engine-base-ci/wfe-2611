-- 0085 登録の申し込みに、同意した規約の版と時刻・申し込みの印を足す（K-51・D-128.137・D-128.142）
--   同意は登録の画面の中（「続けると利用規約とプライバシーに同意したことになる」）。版と時刻は申し込みに残し、
--   確定のとき（K-52）に terms_consents へ 2 行に分けて移す。版の列は terms_versions.id を指す（会社のデータの表なので外部キーは張らない。
--   kaname_auth の表から public を参照すると、運営が版を取り下げる・消すときに認証の側が邪魔をする）。
--   申し込みの印（signup_token_hash）は、登録を送ったブラウザにだけ渡す値のハッシュ。待つ画面の状態と送り直しはこれで引き、メールでは引かない。
--   確認のメールのリンクの手がかり（token_hash）とは別の値（印だけでは登録を確定できない）。
alter table kaname_auth.pending_signup add column if not exists terms_version_id uuid;
alter table kaname_auth.pending_signup add column if not exists privacy_version_id uuid;
alter table kaname_auth.pending_signup add column if not exists consented_at timestamptz;
alter table kaname_auth.pending_signup add column if not exists signup_token_hash text;
-- 会社名は空でよい（空なら確定のときに本人の名前で個人のワークスペース・D-125.135）。空の文字で預ける
alter table kaname_auth.pending_signup alter column company_name set default '';
create unique index if not exists pending_signup_signup_token on kaname_auth.pending_signup (signup_token_hash)
  where signup_token_hash is not null;

-- 登録の画面が同意させる今の版（利用規約・プライバシーポリシー）。ログインしていない時点で読むので、行の守り（terms_versions_all_read）の外から
-- 読む細い入口にする。返すのは id だけ。認証の接続（kaname_auth）は app のスキーマを使えないので、kaname_auth の側に置く。
-- K-53 の app.current_terms ができたら、そちらに寄せる
create or replace function kaname_auth.signup_current_terms() returns table (terms_version_id uuid, privacy_version_id uuid)
language sql stable security definer set search_path = public, app as $$
  select
    (select id from terms_versions where tenant_id = app.ops_tenant_id() and kind = 'terms' and deleted_at is null and published_at <= now()
      order by published_at desc, created_at desc limit 1),
    (select id from terms_versions where tenant_id = app.ops_tenant_id() and kind = 'privacy' and deleted_at is null and published_at <= now()
      order by published_at desc, created_at desc limit 1)
$$;
revoke all on function kaname_auth.signup_current_terms() from public;
grant execute on function kaname_auth.signup_current_terms() to kaname_auth;

insert into app.schema_migrations (name) values ('0085_signup_consent.sql') on conflict do nothing;
