-- 保留の申し込み（D-088）：「はじめる」では何も作らない。メールを確認した時点で
-- 利用者・会社・層・代表・自分のAI を作る。それまではこの 1 行だけが残る。
-- 会社のデータではない（まだ会社が無い）ので public ではなく kaname_auth に置く。
-- 触れるのは認証の接続だけ。パスワードは平文で持たず、鍵で包んで預かる（30 分で失効）。
create table if not exists kaname_auth.pending_signup (
  email          text primary key,
  name           text not null,
  company_name   text not null,
  pw_iv          text not null,
  pw_tag         text not null,
  pw_data        text not null,
  token_hash     text not null,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- 送れたか。送れていないのに「送りました」と画面に出さないため（G-15）
  sent_at        timestamptz,
  send_error     text
);
create index if not exists pending_signup_token on kaname_auth.pending_signup (token_hash);
create index if not exists pending_signup_expires on kaname_auth.pending_signup (expires_at);
